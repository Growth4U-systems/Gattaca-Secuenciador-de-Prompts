import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { StartNicheFinderRequest, StartNicheFinderResponse } from '@/types/scraper.types'
import { inngest } from '@/lib/inngest/client'

export const dynamic = 'force-dynamic'

interface ExtendedStartRequest extends StartNicheFinderRequest {
  session_id?: string
  create_session?: boolean
  user_id?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<StartNicheFinderResponse>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: 'Database configuration missing' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body: ExtendedStartRequest = await request.json()
    const { project_id, config, session_id, create_session, user_id } = body

    if (!project_id || !config) {
      return NextResponse.json(
        { success: false, error: 'project_id and config are required' },
        { status: 400 }
      )
    }

    // Validate config has minimum required fields
    if (!config.life_contexts?.length || !config.product_words?.length) {
      return NextResponse.json(
        { success: false, error: 'At least one life_context and product_word are required' },
        { status: 400 }
      )
    }

    let effectiveSessionId = session_id

    // Create session if requested and not provided
    if (create_session && !session_id) {
      const { data: newSession, error: sessionError } = await supabase
        .from('playbook_sessions')
        .insert({
          project_id,
          playbook_type: 'niche_finder',
          status: 'active',
          config,
          variables: config,
        })
        .select()
        .single()

      if (sessionError) {
        console.error('Error creating session:', sessionError)
        // Continue without session - not critical
      } else {
        effectiveSessionId = newSession.id
      }
    }

    // Create job record
    const jobData: Record<string, unknown> = {
      project_id,
      status: 'pending',
      config,
      urls_found: 0,
      urls_scraped: 0,
      urls_filtered: 0,
      urls_failed: 0,
      niches_extracted: 0,
    }

    // Link job to session if available
    if (effectiveSessionId) {
      jobData.session_id = effectiveSessionId
    }

    const { data: job, error: insertError } = await supabase
      .from('niche_finder_jobs')
      .insert(jobData)
      .select()
      .single()

    if (insertError) {
      console.error('Error creating job:', insertError)
      return NextResponse.json(
        { success: false, error: `Failed to create job: ${insertError.message}` },
        { status: 500 }
      )
    }

    // Update session with active job
    if (effectiveSessionId) {
      await supabase
        .from('playbook_sessions')
        .update({ active_job_id: job.id })
        .eq('id', effectiveSessionId)
    }

    // Send event to Inngest for background monitoring
    try {
      await inngest.send({
        name: 'niche-finder/job.created',
        data: {
          jobId: job.id,
          sessionId: effectiveSessionId,
          projectId: project_id,
          userId: user_id || 'unknown',
          config: {
            batch_size: config.batch_size,
          },
        },
      })
      console.log(`[START] Inngest event sent for job ${job.id}`)
    } catch (inngestError) {
      // Log but don't fail - job can still work without Inngest monitoring
      console.error('Error sending Inngest event:', inngestError)
    }

    return NextResponse.json({
      success: true,
      job_id: job.id,
      session_id: effectiveSessionId,
    } as StartNicheFinderResponse & { session_id?: string })
  } catch (error) {
    console.error('Error starting niche finder job:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
