import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

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
 * Execute entire campaign automatically
 */
export async function POST(request: NextRequest) {
  let campaignId: string | null = null

  try {
    const body = await request.json()
    campaignId = body.campaignId as string

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Missing campaignId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Use campaign's flow_config if available, otherwise fall back to project's flow_config
    const flowConfig = campaign.flow_config || project.flow_config

    // Check if flow_config exists
    if (!flowConfig || !flowConfig.steps) {
      return NextResponse.json(
        { error: 'Campaign does not have flow configuration' },
        { status: 400 }
      )
    }

    const steps = flowConfig.steps.sort((a: FlowStep, b: FlowStep) => a.order - b.order)

    // Mark campaign as running
    await supabase
      .from('ecp_campaigns')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        step_outputs: {},
      })
      .eq('id', campaignId)

    const startTime = Date.now()
    const results: any[] = []

    // Execute each step in order
    for (const step of steps) {
      console.log(`Executing step: ${step.name}`)

      // Update current step
      await supabase
        .from('ecp_campaigns')
        .update({
          current_step_id: step.id,
        })
        .eq('id', campaignId)

      // Call edge function to execute step
      const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/execute-flow-step`

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        },
        body: JSON.stringify({
          campaign_id: campaignId,
          step_config: step,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Step ${step.name} failed:`, errorText)

        // Mark campaign as error
        await supabase
          .from('ecp_campaigns')
          .update({
            status: 'error',
            current_step_id: step.id,
            completed_at: new Date().toISOString(),
          })
          .eq('id', campaignId)

        return NextResponse.json(
          {
            error: `Step "${step.name}" failed`,
            details: errorText,
            completed_steps: results,
          },
          { status: 500 }
        )
      }

      const result = await response.json()
      results.push({
        step_id: step.id,
        step_name: step.name,
        ...result,
      })

      console.log(`Step ${step.name} completed`)
    }

    // Mark campaign as completed
    const duration = Date.now() - startTime

    await supabase
      .from('ecp_campaigns')
      .update({
        status: 'completed',
        current_step_id: null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', campaignId)

    return NextResponse.json({
      success: true,
      message: 'Campaign executed successfully',
      duration_ms: duration,
      steps_completed: results.length,
      results,
    })
  } catch (error) {
    console.error('Run campaign error:', error)

    // Update campaign status to error if we have the campaignId
    if (campaignId) {
      try {
        const supabaseForError = await createClient()
        await supabaseForError
          .from('ecp_campaigns')
          .update({
            status: 'error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', campaignId)
      } catch (e) {
        console.error('Failed to update campaign status to error:', e)
      }
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Get campaign execution status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Missing campaignId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: campaign, error } = await supabase
      .from('ecp_campaigns')
      .select('status, current_step_id, step_outputs, started_at, completed_at')
      .eq('id', campaignId)
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      campaign,
    })
  } catch (error) {
    console.error('Get campaign status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
