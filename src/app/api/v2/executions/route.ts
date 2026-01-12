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
 * GET /api/v2/executions
 * Lista ejecuciones con filtros.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const playbookId = searchParams.get('playbookId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = getSupabaseClient()

    let query = supabase
      .from('playbook_executions')
      .select('*')

    // Filtros
    if (clientId) {
      query = query.eq('client_id', clientId)
    }
    if (playbookId) {
      query = query.eq('playbook_id', playbookId)
    }
    if (status) {
      query = query.eq('status', status)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to load executions', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      executions: data || [],
      count: data?.length || 0,
      total: count,
    })
  } catch (error) {
    console.error('List executions error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v2/executions
 * Inicia una nueva ejecución de playbook.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { playbookId, clientId, inputData = {} } = body

    // Validaciones
    if (!playbookId || !clientId) {
      return NextResponse.json(
        { error: 'Missing required fields: playbookId, clientId' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Obtener el playbook para inicializar block_outputs
    const { data: playbook, error: playbookError } = await supabase
      .from('playbooks')
      .select('*')
      .eq('id', playbookId)
      .single()

    if (playbookError) {
      if (playbookError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Playbook not found' },
          { status: 404 }
        )
      }
      throw playbookError
    }

    // Verificar que el playbook está activo
    if (playbook.status !== 'active' && playbook.status !== 'draft') {
      return NextResponse.json(
        { error: 'Playbook is archived and cannot be executed' },
        { status: 400 }
      )
    }

    // Validar input_data contra input_schema
    const inputSchema = playbook.config.input_schema || {}
    const missingFields: string[] = []

    Object.entries(inputSchema).forEach(([field, schema]: [string, any]) => {
      if (schema.required && (inputData[field] === undefined || inputData[field] === '')) {
        missingFields.push(field)
      }
    })

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required input fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Inicializar block_outputs con todos los bloques en pending
    const blockOutputs: Record<string, any> = {}
    playbook.config.blocks.forEach((block: any) => {
      blockOutputs[block.id] = {
        output: '',
        tokens: { input: 0, output: 0 },
        status: 'pending',
      }
    })

    const firstBlockId = playbook.config.blocks[0]?.id || null

    // Crear la ejecución
    const { data, error } = await supabase
      .from('playbook_executions')
      .insert({
        playbook_id: playbookId,
        client_id: clientId,
        input_data: inputData,
        status: 'pending',
        current_block_id: firstBlockId,
        block_outputs: blockOutputs,
        context_snapshot: {
          documents_used: [],
          total_tokens: 0,
          captured_at: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create execution', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      execution: data,
    })
  } catch (error) {
    console.error('Create execution error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
