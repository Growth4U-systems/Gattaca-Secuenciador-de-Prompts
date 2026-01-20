import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Extended request type that supports both component format and direct params
interface SuggestRequest {
  // Component format (from NicheFinderPlaybook)
  type?: 'life_contexts' | 'product_words' | 'thematic_forums'
  existing?: string[]
  life_contexts?: string[]
  product_words?: string[]
  project_id?: string

  // Direct params format (legacy)
  industry?: string
  product_description?: string
  country?: string
  existing_life_contexts?: string[]
  existing_product_words?: string[]

  // Context type configuration (B2B, B2C, or both)
  context_type?: 'personal' | 'business' | 'both'
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Get user session to look up their API key
  let openrouterApiKey: string | null = null
  let keySource = 'none'

  // Helper to validate OpenRouter key format
  const isValidOpenRouterKey = (key: string | null): boolean => {
    return !!key && key.startsWith('sk-or-') && key.length > 20
  }

  try {
    const supabase = await createServerClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    console.log('[suggest] Session check - user:', session?.user?.id, 'error:', sessionError?.message)

    if (session?.user?.id) {
      // 1. Try user_api_keys table first (manual API key entry via Settings > APIs)
      const userKey = await getUserApiKey({
        userId: session.user.id,
        serviceName: 'openrouter',
        supabase,
      })
      if (isValidOpenRouterKey(userKey)) {
        openrouterApiKey = userKey
        keySource = 'user_api_keys'
      }
      console.log('[suggest] getUserApiKey result:', openrouterApiKey ? 'found valid key' : 'no valid key found')

      // 2. Try user_openrouter_tokens table (OAuth flow via "Connect OpenRouter" button)
      if (!openrouterApiKey) {
        console.log('[suggest] Checking user_openrouter_tokens (OAuth)...')
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
              keySource = 'user_openrouter_tokens'
              console.log('[suggest] Found valid OAuth token in user_openrouter_tokens')
            }
          } catch (decryptError) {
            console.warn('[suggest] Failed to decrypt OAuth token:', decryptError)
          }
        } else {
          console.log('[suggest] No OAuth token found')
        }
      }

      // 3. Try agency key
      if (!openrouterApiKey) {
        console.log('[suggest] Checking agency key...')
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
              keySource = 'agency'
              console.log('[suggest] Found valid agency OpenRouter key')
            }
          } catch (decryptError) {
            console.warn('[suggest] Failed to decrypt agency key:', decryptError)
          }
        }
      }
    } else {
      console.log('[suggest] No session found, will fall back to env var')
    }
  } catch (e) {
    console.warn('[suggest] Could not get user session for API key lookup:', e)
  }

  // Fallback to environment variable if no valid user key found
  if (!openrouterApiKey) {
    const envKey = process.env.OPENROUTER_API_KEY || null
    if (isValidOpenRouterKey(envKey)) {
      openrouterApiKey = envKey
      keySource = 'env'
    }
  }

  console.log(`[suggest] OpenRouter key source: ${keySource}, valid: ${!!openrouterApiKey}`)

  if (!openrouterApiKey) {
    console.error('OPENROUTER_API_KEY not configured')
    return NextResponse.json({ success: false, error: 'OpenRouter API key not configured. Please add your API key in Settings > APIs.' }, { status: 500 })
  }

  try {
    const body: SuggestRequest = await request.json()

    // Support both component format and direct params format
    const type = body.type // 'life_contexts' | 'product_words' | undefined

    // Get existing lists from either format
    let existingLifeContexts = body.existing_life_contexts || []
    let existingProductWords = body.existing_product_words || []

    // If using component format, populate from existing/life_contexts/product_words
    if (type === 'life_contexts') {
      existingLifeContexts = body.existing || []
      existingProductWords = body.product_words || []
    } else if (type === 'product_words') {
      existingProductWords = body.existing || []
      existingLifeContexts = body.life_contexts || []
    }

    // Get industry, product, country, context_type from body or from project settings
    let industry = body.industry || ''
    let productDescription = body.product_description || ''
    let country = body.country || 'España'
    let contextType = body.context_type || 'both' // 'personal' (B2C), 'business' (B2B), or 'both'

    // If project_id is provided, try to get settings from project
    if (body.project_id && supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { data: project } = await supabase
          .from('projects')
          .select('settings, name, description')
          .eq('id', body.project_id)
          .single()

        if (project?.settings) {
          industry = industry || project.settings.industry || ''
          productDescription = productDescription || project.settings.product || project.description || ''
          country = country || project.settings.country || 'España'
          contextType = body.context_type || project.settings.context_type || 'both'
        }
      } catch (e) {
        console.warn('Could not fetch project settings:', e)
      }
    }

    // Build context examples based on context_type
    const contextExamples = {
      personal: {
        label: 'SITUACIÓN DE VIDA PERSONAL (B2C)',
        examples: '"pareja", "hijos", "casamiento", "mudanza", "divorcio", "jubilación", "embarazo", "universidad", "herencia"',
        description: 'momentos o situaciones de la vida personal donde surge la necesidad'
      },
      business: {
        label: 'SITUACIÓN DE NEGOCIO (B2B)',
        examples: '"startup", "freelance", "pyme", "exportación", "expansión", "contratación", "fusión", "cierre", "inversores"',
        description: 'momentos o situaciones del negocio donde surge la necesidad'
      },
      both: {
        label: 'SITUACIÓN DE VIDA O NEGOCIO',
        examples: '"pareja", "hijos", "jubilación", "startup", "freelance", "pyme", "expansión", "mudanza"',
        description: 'momentos de vida personal O situaciones de negocio donde surge la necesidad'
      }
    }

    const contextConfig = contextExamples[contextType as keyof typeof contextExamples] || contextExamples.both

    const prompt = `Eres un experto en investigación de mercado y descubrimiento de nichos. Tu objetivo es generar parámetros de búsqueda para encontrar NICHOS ESPECÍFICOS de clientes con pain points en foros.

CONTEXTO:
- INDUSTRIA: ${industry || 'general'}
- PRODUCTO/SERVICIO: ${productDescription || 'producto/servicio'}
- PAÍS: ${country}
- TIPO DE CLIENTE: ${contextType === 'personal' ? 'B2C (consumidor final)' : contextType === 'business' ? 'B2B (empresas/negocios)' : 'B2C y B2B'}

${existingLifeContexts.length > 0 ? `CONTEXTOS EXISTENTES (no repetir): ${existingLifeContexts.join(', ')}` : ''}
${existingProductWords.length > 0 ? `PALABRAS DE NECESIDAD EXISTENTES (no repetir): ${existingProductWords.join(', ')}` : ''}

Responde en JSON con esta estructura:
{
  "life_contexts": [
    {"value": "palabra", "category": "personal|business|family|work|events", "reason": "razón breve"}
  ],
  "product_words": [
    {"value": "palabra", "category": "categoría", "reason": "razón breve"}
  ],
  "sources": [
    {"source_type": "reddit|thematic_forum|general_forum", "value": "dominio o subreddit", "life_context": "contexto relacionado", "reason": "razón breve"}
  ]
}

REGLAS CRÍTICAS:

1. CONTEXTOS (life_contexts) - ${contextConfig.label}:
   - UNA SOLA PALABRA que represente ${contextConfig.description}
   - Ejemplos válidos: ${contextConfig.examples}
   - Ejemplos INVÁLIDOS: "recién casados", "pequeña empresa" (son frases, no palabras)
   - La intersección CONTEXTO + NECESIDAD = NICHO ESPECÍFICO

2. PALABRAS DE NECESIDAD (product_words) - PROBLEMA/NECESIDAD relacionada al producto:
   - UNA SOLA PALABRA que represente la necesidad o problema que el producto resuelve
   - Para ${productDescription || 'el producto'}, piensa en qué necesidades/problemas específicos resuelve
   - Ejemplos para un banco: "pagos", "ahorro", "inversión", "facturas", "deudas", "transferencias", "impuestos"
   - Ejemplos para software: "automatización", "integración", "reportes", "escalabilidad", "seguridad"
   - Ejemplos INVÁLIDOS: "falta de dinero", "problemas de pago" (son frases, no palabras)

3. La COMBINACIÓN de contexto + necesidad da nichos específicos:
   - "jubilación" + "ahorro" → personas mayores preocupadas por sus ahorros
   - "startup" + "facturación" → emprendedores con problemas de gestión
   - "mudanza" + "financiación" → personas que necesitan crédito para mudarse

4. Sugiere 5-10 de cada tipo
5. En español (${country})
6. No repitas las existentes
7. Enfócate en encontrar usuarios frustrados con necesidades reales

Responde SOLO con el JSON, sin texto adicional.`

    console.log('Calling OpenRouter API...')
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    console.log('OpenRouter response status:', response.status)

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('OpenRouter error:', response.status, errorBody)
      throw new Error(`OpenRouter error: ${response.status} - ${errorBody.slice(0, 200)}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '{}'

    // Parse JSON from response
    interface ParsedSuggestions {
      life_contexts?: Array<{ value: string; category?: string; reason?: string }>
      product_words?: Array<{ value: string; category?: string; reason?: string }>
      sources?: Array<{ source_type: string; value: string; life_context?: string; reason?: string }>
    }

    let parsedSuggestions: ParsedSuggestions
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      parsedSuggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content)
    } catch (parseError) {
      console.error('Failed to parse LLM response:', content)
      return NextResponse.json(
        { success: false, error: 'Failed to parse suggestions from AI' },
        { status: 500 }
      )
    }

    // If type was specified (component format), return suggestions as simple array
    if (type === 'life_contexts') {
      const suggestions = (parsedSuggestions.life_contexts || [])
        .map(c => c.value)
        .filter(v => v && !existingLifeContexts.includes(v))
      return NextResponse.json({ success: true, suggestions })
    } else if (type === 'product_words') {
      const suggestions = (parsedSuggestions.product_words || [])
        .map(w => w.value)
        .filter(v => v && !existingProductWords.includes(v))
      return NextResponse.json({ success: true, suggestions })
    } else if (type === 'thematic_forums') {
      // Return thematic forums with their context mapping
      const existingForums = body.existing || []
      const forums = (parsedSuggestions.sources || [])
        .filter(s => s.source_type === 'thematic_forum' && s.value && !existingForums.includes(s.value))
        .map(s => ({
          domain: s.value,
          context: s.life_context || '',
          reason: s.reason || '',
        }))
      return NextResponse.json({ success: true, suggestions: forums })
    } else if (type === 'general_forums') {
      // Return general forums (high-traffic, active discussion sites)
      const existingForums = body.existing || []
      const forums = (parsedSuggestions.sources || [])
        .filter(s => s.source_type === 'general_forum' && s.value && !existingForums.includes(s.value))
        .map(s => s.value)
      return NextResponse.json({ success: true, suggestions: forums })
    }

    // Otherwise return full response (legacy format)
    return NextResponse.json({ success: true, ...parsedSuggestions })
  } catch (error) {
    console.error('Error getting suggestions:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
