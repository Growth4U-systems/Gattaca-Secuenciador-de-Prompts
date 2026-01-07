import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { generateCodeVerifier, generateCodeChallenge, generateState } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    const state = generateState()

    // Store PKCE data temporarily (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Check if user already has a token record
    const { data: existingToken } = await supabase
      .from('user_openrouter_tokens')
      .select('id')
      .eq('user_id', userId)
      .single()

    let upsertError
    if (existingToken) {
      // Update existing record with pending OAuth data
      const { error } = await supabase
        .from('user_openrouter_tokens')
        .update({
          pending_code_verifier: codeVerifier,
          pending_state: state,
          pending_expires_at: expiresAt,
        })
        .eq('user_id', userId)
      upsertError = error
    } else {
      // Create new record with placeholder encrypted_api_key
      const { error } = await supabase
        .from('user_openrouter_tokens')
        .insert({
          user_id: userId,
          encrypted_api_key: 'PENDING', // Placeholder until callback completes
          pending_code_verifier: codeVerifier,
          pending_state: state,
          pending_expires_at: expiresAt,
        })
      upsertError = error
    }

    if (upsertError) {
      console.error('Error storing PKCE data:', upsertError)
      return NextResponse.json(
        { error: 'Failed to initiate OAuth flow' },
        { status: 500 }
      )
    }

    // Build OpenRouter OAuth URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const callbackUrl = `${appUrl}/api/openrouter/callback`

    const openRouterAuthUrl = new URL('https://openrouter.ai/auth')
    openRouterAuthUrl.searchParams.set('callback_url', callbackUrl)
    openRouterAuthUrl.searchParams.set('code_challenge', codeChallenge)
    openRouterAuthUrl.searchParams.set('code_challenge_method', 'S256')

    // Create response with state cookie for CSRF validation
    const response = NextResponse.json({
      authUrl: openRouterAuthUrl.toString(),
    })

    // Set state in a secure, httpOnly cookie for CSRF validation in callback
    response.cookies.set('openrouter_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60, // 10 minutes, same as pending_expires_at
      path: '/',
    })

    return response
  } catch (error) {
    console.error('OpenRouter initiate error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
