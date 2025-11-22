import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

interface FlowStep {
  id: string
  name: string
  order: number
  prompt: string
  base_doc_ids: string[]
  auto_receive_from: string[]
  model?: string
  temperature?: number
  max_tokens?: number
}

/**
 * Execute a single step independently
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaignId, stepId } = body as { campaignId: string; stepId: string }

    if (!campaignId || !stepId) {
      return NextResponse.json(
        { error: 'Missing campaignId or stepId' },
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

    // Load campaign and project
    const { data: campaign, error: campaignError } = await supabase
      .from('ecp_campaigns')
      .select('*, projects(*)')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    const project = campaign.projects

    // Check if flow_config exists
    if (!project.flow_config || !project.flow_config.steps) {
      return NextResponse.json(
        { error: 'Project does not have flow configuration' },
        { status: 400 }
      )
    }

    const flowConfig = project.flow_config
    const step = flowConfig.steps.find((s: FlowStep) => s.id === stepId)

    if (!step) {
      return NextResponse.json(
        { error: `Step with id "${stepId}" not found in flow configuration` },
        { status: 404 }
      )
    }

    console.log(`Executing single step: ${step.name}`)

    // Update current step and mark as running if not already
    const updateData: any = {
      current_step_id: step.id,
    }

    // If campaign is not yet running, mark it as running
    if (campaign.status !== 'running') {
      updateData.status = 'running'
      if (!campaign.started_at) {
        updateData.started_at = new Date().toISOString()
      }
    }

    await supabase
      .from('ecp_campaigns')
      .update(updateData)
      .eq('id', campaignId)

    const startTime = Date.now()

    // Call edge function to execute step
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/execute-flow-step`

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        campaign_id: campaignId,
        step_config: step,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Step ${step.name} failed:`, errorText)

      return NextResponse.json(
        {
          error: `Step "${step.name}" failed`,
          details: errorText,
        },
        { status: 500 }
      )
    }

    const result = await response.json()
    const duration = Date.now() - startTime

    // Clear current_step_id after completion
    await supabase
      .from('ecp_campaigns')
      .update({
        current_step_id: null,
      })
      .eq('id', campaignId)

    return NextResponse.json({
      success: true,
      message: `Step "${step.name}" executed successfully`,
      duration_ms: duration,
      step_id: step.id,
      step_name: step.name,
      result,
    })
  } catch (error) {
    console.error('Run single step error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
