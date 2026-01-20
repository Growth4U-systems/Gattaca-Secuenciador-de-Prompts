import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
  // Get OpenRouter API key (now the only key needed - supports Perplexity models)
  let openrouterApiKey: string | null = null

  try {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user?.id) {
      // 1. Get OpenRouter key from user_api_keys table (manual entry via Settings > APIs)
      openrouterApiKey = await getUserApiKey({
        userId: session.user.id,
        serviceName: 'openrouter',
        supabase,
      })
      console.log('[deep-search] user_api_keys - openrouter:', !!openrouterApiKey)

      // 2. If no OpenRouter key from user_api_keys, check OAuth tokens
      if (!openrouterApiKey) {
        console.log('[deep-search] Checking user_openrouter_tokens (OAuth)...')
        const { data: tokenRecord } = await supabase
          .from('user_openrouter_tokens')
          .select('encrypted_api_key')
          .eq('user_id', session.user.id)
          .single()

        if (tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
          try {
            openrouterApiKey = decryptToken(tokenRecord.encrypted_api_key)
            console.log('[deep-search] Found OAuth token in user_openrouter_tokens')
          } catch (decryptError) {
            console.warn('[deep-search] Failed to decrypt OAuth token:', decryptError)
          }
        }
      }

      // 3. If still no OpenRouter key, check agency key
      if (!openrouterApiKey) {
        console.log('[deep-search] Checking agency key...')
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
            console.log('[deep-search] Found agency OpenRouter key')
          } catch (decryptError) {
            console.warn('[deep-search] Failed to decrypt agency key:', decryptError)
          }
        }
      }
    }
  } catch (e) {
    console.warn('Could not get user session for API key lookup:', e)
  }

  // Fallback to environment variable
  if (!openrouterApiKey) {
    openrouterApiKey = process.env.OPENROUTER_API_KEY || null
  }

  console.log('Deep search API called, OpenRouter key exists:', !!openrouterApiKey)

  if (!openrouterApiKey) {
    console.error('No OpenRouter API key configured for deep search')
    return NextResponse.json(
      { success: false, error: 'No API key configured for deep search. Please add your OpenRouter API key in Settings > APIs.' },
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

    // Use OpenRouter with Perplexity Sonar Deep Research model (has web search built-in)
    console.log('Using OpenRouter with perplexity/sonar-deep-research...')
    const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://gattaca.growth4u.ai',
        'X-Title': 'Gattaca Niche Finder',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar-deep-research', // Deep research with web search
        messages: [
          {
            role: 'system',
            content: 'Eres un investigador de mercado experto en encontrar comunidades online activas. Respondes SOLO con JSON válido, sin markdown ni texto adicional.'
          },
          { role: 'user', content: searchPrompt }
        ],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    })

    console.log('OpenRouter response status:', openrouterResponse.status)

    if (!openrouterResponse.ok) {
      const errorBody = await openrouterResponse.text()
      console.error('OpenRouter error:', openrouterResponse.status, errorBody.slice(0, 500))

      // If sonar-deep-research fails, try sonar as fallback
      if (openrouterResponse.status === 400 || openrouterResponse.status === 404) {
        console.log('Trying fallback to perplexity/sonar...')
        const fallbackResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://gattaca.growth4u.ai',
            'X-Title': 'Gattaca Niche Finder',
          },
          body: JSON.stringify({
            model: 'perplexity/sonar', // Lighter model with web search
            messages: [
              {
                role: 'system',
                content: 'Eres un investigador de mercado experto. Respondes SOLO con JSON válido.'
              },
              { role: 'user', content: searchPrompt }
            ],
            max_tokens: 2000,
            temperature: 0.3,
          }),
        })

        if (!fallbackResponse.ok) {
          const fallbackError = await fallbackResponse.text()
          console.error('Fallback error:', fallbackResponse.status, fallbackError.slice(0, 200))
          throw new Error(`OpenRouter error: ${openrouterResponse.status}`)
        }

        const fallbackData = await fallbackResponse.json()
        const fallbackContent = fallbackData.choices?.[0]?.message?.content || '[]'
        forums = parseForumsFromResponse(fallbackContent, existing_forums)
        console.log('Fallback sonar returned', forums.length, 'forums')

        return NextResponse.json({
          success: true,
          forums,
          source: 'openrouter-sonar'
        })
      }

      throw new Error(`OpenRouter error: ${openrouterResponse.status}`)
    }

    const data = await openrouterResponse.json()
    const content = data.choices?.[0]?.message?.content || '[]'
    console.log('OpenRouter content length:', content.length)
    forums = parseForumsFromResponse(content, existing_forums)
    console.log('OpenRouter returned', forums.length, 'forums')

    return NextResponse.json({
      success: true,
      forums,
      source: 'openrouter-sonar-deep-research'
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
