import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

interface CreateSessionRequest {
  project_id: string
  playbook_id?: string
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

  try {
    const body: CreateSessionRequest = await request.json()
    const { project_id, playbook_id, playbook_type, name, tags, config = {}, variables = {} } = body

    if (!project_id || !playbook_type) {
      return NextResponse.json(
        { error: 'project_id and playbook_type are required' },
        { status: 400 }
      )
    }

    // Create new session (always create new, let dialog handle resume via list)
    const { data: newSession, error: insertError } = await supabaseAdmin
      .from('playbook_sessions')
      .insert({
        user_id: session.user.id,
        project_id,
        playbook_id: playbook_id || null,
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

  const searchParams = request.nextUrl.searchParams
  const projectId = searchParams.get('project_id')
  const playbookId = searchParams.get('playbook_id')
  const playbookType = searchParams.get('playbook_type')
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const limit = searchParams.get('limit')
  const offset = searchParams.get('offset')

  try {
    // Build base query - filter by user_id for security
    let query = supabaseAdmin
      .from('playbook_sessions')
      .select('*', { count: 'exact' })
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })

    // Optional project filter
    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    // Optional playbook_id filter
    if (playbookId) {
      query = query.eq('playbook_id', playbookId)
    }

    if (playbookType) {
      query = query.eq('playbook_type', playbookType)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    if (dateFrom) {
      query = query.gte('updated_at', dateFrom)
    }

    if (dateTo) {
      // Add one day to include the full end date
      const endDate = new Date(dateTo)
      endDate.setDate(endDate.getDate() + 1)
      query = query.lt('updated_at', endDate.toISOString())
    }

    // Apply pagination
    const limitNum = limit ? parseInt(limit, 10) : 50
    const offsetNum = offset ? parseInt(offset, 10) : 0

    if (!isNaN(limitNum) && limitNum > 0) {
      query = query.limit(limitNum)
    }

    if (!isNaN(offsetNum) && offsetNum > 0) {
      query = query.range(offsetNum, offsetNum + limitNum - 1)
    }

    const { data: sessions, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      sessions,
      pagination: {
        total: count,
        limit: limitNum,
        offset: offsetNum,
        hasMore: count !== null && offsetNum + (sessions?.length || 0) < count,
      },
    })
  } catch (error) {
    console.error('Error listing sessions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
