import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'
import { trackLLMUsage } from '@/lib/polar-usage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface GenerateRequest {
  prompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: 'text' | 'json'
}

export async function POST(request: NextRequest) {
  // Get user session to look up their API key
  let openrouterApiKey: string | null = null
  let userId: string | null = null
  try {
    const supabase = await createServerClient()
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
    console.warn('[llm/generate] Could not get user session:', e)
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
    const body: GenerateRequest = await request.json()
    const { prompt, model = 'openai/gpt-4o-mini', temperature = 0.7, maxTokens = 2000 } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[llm/generate] OpenRouter error:', response.status, errorBody)
      return NextResponse.json(
        { error: `OpenRouter error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Track usage in Polar (async, don't block response)
    if (userId && data.usage?.total_tokens) {
      trackLLMUsage(userId, data.usage.total_tokens, data.model).catch((err) => {
        console.warn('[llm/generate] Failed to track usage:', err)
      })
    }

    return NextResponse.json({
      success: true,
      content,
      model: data.model,
      usage: data.usage,
    })
  } catch (error) {
    console.error('[llm/generate] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
