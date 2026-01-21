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

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: jobId } = await params

  // Parse query params
  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get('limit') || '20', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const statusFilter = searchParams.get('status') || 'all'

  try {
    // First, get summary statistics
    const { data: allUrls, error: countError } = await supabase
      .from('niche_finder_urls')
      .select('id, status, content_markdown, selected')
      .eq('job_id', jobId)
      .in('status', ['scraped', 'failed'])

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    // Calculate summary
    const scrapedUrls = allUrls?.filter(u => u.status === 'scraped') || []
    const failedUrls = allUrls?.filter(u => u.status === 'failed') || []
    const selectedUrls = scrapedUrls.filter(u => u.selected === true)

    let totalWords = 0
    for (const url of scrapedUrls) {
      if (url.content_markdown) {
        totalWords += url.content_markdown.split(/\s+/).length
      }
    }

    // Calculate selected words for cost estimation
    let selectedWords = 0
    for (const url of selectedUrls) {
      if (url.content_markdown) {
        selectedWords += url.content_markdown.split(/\s+/).length
      }
    }

    // Estimate cost based on selected URLs
    const estimatedInputTokens = (selectedWords * AVG_CHARS_PER_TOKEN) / AVG_CHARS_PER_TOKEN
    const estimatedOutputTokens = selectedUrls.length * ESTIMATED_OUTPUT_TOKENS_PER_URL
    const estimatedCost = (estimatedInputTokens / 1000 * COST_PER_1K_INPUT_TOKENS) +
                          (estimatedOutputTokens / 1000 * COST_PER_1K_OUTPUT_TOKENS)

    // Build query for paginated URLs
    let query = supabase
      .from('niche_finder_urls')
      .select('id, url, title, source_type, status, content_markdown, error_message, selected, life_context, product_word')
      .eq('job_id', jobId)

    // Apply status filter
    if (statusFilter === 'scraped') {
      query = query.eq('status', 'scraped')
    } else if (statusFilter === 'failed') {
      query = query.eq('status', 'failed')
    } else {
      query = query.in('status', ['scraped', 'failed'])
    }

    // Order by status (scraped first) then by id
    query = query.order('status', { ascending: true }).order('id')

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: urls, error: urlsError } = await query

    if (urlsError) {
      return NextResponse.json({ error: urlsError.message }, { status: 500 })
    }

    // Process URLs to add word_count and truncate content for preview
    const processedUrls = (urls || []).map(url => {
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
        total: allUrls?.length || 0,
        scraped: scrapedUrls.length,
        failed: failedUrls.length,
        selected: selectedUrls.length,
        totalWords,
        selectedWords,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
      },
      urls: scrapedList,
      failedUrls: failedList,
      pagination: {
        limit,
        offset,
        hasMore: (urls?.length || 0) === limit,
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
