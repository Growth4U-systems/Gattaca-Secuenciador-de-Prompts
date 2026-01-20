import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { NicheFinderProgress } from '@/types/scraper.types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
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

    // Get URL counts by status
    const { data: urlCounts } = await supabase
      .from('niche_finder_urls')
      .select('status')
      .eq('job_id', jobId)

    const counts = {
      pending: 0,
      scraped: 0,
      filtered: 0,
      extracted: 0,
      failed: 0,
    }

    for (const url of urlCounts || []) {
      counts[url.status as keyof typeof counts]++
    }

    // Determine current phase
    let phase: NicheFinderProgress['phase'] = 'done'
    if (job.status === 'serp_running' || job.status === 'pending') {
      phase = 'serp'
    } else if (job.status === 'scraping' || job.status === 'serp_done') {
      phase = 'scraping'
    } else if (job.status === 'extracting' || job.status === 'scrape_done') {
      phase = 'extracting'
    }

    // Get total costs
    const { data: costs } = await supabase
      .from('niche_finder_costs')
      .select('cost_type, cost_usd')
      .eq('job_id', jobId)

    const totalCosts = {
      serp: 0,
      firecrawl: 0,
      llm: 0,
    }

    for (const cost of costs || []) {
      if (cost.cost_type === 'serp') totalCosts.serp += cost.cost_usd
      else if (cost.cost_type === 'firecrawl') totalCosts.firecrawl += cost.cost_usd
      else if (cost.cost_type === 'llm_extraction') totalCosts.llm += cost.cost_usd
    }

    const progress: NicheFinderProgress = {
      job_id: jobId,
      status: job.status,
      phase,
      progress: {
        serp: {
          total: job.serp_total || job.urls_found || 0,
          completed: job.serp_completed || job.urls_found || 0,
        },
        scraping: {
          total: job.urls_found || 0,
          completed: job.urls_scraped || 0,
          failed: job.urls_failed || 0,
        },
        extraction: {
          total: job.urls_scraped || 0,
          completed: counts.extracted + counts.filtered,
          filtered: counts.filtered,
        },
      },
    }

    return NextResponse.json({
      ...progress,
      job,
      costs: totalCosts,
      url_counts: counts,
    })
  } catch (error) {
    console.error('Error getting job status:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
