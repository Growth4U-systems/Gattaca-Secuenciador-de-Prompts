import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

interface StepUpdate {
  step_id: string
  status?: 'pending' | 'in_progress' | 'completed' | 'error' | 'skipped'
  started_at?: string
  completed_at?: string
  input?: unknown
  output?: unknown
  error_message?: string
  job_id?: string
  job_type?: string
}

// Map API field names to database column names
// The database uses input_data/output_data, but API accepts input/output for convenience
function mapToDbFields(fields: Omit<StepUpdate, 'step_id'>): Record<string, unknown> {
  const dbFields: Record<string, unknown> = {}

  // Map input -> input_data
  if (fields.input !== undefined) {
    dbFields.input_data = fields.input
  }

  // Map output -> output_data
  if (fields.output !== undefined) {
    dbFields.output_data = fields.output
  }

  // Copy other fields directly
  if (fields.status !== undefined) dbFields.status = fields.status
  if (fields.started_at !== undefined) dbFields.started_at = fields.started_at
  if (fields.completed_at !== undefined) dbFields.completed_at = fields.completed_at
  if (fields.error_message !== undefined) dbFields.error_message = fields.error_message
  if (fields.job_id !== undefined) dbFields.job_id = fields.job_id
  if (fields.job_type !== undefined) dbFields.job_type = fields.job_type

  return dbFields
}

// GET: List steps for a session
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

    const { data: steps, error } = await supabaseAdmin
      .from('playbook_session_steps')
      .select('*')
      .eq('session_id', sessionId)
      .order('step_order', { ascending: true, nullsFirst: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ steps })
  } catch (error) {
    console.error('Error listing steps:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST/PUT: Upsert a step (create or update)
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

    const body: StepUpdate = await request.json()
    const { step_id, ...updateFields } = body

    if (!step_id) {
      return NextResponse.json({ error: 'step_id is required' }, { status: 400 })
    }

    // Map API fields to database column names
    const dbFields = mapToDbFields(updateFields)

    // Upsert step
    const { data: step, error } = await supabaseAdmin
      .from('playbook_session_steps')
      .upsert(
        {
          session_id: sessionId,
          step_id,
          ...dbFields,
        },
        { onConflict: 'session_id,step_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('Error upserting step:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also update session's current_step if starting a new step
    if (updateFields.status === 'in_progress') {
      await supabaseAdmin
        .from('playbook_sessions')
        .update({ current_step: step_id })
        .eq('id', sessionId)
    }

    return NextResponse.json({ step })
  } catch (error) {
    console.error('Error in steps endpoint:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
