/**
 * API Keys Management - Single Provider
 * GET /api/v2/api-keys/[provider] - Get key for specific provider
 * DELETE /api/v2/api-keys/[provider] - Delete key for specific provider
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decryptAPIKey } from '@/lib/encryption'

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

interface RouteParams {
  params: Promise<{ provider: string }>
}

/**
 * GET /api/v2/api-keys/[provider]
 * Get status for a specific provider
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { provider } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Get user's key for this provider
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('id, key_hint, key_prefix, connected_at, last_used_at, is_valid, scope')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_valid', true)
      .single()

    if (error || !data) {
      return NextResponse.json({
        connected: false,
        provider,
      })
    }

    return NextResponse.json({
      connected: true,
      provider,
      keyHint: data.key_hint,
      keyPrefix: data.key_prefix,
      connectedAt: data.connected_at,
      lastUsedAt: data.last_used_at,
      scope: data.scope,
    })
  } catch (err) {
    console.error('Error in GET /api/v2/api-keys/[provider]:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v2/api-keys/[provider]
 * Delete key for a specific provider
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { provider } = await params
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
      .from('user_api_keys')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider)

    if (error) {
      console.error('Error deleting API key:', error)
      return NextResponse.json(
        { error: 'Failed to delete key' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${provider} key deleted`,
    })
  } catch (err) {
    console.error('Error in DELETE /api/v2/api-keys/[provider]:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
