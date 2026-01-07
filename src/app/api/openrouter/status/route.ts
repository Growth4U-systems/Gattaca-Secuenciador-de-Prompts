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

    const { data: tokenRecord, error } = await supabase
      .from('user_openrouter_tokens')
      .select('encrypted_api_key, key_prefix, last_used_at, created_at, expires_at, credit_limit, limit_remaining, usage')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.log('[OpenRouter Status] Query error:', error.message, error.code)
      return NextResponse.json({
        connected: false,
        tokenInfo: null,
      })
    }

    if (!tokenRecord) {
      console.log('[OpenRouter Status] No token record found')
      return NextResponse.json({
        connected: false,
        tokenInfo: null,
      })
    }

    console.log('[OpenRouter Status] Token record found:', {
      hasKey: !!tokenRecord.encrypted_api_key,
      keyLength: tokenRecord.encrypted_api_key?.length,
      keyPrefix: tokenRecord.key_prefix,
      isPending: tokenRecord.encrypted_api_key === 'PENDING'
    })

    // Check if there's actually an API key (not just pending OAuth data)
    // The encrypted_api_key should not be empty, 'PENDING', or missing
    if (!tokenRecord.key_prefix || !tokenRecord.encrypted_api_key || tokenRecord.encrypted_api_key === 'PENDING') {
      console.log('[OpenRouter Status] Token not ready - returning disconnected')
      return NextResponse.json({
        connected: false,
        tokenInfo: null,
      })
    }

    console.log('[OpenRouter Status] Token valid - returning connected')
    return NextResponse.json({
      connected: true,
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
  } catch (error) {
    console.error('[OpenRouter Status] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
