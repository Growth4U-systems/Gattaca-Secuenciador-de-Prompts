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
 * GET /api/v2/playbooks
 * Lista playbooks con filtros.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agencyId = searchParams.get('agencyId')
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)

    if (!agencyId) {
      return NextResponse.json(
        { error: 'Missing agencyId parameter' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    let query = supabase
      .from('playbooks')
      .select('*')
      .eq('agency_id', agencyId)

    // Filtros
    if (type) {
      query = query.eq('type', type)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (tags?.length) {
      query = query.contains('tags', tags)
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    query = query.order('updated_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to load playbooks', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      playbooks: data || [],
      count: data?.length || 0,
    })
  } catch (error) {
    console.error('List playbooks error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v2/playbooks
 * Crea un nuevo playbook.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      agencyId,
      name,
      description,
      type = 'playbook',
      tags = [],
      config,
      status = 'draft',
    } = body

    // Validaciones
    if (!agencyId || !name || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: agencyId, name, config' },
        { status: 400 }
      )
    }

    if (!['playbook', 'enricher'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "playbook" or "enricher"' },
        { status: 400 }
      )
    }

    // Validar estructura de config
    if (!config.blocks || !Array.isArray(config.blocks)) {
      return NextResponse.json(
        { error: 'Config must include blocks array' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Generar slug único
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36)

    const { data, error } = await supabase
      .from('playbooks')
      .insert({
        agency_id: agencyId,
        name,
        slug,
        description,
        type,
        tags,
        config,
        version: '1.0.0',
        status,
        schedule_enabled: false,
        schedule_timezone: 'UTC',
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create playbook', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      playbook: data,
    })
  } catch (error) {
    console.error('Create playbook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
