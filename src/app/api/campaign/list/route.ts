import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

/**
 * List campaigns for a project with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const playbookType = searchParams.get('playbookType')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing projectId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build query
    let query = supabase
      .from('ecp_campaigns')
      .select('*')
      .eq('project_id', projectId)

    // Filter by playbook type if provided
    if (playbookType) {
      query = query.eq('playbook_type', playbookType)
    }

    // Order by created_at descending
    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('[campaign/list] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to load campaigns', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      campaigns: data || [],
    })
  } catch (error) {
    console.error('[campaign/list] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
