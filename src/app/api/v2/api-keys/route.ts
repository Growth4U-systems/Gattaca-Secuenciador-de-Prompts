/**
 * API Keys Management
 * GET /api/v2/api-keys - List all API keys for a user
 * POST /api/v2/api-keys - Add a manual API key
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encryptAPIKey, generateKeyPrefix } from '@/lib/encryption'

export const runtime = 'nodejs'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * GET /api/v2/api-keys
 * List all API keys for a user (without exposing the actual keys)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Get user's personal keys
    const { data: personalKeys, error: personalError } = await supabase
      .from('user_api_keys')
      .select('id, provider, key_hint, key_prefix, connected_at, last_used_at, is_valid, scope')
      .eq('user_id', userId)
      .eq('scope', 'user')
      .order('provider')

    if (personalError) {
      console.error('Error fetching personal keys:', personalError)
      return NextResponse.json(
        { error: 'Failed to fetch keys' },
        { status: 500 }
      )
    }

    // Get agency keys (if user is an agency owner)
    const { data: agencyKeys, error: agencyError } = await supabase
      .from('user_api_keys')
      .select(`
        id, provider, key_hint, key_prefix, connected_at, last_used_at, is_valid, scope,
        agency:agencies!inner(id, name, owner_id)
      `)
      .eq('scope', 'agency')
      .eq('agencies.owner_id', userId)

    // Format response
    const keys = [
      ...(personalKeys || []).map(k => ({
        ...k,
        isAgencyKey: false,
        agencyName: null,
      })),
      ...(agencyKeys || []).map(k => {
        // Handle both array and object forms of the relation
        const agency = Array.isArray(k.agency) ? k.agency[0] : k.agency
        return {
          id: k.id,
          provider: k.provider,
          key_hint: k.key_hint,
          key_prefix: k.key_prefix,
          connected_at: k.connected_at,
          last_used_at: k.last_used_at,
          is_valid: k.is_valid,
          scope: k.scope,
          isAgencyKey: true,
          agencyName: (agency as { name: string } | null)?.name || null,
        }
      }),
    ]

    // Group by provider for easier UI consumption
    const byProvider: Record<string, typeof keys[0] | null> = {
      openrouter: null,
      anthropic: null,
      openai: null,
      google: null,
    }

    for (const key of keys) {
      if (key.is_valid && (!byProvider[key.provider] || !key.isAgencyKey)) {
        // Prefer personal keys over agency keys
        byProvider[key.provider] = key
      }
    }

    return NextResponse.json({
      keys,
      byProvider,
    })
  } catch (err) {
    console.error('Error in GET /api/v2/api-keys:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v2/api-keys
 * Add a manual API key (not through OAuth)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, provider, apiKey, agencyId, scope = 'user' } = body

    if (!userId || !provider || !apiKey) {
      return NextResponse.json(
        { error: 'userId, provider, and apiKey are required' },
        { status: 400 }
      )
    }

    // Validate provider
    const validProviders = ['openrouter', 'anthropic', 'openai', 'google']
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Encrypt the API key
    const { encryptedKey, keyHint } = encryptAPIKey(apiKey)
    const keyPrefix = generateKeyPrefix(apiKey)

    // Check if key already exists
    const { data: existing } = await supabase
      .from('user_api_keys')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single()

    if (existing) {
      // Update existing key
      const { error: updateError } = await supabase
        .from('user_api_keys')
        .update({
          encrypted_key: encryptedKey,
          key_hint: keyHint,
          key_prefix: keyPrefix,
          connected_at: new Date().toISOString(),
          is_valid: true,
          agency_id: scope === 'agency' ? agencyId : null,
          scope,
          // Clear any pending OAuth data
          pending_code_verifier: null,
          pending_state: null,
          pending_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Error updating API key:', updateError)
        return NextResponse.json(
          { error: 'Failed to update key' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'API key updated',
        keyHint,
      })
    } else {
      // Create new key
      const { error: insertError } = await supabase
        .from('user_api_keys')
        .insert({
          user_id: userId,
          provider,
          encrypted_key: encryptedKey,
          key_hint: keyHint,
          key_prefix: keyPrefix,
          connected_at: new Date().toISOString(),
          is_valid: true,
          agency_id: scope === 'agency' ? agencyId : null,
          scope,
        })

      if (insertError) {
        console.error('Error inserting API key:', insertError)
        return NextResponse.json(
          { error: 'Failed to save key' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'API key saved',
        keyHint,
      })
    }
  } catch (err) {
    console.error('Error in POST /api/v2/api-keys:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
