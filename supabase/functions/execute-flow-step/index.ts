// Supabase Edge Function: Execute Flow Step (Generic)
// Executes a single step from a dynamic flow configuration

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SYSTEM_INSTRUCTION = `You are a strict strategic analyst.
Your knowledge base is STRICTLY LIMITED to the context provided below.
Do NOT use your internal training data to answer facts about the client or competitors.
If the information is not in the provided documents, explicitly state: "Information not found in the provided documents."`

const TOKEN_LIMIT = 2_000_000

type OutputFormat = 'text' | 'markdown' | 'json' | 'csv' | 'html' | 'xml'

// NOTA: Fallback automático desactivado - el usuario elige manualmente si reintentar con otro modelo

interface LLMResponse {
  text: string
  usage: {
    promptTokens: number
    completionTokens: number
  }
  model: string
}

// Llamar a Gemini API
async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  context: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<LLMResponse> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            parts: [
              { text: context },
              { text: '\n\n--- TASK ---\n\n' + userPrompt },
            ],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error: ${errorText}`)
  }

  const data = await response.json()
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    usage: {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
    },
    model,
  }
}

// Llamar a OpenAI API
async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  context: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<LLMResponse> {
  const isReasoningModel = model.startsWith('o1') || model.startsWith('o3')

  const messages = isReasoningModel
    ? [
        // o1 no soporta system messages, lo incluimos en user
        {
          role: 'user',
          content: `${systemPrompt}\n\n${context}\n\n--- TASK ---\n\n${userPrompt}`,
        },
      ]
    : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${context}\n\n--- TASK ---\n\n${userPrompt}` },
      ]

  const body: any = {
    model,
    messages,
  }

  // o1 no soporta temperature ni max_tokens de la misma forma
  if (!isReasoningModel) {
    body.temperature = temperature
    body.max_tokens = maxTokens
  } else {
    body.max_completion_tokens = maxTokens
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${errorText}`)
  }

  const data = await response.json()
  return {
    text: data.choices?.[0]?.message?.content || '',
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
    },
    model,
  }
}

// Llamar a Anthropic API (Claude)
async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  context: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<LLMResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `${context}\n\n--- TASK ---\n\n${userPrompt}`,
        },
      ],
      temperature,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Anthropic API error: ${errorText}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text || ''

  return {
    text,
    usage: {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || Math.ceil(text.length / 4),
    },
    model,
  }
}

// Ejecutar modelo (SIN fallback automático - el usuario elige si reintentar)
async function executeModel(
  systemPrompt: string,
  context: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
  preferredModel: string
): Promise<LLMResponse> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  const provider = getProvider(preferredModel)
  console.log(`Executing with ${provider}/${preferredModel}...`)

  // Verificar que tenemos la API key necesaria
  if (provider === 'gemini' && !geminiKey) {
    throw new Error(`No API key configured for Gemini. Please add GEMINI_API_KEY.`)
  }
  if (provider === 'openai' && !openaiKey) {
    throw new Error(`No API key configured for OpenAI. Please add OPENAI_API_KEY.`)
  }
  if (provider === 'anthropic' && !anthropicKey) {
    throw new Error(`No API key configured for Anthropic. Please add ANTHROPIC_API_KEY.`)
  }

  // Ejecutar el modelo seleccionado (sin fallback)
  if (provider === 'gemini') {
    return await callGemini(geminiKey!, preferredModel, systemPrompt, context, userPrompt, temperature, maxTokens)
  } else if (provider === 'openai') {
    return await callOpenAI(openaiKey!, preferredModel, systemPrompt, context, userPrompt, temperature, maxTokens)
  } else if (provider === 'anthropic') {
    return await callAnthropic(anthropicKey!, preferredModel, systemPrompt, context, userPrompt, temperature, maxTokens)
  }

  throw new Error(`Unknown provider for model: ${preferredModel}`)
}

function getProvider(model: string): string {
  if (model.startsWith('gemini')) return 'gemini'
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) return 'openai'
  if (model.startsWith('claude')) return 'anthropic'
  if (model.startsWith('llama') || model.startsWith('mixtral')) return 'groq'
  return 'gemini' // default
}

interface FlowStep {
  id: string
  name: string
  prompt: string
  base_doc_ids: string[]
  auto_receive_from: string[]
  output_format?: OutputFormat
  model?: string
  temperature?: number
  max_tokens?: number
}

interface RequestPayload {
  campaign_id: string
  step_config: FlowStep
}

function getFormatInstructions(format: OutputFormat): string {
  switch (format) {
    case 'markdown':
      return 'OUTPUT FORMAT REQUIREMENT: Format your response using Markdown syntax with proper headings (#, ##, ###), lists (- or 1.), **bold**, *italic*, code blocks (```), and tables where appropriate.'
    case 'json':
      return 'OUTPUT FORMAT REQUIREMENT: Format your response as valid JSON. Use proper structure with objects {}, arrays [], strings "", numbers, and booleans. Ensure the JSON is parseable.'
    case 'csv':
      return 'OUTPUT FORMAT REQUIREMENT: Format your response as CSV (Comma-Separated Values). Use the first row for headers, separate columns with commas, and wrap fields containing commas in double quotes.'
    case 'html':
      return `OUTPUT FORMAT REQUIREMENT: Format your response as clean, well-structured HTML suitable for Google Docs import.
Requirements:
- Start with <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Document</title></head><body>
- Use semantic tags: <h1>, <h2>, <h3> for headings
- Use <p> for paragraphs, <ul>/<ol> and <li> for lists
- Use <strong> for bold, <em> for italic
- Use <table>, <thead>, <tbody>, <tr>, <th>, <td> for tables
- Add proper spacing with <br> where needed
- Close with </body></html>
- Keep it clean and professional - Google Docs compatible`
    case 'xml':
      return 'OUTPUT FORMAT REQUIREMENT: Format your response as valid XML. Use proper tag structure with opening and closing tags, attributes where appropriate, and proper nesting.'
    case 'text':
    default:
      return 'OUTPUT FORMAT REQUIREMENT: Format your response as plain text. Use clear paragraphs, simple structure, and avoid special formatting characters.'
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  // Parsear body una sola vez al inicio
  let requestBody: RequestPayload
  try {
    requestBody = await req.json() as RequestPayload
  } catch (parseError) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { campaign_id, step_config } = requestBody

  try {

    if (!campaign_id || !step_config) {
      return new Response(
        JSON.stringify({ error: 'Missing campaign_id or step_config' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Load campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('ecp_campaigns')
      .select('*, projects(*)')
      .eq('id', campaign_id)
      .single()

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const project = campaign.projects
    const startTime = Date.now()

    // Log execution start
    const { data: logEntry } = await supabase
      .from('execution_logs')
      .insert({
        campaign_id: campaign_id,
        step_name: step_config.name,
        status: 'started',
      })
      .select()
      .single()

    // Build context
    let contextString = ''
    let totalTokens = 0

    // 1. Load base documents
    if (step_config.base_doc_ids && step_config.base_doc_ids.length > 0) {
      const { data: docs, error: docsError } = await supabase
        .from('knowledge_base_docs')
        .select('*')
        .in('id', step_config.base_doc_ids)

      if (docsError) {
        throw new Error(`Failed to load documents: ${docsError.message}`)
      }

      for (const doc of docs || []) {
        contextString += `\n--- START DOCUMENT: ${doc.filename} (${doc.category}) ---\n`
        contextString += doc.extracted_content
        contextString += `\n--- END DOCUMENT ---\n`
        totalTokens += doc.token_count || 0
      }
    }

    // 2. Load outputs from previous steps
    if (step_config.auto_receive_from && step_config.auto_receive_from.length > 0) {
      const stepOutputs = campaign.step_outputs || {}

      for (const prevStepId of step_config.auto_receive_from) {
        const prevOutput = stepOutputs[prevStepId]
        if (prevOutput && prevOutput.output) {
          contextString += `\n--- START PREVIOUS STEP: ${prevOutput.step_name || prevStepId} ---\n`
          contextString += prevOutput.output
          contextString += `\n--- END PREVIOUS STEP ---\n`
          totalTokens += prevOutput.tokens || Math.ceil(prevOutput.output.length / 4)
        }
      }
    }

    // Check token limit
    if (totalTokens > TOKEN_LIMIT) {
      await supabase
        .from('execution_logs')
        .update({
          status: 'error',
          error_details: `Context exceeds token limit: ${totalTokens} > ${TOKEN_LIMIT}`,
          duration_ms: Date.now() - startTime,
        })
        .eq('id', logEntry.id)

      return new Response(
        JSON.stringify({
          error: 'Context exceeds token limit',
          totalTokens,
          limit: TOKEN_LIMIT,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Replace variables in prompt
    let finalPrompt = step_config.prompt
      .replace(/\{\{ecp_name\}\}/g, campaign.ecp_name || '')
      .replace(/\{\{problem_core\}\}/g, campaign.problem_core || '')
      .replace(/\{\{country\}\}/g, campaign.country || '')
      .replace(/\{\{industry\}\}/g, campaign.industry || '')
      .replace(/\{\{client_name\}\}/g, project.name || '')

    // Replace custom variables
    const customVariables = campaign.custom_variables || {}
    for (const [key, value] of Object.entries(customVariables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      finalPrompt = finalPrompt.replace(regex, String(value))
    }

    // Add output format instructions if specified
    const outputFormat = step_config.output_format || 'text'
    const formatInstructions = getFormatInstructions(outputFormat)
    const promptWithFormat = finalPrompt + '\n\n' + formatInstructions

    // Call LLM (sin fallback automático - el usuario elige reintentar con otro modelo)
    const preferredModel = step_config.model || 'gemini-2.5-flash'
    const temperature = step_config.temperature || 0.7
    const maxTokens = step_config.max_tokens || 8192

    console.log(`Executing step "${step_config.name}" with model: ${preferredModel}`)

    const llmResponse = await executeModel(
      SYSTEM_INSTRUCTION,
      contextString,
      promptWithFormat,
      temperature,
      maxTokens,
      preferredModel
    )

    const outputText = llmResponse.text
    const modelUsed = llmResponse.model
    const usage = llmResponse.usage
    const outputTokens = usage.completionTokens || Math.ceil(outputText.length / 4)

    console.log(`Step completed using model: ${modelUsed}`)

    // Save output to campaign.step_outputs
    const currentStepOutputs = campaign.step_outputs || {}
    currentStepOutputs[step_config.id] = {
      step_name: step_config.name,
      output: outputText,
      tokens: outputTokens,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }

    await supabase
      .from('ecp_campaigns')
      .update({
        step_outputs: currentStepOutputs,
      })
      .eq('id', campaign_id)

    // Log completion
    const duration = Date.now() - startTime
    await supabase
      .from('execution_logs')
      .update({
        status: 'completed',
        input_tokens: usage.promptTokens || totalTokens,
        output_tokens: usage.completionTokens || outputTokens,
        duration_ms: duration,
        model_used: modelUsed,
      })
      .eq('id', logEntry.id)

    return new Response(
      JSON.stringify({
        success: true,
        output: outputText,
        model_used: modelUsed,
        tokens: {
          input: usage.promptTokens || totalTokens,
          output: usage.completionTokens || outputTokens,
          total: (usage.promptTokens || totalTokens) + (usage.completionTokens || outputTokens),
        },
        duration_ms: duration,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Edge function error:', error)

    // Usar step_config del body ya parseado
    const failedModel = step_config?.model || 'gemini-2.5-flash'

    return new Response(
      JSON.stringify({
        error: error.message,
        failed_model: failedModel,
        can_retry: true,  // Indica al frontend que puede reintentar con otro modelo
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
