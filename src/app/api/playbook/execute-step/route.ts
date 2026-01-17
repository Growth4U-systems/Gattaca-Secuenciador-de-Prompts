import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@/lib/supabase-server-admin'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'
import { SIGNAL_OUTREACH_FLOW_STEPS } from '@/lib/templates/signal-based-outreach-playbook'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120 // 2 minutes for LLM calls

// Mapeo de step IDs de UI a template
const STEP_ID_MAP: Record<string, string> = {
  'map_topics': 'step-1-value-prop-topics',
  'find_creators': 'step-2-search-creators',
  'evaluate_creators': 'step-3-evaluate-creators',
  'select_creators': 'step-4-select-creators',
  'scrape_posts': 'step-5-scrape-posts',
  'evaluate_posts': 'step-6-evaluate-posts',
  'select_posts': 'step-7-select-posts',
  'scrape_engagers': 'step-8-scrape-engagers',
  'filter_icp': 'step-9-filter-icp',
  'lead_magnet_messages': 'step-10-lead-magnet-messages',
  'export_launch': 'step-11-export-launch',
}

// Orden de los pasos para saber cuál es el anterior
const STEP_ORDER = [
  'map_topics',
  'find_creators',
  'evaluate_creators',
  'select_creators',
  'scrape_posts',
  'evaluate_posts',
  'select_posts',
  'scrape_engagers',
  'filter_icp',
  'lead_magnet_messages',
  'export_launch',
]

interface ExecuteStepRequest {
  projectId: string
  stepId: string
  playbookType: string
  variables: Record<string, string>
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

  // Get session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (!session || sessionError) {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  // Get OpenRouter API key (same pattern as niche-finder/suggest)
  let openrouterApiKey: string | null = null

  // 1. Try user_api_keys table
  openrouterApiKey = await getUserApiKey({
    userId: session.user.id,
    serviceName: 'openrouter',
    supabase,
  })

  // 2. Try user_openrouter_tokens (OAuth)
  if (!openrouterApiKey) {
    const { data: tokenRecord } = await supabase
      .from('user_openrouter_tokens')
      .select('encrypted_api_key')
      .eq('user_id', session.user.id)
      .single()

    if (tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
      try {
        openrouterApiKey = decryptToken(tokenRecord.encrypted_api_key)
      } catch {
        // Ignore decryption errors
      }
    }
  }

  // 3. Try agency key
  if (!openrouterApiKey) {
    const { data: membership } = await supabase
      .from('agency_members')
      .select('agency_id, agencies(id, openrouter_api_key)')
      .eq('user_id', session.user.id)
      .single()

    const agencyData = membership?.agencies as unknown as {
      id: string
      openrouter_api_key: string | null
    } | null

    if (agencyData?.openrouter_api_key) {
      try {
        openrouterApiKey = decryptToken(agencyData.openrouter_api_key)
      } catch {
        // Ignore decryption errors
      }
    }
  }

  // 4. Fallback to env
  if (!openrouterApiKey) {
    openrouterApiKey = process.env.OPENROUTER_API_KEY || null
  }

  if (!openrouterApiKey) {
    return NextResponse.json({
      success: false,
      error: 'OpenRouter API key not configured. Please add your API key in Settings > APIs.'
    }, { status: 500 })
  }

  try {
    const body: ExecuteStepRequest = await request.json()
    const { projectId, stepId, playbookType, variables } = body

    if (!projectId || !stepId || !playbookType) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: projectId, stepId, playbookType'
      }, { status: 400 })
    }

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    // Get the template step
    const templateStepId = STEP_ID_MAP[stepId]
    if (!templateStepId) {
      return NextResponse.json({
        success: false,
        error: `Unknown step ID: ${stepId}`
      }, { status: 400 })
    }

    const templateStep = SIGNAL_OUTREACH_FLOW_STEPS.find(s => s.id === templateStepId)
    if (!templateStep) {
      return NextResponse.json({
        success: false,
        error: `Template step not found: ${templateStepId}`
      }, { status: 500 })
    }

    // Get outputs from previous steps
    const adminClient = createAdminClient()
    const { data: previousOutputs } = await adminClient
      .from('playbook_step_outputs')
      .select('step_id, output_content, imported_data')
      .eq('project_id', projectId)
      .eq('playbook_type', playbookType)
      .eq('status', 'completed')

    // Build previous_step_output from the immediately previous step
    const currentStepIndex = STEP_ORDER.indexOf(stepId)
    let previousStepOutput = ''

    if (currentStepIndex > 0) {
      const previousStepId = STEP_ORDER[currentStepIndex - 1]
      const previousStep = previousOutputs?.find(o => o.step_id === previousStepId)

      if (previousStep) {
        // If there's imported data, format it as context
        if (previousStep.imported_data) {
          const importedData = previousStep.imported_data as unknown[]
          previousStepOutput = `## Datos Importados (${importedData.length} registros)\n\n`
          previousStepOutput += '```json\n' + JSON.stringify(importedData.slice(0, 50), null, 2) + '\n```\n'
          if (importedData.length > 50) {
            previousStepOutput += `\n*... y ${importedData.length - 50} registros más*\n`
          }
        }
        // Add the LLM output if available
        if (previousStep.output_content) {
          previousStepOutput += '\n\n' + previousStep.output_content
        }
      }
    }

    // Replace variables in prompt
    let prompt = templateStep.prompt
    const allVariables = {
      ...variables,
      previous_step_output: previousStepOutput || variables.previous_step_output || '(No hay output del paso anterior)',
    }

    for (const [key, value] of Object.entries(allVariables)) {
      prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '')
    }

    // Mark step as running
    await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: stepId,
        status: 'running',
        variables_used: variables,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id'
      })

    // Execute LLM call
    const llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: templateStep.model || 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: templateStep.max_tokens || 4096,
        temperature: templateStep.temperature || 0.7,
      }),
    })

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text()
      throw new Error(`OpenRouter API error: ${llmResponse.status} - ${errorText}`)
    }

    const llmData = await llmResponse.json()
    const output = llmData.choices?.[0]?.message?.content || ''

    if (!output) {
      throw new Error('LLM returned empty response')
    }

    // Save output to database
    await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: stepId,
        output_content: output,
        status: 'completed',
        variables_used: variables,
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id'
      })

    return NextResponse.json({
      success: true,
      output,
      stepId,
      model: templateStep.model,
    })

  } catch (error) {
    console.error('[playbook/execute-step] Error:', error)

    // Try to mark step as error
    try {
      const body = await request.clone().json()
      const adminClient = createAdminClient()
      await adminClient
        .from('playbook_step_outputs')
        .upsert({
          project_id: body.projectId,
          playbook_type: body.playbookType,
          step_id: body.stepId,
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'project_id,playbook_type,step_id'
        })
    } catch {
      // Ignore errors when trying to save error state
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
