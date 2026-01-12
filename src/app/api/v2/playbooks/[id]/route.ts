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
 * GET /api/v2/playbooks/[id]
 * Obtiene un playbook específico.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('playbooks')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Playbook not found' },
          { status: 404 }
        )
      }
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to load playbook', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      playbook: data,
    })
  } catch (error) {
    console.error('Get playbook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v2/playbooks/[id]
 * Actualiza un playbook.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const {
      name,
      description,
      type,
      tags,
      config,
      version,
      status,
      scheduleEnabled,
      scheduleCron,
      scheduleTimezone,
    } = body

    const supabase = getSupabaseClient()

    // Construir objeto de actualización
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (type !== undefined) {
      if (!['playbook', 'enricher'].includes(type)) {
        return NextResponse.json(
          { error: 'Invalid type. Must be "playbook" or "enricher"' },
          { status: 400 }
        )
      }
      updates.type = type
    }
    if (tags !== undefined) updates.tags = tags
    if (config !== undefined) updates.config = config
    if (version !== undefined) updates.version = version
    if (status !== undefined) {
      if (!['draft', 'active', 'archived'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be "draft", "active", or "archived"' },
          { status: 400 }
        )
      }
      updates.status = status
    }
    if (scheduleEnabled !== undefined) updates.schedule_enabled = scheduleEnabled
    if (scheduleCron !== undefined) updates.schedule_cron = scheduleCron
    if (scheduleTimezone !== undefined) updates.schedule_timezone = scheduleTimezone

    const { data, error } = await supabase
      .from('playbooks')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update playbook', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      playbook: data,
    })
  } catch (error) {
    console.error('Update playbook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v2/playbooks/[id]
 * Elimina un playbook.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('playbooks')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete playbook', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Playbook deleted successfully',
    })
  } catch (error) {
    console.error('Delete playbook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
