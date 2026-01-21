import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * PATCH /api/niche-finder/jobs/[id]/urls/selection
 *
 * Updates the selection status of URLs.
 * Used to persist checkbox state for which URLs to include in extraction.
 *
 * Body:
 * - urlIds: string[] - IDs of URLs to update
 * - selected: boolean - new selection state
 *
 * Or for bulk operations:
 * - selectAll: boolean - select or deselect all URLs for this job
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: jobId } = await params

  try {
    const body = await request.json()
    const { urlIds, selected, selectAll } = body

    // Bulk operation: select/deselect all
    if (typeof selectAll === 'boolean') {
      const { error } = await supabase
        .from('niche_finder_urls')
        .update({ selected: selectAll })
        .eq('job_id', jobId)
        .eq('status', 'scraped')

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: selectAll ? 'All URLs selected' : 'All URLs deselected',
      })
    }

    // Individual URL selection
    if (!Array.isArray(urlIds) || urlIds.length === 0) {
      return NextResponse.json(
        { error: 'urlIds array is required' },
        { status: 400 }
      )
    }

    if (typeof selected !== 'boolean') {
      return NextResponse.json(
        { error: 'selected boolean is required' },
        { status: 400 }
      )
    }

    // Update selection for specified URLs
    const { error, count } = await supabase
      .from('niche_finder_urls')
      .update({ selected })
      .eq('job_id', jobId)
      .in('id', urlIds)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      updated: count || urlIds.length,
      selected,
    })
  } catch (error) {
    console.error('Error updating URL selection:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
