import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; stepId: string }> }

interface CreateArtifactRequest {
  artifact_type: 'serp_results' | 'scraped_content' | 'extracted_data' | 'analysis_output'
  data: Record<string, unknown>
  metadata?: Record<string, unknown>
}

// POST: Save step artifact
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
  const { id: sessionId, stepId } = await params

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

    // Get or verify the step exists
    const { data: step, error: stepError } = await supabaseAdmin
      .from('playbook_session_steps')
      .select('id')
      .eq('session_id', sessionId)
      .eq('step_id', stepId)
      .single()

    if (stepError || !step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    }

    const body: CreateArtifactRequest = await request.json()
    const { artifact_type, data, metadata = {} } = body

    if (!artifact_type || !data) {
      return NextResponse.json(
        { error: 'artifact_type and data are required' },
        { status: 400 }
      )
    }

    // Validate artifact_type
    const validTypes = ['serp_results', 'scraped_content', 'extracted_data', 'analysis_output']
    if (!validTypes.includes(artifact_type)) {
      return NextResponse.json(
        { error: `Invalid artifact_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Create artifact
    const { data: artifact, error: insertError } = await supabaseAdmin
      .from('playbook_session_artifacts')
      .insert({
        session_id: sessionId,
        step_id: step.id,
        artifact_type,
        data,
        metadata,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating artifact:', insertError)
      return NextResponse.json(
        { error: `Failed to create artifact: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      artifact,
      created: true,
    })
  } catch (error) {
    console.error('Error in step artifacts endpoint:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
