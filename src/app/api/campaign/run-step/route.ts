import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 800 // ~13 minutes (Vercel Pro limit for Deep Research)

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
    const { campaignId, stepId, overrideModel, overrideTemperature, overrideMaxTokens } = body as {
      campaignId: string
      stepId: string
      overrideModel?: string  // Modelo alternativo para retry
      overrideTemperature?: number  // Temperature override
      overrideMaxTokens?: number  // Max tokens override
    }

    if (!campaignId || !stepId) {
      return NextResponse.json(
        { error: 'Missing campaignId or stepId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`[run-step] Session user_id: ${session.user.id}`)

    // Load campaign and project
    const { data: campaign, error: campaignError } = await supabase
      .from('ecp_campaigns')
      .select('*, projects_legacy(*)')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    const project = campaign.projects_legacy

    // Use campaign's flow_config if available, otherwise fall back to project's flow_config
    const flowConfig = campaign.flow_config || project.flow_config

    // Check if flow_config exists
    if (!flowConfig || !flowConfig.steps) {
      return NextResponse.json(
        { error: 'Campaign does not have flow configuration' },
        { status: 400 }
      )
    }

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

    // Aplicar overrides si están definidos
    const stepConfig = {
      ...step,
      ...(overrideModel && { model: overrideModel }),
      ...(overrideTemperature !== undefined && { temperature: overrideTemperature }),
      ...(overrideMaxTokens !== undefined && { max_tokens: overrideMaxTokens }),
    }

    // Timeout largo para Deep Research (puede tardar 10+ minutos)
    const isDeepResearch = stepConfig.model?.includes('deep-research')
    const controller = new AbortController()
    const timeoutMs = isDeepResearch ? 14 * 60 * 1000 : 5 * 60 * 1000 // 14 min para Deep Research, 5 min para otros
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        },
        body: JSON.stringify({
          campaign_id: campaignId,
          step_config: stepConfig,
          user_id: session.user.id,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

    if (!response.ok) {
      // Leer el body una sola vez como texto
      const responseText = await response.text()
      let errorData: any = {}
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { error: responseText }
      }

      console.error(`Step ${step.name} failed:`, errorData)

      // Retornar info para retry con el status code apropiado
      return NextResponse.json(
        {
          error: errorData.error || `Step "${step.name}" failed`,
          details: errorData.details,
          can_retry: errorData.can_retry ?? true,
          failed_model: errorData.failed_model || stepConfig.model,
          error_source: errorData.error_source,  // 'openrouter', 'deep-research', etc.
          original_error: errorData.original_error,  // Error técnico original
        },
        { status: response.status }
      )
    }

    const result = await response.json()
    const duration = Date.now() - startTime

    // Check if Deep Research returned async polling required
    if (result.async_polling_required) {
      console.log(`[Deep Research] Async mode - interaction created: ${result.interaction_id}`)
      // Don't clear current_step_id - the step is still running
      return NextResponse.json({
        success: true,
        async_polling_required: true,
        interaction_id: result.interaction_id,
        log_id: result.log_id,
        step_id: step.id,
        step_name: step.name,
        model_used: result.model_used,
        message: result.message,
      })
    }

    // Clear current_step_id after completion (for non-async steps)
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
      model_used: result.model_used,
      result,
    })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      // Handle abort/timeout specifically
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`Step ${step.name} timed out after ${timeoutMs / 1000}s`)
        return NextResponse.json(
          {
            error: `Step "${step.name}" timed out. Deep Research puede tardar hasta 10 minutos.`,
            can_retry: true,
            failed_model: stepConfig.model,
          },
          { status: 504 }
        )
      }
      throw fetchError // Re-throw for outer catch
    }
  } catch (error) {
    console.error('Run single step error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
