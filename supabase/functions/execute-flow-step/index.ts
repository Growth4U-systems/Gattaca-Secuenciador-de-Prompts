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
  // Campos opcionales para Deep Research
  thinkingSummaries?: string[]
  interactionId?: string
}

// Interfaz para estado de interacción Deep Research
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
    type?: 'thought' | 'text' | 'plan' | 'search' | 'result'
    text?: string
    thinkingSummary?: string
    content?: string
  }>
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
  const isReasoningModel = model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')

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

// Callback para reportar progreso de Deep Research
type ProgressCallback = (progress: {
  state: string
  thinkingSummaries: string[]
  currentAction?: string
  elapsedSeconds: number
}) => Promise<void>

// Llamar a Google Deep Research API (Interactions API con polling)
// IMPORTANTE: Deep Research es un agente autónomo que usa un flujo diferente:
// 1. Crear interacción → 2. Polling hasta completar → 3. Recuperar resultado
// NOTA: Este modelo SOLO soporta Interactions API v1alpha, NO generateContent
// SDK: google-genai>=0.1.0 con api_version='v1alpha'
async function callDeepResearch(
  apiKey: string,
  model: string,
  systemPrompt: string,
  context: string,
  userPrompt: string,
  onProgress?: ProgressCallback
): Promise<LLMResponse> {
  const POLLING_INTERVAL_MS = 20_000  // 20 segundos entre cada poll
  const MAX_TIMEOUT_MS = 12 * 60 * 1000  // 12 minutos máximo (dentro del límite de Vercel Pro)

  // Construir el prompt completo para Deep Research (input debe ser string directo)
  const fullPrompt = `${systemPrompt}\n\n${context}\n\n--- TASK ---\n\n${userPrompt}`

  console.log(`[Deep Research] Iniciando investigación con modelo: ${model}`)
  console.log(`[Deep Research] Prompt length: ${fullPrompt.length} caracteres`)

  // 1. CREAR INTERACCIÓN usando la Interactions API v1alpha
  // Formato simplificado sin campo config (no soportado en REST API)
  const interactionsUrl = `https://generativelanguage.googleapis.com/v1alpha/interactions?key=${apiKey}`

  const requestBody = {
    agent: model,  // Modelo como string directo
    background: true,  // Ejecución asíncrona en background
    input: fullPrompt  // Input como string directo
  }

  console.log(`[Deep Research] Creando interacción v1alpha`)
  console.log(`[Deep Research] Request body:`, JSON.stringify({ agent: model, background: true, input: '...' }))

  const createResponse = await fetch(interactionsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })

  if (!createResponse.ok) {
    const errorText = await createResponse.text()
    console.log(`[Deep Research] Error en v1alpha/interactions: ${errorText}`)

    // Segundo intento: usar models/{model}:createInteraction en v1alpha
    console.log(`[Deep Research] Intentando endpoint models/createInteraction...`)
    const altUrl = `https://generativelanguage.googleapis.com/v1alpha/models/${model}:createInteraction?key=${apiKey}`

    const altResponse = await fetch(altUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        background: true,
        input: fullPrompt
      })
    })

    if (!altResponse.ok) {
      const altError = await altResponse.text()
      console.log(`[Deep Research] Error en createInteraction: ${altError}`)

      // Tercer intento: formato alternativo con userInput
      console.log(`[Deep Research] Intentando formato con userInput...`)
      const thirdUrl = `https://generativelanguage.googleapis.com/v1alpha/interactions?key=${apiKey}`

      const thirdResponse = await fetch(thirdUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: `models/${model}`,  // Con prefijo models/
          background: true,
          userInput: fullPrompt  // Campo alternativo
        })
      })

      if (!thirdResponse.ok) {
        const thirdError = await thirdResponse.text()

        // Cuarto intento: formato con contents (v1alpha)
        console.log(`[Deep Research] Intentando formato con contents...`)
        const fourthUrl = `https://generativelanguage.googleapis.com/v1alpha/interactions?key=${apiKey}`

        const fourthResponse = await fetch(fourthUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent: model,
            background: true,
            contents: [{
              role: 'user',
              parts: [{ text: fullPrompt }]
            }]
          })
        })

        if (!fourthResponse.ok) {
          const fourthError = await fourthResponse.text()
          throw new Error(`Deep Research API error: No se pudo crear la interacción.\n- v1alpha/interactions (input): ${errorText}\n- models/createInteraction: ${altError}\n- v1alpha (userInput): ${thirdError}\n- v1alpha (contents): ${fourthError}`)
        }

        const fourthData = await fourthResponse.json()
        return handleInteractionResponse(fourthData, apiKey, fullPrompt, model, onProgress)
      }

      const thirdData = await thirdResponse.json()
      return handleInteractionResponse(thirdData, apiKey, fullPrompt, model, onProgress)
    }

    const altData = await altResponse.json()
    return handleInteractionResponse(altData, apiKey, fullPrompt, model, onProgress)
  }

  const interactionData = await createResponse.json()
  return handleInteractionResponse(interactionData, apiKey, fullPrompt, model, onProgress)
}

// Manejar respuesta de interacción (polling si es necesario)
async function handleInteractionResponse(
  data: any,
  apiKey: string,
  fullPrompt: string,
  model: string,
  onProgress?: ProgressCallback
): Promise<LLMResponse> {
  const POLLING_INTERVAL_MS = 20_000
  const MAX_TIMEOUT_MS = 12 * 60 * 1000 // 12 minutos para respetar límite Vercel Pro

  // Si la respuesta ya tiene el texto completo (síncrono)
  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    const resultText = data.candidates[0].content.parts[0].text
    console.log(`[Deep Research] Respuesta síncrona recibida`)
    return {
      text: resultText,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || Math.ceil(fullPrompt.length / 4),
        completionTokens: data.usageMetadata?.candidatesTokenCount || Math.ceil(resultText.length / 4)
      },
      model
    }
  }

  // Si es una interacción async, obtener el nombre/ID
  const interactionName = data.name || data.interactionName || data.id

  if (!interactionName) {
    // Si no hay ID pero hay respuesta directa, intentar extraerla
    if (data.response?.text) {
      return {
        text: data.response.text,
        usage: {
          promptTokens: Math.ceil(fullPrompt.length / 4),
          completionTokens: Math.ceil(data.response.text.length / 4)
        },
        model
      }
    }

    console.log(`[Deep Research] Respuesta completa:`, JSON.stringify(data, null, 2))
    throw new Error('Deep Research: No se recibió ID de interacción ni respuesta directa')
  }

  console.log(`[Deep Research] Interacción creada: ${interactionName}`)

  // LOOP DE POLLING
  const startTime = Date.now()
  const thinkingSummaries: string[] = []
  let lastState = ''

  while (true) {
    if (Date.now() - startTime > MAX_TIMEOUT_MS) {
      throw new Error(`Deep Research: Timeout después de ${MAX_TIMEOUT_MS / 60000} minutos. Interaction ID: ${interactionName}`)
    }

    // Consultar estado - usar v1alpha (requerido para Deep Research)
    let statusUrl = interactionName.startsWith('http')
      ? `${interactionName}?key=${apiKey}`
      : interactionName.includes('/')
        ? `https://generativelanguage.googleapis.com/v1alpha/${interactionName}?key=${apiKey}`
        : `https://generativelanguage.googleapis.com/v1alpha/interactions/${interactionName}?key=${apiKey}`

    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!statusResponse.ok) {
      const statusError = await statusResponse.text()
      throw new Error(`Deep Research polling error: ${statusError}`)
    }

    const statusData = await statusResponse.json() as DeepResearchInteraction

    if (statusData.state && statusData.state !== lastState) {
      console.log(`[Deep Research] Estado: ${statusData.state}`)
      lastState = statusData.state
    }

    // Capturar thinking summaries y outputs de tipo 'thought'
    if (statusData.outputs) {
      for (const output of statusData.outputs) {
        // Capturar thinkingSummary si existe
        if (output.thinkingSummary && !thinkingSummaries.includes(output.thinkingSummary)) {
          thinkingSummaries.push(output.thinkingSummary)
          console.log(`[Deep Research] 💭 Thinking: ${output.thinkingSummary.substring(0, 150)}...`)
        }

        // Capturar outputs de tipo 'thought' (plan de investigación)
        if (output.type === 'thought' && output.text && !thinkingSummaries.includes(output.text)) {
          thinkingSummaries.push(output.text)
          console.log(`[Deep Research] 📋 Plan: ${output.text.substring(0, 150)}...`)
        }

        // Capturar outputs de tipo 'search' (búsquedas realizadas)
        if (output.type === 'search' && output.text) {
          console.log(`[Deep Research] 🔍 Búsqueda: ${output.text.substring(0, 100)}`)
        }

        // Capturar contenido directo si existe
        if (output.content && !thinkingSummaries.includes(output.content)) {
          thinkingSummaries.push(output.content)
          console.log(`[Deep Research] 📝 Output: ${output.content.substring(0, 150)}...`)
        }
      }
    }

    // Reportar progreso si hay callback
    if (onProgress) {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
      const lastOutput = statusData.outputs?.[statusData.outputs.length - 1]
      const currentAction = lastOutput?.type === 'search' ? `🔍 ${lastOutput.text?.substring(0, 50)}...` : undefined

      await onProgress({
        state: statusData.state || 'PROCESSING',
        thinkingSummaries: [...thinkingSummaries],
        currentAction,
        elapsedSeconds
      })
    }

    // Verificar si completó
    if (statusData.state === 'COMPLETED') {
      let resultText = ''

      // Debug: log response structure
      console.log(`[Deep Research] COMPLETED - Response structure:`, JSON.stringify({
        hasResponse: !!statusData.response,
        responseText: statusData.response?.text?.substring(0, 200),
        outputsCount: statusData.outputs?.length || 0,
        lastOutputType: statusData.outputs?.[statusData.outputs.length - 1]?.type,
        lastOutputHasText: !!statusData.outputs?.[statusData.outputs.length - 1]?.text
      }))

      // Try multiple extraction methods
      if (statusData.response?.text) {
        resultText = statusData.response.text
        console.log(`[Deep Research] Result from response.text: ${resultText.length} chars`)
      } else if (statusData.outputs && statusData.outputs.length > 0) {
        // Look for 'report' or 'response' type outputs first
        for (const output of statusData.outputs) {
          if ((output.type === 'report' || output.type === 'response') && output.text) {
            resultText = output.text
            console.log(`[Deep Research] Result from output type=${output.type}: ${resultText.length} chars`)
            break
          }
        }
        // Fallback to last output with text
        if (!resultText) {
          for (let i = statusData.outputs.length - 1; i >= 0; i--) {
            if (statusData.outputs[i].text && statusData.outputs[i].type !== 'thought' && statusData.outputs[i].type !== 'search') {
              resultText = statusData.outputs[i].text!
              console.log(`[Deep Research] Result from output[${i}] type=${statusData.outputs[i].type}: ${resultText.length} chars`)
              break
            }
          }
        }
      }

      // If still no result, log full response for debugging
      if (!resultText) {
        console.log(`[Deep Research] WARNING: No result text found. Full response:`, JSON.stringify(statusData, null, 2))
      }

      const duration = (Date.now() - startTime) / 1000
      console.log(`[Deep Research] Completado en ${duration.toFixed(1)}s - Result: ${resultText.length} chars`)

      return {
        text: resultText,
        usage: {
          promptTokens: Math.ceil(fullPrompt.length / 4),
          completionTokens: Math.ceil(resultText.length / 4)
        },
        model,
        thinkingSummaries,
        interactionId: interactionName
      }
    }

    if (statusData.state === 'FAILED') {
      const errorMsg = statusData.error?.message || 'Error desconocido en Deep Research'
      throw new Error(`Deep Research failed: ${errorMsg}. Interaction ID: ${interactionName}`)
    }

    await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS))
  }
}

// Ejecutar modelo (SIN fallback automático - el usuario elige si reintentar)
async function executeModel(
  systemPrompt: string,
  context: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
  preferredModel: string,
  onProgress?: ProgressCallback
): Promise<LLMResponse> {
  // API Keys - Deep Research usa la misma key que Gemini (GOOGLE_API_KEY)
  const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('ANTHROPIC_KEY')

  const provider = getProvider(preferredModel)
  console.log(`Executing with ${provider}/${preferredModel}...`)

  // Verificar que tenemos la API key necesaria
  if ((provider === 'gemini' || provider === 'deep-research') && !geminiKey) {
    throw new Error(`No API key configured for ${provider}. Please add GOOGLE_API_KEY or GEMINI_API_KEY.`)
  }
  if (provider === 'openai' && !openaiKey) {
    throw new Error(`No API key configured for OpenAI. Please add OPENAI_API_KEY.`)
  }
  if (provider === 'anthropic' && !anthropicKey) {
    throw new Error(`No API key configured for Anthropic. Please add ANTHROPIC_API_KEY.`)
  }

  // Ejecutar el modelo seleccionado (sin fallback)
  if (provider === 'deep-research') {
    // Deep Research: agente autónomo con Interactions API (no usa temperature/maxTokens de la misma forma)
    console.log(`[Deep Research] NOTA: Este modelo puede tardar 5-10 minutos en completar la investigación`)
    return await callDeepResearch(geminiKey!, preferredModel, systemPrompt, context, userPrompt, onProgress)
  } else if (provider === 'gemini') {
    return await callGemini(geminiKey!, preferredModel, systemPrompt, context, userPrompt, temperature, maxTokens)
  } else if (provider === 'openai') {
    return await callOpenAI(openaiKey!, preferredModel, systemPrompt, context, userPrompt, temperature, maxTokens)
  } else if (provider === 'anthropic') {
    return await callAnthropic(anthropicKey!, preferredModel, systemPrompt, context, userPrompt, temperature, maxTokens)
  }

  throw new Error(`Unknown provider for model: ${preferredModel}`)
}

function getProvider(model: string): string {
  if (model.startsWith('deep-research')) return 'deep-research'
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

    // Callback para Deep Research progress
    const isDeepResearch = preferredModel.startsWith('deep-research')
    const onProgress: ProgressCallback | undefined = isDeepResearch ? async (progress) => {
      // Guardar progreso en execution_logs
      await supabase
        .from('execution_logs')
        .update({
          status: 'running',
          error_details: JSON.stringify({
            type: 'deep_research_progress',
            state: progress.state,
            elapsedSeconds: progress.elapsedSeconds,
            thinkingSummaries: progress.thinkingSummaries.slice(-5), // Últimos 5
            currentAction: progress.currentAction
          })
        })
        .eq('id', logEntry.id)
    } : undefined

    const llmResponse = await executeModel(
      SYSTEM_INSTRUCTION,
      contextString,
      promptWithFormat,
      temperature,
      maxTokens,
      preferredModel,
      onProgress
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
