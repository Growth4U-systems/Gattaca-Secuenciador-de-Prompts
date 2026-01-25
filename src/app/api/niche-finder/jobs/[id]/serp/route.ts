import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { serperSearch, SERPER_COST_PER_SEARCH } from '@/lib/serper'
import { generateSearchQueries } from '@/lib/scraper/query-builder'
import { isLikelyBlog, scoreUrlQuality } from '@/lib/scraper/url-filter'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { trackSerpUsage } from '@/lib/polar-usage'
import type { ScraperStepConfig } from '@/types/scraper.types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for SERP searches

// Process in chunks to avoid Vercel timeout
// With 100ms per search, 250 searches = 25 seconds per chunk (safe margin)
const CHUNK_SIZE = 250
const MAX_EXECUTION_TIME_MS = 270000 // 4.5 minutes - leave margin for cleanup

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

    // Allow resuming jobs that were interrupted (serp_running status)
    if (job.status !== 'pending' && job.status !== 'serp_running') {
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
    const startTime = Date.now()

    // Generate all search queries
    const queries = generateSearchQueries(config)
    const serpPages = config.serp_pages || 5

    // Track unique URLs to avoid duplicates - load existing URLs first
    const { data: existingUrls } = await supabase
      .from('niche_finder_urls')
      .select('url')
      .eq('job_id', jobId)

    const seenUrls = new Set<string>((existingUrls || []).map(u => u.url))

    // Resume from where we left off if job was interrupted
    const startFromSearch = job.serp_completed || 0
    let totalSearches = startFromSearch
    let totalCost = 0
    let totalUrlsInserted = seenUrls.size

    // Calculate which query/page to start from
    const startQueryIndex = Math.floor(startFromSearch / serpPages)
    const startPageIndex = startFromSearch % serpPages

    // Update job with total expected queries for progress tracking (only if first run)
    const totalExpectedSearches = queries.length * serpPages
    if (job.status === 'pending') {
      await supabase
        .from('niche_finder_jobs')
        .update({
          status: 'serp_running',
          started_at: new Date().toISOString(),
          serp_total: totalExpectedSearches,
          serp_completed: 0,
          urls_found: 0
        })
        .eq('id', jobId)
    } else {
      // Resuming - just update status
      console.log(`[SERP] Resuming job ${jobId} from search ${startFromSearch}/${totalExpectedSearches}`)
    }

    // Execute searches (with rate limiting) - INSERT URLs incrementally
    // Start from where we left off if resuming
    let interrupted = false

    for (let qi = startQueryIndex; qi < queries.length; qi++) {
      const queryInfo = queries[qi]

      // Check if we're running out of time
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.log(`[SERP] Time limit approaching, pausing job ${jobId} at search ${totalSearches}`)
        interrupted = true
        break
      }

      try {
        // Determine starting page (only for first query when resuming)
        const startPage = (qi === startQueryIndex) ? (startPageIndex + 1) : 1

        // Search multiple pages
        for (let page = startPage; page <= serpPages; page++) {
          // Check time again before each search
          if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
            console.log(`[SERP] Time limit reached mid-query, pausing at search ${totalSearches}`)
            interrupted = true
            break
          }

          const response = await serperSearch({
            query: queryInfo.query,
            page,
            numResults: 10,
          }, serperApiKey)

          totalSearches++
          totalCost += SERPER_COST_PER_SEARCH

          // Process results - filter out blogs and low-quality URLs
          const organic = response.organic || []
          const urlsFromThisSearch: Array<{
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

          for (const result of organic) {
            if (!seenUrls.has(result.link)) {
              // Skip blogs and articles - we want forums with discussions
              if (isLikelyBlog(result.link)) {
                continue
              }

              // Check URL quality score (minimum 40)
              const qualityScore = scoreUrlQuality(result.link)
              if (qualityScore < 40) {
                continue
              }

              seenUrls.add(result.link)
              urlsFromThisSearch.push({
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

          // INSERT URLs immediately (not at the end)
          if (urlsFromThisSearch.length > 0) {
            await supabase.from('niche_finder_urls').insert(urlsFromThisSearch)
            totalUrlsInserted += urlsFromThisSearch.length
          }

          // Update progress in real-time with URLs found
          await supabase
            .from('niche_finder_jobs')
            .update({
              serp_completed: totalSearches,
              urls_found: totalUrlsInserted
            })
            .eq('id', jobId)

          // Rate limiting - 100ms between requests
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        if (interrupted) break
      } catch (error) {
        console.error(`Error searching for: ${queryInfo.query}`, error)
        // Continue with other queries
      }
    }

    // Record cost (only if we actually did searches this run)
    const searchesThisRun = totalSearches - startFromSearch
    if (searchesThisRun > 0) {
      await supabase.from('niche_finder_costs').insert({
        job_id: jobId,
        cost_type: 'serp',
        service: 'serper',
        units: searchesThisRun,
        cost_usd: searchesThisRun * SERPER_COST_PER_SEARCH,
        metadata: {
          queries_executed: queries.length,
          pages_per_query: serpPages,
          resumed_from: startFromSearch,
          completed_to: totalSearches,
        },
      })

      // Track usage in Polar (async, don't block response)
      if (session.user.id) {
        trackSerpUsage(session.user.id, searchesThisRun, 'serper').catch((err) => {
          console.warn('[SERP] Failed to track usage in Polar:', err)
        })
      }
    }

    // Update job with final status
    if (interrupted) {
      // Job was paused due to time limit - will be resumed on next call
      return NextResponse.json({
        success: true,
        interrupted: true,
        message: 'Job paused due to time limit. Call this endpoint again to resume.',
        urls_found: totalUrlsInserted,
        searches_executed: totalSearches,
        total_searches: totalExpectedSearches,
        remaining: totalExpectedSearches - totalSearches,
      })
    }

    // Completed all searches
    await supabase
      .from('niche_finder_jobs')
      .update({
        status: 'serp_done',
        urls_found: totalUrlsInserted,
      })
      .eq('id', jobId)

    return NextResponse.json({
      success: true,
      urls_found: totalUrlsInserted,
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
