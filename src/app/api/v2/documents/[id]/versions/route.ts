import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { DocumentVersion, ApprovalStatus } from '@/types/v2.types'

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

interface VersionRow {
  id: string
  version: number | null
  created_at: string
  approval_status: ApprovalStatus
  previous_version_id: string | null
}

/**
 * GET /api/v2/documents/[id]/versions
 * Get version history for a document
 */
export async function GET(
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

    // Get the current document first
    const { data: currentDoc, error: docError } = await supabase
      .from('documents')
      .select('id, client_id, document_type, version, previous_version_id, created_at, approval_status, is_compiled_foundational')
      .eq('id', documentId)
      .single()

    if (docError || !currentDoc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Get all versions for this document type and client
    const { data: allVersions, error: versionsError } = await supabase
      .from('documents')
      .select('id, version, created_at, approval_status, previous_version_id')
      .eq('client_id', currentDoc.client_id)
      .eq('document_type', currentDoc.document_type)
      .eq('is_compiled_foundational', true)
      .order('version', { ascending: false })

    if (versionsError) {
      console.error('Error fetching versions:', versionsError)
      return NextResponse.json(
        { error: 'Failed to fetch versions' },
        { status: 500 }
      )
    }

    const versions: DocumentVersion[] = (allVersions || []).map((doc: VersionRow) => ({
      id: doc.id,
      version: doc.version || 1,
      created_at: doc.created_at,
      approval_status: doc.approval_status,
      is_current: doc.id === allVersions![0]?.id, // Latest version is current
    }))

    return NextResponse.json({
      documentId,
      currentVersion: currentDoc.version || 1,
      versions,
      totalVersions: versions.length,
    })
  } catch (err) {
    console.error('Unexpected error in GET /api/v2/documents/[id]/versions:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v2/documents/[id]/versions/rollback
 * Rollback to a previous version
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id
    const { targetVersionId } = await request.json()

    if (!documentId || !targetVersionId) {
      return NextResponse.json(
        { error: 'documentId and targetVersionId are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Get the target version
    const { data: targetDoc, error: targetError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', targetVersionId)
      .single()

    if (targetError || !targetDoc) {
      return NextResponse.json(
        { error: 'Target version not found' },
        { status: 404 }
      )
    }

    // Get current latest version
    const { data: currentDoc } = await supabase
      .from('documents')
      .select('id, version')
      .eq('client_id', targetDoc.client_id)
      .eq('document_type', targetDoc.document_type)
      .eq('is_compiled_foundational', true)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const newVersion = (currentDoc?.version || targetDoc.version || 0) + 1

    // Create new version with content from target
    const { data: newDoc, error: insertError } = await supabase
      .from('documents')
      .insert({
        client_id: targetDoc.client_id,
        title: targetDoc.title,
        slug: `${targetDoc.document_type}-v${newVersion}-${Date.now()}`,
        tier: targetDoc.tier,
        document_type: targetDoc.document_type,
        content: targetDoc.content,
        content_format: targetDoc.content_format,
        source_type: 'synthesized',
        approval_status: 'draft',
        is_compiled_foundational: true,
        version: newVersion,
        previous_version_id: currentDoc?.id || targetDoc.id,
        sources_hash: targetDoc.sources_hash,
        requires_review: true,
        token_count: targetDoc.token_count,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating rollback version:', insertError)
      return NextResponse.json(
        { error: 'Failed to create rollback version' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      newDocumentId: newDoc.id,
      newVersion,
      rolledBackFrom: targetVersionId,
      message: `Rolled back to version ${targetDoc.version}. New version ${newVersion} created.`,
    })
  } catch (err) {
    console.error('Unexpected error in POST /api/v2/documents/[id]/versions:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
