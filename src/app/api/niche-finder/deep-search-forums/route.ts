import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface DeepSearchRequest {
  life_contexts: string[]
  product_words: string[]
  existing_forums: string[]
  country?: string
  project_id?: string
}

interface ForumSuggestion {
  domain: string
  context: string
  reason: string
}

export async function POST(request: NextRequest) {
  // Try Perplexity first, fallback to OpenRouter with web search capable model
  const perplexityApiKey = process.env.PERPLEXITY_API_KEY
  const openrouterApiKey = process.env.OPENROUTER_API_KEY

  if (!perplexityApiKey && !openrouterApiKey) {
    return NextResponse.json(
      { success: false, error: 'No API key configured for deep search' },
      { status: 500 }
    )
  }

  try {
    const body: DeepSearchRequest = await request.json()
    const { life_contexts, product_words, existing_forums, country = 'España' } = body

    if (life_contexts.length === 0 && product_words.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Se requieren contextos de vida o palabras de producto' },
        { status: 400 }
      )
    }

    const searchPrompt = `Eres un experto en investigación de mercado en España y Latinoamérica. Tu tarea es encontrar FOROS ACTIVOS donde la gente discute problemas reales.

CONTEXTO DEL PRODUCTO:
- Contextos de vida del cliente: ${life_contexts.join(', ') || 'general'}
- Palabras relacionadas al producto: ${product_words.join(', ') || 'general'}
- País objetivo: ${country}
- Foros que ya tenemos (NO repetir): ${existing_forums.join(', ') || 'ninguno'}

BUSCA FOROS QUE CUMPLAN:
1. ✅ Tienen secciones de discusión/foro activas
2. ✅ La gente hace preguntas y comparte problemas
3. ✅ Relevantes para los contextos de vida mencionados
4. ✅ En español (España o Latinoamérica)
5. ❌ NO blogs, NO noticias, NO tiendas, NO redes sociales generales

TIPOS DE SITIOS A BUSCAR:
- Foros especializados (vBulletin, phpBB, Discourse)
- Comunidades de nicho
- Sitios de preguntas y respuestas
- Subforos de sitios grandes
- Comunidades de Discord/Telegram (si tienen web)

Responde SOLO con un JSON array de objetos con esta estructura:
[
  {
    "domain": "dominio.com/foro",
    "context": "contexto de vida relacionado",
    "reason": "Por qué este foro es relevante (1 línea)"
  }
]

Encuentra entre 5 y 10 foros NUEVOS que no estén en la lista de existentes. Si no encuentras suficientes foros relevantes, devuelve los que encuentres.
Responde SOLO con el JSON, sin texto adicional.`

    let forums: ForumSuggestion[] = []

    // Try Perplexity first (better for web search)
    if (perplexityApiKey) {
      try {
        const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${perplexityApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-sonar-large-128k-online', // Web search enabled model
            messages: [
              {
                role: 'system',
                content: 'Eres un investigador de mercado experto. Respondes SOLO con JSON válido, sin markdown ni texto adicional.'
              },
              { role: 'user', content: searchPrompt }
            ],
            max_tokens: 2000,
            temperature: 0.3,
            return_related_questions: false,
          }),
        })

        if (perplexityResponse.ok) {
          const data = await perplexityResponse.json()
          const content = data.choices?.[0]?.message?.content || '[]'
          forums = parseForumsFromResponse(content, existing_forums)

          if (forums.length > 0) {
            return NextResponse.json({ success: true, forums, source: 'perplexity' })
          }
        }
      } catch (e) {
        console.warn('Perplexity search failed, trying OpenRouter:', e)
      }
    }

    // Fallback to OpenRouter with a capable model
    if (openrouterApiKey && forums.length === 0) {
      const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet', // Good at research tasks
          messages: [
            {
              role: 'system',
              content: 'Eres un investigador de mercado experto en encontrar comunidades online. Respondes SOLO con JSON válido.'
            },
            { role: 'user', content: searchPrompt }
          ],
          max_tokens: 2000,
          temperature: 0.5,
        }),
      })

      if (!openrouterResponse.ok) {
        throw new Error(`OpenRouter error: ${openrouterResponse.status}`)
      }

      const data = await openrouterResponse.json()
      const content = data.choices?.[0]?.message?.content || '[]'
      forums = parseForumsFromResponse(content, existing_forums)
    }

    return NextResponse.json({
      success: true,
      forums,
      source: perplexityApiKey ? 'perplexity-fallback' : 'openrouter'
    })

  } catch (error) {
    console.error('Deep search forums error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error en búsqueda avanzada' },
      { status: 500 }
    )
  }
}

function parseForumsFromResponse(content: string, existingForums: string[]): ForumSuggestion[] {
  try {
    // Extract JSON from response (might be wrapped in markdown)
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const parsed = JSON.parse(jsonMatch[0])

    if (!Array.isArray(parsed)) return []

    // Filter and validate
    return parsed
      .filter((item): item is ForumSuggestion =>
        typeof item === 'object' &&
        typeof item.domain === 'string' &&
        item.domain.length > 0 &&
        !existingForums.some(ef =>
          ef.toLowerCase().includes(item.domain.toLowerCase()) ||
          item.domain.toLowerCase().includes(ef.toLowerCase())
        )
      )
      .map(item => ({
        domain: item.domain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
        context: item.context || '',
        reason: item.reason || 'Foro relevante encontrado'
      }))
      .slice(0, 10) // Max 10 suggestions

  } catch (e) {
    console.error('Failed to parse forums response:', e)
    return []
  }
}
