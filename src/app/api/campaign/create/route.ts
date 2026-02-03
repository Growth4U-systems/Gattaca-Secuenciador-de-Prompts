import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getPlaybookConfig } from '@/components/playbook/configs'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Create a new campaign
 * SECURITY FIX: Now uses user session instead of service role key
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, ecp_name, problem_core, country, industry, custom_variables, flow_config, playbook_type } = body

    // Only require projectId and ecp_name
    // Other fields are optional now (variables-only system)
    if (!projectId || !ecp_name) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId and ecp_name are required' },
        { status: 400 }
      )
    }

    // SECURITY FIX: Use user session instead of service role
    const supabase = await createClient()

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Load project to verify it exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Failed to load project', details: projectError?.message || 'Project not found' },
        { status: 500 }
      )
    }

    // Get flow_config: use provided one, or fetch from project_playbooks, or from template
    let campaignFlowConfig = flow_config || null

    // If no flow_config provided and we have a playbook_type, try to get it
    if (!campaignFlowConfig && playbook_type) {
      // First try to get from project_playbooks (stored when playbook was added to project)
      const { data: projectPlaybook } = await supabase
        .from('project_playbooks')
        .select('config')
        .eq('project_id', projectId)
        .eq('playbook_type', playbook_type)
        .single()

      if (projectPlaybook?.config?.flow_config) {
        // Use flow_config stored when playbook was added to project
        campaignFlowConfig = projectPlaybook.config.flow_config
      } else {
        // Fallback: get from playbook template directly
        const playbookConfig = getPlaybookConfig(playbook_type)
          || getPlaybookConfig(playbook_type.replace('_', '-'))
          || getPlaybookConfig(playbook_type.replace('-', '_'))

        if (playbookConfig?.flow_config) {
          // Use the actual flow_config with steps/prompts
          campaignFlowConfig = playbookConfig.flow_config
        }
      }
    }

    let insertData: any = {
      project_id: projectId,
      ecp_name,
      problem_core: problem_core || null,
      country: country || null,
      industry: industry || null,
      status: 'draft',
      custom_variables: custom_variables || {},
      step_outputs: {},
      flow_config: campaignFlowConfig,
      playbook_type: playbook_type || null, // Campaign-specific playbook type
    }

    const { data, error } = await supabase
      .from('ecp_campaigns')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Database error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      return NextResponse.json(
        {
          error: 'Failed to create campaign',
          details: error.message,
          hint: error.hint || 'Check if database migration was applied',
          code: error.code
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      campaign: data,
      message: 'Campaign created successfully',
    })
  } catch (error) {
    console.error('Create campaign error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

/**
 * List campaigns for a project
 * SECURITY FIX: Now uses user session instead of service role key
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing projectId' },
        { status: 400 }
      )
    }

    // SECURITY FIX: Use user session instead of service role
    const supabase = await createClient()

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // RLS will automatically filter campaigns based on user's project access
    const { data, error } = await supabase
      .from('ecp_campaigns')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to load campaigns' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      campaigns: data,
    })
  } catch (error) {
    console.error('List campaigns error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
