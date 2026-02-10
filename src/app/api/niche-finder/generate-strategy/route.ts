import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'
import { calculateTotalQueries, estimateUrlCount } from '@/lib/scraper/query-builder'
import type { ScraperStepConfig } from '@/types/scraper.types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

interface GenerateStrategyRequest {
  company_name: string
  country: string
  context_type: 'personal' | 'business' | 'both'
  project_id: string
  product_docs_summary?: string
}

// 4-tier API key resolution (same as suggest/route.ts)
async function getOpenRouterKey(): Promise<string | null> {
  const isValid = (key: string | null): boolean => !!key && key.startsWith('sk-or-') && key.length > 20

  try {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user?.id) {
      // 1. User personal key
      const userKey = await getUserApiKey({
        userId: session.user.id,
        serviceName: 'openrouter',
        supabase,
      })
      if (isValid(userKey)) return userKey!

      // 2. OAuth token
      const { data: tokenRecord } = await supabase
        .from('user_openrouter_tokens')
        .select('encrypted_api_key')
        .eq('user_id', session.user.id)
        .single()

      if (tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
        try {
          const key = decryptToken(tokenRecord.encrypted_api_key)
          if (isValid(key)) return key
        } catch { /* ignore */ }
      }

      // 3. Agency key
      const { data: membership } = await supabase
        .from('agency_members')
        .select('agency_id, agencies(id, openrouter_api_key)')
        .eq('user_id', session.user.id)
        .single()

      const agencyData = membership?.agencies as unknown as { openrouter_api_key: string | null } | null
      if (agencyData?.openrouter_api_key) {
        try {
          const key = decryptToken(agencyData.openrouter_api_key)
          if (isValid(key)) return key
        } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }

  // 4. Environment variable
  const envKey = process.env.OPENROUTER_API_KEY || null
  return isValid(envKey) ? envKey : null
}

export async function POST(request: NextRequest) {
  const apiKey = await getOpenRouterKey()
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'OpenRouter API key not configured' },
      { status: 500 }
    )
  }

  try {
    const body: GenerateStrategyRequest = await request.json()
    const { company_name, country, context_type, product_docs_summary } = body

    if (!company_name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'company_name is required' },
        { status: 400 }
      )
    }

    const contextTypeLabel = context_type === 'personal'
      ? 'B2C (consumidor final)'
      : context_type === 'business'
        ? 'B2B (empresas/negocios)'
        : 'B2C y B2B'

    const prompt = `Eres un experto en investigaci\u00f3n de mercado y descubrimiento de nichos.

EMPRESA: "${company_name}"
PA\u00cdS: ${country}
TIPO DE CLIENTE: ${contextTypeLabel}
${product_docs_summary ? `\nINFORMACI\u00d3N DEL PRODUCTO:\n${product_docs_summary}\n` : ''}

Tu tarea es generar una estrategia de b\u00fasqueda de nichos para esta empresa. Necesito que:

1. INVESTIGUES la empresa y determines: industria, descripci\u00f3n del producto, audiencia objetivo
2. GENERES "palabras de contexto" - situaciones de vida (B2C) o situaciones empresariales (B2B) que son semi-permanentes:
   - B2C: hijo, pareja, jubilaci\u00f3n, mudanza, universidad, embarazo, divorcio, etc.
   - B2B: PYME, aut\u00f3nomo, freelancer, startup, importadora, empresa familiar, etc.
   - Genera 10-15 palabras. UNA SOLA PALABRA cada una.
3. GENERES "palabras de necesidad" - relacionadas con lo que el producto/servicio resuelve (NO el producto en s\u00ed, sino las necesidades):
   - Ejemplo para un banco: ahorro, pago, inversi\u00f3n, factura, deuda, transferencia, impuestos
   - Ejemplo para software de RRHH: contrataci\u00f3n, n\u00f3minas, vacaciones, evaluaci\u00f3n, onboarding
   - Genera 8-12 palabras. UNA SOLA PALABRA cada una.
4. SUGIERE fuentes de b\u00fasqueda:
   - Subreddits relevantes en espa\u00f1ol (r/spain, r/es, r/SpainFinance, etc.)
   - Foros tem\u00e1ticos (bodas.net, rankia.com, idealista.com/foro, etc.)
   - Foros generales (forocoches.com, mediavida.com, burbuja.info)

Responde SOLO con este JSON:
{
  "company_info": {
    "industry": "industria detectada",
    "product_description": "descripci\u00f3n corta del producto/servicio",
    "target_audience": "audiencia principal"
  },
  "life_contexts": [
    {"value": "palabra", "category": "familia|trabajo|finanzas|vida|educacion|salud|empresa|mercado|equipo", "reason": "raz\u00f3n breve"}
  ],
  "benefit_words": [
    {"value": "palabra", "category": "categor\u00eda del beneficio", "reason": "raz\u00f3n breve"}
  ],
  "sources": {
    "reddit": {"enabled": true, "subreddits": ["r/spain", "r/es"]},
    "thematic_forums": [{"domain": "foro.com", "reason": "raz\u00f3n"}],
    "general_forums": ["forocoches.com", "mediavida.com", "burbuja.info"]
  }
}`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`LLM error ${response.status}: ${error.slice(0, 200)}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '{}'

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { success: false, error: 'Failed to parse strategy from AI' },
        { status: 500 }
      )
    }

    const strategy = JSON.parse(jsonMatch[0])

    // Calculate cost estimate using existing utilities
    const lifeContextValues = (strategy.life_contexts || []).map((c: { value: string }) => c.value)
    const benefitWordValues = (strategy.benefit_words || []).map((w: { value: string }) => w.value)

    const config: ScraperStepConfig = {
      life_contexts: lifeContextValues,
      product_words: benefitWordValues,
      indicators: [],
      sources: {
        reddit: strategy.sources?.reddit?.enabled ?? true,
        thematic_forums: (strategy.sources?.thematic_forums?.length || 0) > 0,
        general_forums: strategy.sources?.general_forums || ['forocoches.com', 'mediavida.com'],
      },
      serp_pages: 5,
      batch_size: 10,
      extraction_prompt: '',
      extraction_model: 'openai/gpt-4o-mini',
    }

    const totalCombinations = lifeContextValues.length * benefitWordValues.length
    const totalQueries = calculateTotalQueries(config)
    const estimatedUrls = estimateUrlCount(config)
    const serpCost = totalQueries * 5 * 0.003
    const firecrawlCost = estimatedUrls * 0.001
    const llmCost = estimatedUrls * 0.0002
    const totalCost = serpCost + firecrawlCost + llmCost

    return NextResponse.json({
      success: true,
      ...strategy,
      estimated_combinations: totalCombinations,
      estimated_cost: Math.round(totalCost * 1000) / 1000,
    })
  } catch (error) {
    console.error('Error generating strategy:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
