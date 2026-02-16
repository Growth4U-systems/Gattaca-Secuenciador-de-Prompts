/**
 * Serper.dev API Client
 * For SERP (Search Engine Results Page) queries
 * Pricing: $0.004 per search (pay-per-use)
 */

export interface SerperSearchResult {
  title: string
  link: string
  snippet: string
  position: number
}

export interface SerperResponse {
  searchParameters: {
    q: string
    gl?: string
    hl?: string
    num?: number
    page?: number
  }
  organic: SerperSearchResult[]
  answerBox?: {
    snippet?: string
    title?: string
    link?: string
  }
  relatedSearches?: { query: string }[]
}

export interface SerperSearchOptions {
  query: string
  countryCode?: string   // gl parameter (e.g., 'es', 'us')
  languageCode?: string  // hl parameter (e.g., 'es', 'en')
  numResults?: number    // num parameter (default: 10, max: 100)
  page?: number          // Page number for pagination
}

/**
 * Cost per search in USD
 */
export const SERPER_COST_PER_SEARCH = 0.004

/**
 * Search using Serper.dev API
 * @param options - Search options (query, countryCode, etc.)
 * @param apiKey - Optional API key (falls back to env var if not provided)
 */
export async function serperSearch(
  options: SerperSearchOptions,
  apiKey?: string
): Promise<SerperResponse> {
  const key = apiKey || process.env.SERPER_API_KEY

  if (!key) {
    throw new Error('SERPER_API_KEY not provided. Please add your Serper API key in Settings > APIs.')
  }

  const { query, countryCode = 'es', languageCode = 'es', numResults = 10, page = 1 } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

  let response: Response
  try {
    response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        gl: countryCode,
        hl: languageCode,
        num: numResults,
        page: page,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Serper API timeout after 30s')
    }
    throw err
  }
  clearTimeout(timeoutId)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Serper API error: ${response.status} - ${errorText}`)
  }

  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Serper returned invalid JSON: ${text.slice(0, 200)}`)
  }
}

/**
 * Build search query for niche finder
 * Combines life context + product word with optional indicator and source
 */
export function buildNicheFinderQuery(params: {
  lifeContext: string
  productWord: string
  indicator?: string
  sourceDomain?: string  // e.g., 'reddit.com', 'forocoches.com'
}): string {
  const { lifeContext, productWord, indicator, sourceDomain } = params

  const parts: string[] = []

  // Add site filter if specified
  if (sourceDomain) {
    parts.push(`site:${sourceDomain}`)
  }

  // Add main search terms in quotes for exact matching
  parts.push(`"${lifeContext}"`)
  parts.push(`"${productWord}"`)

  // Add indicator if specified
  if (indicator) {
    parts.push(`"${indicator}"`)
  }

  return parts.join(' ')
}

/**
 * Search multiple pages and combine results
 * @param options - Search options
 * @param pages - Number of pages to fetch (default: 5)
 * @param apiKey - Optional API key (falls back to env var if not provided)
 */
export async function serperSearchMultiplePages(
  options: SerperSearchOptions,
  pages: number = 5,
  apiKey?: string
): Promise<SerperSearchResult[]> {
  const allResults: SerperSearchResult[] = []
  const seenUrls = new Set<string>()

  for (let page = 1; page <= pages; page++) {
    try {
      const response = await serperSearch({
        ...options,
        page,
        numResults: 10, // 10 per page is most reliable
      }, apiKey)

      for (const result of response.organic) {
        // Deduplicate by URL
        if (!seenUrls.has(result.link)) {
          seenUrls.add(result.link)
          allResults.push({
            ...result,
            position: allResults.length + 1, // Renumber positions
          })
        }
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error)
      // Continue with other pages even if one fails
    }
  }

  return allResults
}

/**
 * Calculate cost for a set of searches
 */
export function calculateSerperCost(numSearches: number): number {
  return numSearches * SERPER_COST_PER_SEARCH
}
