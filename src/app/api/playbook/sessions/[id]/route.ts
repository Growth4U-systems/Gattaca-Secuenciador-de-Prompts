import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// GET: Get session details with steps and jobs
export async function GET(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: sessionId } = await params

  try {
    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('playbook_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get session steps
    const { data: steps } = await supabase
      .from('playbook_session_steps')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    // Get related jobs (for niche_finder)
    const { data: jobs } = await supabase
      .from('niche_finder_jobs')
      .select('id, status, urls_found, urls_scraped, urls_failed, niches_extracted, created_at, updated_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    // Build timeline
    const timeline = buildTimeline(steps || [], jobs || [])

    return NextResponse.json({
      session,
      steps: steps || [],
      jobs: jobs || [],
      timeline,
    })
  } catch (error) {
    console.error('Error getting session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PATCH: Update session
export async function PATCH(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: sessionId } = await params

  try {
    const body = await request.json()
    const allowedFields = ['status', 'current_phase', 'current_step', 'config', 'variables', 'active_job_id', 'completed_at']

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: session, error } = await supabase
      .from('playbook_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

interface TimelineEvent {
  type: 'step' | 'job'
  id: string
  title: string
  status: string
  timestamp: string
  details?: Record<string, unknown>
}

function buildTimeline(
  steps: Array<{
    id: string
    step_id: string
    status: string
    started_at: string | null
    completed_at: string | null
    output: unknown
  }>,
  jobs: Array<{
    id: string
    status: string
    urls_found: number
    urls_scraped: number
    urls_failed: number
    niches_extracted: number
    created_at: string
    updated_at: string
  }>
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // Add step events
  for (const step of steps) {
    if (step.started_at) {
      events.push({
        type: 'step',
        id: step.id,
        title: step.step_id,
        status: step.status,
        timestamp: step.completed_at || step.started_at,
        details: step.output as Record<string, unknown> | undefined,
      })
    }
  }

  // Add job events
  for (const job of jobs) {
    events.push({
      type: 'job',
      id: job.id,
      title: `Job ${job.id.slice(0, 8)}`,
      status: job.status,
      timestamp: job.updated_at,
      details: {
        urls_found: job.urls_found,
        urls_scraped: job.urls_scraped,
        urls_failed: job.urls_failed,
        niches_extracted: job.niches_extracted,
      },
    })
  }

  // Sort by timestamp
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return events
}
