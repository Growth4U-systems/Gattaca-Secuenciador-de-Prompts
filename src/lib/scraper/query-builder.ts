/**
 * Query Builder for Niche Finder
 * Generates search queries from A×B combinations
 */

import type { ScraperStepConfig } from '@/types/scraper.types'

export interface SearchQuery {
  lifeContext: string
  productWord: string
  indicator?: string
  sourceType: 'reddit' | 'thematic_forum' | 'general_forum'
  sourceDomain?: string
  query: string
}

/**
 * Generate all search queries from scraper config
 * Creates A × B × Sources combinations
 */
export function generateSearchQueries(config: ScraperStepConfig): SearchQuery[] {
  const queries: SearchQuery[] = []

  const { life_contexts, product_words, indicators, sources } = config

  // Generate all A × B combinations
  for (const lifeContext of life_contexts) {
    for (const productWord of product_words) {
      // Reddit searches
      if (sources.reddit) {
        queries.push(createQuery(lifeContext, productWord, undefined, 'reddit', 'reddit.com'))
      }

      // General forum searches
      for (const forum of sources.general_forums) {
        queries.push(createQuery(lifeContext, productWord, undefined, 'general_forum', forum))
      }

      // With indicators (if any)
      if (indicators.length > 0) {
        for (const indicator of indicators) {
          if (sources.reddit) {
            queries.push(createQuery(lifeContext, productWord, indicator, 'reddit', 'reddit.com'))
          }
          for (const forum of sources.general_forums) {
            queries.push(createQuery(lifeContext, productWord, indicator, 'general_forum', forum))
          }
        }
      }
    }
  }

  return queries
}

/**
 * Create a single search query
 */
function createQuery(
  lifeContext: string,
  productWord: string,
  indicator: string | undefined,
  sourceType: 'reddit' | 'thematic_forum' | 'general_forum',
  sourceDomain: string
): SearchQuery {
  const parts: string[] = []

  // Site filter
  parts.push(`site:${sourceDomain}`)

  // Main search terms
  parts.push(`"${lifeContext}"`)
  parts.push(`"${productWord}"`)

  // Indicator if present
  if (indicator) {
    parts.push(`"${indicator}"`)
  }

  return {
    lifeContext,
    productWord,
    indicator,
    sourceType,
    sourceDomain,
    query: parts.join(' '),
  }
}

/**
 * Calculate total number of queries that will be generated
 */
export function calculateTotalQueries(config: ScraperStepConfig): number {
  const { life_contexts, product_words, indicators, sources } = config

  const baseCombinations = life_contexts.length * product_words.length
  const numSources = (sources.reddit ? 1 : 0) + sources.general_forums.length

  // Base queries: A × B × Sources
  let total = baseCombinations * numSources

  // With indicators: A × B × Indicators × Sources
  if (indicators.length > 0) {
    total += baseCombinations * indicators.length * numSources
  }

  return total
}

/**
 * Estimate number of URLs that will be found
 * Based on typical SERP results (10 per page)
 */
export function estimateUrlCount(config: ScraperStepConfig): number {
  const totalQueries = calculateTotalQueries(config)
  const resultsPerPage = 10
  const pages = config.serp_pages || 5

  // Not all queries return full results, estimate 70% fill rate
  const fillRate = 0.7

  // Deduplication typically removes ~30% of URLs
  const uniqueRate = 0.7

  return Math.round(totalQueries * resultsPerPage * pages * fillRate * uniqueRate)
}
