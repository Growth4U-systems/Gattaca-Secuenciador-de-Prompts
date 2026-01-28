import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@/lib/supabase-server-admin'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { playbookMetadata } from '@/lib/playbook-metadata'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Assistant model - using Claude via OpenRouter
const ASSISTANT_MODEL = 'anthropic/claude-3.5-sonnet'

// Tool definitions for the assistant
const ASSISTANT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_project_context',
      description: 'Get the current project context including documents, playbook outputs, and active sessions',
      parameters: {
        type: 'object',
        properties: {
          include_documents: {
            type: 'boolean',
            description: 'Include knowledge base documents summary',
          },
          include_outputs: {
            type: 'boolean',
            description: 'Include recent playbook step outputs',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_playbooks',
      description: 'List all available playbooks with their descriptions and purposes',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_playbook_status',
      description: 'Get the current status of a playbook including which step the user is on',
      parameters: {
        type: 'object',
        properties: {
          playbook_type: {
            type: 'string',
            description: 'The type of playbook (e.g., niche_finder, signal_based_outreach)',
          },
        },
        required: ['playbook_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'explain_step',
      description: 'Get a detailed explanation of what a specific playbook step does',
      parameters: {
        type: 'object',
        properties: {
          playbook_type: {
            type: 'string',
            description: 'The type of playbook',
          },
          step_id: {
            type: 'string',
            description: 'The ID of the step to explain',
          },
        },
        required: ['playbook_type', 'step_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_execute_step',
      description: 'Request to execute a playbook step. This will ask for user confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          playbook_type: {
            type: 'string',
            description: 'The type of playbook',
          },
          step_id: {
            type: 'string',
            description: 'The ID of the step to execute',
          },
          step_name: {
            type: 'string',
            description: 'Human-readable name of the step',
          },
        },
        required: ['playbook_type', 'step_id', 'step_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_start_playbook',
      description: 'Request to start a different playbook. This will ask for user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          playbook_type: {
            type: 'string',
            description: 'The type of playbook to start',
          },
          playbook_name: {
            type: 'string',
            description: 'Human-readable name of the playbook',
          },
        },
        required: ['playbook_type', 'playbook_name'],
      },
    },
  },
]

// Build the system prompt with context
function buildSystemPrompt(projectName: string, currentPlaybook?: string, currentStep?: string): string {
  const playbooksList = Object.entries(playbookMetadata)
    .map(([key, meta]) => `- **${key}**: ${meta.purpose}`)
    .join('\n')

  return `Eres el asistente de Gattaca, una plataforma de playbooks de IA para marketing y growth.

## Tu rol
- Guiar usuarios a través de los playbooks de manera amigable y clara
- Explicar qué hace cada paso y por qué es importante
- Ejecutar pasos cuando el usuario lo solicite (siempre pidiendo confirmación)
- Sugerir el mejor playbook según los objetivos del usuario
- Responder preguntas sobre marketing, growth y el uso de la plataforma

## Contexto actual
- Proyecto: ${projectName || 'No seleccionado'}
${currentPlaybook ? `- Playbook activo: ${currentPlaybook}` : '- Sin playbook activo'}
${currentStep ? `- Paso actual: ${currentStep}` : ''}

## Playbooks disponibles
${playbooksList}

## Reglas importantes
1. SIEMPRE pide confirmación antes de ejecutar cualquier acción
2. Usa un tono amigable pero profesional
3. Explica conceptos complejos de forma simple
4. Si el usuario parece perdido, ofrece ayuda proactivamente
5. No inventes información - usa los tools para obtener datos reales
6. Responde en español

## Cuando el usuario pida ejecutar algo
Usa el tool request_execute_step o request_start_playbook. El sistema mostrará botones de confirmación al usuario.

## Formato de respuestas
- Sé conciso pero informativo
- Usa markdown para formatear cuando sea útil
- Incluye emojis ocasionalmente para hacer la conversación más amigable
`
}

// Tool handlers
async function handleGetProjectContext(
  projectId: string,
  params: { include_documents?: boolean; include_outputs?: boolean },
  adminClient: ReturnType<typeof createAdminClient>
) {
  const result: Record<string, unknown> = {}

  if (params.include_documents !== false) {
    const { data: docs } = await adminClient
      .from('knowledge_base_docs')
      .select('id, title, doc_type, created_at')
      .eq('project_id', projectId)
      .limit(20)

    result.documents = docs?.map(d => ({
      title: d.title,
      type: d.doc_type,
    })) || []
  }

  if (params.include_outputs !== false) {
    const { data: outputs } = await adminClient
      .from('playbook_step_outputs')
      .select('step_id, playbook_type, status, executed_at')
      .eq('project_id', projectId)
      .order('executed_at', { ascending: false })
      .limit(10)

    result.recent_outputs = outputs || []
  }

  // Get active sessions
  const { data: sessions } = await adminClient
    .from('playbook_sessions')
    .select('id, playbook_type, status, current_step, current_phase')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .limit(5)

  result.active_sessions = sessions || []

  return result
}

function handleListPlaybooks() {
  return Object.entries(playbookMetadata).map(([key, meta]) => ({
    id: key,
    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    purpose: meta.purpose,
    when_to_use: meta.whenToUse,
    outcome: meta.outcome,
    duration: meta.duration || 'Variable',
    icon: meta.icon || '📋',
  }))
}

async function handleGetPlaybookStatus(
  projectId: string,
  playbookType: string,
  adminClient: ReturnType<typeof createAdminClient>
) {
  // Get latest session for this playbook
  const { data: session } = await adminClient
    .from('playbook_sessions')
    .select('*')
    .eq('project_id', projectId)
    .eq('playbook_type', playbookType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Get completed steps
  const { data: completedSteps } = await adminClient
    .from('playbook_step_outputs')
    .select('step_id, status, executed_at')
    .eq('project_id', projectId)
    .eq('playbook_type', playbookType)
    .eq('status', 'completed')

  const meta = playbookMetadata[playbookType]

  return {
    playbook: playbookType,
    playbook_info: meta ? {
      purpose: meta.purpose,
      steps: meta.steps,
    } : null,
    session: session ? {
      status: session.status,
      current_step: session.current_step,
      current_phase: session.current_phase,
    } : null,
    completed_steps: completedSteps?.map(s => s.step_id) || [],
    total_steps: meta?.steps ? Object.keys(meta.steps).length : 0,
  }
}

function handleExplainStep(playbookType: string, stepId: string) {
  const meta = playbookMetadata[playbookType]
  if (!meta) {
    return { error: `Playbook ${playbookType} not found` }
  }

  const stepDescription = meta.steps?.[stepId]
  const detailedStep = meta.detailedSteps?.[stepId]

  return {
    step_id: stepId,
    playbook: playbookType,
    brief: stepDescription || 'Sin descripción disponible',
    detailed: detailedStep?.detailed || stepDescription || 'Sin descripción detallada',
    tips: detailedStep?.tips || [],
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const adminClient = createAdminClient()

  // Get session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (!session || sessionError) {
    console.log('[Assistant Chat] No session found, sessionError:', sessionError?.message)
    return NextResponse.json({
      error: 'Por favor inicia sesión para usar el asistente.'
    }, { status: 401 })
  }
  console.log('[Assistant Chat] Session found for user:', session.user.id)

  const body = await request.json()
  const { projectId, message, messages: conversationHistory = [] } = body

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  // Get project info
  let projectName = 'Sin proyecto'
  let currentPlaybook: string | undefined
  let currentStep: string | undefined

  if (projectId) {
    const { data: project } = await adminClient
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single()

    if (project) {
      projectName = project.name
    }

    // Get active session
    const { data: activeSession } = await adminClient
      .from('playbook_sessions')
      .select('playbook_type, current_step')
      .eq('project_id', projectId)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (activeSession) {
      currentPlaybook = activeSession.playbook_type
      currentStep = activeSession.current_step
    }
  }

  // Get OpenRouter API key
  const apiKey = await getUserApiKey({
    userId: session.user.id,
    serviceName: 'openrouter',
    supabase: adminClient,
  })

  if (!apiKey) {
    console.log('[Assistant Chat] No OpenRouter API key found for user:', session.user.id)
    return NextResponse.json({
      error: 'No hay API key de OpenRouter configurada. Por favor configura tu API key en ajustes.',
    }, { status: 400 })
  }
  console.log('[Assistant Chat] OpenRouter API key found, length:', apiKey.length, 'starts with:', apiKey.substring(0, 10))

  // Build messages for the LLM
  const systemPrompt = buildSystemPrompt(projectName, currentPlaybook, currentStep)
  const llmMessages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10), // Keep last 10 messages for context
    { role: 'user', content: message },
  ]

  try {
    // First LLM call - may include tool calls
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Gattaca Assistant',
      },
      body: JSON.stringify({
        model: ASSISTANT_MODEL,
        messages: llmMessages,
        tools: ASSISTANT_TOOLS,
        tool_choice: 'auto',
        max_tokens: 1024,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('[Assistant Chat] OpenRouter error:', response.status)
      console.error('[Assistant Chat] OpenRouter error body:', errorData)
      console.error('[Assistant Chat] API key used (first 15 chars):', apiKey.substring(0, 15))

      let errorMessage = `Error al comunicarse con OpenRouter (${response.status}).`
      if (response.status === 401) {
        errorMessage += ' La API key no es válida o ha expirado.'
      }
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
    console.log('[Assistant Chat] OpenRouter response received')

    const data = await response.json()
    const assistantMessage = data.choices?.[0]?.message

    if (!assistantMessage) {
      return NextResponse.json({
        error: 'No response from AI service',
      }, { status: 500 })
    }

    // Check if there are tool calls to process
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = []
      let pendingAction = null

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name
        const args = JSON.parse(toolCall.function.arguments || '{}')

        let result: unknown

        switch (functionName) {
          case 'get_project_context':
            result = projectId
              ? await handleGetProjectContext(projectId, args, adminClient)
              : { error: 'No project selected' }
            break

          case 'list_playbooks':
            result = handleListPlaybooks()
            break

          case 'get_playbook_status':
            result = projectId
              ? await handleGetPlaybookStatus(projectId, args.playbook_type, adminClient)
              : { error: 'No project selected' }
            break

          case 'explain_step':
            result = handleExplainStep(args.playbook_type, args.step_id)
            break

          case 'request_execute_step':
            // Set pending action for UI to show confirmation
            pendingAction = {
              type: 'execute_step',
              stepId: args.step_id,
              stepName: args.step_name,
              playbookType: args.playbook_type,
            }
            result = { status: 'confirmation_required', message: `Solicitando confirmación para ejecutar: ${args.step_name}` }
            break

          case 'request_start_playbook':
            pendingAction = {
              type: 'start_playbook',
              playbookType: args.playbook_type,
              playbookName: args.playbook_name,
            }
            result = { status: 'confirmation_required', message: `Solicitando confirmación para iniciar: ${args.playbook_name}` }
            break

          default:
            result = { error: `Unknown tool: ${functionName}` }
        }

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        })
      }

      // Second LLM call with tool results
      const followUpMessages = [
        ...llmMessages,
        assistantMessage,
        ...toolResults,
      ]

      const followUpResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Gattaca Assistant',
        },
        body: JSON.stringify({
          model: ASSISTANT_MODEL,
          messages: followUpMessages,
          max_tokens: 1024,
          temperature: 0.7,
        }),
      })

      if (!followUpResponse.ok) {
        const errorData = await followUpResponse.text()
        console.error('[Assistant] Follow-up error:', errorData)
        return NextResponse.json({
          error: 'Error processing tool results',
        }, { status: 500 })
      }

      const followUpData = await followUpResponse.json()
      const finalContent = followUpData.choices?.[0]?.message?.content || 'Lo siento, no pude procesar tu solicitud.'

      return NextResponse.json({
        content: finalContent,
        pendingAction,
      })
    }

    // No tool calls, return direct response
    return NextResponse.json({
      content: assistantMessage.content || 'Lo siento, no pude generar una respuesta.',
    })

  } catch (error) {
    console.error('[Assistant] Error:', error)
    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 })
  }
}
