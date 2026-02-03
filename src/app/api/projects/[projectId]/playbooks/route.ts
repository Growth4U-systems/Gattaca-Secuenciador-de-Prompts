import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getPlaybookConfig } from '@/components/playbook/configs'
import { extractVariablesFromFlowConfig } from '@/lib/utils/variableExtractor'

export const runtime = 'nodejs'

/**
 * GET /api/projects/:projectId/playbooks
 * List all playbooks for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params

    const supabase = await createClient()

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project exists and user has access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get playbooks for this project
    const { data: playbooks, error } = await supabase
      .from('project_playbooks')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true })

    if (error) {
      console.error('Error fetching project playbooks:', error)
      return NextResponse.json({ error: 'Failed to fetch playbooks' }, { status: 500 })
    }

    // Enrich playbooks that don't have flow_config with template data
    const enrichedPlaybooks = (playbooks || []).map((playbook: any) => {
      // If playbook already has flow_config, return as-is
      if (playbook.config?.flow_config?.steps?.length > 0) {
        return playbook
      }

      // Try to get template config for this playbook type
      const playbookConfig = getPlaybookConfig(playbook.playbook_type)
        || getPlaybookConfig(playbook.playbook_type.replace('_', '-'))
        || getPlaybookConfig(playbook.playbook_type.replace('-', '_'))

      if (playbookConfig?.flow_config) {
        // Enrich with template data
        return {
          ...playbook,
          config: {
            ...playbook.config,
            flow_config: playbookConfig.flow_config,
            phases: playbookConfig.phases,
            variables: playbookConfig.variables,
          }
        }
      }

      return playbook
    })

    return NextResponse.json({
      success: true,
      playbooks: enrichedPlaybooks,
    })
  } catch (error) {
    console.error('Error in GET /api/projects/:projectId/playbooks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/:projectId/playbooks
 * Add a playbook to a project
 * Now supports multiple playbooks of the same type with different names
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params
    const body = await request.json()
    const { playbook_type, config, name } = body

    if (!playbook_type) {
      return NextResponse.json({ error: 'playbook_type is required' }, { status: 400 })
    }

    // Name is required for creating new playbooks
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project exists and get client_id for cascade lookup
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, client_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get current max position
    const { data: existing } = await supabase
      .from('project_playbooks')
      .select('position')
      .eq('project_id', projectId)
      .order('position', { ascending: false })
      .limit(1)

    const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

    // CASCADA DE CONFIGURACIÓN: Cliente > Base Template
    // 1. First check if client has a customized playbook
    let clientPlaybookConfig = null
    if (project.client_id) {
      const { data: clientPlaybook } = await supabase
        .from('client_playbooks')
        .select('config')
        .eq('client_id', project.client_id)
        .eq('playbook_type', playbook_type)
        .eq('is_enabled', true)
        .single()

      if (clientPlaybook?.config) {
        clientPlaybookConfig = clientPlaybook.config
      }
    }

    // 2. Get the base playbook template config
    const basePlaybookConfig = getPlaybookConfig(playbook_type)
      || getPlaybookConfig(playbook_type.replace('_', '-'))
      || getPlaybookConfig(playbook_type.replace('-', '_'))

    // 3. Use cascade: client config > base template
    const effectiveConfig = clientPlaybookConfig || basePlaybookConfig

    // Build the config to store - include flow_config from effective source
    // The flow_config contains the actual steps with prompts, models, etc.
    const storedConfig = {
      ...config,
      // Store the actual flow_config (with steps/prompts)
      flow_config: effectiveConfig?.flow_config || undefined,
      // Also store phases and variables for the wizard UI
      phases: effectiveConfig?.phases || undefined,
      variables: effectiveConfig?.variables || undefined,
      // Track the source for debugging
      _configSource: clientPlaybookConfig ? 'client' : 'base',
    }

    // Add playbook to project
    const { data, error } = await supabase
      .from('project_playbooks')
      .insert({
        project_id: projectId,
        playbook_type,
        name,
        config: storedConfig,
        position: nextPosition,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation - name already exists
        return NextResponse.json({
          error: 'A playbook with this name already exists in the project',
          code: 'DUPLICATE'
        }, { status: 409 })
      }
      console.error('Error adding playbook to project:', error)
      return NextResponse.json({ error: 'Failed to add playbook' }, { status: 500 })
    }

    // Initialize project variables from playbook prompts if project has none
    // Extract variables directly from the prompts in flow_config (using effective config from cascade)
    const extractedVars = effectiveConfig?.flow_config
      ? extractVariablesFromFlowConfig(effectiveConfig.flow_config)
      : []

    // Also include any explicitly defined variables from the config
    const configVars = (effectiveConfig?.variables || []).map((v: any) => ({
      name: v.name || v.key,
      default_value: v.default || v.defaultValue || '',
      description: v.description || '',
      required: v.required ?? true,
    }))

    // Merge: extracted vars + config vars (config vars take precedence for metadata)
    const allVarsMap = new Map<string, any>()

    // First add extracted vars
    extractedVars.forEach(v => {
      allVarsMap.set(v.name, v)
    })

    // Then overlay config vars (preserves descriptions and defaults)
    configVars.forEach((v: any) => {
      allVarsMap.set(v.name, v)
    })

    const mergedVariables = Array.from(allVarsMap.values())

    if (mergedVariables.length > 0) {
      // Get current project to check if variables are empty
      const { data: currentProject } = await supabase
        .from('projects')
        .select('variable_definitions')
        .eq('id', projectId)
        .single()

      const currentVars = currentProject?.variable_definitions as any[] | null
      const hasNoVariables = !currentVars || currentVars.length === 0

      if (hasNoVariables) {
        const { error: updateError } = await supabase
          .from('projects')
          .update({ variable_definitions: mergedVariables })
          .eq('id', projectId)

        if (updateError) {
          console.error('Error initializing project variables:', updateError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      playbook: data,
    })
  } catch (error) {
    console.error('Error in POST /api/projects/:projectId/playbooks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/:projectId/playbooks
 * Update a playbook in a project (name, config, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params
    const body = await request.json()
    const { id, name, config } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build update object
    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name
    if (config !== undefined) updateData.config = config

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Update the playbook
    const { data, error } = await supabase
      .from('project_playbooks')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .single()

    if (error) {
      console.error('Error updating playbook:', error)
      return NextResponse.json({ error: 'Failed to update playbook' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      playbook: data,
    })
  } catch (error) {
    console.error('Error in PATCH /api/projects/:projectId/playbooks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/:projectId/playbooks
 * Remove a playbook from a project (by playbook_id in query params)
 * Supports both id and legacy playbook_type for backwards compatibility
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params
    const { searchParams } = new URL(request.url)
    const playbookId = searchParams.get('id') || searchParams.get('playbook_id')
    const playbookType = searchParams.get('playbook_type') // Legacy support

    if (!playbookId && !playbookType) {
      return NextResponse.json({ error: 'id or playbook_type query param is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete the playbook from project
    let query = supabase
      .from('project_playbooks')
      .delete()
      .eq('project_id', projectId)

    if (playbookId) {
      query = query.eq('id', playbookId)
    } else if (playbookType) {
      // Legacy: delete by type (will delete first match if multiple exist)
      query = query.eq('playbook_type', playbookType)
    }

    const { error } = await query

    if (error) {
      console.error('Error removing playbook from project:', error)
      return NextResponse.json({ error: 'Failed to remove playbook' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Playbook removed from project`,
    })
  } catch (error) {
    console.error('Error in DELETE /api/projects/:projectId/playbooks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
