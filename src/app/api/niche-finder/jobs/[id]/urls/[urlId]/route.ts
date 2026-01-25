import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; urlId: string }> }

/**
 * GET /api/niche-finder/jobs/[id]/urls/[urlId]
 * Returns full details of a single URL including scraped content
 */
export async function GET(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: jobId, urlId } = await params

  try {
    // Fetch the URL with all its data
    const { data: url, error } = await supabase
      .from('niche_finder_urls')
      .select('*')
      .eq('job_id', jobId)
      .eq('id', urlId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'URL not found' }, { status: 404 })
      }
      console.error('[URL Detail API] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate word count if content exists
    const wordCount = url.content_markdown
      ? url.content_markdown.split(/\s+/).filter((w: string) => w.length > 0).length
      : 0

    // Get any extracted niches for this URL
    const { data: niches } = await supabase
      .from('niche_finder_extracted')
      .select('id, problem, persona, emotion, context, raw_data, created_at')
      .eq('url_id', urlId)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      url: {
        id: url.id,
        url: url.url,
        title: url.title,
        source_type: url.source_type,
        status: url.status,
        selected: url.selected,
        life_context: url.life_context,
        product_word: url.product_word,
        content_markdown: url.content_markdown,
        content_length: url.content_markdown?.length || 0,
        word_count: wordCount,
        error_message: url.error_message,
        scraped_at: url.scraped_at,
        created_at: url.created_at,
      },
      extracted_niches: niches || [],
    })
  } catch (error) {
    console.error('[URL Detail API] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
