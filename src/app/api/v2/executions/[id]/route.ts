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
 * GET /api/v2/executions/[id]
 * Obtiene una ejecución específica con su playbook.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('playbook_executions')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Execution not found' },
          { status: 404 }
        )
      }
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to load execution', details: error.message },
        { status: 500 }
      )
    }

    // Obtener el playbook asociado
    let playbook = null
    if (data.playbook_id) {
      const { data: playbookData } = await supabase
        .from('playbooks')
        .select('*')
        .eq('id', data.playbook_id)
        .single()
      playbook = playbookData
    }

    return NextResponse.json({
      success: true,
      execution: data,
      playbook,
    })
  } catch (error) {
    console.error('Get execution error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v2/executions/[id]
 * Actualiza una ejecución (status, block_outputs, etc.).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const {
      status,
      currentBlockId,
      blockOutputs,
      hitlPending,
      errorMessage,
    } = body

    const supabase = getSupabaseClient()

    // Construir objeto de actualización
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (status !== undefined) {
      const validStatuses = ['pending', 'running', 'waiting_human', 'completed', 'failed', 'cancelled']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }
      updates.status = status

      // Auto-set timestamps
      if (status === 'running') {
        updates.started_at = new Date().toISOString()
      }
      if (['completed', 'failed', 'cancelled'].includes(status)) {
        updates.completed_at = new Date().toISOString()
      }
    }

    if (currentBlockId !== undefined) updates.current_block_id = currentBlockId
    if (blockOutputs !== undefined) updates.block_outputs = blockOutputs
    if (hitlPending !== undefined) updates.hitl_pending = hitlPending
    if (errorMessage !== undefined) updates.error_message = errorMessage

    const { data, error } = await supabase
      .from('playbook_executions')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update execution', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      execution: data,
    })
  } catch (error) {
    console.error('Update execution error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v2/executions/[id]
 * Elimina una ejecución.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('playbook_executions')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete execution', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Execution deleted successfully',
    })
  } catch (error) {
    console.error('Delete execution error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
