import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/niche-finder/jobs/[id]/urls/retry
 *
 * Resets failed URLs to pending status so they can be re-scraped.
 * Also resets the job status to allow scraping to continue.
 *
 * Body:
 * - urlIds: string[] - IDs of URLs to retry (optional - if not provided, retries all failed)
 */
export async function POST(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: jobId } = await params

  try {
    const body = await request.json().catch(() => ({}))
    const { urlIds } = body

    // Build query to reset failed URLs
    let query = supabase
      .from('niche_finder_urls')
      .update({
        status: 'pending',
        error_message: null,
      })
      .eq('job_id', jobId)
      .eq('status', 'failed')

    // If specific URL IDs provided, filter to those
    if (Array.isArray(urlIds) && urlIds.length > 0) {
      query = query.in('id', urlIds)
    }

    const { error: updateError, count } = await query

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Reset job status to allow scraping to continue
    // Only reset if currently in scrape_done (completed scraping)
    const { data: job } = await supabase
      .from('niche_finder_jobs')
      .select('status')
      .eq('id', jobId)
      .single()

    if (job?.status === 'scrape_done') {
      await supabase
        .from('niche_finder_jobs')
        .update({ status: 'serp_done' })
        .eq('id', jobId)
    }

    return NextResponse.json({
      success: true,
      resetCount: count || 0,
      message: `${count || 0} URLs reset for retry`,
    })
  } catch (error) {
    console.error('Error retrying URLs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
