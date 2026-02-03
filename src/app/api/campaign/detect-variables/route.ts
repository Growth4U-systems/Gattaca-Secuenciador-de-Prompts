import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * Detect variables in campaign prompts
 *
 * POST /api/campaign/detect-variables
 *
 * Request body:
 * - campaign_id: string
 *
 * Response:
 * - detected: string[] - All variables found in prompts
 * - declared: string[] - Variables that have values in custom_variables
 * - missing: string[] - Variables detected but not declared
 * - unused: string[] - Variables declared but not used in any prompt
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (!session || sessionError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { campaign_id } = body

    if (!campaign_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: campaign_id',
        },
        { status: 400 }
      )
    }

    // Get campaign with flow_config and custom_variables
    const { data: campaign, error: campaignError } = await supabase
      .from('ecp_campaigns')
      .select('id, flow_config, custom_variables, project_id, projects(id, flow_config)')
      .eq('id', campaign_id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campaign not found',
        },
        { status: 404 }
      )
    }

    // Get flow_config (campaign-level or project-level fallback)
    const flowConfig = campaign.flow_config || (campaign.projects as { flow_config?: { steps?: unknown[] } } | null)?.flow_config

    if (!flowConfig || !flowConfig.steps || !Array.isArray(flowConfig.steps)) {
      return NextResponse.json(
        {
          success: false,
          error: 'No flow_config found for this campaign',
        },
        { status: 404 }
      )
    }

    // Extract all prompts from flow_config steps
    const prompts: string[] = []
    for (const step of flowConfig.steps) {
      if (typeof step === 'object' && step !== null && 'prompt' in step && typeof step.prompt === 'string') {
        prompts.push(step.prompt)
      }
    }

    if (prompts.length === 0) {
      return NextResponse.json({
        success: true,
        detected: [],
        declared: [],
        missing: [],
        unused: [],
        message: 'No prompts found in flow_config',
      })
    }

    // Detect variables using the same regex as frontend
    // Matches: {{variable_name}} but NOT {{step:...}} or {{previous_step_output.field}}
    const variableRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g
    const detectedSet = new Set<string>()

    for (const prompt of prompts) {
      let match
      while ((match = variableRegex.exec(prompt)) !== null) {
        const varName = match[1]

        // Exclude special patterns
        if (varName === 'step') continue // {{step:...}} is handled by step interpolation
        if (varName === 'previous_step_output') continue // Built-in variable

        detectedSet.add(varName)
      }
    }

    const detected = Array.from(detectedSet).sort()

    // Get declared variables from custom_variables
    const customVariables = (campaign.custom_variables as Record<string, string>) || {}
    const declared = Object.keys(customVariables).sort()

    // Calculate missing (detected but not declared) and unused (declared but not used)
    const missing = detected.filter(v => !declared.includes(v))
    const unused = declared.filter(v => !detected.includes(v))

    return NextResponse.json({
      success: true,
      detected,
      declared,
      missing,
      unused,
      prompts_scanned: prompts.length,
    })
  } catch (error) {
    console.error('[detect-variables] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Auto-add missing variables to campaign
 *
 * PUT /api/campaign/detect-variables
 *
 * Request body:
 * - campaign_id: string
 * - variables: string[] - Variable names to add
 *
 * Response:
 * - success: boolean
 * - added: string[] - Variables that were added
 * - skipped: string[] - Variables that already existed
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (!session || sessionError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { campaign_id, variables } = body

    if (!campaign_id || !variables || !Array.isArray(variables)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: campaign_id, variables (array)',
        },
        { status: 400 }
      )
    }

    // Get current custom_variables
    const { data: campaign, error: campaignError } = await supabase
      .from('ecp_campaigns')
      .select('custom_variables')
      .eq('id', campaign_id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campaign not found',
        },
        { status: 404 }
      )
    }

    const customVariables = (campaign.custom_variables as Record<string, string>) || {}
    const added: string[] = []
    const skipped: string[] = []

    // Add missing variables with empty values
    for (const varName of variables) {
      if (customVariables[varName] !== undefined) {
        skipped.push(varName)
      } else {
        customVariables[varName] = '' // Initialize with empty string
        added.push(varName)
      }
    }

    // Update campaign with new variables
    if (added.length > 0) {
      const { error: updateError } = await supabase
        .from('ecp_campaigns')
        .update({ custom_variables: customVariables })
        .eq('id', campaign_id)

      if (updateError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to update campaign variables',
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      added,
      skipped,
      total_variables: Object.keys(customVariables).length,
    })
  } catch (error) {
    console.error('[detect-variables PUT] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
