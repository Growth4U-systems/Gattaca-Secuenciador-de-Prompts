import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { decryptToken } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

/**
 * Refresh token information from OpenRouter
 * This endpoint fetches the latest token info from OpenRouter's API
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    console.log('[OpenRouter Refresh] Refreshing token info for user:', userId)

    // Get the encrypted token from database
    const { data: tokenRecord, error: fetchError } = await supabase
      .from('user_openrouter_tokens')
      .select('encrypted_api_key')
      .eq('user_id', userId)
      .single()

    if (fetchError || !tokenRecord?.encrypted_api_key) {
      console.log('[OpenRouter Refresh] No token found')
      return NextResponse.json({ error: 'No token found' }, { status: 404 })
    }

    // Decrypt the API key
    const apiKey = decryptToken(tokenRecord.encrypted_api_key)

    // Fetch current key info from OpenRouter
    console.log('[OpenRouter Refresh] Fetching key info from OpenRouter API')
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[OpenRouter Refresh] API error:', response.status, errorText)
      return NextResponse.json(
        { error: `OpenRouter API error: ${response.status}` },
        { status: response.status }
      )
    }

    const keyData = await response.json()
    console.log('[OpenRouter Refresh] Received key data from OpenRouter:', {
      hasData: !!keyData.data,
      allKeys: keyData.data ? Object.keys(keyData.data) : [],
      fullData: keyData
    })

    // The response structure is { data: { ... } }
    const data = keyData.data

    // Update the database with the latest information
    // Note: OpenRouter returns usage in a different scale, we need to check the actual value
    // The limit and limit_remaining are typically in dollars
    // Log the raw values to debug
    console.log('[OpenRouter Refresh] Raw values from API:', {
      usage: data.usage,
      limit: data.limit,
      limit_remaining: data.limit_remaining,
    })

    const updateData: any = {
      expires_at: data.expires_at || null,
      credit_limit: data.limit !== undefined ? data.limit : null,
      limit_remaining: data.limit_remaining !== undefined ? data.limit_remaining : null,
      // Usage from OpenRouter - store as-is, the actual value should match their dashboard
      usage: data.usage !== undefined ? data.usage : null,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    console.log('[OpenRouter Refresh] Updating database with:', updateData)

    const { error: updateError } = await supabase
      .from('user_openrouter_tokens')
      .update(updateData)
      .eq('user_id', userId)

    if (updateError) {
      console.error('[OpenRouter Refresh] Database update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update token info' },
        { status: 500 }
      )
    }

    console.log('[OpenRouter Refresh] Successfully updated token info')
    return NextResponse.json({
      success: true,
      tokenInfo: {
        expiresAt: updateData.expires_at,
        creditLimit: updateData.credit_limit,
        limitRemaining: updateData.limit_remaining,
        usage: updateData.usage,
      },
    })
  } catch (error) {
    console.error('[OpenRouter Refresh] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
