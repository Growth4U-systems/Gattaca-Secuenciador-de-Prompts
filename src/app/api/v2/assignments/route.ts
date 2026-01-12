import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { FoundationalType } from '@/types/v2.types'

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
 * GET /api/v2/assignments
 * List all document assignments for a client
 *
 * Query params:
 * - clientId (required): Client UUID
 * - foundationalType (optional): Filter by foundational type
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const foundationalType = searchParams.get('foundationalType') as FoundationalType | null

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    let query = supabase
      .from('document_assignments')
      .select(`
        *,
        source_document:documents(
          id, title, slug, tier, document_type, content_format,
          approval_status, token_count, created_at, updated_at
        )
      `)
      .eq('client_id', clientId)
      .order('target_foundational_type')
      .order('display_order', { ascending: true })

    if (foundationalType) {
      query = query.eq('target_foundational_type', foundationalType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching assignments:', error)
      return NextResponse.json(
        { error: 'Failed to fetch assignments', details: error.message },
        { status: 500 }
      )
    }

    // Group by foundational type for convenience
    const grouped = (data || []).reduce((acc, assignment) => {
      const type = assignment.target_foundational_type as FoundationalType
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push(assignment)
      return acc
    }, {} as Record<FoundationalType, typeof data>)

    return NextResponse.json({
      assignments: data || [],
      byType: grouped,
      count: data?.length || 0,
    })
  } catch (err) {
    console.error('Unexpected error in GET /api/v2/assignments:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v2/assignments
 * Create a new document assignment
 *
 * Body:
 * - clientId: Client UUID
 * - sourceDocumentId: Source document UUID
 * - targetFoundationalType: Foundational type to assign to
 * - weight (optional): Priority weight (0-2, default 1)
 * - notes (optional): Notes about the assignment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      clientId,
      sourceDocumentId,
      targetFoundationalType,
      weight = 1.0,
      notes = null,
    } = body

    if (!clientId || !sourceDocumentId || !targetFoundationalType) {
      return NextResponse.json(
        { error: 'clientId, sourceDocumentId, and targetFoundationalType are required' },
        { status: 400 }
      )
    }

    // Validate foundational type
    const validTypes: FoundationalType[] = [
      'brand_dna', 'icp', 'tone_of_voice',
      'product_docs', 'pricing', 'competitor_analysis'
    ]
    if (!validTypes.includes(targetFoundationalType)) {
      return NextResponse.json(
        { error: `Invalid foundational type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Verify source document exists and belongs to client
    const { data: sourceDoc, error: docError } = await supabase
      .from('documents')
      .select('id, client_id, title')
      .eq('id', sourceDocumentId)
      .single()

    if (docError || !sourceDoc) {
      return NextResponse.json(
        { error: 'Source document not found' },
        { status: 404 }
      )
    }

    if (sourceDoc.client_id !== clientId) {
      return NextResponse.json(
        { error: 'Source document does not belong to this client' },
        { status: 403 }
      )
    }

    // Get current max display_order for this type
    const { data: existingAssignments } = await supabase
      .from('document_assignments')
      .select('display_order')
      .eq('client_id', clientId)
      .eq('target_foundational_type', targetFoundationalType)
      .order('display_order', { ascending: false })
      .limit(1)

    const nextOrder = existingAssignments?.[0]?.display_order
      ? existingAssignments[0].display_order + 1
      : 0

    // Create the assignment
    const { data: assignment, error: insertError } = await supabase
      .from('document_assignments')
      .insert({
        client_id: clientId,
        source_document_id: sourceDocumentId,
        target_foundational_type: targetFoundationalType,
        display_order: nextOrder,
        weight: Math.max(0, Math.min(2, weight)), // Clamp to 0-2
        notes,
      })
      .select(`
        *,
        source_document:documents(
          id, title, slug, tier, document_type,
          approval_status, token_count
        )
      `)
      .single()

    if (insertError) {
      // Handle unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'This document is already assigned to this foundational type' },
          { status: 409 }
        )
      }
      console.error('Error creating assignment:', insertError)
      return NextResponse.json(
        { error: 'Failed to create assignment', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      assignment,
      needsSynthesis: true, // Signal that synthesis should be triggered
      message: `Document "${sourceDoc.title}" assigned to ${targetFoundationalType}`,
    }, { status: 201 })
  } catch (err) {
    console.error('Unexpected error in POST /api/v2/assignments:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v2/assignments
 * Bulk delete assignments
 *
 * Body:
 * - assignmentIds: Array of assignment UUIDs to delete
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { assignmentIds } = body

    if (!assignmentIds || !Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return NextResponse.json(
        { error: 'assignmentIds array is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('document_assignments')
      .delete()
      .in('id', assignmentIds)

    if (error) {
      console.error('Error deleting assignments:', error)
      return NextResponse.json(
        { error: 'Failed to delete assignments', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      deleted: assignmentIds.length,
      needsSynthesis: true, // Signal that synthesis should be re-triggered
    })
  } catch (err) {
    console.error('Unexpected error in DELETE /api/v2/assignments:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
