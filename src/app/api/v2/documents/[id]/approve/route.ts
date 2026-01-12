import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { DocumentApproveResult } from '@/types/v2.types'

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
 * POST /api/v2/documents/[id]/approve
 * Approve a synthesized document for use in playbooks
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Get the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, approval_status, is_compiled_foundational, requires_review')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check if already approved
    if (document.approval_status === 'approved') {
      return NextResponse.json(
        { error: 'Document is already approved' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Update document status
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        approval_status: 'approved',
        requires_review: false,
        reviewed_at: now,
        is_stale: false, // Reset stale flag on approval
        updated_at: now,
      })
      .eq('id', documentId)

    if (updateError) {
      console.error('Error approving document:', updateError)
      return NextResponse.json(
        { error: 'Failed to approve document' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      documentId,
      status: 'approved',
      approvedAt: now,
    } as DocumentApproveResult)
  } catch (err) {
    console.error('Unexpected error in POST /api/v2/documents/[id]/approve:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v2/documents/[id]/approve
 * Revoke approval (set back to draft)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    const { error: updateError } = await supabase
      .from('documents')
      .update({
        approval_status: 'draft',
        requires_review: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)

    if (updateError) {
      console.error('Error revoking approval:', updateError)
      return NextResponse.json(
        { error: 'Failed to revoke approval' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      documentId,
      status: 'draft',
    })
  } catch (err) {
    console.error('Unexpected error in DELETE /api/v2/documents/[id]/approve:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
