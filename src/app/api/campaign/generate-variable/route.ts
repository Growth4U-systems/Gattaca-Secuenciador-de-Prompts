import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface GenerateVariableRequest {
  variableName: string
  context: Record<string, string>
}

const VARIABLE_PROMPTS: Record<string, (ctx: Record<string, string>) => string> = {
  competitor_name: (ctx) =>
    `Basándote en el siguiente contexto, sugiere el nombre exacto de la empresa competidora.
${ctx.industry ? `Industria: ${ctx.industry}` : ''}
${ctx.company_name ? `Empresa que analiza: ${ctx.company_name}` : ''}
Responde SOLO con el nombre de la empresa, sin explicaciones.`,

  company_name: (ctx) =>
    `Basándote en el siguiente contexto, sugiere un nombre de empresa.
${ctx.industry ? `Industria: ${ctx.industry}` : ''}
${ctx.competitor_name ? `Competidor que analiza: ${ctx.competitor_name}` : ''}
Responde SOLO con el nombre de la empresa, sin explicaciones.`,

  industry: (ctx) =>
    `¿En qué industria o sector opera esta empresa?
${ctx.competitor_name ? `Competidor: ${ctx.competitor_name}` : ''}
${ctx.company_name ? `Empresa: ${ctx.company_name}` : ''}
${ctx.competitor_description ? `Descripción del competidor: ${ctx.competitor_description}` : ''}
Responde con una descripción corta del sector (2-5 palabras), sin explicaciones.`,

  competitor_description: (ctx) =>
    `Genera una breve descripción del negocio de este competidor (1-2 frases).
${ctx.competitor_name ? `Competidor: ${ctx.competitor_name}` : 'Competidor no especificado'}
${ctx.industry ? `Industria: ${ctx.industry}` : ''}
${ctx.country ? `País: ${ctx.country}` : ''}
Responde SOLO con la descripción, sin introducción ni explicación.`,

  company_description: (ctx) =>
    `Genera una breve descripción de esta empresa (1-2 frases).
${ctx.company_name ? `Empresa: ${ctx.company_name}` : 'Empresa no especificada'}
${ctx.industry ? `Industria: ${ctx.industry}` : ''}
${ctx.country ? `País: ${ctx.country}` : ''}
Responde SOLO con la descripción, sin introducción ni explicación.`,

  country: (ctx) =>
    `¿En qué país o región opera principalmente esta empresa?
${ctx.competitor_name ? `Competidor: ${ctx.competitor_name}` : ''}
${ctx.company_name ? `Empresa: ${ctx.company_name}` : ''}
${ctx.industry ? `Industria: ${ctx.industry}` : ''}
Responde SOLO con el nombre del país o región, sin explicaciones.`,

  target_audience: (ctx) =>
    `Describe la audiencia objetivo o segmento principal de este competidor (1-2 frases).
${ctx.competitor_name ? `Competidor: ${ctx.competitor_name}` : 'Competidor no especificado'}
${ctx.industry ? `Industria: ${ctx.industry}` : ''}
${ctx.competitor_description ? `Descripción: ${ctx.competitor_description}` : ''}
${ctx.country ? `País: ${ctx.country}` : ''}
Responde SOLO con la descripción de la audiencia, sin introducción ni explicación.`,
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (!session || sessionError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Resolve OpenRouter API key (same 4-tier fallback as generate-suggestions)
  let openrouterApiKey: string | null = null

  const isValidKey = (key: string | null): boolean =>
    !!key && key.startsWith('sk-or-') && key.length > 20

  // 1. User personal key
  const userKey = await getUserApiKey({
    userId: session.user.id,
    serviceName: 'openrouter',
    supabase,
  })
  if (isValidKey(userKey)) openrouterApiKey = userKey

  // 2. OAuth token
  if (!openrouterApiKey) {
    const { data: tokenRecord } = await supabase
      .from('user_openrouter_tokens')
      .select('encrypted_api_key')
      .eq('user_id', session.user.id)
      .single()

    if (tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
      try {
        const oauthKey = decryptToken(tokenRecord.encrypted_api_key)
        if (isValidKey(oauthKey)) openrouterApiKey = oauthKey
      } catch { /* ignore */ }
    }
  }

  // 3. Agency key
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
        if (isValidKey(agencyKey)) openrouterApiKey = agencyKey
      } catch { /* ignore */ }
    }
  }

  // 4. Environment fallback
  if (!openrouterApiKey) {
    const envKey = process.env.OPENROUTER_API_KEY || null
    if (isValidKey(envKey)) openrouterApiKey = envKey
  }

  if (!openrouterApiKey) {
    return NextResponse.json({
      error: 'API key de OpenRouter no configurada.'
    }, { status: 500 })
  }

  try {
    const body: GenerateVariableRequest = await request.json()
    const { variableName, context } = body

    const promptBuilder = VARIABLE_PROMPTS[variableName]
    if (!promptBuilder) {
      return NextResponse.json({ error: `Variable desconocida: ${variableName}` }, { status: 400 })
    }

    // Filter out the target variable from context to avoid circular prompts
    const filteredContext = { ...context }
    delete filteredContext[variableName]

    // Check if we have enough context to generate something useful
    const hasAnyContext = Object.values(filteredContext).some(v => v?.trim())
    if (!hasAnyContext && ['competitor_description', 'company_description', 'target_audience', 'industry', 'country'].includes(variableName)) {
      return NextResponse.json({
        error: 'Completa al menos un campo (nombre del competidor o empresa) para poder generar este campo automáticamente.'
      }, { status: 400 })
    }

    const prompt = promptBuilder(filteredContext)

    const llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
        temperature: 0.5,
      }),
    })

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text()
      throw new Error(`OpenRouter error: ${llmResponse.status} - ${errorText.slice(0, 200)}`)
    }

    const llmData = await llmResponse.json()
    const output = (llmData.choices?.[0]?.message?.content || '').trim()

    // Clean up common LLM quirks (quotes, trailing periods for short answers)
    const cleaned = output
      .replace(/^["']|["']$/g, '')
      .replace(/\n+/g, ' ')
      .trim()

    return NextResponse.json({ success: true, value: cleaned })
  } catch (error) {
    console.error('[generate-variable] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
