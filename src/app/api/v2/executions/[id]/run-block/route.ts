import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 120 // 2 minutes for AI calls

// Default models for each provider via OpenRouter (Updated Jan 2026)
const DEFAULT_MODELS = {
  anthropic: 'anthropic/claude-sonnet-4.5',    // Claude 4.5 Sonnet - fast & capable
  openai: 'openai/gpt-5.1',                    // GPT-5.1 - excellent balance
  google: 'google/gemini-3.0-flash',           // Gemini 3.0 Flash - fast agentic
  meta: 'meta-llama/llama-4-scout',            // Llama 4 Scout - efficient
  deepseek: 'deepseek/deepseek-v3.2',          // DeepSeek V3.2 - affordable
  xai: 'x-ai/grok-3',                          // Grok 3 - fast reasoning
} as const

function getSupabaseClient() {
  return createClient(
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

// Initialize OpenRouter client (OpenAI-compatible)
function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured. Add it to your .env.local file.')

  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Gattaca',
    },
  })
}

// Replace variables in prompt
function replaceVariables(
  prompt: string,
  inputData: Record<string, any>,
  blockOutputs: Record<string, any>,
  blocks: any[]
): string {
  let result = prompt

  // Replace input variables {{fieldName}}
  Object.entries(inputData).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(regex, String(value || ''))
  })

  // Replace step outputs {{step:BlockName}}
  blocks.forEach((block) => {
    const blockOutput = blockOutputs[block.id]
    if (blockOutput?.output) {
      const regex = new RegExp(`\\{\\{step:${block.name}\\}\\}`, 'g')
      result = result.replace(regex, blockOutput.output)
    }
  })

  return result
}

// Get context documents for playbook execution
// Prioritizes synthesized foundational documents over raw source documents
async function getContextDocuments(
  supabase: ReturnType<typeof getSupabaseClient>,
  clientId: string,
  tiers: number[]
): Promise<{ title: string; content: string; tier: number; type: string }[]> {
  // 1. Get synthesized foundational documents (approved only)
  const { data: synthesized } = await supabase
    .from('documents')
    .select('id, title, content, tier, document_type')
    .eq('client_id', clientId)
    .eq('is_compiled_foundational', true)
    .eq('approval_status', 'approved')
    .in('tier', tiers)

  // 2. Get IDs of documents that are sources for synthesis
  // (we want to avoid including raw sources when we have synthesized versions)
  const { data: assignments } = await supabase
    .from('document_assignments')
    .select('source_document_id')
    .eq('client_id', clientId)

  const usedSourceIds = new Set(assignments?.map(a => a.source_document_id) || [])

  // 3. Get other approved documents that are NOT sources for synthesis
  // and are NOT foundational synthesized docs (already fetched above)
  const { data: regular } = await supabase
    .from('documents')
    .select('id, title, content, tier, document_type')
    .eq('client_id', clientId)
    .eq('approval_status', 'approved')
    .eq('is_compiled_foundational', false)
    .in('tier', tiers)

  // Filter out docs that are used as sources (their content is in synthesized docs)
  const filteredRegular = (regular || []).filter(d => !usedSourceIds.has(d.id))

  // 4. Combine: synthesized first (more authoritative), then regular
  const allDocs = [
    ...(synthesized || []).map(d => ({
      title: d.title,
      content: d.content || '',
      tier: d.tier,
      type: d.document_type,
    })),
    ...filteredRegular.map(d => ({
      title: d.title,
      content: d.content || '',
      tier: d.tier,
      type: d.document_type,
    })),
  ]

  return allDocs
}

// Normalize model name for OpenRouter
function normalizeModel(provider: string, model: string): string {
  // If model already has provider prefix, return as-is
  if (model.includes('/')) {
    return model
  }

  // Map provider + model to OpenRouter format
  const providerMap: Record<string, string> = {
    anthropic: 'anthropic',
    openai: 'openai',
    google: 'google',
    gemini: 'google',
    meta: 'meta-llama',
    deepseek: 'deepseek',
  }

  const prefix = providerMap[provider] || provider
  return `${prefix}/${model}`
}

// Call AI via OpenRouter
async function callAI(
  provider: string,
  model: string,
  prompt: string,
  systemPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<{ output: string; inputTokens: number; outputTokens: number; modelUsed: string }> {
  const client = getOpenRouterClient()

  // Get the model to use
  const defaultModel = DEFAULT_MODELS[provider as keyof typeof DEFAULT_MODELS] || DEFAULT_MODELS.google
  const modelToUse = model ? normalizeModel(provider, model) : defaultModel

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })

  const response = await client.chat.completions.create({
    model: modelToUse,
    messages,
    temperature,
    max_tokens: maxTokens,
  })

  const text = response.choices[0]?.message?.content || ''
  return {
    output: text,
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
    modelUsed: modelToUse,
  }
}

/**
 * POST /api/v2/executions/[id]/run-block
 * Ejecuta el bloque actual de una ejecución.
 * Usa OpenRouter para acceder a todos los modelos de IA.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient()

    // Get the execution
    const { data: execution, error: execError } = await supabase
      .from('playbook_executions')
      .select('*')
      .eq('id', params.id)
      .single()

    if (execError) {
      if (execError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
      }
      throw execError
    }

    // Check status
    if (!['pending', 'running'].includes(execution.status)) {
      return NextResponse.json(
        { error: `Execution is ${execution.status}, cannot run block` },
        { status: 400 }
      )
    }

    // Get the playbook
    const { data: playbook, error: playbookError } = await supabase
      .from('playbooks')
      .select('*')
      .eq('id', execution.playbook_id)
      .single()

    if (playbookError) {
      throw playbookError
    }

    const blocks = playbook.config.blocks || []
    const currentBlockId = execution.current_block_id
    const currentBlockIndex = blocks.findIndex((b: any) => b.id === currentBlockId)

    if (currentBlockIndex === -1) {
      return NextResponse.json({ error: 'Current block not found' }, { status: 400 })
    }

    const currentBlock = blocks[currentBlockIndex]
    const blockOutputs = { ...execution.block_outputs }

    // Mark execution as running
    if (execution.status !== 'running') {
      await supabase
        .from('playbook_executions')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', params.id)
    }

    // Mark current block as running
    blockOutputs[currentBlockId] = {
      ...blockOutputs[currentBlockId],
      status: 'running',
      started_at: new Date().toISOString(),
    }

    await supabase
      .from('playbook_executions')
      .update({ block_outputs: blockOutputs })
      .eq('id', params.id)

    try {
      // Handle different block types
      if (currentBlock.type === 'prompt') {
        // Get context documents using the new prioritized function
        // This prioritizes synthesized foundational documents over raw sources
        let contextDocs = ''
        if (currentBlock.context_tiers && currentBlock.context_tiers.length > 0) {
          const docs = await getContextDocuments(
            supabase,
            execution.client_id,
            currentBlock.context_tiers
          )

          if (docs.length > 0) {
            contextDocs = docs
              .map((d) => `## ${d.title} (Tier ${d.tier})\n${d.content}`)
              .join('\n\n---\n\n')
          }
        }

        // Build the prompt with variables
        const rawPrompt = currentBlock.prompt || ''
        const processedPrompt = replaceVariables(
          rawPrompt,
          execution.input_data,
          blockOutputs,
          blocks
        )

        // Build system prompt with context
        let systemPrompt = ''
        if (contextDocs) {
          systemPrompt = `Tienes acceso a los siguientes documentos de contexto:\n\n${contextDocs}\n\nUsa esta información para responder de manera precisa y alineada con la marca.`
        }

        // Call the AI via OpenRouter
        const provider = currentBlock.provider || 'google'
        const model = currentBlock.model || ''
        const temperature = currentBlock.temperature ?? 0.7
        const maxTokens = currentBlock.max_tokens || 4096

        const result = await callAI(
          provider,
          model,
          processedPrompt,
          systemPrompt,
          temperature,
          maxTokens
        )

        // Update block output
        blockOutputs[currentBlockId] = {
          output: result.output,
          tokens: { input: result.inputTokens, output: result.outputTokens },
          status: 'completed',
          model_used: result.modelUsed,
          started_at: blockOutputs[currentBlockId].started_at,
          completed_at: new Date().toISOString(),
        }
      } else if (currentBlock.type === 'human_review') {
        // Mark as waiting for human
        blockOutputs[currentBlockId] = {
          ...blockOutputs[currentBlockId],
          status: 'waiting',
        }

        await supabase
          .from('playbook_executions')
          .update({
            status: 'waiting_human',
            hitl_pending: {
              block_id: currentBlockId,
              block_name: currentBlock.name,
              interface_type: currentBlock.hitl_config?.interface_type || 'approve_reject',
              prompt: currentBlock.hitl_config?.prompt,
              timeout_hours: currentBlock.hitl_config?.timeout_hours || 24,
              requested_at: new Date().toISOString(),
            },
            block_outputs: blockOutputs,
          })
          .eq('id', params.id)

        return NextResponse.json({
          success: true,
          status: 'waiting_human',
          message: 'Waiting for human review',
          block: currentBlock,
        })
      } else if (currentBlock.type === 'conditional') {
        // Evaluate condition (simplified - just mark as completed for now)
        blockOutputs[currentBlockId] = {
          output: 'Condition evaluated',
          status: 'completed',
          completed_at: new Date().toISOString(),
        }
      } else if (currentBlock.type === 'loop') {
        // Loop handling (simplified)
        blockOutputs[currentBlockId] = {
          output: 'Loop completed',
          status: 'completed',
          completed_at: new Date().toISOString(),
        }
      }

      // Move to next block or complete
      const nextBlockIndex = currentBlockIndex + 1
      const isComplete = nextBlockIndex >= blocks.length

      if (isComplete) {
        await supabase
          .from('playbook_executions')
          .update({
            status: 'completed',
            block_outputs: blockOutputs,
            current_block_id: null,
            completed_at: new Date().toISOString(),
          })
          .eq('id', params.id)

        return NextResponse.json({
          success: true,
          status: 'completed',
          message: 'Execution completed',
          blockOutput: blockOutputs[currentBlockId],
        })
      } else {
        const nextBlock = blocks[nextBlockIndex]
        await supabase
          .from('playbook_executions')
          .update({
            block_outputs: blockOutputs,
            current_block_id: nextBlock.id,
          })
          .eq('id', params.id)

        return NextResponse.json({
          success: true,
          status: 'running',
          message: 'Block completed, moving to next',
          blockOutput: blockOutputs[currentBlockId],
          nextBlock: nextBlock,
        })
      }
    } catch (blockError: any) {
      // Block execution failed
      blockOutputs[currentBlockId] = {
        ...blockOutputs[currentBlockId],
        status: 'error',
        error_message: blockError.message,
        completed_at: new Date().toISOString(),
      }

      await supabase
        .from('playbook_executions')
        .update({
          status: 'failed',
          block_outputs: blockOutputs,
          error_message: `Block "${currentBlock.name}" failed: ${blockError.message}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', params.id)

      return NextResponse.json({
        success: false,
        error: blockError.message,
        block: currentBlock.name,
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Run block error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
