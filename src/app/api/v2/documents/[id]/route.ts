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
 * GET /api/v2/documents/[id]
 * Obtiene un documento específico.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        )
      }
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to load document', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      document: data,
    })
  } catch (error) {
    console.error('Get document error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v2/documents/[id]
 * Actualiza un documento.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const {
      title,
      tier,
      documentType,
      content,
      contentFormat,
      approvalStatus,
      validityStart,
      validityEnd,
    } = body

    const supabase = getSupabaseClient()

    // Construir objeto de actualización
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) updates.title = title
    if (tier !== undefined) {
      if (![1, 2, 3].includes(tier)) {
        return NextResponse.json(
          { error: 'Invalid tier. Must be 1, 2, or 3' },
          { status: 400 }
        )
      }
      updates.tier = tier
    }
    if (documentType !== undefined) updates.document_type = documentType
    if (content !== undefined) updates.content = content
    if (contentFormat !== undefined) updates.content_format = contentFormat
    if (approvalStatus !== undefined) updates.approval_status = approvalStatus
    if (validityStart !== undefined) updates.validity_start = validityStart
    if (validityEnd !== undefined) updates.validity_end = validityEnd

    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', params.id)
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
      document: data,
    })
  } catch (error) {
    console.error('Update document error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v2/documents/[id]
 * Elimina un documento.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete document', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    })
  } catch (error) {
    console.error('Delete document error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
