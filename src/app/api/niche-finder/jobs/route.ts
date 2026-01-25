import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '10')
    const withUrls = searchParams.get('with_urls') === 'true' // Filter to jobs with URLs found

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    let query = supabase
      .from('niche_finder_jobs')
      .select('id, status, serp_completed, serp_total, urls_found, urls_scraped, niches_extracted, config, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    // Filter to jobs that have URLs found (useful for showing reusable jobs)
    if (withUrls) {
      query = query.gt('urls_found', 0)
    }

    const { data: jobs, error } = await query

    if (error) {
      console.error('[Jobs API] Error fetching jobs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('[Jobs API] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
