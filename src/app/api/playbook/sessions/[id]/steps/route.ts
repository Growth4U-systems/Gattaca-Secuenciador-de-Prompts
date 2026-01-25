import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

interface StepUpdate {
  step_id: string
  status?: 'pending' | 'in_progress' | 'completed' | 'error' | 'skipped'
  started_at?: string
  completed_at?: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error_message?: string
  job_id?: string
  job_type?: string
}

// GET: List steps for a session
export async function GET(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: sessionId } = await params

  try {
    const { data: steps, error } = await supabase
      .from('playbook_session_steps')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: sessionId } = await params

  try {
    const body: StepUpdate = await request.json()
    const { step_id, ...updateFields } = body

    if (!step_id) {
      return NextResponse.json({ error: 'step_id is required' }, { status: 400 })
    }

    // Upsert step
    const { data: step, error } = await supabase
      .from('playbook_session_steps')
      .upsert(
        {
          session_id: sessionId,
          step_id,
          ...updateFields,
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
      await supabase
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
