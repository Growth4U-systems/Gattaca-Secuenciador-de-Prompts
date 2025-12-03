import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * GET /api/documents?projectId=xxx[&campaignId=xxx]
 * List documents for a project, optionally filtered by campaign
 * - If campaignId is provided: returns only documents for that specific campaign
 * - If campaignId is not provided: returns all project documents (including those without campaign_id)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const campaignId = searchParams.get('campaignId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing projectId parameter' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    let query = supabase
      .from('knowledge_base_docs')
      .select('*')
      .eq('project_id', projectId)

    // Filter by campaign if specified
    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }

    const { data: documents, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to load documents', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      documents: documents || [],
    })
  } catch (error) {
    console.error('List documents error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/documents
 * Update document campaign assignment
 * Body: { documentId: string, campaignId: string | null }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { documentId, campaignId } = body

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing documentId' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    const { data: document, error } = await supabase
      .from('knowledge_base_docs')
      .update({ campaign_id: campaignId || null })
      .eq('id', documentId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update document', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      document,
    })
  } catch (error) {
    console.error('Update document error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
