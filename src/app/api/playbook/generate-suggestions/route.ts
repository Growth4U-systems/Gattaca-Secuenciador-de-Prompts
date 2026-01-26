import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'
import { trackLLMUsage } from '@/lib/polar-usage'
import { parseLLMArrayResponse } from '@/lib/llm-parser'

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
        // Build context-aware prompt for product-specific need words
        const hasContext = product || target || industry
        prompt = hasContext
          ? `Eres un experto en investigación de mercado y Jobs To Be Done (JTBD).

**PRODUCTO/SERVICIO:** ${product || 'No especificado'}
${target ? `**PÚBLICO OBJETIVO:** ${target}` : ''}
${industry ? `**INDUSTRIA:** ${industry}` : ''}

**TU TAREA:**
1. Analiza qué hace este producto y qué problemas resuelve
2. Identifica los Jobs To Be Done (JTBD) que cubre
3. Traduce esas funcionalidades/JTBD a PALABRAS que las personas usan cuando tienen esa necesidad

**QUÉ SON LAS PALABRAS DE NECESIDAD:**
Son los sustantivos y términos que las personas mencionan cuando hablan de su problema o necesidad, ANTES de conocer la solución.

**PROCESO DE TRANSFORMACIÓN (ejemplos):**

Producto: "App de facturación para freelancers"
- Funcionalidad: Crear facturas automáticas → Palabra: "facturas"
- Funcionalidad: Calcular impuestos → Palabras: "impuestos", "IVA", "retenciones"
- JTBD: Cobrar más rápido → Palabras: "cobros", "clientes morosos", "pagos pendientes"
- JTBD: Controlar gastos → Palabras: "gastos", "deducciones", "recibos"

Producto: "CRM para inmobiliarias"
- Funcionalidad: Gestionar propiedades → Palabras: "propiedades", "inmuebles", "cartera"
- Funcionalidad: Seguimiento de clientes → Palabras: "prospectos", "visitas", "cierres"
- JTBD: Vender más rápido → Palabras: "ventas", "comisiones", "exclusivas"

**GENERA 10-15 palabras de necesidad para este producto específico.**

Piensa en al menos 10 palabras: "¿Qué palabras usa alguien que tiene el problema que este producto resuelve?"

**Formato:** Array JSON de strings. Solo la lista, sin explicaciones.

Responde SOLO con el array JSON:`
          : `Genera una lista de 10-15 palabras de necesidad genéricas comunes en negocios.

Ejemplos: "costos", "tiempo", "clientes", "ventas", "reportes", "datos", "equipo", "procesos"

**Formato:** Array JSON de strings.

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

    // Parse response using robust parser
    const parseResult = parseLLMArrayResponse<string[]>(output, { truncateRaw: 150 })

    if (parseResult.success && parseResult.data) {
      // Return based on promptKey
      if (promptKey === 'suggest_subreddits') {
        return NextResponse.json({ success: true, subreddits: parseResult.data })
      } else if (promptKey === 'suggest_forums') {
        return NextResponse.json({ success: true, forums: parseResult.data })
      } else {
        return NextResponse.json({ success: true, suggestions: parseResult.data })
      }
    }

    // Parse failed - return error with truncated raw output (no sensitive data leak)
    console.error('[generate-suggestions] Parse error:', parseResult.error)

    if (promptKey === 'suggest_subreddits') {
      return NextResponse.json({
        success: false,
        subreddits: [],
        error: parseResult.error || 'Could not parse subreddits',
      })
    } else if (promptKey === 'suggest_forums') {
      return NextResponse.json({
        success: false,
        forums: [],
        error: parseResult.error || 'Could not parse forums',
      })
    } else {
      return NextResponse.json({
        success: false,
        suggestions: [],
        error: parseResult.error || 'Could not parse suggestions',
      })
    }

  } catch (error) {
    console.error('[generate-suggestions] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
