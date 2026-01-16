import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { NicheFinderResults } from '@/types/scraper.types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ jobId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { jobId } = await params

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

    // Get extracted niches
    const { data: niches, error: nichesError } = await supabase
      .from('niche_finder_extracted')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })

    if (nichesError) {
      throw new Error(`Failed to fetch niches: ${nichesError.message}`)
    }

    // Get costs
    const { data: costs } = await supabase
      .from('niche_finder_costs')
      .select('cost_type, cost_usd')
      .eq('job_id', jobId)

    const totalCosts = {
      serp: 0,
      firecrawl: 0,
      llm: 0,
      total: 0,
    }

    for (const cost of costs || []) {
      if (cost.cost_type === 'serp') totalCosts.serp += cost.cost_usd
      else if (cost.cost_type === 'firecrawl') totalCosts.firecrawl += cost.cost_usd
      else if (cost.cost_type === 'llm_extraction') totalCosts.llm += cost.cost_usd
      totalCosts.total += cost.cost_usd
    }

    // Calculate duration
    const startTime = job.started_at ? new Date(job.started_at).getTime() : 0
    const endTime = job.completed_at
      ? new Date(job.completed_at).getTime()
      : Date.now()
    const duration_ms = startTime ? endTime - startTime : 0

    const results: NicheFinderResults = {
      job_id: jobId,
      niches: niches || [],
      urls: {
        found: job.urls_found || 0,
        scraped: job.urls_scraped || 0,
        filtered: job.urls_filtered || 0,
        failed: job.urls_failed || 0,
      },
      costs: totalCosts,
      duration_ms,
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error getting results:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
