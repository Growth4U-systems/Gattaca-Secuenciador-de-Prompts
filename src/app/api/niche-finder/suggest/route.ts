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
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Get user session to look up their API key
  let openrouterApiKey: string | null = null
  try {
    const supabase = await createServerClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    console.log('[suggest] Session check - user:', session?.user?.id, 'error:', sessionError?.message)

    if (session?.user?.id) {
      // 1. Try user_api_keys table first (manual API key entry via Settings > APIs)
      openrouterApiKey = await getUserApiKey({
        userId: session.user.id,
        serviceName: 'openrouter',
        supabase,
      })
      console.log('[suggest] getUserApiKey result:', openrouterApiKey ? 'found key' : 'no key found')

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
            openrouterApiKey = decryptToken(tokenRecord.encrypted_api_key)
            console.log('[suggest] Found OAuth token in user_openrouter_tokens')
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
            openrouterApiKey = decryptToken(agencyData.openrouter_api_key)
            console.log('[suggest] Found agency OpenRouter key')
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

  // Fallback to environment variable if no user key found
  if (!openrouterApiKey) {
    openrouterApiKey = process.env.OPENROUTER_API_KEY || null
  }

  console.log('Suggest API called, OpenRouter key exists:', !!openrouterApiKey)

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

    // Get industry, product, country from body or from project settings
    let industry = body.industry || ''
    let productDescription = body.product_description || ''
    let country = body.country || 'España'

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
        }
      } catch (e) {
        console.warn('Could not fetch project settings:', e)
      }
    }

    const prompt = `Eres un experto en investigación de mercado. Genera parámetros de búsqueda para encontrar pain points de clientes en foros.

INDUSTRIA: ${industry || 'general'}
PRODUCTO: ${productDescription || 'producto/servicio'}
PAÍS: ${country}
${existingLifeContexts.length > 0 ? `CONTEXTOS DE VIDA EXISTENTES (no repetir): ${existingLifeContexts.join(', ')}` : ''}
${existingProductWords.length > 0 ? `PALABRAS DE PRODUCTO EXISTENTES (no repetir): ${existingProductWords.join(', ')}` : ''}

Responde en JSON con esta estructura:
{
  "life_contexts": [
    {"value": "palabra", "category": "personal|family|work|events|relationships", "reason": "razón breve"}
  ],
  "product_words": [
    {"value": "palabra", "category": "categoría", "reason": "razón breve"}
  ],
  "sources": [
    {"source_type": "reddit|thematic_forum|general_forum", "value": "dominio o subreddit", "life_context": "contexto relacionado", "reason": "razón breve"}
  ]
}

REGLAS CRÍTICAS:
1. CONTEXTOS DE VIDA: UNA SOLA PALABRA que represente situaciones de vida donde la gente necesita ${productDescription || 'el producto'}
   - Ejemplos válidos: "pareja", "hijos", "casamiento", "mudanza", "divorcio", "jubilación", "embarazo", "universidad"
   - Ejemplos INVÁLIDOS: "recién casados", "padres primerizos", "personas mayores" (son frases, no palabras)

2. PALABRAS DE PRODUCTO: UNA SOLA PALABRA relacionada al producto/problema
   - Ejemplos válidos: "precio", "calidad", "garantía", "reparación", "instalación", "mantenimiento"
   - Ejemplos INVÁLIDOS: "buen precio", "mala calidad", "sin garantía" (son frases, no palabras)

3. Sugiere 5-10 de cada tipo
4. En español (${country})
5. No repitas las existentes
6. Enfócate en usuarios frustrados

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
