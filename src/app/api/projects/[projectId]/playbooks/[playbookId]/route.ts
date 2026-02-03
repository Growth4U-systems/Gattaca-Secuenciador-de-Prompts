import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getPlaybookConfig } from '@/components/playbook/configs'

export const runtime = 'nodejs'

/**
 * GET /api/projects/:projectId/playbooks/:playbookId
 * Get a single playbook by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; playbookId: string } }
) {
  try {
    const { projectId, playbookId } = params

    const supabase = await createClient()

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the playbook
    const { data: playbook, error } = await supabase
      .from('project_playbooks')
      .select('*')
      .eq('id', playbookId)
      .eq('project_id', projectId)
      .single()

    if (error || !playbook) {
      console.error('Error fetching playbook:', error)
      return NextResponse.json({ error: 'Playbook not found' }, { status: 404 })
    }

    // If flow_config is missing, try to get it from the template
    if (!playbook.config?.flow_config) {
      const playbookConfig = getPlaybookConfig(playbook.playbook_type)
        || getPlaybookConfig(playbook.playbook_type.replace('_', '-'))
        || getPlaybookConfig(playbook.playbook_type.replace('-', '_'))

      if (playbookConfig?.flow_config) {
        // Enrich the response with the template flow_config
        playbook.config = {
          ...playbook.config,
          flow_config: playbookConfig.flow_config,
          phases: playbookConfig.phases,
          variables: playbookConfig.variables,
        }
      }
    }

    return NextResponse.json({
      success: true,
      playbook,
    })
  } catch (error) {
    console.error('Error in GET /api/projects/:projectId/playbooks/:playbookId:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/:projectId/playbooks/:playbookId
 * Update a playbook
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; playbookId: string } }
) {
  try {
    const { projectId, playbookId } = params
    const body = await request.json()
    const { name, config, position } = body

    const supabase = await createClient()

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (config !== undefined) updateData.config = config
    if (position !== undefined) updateData.position = position

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Update the playbook
    const { data, error } = await supabase
      .from('project_playbooks')
      .update(updateData)
      .eq('id', playbookId)
      .eq('project_id', projectId)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({
          error: 'A playbook with this name already exists in the project',
          code: 'DUPLICATE'
        }, { status: 409 })
      }
      console.error('Error updating playbook:', error)
      return NextResponse.json({ error: 'Failed to update playbook' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      playbook: data,
    })
  } catch (error) {
    console.error('Error in PATCH /api/projects/:projectId/playbooks/:playbookId:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/:projectId/playbooks/:playbookId
 * Delete a playbook
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; playbookId: string } }
) {
  try {
    const { projectId, playbookId } = params

    const supabase = await createClient()

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete the playbook
    const { error } = await supabase
      .from('project_playbooks')
      .delete()
      .eq('id', playbookId)
      .eq('project_id', projectId)

    if (error) {
      console.error('Error deleting playbook:', error)
      return NextResponse.json({ error: 'Failed to delete playbook' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Playbook deleted',
    })
  } catch (error) {
    console.error('Error in DELETE /api/projects/:projectId/playbooks/:playbookId:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
