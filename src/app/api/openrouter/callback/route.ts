import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { encryptToken, getKeyPrefix } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    console.log('[OpenRouter Callback] Received callback with code:', !!code)

    if (!code) {
      console.error('[OpenRouter Callback] No authorization code received')
      return NextResponse.redirect(
        `${appUrl}?openrouter_error=${encodeURIComponent('No authorization code received')}`
      )
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      console.error('[OpenRouter Callback] No session found')
      return NextResponse.redirect(
        `${appUrl}/login?openrouter_error=${encodeURIComponent('Please login first')}`
      )
    }

    const userId = session.user.id
    console.log('[OpenRouter Callback] Processing callback for user:', userId)

    // Get pending PKCE data including state for CSRF validation
    const { data: tokenRecord, error: fetchError } = await supabase
      .from('user_openrouter_tokens')
      .select('pending_code_verifier, pending_state, pending_expires_at')
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      console.error('[OpenRouter Callback] Error fetching PKCE data:', fetchError.message, fetchError.code)
      return NextResponse.redirect(
        `${appUrl}?openrouter_error=${encodeURIComponent('OAuth flow expired. Please try again.')}`
      )
    }

    if (!tokenRecord) {
      console.error('[OpenRouter Callback] No token record found')
      return NextResponse.redirect(
        `${appUrl}?openrouter_error=${encodeURIComponent('OAuth flow expired. Please try again.')}`
      )
    }

    console.log('[OpenRouter Callback] PKCE data found, expires:', tokenRecord.pending_expires_at)

    // CSRF validation: compare state from cookie with state stored in DB
    const stateCookie = request.cookies.get('openrouter_state')?.value
    if (!stateCookie || !tokenRecord.pending_state || stateCookie !== tokenRecord.pending_state) {
      console.error('[OpenRouter Callback] CSRF validation failed:', {
        hasCookie: !!stateCookie,
        hasDbState: !!tokenRecord.pending_state,
        match: stateCookie === tokenRecord.pending_state
      })
      return NextResponse.redirect(
        `${appUrl}?openrouter_error=${encodeURIComponent('Security validation failed. Please try again.')}`
      )
    }

    // Check if PKCE data is expired
    if (new Date(tokenRecord.pending_expires_at) < new Date()) {
      console.error('[OpenRouter Callback] PKCE data expired')
      return NextResponse.redirect(
        `${appUrl}?openrouter_error=${encodeURIComponent('OAuth flow expired. Please try again.')}`
      )
    }

    // Exchange code for API key with OpenRouter
    console.log('[OpenRouter Callback] Exchanging code for API key')
    console.log('[OpenRouter Callback] Request payload:', {
      code: code.substring(0, 10) + '...',
      code_verifier: tokenRecord.pending_code_verifier.substring(0, 10) + '...'
    })

    const exchangeResponse = await fetch('https://openrouter.ai/api/v1/auth/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        code_verifier: tokenRecord.pending_code_verifier,
        code_challenge_method: 'S256',
      }),
    })

    console.log('[OpenRouter Callback] Exchange response status:', exchangeResponse.status)
    console.log('[OpenRouter Callback] Exchange response headers:', Object.fromEntries(exchangeResponse.headers.entries()))

    if (!exchangeResponse.ok) {
      const errorText = await exchangeResponse.text()
      console.error('[OpenRouter Callback] Key exchange failed:', exchangeResponse.status, errorText)
      return NextResponse.redirect(
        `${appUrl}?openrouter_error=${encodeURIComponent(`OpenRouter error (${exchangeResponse.status}): ${errorText}`)}`
      )
    }

    const keyData = await exchangeResponse.json()
    console.log('[OpenRouter Callback] Received key data:', { hasKey: !!keyData.key, name: keyData.name, label: keyData.label, fullResponse: keyData })
    const apiKey = keyData.key

    if (!apiKey) {
      console.error('[OpenRouter Callback] No API key in response')
      return NextResponse.redirect(
        `${appUrl}?openrouter_error=${encodeURIComponent('No API key received from OpenRouter')}`
      )
    }

    // Encrypt and store the API key
    const encryptedKey = encryptToken(apiKey)
    const keyPrefix = getKeyPrefix(apiKey)

    const now = new Date()

    // Log the full response from OpenRouter to understand what fields are available
    console.log('[OpenRouter Callback] OpenRouter response fields:', {
      hasExpiresAt: keyData.expires_at !== undefined,
      expiresAt: keyData.expires_at,
      hasLimit: keyData.limit !== undefined,
      limit: keyData.limit,
      hasLimitRemaining: keyData.limit_remaining !== undefined,
      limitRemaining: keyData.limit_remaining,
      hasUsage: keyData.usage !== undefined,
      usage: keyData.usage,
      allKeys: Object.keys(keyData)
    })

    const updateData: any = {
      encrypted_api_key: encryptedKey,
      key_prefix: keyPrefix,
      // Use the expires_at field directly from OpenRouter (can be null if no expiration)
      expires_at: keyData.expires_at || null,
      // Store the credit limit if provided by OpenRouter
      credit_limit: keyData.limit !== undefined ? keyData.limit : null,
      // Store remaining credits
      limit_remaining: keyData.limit_remaining !== undefined ? keyData.limit_remaining : null,
      // Store total usage
      usage: keyData.usage !== undefined ? keyData.usage : null,
      pending_code_verifier: null,
      pending_state: null,
      pending_expires_at: null,
      updated_at: now.toISOString(),
    }

    console.log('[OpenRouter Callback] Storing token with:', {
      expiresAt: updateData.expires_at,
      creditLimit: updateData.credit_limit,
      limitRemaining: updateData.limit_remaining,
      usage: updateData.usage
    })

    const { data: updatedData, error: updateError } = await supabase
      .from('user_openrouter_tokens')
      .update(updateData)
      .eq('user_id', userId)
      .select()

    if (updateError) {
      console.error('Error storing API key:', updateError)
      return NextResponse.redirect(
        `${appUrl}?openrouter_error=${encodeURIComponent('Failed to store API key')}`
      )
    }

    // Verify that the update was successful
    if (!updatedData || updatedData.length === 0) {
      console.error('Update did not affect any rows for user:', userId)
      return NextResponse.redirect(
        `${appUrl}?openrouter_error=${encodeURIComponent('Failed to update API key')}`
      )
    }

    console.log('Successfully stored OpenRouter API key for user:', userId, 'with prefix:', keyPrefix)

    // Fetch additional token metadata from OpenRouter API
    try {
      const keyInfoResponse = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      })

      if (keyInfoResponse.ok) {
        const keyInfoData = await keyInfoResponse.json()
        const fullData = keyInfoData.data

        if (fullData) {
          // Update with usage/limit info from OpenRouter
          const metadataUpdate: any = {
            expires_at: fullData.expires_at || null,
            credit_limit: fullData.limit !== undefined ? fullData.limit : null,
            limit_remaining: fullData.limit_remaining !== undefined ? fullData.limit_remaining : null,
            usage: fullData.usage !== undefined ? fullData.usage : null,
            updated_at: new Date().toISOString(),
          }

          await supabase
            .from('user_openrouter_tokens')
            .update(metadataUpdate)
            .eq('user_id', userId)
        }
      }
    } catch (fetchError) {
      console.error('[OpenRouter Callback] Error fetching token metadata:', fetchError)
    }

    // Success! Redirect back to app and clear the state cookie
    const successResponse = NextResponse.redirect(`${appUrl}?openrouter_success=true`)
    successResponse.cookies.delete('openrouter_state')
    return successResponse
  } catch (error) {
    console.error('OpenRouter callback error:', error)
    return NextResponse.redirect(
      `${appUrl}?openrouter_error=${encodeURIComponent('An unexpected error occurred')}`
    )
  }
}
