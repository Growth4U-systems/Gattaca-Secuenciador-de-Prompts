import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

/**
 * POST /api/projects/:projectId/playbooks/move
 * Move a playbook to another project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId: sourceProjectId } = params
    const body = await request.json()
    const { playbookId, targetProjectId } = body

    if (!playbookId) {
      return NextResponse.json({ error: 'playbookId is required' }, { status: 400 })
    }

    if (!targetProjectId) {
      return NextResponse.json({ error: 'targetProjectId is required' }, { status: 400 })
    }

    if (sourceProjectId === targetProjectId) {
      return NextResponse.json({ error: 'Source and target projects are the same' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify source project exists and user has access
    const { data: sourceProject, error: sourceError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', sourceProjectId)
      .single()

    if (sourceError || !sourceProject) {
      return NextResponse.json({ error: 'Source project not found' }, { status: 404 })
    }

    // Verify target project exists and user has access
    const { data: targetProject, error: targetError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', targetProjectId)
      .single()

    if (targetError || !targetProject) {
      return NextResponse.json({ error: 'Target project not found' }, { status: 404 })
    }

    // Verify playbook exists in source project
    const { data: playbook, error: playbookError } = await supabase
      .from('project_playbooks')
      .select('*')
      .eq('id', playbookId)
      .eq('project_id', sourceProjectId)
      .single()

    if (playbookError || !playbook) {
      return NextResponse.json({ error: 'Playbook not found in source project' }, { status: 404 })
    }

    // Get the max position in the target project
    const { data: targetPlaybooks } = await supabase
      .from('project_playbooks')
      .select('position')
      .eq('project_id', targetProjectId)
      .order('position', { ascending: false })
      .limit(1)

    const nextPosition = targetPlaybooks && targetPlaybooks.length > 0
      ? targetPlaybooks[0].position + 1
      : 0

    // Move the playbook to the target project
    const { data: updatedPlaybook, error: updateError } = await supabase
      .from('project_playbooks')
      .update({
        project_id: targetProjectId,
        position: nextPosition,
      })
      .eq('id', playbookId)
      .select()
      .single()

    if (updateError) {
      console.error('Error moving playbook:', updateError)
      return NextResponse.json({ error: 'Failed to move playbook' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      playbook: updatedPlaybook,
      message: `Playbook moved to new project`,
    })
  } catch (error) {
    console.error('Error in POST /api/projects/:projectId/playbooks/move:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
