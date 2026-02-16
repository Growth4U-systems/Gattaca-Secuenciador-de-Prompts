import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { serperSearch, SERPER_COST_PER_SEARCH } from '@/lib/serper'
import { isLikelyBlog, scoreUrlQuality, KNOWN_FORUM_DOMAINS } from '@/lib/scraper/url-filter'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { trackSerpUsage } from '@/lib/polar-usage'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface SerpSingleRequest {
  query?: string
  life_context?: string
  product_word?: string
  source_type?: 'reddit' | 'thematic_forum' | 'general_forum'
  source_domain?: string
  indicator?: string
  pages?: number
  serp_total?: number   // Set total expected searches (first call)
  finalize?: boolean    // Mark SERP as done (last call)
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

  // Get Serper API key
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
    const body: SerpSingleRequest = await request.json()

    // Verify job exists
    const { data: job, error: jobError } = await supabase
      .from('niche_finder_jobs')
      .select('id, status, urls_found')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Handle finalize: mark SERP as done
    if (body.finalize) {
      const { error: updateError } = await supabase
        .from('niche_finder_jobs')
        .update({ status: 'serp_done' })
        .eq('id', jobId)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to finalize SERP' }, { status: 500 })
      }
      return NextResponse.json({ success: true, status: 'serp_done' })
    }

    // Handle serp_total: set total expected searches (first call)
    if (body.serp_total !== undefined) {
      await supabase
        .from('niche_finder_jobs')
        .update({
          serp_total: body.serp_total,
          status: 'serp_running',
          started_at: job.status === 'pending' ? new Date().toISOString() : undefined,
        })
        .eq('id', jobId)

      return NextResponse.json({ success: true, serp_total: body.serp_total })
    }

    const { query, life_context, product_word, source_type, source_domain, indicator, pages } = body

    if (!query || !life_context || !product_word || !source_type || !pages) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['pending', 'serp_running'].includes(job.status)) {
      return NextResponse.json(
        { error: `Cannot run SERP for job in status: ${job.status}` },
        { status: 400 }
      )
    }

    // Update job to serp_running if still pending
    if (job.status === 'pending') {
      await supabase
        .from('niche_finder_jobs')
        .update({ status: 'serp_running', started_at: new Date().toISOString() })
        .eq('id', jobId)
    }

    // Get existing URLs for this job to deduplicate
    const { data: existingUrls } = await supabase
      .from('niche_finder_urls')
      .select('url')
      .eq('job_id', jobId)

    const seenUrls = new Set<string>((existingUrls || []).map(u => u.url))

    // If the query targets a known forum domain, skip aggressive blog/quality filtering
    const isForumTargeted = query.startsWith('site:') && KNOWN_FORUM_DOMAINS.some(d => query.includes(d))

    let totalSearches = 0
    let rawResults = 0
    let filteredBlog = 0
    let filteredQuality = 0
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

    // Search all pages for this single query
    for (let page = 1; page <= pages; page++) {
      try {
        const response = await serperSearch({
          query,
          page,
          numResults: 10,
        }, serperApiKey)

        totalSearches++
        const organic = response.organic || []
        rawResults += organic.length

        console.log(`[SERP-SINGLE] "${query}" p${page} → ${organic.length} results (forumTargeted=${isForumTargeted})`)

        for (const result of organic) {
          if (seenUrls.has(result.link)) continue

          // Only apply aggressive filtering for non-forum-targeted searches
          if (!isForumTargeted) {
            if (isLikelyBlog(result.link)) { filteredBlog++; continue }
            if (scoreUrlQuality(result.link) < 40) { filteredQuality++; continue }
          }

          seenUrls.add(result.link)
          urlsToInsert.push({
            job_id: jobId,
            life_context,
            product_word,
            indicator: indicator || null,
            source_type,
            url: result.link,
            title: result.title || '',
            snippet: result.snippet || '',
            position: result.position,
            status: 'pending',
          })
        }

        // Rate limiting between pages
        if (page < pages) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (err) {
        console.error(`[SERP-SINGLE] Error on page ${page} for query "${query}":`, err)
        // Continue with remaining pages
      }
    }

    console.log(`[SERP-SINGLE] Done "${query}": raw=${rawResults} accepted=${urlsToInsert.length} blog=${filteredBlog} quality=${filteredQuality}`)

    // Insert URLs
    let urlsInserted = 0
    if (urlsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('niche_finder_urls')
        .insert(urlsToInsert)

      if (insertError) {
        console.error('[SERP-SINGLE] URL insert error:', insertError)
      } else {
        urlsInserted = urlsToInsert.length
      }
    }

    // Update job progress atomically
    const { data: currentJob } = await supabase
      .from('niche_finder_jobs')
      .select('serp_completed, urls_found')
      .eq('id', jobId)
      .single()

    const newSerpCompleted = (currentJob?.serp_completed || 0) + totalSearches
    const newUrlsFound = (currentJob?.urls_found || 0) + urlsInserted

    const { error: updateError } = await supabase
      .from('niche_finder_jobs')
      .update({
        serp_completed: newSerpCompleted,
        urls_found: newUrlsFound,
      })
      .eq('id', jobId)

    if (updateError) {
      console.error('[SERP-SINGLE] Job update error:', updateError)
    }

    // Record cost
    const costUsd = totalSearches * SERPER_COST_PER_SEARCH
    if (totalSearches > 0) {
      await supabase.from('niche_finder_costs').insert({
        job_id: jobId,
        cost_type: 'serp',
        service: 'serper',
        units: totalSearches,
        cost_usd: costUsd,
        metadata: { query, source_domain, pages: totalSearches },
      })

      // Track usage in Polar (async)
      trackSerpUsage(session.user.id, totalSearches, 'serper').catch(err => {
        console.warn('[SERP-SINGLE] Failed to track usage:', err)
      })
    }

    return NextResponse.json({
      urls_inserted: urlsInserted,
      cost_usd: costUsd,
      searches: totalSearches,
      raw_results: rawResults,
      filtered_blog: filteredBlog,
      filtered_quality: filteredQuality,
    })
  } catch (error) {
    console.error('[SERP-SINGLE] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
