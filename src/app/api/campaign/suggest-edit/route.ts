import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 60

// ============================================================================
// ENCRYPTION UTILITIES (for decrypting user's OpenRouter API key)
// ============================================================================

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  if (keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }
  return Buffer.from(keyHex, 'hex')
}

function decryptToken(encryptedData: string): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedData, 'base64')

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted data: too short')
  }

  // Format: iv (16) + authTag (16) + ciphertext
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}

// ============================================================================
// OPENROUTER API CALL
// ============================================================================

async function callOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gatacca.app'

  // Check if this is a reasoning model (o1, o3, o4 series)
  const isReasoningModel = model.startsWith('openai/o1') || model.startsWith('openai/o3') || model.startsWith('openai/o4')

  // Some models don't support system messages
  const noSystemMessageSupport = isReasoningModel ||
    model.includes('gemma') ||
    model.includes(':free')

  const messages = noSystemMessageSupport
    ? [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }]
    : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]

  const requestBody: Record<string, unknown> = {
    model,
    messages,
  }

  if (!isReasoningModel) {
    requestBody.temperature = temperature
    requestBody.max_tokens = maxTokens
  } else {
    requestBody.max_completion_tokens = maxTokens
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': appUrl,
      'X-Title': 'Gatacca',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[OpenRouter] API error:', errorText)

    let friendlyMessage = 'Error al llamar al modelo'
    try {
      const errorJson = JSON.parse(errorText)
      const rawMessage = errorJson.error?.message || ''

      if (rawMessage.includes('is not a valid model ID')) {
        friendlyMessage = `El modelo "${model}" no está disponible.`
      } else if (rawMessage.includes('rate limit')) {
        friendlyMessage = 'El modelo está temporalmente limitado. Intenta de nuevo o usa otro modelo.'
      } else if (rawMessage.includes('insufficient') || rawMessage.includes('credits')) {
        friendlyMessage = 'Créditos insuficientes en OpenRouter.'
      } else if (rawMessage) {
        friendlyMessage = rawMessage
      }
    } catch {
      // Use generic message
    }

    throw new Error(friendlyMessage)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error.message || 'Error de OpenRouter')
  }

  return data.choices?.[0]?.message?.content || ''
}

/**
 * AI-assisted output editing using OpenRouter
 * Takes current output and user instruction, returns suggested changes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { currentOutput, instruction, stepName, campaignName, selectedText, model, temperature, maxTokens, documents } = body as {
      currentOutput: string
      instruction: string
      stepName: string
      campaignName: string
      selectedText?: string
      model?: string
      temperature?: number
      maxTokens?: number
      documents?: Array<{ filename: string; category: string; content: string }>
    }

    if (!currentOutput || !instruction) {
      return NextResponse.json(
        { error: 'Missing currentOutput or instruction' },
        { status: 400 }
      )
    }

    // =========================================================================
    // GET USER'S OPENROUTER API KEY
    // =========================================================================
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: tokenRecord, error: tokenError } = await supabase
      .from('user_openrouter_tokens')
      .select('encrypted_api_key')
      .eq('user_id', session.user.id)
      .single()

    if (tokenError || !tokenRecord?.encrypted_api_key) {
      return NextResponse.json(
        { error: 'OpenRouter not connected. Please connect your OpenRouter account first.', requires_openrouter: true },
        { status: 401 }
      )
    }

    let userApiKey: string
    try {
      userApiKey = decryptToken(tokenRecord.encrypted_api_key)
    } catch (decryptError) {
      console.error('Failed to decrypt OpenRouter key:', decryptError)
      return NextResponse.json(
        { error: 'Failed to decrypt OpenRouter API key. Please reconnect your account.', requires_openrouter: true },
        { status: 500 }
      )
    }

    // =========================================================================
    // BUILD PROMPTS
    // =========================================================================

    // Build documents context section if documents are provided
    let documentsContext = ''
    if (documents && documents.length > 0) {
      documentsContext = `\n\nDOCUMENTOS DE REFERENCIA (usa esta información para mejorar y verificar el contenido):
${documents.map((doc, i) => `
--- DOCUMENTO ${i + 1}: ${doc.filename} (${doc.category}) ---
${doc.content}
--- FIN DOCUMENTO ${i + 1} ---`).join('\n')}`
    }

    // Build system prompt based on whether there's a selection
    let systemPrompt: string
    let userPrompt: string

    const hasDocsContext = documents && documents.length > 0
    const docsInstructions = hasDocsContext
      ? `\n10. Tienes acceso a DOCUMENTOS DE REFERENCIA - úsalos para verificar datos, agregar información relevante y asegurar precisión
11. Puedes citar o referenciar información de los documentos si es pertinente
12. Si el usuario pide agregar datos específicos, busca primero en los documentos de referencia`
      : ''

    if (selectedText) {
      // Focused edit on selection
      systemPrompt = `Eres un asistente de edición de contenido estratégico.
Tu tarea es modificar SOLO la sección seleccionada del documento según las instrucciones del usuario.

REGLAS CRÍTICAS:
1. SOLO modifica la parte del documento que corresponde al texto seleccionado
2. Mantén EXACTAMENTE igual todo el contenido antes y después de la selección
3. Preserva el formato markdown del documento original
4. No cambies encabezados, listas, tablas o estructura que no estén en la selección
5. Devuelve el documento COMPLETO con solo la sección seleccionada modificada
6. El cambio debe integrarse naturalmente con el resto del texto${docsInstructions}`

      userPrompt = `DOCUMENTO COMPLETO (${stepName} - ${campaignName}):
---
${currentOutput}
---

TEXTO SELECCIONADO POR EL USUARIO (solo modifica esta parte):
---
${selectedText}
---
${documentsContext}

INSTRUCCIÓN DEL USUARIO:
${instruction}

Aplica los cambios SOLO a la sección seleccionada y devuelve el documento completo.`
    } else {
      // General edit
      systemPrompt = `Eres un asistente de edición de contenido estratégico.
Tu tarea es modificar el texto existente según las instrucciones del usuario.

REGLAS IMPORTANTES:
1. Mantén el formato y estructura general del documento original (markdown, encabezados, listas, tablas)
2. Solo realiza los cambios específicos que el usuario solicita
3. Preserva todo el contenido que no esté relacionado con la instrucción
4. Mantén el mismo tono y estilo del documento original
5. Si el usuario pide agregar algo, intégralo de forma natural en el texto
6. Si el usuario pide eliminar algo, hazlo sin dejar huecos extraños
7. Devuelve el documento COMPLETO con los cambios aplicados
8. NO cambies formato de encabezados (## debe seguir siendo ##)
9. NO elimines secciones enteras a menos que se pida explícitamente${docsInstructions}`

      userPrompt = `DOCUMENTO ACTUAL (${stepName} - ${campaignName}):
---
${currentOutput}
---
${documentsContext}

INSTRUCCIÓN DEL USUARIO:
${instruction}

Por favor, aplica los cambios solicitados y devuelve el documento completo modificado.`
    }

    // =========================================================================
    // CALL OPENROUTER
    // =========================================================================

    const selectedModel = model || 'google/gemini-2.0-flash-exp:free'
    const selectedTemperature = temperature ?? 0.3 // Lower default for predictable edits
    const selectedMaxTokens = maxTokens ?? 8192

    console.log(`[suggest-edit] Using model: ${selectedModel}`)

    const suggestedOutput = await callOpenRouter(
      userApiKey,
      selectedModel,
      systemPrompt,
      userPrompt,
      selectedTemperature,
      selectedMaxTokens
    )

    if (!suggestedOutput) {
      return NextResponse.json(
        { error: 'No suggestion generated' },
        { status: 500 }
      )
    }

    // Update last_used_at
    await supabase
      .from('user_openrouter_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', session.user.id)

    return NextResponse.json({
      success: true,
      suggestion: suggestedOutput,
      instruction,
      hadSelection: !!selectedText,
      model_used: selectedModel,
    })
  } catch (error) {
    console.error('Suggest edit error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
