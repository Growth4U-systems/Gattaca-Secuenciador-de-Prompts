import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface CreateSessionRequest {
  project_id: string
  playbook_type: 'niche_finder' | 'ecp' | 'video_viral' | 'signal_based_outreach' | 'competitor_analysis'
  name?: string
  tags?: string[] | null
  config?: Record<string, unknown>
  variables?: Record<string, unknown>
}

interface Session {
  id: string
  project_id: string
  playbook_type: string
  name: string | null
  tags: string[] | null
  status: string
  current_phase: string | null
  current_step: string | null
  config: Record<string, unknown>
  variables: Record<string, unknown>
  created_at: string
  updated_at: string
  completed_at: string | null
  active_job_id: string | null
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body: CreateSessionRequest = await request.json()
    const { project_id, playbook_type, name, tags, config = {}, variables = {} } = body

    if (!project_id || !playbook_type) {
      return NextResponse.json(
        { error: 'project_id and playbook_type are required' },
        { status: 400 }
      )
    }

    // Create new session (always create new, let dialog handle resume via list)
    const { data: newSession, error: insertError } = await supabase
      .from('playbook_sessions')
      .insert({
        project_id,
        playbook_type,
        name: name || null,
        tags: tags || null,
        status: 'draft',
        config,
        variables,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating session:', insertError)
      return NextResponse.json(
        { error: `Failed to create session: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      session: newSession as Session,
      created: true,
    })
  } catch (error) {
    console.error('Error in sessions endpoint:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET: List sessions for a project
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const searchParams = request.nextUrl.searchParams
  const projectId = searchParams.get('project_id')
  const playbookType = searchParams.get('playbook_type')

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  try {
    let query = supabase
      .from('playbook_sessions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (playbookType) {
      query = query.eq('playbook_type', playbookType)
    }

    const { data: sessions, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Error listing sessions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
