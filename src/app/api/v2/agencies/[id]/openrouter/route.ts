/**
 * Agency OpenRouter API Key Management
 *
 * GET /api/v2/agencies/[id]/openrouter - Get status of agency's OpenRouter key
 * POST /api/v2/agencies/[id]/openrouter - Set/update agency's OpenRouter key
 * DELETE /api/v2/agencies/[id]/openrouter - Remove agency's OpenRouter key
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encryptAPIKey, generateKeyHint } from '@/lib/encryption'

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
 * GET /api/v2/agencies/[id]/openrouter
 * Get status of agency's OpenRouter configuration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agencyId } = await params
    const supabase = getSupabaseClient()

    const { data: agency, error } = await supabase
      .from('agencies')
      .select('id, name, openrouter_api_key, openrouter_key_hint, openrouter_key_last_used_at')
      .eq('id', agencyId)
      .single()

    if (error || !agency) {
      return NextResponse.json(
        { error: 'Agency not found' },
        { status: 404 }
      )
    }

    // Get member count for this agency
    const { count: memberCount } = await supabase
      .from('agency_members')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId)

    return NextResponse.json({
      configured: !!agency.openrouter_api_key,
      keyHint: agency.openrouter_key_hint,
      lastUsedAt: agency.openrouter_key_last_used_at,
      memberCount: memberCount || 0,
      agencyName: agency.name,
    })
  } catch (err) {
    console.error('Error in GET /api/v2/agencies/[id]/openrouter:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v2/agencies/[id]/openrouter
 * Set or update agency's OpenRouter API key
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agencyId } = await params
    const body = await request.json()
    const { apiKey } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: 'apiKey is required' },
        { status: 400 }
      )
    }

    // Validate API key format (OpenRouter keys start with sk-or-)
    if (!apiKey.startsWith('sk-or-')) {
      return NextResponse.json(
        { error: 'Invalid OpenRouter API key format. Keys should start with sk-or-' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Verify agency exists
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id, name')
      .eq('id', agencyId)
      .single()

    if (agencyError || !agency) {
      return NextResponse.json(
        { error: 'Agency not found' },
        { status: 404 }
      )
    }

    // Encrypt the API key
    const { encryptedKey } = encryptAPIKey(apiKey)
    const keyHint = generateKeyHint(apiKey)

    // Update agency with encrypted key
    const { error: updateError } = await supabase
      .from('agencies')
      .update({
        openrouter_api_key: encryptedKey,
        openrouter_key_hint: keyHint,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agencyId)

    if (updateError) {
      console.error('Error updating agency API key:', updateError)
      return NextResponse.json(
        { error: 'Failed to save API key' },
        { status: 500 }
      )
    }

    // Get member count
    const { count: memberCount } = await supabase
      .from('agency_members')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId)

    return NextResponse.json({
      success: true,
      message: `OpenRouter API key configured for ${agency.name}`,
      keyHint,
      memberCount: memberCount || 0,
    })
  } catch (err) {
    console.error('Error in POST /api/v2/agencies/[id]/openrouter:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v2/agencies/[id]/openrouter
 * Remove agency's OpenRouter API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agencyId } = await params
    const supabase = getSupabaseClient()

    // Verify agency exists
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id, name')
      .eq('id', agencyId)
      .single()

    if (agencyError || !agency) {
      return NextResponse.json(
        { error: 'Agency not found' },
        { status: 404 }
      )
    }

    // Remove API key
    const { error: updateError } = await supabase
      .from('agencies')
      .update({
        openrouter_api_key: null,
        openrouter_key_hint: null,
        openrouter_key_last_used_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agencyId)

    if (updateError) {
      console.error('Error removing agency API key:', updateError)
      return NextResponse.json(
        { error: 'Failed to remove API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `OpenRouter API key removed from ${agency.name}`,
    })
  } catch (err) {
    console.error('Error in DELETE /api/v2/agencies/[id]/openrouter:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
      )
  }
}
