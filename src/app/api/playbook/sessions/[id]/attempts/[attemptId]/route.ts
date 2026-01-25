import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; attemptId: string }> }

interface AttemptUpdate {
  status?: 'running' | 'completed' | 'failed'
  ended_at?: string
  error_message?: string | null
  output_data?: unknown
}

// GET: Get a specific attempt
export async function GET(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: sessionId, attemptId } = await params

  try {
    const { data: attempt, error } = await supabase
      .from('playbook_step_attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('session_id', sessionId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(attempt)
  } catch (error) {
    console.error('Error getting attempt:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PATCH: Update an attempt
export async function PATCH(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: sessionId, attemptId } = await params

  try {
    const body: AttemptUpdate = await request.json()
    const updateFields: Record<string, unknown> = {}

    if (body.status !== undefined) updateFields.status = body.status
    if (body.ended_at !== undefined) updateFields.ended_at = body.ended_at
    if (body.error_message !== undefined) updateFields.error_message = body.error_message
    if (body.output_data !== undefined) updateFields.output_data = body.output_data

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: attempt, error } = await supabase
      .from('playbook_step_attempts')
      .update(updateFields)
      .eq('id', attemptId)
      .eq('session_id', sessionId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
      }
      console.error('Error updating attempt:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(attempt)
  } catch (error) {
    console.error('Error in attempts PATCH:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
