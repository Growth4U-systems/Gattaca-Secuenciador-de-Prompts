import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/niche-finder/jobs/latest?project_id=xxx
 *
 * Returns the most recent niche finder job for a project,
 * along with saved docs count for state restoration.
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  try {
    // Get most recent job for this project
    const { data: job, error: jobError } = await supabase
      .from('niche_finder_jobs')
      .select('id, status, config, urls_found, urls_scraped, urls_failed, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ job: null })
    }

    // Check how many docs were saved for this job
    const { count: savedDocsCount } = await supabase
      .from('niche_finder_saved_docs')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', job.id)

    return NextResponse.json({
      job,
      saved_docs_count: savedDocsCount || 0,
    })
  } catch (error) {
    console.error('Error fetching latest job:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
