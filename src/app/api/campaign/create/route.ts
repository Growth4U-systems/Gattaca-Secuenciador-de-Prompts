import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Create a new campaign
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, ecp_name, problem_core, country, industry, custom_variables, flow_config } = body

    // Only require projectId and ecp_name
    // Other fields are optional now (variables-only system)
    if (!projectId || !ecp_name) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId and ecp_name are required' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Load project to copy flow_config
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('flow_config')
      .eq('id', projectId)
      .single()

    if (projectError) {
      return NextResponse.json(
        { error: 'Failed to load project', details: projectError.message },
        { status: 500 }
      )
    }

    // Create campaign with copied flow_config
    // Use provided flow_config if present (for duplicates), otherwise use project's
    const campaignFlowConfig = flow_config || project.flow_config || null

    let insertData: any = {
      project_id: projectId,
      ecp_name,
      problem_core: problem_core || '',
      country: country || '',
      industry: industry || '',
      status: 'draft',
      custom_variables: custom_variables || {},
      step_outputs: {},
      flow_config: campaignFlowConfig,
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
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * List campaigns for a project
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

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
