import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * AI-assisted output editing
 * Takes current output and user instruction, returns suggested changes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { currentOutput, instruction, stepName, campaignName, selectedText, model, temperature, maxTokens } = body as {
      currentOutput: string
      instruction: string
      stepName: string
      campaignName: string
      selectedText?: string
      model?: string
      temperature?: number
      maxTokens?: number
    }

    if (!currentOutput || !instruction) {
      return NextResponse.json(
        { error: 'Missing currentOutput or instruction' },
        { status: 400 }
      )
    }

    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }

    // Build system prompt based on whether there's a selection
    let systemPrompt: string
    let userPrompt: string

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
6. El cambio debe integrarse naturalmente con el resto del texto`

      userPrompt = `DOCUMENTO COMPLETO (${stepName} - ${campaignName}):
---
${currentOutput}
---

TEXTO SELECCIONADO POR EL USUARIO (solo modifica esta parte):
---
${selectedText}
---

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
9. NO elimines secciones enteras a menos que se pida explícitamente`

      userPrompt = `DOCUMENTO ACTUAL (${stepName} - ${campaignName}):
---
${currentOutput}
---

INSTRUCCIÓN DEL USUARIO:
${instruction}

Por favor, aplica los cambios solicitados y devuelve el documento completo modificado.`
    }

    // Use provided model or default to gemini-2.5-flash
    const selectedModel = model || 'gemini-2.5-flash'
    const selectedTemperature = temperature ?? 0.3 // Lower default for predictable edits
    const selectedMaxTokens = maxTokens ?? 8192

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: selectedTemperature,
            maxOutputTokens: selectedMaxTokens,
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', errorText)
      return NextResponse.json(
        { error: 'AI service error', details: errorText },
        { status: 500 }
      )
    }

    const geminiData = await geminiResponse.json()
    const suggestedOutput = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

    if (!suggestedOutput) {
      return NextResponse.json(
        { error: 'No suggestion generated' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      suggestion: suggestedOutput,
      instruction,
      hadSelection: !!selectedText,
    })
  } catch (error) {
    console.error('Suggest edit error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
