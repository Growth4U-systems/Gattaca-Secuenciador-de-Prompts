import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

interface CampaignRow {
  ecp_name: string
  problem_core?: string
  country?: string
  industry?: string
  [key: string]: string | undefined // Custom variables
}

interface BulkCreateRequest {
  projectId: string
  campaigns: CampaignRow[]
}

/**
 * Bulk create campaigns from CSV data
 */
export async function POST(request: NextRequest) {
  try {
    const body: BulkCreateRequest = await request.json()
    const { projectId, campaigns } = body

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing required field: projectId' },
        { status: 400 }
      )
    }

    if (!campaigns || !Array.isArray(campaigns) || campaigns.length === 0) {
      return NextResponse.json(
        { error: 'No campaigns provided. Please provide an array of campaigns.' },
        { status: 400 }
      )
    }

    // Validate that all campaigns have ecp_name
    const invalidCampaigns = campaigns.filter((c, index) => !c.ecp_name?.trim())
    if (invalidCampaigns.length > 0) {
      const invalidIndices = campaigns
        .map((c, index) => (!c.ecp_name?.trim() ? index + 1 : null))
        .filter(i => i !== null)
      return NextResponse.json(
        {
          error: `Missing ecp_name in rows: ${invalidIndices.join(', ')}. Each campaign must have an ecp_name.`,
          invalidRows: invalidIndices
        },
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
      .select('flow_config, variable_definitions')
      .eq('id', projectId)
      .single()

    if (projectError) {
      return NextResponse.json(
        { error: 'Failed to load project', details: projectError.message },
        { status: 500 }
      )
    }

    // Prepare flow_config with updated models
    let campaignFlowConfig = project.flow_config || null
    if (campaignFlowConfig?.steps) {
      campaignFlowConfig = {
        ...campaignFlowConfig,
        steps: campaignFlowConfig.steps.map((step: any) => ({
          ...step,
          model: (step.model === 'gemini-2.0-flash-exp' ||
                  step.model === 'gemini-2.0-pro-exp' ||
                  step.model === 'gemini-2.5-pro-002')
            ? 'gemini-2.5-pro'
            : step.model
        }))
      }
    }

    // Reserved fields that go into dedicated columns
    const reservedFields = ['ecp_name', 'problem_core', 'country', 'industry']

    // Get project variable definitions
    const projectVariables = project.variable_definitions as Array<{
      name: string
      default_value: string
      required: boolean
    }> || []

    // Get list of valid variable names from project
    const validVariableNames = new Set(projectVariables.map(v => v.name))

    // Prepare campaigns for insertion
    const campaignsToInsert = campaigns.map((campaign) => {
      // Only include variables that are defined in the project
      // Use CSV value if present, otherwise leave empty
      const customVariables: Record<string, string> = {}

      projectVariables.forEach((varDef) => {
        const csvValue = campaign[varDef.name]
        // Use CSV value if present, otherwise empty string
        customVariables[varDef.name] = csvValue?.trim() || ''
      })

      return {
        project_id: projectId,
        ecp_name: campaign.ecp_name.trim(),
        problem_core: campaign.problem_core?.trim() || '',
        country: campaign.country?.trim() || '',
        industry: campaign.industry?.trim() || '',
        status: 'draft',
        custom_variables: customVariables,
        step_outputs: {},
        flow_config: campaignFlowConfig,
      }
    })

    // Bulk insert all campaigns
    const { data, error } = await supabase
      .from('ecp_campaigns')
      .insert(campaignsToInsert)
      .select()

    if (error) {
      console.error('Database error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      return NextResponse.json(
        {
          error: 'Failed to create campaigns',
          details: error.message,
          hint: error.hint || 'Check if database migration was applied',
          code: error.code
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      campaigns: data,
      count: data.length,
      message: `Successfully created ${data.length} campaigns`,
    })
  } catch (error) {
    console.error('Bulk create campaign error:', error)
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
