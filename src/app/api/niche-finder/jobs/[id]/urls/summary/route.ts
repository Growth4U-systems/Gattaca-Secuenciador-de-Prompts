import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/niche-finder/jobs/[id]/urls/summary
 *
 * Returns a summary of URLs grouped by source type.
 * This is used to show the user a high-level overview without loading all URLs.
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
    // Get all URLs for this job (just the fields we need for counting)
    const { data: urls, error } = await supabase
      .from('niche_finder_urls')
      .select('id, source_type, url, title, life_context, product_word')
      .eq('job_id', jobId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by source_type
    const sourceMap = new Map<string, {
      count: number
      urls: Array<{ id: string; url: string; title: string; life_context: string; product_word: string }>
    }>()

    for (const url of urls || []) {
      const existing = sourceMap.get(url.source_type) || { count: 0, urls: [] }
      existing.count++
      // Keep only first 5 for samples
      if (existing.urls.length < 5) {
        existing.urls.push({
          id: url.id,
          url: url.url,
          title: url.title,
          life_context: url.life_context,
          product_word: url.product_word
        })
      }
      sourceMap.set(url.source_type, existing)
    }

    // Convert to array format
    const sources = Array.from(sourceMap.entries()).map(([source_type, data]) => ({
      source_type,
      count: data.count,
      sampleUrls: data.urls
    }))

    // Sort by count descending
    sources.sort((a, b) => b.count - a.count)

    return NextResponse.json({
      total: urls?.length || 0,
      sources
    })
  } catch (error) {
    console.error('Error getting URL summary:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
