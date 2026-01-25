import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      console.log('[OpenRouter Status] No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    console.log('[OpenRouter Status] Checking status for user:', userId)

    // 1. Check user's personal token first (OAuth)
    const { data: tokenRecord } = await supabase
      .from('user_openrouter_tokens')
      .select('encrypted_api_key, key_prefix, last_used_at, created_at, expires_at, credit_limit, limit_remaining, usage')
      .eq('user_id', userId)
      .single()

    // If user has a valid personal token, return it
    if (tokenRecord?.key_prefix && tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
      console.log('[OpenRouter Status] User personal token found')
      return NextResponse.json({
        connected: true,
        source: 'user',
        tokenInfo: {
          keyPrefix: tokenRecord.key_prefix,
          lastUsedAt: tokenRecord.last_used_at,
          createdAt: tokenRecord.created_at,
          expiresAt: tokenRecord.expires_at,
          creditLimit: tokenRecord.credit_limit,
          limitRemaining: tokenRecord.limit_remaining,
          usage: tokenRecord.usage,
        },
      })
    }

    // 2. Check agency key
    console.log('[OpenRouter Status] No user token, checking agency...')
    const { data: membership } = await supabase
      .from('agency_members')
      .select('agency_id, agencies(id, name, openrouter_api_key, openrouter_key_hint, openrouter_key_last_used_at)')
      .eq('user_id', userId)
      .single()

    // Supabase returns the relation as an object when using .single() on the parent
    const agencyData = membership?.agencies as unknown as {
      id: string
      name: string
      openrouter_api_key: string | null
      openrouter_key_hint: string | null
      openrouter_key_last_used_at: string | null
    } | null

    if (agencyData?.openrouter_api_key) {
      console.log('[OpenRouter Status] Agency key found for:', agencyData.name)
      return NextResponse.json({
        connected: true,
        source: 'agency',
        agencyName: agencyData.name,
        tokenInfo: {
          keyPrefix: agencyData.openrouter_key_hint || '***agency***',
          lastUsedAt: agencyData.openrouter_key_last_used_at,
          createdAt: null,
          expiresAt: null,
          creditLimit: null,
          limitRemaining: null,
          usage: null,
        },
      })
    }

    // 3. No key available
    console.log('[OpenRouter Status] No key found')
    return NextResponse.json({
      connected: false,
      tokenInfo: null,
    })
  } catch (error) {
    console.error('[OpenRouter Status] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
