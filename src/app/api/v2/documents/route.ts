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
 * GET /api/v2/documents
 * Lista documentos con filtros.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const tier = searchParams.get('tier')
    const documentType = searchParams.get('type')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'authority_score'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const includeExpired = searchParams.get('includeExpired') === 'true'

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing clientId parameter' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    let query = supabase
      .from('documents')
      .select('*')
      .eq('client_id', clientId)

    // Filtros
    if (tier) {
      query = query.eq('tier', parseInt(tier))
    }
    if (documentType) {
      query = query.eq('document_type', documentType)
    }
    if (status) {
      query = query.eq('approval_status', status)
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
    }

    // Excluir expirados por defecto
    if (!includeExpired) {
      const today = new Date().toISOString().split('T')[0]
      query = query.or(`validity_end.is.null,validity_end.gte.${today}`)
    }

    // Ordenamiento
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to load documents', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      documents: data || [],
      count: data?.length || 0,
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
 * POST /api/v2/documents
 * Crea un nuevo documento.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      clientId,
      title,
      tier,
      documentType,
      content,
      contentFormat = 'markdown',
      approvalStatus = 'draft',
      validityStart,
      validityEnd,
      sourceType = 'manual',
      sourceFileName,
      sourceFileUrl,
    } = body

    // Validaciones
    if (!clientId || !title || !tier || !documentType) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, title, tier, documentType' },
        { status: 400 }
      )
    }

    if (![1, 2, 3].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be 1, 2, or 3' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Generar slug único
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36)

    const { data, error } = await supabase
      .from('documents')
      .insert({
        client_id: clientId,
        title,
        slug,
        tier,
        document_type: documentType,
        content,
        content_format: contentFormat,
        approval_status: approvalStatus,
        validity_start: validityStart || new Date().toISOString().split('T')[0],
        validity_end: validityEnd || null,
        source_type: sourceType,
        source_file_name: sourceFileName,
        source_file_url: sourceFileUrl,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create document', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      document: data,
    })
  } catch (error) {
    console.error('Create document error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
