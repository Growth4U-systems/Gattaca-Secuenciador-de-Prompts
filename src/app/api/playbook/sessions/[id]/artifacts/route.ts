import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// GET: Get all session artifacts
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

  const searchParams = request.nextUrl.searchParams
  const artifactType = searchParams.get('artifact_type')
  const stepId = searchParams.get('step_id')

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

    // Build query for artifacts
    let query = supabaseAdmin
      .from('playbook_session_artifacts')
      .select(`
        *,
        step:playbook_session_steps(id, step_id, status)
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    // Optional filters
    if (artifactType) {
      query = query.eq('artifact_type', artifactType)
    }

    if (stepId) {
      // First get the step record ID from the step_id string
      const { data: step } = await supabaseAdmin
        .from('playbook_session_steps')
        .select('id')
        .eq('session_id', sessionId)
        .eq('step_id', stepId)
        .single()

      if (step) {
        query = query.eq('step_id', step.id)
      } else {
        // No matching step, return empty result
        return NextResponse.json({ artifacts: [] })
      }
    }

    const { data: artifacts, error } = await query

    if (error) {
      console.error('Error fetching artifacts:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ artifacts: artifacts || [] })
  } catch (error) {
    console.error('Error in artifacts endpoint:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
