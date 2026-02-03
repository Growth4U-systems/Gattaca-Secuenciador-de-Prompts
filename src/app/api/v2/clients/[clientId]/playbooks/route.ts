import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getPlaybookConfig, playbookConfigs } from '@/components/playbook/configs'

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
 * GET /api/v2/clients/:clientId/playbooks
 * List all playbooks for a client (both custom and available base templates)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const { clientId } = params
    const { searchParams } = new URL(request.url)
    const includeBase = searchParams.get('include_base') !== 'false'

    const supabase = getSupabaseAdmin()

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Get custom playbooks for this client
    const { data: customPlaybooks, error } = await supabase
      .from('client_playbooks')
      .select('*')
      .eq('client_id', clientId)
      .order('position', { ascending: true })

    if (error) {
      console.error('Error fetching client playbooks:', error)
      return NextResponse.json({ error: 'Failed to fetch playbooks' }, { status: 500 })
    }

    // Build response with both custom and base playbooks
    const response: {
      success: boolean
      customPlaybooks: any[]
      basePlaybooks?: Array<{ type: string; name: string; description: string; isCustomized: boolean }>
    } = {
      success: true,
      customPlaybooks: customPlaybooks || [],
    }

    // Include base playbook templates if requested
    if (includeBase) {
      const customTypes = new Set((customPlaybooks || []).map((p: any) => p.playbook_type))

      response.basePlaybooks = Object.entries(playbookConfigs)
        // Filter out duplicate configs (e.g., competitor-analysis and competitor_analysis)
        .filter(([type]) => !type.includes('_') || !playbookConfigs[type.replace('_', '-')])
        .map(([type, config]) => ({
          type,
          name: config.name || type,
          description: config.description || config.presentation?.tagline || '',
          isCustomized: customTypes.has(type) || customTypes.has(type.replace('-', '_')),
        }))
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in GET /api/v2/clients/:clientId/playbooks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/v2/clients/:clientId/playbooks
 * Create/Fork a playbook from a base template for this client
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const { clientId } = params
    const body = await request.json()
    const { playbook_type, name, description, config } = body

    if (!playbook_type) {
      return NextResponse.json({ error: 'playbook_type is required' }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Get base template config
    const baseConfig = getPlaybookConfig(playbook_type)
      || getPlaybookConfig(playbook_type.replace('_', '-'))
      || getPlaybookConfig(playbook_type.replace('-', '_'))

    if (!baseConfig) {
      return NextResponse.json({ error: 'Base playbook template not found' }, { status: 404 })
    }

    // Get current max position
    const { data: existing } = await supabase
      .from('client_playbooks')
      .select('position')
      .eq('client_id', clientId)
      .order('position', { ascending: false })
      .limit(1)

    const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

    // Merge provided config with base template
    const storedConfig = {
      flow_config: config?.flow_config || baseConfig.flow_config,
      phases: config?.phases || baseConfig.phases,
      variables: config?.variables || baseConfig.variables,
      presentation: config?.presentation || baseConfig.presentation,
    }

    // Create the client playbook
    const { data, error } = await supabase
      .from('client_playbooks')
      .insert({
        client_id: clientId,
        playbook_type,
        name,
        description: description || baseConfig.description || baseConfig.presentation?.tagline || '',
        config: storedConfig,
        base_template_type: playbook_type,
        position: nextPosition,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({
          error: 'A playbook with this name and type already exists for this client',
          code: 'DUPLICATE'
        }, { status: 409 })
      }
      console.error('Error creating client playbook:', error)
      return NextResponse.json({ error: 'Failed to create playbook' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      playbook: data,
    })
  } catch (error) {
    console.error('Error in POST /api/v2/clients/:clientId/playbooks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/v2/clients/:clientId/playbooks
 * Update a client playbook
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const { clientId } = params
    const body = await request.json()
    const { id, name, description, config, is_enabled } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

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
      .eq('id', id)
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
    console.error('Error in PATCH /api/v2/clients/:clientId/playbooks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/v2/clients/:clientId/playbooks
 * Delete a client playbook (revert to using base template)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const { clientId } = params
    const { searchParams } = new URL(request.url)
    const playbookId = searchParams.get('id')

    if (!playbookId) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
    }

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
    console.error('Error in DELETE /api/v2/clients/:clientId/playbooks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
