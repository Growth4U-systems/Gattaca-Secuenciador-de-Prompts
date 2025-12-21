import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 60 // Cada poll es rápido, 60s es suficiente

interface DeepResearchInteraction {
  name: string
  state: 'STATE_UNSPECIFIED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  response?: {
    text: string
  }
  error?: {
    message: string
    code: string
  }
  outputs?: Array<{
    type?: 'thought' | 'text' | 'plan' | 'search' | 'result' | 'report' | 'response'
    text?: string
    thinkingSummary?: string
    content?: string
  }>
}

/**
 * Poll Deep Research interaction status
 * Called repeatedly by the frontend until completion
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { interaction_id, campaign_id, step_id, log_id } = body as {
      interaction_id: string
      campaign_id: string
      step_id: string
      log_id: string
    }

    if (!interaction_id || !campaign_id || !step_id) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Google API key from environment
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google API key not configured' },
        { status: 500 }
      )
    }

    // Build status URL
    let statusUrl = interaction_id.startsWith('http')
      ? `${interaction_id}?key=${apiKey}`
      : interaction_id.includes('/')
        ? `https://generativelanguage.googleapis.com/v1alpha/${interaction_id}?key=${apiKey}`
        : `https://generativelanguage.googleapis.com/v1alpha/interactions/${interaction_id}?key=${apiKey}`

    console.log(`[Deep Research Poll] Checking status for: ${interaction_id}`)

    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text()
      console.error(`[Deep Research Poll] Error: ${errorText}`)
      return NextResponse.json(
        { error: `Deep Research polling error: ${errorText}` },
        { status: 500 }
      )
    }

    const statusData = await statusResponse.json() as DeepResearchInteraction

    console.log(`[Deep Research Poll] State: ${statusData.state}`)

    // Extract thinking summaries for progress display
    const thinkingSummaries: string[] = []
    if (statusData.outputs) {
      for (const output of statusData.outputs) {
        if (output.thinkingSummary && !thinkingSummaries.includes(output.thinkingSummary)) {
          thinkingSummaries.push(output.thinkingSummary)
        }
        if (output.type === 'thought' && output.text && !thinkingSummaries.includes(output.text)) {
          thinkingSummaries.push(output.text)
        }
      }
    }

    // Update execution_logs with progress
    if (log_id) {
      await supabase
        .from('execution_logs')
        .update({
          status: statusData.state === 'COMPLETED' ? 'completed' :
                  statusData.state === 'FAILED' ? 'error' : 'polling',
          error_details: JSON.stringify({
            type: 'deep_research_progress',
            state: statusData.state,
            thinkingSummaries: thinkingSummaries.slice(-5),
            updated_at: new Date().toISOString()
          })
        })
        .eq('id', log_id)
    }

    // If completed, extract result and save to campaign
    if (statusData.state === 'COMPLETED') {
      let resultText = ''

      // Try multiple extraction methods
      if (statusData.response?.text) {
        resultText = statusData.response.text
        console.log(`[Deep Research Poll] Result from response.text: ${resultText.length} chars`)
      } else if (statusData.outputs && statusData.outputs.length > 0) {
        // Look for 'report' or 'response' type outputs first
        for (const output of statusData.outputs) {
          if ((output.type === 'report' || output.type === 'response' || output.type === 'result') && output.text) {
            resultText = output.text
            console.log(`[Deep Research Poll] Result from output type=${output.type}: ${resultText.length} chars`)
            break
          }
        }
        // Fallback to last output with text
        if (!resultText) {
          for (let i = statusData.outputs.length - 1; i >= 0; i--) {
            const output = statusData.outputs[i]
            if (output.text && output.type !== 'thought' && output.type !== 'search') {
              resultText = output.text
              console.log(`[Deep Research Poll] Result from output[${i}]: ${resultText.length} chars`)
              break
            }
          }
        }
      }

      if (!resultText) {
        console.log(`[Deep Research Poll] WARNING: No result text found`)
        console.log(`[Deep Research Poll] Full response:`, JSON.stringify(statusData, null, 2))
      }

      // Load campaign to update step_outputs
      const { data: campaign, error: campaignError } = await supabase
        .from('ecp_campaigns')
        .select('step_outputs, flow_config, projects(flow_config)')
        .eq('id', campaign_id)
        .single()

      if (!campaignError && campaign) {
        // Find step name from flow config
        // Note: projects is an array from the relation, access first element
        const flowConfig = campaign.flow_config || (campaign.projects as any)?.[0]?.flow_config
        const step = flowConfig?.steps?.find((s: any) => s.id === step_id)
        const stepName = step?.name || step_id

        // Save output to campaign.step_outputs
        const currentStepOutputs = campaign.step_outputs || {}
        currentStepOutputs[step_id] = {
          step_name: stepName,
          output: resultText,
          tokens: Math.ceil(resultText.length / 4),
          status: 'completed',
          completed_at: new Date().toISOString(),
        }

        await supabase
          .from('ecp_campaigns')
          .update({
            step_outputs: currentStepOutputs,
          })
          .eq('id', campaign_id)

        // Update execution log as completed
        if (log_id) {
          await supabase
            .from('execution_logs')
            .update({
              status: 'completed',
              output_tokens: Math.ceil(resultText.length / 4),
            })
            .eq('id', log_id)
        }

        console.log(`[Deep Research Poll] Result saved to campaign`)
      }

      return NextResponse.json({
        status: 'COMPLETED',
        result: resultText,
        thinking_summaries: thinkingSummaries,
      })
    }

    // If failed, return error
    if (statusData.state === 'FAILED') {
      const errorMsg = statusData.error?.message || 'Deep Research failed'

      // Update execution log as error
      if (log_id) {
        await supabase
          .from('execution_logs')
          .update({
            status: 'error',
            error_details: errorMsg,
          })
          .eq('id', log_id)
      }

      return NextResponse.json({
        status: 'FAILED',
        error: errorMsg,
        thinking_summaries: thinkingSummaries,
      })
    }

    // Still processing
    return NextResponse.json({
      status: statusData.state || 'PROCESSING',
      thinking_summaries: thinkingSummaries,
    })

  } catch (error) {
    console.error('Poll Deep Research error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
