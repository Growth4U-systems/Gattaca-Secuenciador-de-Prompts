import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@/lib/supabase-server-admin'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const adminClient = createAdminClient()

  // Get session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (!session || sessionError) {
    return NextResponse.json({
      authenticated: false,
      error: sessionError?.message,
    })
  }

  // Helper to validate OpenRouter key format
  const isValidKey = (key: string | null): boolean => {
    return !!key && key.startsWith('sk-or-') && key.length > 20
  }

  // Check all key sources
  const keySources: Record<string, { found: boolean; valid: boolean; prefix?: string; error?: string }> = {}

  // 1. user_api_keys table
  const userApiKey = await getUserApiKey({
    userId: session.user.id,
    serviceName: 'openrouter',
    supabase: adminClient,
  })
  keySources.user_api_keys = {
    found: !!userApiKey,
    valid: isValidKey(userApiKey),
    prefix: userApiKey?.substring(0, 15),
  }

  // 2. user_openrouter_tokens (OAuth)
  const { data: tokenRecord, error: tokenError } = await adminClient
    .from('user_openrouter_tokens')
    .select('encrypted_api_key, key_prefix, created_at')
    .eq('user_id', session.user.id)
    .single()

  if (tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
    try {
      const oauthKey = decryptToken(tokenRecord.encrypted_api_key)
      keySources.user_openrouter_tokens = {
        found: true,
        valid: isValidKey(oauthKey),
        prefix: oauthKey?.substring(0, 15),
      }
    } catch (e) {
      keySources.user_openrouter_tokens = {
        found: true,
        valid: false,
        error: 'Decryption failed',
      }
    }
  } else {
    keySources.user_openrouter_tokens = {
      found: false,
      valid: false,
      error: tokenError?.message || (tokenRecord?.encrypted_api_key === 'PENDING' ? 'Token pending' : 'Not found'),
    }
  }

  // 3. agency key
  const { data: membership } = await adminClient
    .from('agency_members')
    .select('agency_id, agencies(id, name, openrouter_api_key)')
    .eq('user_id', session.user.id)
    .single()

  const agencyData = membership?.agencies as unknown as {
    id: string
    name: string
    openrouter_api_key: string | null
  } | null

  if (agencyData?.openrouter_api_key) {
    try {
      const agencyKey = decryptToken(agencyData.openrouter_api_key)
      keySources.agency = {
        found: true,
        valid: isValidKey(agencyKey),
        prefix: agencyKey?.substring(0, 15),
      }
    } catch (e) {
      keySources.agency = {
        found: true,
        valid: false,
        error: 'Decryption failed',
      }
    }
  } else {
    keySources.agency = {
      found: false,
      valid: false,
    }
  }

  // 4. env
  keySources.env = {
    found: !!process.env.OPENROUTER_API_KEY,
    valid: isValidKey(process.env.OPENROUTER_API_KEY || null),
    prefix: process.env.OPENROUTER_API_KEY?.substring(0, 15),
  }

  // Determine which key would be used
  let activeSource = 'none'
  if (keySources.user_api_keys.valid) activeSource = 'user_api_keys'
  else if (keySources.user_openrouter_tokens.valid) activeSource = 'user_openrouter_tokens'
  else if (keySources.agency.valid) activeSource = 'agency'
  else if (keySources.env.valid) activeSource = 'env'

  return NextResponse.json({
    authenticated: true,
    userId: session.user.id,
    userEmail: session.user.email,
    activeKeySource: activeSource,
    keySources,
    tokenInfo: tokenRecord ? {
      keyPrefix: tokenRecord.key_prefix,
      createdAt: tokenRecord.created_at,
    } : null,
  })
}
