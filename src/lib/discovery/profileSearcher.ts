/**
 * Profile Searcher for Social Links Discovery
 *
 * Searches for social media profiles when they're not found on the website.
 * Supports both Deep Research (Gemini with web search) and Perplexity.
 */

import {
  Platform,
  DiscoveredProfile,
  PLATFORM_CONFIGS,
  getPlatformConfig,
  ConfidenceLevel,
} from './types'

// Search provider options
export type SearchProvider = 'deep_research' | 'perplexity'

interface SearchResult {
  platform: Platform
  url: string | null
  confidence: ConfidenceLevel
  snippet?: string
}

interface SearchOptions {
  provider: SearchProvider
  openrouterApiKey?: string
  perplexityApiKey?: string
}

/**
 * Search for a single profile using the specified provider
 */
export async function searchForProfile(
  competitorName: string,
  platform: Platform,
  options: SearchOptions
): Promise<DiscoveredProfile> {
  const config = getPlatformConfig(platform)
  if (!config) {
    return {
      platform,
      url: null,
      handle: null,
      confidence: 'not_found',
      source: 'deep_research',
    }
  }

  const searchQuery = config.searchQuery(competitorName)

  try {
    let result: SearchResult

    if (options.provider === 'perplexity' && options.perplexityApiKey) {
      result = await searchWithPerplexity(searchQuery, platform, competitorName, options.perplexityApiKey)
    } else if (options.openrouterApiKey) {
      result = await searchWithDeepResearch(searchQuery, platform, competitorName, options.openrouterApiKey)
    } else {
      console.warn(`[profileSearcher] No API key available for ${options.provider}`)
      return {
        platform,
        url: null,
        handle: null,
        confidence: 'not_found',
        source: 'deep_research',
      }
    }

    // Extract handle from URL if found
    let handle: string | null = null
    if (result.url) {
      handle = config.extractHandle(result.url)
    }

    return {
      platform,
      url: result.url,
      handle,
      confidence: result.confidence,
      source: options.provider === 'perplexity' ? 'deep_research' : 'deep_research', // Both are external search
    }
  } catch (error) {
    console.error(`[profileSearcher] Error searching for ${platform}:`, error)
    return {
      platform,
      url: null,
      handle: null,
      confidence: 'not_found',
      source: 'deep_research',
    }
  }
}

/**
 * Search for multiple profiles in parallel
 */
export async function searchForProfiles(
  competitorName: string,
  platforms: Platform[],
  options: SearchOptions
): Promise<Record<Platform, DiscoveredProfile>> {
  const results: Record<Platform, DiscoveredProfile> = {} as Record<Platform, DiscoveredProfile>

  // Search in batches to avoid rate limiting (3 concurrent)
  const batchSize = 3
  for (let i = 0; i < platforms.length; i += batchSize) {
    const batch = platforms.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map((platform) => searchForProfile(competitorName, platform, options))
    )

    batchResults.forEach((result) => {
      results[result.platform] = result
    })

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < platforms.length) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  return results
}

/**
 * Search using Deep Research (Perplexity Sonar model via OpenRouter with built-in web search)
 */
async function searchWithDeepResearch(
  searchQuery: string,
  platform: Platform,
  competitorName: string,
  openrouterApiKey: string
): Promise<SearchResult> {
  const config = getPlatformConfig(platform)
  const platformName = config?.displayName || platform

  const prompt = `Find the official ${platformName} profile for the company "${competitorName}".

Search query: ${searchQuery}

Instructions:
1. Search the web for the official ${platformName} profile
2. Verify it's the official account (not a fan page or impersonator)
3. Return ONLY the URL if found, or "NOT_FOUND" if no official profile exists

Response format (respond ONLY with one of these):
- The full URL (e.g., https://instagram.com/revolut)
- NOT_FOUND

Do not include any other text or explanation.`

  try {
    // Use Perplexity's sonar model via OpenRouter - it has built-in web search
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Gattaca Profile Discovery',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar', // Sonar has built-in web search
        messages: [
          {
            role: 'system',
            content: 'You are a research assistant that finds official social media profiles. Search the web to find accurate, current URLs. Respond only with the URL or NOT_FOUND.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`[profileSearcher] Deep Research failed: ${response.status}`, errorText)

      // Fallback to Gemini without web search (knowledge-based)
      return searchWithGeminiFallback(platform, competitorName, openrouterApiKey)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''

    console.log(`[profileSearcher] Deep Research response for ${platform}:`, content.substring(0, 100))

    // Parse response
    if (content === 'NOT_FOUND' || content.toLowerCase().includes('not found') || content.toLowerCase().includes('no official')) {
      return { platform, url: null, confidence: 'not_found' }
    }

    // Try to extract URL from response
    const urlMatch = content.match(/https?:\/\/[^\s"'<>\)]+/i)
    if (urlMatch) {
      const url = urlMatch[0].replace(/[.,;:!?)]+$/, '') // Clean trailing punctuation

      // Validate URL matches expected platform
      if (config && config.urlPatterns.some((pattern) => pattern.test(url))) {
        return { platform, url, confidence: 'likely', snippet: content }
      }
    }

    return { platform, url: null, confidence: 'not_found' }
  } catch (error) {
    console.error(`[profileSearcher] Deep Research error:`, error)
    return { platform, url: null, confidence: 'not_found' }
  }
}

/**
 * Fallback to Gemini without web search (uses model's knowledge)
 */
async function searchWithGeminiFallback(
  platform: Platform,
  competitorName: string,
  openrouterApiKey: string
): Promise<SearchResult> {
  const config = getPlatformConfig(platform)
  const platformName = config?.displayName || platform

  const prompt = `What is the official ${platformName} profile URL for the company "${competitorName}"?

If you know the official URL, respond with just the URL.
If you don't know or it doesn't exist, respond with: NOT_FOUND

Respond with ONLY the URL or NOT_FOUND, nothing else.`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        'X-Title': 'Gattaca Profile Discovery',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      console.warn(`[profileSearcher] Gemini fallback failed: ${response.status}`)
      return { platform, url: null, confidence: 'not_found' }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''

    if (content === 'NOT_FOUND' || content.toLowerCase().includes('not found')) {
      return { platform, url: null, confidence: 'not_found' }
    }

    const urlMatch = content.match(/https?:\/\/[^\s"'<>\)]+/i)
    if (urlMatch) {
      const url = urlMatch[0].replace(/[.,;:!?)]+$/, '')
      if (config && config.urlPatterns.some((pattern) => pattern.test(url))) {
        return { platform, url, confidence: 'uncertain', snippet: content } // Lower confidence since no web search
      }
    }

    return { platform, url: null, confidence: 'not_found' }
  } catch (error) {
    console.error(`[profileSearcher] Gemini fallback error:`, error)
    return { platform, url: null, confidence: 'not_found' }
  }
}

/**
 * Search using Perplexity API
 */
async function searchWithPerplexity(
  searchQuery: string,
  platform: Platform,
  competitorName: string,
  perplexityApiKey: string
): Promise<SearchResult> {
  const config = getPlatformConfig(platform)
  const platformName = config?.displayName || platform

  const prompt = `Find the official ${platformName} profile URL for the company "${competitorName}".

Instructions:
1. Search for the official ${platformName} profile
2. Verify it's the official account by checking if the profile name, bio, or linked website matches the company
3. Return ONLY the profile URL if found

If found, respond with just the URL (e.g., https://instagram.com/revolut)
If not found, respond with: NOT_FOUND

Do not include any other text.`

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online', // Online model with web search
        messages: [
          {
            role: 'system',
            content: 'You are a research assistant that finds official social media profiles. Respond only with URLs or NOT_FOUND.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.1,
        search_domain_filter: [], // Allow all domains
        return_citations: false,
        search_recency_filter: 'month', // Recent results
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`[profileSearcher] Perplexity failed: ${response.status}`, errorText)
      return { platform, url: null, confidence: 'not_found' }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''

    // Parse response
    if (content === 'NOT_FOUND' || content.toLowerCase().includes('not found') || content.toLowerCase().includes('no official')) {
      return { platform, url: null, confidence: 'not_found' }
    }

    // Try to extract URL from response
    const urlMatch = content.match(/https?:\/\/[^\s"'<>]+/i)
    if (urlMatch) {
      const url = urlMatch[0].replace(/[.,;:!?)]+$/, '') // Clean trailing punctuation

      // Validate URL matches expected platform
      if (config && config.urlPatterns.some((pattern) => pattern.test(url))) {
        // Perplexity tends to be more accurate with its web search
        return { platform, url, confidence: 'likely', snippet: content }
      }
    }

    return { platform, url: null, confidence: 'not_found' }
  } catch (error) {
    console.error(`[profileSearcher] Perplexity error:`, error)
    return { platform, url: null, confidence: 'not_found' }
  }
}

/**
 * Bulk search for all missing platforms
 * Uses the best available provider
 */
export async function searchMissingProfiles(
  competitorName: string,
  missingPlatforms: Platform[],
  apiKeys: {
    openrouterApiKey?: string
    perplexityApiKey?: string
  },
  preferredProvider: SearchProvider = 'perplexity'
): Promise<Record<Platform, DiscoveredProfile>> {
  // Determine which provider to use
  let provider: SearchProvider = preferredProvider
  let apiKey: string | undefined

  if (preferredProvider === 'perplexity' && apiKeys.perplexityApiKey) {
    provider = 'perplexity'
    apiKey = apiKeys.perplexityApiKey
  } else if (apiKeys.openrouterApiKey) {
    provider = 'deep_research'
    apiKey = apiKeys.openrouterApiKey
  } else {
    console.warn('[profileSearcher] No API keys available for search')
    // Return empty results for all platforms
    const emptyResults: Record<Platform, DiscoveredProfile> = {} as Record<Platform, DiscoveredProfile>
    for (const platform of missingPlatforms) {
      emptyResults[platform] = {
        platform,
        url: null,
        handle: null,
        confidence: 'not_found',
        source: 'deep_research',
      }
    }
    return emptyResults
  }

  console.log(`[profileSearcher] Searching ${missingPlatforms.length} profiles using ${provider}`)

  return searchForProfiles(competitorName, missingPlatforms, {
    provider,
    openrouterApiKey: provider === 'deep_research' ? apiKey : undefined,
    perplexityApiKey: provider === 'perplexity' ? apiKey : undefined,
  })
}
