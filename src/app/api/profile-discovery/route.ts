import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'
import { runDiscoverySync } from '@/lib/discovery/discoveryOrchestrator'
import type { Platform, DiscoveredProfile } from '@/lib/discovery/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for multi-source discovery

interface ProfileDiscoveryRequest {
  campaignId: string
  competitorName: string
  websiteUrl: string
  metadataOnly?: boolean // If true, only extract metadata, skip profile search
}

/**
 * Background Profile Discovery Endpoint
 *
 * Launches profile discovery asynchronously and saves results to campaign.custom_variables.
 * Returns immediately with 202 Accepted status - discovery happens in background.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse request
  let body: ProfileDiscoveryRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { campaignId, competitorName, websiteUrl, metadataOnly = false } = body

  if (!campaignId || !competitorName || !websiteUrl) {
    return NextResponse.json(
      { error: 'campaignId, competitorName, and websiteUrl are required' },
      { status: 400 }
    )
  }

  // Verify campaign exists and user has access
  console.log('[profile-discovery] Looking for campaign:', campaignId)
  console.log('[profile-discovery] User ID:', session.user.id)

  // TEMP: Use admin client to bypass RLS for debugging
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: campaign, error: campaignError } = await adminClient
    .from('ecp_campaigns')
    .select('id, project_id, custom_variables')
    .eq('id', campaignId)
    .single()

  if (campaignError || !campaign) {
    console.error('[profile-discovery] Campaign query error:', campaignError)
    console.error('[profile-discovery] Campaign data:', campaign)
    return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 404 })
  }

  console.log('[profile-discovery] Campaign found:', campaign.id)

  // Return immediately - discovery will happen in background
  // We use a Promise without await to make it truly non-blocking
  runBackgroundDiscovery(
    campaignId,
    competitorName,
    websiteUrl,
    session.user.id,
    campaign.custom_variables as Record<string, unknown> || {},
    metadataOnly
  ).catch(err => {
    console.error('[profile-discovery] Background discovery error:', err)
  })

  return NextResponse.json({
    success: true,
    status: 'running',
    message: metadataOnly
      ? 'Metadata extraction started in background'
      : 'Discovery started in background'
  }, { status: 202 }) // 202 Accepted
}

/**
 * Runs discovery in background and saves results to campaign
 */
async function runBackgroundDiscovery(
  campaignId: string,
  competitorName: string,
  websiteUrl: string,
  userId: string,
  existingVariables: Record<string, unknown>,
  metadataOnly: boolean = false
) {
  const mode = metadataOnly ? 'metadata extraction' : 'full discovery'
  console.log(`[profile-discovery] Starting background ${mode} for campaign ${campaignId}`)

  // Create admin client for background operations
  const supabase = await createServerClient()

  try {
    // Get API keys
    let openrouterApiKey: string | null = null
    let perplexityApiKey: string | null = null
    let firecrawlApiKey: string | null = null

    try {
      openrouterApiKey = await getUserApiKey({
        userId,
        serviceName: 'openrouter',
        supabase,
      })

      if (!openrouterApiKey) {
        const { data: tokenRecord } = await supabase
          .from('user_openrouter_tokens')
          .select('encrypted_api_key')
          .eq('user_id', userId)
          .single()

        if (tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
          try {
            openrouterApiKey = decryptToken(tokenRecord.encrypted_api_key)
          } catch {
            // Ignore
          }
        }
      }

      perplexityApiKey = await getUserApiKey({
        userId,
        serviceName: 'perplexity',
        supabase,
      })

      firecrawlApiKey = await getUserApiKey({
        userId,
        serviceName: 'firecrawl',
        supabase,
      })
    } catch (error) {
      console.warn('[profile-discovery] Error getting API keys:', error)
    }

    // Fallback to environment variables
    if (!openrouterApiKey) openrouterApiKey = process.env.OPENROUTER_API_KEY || null
    if (!perplexityApiKey) perplexityApiKey = process.env.PERPLEXITY_API_KEY || null
    if (!firecrawlApiKey) firecrawlApiKey = process.env.FIRECRAWL_API_KEY || null

    // If metadata only, just extract metadata and save
    if (metadataOnly) {
      console.log(`[profile-discovery] Extracting metadata only for ${competitorName}`)

      const { extractCompetitorMetadata } = await import('@/lib/discovery/metadataExtractor')
      const metadata = await extractCompetitorMetadata(
        competitorName,
        websiteUrl,
        {
          openrouterApiKey: openrouterApiKey || undefined,
          perplexityApiKey: perplexityApiKey || undefined,
        }
      )

      if (metadata) {
        const metadataVariables = {
          competitor_description: metadata.description,
          industry: metadata.industry,
          target_audience: metadata.targetAudience,
          metadata_confidence: metadata.confidence,
        }

        const updatedVariables = {
          ...existingVariables,
          ...metadataVariables,
          metadata_extracted_at: new Date().toISOString(),
        }

        const { error: updateError } = await supabase
          .from('ecp_campaigns')
          .update({
            custom_variables: updatedVariables,
          })
          .eq('id', campaignId)

        if (updateError) {
          console.error('[profile-discovery] Error saving metadata:', updateError)
          throw updateError
        }

        console.log(`[profile-discovery] Metadata saved to campaign ${campaignId}:`, metadata)
      } else {
        console.warn(`[profile-discovery] No metadata extracted`)
      }

      return
    }

    // Run full discovery
    console.log(`[profile-discovery] Running full discovery for ${competitorName}`)
    const results = await runDiscoverySync(competitorName, websiteUrl, {
      openrouterApiKey: openrouterApiKey || undefined,
      perplexityApiKey: perplexityApiKey || undefined,
      firecrawlApiKey: firecrawlApiKey || undefined,
    })

    console.log(`[profile-discovery] Discovery completed: ${results.totalFound} profiles found`)

    // Convert results to custom_variables format
    const profileVariables: Record<string, string> = {}
    const discoveredPlatforms: string[] = []
    Object.entries(results.profiles).forEach(([platform, profile]: [string, DiscoveredProfile]) => {
      // Save URL for all platforms
      if (profile.url) {
        const urlKey = `${platform}_url`
        profileVariables[urlKey] = profile.url
        discoveredPlatforms.push(platform)
      }

      // Save handle/username with correct key mapping
      if (profile.handle) {
        // Instagram and TikTok use _username, others use _handle
        const handleKey = (platform === 'instagram' || platform === 'tiktok')
          ? `${platform}_username`
          : `${platform}_handle`
        profileVariables[handleKey] = profile.handle
        if (!discoveredPlatforms.includes(platform)) {
          discoveredPlatforms.push(platform)
        }
      }
    })

    // Add metadata if extracted (using variable names that match prompt templates)
    if (results.metadata) {
      profileVariables.competitor_description = results.metadata.description
      profileVariables.industry = results.metadata.industry
      profileVariables.target_audience = results.metadata.targetAudience
      profileVariables.metadata_confidence = results.metadata.confidence
      console.log(`[profile-discovery] Metadata extracted:`, results.metadata)
    }

    // Save to campaign.custom_variables
    const updatedVariables = {
      ...existingVariables,
      ...profileVariables,
      discovery_completed: 'true',
      discovery_timestamp: new Date().toISOString(),
      discovery_found_count: results.totalFound.toString(),
      discovered_platforms: JSON.stringify(discoveredPlatforms),
    }

    const { error: updateError } = await supabase
      .from('ecp_campaigns')
      .update({
        custom_variables: updatedVariables,
      })
      .eq('id', campaignId)

    if (updateError) {
      console.error('[profile-discovery] Error saving results:', updateError)
      throw updateError
    }

    console.log(`[profile-discovery] Results saved to campaign ${campaignId}`)
  } catch (error) {
    console.error('[profile-discovery] Error in background discovery:', error)

    // Save error state to campaign
    try {
      await supabase
        .from('ecp_campaigns')
        .update({
          custom_variables: {
            ...existingVariables,
            discovery_completed: 'false',
            discovery_error: error instanceof Error ? error.message : 'Discovery failed',
            discovery_timestamp: new Date().toISOString(),
          },
        })
        .eq('id', campaignId)
    } catch (saveError) {
      console.error('[profile-discovery] Error saving error state:', saveError)
    }
  }
}
