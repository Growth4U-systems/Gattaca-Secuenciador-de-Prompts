import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Firecrawl cost per page
const FIRECRAWL_COST_PER_PAGE = 0.001

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  if (!firecrawlApiKey) {
    return NextResponse.json({ error: 'Firecrawl API key not configured' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: jobId } = await params

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

    // Get pending URLs
    const { data: pendingUrls, error: urlsError } = await supabase
      .from('niche_finder_urls')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'pending')
      .limit(batchSize)

    if (urlsError) {
      throw new Error(`Failed to fetch URLs: ${urlsError.message}`)
    }

    if (!pendingUrls || pendingUrls.length === 0) {
      // No more URLs to scrape, update status
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
    let totalCost = 0

    // Scrape URLs in parallel
    const scrapePromises = pendingUrls.map(async (urlRecord) => {
      try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: urlRecord.url,
            formats: ['markdown'],
            onlyMainContent: true,
          }),
        })

        if (!response.ok) {
          throw new Error(`Firecrawl error: ${response.status}`)
        }

        const data = await response.json()
        const markdown = data.data?.markdown || ''

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
      }
    })

    await Promise.all(scrapePromises)

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

    // Update job counters using RPC for atomic update
    await supabase.rpc('increment_niche_finder_counters', {
      p_job_id: jobId,
      p_urls_scraped: successCount,
      p_urls_failed: failCount,
    })

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
      remaining: remainingCount || 0,
      cost_usd: totalCost,
      has_more: hasMore,
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
