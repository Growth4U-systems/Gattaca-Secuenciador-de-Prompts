import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

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
export const maxDuration = 30

interface FlowStep {
  id: string
  name: string
  description?: string
  order: number
  prompt: string
  base_doc_ids: string[]
  auto_receive_from: string[]
  model?: string
  temperature?: number
  max_tokens?: number
}

interface FlowConfig {
  steps: FlowStep[]
}

/**
 * Save flow configuration to project
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, flowConfig } = body as {
      projectId: string
      flowConfig: FlowConfig
    }

    if (!projectId || !flowConfig) {
      return NextResponse.json(
        { error: 'Missing projectId or flowConfig' },
        { status: 400 }
      )
    }

    // Validate flow config
    if (!flowConfig.steps || !Array.isArray(flowConfig.steps)) {
      return NextResponse.json(
        { error: 'Invalid flowConfig: steps must be an array' },
        { status: 400 }
      )
    }

    // Validate each step
    for (const step of flowConfig.steps) {
      if (!step.id || !step.name || !step.prompt || step.order === undefined) {
        return NextResponse.json(
          { error: `Invalid step: ${step.name || 'unknown'} - missing required fields` },
          { status: 400 }
        )
      }

      if (!Array.isArray(step.base_doc_ids)) {
        return NextResponse.json(
          { error: `Invalid step: ${step.name} - base_doc_ids must be an array` },
          { status: 400 }
        )
      }

      if (!Array.isArray(step.auto_receive_from)) {
        return NextResponse.json(
          { error: `Invalid step: ${step.name} - auto_receive_from must be an array` },
          { status: 400 }
        )
      }
    }

    // Use admin client to bypass auth
    const supabase = getSupabaseAdmin()

    // Try to save to projects table first (new schema)
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .update({
        legacy_flow_config: flowConfig,
      })
      .eq('id', projectId)
      .select()
      .single()

    if (!projectError && projectData) {
      return NextResponse.json({
        success: true,
        message: 'Flow configuration saved successfully',
        project: projectData,
      })
    }

    // Fallback to projects_legacy (old schema)
    const { data, error } = await supabase
      .from('projects_legacy')
      .update({
        flow_config: flowConfig,
      })
      .eq('id', projectId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to save flow config', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Flow configuration saved successfully',
      project: data,
    })
  } catch (error) {
    console.error('Save flow config error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get flow configuration from project
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

    const supabase = getSupabaseAdmin()

    // Try projects table first (new schema)
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('legacy_flow_config')
      .eq('id', projectId)
      .single()

    if (!projectError && projectData) {
      return NextResponse.json({
        success: true,
        flowConfig: projectData.legacy_flow_config || null,
      })
    }

    // Fallback to projects_legacy (old schema)
    const { data, error } = await supabase
      .from('projects_legacy')
      .select('flow_config')
      .eq('id', projectId)
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to load flow config' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      flowConfig: data.flow_config || null,
    })
  } catch (error) {
    console.error('Get flow config error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
