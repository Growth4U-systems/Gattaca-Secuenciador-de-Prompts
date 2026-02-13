import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

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

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
 * Update document properties
 * Body: { documentId: string, campaignId?, filename?, description?, category?, tags?, source_metadata? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { documentId, campaignId, filename, description, category, tags, source_metadata } = body

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing documentId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build update object based on provided fields
    const updateData: Record<string, unknown> = {}

    if ('campaignId' in body) {
      updateData.campaign_id = campaignId || null
    }

    if (filename !== undefined) {
      const trimmedFilename = filename.trim()
      if (!trimmedFilename) {
        return NextResponse.json(
          { error: 'El nombre del documento no puede estar vacío' },
          { status: 400 }
        )
      }
      updateData.filename = trimmedFilename
    }

    if (description !== undefined) {
      updateData.description = description.trim()
    }

    if (category !== undefined) {
      updateData.category = category
    }

    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? tags : []
    }

    if (source_metadata !== undefined) {
      updateData.source_metadata = source_metadata
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const { data: document, error } = await supabase
      .from('knowledge_base_docs')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json(
        {
          error: 'Failed to update document',
          details: error.message,
          code: error.code,
        },
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
