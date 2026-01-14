import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 60 // Cada poll es rápido, 60s es suficiente

interface DeepResearchInteraction {
  name?: string
  id?: string
  // Google uses both 'state' (REST) and 'status' (SDK) - support both cases
  state?: string  // REST API: 'STATE_UNSPECIFIED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  status?: string // SDK: 'completed' | 'failed' | 'in_progress' | 'cancelled'
  response?: {
    text: string
  }
  // Direct result field (newer API versions)
  result?: {
    text?: string
    content?: string
  }
  // Output field (alternative structure)
  output?: {
    text?: string
    content?: string
  }
  // Text field directly on the object
  text?: string
  // Content array (generateContent style)
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
  error?: {
    message: string
    code: string
  }
  // Outputs array for intermediate and final results
  outputs?: Array<{
    type?: string
    text?: string
    thinkingSummary?: string
    content?: string
    summary?: string
    message?: string
  }>
  // Alternative field names Google might use
  intermediateOutputs?: Array<any>
  steps?: Array<any>
  actions?: Array<any>
  progress?: {
    message?: string
    steps?: Array<any>
  }
  metadata?: any
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

    // Normalize state - Google uses both 'state' and 'status' fields with different casing
    const rawState = statusData.state || statusData.status || 'unknown'
    const normalizedState = rawState.toUpperCase()

    // Map various state values to our normalized format
    const isCompleted = normalizedState === 'COMPLETED' || rawState === 'completed'
    const isFailed = normalizedState === 'FAILED' || rawState === 'failed' || rawState === 'cancelled'
    const isProcessing = !isCompleted && !isFailed

    console.log(`[Deep Research Poll] Raw state/status: state=${statusData.state}, status=${statusData.status}`)
    console.log(`[Deep Research Poll] Normalized: ${normalizedState}, isCompleted=${isCompleted}, isFailed=${isFailed}`)
    console.log(`[Deep Research Poll] Full response keys:`, Object.keys(statusData))
    console.log(`[Deep Research Poll] Has outputs: ${!!statusData.outputs}, count: ${statusData.outputs?.length || 0}`)
    // Log alternative fields
    if (statusData.intermediateOutputs) console.log(`[Deep Research Poll] Has intermediateOutputs:`, statusData.intermediateOutputs.length)
    if (statusData.steps) console.log(`[Deep Research Poll] Has steps:`, statusData.steps.length)
    if (statusData.actions) console.log(`[Deep Research Poll] Has actions:`, statusData.actions.length)
    if (statusData.progress) console.log(`[Deep Research Poll] Has progress:`, JSON.stringify(statusData.progress))
    if (statusData.metadata) console.log(`[Deep Research Poll] Has metadata:`, JSON.stringify(statusData.metadata))
    if (statusData.outputs && statusData.outputs.length > 0) {
      console.log(`[Deep Research Poll] Output types:`, statusData.outputs.map(o => o.type || 'no-type').join(', '))
      console.log(`[Deep Research Poll] First output:`, JSON.stringify(statusData.outputs[0], null, 2))
    }
    // Log the whole response if in processing state to understand structure
    if (isProcessing) {
      console.log(`[Deep Research Poll] Full PROCESSING response:`, JSON.stringify(statusData, null, 2).substring(0, 2000))
    }

    // Extract thinking summaries for progress display
    const thinkingSummaries: string[] = []

    // Try standard outputs array
    if (statusData.outputs) {
      for (const output of statusData.outputs) {
        // Try multiple field names
        const text = output.thinkingSummary || output.summary || output.message ||
                     (output.type === 'thought' ? output.text : null)
        if (text && !thinkingSummaries.includes(text)) {
          thinkingSummaries.push(text)
        }
      }
    }

    // Try alternative field names
    const altOutputs = statusData.intermediateOutputs || statusData.steps || statusData.actions || []
    for (const item of altOutputs) {
      const text = item.summary || item.message || item.text || item.thinkingSummary || item.description
      if (text && typeof text === 'string' && !thinkingSummaries.includes(text)) {
        thinkingSummaries.push(text)
      }
    }

    // Try progress field
    if (statusData.progress?.message && !thinkingSummaries.includes(statusData.progress.message)) {
      thinkingSummaries.push(statusData.progress.message)
    }
    if (statusData.progress?.steps) {
      for (const step of statusData.progress.steps) {
        const text = step.summary || step.message || step.description
        if (text && !thinkingSummaries.includes(text)) {
          thinkingSummaries.push(text)
        }
      }
    }

    console.log(`[Deep Research Poll] Extracted ${thinkingSummaries.length} thinking summaries`)

    // Update execution_logs with progress
    if (log_id) {
      await supabase
        .from('execution_logs')
        .update({
          status: isCompleted ? 'completed' : isFailed ? 'error' : 'polling',
          error_details: JSON.stringify({
            type: 'deep_research_progress',
            state: normalizedState,
            thinkingSummaries: thinkingSummaries.slice(-5),
            updated_at: new Date().toISOString()
          })
        })
        .eq('id', log_id)
    }

    // If completed, extract result and save to campaign
    if (isCompleted) {
      let resultText = ''

      // Log full response for debugging when completed
      console.log(`[Deep Research Poll] COMPLETED - Full response:`, JSON.stringify(statusData, null, 2).substring(0, 5000))

      // According to Google documentation, the final report is in outputs[-1].text
      // The last element of the outputs array contains the complete research report
      if (statusData.outputs && statusData.outputs.length > 0) {
        // Get the LAST output - this is where the final report is according to docs
        const lastOutput = statusData.outputs[statusData.outputs.length - 1]
        if (lastOutput.text) {
          resultText = lastOutput.text
          console.log(`[Deep Research Poll] Result from outputs[-1].text (last output): ${resultText.length} chars`)
        } else if (lastOutput.content) {
          resultText = lastOutput.content
          console.log(`[Deep Research Poll] Result from outputs[-1].content (last output): ${resultText.length} chars`)
        }
      }

      // Fallback: try other fields if outputs[-1] didn't work
      if (!resultText) {
        // 1. response.text (original format)
        if (statusData.response?.text) {
          resultText = statusData.response.text
          console.log(`[Deep Research Poll] Result from response.text: ${resultText.length} chars`)
        }
        // 2. result.text or result.content (newer format)
        else if (statusData.result?.text) {
          resultText = statusData.result.text
          console.log(`[Deep Research Poll] Result from result.text: ${resultText.length} chars`)
        }
        else if (statusData.result?.content) {
          resultText = statusData.result.content
          console.log(`[Deep Research Poll] Result from result.content: ${resultText.length} chars`)
        }
        // 3. Direct text field
        else if (statusData.text) {
          resultText = statusData.text
          console.log(`[Deep Research Poll] Result from direct text: ${resultText.length} chars`)
        }
        // 4. candidates array (generateContent style)
        else if (statusData.candidates?.[0]?.content?.parts?.[0]?.text) {
          resultText = statusData.candidates[0].content.parts[0].text
          console.log(`[Deep Research Poll] Result from candidates: ${resultText.length} chars`)
        }
      }

      if (!resultText) {
        console.log(`[Deep Research Poll] WARNING: No result text found in any field`)
        console.log(`[Deep Research Poll] Available fields:`, Object.keys(statusData))
        console.log(`[Deep Research Poll] Outputs array:`, JSON.stringify(statusData.outputs, null, 2))
      }

      // Load campaign to update step_outputs
      const { data: campaign, error: campaignError } = await supabase
        .from('ecp_campaigns')
        .select('step_outputs, flow_config, projects_legacy(flow_config)')
        .eq('id', campaign_id)
        .single()

      if (!campaignError && campaign) {
        // Find step name from flow config
        // Note: projects is an array from the relation, access first element
        const flowConfig = campaign.flow_config || (campaign.projects_legacy as any)?.[0]?.flow_config
        const step = flowConfig?.steps?.find((s: any) => s.id === step_id)
        const stepName = step?.name || step_id

        // Save output to campaign.step_outputs
        // IMPORTANT: Create a deep copy to ensure Supabase detects the change
        const currentStepOutputs = JSON.parse(JSON.stringify(campaign.step_outputs || {}))
        currentStepOutputs[step_id] = {
          step_name: stepName,
          output: resultText,
          tokens: Math.ceil(resultText.length / 4),
          status: 'completed',
          completed_at: new Date().toISOString(),
        }

        console.log(`[Deep Research Poll] Saving step_outputs for step ${step_id}`)

        const { error: updateError } = await supabase
          .from('ecp_campaigns')
          .update({
            step_outputs: currentStepOutputs,
          })
          .eq('id', campaign_id)

        if (updateError) {
          console.error('[Deep Research Poll] Error saving step_outputs:', updateError)
        } else {
          console.log(`[Deep Research Poll] Successfully saved step_outputs for step ${step_id}`)
        }

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
    if (isFailed) {
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
      status: 'PROCESSING',
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
