import { NextRequest, NextResponse } from 'next/server'
import { calculateTotalQueries, estimateUrlCount } from '@/lib/scraper/query-builder'
import { SERPER_COST_PER_SEARCH } from '@/lib/serper'
import type { EstimateScraperCostRequest, EstimateScraperCostResponse } from '@/types/scraper.types'

export const dynamic = 'force-dynamic'

// Cost estimates
const FIRECRAWL_COST_PER_PAGE = 0.001
const LLM_COST_PER_URL = 0.0002 // Approximate for GPT-4o-mini

// Limits to prevent exponential combinations
const MAX_LIFE_CONTEXTS = 15
const MAX_PRODUCT_WORDS = 15
const MAX_COMBINATIONS = 100

export async function POST(
  request: NextRequest
): Promise<NextResponse<EstimateScraperCostResponse | { error: string }>> {
  try {
    const body: EstimateScraperCostRequest = await request.json()
    const { config } = body

    if (!config) {
      return NextResponse.json({ error: 'Config is required' }, { status: 400 })
    }

    // Validate config has minimum required fields
    if (!config.life_contexts?.length || !config.product_words?.length) {
      return NextResponse.json(
        { error: 'At least one life_context and product_word are required' },
        { status: 400 }
      )
    }

    // Validate limits to prevent exponential cost explosion
    if (config.life_contexts.length > MAX_LIFE_CONTEXTS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_LIFE_CONTEXTS} life contexts allowed. You have ${config.life_contexts.length}.` },
        { status: 400 }
      )
    }

    if (config.product_words.length > MAX_PRODUCT_WORDS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_PRODUCT_WORDS} product words allowed. You have ${config.product_words.length}.` },
        { status: 400 }
      )
    }

    // Calculate totals
    const totalCombinations = config.life_contexts.length * config.product_words.length

    if (totalCombinations > MAX_COMBINATIONS) {
      return NextResponse.json(
        {
          error: `Maximum ${MAX_COMBINATIONS} combinations allowed. You have ${totalCombinations} (${config.life_contexts.length} contexts × ${config.product_words.length} words). Please reduce selection.`
        },
        { status: 400 }
      )
    }
    const totalQueries = calculateTotalQueries(config)
    const serpPages = config.serp_pages || 5
    const totalSearches = totalQueries * serpPages

    // Estimate URLs (with deduplication factor)
    const estimatedUrls = estimateUrlCount(config)

    // Calculate costs
    const serpCost = totalSearches * SERPER_COST_PER_SEARCH
    const firecrawlCost = estimatedUrls * FIRECRAWL_COST_PER_PAGE
    const llmCost = estimatedUrls * LLM_COST_PER_URL
    const totalCost = serpCost + firecrawlCost + llmCost

    const response: EstimateScraperCostResponse = {
      total_combinations: totalCombinations,
      total_queries: totalSearches,
      estimated_urls: estimatedUrls,
      costs: {
        serp: Math.round(serpCost * 1000) / 1000,
        firecrawl: Math.round(firecrawlCost * 1000) / 1000,
        llm_extraction: Math.round(llmCost * 1000) / 1000,
        total: Math.round(totalCost * 1000) / 1000,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error estimating cost:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
