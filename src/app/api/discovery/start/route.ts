import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'
import { runDiscoverySync } from '@/lib/discovery/discoveryOrchestrator'
import type { Platform } from '@/lib/discovery/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60 // Discovery can take up to 60 seconds

interface DiscoveryStartRequest {
  competitor_name: string
  website_url: string
  project_id: string
  skip_platforms?: Platform[]
  preferred_provider?: 'deep_research' | 'perplexity'
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get API keys
  let openrouterApiKey: string | null = null
  let perplexityApiKey: string | null = null
  let firecrawlApiKey: string | null = null

  try {
    // Try to get OpenRouter key
    openrouterApiKey = await getUserApiKey({
      userId: session.user.id,
      serviceName: 'openrouter',
      supabase,
    })

    // Try OAuth token if no direct key
    if (!openrouterApiKey) {
      const { data: tokenRecord } = await supabase
        .from('user_openrouter_tokens')
        .select('encrypted_api_key')
        .eq('user_id', session.user.id)
        .single()

      if (tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
        try {
          openrouterApiKey = decryptToken(tokenRecord.encrypted_api_key)
        } catch {
          // Ignore decrypt errors
        }
      }
    }

    // Try to get Perplexity key
    perplexityApiKey = await getUserApiKey({
      userId: session.user.id,
      serviceName: 'perplexity',
      supabase,
    })

    // Try to get Firecrawl key
    firecrawlApiKey = await getUserApiKey({
      userId: session.user.id,
      serviceName: 'firecrawl',
      supabase,
    })
  } catch (error) {
    console.warn('[discovery/start] Error getting API keys:', error)
  }

  // Fallback to environment variables
  if (!openrouterApiKey) {
    openrouterApiKey = process.env.OPENROUTER_API_KEY || null
  }
  if (!perplexityApiKey) {
    perplexityApiKey = process.env.PERPLEXITY_API_KEY || null
  }
  if (!firecrawlApiKey) {
    firecrawlApiKey = process.env.FIRECRAWL_API_KEY || null
  }

  // Parse request body
  let body: DiscoveryStartRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { competitor_name, website_url, project_id, skip_platforms, preferred_provider } = body

  // Validate required fields
  if (!competitor_name || !website_url || !project_id) {
    return NextResponse.json(
      { error: 'competitor_name, website_url, and project_id are required' },
      { status: 400 }
    )
  }

  // Verify user has access to project
  const { data: project, error: projectError } = await supabase
    .from('projects_legacy')
    .select('id')
    .eq('id', project_id)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
  }

  // Check if we have at least one search provider
  if (!openrouterApiKey && !perplexityApiKey) {
    console.warn('[discovery/start] No search API keys available, will only scrape website')
  }

  try {
    console.log(`[discovery/start] Running sync discovery for ${competitor_name}`)
    console.log(`[discovery/start] API Keys available:`, {
      hasOpenRouter: !!openrouterApiKey,
      hasPerplexity: !!perplexityApiKey,
      hasFirecrawl: !!firecrawlApiKey,
      preferredProvider: preferred_provider,
    })

    // Run discovery synchronously and return results directly
    const results = await runDiscoverySync(competitor_name, website_url, {
      openrouterApiKey: openrouterApiKey || undefined,
      perplexityApiKey: perplexityApiKey || undefined,
      firecrawlApiKey: firecrawlApiKey || undefined,
      preferredProvider: preferred_provider,
      skipPlatforms: skip_platforms,
    })

    console.log(`[discovery/start] Completed for ${competitor_name}: ${results.totalFound} found`)
    console.log(`[discovery/start] Results:`, JSON.stringify(results.profiles, null, 2))

    // Return results directly (no polling needed)
    return NextResponse.json({
      success: true,
      status: 'completed',
      results,
    })
  } catch (error) {
    console.error('[discovery/start] Error:', error)
    return NextResponse.json(
      {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Discovery failed'
      },
      { status: 500 }
    )
  }
}
