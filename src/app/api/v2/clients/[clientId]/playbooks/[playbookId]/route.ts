import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getPlaybookConfig } from '@/components/playbook/configs'

export const runtime = 'nodejs'
export const maxDuration = 10

// Create admin client that bypasses auth
function getSupabaseAdmin() {
  return createSupabaseClient(
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
 * GET /api/v2/clients/:clientId/playbooks/:playbookId
 * Get a specific client playbook with full configuration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string; playbookId: string } }
) {
  try {
    const { clientId, playbookId } = params

    const supabase = getSupabaseAdmin()

    // Get the playbook
    const { data: playbook, error } = await supabase
      .from('client_playbooks')
      .select('*')
      .eq('id', playbookId)
      .eq('client_id', clientId)
      .single()

    if (error || !playbook) {
      return NextResponse.json({ error: 'Playbook not found' }, { status: 404 })
    }

    // Include base template for comparison if needed
    const baseConfig = getPlaybookConfig(playbook.base_template_type)
      || getPlaybookConfig(playbook.base_template_type.replace('_', '-'))
      || getPlaybookConfig(playbook.base_template_type.replace('-', '_'))

    return NextResponse.json({
      success: true,
      playbook,
      baseTemplate: baseConfig ? {
        flow_config: baseConfig.flow_config,
        phases: baseConfig.phases,
        variables: baseConfig.variables,
        presentation: baseConfig.presentation,
      } : null,
    })
  } catch (error) {
    console.error('Error in GET /api/v2/clients/:clientId/playbooks/:playbookId:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/v2/clients/:clientId/playbooks/:playbookId
 * Update a specific client playbook
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { clientId: string; playbookId: string } }
) {
  try {
    const { clientId, playbookId } = params
    const body = await request.json()
    const { name, description, config, is_enabled } = body

    const supabase = getSupabaseAdmin()

    // Build update object
    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (config !== undefined) updateData.config = config
    if (is_enabled !== undefined) updateData.is_enabled = is_enabled

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Update the playbook
    const { data, error } = await supabase
      .from('client_playbooks')
      .update(updateData)
      .eq('id', playbookId)
      .eq('client_id', clientId)
      .select()
      .single()

    if (error) {
      console.error('Error updating client playbook:', error)
      return NextResponse.json({ error: 'Failed to update playbook' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Playbook not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      playbook: data,
    })
  } catch (error) {
    console.error('Error in PATCH /api/v2/clients/:clientId/playbooks/:playbookId:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/v2/clients/:clientId/playbooks/:playbookId
 * Delete a specific client playbook
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { clientId: string; playbookId: string } }
) {
  try {
    const { clientId, playbookId } = params

    const supabase = getSupabaseAdmin()

    // Delete the playbook
    const { error } = await supabase
      .from('client_playbooks')
      .delete()
      .eq('id', playbookId)
      .eq('client_id', clientId)

    if (error) {
      console.error('Error deleting client playbook:', error)
      return NextResponse.json({ error: 'Failed to delete playbook' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Playbook deleted successfully',
    })
  } catch (error) {
    console.error('Error in DELETE /api/v2/clients/:clientId/playbooks/:playbookId:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
