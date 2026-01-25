import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// Cost estimation constants (based on GPT-4o-mini pricing)
const COST_PER_1K_INPUT_TOKENS = 0.00015
const COST_PER_1K_OUTPUT_TOKENS = 0.0006
const AVG_CHARS_PER_TOKEN = 4
const ESTIMATED_OUTPUT_TOKENS_PER_URL = 200

/**
 * GET /api/niche-finder/jobs/[id]/urls/scraped
 *
 * Returns scraped URLs with their content and selection status.
 * Supports pagination for scroll-infinite loading.
 *
 * Query params:
 * - limit: number of URLs to return (default 20)
 * - offset: pagination offset (default 0)
 * - status: filter by status ('scraped', 'failed', 'all') - default 'all'
 */
export async function GET(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  // Create Supabase client with caching disabled
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  })
  const { id: jobId } = await params

  // Parse query params
  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get('limit') || '20', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const statusFilter = searchParams.get('status') || 'all'

  try {
    // Get status counts for summary (lightweight query)
    const { data: statusOnly } = await supabase
      .from('niche_finder_urls')
      .select('status')
      .eq('job_id', jobId)

    const allUrls = statusOnly || []

    // Count by status
    const scrapedCount = allUrls.filter(u => u.status === 'scraped').length
    const failedCount = allUrls.filter(u => u.status === 'failed').length

    // Count selected URLs (for cost estimation)
    const { count: selectedCount } = await supabase
      .from('niche_finder_urls')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('status', 'scraped')
      .eq('selected', true)

    console.log(`[SCRAPED] Job ${jobId}: scraped=${scrapedCount}, failed=${failedCount}, selected=${selectedCount || 0}`)

    // Get word count from job record (approximate) to avoid loading all content
    const { data: job } = await supabase
      .from('niche_finder_jobs')
      .select('urls_scraped')
      .eq('id', jobId)
      .single()

    // Estimate words based on average (500 words per URL is typical)
    const avgWordsPerUrl = 500
    const totalWords = scrapedCount * avgWordsPerUrl
    const selectedWords = (selectedCount || 0) * avgWordsPerUrl

    // Estimate cost based on selected URLs
    const estimatedInputTokens = selectedWords
    const estimatedOutputTokens = (selectedCount || 0) * ESTIMATED_OUTPUT_TOKENS_PER_URL
    const estimatedCost = (estimatedInputTokens / 1000 * COST_PER_1K_INPUT_TOKENS) +
                          (estimatedOutputTokens / 1000 * COST_PER_1K_OUTPUT_TOKENS)

    // Get paginated URLs with full data
    const { data: directUrls, error: directError } = await supabase
      .from('niche_finder_urls')
      .select('*')
      .eq('job_id', jobId)

    if (directError) {
      console.error('[SCRAPED] Query error:', directError)
      return NextResponse.json({ error: directError.message }, { status: 500 })
    }

    // Filter and sort in JS
    let jsFiltered = (directUrls || []).filter(u =>
      u.status === 'scraped' || u.status === 'failed'
    )

    // Apply status filter
    if (statusFilter === 'scraped') {
      jsFiltered = jsFiltered.filter(u => u.status === 'scraped')
    } else if (statusFilter === 'failed') {
      jsFiltered = jsFiltered.filter(u => u.status === 'failed')
    }

    // Sort: scraped first, then by id
    jsFiltered.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'scraped' ? -1 : 1
      }
      return a.id.localeCompare(b.id)
    })

    // Apply pagination
    const filteredUrls = jsFiltered.slice(offset, offset + limit)
    const totalFiltered = jsFiltered.length

    // Process URLs to add word_count and truncate content for preview
    const processedUrls = filteredUrls.map(url => {
      const wordCount = url.content_markdown
        ? url.content_markdown.split(/\s+/).length
        : 0

      return {
        id: url.id,
        url: url.url,
        title: url.title || url.url,
        source_type: url.source_type,
        status: url.status,
        content_markdown: url.content_markdown,
        word_count: wordCount,
        error_message: url.error_message,
        selected: url.selected ?? true,
        life_context: url.life_context,
        product_word: url.product_word,
      }
    })

    // Separate scraped and failed for the response
    const scrapedList = processedUrls.filter(u => u.status === 'scraped')
    const failedList = processedUrls.filter(u => u.status === 'failed')

    return NextResponse.json({
      summary: {
        total: scrapedCount + failedCount,
        scraped: scrapedCount,
        failed: failedCount,
        selected: selectedCount || 0,
        totalWords,
        selectedWords,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
      },
      urls: scrapedList,
      failedUrls: failedList,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < totalFiltered,
        totalFiltered,
      }
    })
  } catch (error) {
    console.error('Error getting scraped URLs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
