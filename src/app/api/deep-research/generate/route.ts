import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'
import { trackLLMUsage } from '@/lib/polar-usage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Increase timeout for deep research (can take 30-60 seconds)
export const maxDuration = 120

interface DeepResearchRequest {
  project_id: string
  campaign_id?: string
  competitor_name: string
  industry?: string
  country?: string
  prompt?: string
  metadata?: Record<string, unknown>
}

// Default prompt template for competitor deep research
const DEFAULT_PROMPT = `Eres un analista de inteligencia competitiva experto. Investiga a fondo la empresa "{{competitor_name}}" en el sector de {{industry}}.

Busca información actualizada en la web sobre:
1. **Información General**: Historia, fundación, ubicación, tamaño, financiación
2. **Producto/Servicio**: Qué ofrece, propuesta de valor, diferenciadores
3. **Mercado y Clientes**: Segmentos objetivo, tipos de clientes, casos de éxito
4. **Modelo de Negocio**: Pricing, canales de distribución, partnerships
5. **Presencia Digital**: Website, redes sociales, contenido
6. **Noticias Recientes**: Últimos 6 meses de noticias relevantes
7. **Fortalezas y Debilidades**: Análisis basado en evidencia

Formato tu respuesta en markdown con secciones claras.
País/Región de enfoque: {{country}}

IMPORTANTE: Busca información actual y verificable. Cita fuentes cuando sea posible.`

export async function POST(request: NextRequest) {
  // Get user session and API key
  let openrouterApiKey: string | null = null
  let userId: string | null = null

  const supabase = await createServerClient()

  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user?.id) {
      userId = session.user.id

      // 1. Try user_api_keys table first
      openrouterApiKey = await getUserApiKey({
        userId: session.user.id,
        serviceName: 'openrouter',
        supabase,
      })

      // 2. Try user_openrouter_tokens table (OAuth flow)
      if (!openrouterApiKey) {
        const { data: tokenRecord } = await supabase
          .from('user_openrouter_tokens')
          .select('encrypted_api_key')
          .eq('user_id', session.user.id)
          .single()

        if (tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
          try {
            openrouterApiKey = decryptToken(tokenRecord.encrypted_api_key)
          } catch {
            // Ignore decrypt errors
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
            openrouterApiKey = decryptToken(agencyData.openrouter_api_key)
          } catch {
            // Ignore decrypt errors
          }
        }
      }
    }
  } catch (e) {
    console.warn('[deep-research/generate] Could not get user session:', e)
  }

  // Fallback to environment variable
  if (!openrouterApiKey) {
    openrouterApiKey = process.env.OPENROUTER_API_KEY || null
  }

  if (!openrouterApiKey) {
    return NextResponse.json(
      { error: 'OpenRouter API key not configured. Please add your API key in Settings > APIs.' },
      { status: 500 }
    )
  }

  try {
    const body: DeepResearchRequest = await request.json()
    const {
      project_id,
      campaign_id,
      competitor_name,
      industry = 'tecnología',
      country = 'España',
      prompt: customPrompt,
      metadata = {}
    } = body

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    if (!competitor_name) {
      return NextResponse.json({ error: 'competitor_name is required' }, { status: 400 })
    }

    // Build the final prompt
    const promptTemplate = customPrompt || DEFAULT_PROMPT
    const finalPrompt = promptTemplate
      .replace(/\{\{competitor_name\}\}/g, competitor_name)
      .replace(/\{\{industry\}\}/g, industry)
      .replace(/\{\{country\}\}/g, country)

    console.log('[deep-research/generate] Starting deep research for:', competitor_name)

    // Try Gemini 2.0 Flash with web search first (supports grounding)
    // Fall back to GPT-4o if Gemini fails
    let model = 'google/gemini-2.0-flash-001'
    let content = ''
    let usage = null

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
          'X-Title': 'Gattaca Deep Research',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: finalPrompt }],
          max_tokens: 8000,
          temperature: 0.3,
          // Enable web search/grounding for Gemini
          tools: [{
            type: 'function',
            function: {
              name: 'web_search',
              description: 'Search the web for current information',
              parameters: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Search query' }
                },
                required: ['query']
              }
            }
          }],
          tool_choice: 'auto',
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.warn('[deep-research/generate] Gemini error, falling back to GPT-4o:', errorBody)
        throw new Error('Gemini failed')
      }

      const data = await response.json()
      content = data.choices?.[0]?.message?.content || ''
      usage = data.usage
      model = data.model
    } catch (geminiError) {
      // Fallback to GPT-4o
      console.log('[deep-research/generate] Falling back to GPT-4o')
      model = 'openai/gpt-4o'

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
          'X-Title': 'Gattaca Deep Research',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: finalPrompt }],
          max_tokens: 8000,
          temperature: 0.3,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error('[deep-research/generate] GPT-4o error:', response.status, errorBody)
        return NextResponse.json(
          { error: `LLM error: ${response.status}` },
          { status: response.status }
        )
      }

      const data = await response.json()
      content = data.choices?.[0]?.message?.content || ''
      usage = data.usage
      model = data.model
    }

    if (!content) {
      return NextResponse.json(
        { error: 'No content generated' },
        { status: 500 }
      )
    }

    // Save the document to knowledge_base_docs (same table as scrapers for unified matching)
    const documentName = `Deep Research - ${competitor_name} - ${new Date().toISOString().split('T')[0]}`

    const { data: document, error: insertError } = await supabase
      .from('knowledge_base_docs')
      .insert({
        filename: documentName,
        project_id,
        extracted_content: content,
        description: `Investigación profunda sobre ${competitor_name} en el sector ${industry}. Generado con ${model}.`,
        category: 'competitor',
        tags: [competitor_name, 'deep-research', industry],
        source_type: 'ai_generated',
        source_metadata: {
          ...metadata,
          competitor: competitor_name,
          source_type: 'deep_research',
          campaign_id,
          generated_at: new Date().toISOString(),
          model,
          industry,
          country,
        },
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[deep-research/generate] Error saving document:', insertError)
      return NextResponse.json(
        { error: 'Failed to save document' },
        { status: 500 }
      )
    }

    // Track usage in Polar (async, don't block response)
    if (userId && usage?.total_tokens) {
      trackLLMUsage(userId, usage.total_tokens, model).catch((err) => {
        console.warn('[deep-research/generate] Failed to track usage:', err)
      })
    }

    console.log('[deep-research/generate] Success, document_id:', document.id)

    return NextResponse.json({
      success: true,
      document_id: document.id,
      document_name: documentName,
      model,
      content_preview: content.substring(0, 500) + '...',
      usage,
    })
  } catch (error) {
    console.error('[deep-research/generate] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
