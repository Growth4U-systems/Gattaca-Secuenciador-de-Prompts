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

    // Fetch key info from OpenRouter
    console.log('[OpenRouter Refresh] Fetching key info from OpenRouter API')
    const keyResponse = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!keyResponse.ok) {
      const errorText = await keyResponse.text()
      console.error('[OpenRouter Refresh] Key API error:', keyResponse.status, errorText)
      return NextResponse.json(
        { error: `OpenRouter API error: ${keyResponse.status}` },
        { status: keyResponse.status }
      )
    }

    const keyData = await keyResponse.json()
    console.log('[OpenRouter Refresh] Key data:', JSON.stringify(keyData))

    // Also fetch credits endpoint for accurate usage
    console.log('[OpenRouter Refresh] Fetching credits from OpenRouter API')
    const creditsResponse = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    let creditsData = null
    if (creditsResponse.ok) {
      creditsData = await creditsResponse.json()
      console.log('[OpenRouter Refresh] Credits data:', JSON.stringify(creditsData))
    } else {
      console.warn('[OpenRouter Refresh] Credits API failed, using key data only')
    }

    // The response structure is { data: { ... } }
    const data = keyData.data

    // Credits endpoint returns: { data: { total_credits, total_usage } }
    // Usage is the difference: total_credits - remaining = used
    // Or directly from credits.data.total_usage
    const totalUsage = creditsData?.data?.total_usage ?? data.usage ?? null

    console.log('[OpenRouter Refresh] Raw values:', {
      keyUsage: data.usage,
      creditsUsage: creditsData?.data?.total_usage,
      totalCredits: creditsData?.data?.total_credits,
      finalUsage: totalUsage,
      limit: data.limit,
      limit_remaining: data.limit_remaining,
    })

    const updateData: any = {
      expires_at: data.expires_at || null,
      credit_limit: data.limit !== undefined ? data.limit : null,
      limit_remaining: data.limit_remaining !== undefined ? data.limit_remaining : null,
      // Use credits endpoint usage (more accurate) or fall back to key usage
      usage: totalUsage,
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
