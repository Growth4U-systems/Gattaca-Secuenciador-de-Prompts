import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { serperSearch, SERPER_COST_PER_SEARCH } from '@/lib/serper'
import { generateSearchQueries } from '@/lib/scraper/query-builder'
import { isLikelyBlog, scoreUrlQuality } from '@/lib/scraper/url-filter'
import { getUserApiKey } from '@/lib/getUserApiKey'
import type { ScraperStepConfig } from '@/types/scraper.types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: jobId } = await params

  // Get authenticated user
  const serverClient = await createServerClient()
  const { data: { session } } = await serverClient.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get Serper API key (user's personal key or env fallback)
  const serperApiKey = await getUserApiKey({
    userId: session.user.id,
    serviceName: 'serper',
    supabase: serverClient,
  })

  if (!serperApiKey) {
    return NextResponse.json({
      error: 'Serper API key not configured. Please add your Serper API key in Settings > APIs.',
      code: 'MISSING_API_KEY',
      service: 'serper',
    }, { status: 400 })
  }

  try {
    // Get job
    const { data: job, error: jobError } = await supabase
      .from('niche_finder_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot start SERP for job in status: ${job.status}` },
        { status: 400 }
      )
    }

    // Update job status
    await supabase
      .from('niche_finder_jobs')
      .update({ status: 'serp_running', started_at: new Date().toISOString() })
      .eq('id', jobId)

    const config: ScraperStepConfig = job.config

    // Generate all search queries
    const queries = generateSearchQueries(config)
    const serpPages = config.serp_pages || 5

    // Track unique URLs to avoid duplicates
    const seenUrls = new Set<string>()
    const urlsToInsert: Array<{
      job_id: string
      life_context: string
      product_word: string
      indicator: string | null
      source_type: string
      url: string
      title: string
      snippet: string
      position: number
      status: string
    }> = []

    let totalSearches = 0
    let totalCost = 0

    // Execute searches (with rate limiting)
    for (const queryInfo of queries) {
      try {
        // Search multiple pages
        for (let page = 1; page <= serpPages; page++) {
          const response = await serperSearch({
            query: queryInfo.query,
            page,
            numResults: 10,
          }, serperApiKey)

          totalSearches++
          totalCost += SERPER_COST_PER_SEARCH

          // Process results - filter out blogs and low-quality URLs
          for (const result of response.organic) {
            if (!seenUrls.has(result.link)) {
              // Skip blogs and articles - we want forums with discussions
              if (isLikelyBlog(result.link)) {
                console.log(`Filtered blog/article: ${result.link}`)
                continue
              }

              // Check URL quality score (minimum 40)
              const qualityScore = scoreUrlQuality(result.link)
              if (qualityScore < 40) {
                console.log(`Filtered low-quality URL (score ${qualityScore}): ${result.link}`)
                continue
              }

              seenUrls.add(result.link)
              urlsToInsert.push({
                job_id: jobId,
                life_context: queryInfo.lifeContext,
                product_word: queryInfo.productWord,
                indicator: queryInfo.indicator || null,
                source_type: queryInfo.sourceType,
                url: result.link,
                title: result.title || '',
                snippet: result.snippet || '',
                position: result.position,
                status: 'pending',
              })
            }
          }

          // Rate limiting - 100ms between requests
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`Error searching for: ${queryInfo.query}`, error)
        // Continue with other queries
      }
    }

    // Insert all URLs in batches
    if (urlsToInsert.length > 0) {
      const batchSize = 100
      for (let i = 0; i < urlsToInsert.length; i += batchSize) {
        const batch = urlsToInsert.slice(i, i + batchSize)
        await supabase.from('niche_finder_urls').insert(batch)
      }
    }

    // Record cost
    await supabase.from('niche_finder_costs').insert({
      job_id: jobId,
      cost_type: 'serp',
      service: 'serper',
      units: totalSearches,
      cost_usd: totalCost,
      metadata: { queries_executed: queries.length, pages_per_query: serpPages },
    })

    // Update job with URL count
    await supabase
      .from('niche_finder_jobs')
      .update({
        status: 'serp_done',
        urls_found: urlsToInsert.length,
      })
      .eq('id', jobId)

    return NextResponse.json({
      success: true,
      urls_found: urlsToInsert.length,
      searches_executed: totalSearches,
      cost_usd: totalCost,
    })
  } catch (error) {
    console.error('Error in SERP route:', error)

    // Update job status to failed
    await supabase
      .from('niche_finder_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', jobId)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
