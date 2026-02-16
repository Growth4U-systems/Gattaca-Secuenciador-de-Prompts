import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { NicheFinderProgress } from '@/types/scraper.types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  // Create Supabase client with caching disabled to avoid stale data
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  })
  const { id: jobId } = await params

  try {
    // Get job
    const { data: job, error: jobError } = await supabase
      .from('niche_finder_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Get URL counts by status
    const { data: urlCounts } = await supabase
      .from('niche_finder_urls')
      .select('status')
      .eq('job_id', jobId)

    const counts = {
      pending: 0,
      scraped: 0,
      filtered: 0,
      extracted: 0,
      failed: 0,
    }

    for (const url of urlCounts || []) {
      counts[url.status as keyof typeof counts]++
    }

    // AUTO-FIX: Si SERP lleva >5 min sin actualizar, marcar como stuck para que el cliente pueda resumir
    if (job.status === 'serp_running' && job.updated_at) {
      const updatedAt = new Date(job.updated_at).getTime()
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      if (updatedAt < fiveMinutesAgo) {
        console.log(`[STATUS] Auto-fixing stuck SERP job ${jobId}: serp_running >5min without update`)
        // Reset to pending so the client can restart SERP
        await supabase
          .from('niche_finder_jobs')
          .update({ status: 'pending' })
          .eq('id', jobId)
        job.status = 'pending'
      }
    }

    // AUTO-FIX: Detectar y corregir jobs stuck
    // Si el job está en "scraping" pero no hay URLs pending, actualizar a scrape_done
    if (job.status === 'scraping' && counts.pending === 0) {
      console.log(`[STATUS] Auto-fixing stuck job ${jobId}: scraping -> scrape_done (${counts.scraped} scraped, ${counts.failed} failed)`)
      await supabase
        .from('niche_finder_jobs')
        .update({ status: 'scrape_done' })
        .eq('id', jobId)
      job.status = 'scrape_done'
    }

    // AUTO-FIX: Si el job está en "scraping" con muy pocas URLs pending y muchas procesadas,
    // marcar las pending como failed y avanzar (evita stuck por 1-2 URLs problemáticas)
    const totalProcessed = counts.scraped + counts.failed
    if (job.status === 'scraping' && counts.pending > 0 && counts.pending <= 5 && totalProcessed > 50) {
      console.log(`[STATUS] Auto-fixing stuck job ${jobId}: marking ${counts.pending} stuck pending URLs as failed`)

      // Mark remaining pending URLs as failed
      await supabase
        .from('niche_finder_urls')
        .update({
          status: 'failed',
          error_message: 'Auto-marked as failed (stuck in pending state)',
        })
        .eq('job_id', jobId)
        .eq('status', 'pending')

      // Update job status to scrape_done
      await supabase
        .from('niche_finder_jobs')
        .update({ status: 'scrape_done' })
        .eq('id', jobId)

      counts.failed += counts.pending
      counts.pending = 0
      job.status = 'scrape_done'
      console.log(`[STATUS] Job ${jobId} advanced to scrape_done after auto-fix`)
    }

    // AUTO-FIX: Si el job está en "extracting" pero todas las URLs scraped ya fueron procesadas
    const allExtracted = counts.scraped === 0 && (counts.extracted + counts.filtered) > 0
    if (job.status === 'extracting' && allExtracted) {
      console.log(`[STATUS] Auto-fixing stuck job ${jobId}: extracting -> extract_done (${counts.extracted} extracted, ${counts.filtered} filtered)`)
      await supabase
        .from('niche_finder_jobs')
        .update({ status: 'extract_done' })
        .eq('id', jobId)
      job.status = 'extract_done'
    }

    // Determine current phase
    let phase: NicheFinderProgress['phase'] = 'done'
    if (job.status === 'serp_running' || job.status === 'pending') {
      phase = 'serp'
    } else if (job.status === 'scraping' || job.status === 'serp_done') {
      phase = 'scraping'
    } else if (job.status === 'extracting' || job.status === 'scrape_done') {
      phase = 'extracting'
    }
    // review_* and analyzing_* statuses are in the 'done' phase (handled by frontend)

    // Get total costs
    const { data: costs } = await supabase
      .from('niche_finder_costs')
      .select('cost_type, cost_usd')
      .eq('job_id', jobId)

    const totalCosts = {
      serp: 0,
      firecrawl: 0,
      llm: 0,
    }

    for (const cost of costs || []) {
      if (cost.cost_type === 'serp') totalCosts.serp += cost.cost_usd
      else if (cost.cost_type === 'firecrawl') totalCosts.firecrawl += cost.cost_usd
      else if (cost.cost_type === 'llm_extraction') totalCosts.llm += cost.cost_usd
    }

    const progress: NicheFinderProgress = {
      job_id: jobId,
      status: job.status,
      phase,
      progress: {
        serp: {
          total: job.serp_total || job.urls_found || 0,
          completed: job.serp_completed || job.urls_found || 0,
        },
        scraping: {
          total: job.urls_found || 0,
          completed: job.urls_scraped || 0,
          failed: job.urls_failed || 0,
        },
        extraction: {
          total: job.urls_scraped || 0,
          completed: counts.extracted + counts.filtered,
          filtered: counts.filtered,
        },
      },
    }

    // Fetch step outputs for interactive review
    const { data: stepOutputs } = await supabase
      .from('niche_finder_step_outputs')
      .select('step_number, step_name, status, output_content, edited_content, model, tokens_input, tokens_output, cost_usd, error_message, started_at, completed_at')
      .eq('job_id', jobId)
      .order('step_number', { ascending: true })

    return NextResponse.json({
      ...progress,
      job,
      costs: totalCosts,
      url_counts: counts,
      step_outputs: stepOutputs || [],
    })
  } catch (error) {
    console.error('Error getting job status:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
