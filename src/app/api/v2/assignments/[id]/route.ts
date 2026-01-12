import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { DocumentAssignmentUpdate } from '@/types/v2.types'

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

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/v2/assignments/[id]
 * Get a single assignment by ID
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('document_assignments')
      .select(`
        *,
        source_document:documents(
          id, title, slug, tier, document_type, content, content_format,
          approval_status, token_count, created_at, updated_at
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Assignment not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching assignment:', error)
      return NextResponse.json(
        { error: 'Failed to fetch assignment', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ assignment: data })
  } catch (err) {
    console.error('Unexpected error in GET /api/v2/assignments/[id]:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v2/assignments/[id]
 * Update an assignment (weight, order, notes)
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
    const body = await request.json() as DocumentAssignmentUpdate
    const supabase = getSupabaseClient()

    // Only allow updating specific fields
    const allowedUpdates: (keyof DocumentAssignmentUpdate)[] = [
      'display_order',
      'weight',
      'notes',
    ]

    const updates: Record<string, unknown> = {}
    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      )
    }

    // Validate weight if provided
    if (updates.weight !== undefined) {
      const weight = updates.weight as number
      if (weight < 0 || weight > 2) {
        return NextResponse.json(
          { error: 'Weight must be between 0 and 2' },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabase
      .from('document_assignments')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        source_document:documents(
          id, title, slug, tier, document_type,
          approval_status, token_count
        )
      `)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Assignment not found' },
          { status: 404 }
        )
      }
      console.error('Error updating assignment:', error)
      return NextResponse.json(
        { error: 'Failed to update assignment', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      assignment: data,
      // Weight changes affect synthesis priority
      needsSynthesis: updates.weight !== undefined,
    })
  } catch (err) {
    console.error('Unexpected error in PATCH /api/v2/assignments/[id]:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v2/assignments/[id]
 * Delete a single assignment
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
    const supabase = getSupabaseClient()

    // Get assignment info before deleting (for response)
    const { data: existing } = await supabase
      .from('document_assignments')
      .select('client_id, target_foundational_type')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      )
    }

    const { error } = await supabase
      .from('document_assignments')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting assignment:', error)
      return NextResponse.json(
        { error: 'Failed to delete assignment', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      deleted: true,
      clientId: existing.client_id,
      foundationalType: existing.target_foundational_type,
      needsSynthesis: true, // Signal that synthesis should be re-triggered
    })
  } catch (err) {
    console.error('Unexpected error in DELETE /api/v2/assignments/[id]:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
