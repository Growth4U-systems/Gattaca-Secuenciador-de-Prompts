/**
 * OpenRouter OAuth PKCE - Callback Handler
 * GET /api/auth/openrouter/callback
 *
 * Handles the OAuth callback by:
 * 1. Receiving the authorization code from OpenRouter
 * 2. Exchanging the code for an API key using PKCE
 * 3. Encrypting and storing the API key
 * 4. Redirecting back to the app
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  // Base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const settingsUrl = `${baseUrl}/settings`

  // Handle errors from OpenRouter
  const error = searchParams.get('error')
  if (error) {
    console.error('OpenRouter OAuth error:', error)
    return NextResponse.redirect(
      `${settingsUrl}?openrouter_error=${encodeURIComponent(error)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${settingsUrl}?openrouter_error=no_code`
    )
  }

  const supabase = getSupabaseClient()

  try {
    // Find the pending OAuth request by state or by most recent pending request
    let query = supabase
      .from('user_openrouter_tokens')
      .select('id, user_id, pending_code_verifier, pending_state, pending_expires_at')
      .not('pending_code_verifier', 'is', null)

    if (state) {
      query = query.eq('pending_state', state)
    }

    const { data: pendingRecords, error: fetchError } = await query.limit(10)

    if (fetchError) {
      console.error('Error fetching pending OAuth:', fetchError)
      return NextResponse.redirect(
        `${settingsUrl}?openrouter_error=fetch_failed`
      )
    }

    if (!pendingRecords || pendingRecords.length === 0) {
      console.error('No pending OAuth request found')
      return NextResponse.redirect(
        `${settingsUrl}?openrouter_error=no_pending_request`
      )
    }

    // Find a valid pending record (not expired)
    const now = new Date()
    const validRecord = pendingRecords.find(record => {
      if (!record.pending_expires_at) return false
      const expiresAt = new Date(record.pending_expires_at)
      return expiresAt > now
    })

    if (!validRecord) {
      console.error('OAuth request expired')
      return NextResponse.redirect(
        `${settingsUrl}?openrouter_error=expired`
      )
    }

    const codeVerifier = validRecord.pending_code_verifier

    // Exchange code for API key with OpenRouter
    const tokenResponse = await fetch('https://openrouter.ai/api/v1/auth/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('OpenRouter token exchange failed:', tokenResponse.status, errorText)
      return NextResponse.redirect(
        `${settingsUrl}?openrouter_error=exchange_failed`
      )
    }

    const tokenData = await tokenResponse.json()
    const apiKey = tokenData.key

    if (!apiKey) {
      console.error('No API key in response:', tokenData)
      return NextResponse.redirect(
        `${settingsUrl}?openrouter_error=no_key_received`
      )
    }

    // Encrypt the API key
    const { encryptedKey } = encryptAPIKey(apiKey)
    const keyPrefix = generateKeyPrefix(apiKey)

    // Update the record with the encrypted key and clear pending data
    const { error: updateError } = await supabase
      .from('user_openrouter_tokens')
      .update({
        encrypted_api_key: encryptedKey,
        key_prefix: keyPrefix,
        // Clear pending data
        pending_code_verifier: null,
        pending_state: null,
        pending_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validRecord.id)

    if (updateError) {
      console.error('Error storing API key:', updateError)
      return NextResponse.redirect(
        `${settingsUrl}?openrouter_error=storage_failed`
      )
    }

    // Optional: Fetch credits/balance info from OpenRouter
    try {
      const creditsResponse = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      })

      if (creditsResponse.ok) {
        const creditsData = await creditsResponse.json()
        // Could store additional metadata here
        console.log('OpenRouter key metadata:', {
          limit: creditsData.data?.limit,
          usage: creditsData.data?.usage,
        })
      }
    } catch (creditsError) {
      // Non-critical, just log
      console.warn('Could not fetch credits info:', creditsError)
    }

    // Success! Redirect back to settings
    return NextResponse.redirect(
      `${settingsUrl}?openrouter_success=true`
    )
  } catch (err) {
    console.error('Unexpected error in OAuth callback:', err)
    return NextResponse.redirect(
      `${settingsUrl}?openrouter_error=internal_error`
    )
  }
}
