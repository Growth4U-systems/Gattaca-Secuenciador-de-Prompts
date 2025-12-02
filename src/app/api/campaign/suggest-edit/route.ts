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
    const { currentOutput, instruction, stepName, campaignName } = body as {
      currentOutput: string
      instruction: string
      stepName: string
      campaignName: string
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

    const systemPrompt = `Eres un asistente de edición de contenido estratégico.
Tu tarea es modificar el texto existente según las instrucciones del usuario.

REGLAS IMPORTANTES:
1. Mantén el formato y estructura general del documento original
2. Solo realiza los cambios específicos que el usuario solicita
3. Preserva todo el contenido que no esté relacionado con la instrucción
4. Mantén el mismo tono y estilo del documento original
5. Si el usuario pide agregar algo, intégralo de forma natural en el texto
6. Si el usuario pide eliminar algo, hazlo sin dejar huecos extraños
7. Devuelve el documento COMPLETO con los cambios aplicados`

    const userPrompt = `DOCUMENTO ACTUAL (${stepName} - ${campaignName}):
---
${currentOutput}
---

INSTRUCCIÓN DEL USUARIO:
${instruction}

Por favor, aplica los cambios solicitados y devuelve el documento completo modificado.`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
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
            temperature: 0.3, // Lower temperature for more predictable edits
            maxOutputTokens: 8192,
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
    })
  } catch (error) {
    console.error('Suggest edit error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
