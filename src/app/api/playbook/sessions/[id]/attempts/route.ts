import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

interface AttemptCreate {
  step_id: string
  attempt_number: number
  status?: 'running' | 'completed' | 'failed'
  started_at?: string
  ended_at?: string | null
  error_message?: string | null
  config_snapshot?: Record<string, unknown>
  output_data?: unknown
}

// GET: List attempts for a session (optionally filtered by step_id)
export async function GET(request: NextRequest, { params }: Params) {
  // Authenticate user
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey)
  const { id: sessionId } = await params
  const stepId = request.nextUrl.searchParams.get('step_id')

  try {
    // Verify session belongs to the authenticated user
    const { data: playbookSession, error: sessionError } = await supabaseAdmin
      .from('playbook_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', session.user.id)
      .single()

    if (sessionError || !playbookSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    let query = supabaseAdmin
      .from('playbook_step_attempts')
      .select('*')
      .eq('session_id', sessionId)
      .order('attempt_number', { ascending: true })

    if (stepId) {
      query = query.eq('step_id', stepId)
    }

    const { data: attempts, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ attempts })
  } catch (error) {
    console.error('Error listing attempts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: Create a new attempt
export async function POST(request: NextRequest, { params }: Params) {
  // Authenticate user
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey)
  const { id: sessionId } = await params

  try {
    // Verify session belongs to the authenticated user
    const { data: playbookSession, error: sessionError } = await supabaseAdmin
      .from('playbook_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', session.user.id)
      .single()

    if (sessionError || !playbookSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const body: AttemptCreate = await request.json()
    const { step_id, attempt_number, ...fields } = body

    if (!step_id) {
      return NextResponse.json({ error: 'step_id is required' }, { status: 400 })
    }

    if (typeof attempt_number !== 'number' || attempt_number < 1) {
      return NextResponse.json({ error: 'attempt_number must be a positive integer' }, { status: 400 })
    }

    // Create the attempt record
    const { data: attempt, error } = await supabaseAdmin
      .from('playbook_step_attempts')
      .insert({
        session_id: sessionId,
        step_id,
        attempt_number,
        status: fields.status || 'running',
        started_at: fields.started_at || new Date().toISOString(),
        ended_at: fields.ended_at || null,
        error_message: fields.error_message || null,
        config_snapshot: fields.config_snapshot || {},
        output_data: fields.output_data || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating attempt:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update the step's attempt_count
    await supabaseAdmin
      .from('playbook_session_steps')
      .update({
        attempt_count: attempt_number,
        current_attempt_id: attempt.id,
      })
      .eq('session_id', sessionId)
      .eq('step_id', step_id)

    return NextResponse.json(attempt, { status: 201 })
  } catch (error) {
    console.error('Error in attempts POST:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
