/**
 * Discovery Orchestrator
 *
 * Coordinates the entire auto-discovery process:
 * 1. Scrape website for social links
 * 2. Search for missing profiles (using Deep Research or Perplexity)
 * 3. Validate discovered profiles
 * 4. Return unified results
 */

import {
  Platform,
  DiscoveredProfile,
  DiscoveryResults,
  DiscoveryJobStatus,
  WebsiteSocialLinks,
  PLATFORM_CONFIGS,
  getAllPlatforms,
} from './types'
import { scrapeWebsiteForSocialLinks, extractDomain } from './websiteScraper'
import { searchMissingProfiles, SearchProvider } from './profileSearcher'
import { validateProfiles, upgradeConfidenceForWebsiteLink } from './profileValidator'

// In-memory job storage (in production, use Redis or database)
const jobs = new Map<string, DiscoveryJobStatus>()

export interface DiscoveryOptions {
  // API keys for profile searching
  openrouterApiKey?: string
  perplexityApiKey?: string
  firecrawlApiKey?: string
  // Preferred search provider
  preferredProvider?: SearchProvider
  // Platforms to skip
  skipPlatforms?: Platform[]
  // Callback for progress updates
  onProgress?: (status: DiscoveryJobStatus) => void
}

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `disc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Update job status and notify callback
 */
function updateJobStatus(
  jobId: string,
  updates: Partial<DiscoveryJobStatus>,
  onProgress?: (status: DiscoveryJobStatus) => void
): DiscoveryJobStatus {
  const current = jobs.get(jobId)
  if (!current) {
    throw new Error(`Job ${jobId} not found`)
  }

  const updated: DiscoveryJobStatus = {
    ...current,
    ...updates,
  }

  jobs.set(jobId, updated)

  if (onProgress) {
    onProgress(updated)
  }

  return updated
}

/**
 * Start the discovery process
 * Returns a job ID for tracking progress
 */
export async function startDiscovery(
  competitorName: string,
  websiteUrl: string,
  options: DiscoveryOptions = {}
): Promise<string> {
  const jobId = generateJobId()

  // Initialize job
  const initialStatus: DiscoveryJobStatus = {
    jobId,
    status: 'pending',
    progress: 0,
    currentStep: 'Initializing...',
    results: null,
    startedAt: new Date().toISOString(),
  }

  jobs.set(jobId, initialStatus)

  // Run discovery async
  runDiscoveryProcess(jobId, competitorName, websiteUrl, options).catch((error) => {
    console.error(`[discoveryOrchestrator] Job ${jobId} failed:`, error)
    updateJobStatus(
      jobId,
      {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date().toISOString(),
      },
      options.onProgress
    )
  })

  return jobId
}

/**
 * Get job status
 */
export function getJobStatus(jobId: string): DiscoveryJobStatus | null {
  return jobs.get(jobId) || null
}

/**
 * Run the complete discovery process
 */
async function runDiscoveryProcess(
  jobId: string,
  competitorName: string,
  websiteUrl: string,
  options: DiscoveryOptions
): Promise<void> {
  const { onProgress, skipPlatforms = [] } = options

  // Get platforms to discover
  const platformsToDiscover = getAllPlatforms().filter((p) => !skipPlatforms.includes(p))

  // Initialize results
  const profiles: Record<Platform, DiscoveredProfile> = {} as Record<Platform, DiscoveredProfile>

  // Initialize all platforms as not_found
  for (const platform of platformsToDiscover) {
    profiles[platform] = {
      platform,
      url: null,
      handle: null,
      confidence: 'not_found',
      source: 'website_link',
    }
  }

  // Step 1: Scrape website for social links
  updateJobStatus(
    jobId,
    {
      status: 'scraping_website',
      progress: 10,
      currentStep: 'Extracting social links from website...',
    },
    onProgress
  )

  let websiteLinks: WebsiteSocialLinks = {}
  try {
    websiteLinks = await scrapeWebsiteForSocialLinks(websiteUrl, options.firecrawlApiKey)
    console.log(`[discoveryOrchestrator] Found ${Object.keys(websiteLinks).length} links from website`)
  } catch (error) {
    console.warn(`[discoveryOrchestrator] Website scraping failed:`, error)
  }

  updateJobStatus(
    jobId,
    {
      progress: 30,
      currentStep: 'Processing website results...',
    },
    onProgress
  )

  // Process website links
  const platformsFromWebsite: Platform[] = []
  const websiteLinkMapping: Record<string, Platform> = {
    instagram: 'instagram',
    facebook: 'facebook',
    linkedin: 'linkedin',
    youtube: 'youtube',
    tiktok: 'tiktok',
    twitter: 'twitter',
    trustpilot: 'trustpilot',
    appStore: 'appstore',
    playStore: 'playstore',
  }

  console.log(`[discoveryOrchestrator] Processing website links:`, JSON.stringify(websiteLinks, null, 2))

  for (const [key, platform] of Object.entries(websiteLinkMapping)) {
    const url = websiteLinks[key as keyof WebsiteSocialLinks] as string | undefined
    if (url && platformsToDiscover.includes(platform)) {
      const config = PLATFORM_CONFIGS.find((c) => c.platform === platform)
      const handle = config?.extractHandle(url) || null

      console.log(`[discoveryOrchestrator] Found ${platform} from website: ${url}`)

      profiles[platform] = upgradeConfidenceForWebsiteLink({
        platform,
        url,
        handle,
        confidence: 'likely', // Will be upgraded to 'verified' by upgradeConfidenceForWebsiteLink
        source: 'website_link',
      })

      platformsFromWebsite.push(platform)
    }
  }

  console.log(`[discoveryOrchestrator] Platforms found from website: ${platformsFromWebsite.join(', ') || 'none'}`)

  // Step 2: Search for missing profiles
  const missingPlatforms = platformsToDiscover.filter((p) => !platformsFromWebsite.includes(p))

  console.log(`[discoveryOrchestrator] Missing platforms to search: ${missingPlatforms.join(', ')}`)
  console.log(`[discoveryOrchestrator] API keys available - OpenRouter: ${!!options.openrouterApiKey}, Perplexity: ${!!options.perplexityApiKey}`)

  if (missingPlatforms.length > 0 && (options.openrouterApiKey || options.perplexityApiKey)) {
    updateJobStatus(
      jobId,
      {
        status: 'searching_profiles',
        progress: 40,
        currentStep: `Searching for ${missingPlatforms.length} missing profiles...`,
      },
      onProgress
    )

    try {
      // Prefer deep_research (OpenRouter) since most users have that
      const preferredProvider = options.preferredProvider ||
        (options.openrouterApiKey ? 'deep_research' : 'perplexity')

      console.log(`[discoveryOrchestrator] Searching with provider: ${preferredProvider}`)

      const searchResults = await searchMissingProfiles(
        competitorName,
        missingPlatforms,
        {
          openrouterApiKey: options.openrouterApiKey,
          perplexityApiKey: options.perplexityApiKey,
        },
        preferredProvider
      )

      console.log(`[discoveryOrchestrator] Search results:`, JSON.stringify(searchResults, null, 2))

      // Merge search results
      let foundCount = 0
      for (const [platform, result] of Object.entries(searchResults)) {
        if (result.url) {
          profiles[platform as Platform] = result
          foundCount++
          console.log(`[discoveryOrchestrator] Found ${platform} via search: ${result.url}`)
        }
      }
      console.log(`[discoveryOrchestrator] Total found via search: ${foundCount}`)
    } catch (error) {
      console.warn(`[discoveryOrchestrator] Profile search failed:`, error)
    }
  } else {
    console.log(`[discoveryOrchestrator] Skipping search - no platforms to search or no API keys`)
  }

  // Step 3: Validate discovered profiles
  updateJobStatus(
    jobId,
    {
      status: 'validating',
      progress: 80,
      currentStep: 'Validating discovered profiles...',
    },
    onProgress
  )

  const validatedProfiles = validateProfiles(profiles, competitorName, websiteUrl)

  // Calculate stats
  let verifiedCount = 0
  let likelyCount = 0
  let notFoundCount = 0
  let totalFound = 0

  for (const profile of Object.values(validatedProfiles)) {
    if (profile.url) {
      totalFound++
      if (profile.confidence === 'verified') verifiedCount++
      else if (profile.confidence === 'likely') likelyCount++
    } else {
      notFoundCount++
    }
  }

  // Build final results
  const results: DiscoveryResults = {
    competitorName,
    websiteUrl,
    profiles: validatedProfiles,
    discoveryDate: new Date().toISOString(),
    totalFound,
    verifiedCount,
    likelyCount,
    notFoundCount,
  }

  // Complete
  updateJobStatus(
    jobId,
    {
      status: 'completed',
      progress: 100,
      currentStep: 'Discovery complete',
      results,
      completedAt: new Date().toISOString(),
    },
    onProgress
  )

  console.log(
    `[discoveryOrchestrator] Job ${jobId} completed: ${totalFound} found, ${verifiedCount} verified, ${likelyCount} likely`
  )
}

/**
 * Run discovery synchronously (for API routes that need immediate results)
 * Note: This blocks until complete, use for smaller discovery tasks
 */
export async function runDiscoverySync(
  competitorName: string,
  websiteUrl: string,
  options: DiscoveryOptions = {}
): Promise<DiscoveryResults> {
  const jobId = await startDiscovery(competitorName, websiteUrl, options)

  // Poll until complete
  const maxWaitTime = 60000 // 60 seconds max
  const pollInterval = 500
  let elapsed = 0

  while (elapsed < maxWaitTime) {
    const status = getJobStatus(jobId)

    if (status?.status === 'completed' && status.results) {
      return status.results
    }

    if (status?.status === 'failed') {
      throw new Error(status.error || 'Discovery failed')
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval))
    elapsed += pollInterval
  }

  throw new Error('Discovery timed out')
}

/**
 * Convert discovery results to custom_variables format
 * For storing in campaign record
 */
export function resultsToCustomVariables(
  results: DiscoveryResults
): Record<string, string | boolean> {
  const variables: Record<string, string | boolean> = {
    competitor_name: results.competitorName,
    competitor_website: results.websiteUrl,
    discovery_completed: true,
    discovery_date: results.discoveryDate,
  }

  // Add each discovered profile
  for (const [platform, profile] of Object.entries(results.profiles)) {
    const config = PLATFORM_CONFIGS.find((c) => c.platform === platform)
    if (config && profile.url) {
      // Store either URL or handle depending on the platform's input key
      if (config.inputKey.includes('url')) {
        variables[config.inputKey] = profile.url
      } else if (profile.handle) {
        variables[config.inputKey] = profile.handle
      } else {
        variables[config.inputKey] = profile.url
      }
    }
  }

  // Track verified profiles
  const verifiedPlatforms = Object.entries(results.profiles)
    .filter(([, profile]) => profile.confidence === 'verified')
    .map(([platform]) => platform)

  if (verifiedPlatforms.length > 0) {
    variables.profiles_verified = verifiedPlatforms.join(',')
  }

  return variables
}

/**
 * Clean up old jobs (call periodically)
 */
export function cleanupOldJobs(maxAgeMs: number = 3600000): void {
  const now = Date.now()

  for (const [jobId, status] of jobs.entries()) {
    const startedAt = new Date(status.startedAt).getTime()
    if (now - startedAt > maxAgeMs) {
      jobs.delete(jobId)
    }
  }
}
