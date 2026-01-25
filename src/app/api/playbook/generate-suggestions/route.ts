import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'
import { trackLLMUsage } from '@/lib/polar-usage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface GenerateSuggestionsRequest {
  promptKey: 'suggest_need_words' | 'suggest_subreddits' | 'suggest_forums' | 'suggest_indicators'
  context: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

  // Get session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (!session || sessionError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get OpenRouter API key
  let openrouterApiKey: string | null = null

  const isValidOpenRouterKey = (key: string | null): boolean => {
    return !!key && key.startsWith('sk-or-') && key.length > 20
  }

  // 1. Try user_api_keys table
  const userKey = await getUserApiKey({
    userId: session.user.id,
    serviceName: 'openrouter',
    supabase,
  })
  if (isValidOpenRouterKey(userKey)) {
    openrouterApiKey = userKey
  }

  // 2. Try user_openrouter_tokens (OAuth)
  if (!openrouterApiKey) {
    const { data: tokenRecord } = await supabase
      .from('user_openrouter_tokens')
      .select('encrypted_api_key')
      .eq('user_id', session.user.id)
      .single()

    if (tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
      try {
        const oauthKey = decryptToken(tokenRecord.encrypted_api_key)
        if (isValidOpenRouterKey(oauthKey)) {
          openrouterApiKey = oauthKey
        }
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
        const agencyKey = decryptToken(agencyData.openrouter_api_key)
        if (isValidOpenRouterKey(agencyKey)) {
          openrouterApiKey = agencyKey
        }
      } catch {
        // Ignore decryption errors
      }
    }
  }

  // 4. Fallback to env
  if (!openrouterApiKey) {
    const envKey = process.env.OPENROUTER_API_KEY || null
    if (isValidOpenRouterKey(envKey)) {
      openrouterApiKey = envKey
    }
  }

  if (!openrouterApiKey) {
    return NextResponse.json({
      error: 'OpenRouter API key not configured. Please add your API key in Settings > APIs.'
    }, { status: 500 })
  }

  try {
    const body: GenerateSuggestionsRequest = await request.json()
    const { promptKey, context } = body

    let prompt = ''
    let parseAs: 'array' | 'sources' = 'array'

    const product = context.product as string || ''
    const target = context.target as string || ''
    const industry = context.industry as string || ''
    const lifeContexts = context.life_contexts as string[] || []
    const needWords = context.need_words as string[] || []

    switch (promptKey) {
      case 'suggest_need_words':
        prompt = `Eres un experto en investigación de mercado y análisis de necesidades del consumidor.

**Producto/Servicio:** ${product}
**Público objetivo:** ${target}
**Industria:** ${industry}

**Tu tarea:** Genera una lista de 15-20 palabras o frases cortas que las personas usan cuando buscan soluciones al problema que este producto resuelve.

Piensa en:
- Palabras que alguien escribiría en Google cuando tiene este problema
- Frases que inician con "cómo", "problemas con", "no puedo", "necesito ayuda"
- Términos que expresan frustración o necesidad
- Palabras específicas de la industria

**Formato de respuesta:** Devuelve SOLO un array JSON de strings, sin explicaciones.

Ejemplo de formato:
["problemas con", "cómo solucionar", "necesito ayuda", "no funciona"]

Responde SOLO con el array JSON:`
        break

      case 'suggest_indicators':
        prompt = `Eres un experto en análisis de sentimiento y detección de necesidades urgentes.

**Producto/Servicio:** ${product}
**Público objetivo:** ${target}

**Tu tarea:** Genera una lista de 10-15 palabras o frases que indican frustración, urgencia o dolor real cuando alguien necesita una solución.

Ejemplos de indicadores:
- "estoy harto de", "no aguanto más"
- "urgente", "desesperado"
- "por favor ayuda", "alguien sabe"
- Expresiones de frustración específicas de la industria

**Formato de respuesta:** Devuelve SOLO un array JSON de strings, sin explicaciones.

Responde SOLO con el array JSON:`
        break

      case 'suggest_subreddits':
        parseAs = 'array'
        prompt = `Eres un experto en Reddit y comunidades online.

**Producto/Servicio:** ${product}
**Público objetivo:** ${target}
**Industria:** ${industry}
**Contextos de vida seleccionados:** ${lifeContexts.join(', ') || 'No especificados'}
**Palabras de necesidad:** ${needWords.join(', ') || 'No especificadas'}

**Tu tarea:** Sugiere 5-8 subreddits donde la gente discute problemas relacionados con este producto/servicio.

**Importante:**
- Solo el nombre del subreddit sin "r/" (ej: "entrepreneur", "smallbusiness", "startups")
- Prioriza subreddits activos con mucha discusión
- Incluye tanto subreddits generales como de nicho
- Si el producto es para hispanohablantes, incluye subreddits en español

**Formato de respuesta:** Devuelve SOLO un array JSON de strings con los nombres de subreddits.

Ejemplo: ["entrepreneur", "smallbusiness", "startups", "SideProject"]

Responde SOLO con el array JSON:`
        break

      case 'suggest_forums':
        parseAs = 'array'
        prompt = `Eres un experto en foros y comunidades online especializadas.

**Producto/Servicio:** ${product}
**Público objetivo:** ${target}
**Industria:** ${industry}
**Contextos de vida seleccionados:** ${lifeContexts.join(', ') || 'No especificados'}
**Palabras de necesidad:** ${needWords.join(', ') || 'No especificadas'}

**Tu tarea:** Sugiere 3-5 foros temáticos REALES (no Reddit) donde la gente discute problemas relacionados con este producto/servicio.

**CRÍTICO - NO INVENTES URLs:**
- Solo sugiere foros que EXISTAN y sean CONOCIDOS
- Ejemplos de foros REALES en español: forobeta.com, rankia.com/foros, mediavida.com, meneame.net, elotrolado.net
- Ejemplos de foros REALES en inglés: hackernews (news.ycombinator.com), indie hackers (indiehackers.com), Product Hunt discussions
- Si no conoces foros específicos de la industria, sugiere foros generalistas grandes donde se discuta el tema
- NO inventes URLs que no existen
- NO añadas /foro o /forums a dominios que no lo tienen

**Formato de respuesta:** Devuelve SOLO un array JSON de strings con URLs completas de foros REALES.

Ejemplo: ["https://www.rankia.com/foros", "https://forobeta.com", "https://www.mediavida.com"]

Responde SOLO con el array JSON:`
        break

      default:
        return NextResponse.json({ error: `Unknown promptKey: ${promptKey}` }, { status: 400 })
    }

    // Call LLM
    const llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    })

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text()
      throw new Error(`OpenRouter API error: ${llmResponse.status} - ${errorText}`)
    }

    const llmData = await llmResponse.json()
    const output = llmData.choices?.[0]?.message?.content || ''

    // Track LLM usage in Polar (async, don't block response)
    if (llmData.usage?.total_tokens) {
      trackLLMUsage(session.user.id, llmData.usage.total_tokens, 'google/gemini-2.0-flash-001').catch((err) => {
        console.warn('[generate-suggestions] Failed to track LLM usage in Polar:', err)
      })
    }

    // Parse response
    try {
      // Try to extract JSON from the response
      let jsonStr = output.trim()

      // Remove markdown code blocks if present
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim()
      }

      // Try to find array in the response
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/)
      if (arrayMatch) {
        const parsed = JSON.parse(arrayMatch[0])

        // Return based on promptKey
        if (promptKey === 'suggest_subreddits') {
          return NextResponse.json({ success: true, subreddits: parsed })
        } else if (promptKey === 'suggest_forums') {
          return NextResponse.json({ success: true, forums: parsed })
        } else {
          return NextResponse.json({ success: true, suggestions: parsed })
        }
      }

      // Try direct parse
      const parsed = JSON.parse(jsonStr)
      if (Array.isArray(parsed)) {
        if (promptKey === 'suggest_subreddits') {
          return NextResponse.json({ success: true, subreddits: parsed })
        } else if (promptKey === 'suggest_forums') {
          return NextResponse.json({ success: true, forums: parsed })
        } else {
          return NextResponse.json({ success: true, suggestions: parsed })
        }
      }

      throw new Error('Could not parse LLM response')
    } catch (parseError) {
      console.error('[generate-suggestions] Parse error:', parseError, 'Output:', output)

      // Return empty result with the raw output for debugging
      if (promptKey === 'suggest_subreddits') {
        return NextResponse.json({
          success: false,
          subreddits: [],
          error: 'Could not parse subreddits',
          raw: output
        })
      } else if (promptKey === 'suggest_forums') {
        return NextResponse.json({
          success: false,
          forums: [],
          error: 'Could not parse forums',
          raw: output
        })
      } else {
        return NextResponse.json({
          success: false,
          suggestions: [],
          error: 'Could not parse suggestions',
          raw: output
        })
      }
    }

  } catch (error) {
    console.error('[generate-suggestions] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
