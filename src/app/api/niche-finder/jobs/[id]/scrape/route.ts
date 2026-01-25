import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { trackScrapeUsage } from '@/lib/polar-usage'

export const dynamic = 'force-dynamic'

// Firecrawl cost per page
const FIRECRAWL_COST_PER_PAGE = 0.001

// Reddit scraper using public JSON API
async function scrapeRedditUrl(url: string): Promise<{ success: boolean; markdown?: string; error?: string }> {
  try {
    // Convert Reddit URL to JSON endpoint
    // https://www.reddit.com/r/sub/comments/id/title -> https://www.reddit.com/r/sub/comments/id/title.json
    let jsonUrl = url.replace(/\?.*$/, '') // Remove query params
    if (!jsonUrl.endsWith('.json')) {
      jsonUrl = jsonUrl.replace(/\/$/, '') + '.json'
    }

    console.log(`[SCRAPE-REDDIT] Fetching: ${jsonUrl}`)

    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NicheFinderBot/1.0)',
      },
    })

    if (!response.ok) {
      return { success: false, error: `Reddit API error: ${response.status}` }
    }

    const data = await response.json()

    // Reddit returns an array: [post, comments]
    if (!Array.isArray(data) || data.length < 2) {
      return { success: false, error: 'Invalid Reddit response format' }
    }

    const post = data[0]?.data?.children?.[0]?.data
    const comments = data[1]?.data?.children || []

    if (!post) {
      return { success: false, error: 'Could not extract post data' }
    }

    // Build markdown content
    let markdown = `# ${post.title}\n\n`
    markdown += `**Subreddit:** r/${post.subreddit}\n`
    markdown += `**Score:** ${post.score} | **Comments:** ${post.num_comments}\n\n`

    if (post.selftext) {
      markdown += `## Post Content\n\n${post.selftext}\n\n`
    }

    // Add top comments (limit to 20)
    if (comments.length > 0) {
      markdown += `## Top Comments\n\n`
      let commentCount = 0
      for (const comment of comments) {
        if (comment.kind === 't1' && comment.data?.body && commentCount < 20) {
          const body = comment.data.body
          const score = comment.data.score || 0
          markdown += `---\n**Score: ${score}**\n\n${body}\n\n`
          commentCount++
        }
      }
    }

    console.log(`[SCRAPE-REDDIT] Success: ${url.substring(0, 50)}... (${markdown.length} chars)`)
    return { success: true, markdown }

  } catch (error) {
    console.error(`[SCRAPE-REDDIT] Error for ${url}:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

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

  // Get Firecrawl API key (user's personal key or env fallback)
  const firecrawlApiKey = await getUserApiKey({
    userId: session.user.id,
    serviceName: 'firecrawl',
    supabase: serverClient,
  })

  if (!firecrawlApiKey) {
    return NextResponse.json({
      error: 'Firecrawl API key not configured. Please add your API key in Settings > API Keys.',
      code: 'MISSING_API_KEY',
      service: 'firecrawl',
    }, { status: 400 })
  }

  // Log API key prefix for debugging (first 8 chars only)
  console.log(`[SCRAPE] Using Firecrawl API key: ${firecrawlApiKey.substring(0, 8)}...`)

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

    // Allow scraping if status is serp_done or scrape_done (resuming) or scraping
    if (!['serp_done', 'scrape_done', 'scraping'].includes(job.status)) {
      return NextResponse.json(
        { error: `Cannot scrape for job in status: ${job.status}` },
        { status: 400 }
      )
    }

    // Update job status
    await supabase.from('niche_finder_jobs').update({ status: 'scraping' }).eq('id', jobId)

    const batchSize = job.config?.batch_size || 10

    // Debug: Check URL status distribution
    const { data: urlStatusCheck } = await supabase
      .from('niche_finder_urls')
      .select('status')
      .eq('job_id', jobId)
      .limit(100)

    const statusCounts = urlStatusCheck?.reduce((acc, u) => {
      acc[u.status] = (acc[u.status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    console.log(`[SCRAPE] URL status distribution for job ${jobId}:`, JSON.stringify(statusCounts))

    // Get pending URLs
    const { data: pendingUrls, error: urlsError } = await supabase
      .from('niche_finder_urls')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'pending')
      .limit(batchSize)

    console.log(`[SCRAPE] Found ${pendingUrls?.length || 0} pending URLs for job ${jobId}`)

    if (urlsError) {
      throw new Error(`Failed to fetch URLs: ${urlsError.message}`)
    }

    if (!pendingUrls || pendingUrls.length === 0) {
      // No more URLs to scrape, update status
      console.log(`[SCRAPE] No pending URLs found, marking job as scrape_done`)
      await supabase.from('niche_finder_jobs').update({ status: 'scrape_done' }).eq('id', jobId)

      return NextResponse.json({
        success: true,
        scraped: 0,
        remaining: 0,
        message: 'No more URLs to scrape',
      })
    }

    let successCount = 0
    let failCount = 0
    let skippedCount = 0
    let totalCost = 0
    let lastScrapedUrl = ''
    let lastScrapedSnippet = ''

    // Rate limiting: Firecrawl free tier is ~100 req/min, so we add 600ms delay
    const DELAY_BETWEEN_REQUESTS_MS = 600

    // Helper to check if URL is a Reddit URL
    const isRedditUrl = (url: string): boolean => {
      return url.includes('reddit.com')
    }

    // Helper to check if URL should be skipped entirely
    const shouldSkipUrl = (url: string): boolean => {
      // Google Translate URLs are not useful
      if (url.includes('translate.google.com')) return true
      return false
    }

    // Helper for rate-limited retries
    const scrapeWithRetry = async (url: string, maxRetries = 3): Promise<{ success: boolean; markdown?: string; error?: string }> => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            formats: ['markdown'],
            onlyMainContent: true,
          }),
        })

        const data = await response.json()

        if (response.ok) {
          return { success: true, markdown: data.data?.markdown || '' }
        }

        const errorMsg = data?.error || data?.message || `HTTP ${response.status}`

        // Check if rate limited
        if (errorMsg.includes('Rate limit') || response.status === 429) {
          // Extract wait time from error message or use default
          const waitMatch = errorMsg.match(/retry after (\d+)s/)
          const waitSeconds = waitMatch ? parseInt(waitMatch[1]) : 30
          console.log(`[SCRAPE] Rate limited, waiting ${waitSeconds}s before retry ${attempt + 1}/${maxRetries}`)
          await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000))
          continue
        }

        // Non-retryable error
        return { success: false, error: errorMsg }
      }
      return { success: false, error: 'Max retries exceeded due to rate limiting' }
    }

    // Scrape URLs sequentially to update progress in real-time
    for (const urlRecord of pendingUrls) {
      try {
        // Skip URLs that should be ignored
        if (shouldSkipUrl(urlRecord.url)) {
          console.log(`[SCRAPE] Skipping unsupported URL: ${urlRecord.url.substring(0, 60)}...`)
          await supabase
            .from('niche_finder_urls')
            .update({
              status: 'skipped',
              error_message: 'URL not supported (Google Translate)',
            })
            .eq('id', urlRecord.id)
          skippedCount++
          continue
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS))

        let result: { success: boolean; markdown?: string; error?: string }

        // Use appropriate scraper based on URL
        if (isRedditUrl(urlRecord.url)) {
          // Use Reddit JSON API scraper
          result = await scrapeRedditUrl(urlRecord.url)
        } else {
          // Use Firecrawl for other URLs
          result = await scrapeWithRetry(urlRecord.url)
        }

        if (!result.success) {
          console.error(`[SCRAPE] Error for ${urlRecord.url}: ${result.error}`)
          throw new Error(result.error || 'Unknown scrape error')
        }

        const markdown = result.markdown || ''

        // Log successful scrape
        console.log(`[SCRAPE] Success: ${urlRecord.url.substring(0, 60)}... (${markdown.length} chars)`)

        // Update URL record with content
        await supabase
          .from('niche_finder_urls')
          .update({
            status: 'scraped',
            content_markdown: markdown,
          })
          .eq('id', urlRecord.id)

        successCount++
        totalCost += FIRECRAWL_COST_PER_PAGE

        // Track last successful scrape for UI feedback
        lastScrapedUrl = urlRecord.url
        // Get first 200 chars of content as snippet
        lastScrapedSnippet = markdown.substring(0, 200).replace(/\n/g, ' ').trim()
        if (markdown.length > 200) lastScrapedSnippet += '...'

        // Update job with partial results for real-time UI feedback
        await supabase
          .from('niche_finder_jobs')
          .update({
            last_scraped_url: lastScrapedUrl,
            last_scraped_snippet: lastScrapedSnippet,
            scrape_success_count: successCount + (job.scrape_success_count || 0),
            scrape_failed_count: failCount + (job.scrape_failed_count || 0),
          })
          .eq('id', jobId)

      } catch (error) {
        console.error(`Error scraping ${urlRecord.url}:`, error)

        await supabase
          .from('niche_finder_urls')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', urlRecord.id)

        failCount++

        // Update failed count in real-time too
        await supabase
          .from('niche_finder_jobs')
          .update({
            scrape_failed_count: failCount + (job.scrape_failed_count || 0),
          })
          .eq('id', jobId)
      }
    }

    // Record cost
    if (totalCost > 0) {
      await supabase.from('niche_finder_costs').insert({
        job_id: jobId,
        cost_type: 'firecrawl',
        service: 'firecrawl',
        units: successCount,
        cost_usd: totalCost,
      })
    }

    // Track usage in Polar (async, don't block response)
    // Note: Only Firecrawl scrapes are tracked - Reddit uses free public API
    if (successCount > 0 && session.user.id) {
      trackScrapeUsage(session.user.id, successCount, 'firecrawl').catch((err) => {
        console.warn('[SCRAPE] Failed to track usage in Polar:', err)
      })
    }

    // Update job counters - try RPC first, fallback to direct update
    try {
      await supabase.rpc('increment_niche_finder_counters', {
        p_job_id: jobId,
        p_urls_scraped: successCount,
        p_urls_failed: failCount,
      })
    } catch (rpcError) {
      console.log('[SCRAPE] RPC failed, using direct update:', rpcError)
      // Fallback: direct update
      const newScrapedCount = (job.urls_scraped || 0) + successCount
      const newFailedCount = (job.urls_failed || 0) + failCount
      await supabase
        .from('niche_finder_jobs')
        .update({
          urls_scraped: newScrapedCount,
          urls_failed: newFailedCount,
        })
        .eq('id', jobId)
    }

    console.log(`[SCRAPE] Batch complete: ${successCount} success, ${failCount} failed`)

    // Check if more URLs remain
    const { count: remainingCount } = await supabase
      .from('niche_finder_urls')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('status', 'pending')

    const hasMore = (remainingCount || 0) > 0

    // Update job status if done
    if (!hasMore) {
      await supabase.from('niche_finder_jobs').update({ status: 'scrape_done' }).eq('id', jobId)
    }

    return NextResponse.json({
      success: true,
      scraped: successCount,
      failed: failCount,
      skipped: skippedCount,
      remaining: remainingCount || 0,
      cost_usd: totalCost,
      has_more: hasMore,
      // Real-time feedback for UI
      last_scraped_url: lastScrapedUrl,
      last_scraped_snippet: lastScrapedSnippet,
    })
  } catch (error) {
    console.error('Error in scrape route:', error)

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
