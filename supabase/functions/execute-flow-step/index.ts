// Supabase Edge Function: Execute Flow Step (Generic)
// Executes a single step from a dynamic flow configuration
// Now uses OpenRouter as the unified LLM provider (except Deep Research)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// ============================================================================
// ENCRYPTION UTILITIES (for decrypting user's OpenRouter API key)
// ============================================================================

const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get('ENCRYPTION_KEY')
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  if (keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }

  // Convert hex to Uint8Array
  const keyBytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(keyHex.substr(i * 2, 2), 16)
  }

  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: ALGORITHM },
    false,
    ['decrypt']
  )
}

async function decryptToken(encryptedData: string): Promise<string> {
  const key = await getEncryptionKey()

  // Decode base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted data: too short')
  }

  // Format from Node.js: iv (16) + authTag (16) + ciphertext
  // Web Crypto API expects: iv + ciphertext + authTag (authTag at the end)
  const iv = combined.slice(0, IV_LENGTH)
  const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH)

  // Reorder for Web Crypto: ciphertext + authTag
  const ciphertextWithTag = new Uint8Array(ciphertext.length + authTag.length)
  ciphertextWithTag.set(ciphertext, 0)
  ciphertextWithTag.set(authTag, ciphertext.length)

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: AUTH_TAG_LENGTH * 8 },
    key,
    ciphertextWithTag
  )

  return new TextDecoder().decode(decrypted)
}

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

// Respuesta asíncrona para Deep Research (cuando no podemos hacer polling en Edge Function)
interface AsyncDeepResearchResponse {
  async_polling_required: true
  interaction_id: string
  model: string
  prompt_tokens: number
}

// Crear interacción de Deep Research SIN hacer polling (retorna inmediatamente)
// Esto permite que la Edge Function termine rápido y el polling se haga desde otro lugar
async function createDeepResearchInteraction(
  apiKey: string,
  model: string,
  systemPrompt: string,
  context: string,
  userPrompt: string
): Promise<AsyncDeepResearchResponse> {
  // Build comprehensive prompt for Deep Research with explicit instructions for EXTENSIVE output
  // Deep Research can generate very long reports - we want maximum depth and detail
  const fullPrompt = `# Deep Research Request

## Instructions
${systemPrompt}

## Context Documents
${context}

## Research Task
${userPrompt}

## CRITICAL OUTPUT REQUIREMENTS

You are conducting an in-depth research project. Your output must be a COMPREHENSIVE RESEARCH REPORT of at least 10,000 words (approximately 20+ pages).

### Length & Depth Requirements:
- MINIMUM 10,000 words - this is NON-NEGOTIABLE
- Each major section should be 1,000-2,000 words minimum
- Include detailed subsections within each section
- Do NOT summarize or abbreviate - expand and elaborate on every point
- If you find yourself being brief, STOP and add more detail, examples, and analysis

### Structure Requirements:
- Executive Summary (500+ words)
- Table of Contents
- 8-12 major sections with detailed analysis
- Each section must have 3-5 subsections minimum
- Include data tables, comparisons, and structured lists
- Comprehensive Sources section with 30+ citations

### Content Requirements:
- Exhaustive analysis of every aspect mentioned in the research task
- Multiple perspectives and viewpoints on each topic
- Historical context where relevant
- Current state analysis with specific data points
- Future projections and trends
- Competitive landscape analysis
- Detailed case studies or examples (3-5 minimum)
- Direct quotes from sources
- Statistical data and metrics
- Strategic recommendations with implementation details

### Quality Indicators:
- The report should feel like a professional consulting deliverable
- No section should feel rushed or superficial
- Every claim must be supported by evidence and citations
- Include nuanced analysis, not just surface-level observations

Remember: A short report is a FAILED report. Aim for depth, not brevity.`

  const promptTokens = Math.ceil(fullPrompt.length / 4)

  console.log(`[Deep Research Async] Creando interacción para modelo: ${model}`)
  console.log(`[Deep Research Async] Prompt length: ${fullPrompt.length} caracteres`)

  const interactionsUrl = `https://generativelanguage.googleapis.com/v1alpha/interactions?key=${apiKey}`

  const requestBody = {
    agent: model,
    background: true,
    store: true,  // Required for long-running tasks according to Google docs
    input: fullPrompt
  }

  const createResponse = await fetch(interactionsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })

  if (!createResponse.ok) {
    const errorText = await createResponse.text()
    console.log(`[Deep Research Async] Error: ${errorText}`)
    throw new Error(`Deep Research API error: ${errorText}`)
  }

  const data = await createResponse.json()
  const interactionId = data.name || data.interactionName || data.id

  if (!interactionId) {
    console.log(`[Deep Research Async] Respuesta sin ID:`, JSON.stringify(data))
    throw new Error('Deep Research: No se recibió ID de interacción')
  }

  console.log(`[Deep Research Async] Interacción creada: ${interactionId}`)

  return {
    async_polling_required: true,
    interaction_id: interactionId,
    model,
    prompt_tokens: promptTokens
  }
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

// ============================================================================
// OPENROUTER API (Unified LLM Provider)
// ============================================================================

// Map internal model names to OpenRouter model IDs
function mapToOpenRouterModel(model: string): string {
  // If model already contains '/', it's already in OpenRouter format (e.g., "google/gemini-2.0-flash-exp:free")
  if (model.includes('/')) {
    return model
  }

  // Legacy internal model names -> OpenRouter format
  // Gemini models
  if (model === 'gemini-3.0-pro-preview') return 'google/gemini-2.0-flash-thinking-exp-1219:free'
  if (model === 'gemini-2.5-pro') return 'google/gemini-2.5-pro-preview'
  if (model === 'gemini-2.5-flash') return 'google/gemini-2.5-flash-preview'
  if (model === 'gemini-2.5-flash-lite') return 'google/gemini-2.0-flash-lite-001'
  if (model.startsWith('gemini')) return `google/${model}`

  // OpenAI models
  if (model === 'gpt-5.2' || model === 'gpt-5' || model === 'gpt-5-mini') return 'openai/gpt-4o'
  if (model === 'gpt-4.1' || model === 'gpt-4.1-mini') return 'openai/gpt-4o'
  if (model === 'gpt-4o') return 'openai/gpt-4o'
  if (model === 'gpt-4o-mini') return 'openai/gpt-4o-mini'
  if (model === 'o4-mini') return 'openai/o4-mini'
  if (model === 'o3-pro') return 'openai/o3-pro'
  if (model === 'o3') return 'openai/o3'
  if (model === 'o3-mini') return 'openai/o3-mini'
  if (model === 'o1') return 'openai/o1'
  if (model === 'o1-mini') return 'openai/o1-mini'
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) {
    return `openai/${model}`
  }

  // Anthropic models
  if (model === 'claude-4.5-opus') return 'anthropic/claude-sonnet-4'
  if (model === 'claude-4.5-sonnet') return 'anthropic/claude-sonnet-4'
  if (model === 'claude-4.5-haiku') return 'anthropic/claude-haiku-3.5'
  if (model.startsWith('claude')) return `anthropic/${model}`

  // Default: return as-is
  return model
}

// Call OpenRouter API
async function callOpenRouter(
  userApiKey: string,
  model: string,
  systemPrompt: string,
  context: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<LLMResponse> {
  const openRouterModel = mapToOpenRouterModel(model)
  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://gatacca.app'

  console.log(`[OpenRouter] Calling model: ${openRouterModel} (original: ${model})`)

  // Check if this is a reasoning model (o1, o3, o4 series)
  const isReasoningModel = model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')

  // Some models don't support system/developer instructions
  const noSystemMessageSupport = isReasoningModel ||
    openRouterModel.includes('gemma-3n') ||
    openRouterModel.includes('gemma-2') ||
    openRouterModel.includes(':free') // Many free models don't support system messages

  if (noSystemMessageSupport) {
    console.log(`[OpenRouter] Model ${openRouterModel} doesn't support system messages - embedding in user message`)
  }

  // Reasoning models and some others don't support system messages
  // They use max_completion_tokens instead of max_tokens
  const messages = noSystemMessageSupport
    ? [
        {
          role: 'user',
          content: `${systemPrompt}\n\n${context}\n\n--- TASK ---\n\n${userPrompt}`,
        },
      ]
    : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${context}\n\n--- TASK ---\n\n${userPrompt}` },
      ]

  const requestBody: any = {
    model: openRouterModel,
    messages,
  }

  // Only add temperature and max_tokens for non-reasoning models
  if (!isReasoningModel) {
    requestBody.temperature = temperature
    requestBody.max_tokens = maxTokens
  } else {
    // Reasoning models use max_completion_tokens
    requestBody.max_completion_tokens = maxTokens
    console.log(`[OpenRouter] Reasoning model detected - using max_completion_tokens, no temperature/system message`)
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userApiKey}`,
      'HTTP-Referer': appUrl,
      'X-Title': 'Gatacca',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[OpenRouter] API error: ${errorText}`)

    // Parse error for friendly message
    let friendlyMessage = 'Error al llamar al modelo'
    let errorCode = response.status
    let rawMessage = ''

    try {
      const errorJson = JSON.parse(errorText)
      rawMessage = errorJson.error?.message || ''
      const metadata = errorJson.error?.metadata?.raw || ''

      // Extract friendly messages from common errors
      if (rawMessage.includes('is not a valid model ID')) {
        friendlyMessage = `El modelo "${openRouterModel}" no está disponible. Por favor selecciona otro modelo.`
        errorCode = 400
      } else if (rawMessage.includes('not enabled') || rawMessage.includes('Developer instruction')) {
        friendlyMessage = `El modelo "${openRouterModel}" no soporta esta operación. Intenta con otro modelo.`
        errorCode = 400
      } else if (rawMessage.includes('rate limit') || rawMessage.includes('Rate limit') || metadata.includes('rate-limited')) {
        friendlyMessage = 'El modelo está temporalmente limitado. Espera un momento e intenta de nuevo, o usa otro modelo.'
        errorCode = 429
      } else if (rawMessage.includes('Provider returned error')) {
        // Generic provider error - try to get more details from metadata
        if (metadata) {
          friendlyMessage = metadata
        } else {
          friendlyMessage = 'El proveedor del modelo falló. Esto puede ser temporal. Intenta de nuevo o usa otro modelo.'
        }
        errorCode = 502
      } else if (rawMessage.includes('insufficient') || rawMessage.includes('credits') || rawMessage.includes('requires more credits')) {
        friendlyMessage = 'Créditos insuficientes en OpenRouter. Prueba con un modelo gratuito o recarga tu cuenta.'
        errorCode = 402
      } else if (rawMessage.includes('context length') || rawMessage.includes('too long')) {
        friendlyMessage = 'El texto es demasiado largo para este modelo. Usa un modelo con más capacidad o reduce el contenido.'
        errorCode = 400
      } else if (rawMessage) {
        friendlyMessage = rawMessage
      }
    } catch {
      // If can't parse, use generic message
      rawMessage = errorText
    }

    const error = new Error(friendlyMessage) as Error & {
      code: number
      model: string
      source: string
      originalError: string
    }
    error.code = errorCode
    error.model = openRouterModel
    error.source = 'openrouter'
    error.originalError = rawMessage || errorText
    throw error
  }

  const data = await response.json()

  if (data.error) {
    // Parse OpenRouter error for better user feedback
    const rawError = data.error.message || JSON.stringify(data.error)
    let friendlyMessage = rawError

    // Translate common OpenRouter error messages
    if (rawError.includes('Provider returned error')) {
      friendlyMessage = `El proveedor del modelo falló. Esto puede ser temporal. Intenta de nuevo o usa otro modelo.`
    } else if (rawError.includes('No endpoints found')) {
      friendlyMessage = `Este modelo requiere configurar tu política de datos en OpenRouter. Ve a: https://openrouter.ai/settings/privacy`
    } else if (rawError.includes('moderation') || rawError.includes('content policy')) {
      friendlyMessage = `El contenido fue bloqueado por las políticas del modelo. Intenta reformular el prompt o usa otro modelo.`
    } else if (rawError.includes('overloaded') || rawError.includes('capacity')) {
      friendlyMessage = `El modelo está sobrecargado. Intenta de nuevo en unos minutos o usa otro modelo.`
    }

    const error = new Error(friendlyMessage) as Error & {
      code: number
      model: string
      source: string
      originalError: string
    }
    error.code = 502  // Bad Gateway - upstream provider error
    error.model = openRouterModel
    error.source = 'openrouter'
    error.originalError = rawError
    throw error
  }

  const text = data.choices?.[0]?.message?.content || ''

  // Log full usage data for debugging (OpenRouter includes cost)
  console.log(`[OpenRouter] Usage data:`, JSON.stringify(data.usage))

  return {
    text,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || Math.ceil(text.length / 4),
      // OpenRouter returns cost directly in USD
      cost: data.usage?.cost !== undefined ? data.usage.cost : null,
    },
    model: openRouterModel,
  }
}

// ============================================================================
// DEEP RESEARCH (Google Interactions API - NOT available on OpenRouter)
// ============================================================================

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

  // Build comprehensive prompt for Deep Research with explicit instructions for EXTENSIVE output
  // Deep Research can generate very long reports - we want maximum depth and detail
  const fullPrompt = `# Deep Research Request

## Instructions
${systemPrompt}

## Context Documents
${context}

## Research Task
${userPrompt}

## CRITICAL OUTPUT REQUIREMENTS

You are conducting an in-depth research project. Your output must be a COMPREHENSIVE RESEARCH REPORT of at least 10,000 words (approximately 20+ pages).

### Length & Depth Requirements:
- MINIMUM 10,000 words - this is NON-NEGOTIABLE
- Each major section should be 1,000-2,000 words minimum
- Include detailed subsections within each section
- Do NOT summarize or abbreviate - expand and elaborate on every point
- If you find yourself being brief, STOP and add more detail, examples, and analysis

### Structure Requirements:
- Executive Summary (500+ words)
- Table of Contents
- 8-12 major sections with detailed analysis
- Each section must have 3-5 subsections minimum
- Include data tables, comparisons, and structured lists
- Comprehensive Sources section with 30+ citations

### Content Requirements:
- Exhaustive analysis of every aspect mentioned in the research task
- Multiple perspectives and viewpoints on each topic
- Historical context where relevant
- Current state analysis with specific data points
- Future projections and trends
- Competitive landscape analysis
- Detailed case studies or examples (3-5 minimum)
- Direct quotes from sources
- Statistical data and metrics
- Strategic recommendations with implementation details

### Quality Indicators:
- The report should feel like a professional consulting deliverable
- No section should feel rushed or superficial
- Every claim must be supported by evidence and citations
- Include nuanced analysis, not just surface-level observations

Remember: A short report is a FAILED report. Aim for depth, not brevity.`

  console.log(`[Deep Research] Iniciando investigación con modelo: ${model}`)
  console.log(`[Deep Research] Prompt length: ${fullPrompt.length} caracteres`)

  // 1. CREAR INTERACCIÓN usando la Interactions API v1alpha
  // Formato simplificado sin campo config (no soportado en REST API)
  const interactionsUrl = `https://generativelanguage.googleapis.com/v1alpha/interactions?key=${apiKey}`

  const requestBody = {
    agent: model,  // Modelo como string directo
    background: true,  // Ejecución asíncrona en background
    store: true,  // Required for long-running tasks according to Google docs
    input: fullPrompt  // Input como string directo
  }

  console.log(`[Deep Research] Creando interacción v1alpha`)
  console.log(`[Deep Research] Request body:`, JSON.stringify({ agent: model, background: true, store: true, input: '...' }))

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
        store: true,
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
          store: true,
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
            store: true,
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

    // Verificar si completó (check both 'state' and 'status' fields, uppercase and lowercase)
    const stateOrStatus = statusData.state || (statusData as any).status || ''
    const isCompleted = stateOrStatus === 'COMPLETED' || stateOrStatus === 'completed'

    if (isCompleted) {
      let resultText = ''

      // Debug: log full response for analysis
      console.log(`[Deep Research] COMPLETED - Full response:`, JSON.stringify(statusData, null, 2).substring(0, 5000))

      // According to Google documentation, the final report is in outputs[-1].text
      // The last element of the outputs array contains the complete research report
      if (statusData.outputs && statusData.outputs.length > 0) {
        // Get the LAST output - this is where the final report is according to docs
        const lastOutput = statusData.outputs[statusData.outputs.length - 1]
        if (lastOutput.text) {
          resultText = lastOutput.text
          console.log(`[Deep Research] Result from outputs[-1].text (last output): ${resultText.length} chars`)
        } else if ((lastOutput as any).content) {
          resultText = (lastOutput as any).content
          console.log(`[Deep Research] Result from outputs[-1].content (last output): ${resultText.length} chars`)
        }
      }

      // Fallback: try other fields if outputs[-1] didn't work
      if (!resultText) {
        // 1. response.text (original format)
        if (statusData.response?.text) {
          resultText = statusData.response.text
          console.log(`[Deep Research] Result from response.text: ${resultText.length} chars`)
        }
        // 2. result.text or result.content (newer format)
        else if ((statusData as any).result?.text) {
          resultText = (statusData as any).result.text
          console.log(`[Deep Research] Result from result.text: ${resultText.length} chars`)
        }
        else if ((statusData as any).result?.content) {
          resultText = (statusData as any).result.content
          console.log(`[Deep Research] Result from result.content: ${resultText.length} chars`)
        }
        // 3. Direct text field on statusData
        else if ((statusData as any).text) {
          resultText = (statusData as any).text
          console.log(`[Deep Research] Result from direct text: ${resultText.length} chars`)
        }
        // 4. candidates array (generateContent style)
        else if ((statusData as any).candidates?.[0]?.content?.parts?.[0]?.text) {
          resultText = (statusData as any).candidates[0].content.parts[0].text
          console.log(`[Deep Research] Result from candidates: ${resultText.length} chars`)
        }
      }

      // If still no result, log warning
      if (!resultText) {
        console.log(`[Deep Research] WARNING: No result text found in any field. Keys:`, Object.keys(statusData))
        console.log(`[Deep Research] Outputs array:`, JSON.stringify(statusData.outputs, null, 2))
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

    // Check for failed state (both uppercase and lowercase)
    const isFailed = stateOrStatus === 'FAILED' || stateOrStatus === 'failed' || stateOrStatus === 'cancelled'
    if (isFailed) {
      const errorMsg = statusData.error?.message || 'Error desconocido en Deep Research'
      throw new Error(`Deep Research failed: ${errorMsg}. Interaction ID: ${interactionName}`)
    }

    await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS))
  }
}

// Ejecutar modelo usando OpenRouter (excepto Deep Research que usa Google Interactions API)
async function executeModel(
  userOpenRouterKey: string,
  systemPrompt: string,
  context: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
  preferredModel: string,
  onProgress?: ProgressCallback
): Promise<LLMResponse> {
  const provider = getProvider(preferredModel)
  console.log(`Executing with ${provider}/${preferredModel} via OpenRouter...`)

  // Deep Research uses Google Interactions API directly (not available on OpenRouter)
  if (provider === 'deep-research') {
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')
    if (!geminiKey) {
      throw new Error('Deep Research requires GEMINI_API_KEY. This model is not available on OpenRouter.')
    }
    console.log(`[Deep Research] NOTA: Este modelo puede tardar 5-10 minutos en completar la investigación`)
    return await callDeepResearch(geminiKey, preferredModel, systemPrompt, context, userPrompt, onProgress)
  }

  // All other models go through OpenRouter
  return await callOpenRouter(
    userOpenRouterKey,
    preferredModel,
    systemPrompt,
    context,
    userPrompt,
    temperature,
    maxTokens
  )
}

function getProvider(model: string): string {
  if (model.startsWith('deep-research')) return 'deep-research'
  if (model.startsWith('gemini')) return 'gemini'
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) return 'openai'
  if (model.startsWith('claude')) return 'anthropic'
  if (model.startsWith('llama') || model.startsWith('mixtral')) return 'groq'
  return 'gemini' // default
}

type RetrievalMode = 'full' | 'rag'

interface RAGConfig {
  top_k: number
  min_score: number
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
  retrieval_mode?: RetrievalMode  // 'full' (default) or 'rag'
  rag_config?: RAGConfig
}

interface RequestPayload {
  campaign_id: string
  step_config: FlowStep
  user_id: string  // User ID to fetch their OpenRouter API key
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

  const { campaign_id, step_config, user_id } = requestBody

  try {

    if (!campaign_id || !step_config) {
      return new Response(
        JSON.stringify({ error: 'Missing campaign_id or step_config' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check if this is a Deep Research model (uses Google API directly, not OpenRouter)
    const preferredModelEarly = step_config.model || 'gemini-2.5-flash'
    const isDeepResearchModel = preferredModelEarly.startsWith('deep-research')

    // Deep Research uses GEMINI_API_KEY directly, doesn't need user_id or OpenRouter
    if (!isDeepResearchModel && !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id. Please connect OpenRouter first.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // =========================================================================
    // FETCH AND DECRYPT OPENROUTER API KEY (User -> Agency -> Error)
    // Skip for Deep Research models (they use Google API directly)
    // =========================================================================
    let userOpenRouterKey: string | null = null
    let keySource: 'user' | 'agency' = 'user'

    if (!isDeepResearchModel) {
      // 1. Try user's personal token first
      const { data: tokenRecord } = await supabase
        .from('user_openrouter_tokens')
        .select('encrypted_api_key')
        .eq('user_id', user_id)
        .single()

      if (tokenRecord?.encrypted_api_key) {
        try {
          userOpenRouterKey = await decryptToken(tokenRecord.encrypted_api_key)
          keySource = 'user'
          console.log('[OpenRouter] Using user personal key')

          // Update last_used_at for user token
          await supabase
            .from('user_openrouter_tokens')
            .update({ last_used_at: new Date().toISOString() })
            .eq('user_id', user_id)
        } catch (decryptError) {
          console.warn('Failed to decrypt user OpenRouter key:', decryptError)
        }
      }

      // 2. If no user key, try agency key
      if (!userOpenRouterKey) {
        console.log('[OpenRouter] No user key, checking agency...')

        const { data: membership } = await supabase
          .from('agency_members')
          .select('agency_id, agencies(id, openrouter_api_key)')
          .eq('user_id', user_id)
          .single()

        const agencyData = membership?.agencies as { id: string; openrouter_api_key: string | null } | null

        if (agencyData?.openrouter_api_key) {
          try {
            userOpenRouterKey = await decryptToken(agencyData.openrouter_api_key)
            keySource = 'agency'
            console.log('[OpenRouter] Using agency key')

            // Update last_used_at for agency
            await supabase
              .from('agencies')
              .update({ openrouter_key_last_used_at: new Date().toISOString() })
              .eq('id', agencyData.id)
          } catch (decryptError) {
            console.warn('Failed to decrypt agency OpenRouter key:', decryptError)
          }
        }
      }

      // 3. No key available - return error
      if (!userOpenRouterKey) {
        return new Response(
          JSON.stringify({
            error: 'OpenRouter not connected. Please connect your OpenRouter account or ask your agency admin to configure an API key.',
            requires_openrouter: true
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }

      console.log(`[OpenRouter] Key source: ${keySource}`)
    } else {
      console.log('[Deep Research] Skipping OpenRouter key lookup - using Google API directly')
    }

    // =========================================================================

    // Load campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('ecp_campaigns')
      .select('*, projects_legacy(*)')
      .eq('id', campaign_id)
      .single()

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const project = campaign.projects_legacy
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
    const retrievalMode = step_config.retrieval_mode || 'full'

    // 1. Load base documents (either full or via RAG)
    if (step_config.base_doc_ids && step_config.base_doc_ids.length > 0) {
      if (retrievalMode === 'rag') {
        // RAG mode: retrieve only relevant chunks
        console.log(`[RAG] Retrieving relevant chunks for ${step_config.base_doc_ids.length} documents`)

        const ragConfig = step_config.rag_config || { top_k: 10, min_score: 0.7 }

        try {
          // Call retrieve-relevant-chunks edge function
          const retrieveResponse = await fetch(`${supabaseUrl}/functions/v1/retrieve-relevant-chunks`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              document_ids: step_config.base_doc_ids,
              query: step_config.prompt, // Use the prompt as the query for semantic search
              top_k: ragConfig.top_k,
              min_similarity: ragConfig.min_score,
            }),
          })

          if (!retrieveResponse.ok) {
            const errorText = await retrieveResponse.text()
            console.warn(`[RAG] Failed to retrieve chunks: ${errorText}. Falling back to full documents.`)
            // Fallback to full documents
          } else {
            const retrieveResult = await retrieveResponse.json()

            if (retrieveResult.success && retrieveResult.chunks && retrieveResult.chunks.length > 0) {
              console.log(`[RAG] Retrieved ${retrieveResult.chunks.length} chunks, total tokens: ${retrieveResult.total_tokens}`)

              contextString += `\n--- RELEVANT DOCUMENT CHUNKS (${retrieveResult.chunks.length} fragments) ---\n`

              for (const chunk of retrieveResult.chunks) {
                contextString += `\n[${chunk.document_filename || 'Document'}] (similarity: ${(chunk.similarity * 100).toFixed(1)}%):\n`
                contextString += chunk.content
                contextString += '\n'
              }

              contextString += `\n--- END RELEVANT CHUNKS ---\n`
              totalTokens += retrieveResult.total_tokens || 0
            } else {
              console.warn(`[RAG] No chunks retrieved, falling back to full documents`)
              // Fallback handled below
            }
          }
        } catch (ragError) {
          console.warn(`[RAG] Error during retrieval: ${ragError}. Falling back to full documents.`)
          // Fallback to full documents
        }

        // Check if RAG didn't populate context (fallback to full)
        if (contextString.trim() === '') {
          console.log(`[RAG] Falling back to full document mode`)
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
      } else {
        // Full document mode (default)
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

    // Deep Research requiere manejo especial: crear interacción y retornar inmediatamente
    // El polling se hace desde el frontend/API route separado
    const isDeepResearch = preferredModel.startsWith('deep-research')

    if (isDeepResearch) {
      console.log(`[Deep Research] Modo asíncrono - creando interacción y retornando inmediatamente`)

      const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')
      if (!geminiKey) {
        throw new Error('No API key configured for Deep Research. Please add GOOGLE_API_KEY or GEMINI_API_KEY.')
      }

      const asyncResult = await createDeepResearchInteraction(
        geminiKey,
        preferredModel,
        SYSTEM_INSTRUCTION,
        contextString,
        promptWithFormat
      )

      // Guardar interaction_id en execution_logs para que el frontend pueda hacer polling
      await supabase
        .from('execution_logs')
        .update({
          status: 'polling',
          error_details: JSON.stringify({
            type: 'deep_research_async',
            interaction_id: asyncResult.interaction_id,
            model: asyncResult.model,
            prompt_tokens: asyncResult.prompt_tokens,
            step_name: step_config.name,
            started_at: new Date().toISOString()
          })
        })
        .eq('id', logEntry.id)

      // Retornar inmediatamente indicando que se requiere polling
      return new Response(
        JSON.stringify({
          success: true,
          async_polling_required: true,
          interaction_id: asyncResult.interaction_id,
          model_used: asyncResult.model,
          log_id: logEntry.id,
          message: 'Deep Research iniciado. El resultado se obtendrá mediante polling.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Para otros modelos, ejecutar normalmente via OpenRouter
    const llmResponse = await executeModel(
      userOpenRouterKey,
      SYSTEM_INSTRUCTION,
      contextString,
      promptWithFormat,
      temperature,
      maxTokens,
      preferredModel,
      undefined // No progress callback para modelos normales
    )

    const outputText = llmResponse.text
    const modelUsed = llmResponse.model
    const usage = llmResponse.usage
    const outputTokens = usage.completionTokens || Math.ceil(outputText.length / 4)

    console.log(`Step completed using model: ${modelUsed}`)

    // Save output to campaign.step_outputs
    // IMPORTANT: Create a deep copy to ensure Supabase detects the change
    const currentStepOutputs = JSON.parse(JSON.stringify(campaign.step_outputs || {}))
    currentStepOutputs[step_config.id] = {
      step_name: step_config.name,
      output: outputText,
      tokens: outputTokens,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }

    console.log(`Saving step_outputs for step ${step_config.id}, campaign ${campaign_id}`)

    const { error: updateError } = await supabase
      .from('ecp_campaigns')
      .update({
        step_outputs: currentStepOutputs,
      })
      .eq('id', campaign_id)

    if (updateError) {
      console.error('Error saving step_outputs:', updateError)
      throw new Error(`Failed to save step output: ${updateError.message}`)
    }

    console.log(`Successfully saved step_outputs for step ${step_config.id}`)

    // Log completion
    const duration = Date.now() - startTime
    const inputTokensFinal = usage.promptTokens || totalTokens
    const outputTokensFinal = usage.completionTokens || outputTokens

    await supabase
      .from('execution_logs')
      .update({
        status: 'completed',
        input_tokens: inputTokensFinal,
        output_tokens: outputTokensFinal,
        duration_ms: duration,
        model_used: modelUsed,
      })
      .eq('id', logEntry.id)

    // =========================================================================
    // LOG COST TO openrouter_usage_logs
    // =========================================================================
    try {
      // Calculate cost based on model pricing
      const MODEL_PRICING: Record<string, { input: number; output: number }> = {
        'gemini-2.5-pro': { input: 1.25, output: 10.0 },
        'gemini-2.5-flash': { input: 0.30, output: 2.50 },
        'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
        'gemini-3.0-pro-preview': { input: 2.00, output: 12.00 },
        'google/gemini-2.5-pro': { input: 1.25, output: 10.0 },
        'google/gemini-2.5-pro-preview': { input: 1.25, output: 10.0 },
        'google/gemini-2.5-flash': { input: 0.30, output: 2.50 },
        'google/gemini-2.5-flash-preview': { input: 0.30, output: 2.50 },
        'google/gemini-3-pro-preview': { input: 2.00, output: 12.00 },
        'gpt-4o': { input: 2.50, output: 10.0 },
        'openai/gpt-4o': { input: 2.50, output: 10.0 },
        'gpt-4o-mini': { input: 0.15, output: 0.60 },
        'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
        'claude-4.5-sonnet': { input: 3.00, output: 15.0 },
        'anthropic/claude-sonnet-4': { input: 3.00, output: 15.0 },
        'claude-4.5-opus': { input: 15.00, output: 75.0 },
        'claude-4.5-haiku': { input: 1.00, output: 5.0 },
        'anthropic/claude-haiku-3.5': { input: 1.00, output: 5.0 },
        'default': { input: 1.00, output: 5.00 },
      }

      const pricing = MODEL_PRICING[modelUsed] || MODEL_PRICING['default']
      const inputCost = (inputTokensFinal / 1_000_000) * pricing.input
      const outputCost = (outputTokensFinal / 1_000_000) * pricing.output
      const totalCost = inputCost + outputCost

      // Get project_id and agency_id from campaign
      const projectId = campaign.project_id || project?.id
      let agencyId: string | null = null

      // Get agency_id from user membership
      const { data: membership } = await supabase
        .from('agency_members')
        .select('agency_id')
        .eq('user_id', user_id)
        .single()

      if (membership) {
        agencyId = membership.agency_id
      }

      const { error: usageLogError } = await supabase
        .from('openrouter_usage_logs')
        .insert({
          user_id: user_id,
          agency_id: agencyId,
          project_id: projectId,
          campaign_id: campaign_id,
          step_id: step_config.id,
          step_name: step_config.name,
          model_used: modelUsed,
          input_tokens: inputTokensFinal,
          output_tokens: outputTokensFinal,
          cost_usd: totalCost,
          cache_discount: 0, // TODO: Extract from OpenRouter response if available
          retrieval_mode: retrievalMode,
          duration_ms: duration,
          status: 'completed',
        })

      if (usageLogError) {
        console.error(`[Cost Log] Insert error:`, usageLogError)
      } else {
        console.log(`[Cost Log] Model: ${modelUsed}, Tokens: ${inputTokensFinal}/${outputTokensFinal}, Cost: $${totalCost.toFixed(6)}`)
      }
    } catch (costLogError) {
      // Don't fail the request if cost logging fails
      console.warn('[Cost Log] Failed to log cost:', costLogError)
    }
    // =========================================================================

    return new Response(
      JSON.stringify({
        success: true,
        output: outputText,
        model_used: modelUsed,
        retrieval_mode: retrievalMode,
        tokens: {
          input: inputTokensFinal,
          output: outputTokensFinal,
          total: inputTokensFinal + outputTokensFinal,
        },
        duration_ms: duration,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error) || 'Unknown error'

    console.error('Edge function error:', errorMessage, error)

    // Extract error details from custom error if available
    const errorWithDetails = error as Error & {
      code?: number
      model?: string
      source?: string
      originalError?: string
    }
    const statusCode = errorWithDetails.code || 500
    const failedModel = errorWithDetails.model || step_config?.model || 'unknown'
    const errorSource = errorWithDetails.source || 'unknown'

    // Always allow retry - user might want to try a different/cheaper model
    const canRetry = true

    // Build response with clear source indication
    const responseBody: Record<string, any> = {
      error: errorMessage,
      failed_model: failedModel,
      can_retry: canRetry,
      error_source: errorSource,  // 'openrouter', 'api', or 'unknown'
    }

    // Include original error for debugging (only in development or for technical users)
    if (errorWithDetails.originalError && errorWithDetails.originalError !== errorMessage) {
      responseBody.original_error = errorWithDetails.originalError
    }

    return new Response(
      JSON.stringify(responseBody),
      { status: statusCode, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
