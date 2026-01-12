/**
 * OpenRouter OAuth PKCE - Initiate Flow
 * POST /api/auth/openrouter
 *
 * Initiates the OAuth PKCE flow by:
 * 1. Generating code verifier and challenge
 * 2. Storing PKCE data temporarily in database
 * 3. Returning the OpenRouter auth URL
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from '@/lib/encryption'

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    const state = generateState()

    // Calculate expiration (10 minutes from now)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Check if user already has an existing token record
    const { data: existingToken } = await supabase
      .from('user_openrouter_tokens')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (existingToken) {
      // Update existing record with PKCE data
      const { error: updateError } = await supabase
        .from('user_openrouter_tokens')
        .update({
          pending_code_verifier: codeVerifier,
          pending_state: state,
          pending_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingToken.id)

      if (updateError) {
        console.error('Error updating PKCE data:', updateError)
        return NextResponse.json(
          { error: 'Failed to initiate OAuth', details: updateError.message },
          { status: 500 }
        )
      }
    } else {
      // Create new record with PKCE data (no encrypted_api_key yet)
      const { error: insertError } = await supabase
        .from('user_openrouter_tokens')
        .insert({
          user_id: userId,
          encrypted_api_key: '', // Will be set after callback
          pending_code_verifier: codeVerifier,
          pending_state: state,
          pending_expires_at: expiresAt,
        })

      if (insertError) {
        console.error('Error creating PKCE data:', insertError)
        return NextResponse.json(
          { error: 'Failed to initiate OAuth', details: insertError.message },
          { status: 500 }
        )
      }
    }

    // Build OpenRouter auth URL
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/openrouter/callback`

    const authUrl = new URL('https://openrouter.ai/auth')
    authUrl.searchParams.set('callback_url', callbackUrl)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString(),
      state,
    })
  } catch (err) {
    console.error('Error initiating OpenRouter OAuth:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/openrouter
 * Get current connection status
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

    const { data, error } = await supabase
      .from('user_openrouter_tokens')
      .select('id, key_prefix, created_at, last_used_at, encrypted_api_key')
      .eq('user_id', userId)
      .single()

    if (error || !data || !data.encrypted_api_key) {
      return NextResponse.json({
        connected: false,
      })
    }

    return NextResponse.json({
      connected: true,
      keyHint: data.key_prefix, // Use key_prefix as the hint
      connectedAt: data.created_at,
      lastUsedAt: data.last_used_at,
    })
  } catch (err) {
    console.error('Error checking OpenRouter status:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/auth/openrouter
 * Disconnect OpenRouter (delete API key)
 */
export async function DELETE(request: NextRequest) {
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

    const { error } = await supabase
      .from('user_openrouter_tokens')
      .delete()
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting OpenRouter key:', error)
      return NextResponse.json(
        { error: 'Failed to disconnect', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'OpenRouter disconnected successfully',
    })
  } catch (err) {
    console.error('Error disconnecting OpenRouter:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
