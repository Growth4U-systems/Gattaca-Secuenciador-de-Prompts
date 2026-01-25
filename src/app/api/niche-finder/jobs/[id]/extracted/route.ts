import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/niche-finder/jobs/[id]/extracted
 * Returns extracted niches for a job, with optional pagination
 */
export async function GET(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: jobId } = await params

  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get extracted niches
    const { data: niches, error: nichesError, count } = await supabase
      .from('niche_finder_extracted')
      .select('*', { count: 'exact' })
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (nichesError) {
      console.error('[Extracted API] Error fetching niches:', nichesError)
      return NextResponse.json({ error: nichesError.message }, { status: 500 })
    }

    // Get URL info for each niche to include source details
    const urlIds = [...new Set((niches || []).map(n => n.url_id))]
    let urlMap: Record<string, { url: string; source_type: string }> = {}

    if (urlIds.length > 0) {
      const { data: urls } = await supabase
        .from('niche_finder_urls')
        .select('id, url, source_type')
        .in('id', urlIds)

      if (urls) {
        urlMap = urls.reduce((acc, u) => {
          acc[u.id] = { url: u.url, source_type: u.source_type }
          return acc
        }, {} as Record<string, { url: string; source_type: string }>)
      }
    }

    // Enrich niches with URL info
    const enrichedNiches = (niches || []).map(niche => ({
      ...niche,
      url_info: urlMap[niche.url_id] || null,
    }))

    // Get processing stats
    const { data: job } = await supabase
      .from('niche_finder_jobs')
      .select('urls_found, urls_scraped, urls_filtered, niches_extracted, status, extract_completed, extract_total')
      .eq('id', jobId)
      .single()

    // Get URL status breakdown
    const { data: urlStats } = await supabase
      .from('niche_finder_urls')
      .select('status')
      .eq('job_id', jobId)

    const statusCounts = (urlStats || []).reduce((acc, u) => {
      acc[u.status] = (acc[u.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      niches: enrichedNiches,
      total: count || 0,
      limit,
      offset,
      stats: {
        job_status: job?.status,
        urls_found: job?.urls_found || 0,
        urls_scraped: job?.urls_scraped || 0,
        urls_filtered: job?.urls_filtered || 0,
        niches_extracted: job?.niches_extracted || 0,
        extract_completed: job?.extract_completed || 0,
        extract_total: job?.extract_total || 0,
        url_status_breakdown: statusCounts,
      },
    })
  } catch (error) {
    console.error('[Extracted API] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
