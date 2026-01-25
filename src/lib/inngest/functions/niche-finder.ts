import { inngest } from '../client'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Types
interface JobStatus {
  id: string
  status: string
  urls_found: number
  urls_scraped: number
  urls_failed: number
  niches_extracted: number
  session_id?: string
  updated_at: string
}

interface UrlCounts {
  pending: number
  scraped: number
  extracted: number
  filtered: number
  failed: number
}

// Helper to get job status
async function getJobStatus(jobId: string): Promise<{ job: JobStatus | null; counts: UrlCounts }> {
  const supabase = getSupabase()

  const { data: job } = await supabase
    .from('niche_finder_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  const { data: urls } = await supabase
    .from('niche_finder_urls')
    .select('status')
    .eq('job_id', jobId)

  const counts: UrlCounts = { pending: 0, scraped: 0, extracted: 0, filtered: 0, failed: 0 }
  for (const url of urls || []) {
    const status = url.status as keyof UrlCounts
    if (counts[status] !== undefined) counts[status]++
  }

  return { job, counts }
}

// Helper to update job status
async function updateJobStatus(jobId: string, status: string) {
  const supabase = getSupabase()
  await supabase
    .from('niche_finder_jobs')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', jobId)
}

// Helper to update session step
async function updateSessionStep(
  sessionId: string,
  stepId: string,
  update: { status?: string; started_at?: string; completed_at?: string; error_message?: string }
) {
  const supabase = getSupabase()
  await supabase
    .from('playbook_session_steps')
    .upsert({
      session_id: sessionId,
      step_id: stepId,
      ...update,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id,step_id' })
}

/**
 * Health Check: Runs every 5 minutes to detect and fix stuck jobs
 */
export const nicheFinderHealthCheck = inngest.createFunction(
  {
    id: 'niche-finder-health-check',
    name: 'Niche Finder Health Check',
  },
  { cron: '*/5 * * * *' },
  async ({ step, logger }) => {
    const supabase = getSupabase()

    // Find jobs that might be stuck (in intermediate states for too long)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const stuckStatuses = ['serp_running', 'scraping', 'extracting', 'analyzing_1', 'analyzing_2', 'analyzing_3']

    const { data: stuckJobs } = await supabase
      .from('niche_finder_jobs')
      .select('id, status, updated_at')
      .in('status', stuckStatuses)
      .lt('updated_at', fiveMinutesAgo)

    logger.info(`Found ${stuckJobs?.length || 0} potentially stuck jobs`)

    const results = []

    for (const job of stuckJobs || []) {
      const result = await step.run(`check-job-${job.id}`, async () => {
        const { job: currentJob, counts } = await getJobStatus(job.id)

        if (!currentJob) return { jobId: job.id, action: 'not_found' }

        // Auto-fix scraping → scrape_done
        if (currentJob.status === 'scraping' && counts.pending === 0) {
          await updateJobStatus(job.id, 'scrape_done')
          logger.info(`Auto-fixed job ${job.id}: scraping -> scrape_done`)
          return { jobId: job.id, action: 'fixed', from: 'scraping', to: 'scrape_done' }
        }

        // Auto-fix scraping with few pending → mark pending as failed and advance
        const totalProcessed = counts.scraped + counts.failed
        if (currentJob.status === 'scraping' && counts.pending > 0 && counts.pending <= 5 && totalProcessed > 50) {
          // Mark remaining pending as failed
          await supabase
            .from('niche_finder_urls')
            .update({ status: 'failed', error_message: 'Auto-marked as failed (stuck)' })
            .eq('job_id', job.id)
            .eq('status', 'pending')

          await updateJobStatus(job.id, 'scrape_done')
          logger.info(`Auto-fixed job ${job.id}: marked ${counts.pending} stuck URLs as failed, scraping -> scrape_done`)
          return { jobId: job.id, action: 'fixed_with_failed', from: 'scraping', to: 'scrape_done', failedUrls: counts.pending }
        }

        // Auto-fix extracting → completed
        if (currentJob.status === 'extracting' && counts.scraped === 0 && (counts.extracted + counts.filtered) > 0) {
          await updateJobStatus(job.id, 'completed')
          logger.info(`Auto-fixed job ${job.id}: extracting -> completed`)
          return { jobId: job.id, action: 'fixed', from: 'extracting', to: 'completed' }
        }

        // Flag jobs stuck for too long
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
        if (new Date(currentJob.updated_at) < tenMinutesAgo) {
          logger.warn(`Job ${job.id} appears stuck in ${currentJob.status} for over 10 minutes`)
          return { jobId: job.id, action: 'flagged_stuck', status: currentJob.status }
        }

        return { jobId: job.id, action: 'healthy' }
      })

      results.push(result)
    }

    return {
      checkedAt: new Date().toISOString(),
      jobsChecked: stuckJobs?.length || 0,
      results,
    }
  }
)

/**
 * Job Monitor: Monitors a specific job and ensures it completes
 * Called when a job is created to track its progress
 */
export const nicheFinderJobMonitor = inngest.createFunction(
  {
    id: 'niche-finder-job-monitor',
    name: 'Niche Finder Job Monitor',
    retries: 2,
  },
  { event: 'niche-finder/job.created' },
  async ({ event, step, logger }) => {
    const { jobId, sessionId } = event.data

    logger.info(`Starting monitor for job ${jobId}`)

    // Initial check
    const initialState = await step.run('get-initial-state', async () => {
      const { job, counts } = await getJobStatus(jobId)
      return { job, counts }
    })

    if (!initialState.job) {
      throw new Error(`Job ${jobId} not found`)
    }

    // Update session if exists
    if (sessionId) {
      await step.run('update-session-start', async () => {
        const supabase = getSupabase()
        await supabase
          .from('playbook_sessions')
          .update({
            active_job_id: jobId,
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
      })
    }

    // Monitor loop - check every 30 seconds for up to 60 minutes
    let attempts = 0
    const maxAttempts = 120 // 120 * 30s = 60 minutes

    while (attempts < maxAttempts) {
      attempts++

      // Sleep for 30 seconds
      await step.sleep(`wait-${attempts}`, '30s')

      // Check job status
      const checkResult = await step.run(`check-${attempts}`, async (): Promise<{
        done: boolean
        reason?: string
        status?: string
        counts?: UrlCounts
        fixed?: boolean
      }> => {
        const { job, counts } = await getJobStatus(jobId)

        if (!job) return { done: true, reason: 'job_not_found' }

        // Job completed
        if (job.status === 'completed' || job.status === 'failed') {
          return { done: true, reason: job.status, counts }
        }

        // Auto-fix stuck states
        if (job.status === 'scraping' && counts.pending === 0) {
          await updateJobStatus(jobId, 'scrape_done')
          logger.info(`Monitor: Auto-fixed job ${jobId} scraping -> scrape_done`)
          return { done: false, fixed: true, status: 'scrape_done' }
        }

        if (job.status === 'extracting' && counts.scraped === 0 && (counts.extracted + counts.filtered) > 0) {
          await updateJobStatus(jobId, 'completed')
          logger.info(`Monitor: Auto-fixed job ${jobId} extracting -> completed`)
          return { done: true, reason: 'completed', fixed: true }
        }

        return { done: false, status: job.status, counts }
      })

      if (checkResult.done) {
        logger.info(`Job ${jobId} finished with status: ${checkResult.reason}`)

        // Save scraped documents to Context Lake when job completes successfully
        if (checkResult.reason === 'completed') {
          await step.run('save-docs-to-context-lake', async () => {
            try {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : 'http://localhost:3000'
              const response = await fetch(`${baseUrl}/api/niche-finder/jobs/${jobId}/save-docs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 'inngest-system' }),
              })
              const result = await response.json()
              logger.info(`Saved documents to Context Lake: ${result.saved} saved, ${result.skipped} skipped`)
              return result
            } catch (saveError) {
              logger.error('Error saving documents to Context Lake:', saveError)
              // Don't fail the job for this
              return { error: 'Failed to save documents' }
            }
          })
        }

        // Update session final state
        if (sessionId) {
          await step.run('update-session-complete', async () => {
            const supabase = getSupabase()
            await supabase
              .from('playbook_sessions')
              .update({
                status: checkResult.reason === 'completed' ? 'completed' : 'failed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', sessionId)
          })
        }

        return {
          jobId,
          finalStatus: checkResult.reason,
          attempts,
          duration: `${attempts * 30} seconds`,
        }
      }
    }

    // Timeout after max attempts
    logger.warn(`Job ${jobId} monitor timed out after ${maxAttempts * 30} seconds`)

    return {
      jobId,
      finalStatus: 'timeout',
      attempts,
      duration: `${maxAttempts * 30} seconds`,
    }
  }
)

// Export all functions
export const functions = [nicheFinderHealthCheck, nicheFinderJobMonitor]
