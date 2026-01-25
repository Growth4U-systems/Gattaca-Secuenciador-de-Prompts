import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

interface ScrapedUrl {
  id: string
  url: string
  title: string | null
  content_markdown: string | null
  source_type: string | null
  status: string
}

/**
 * POST: Save scraped URLs to Context Lake
 *
 * This endpoint:
 * 1. Gets all successfully scraped URLs from a job
 * 2. For each URL, checks if content already exists (by hash)
 * 3. Creates documents in knowledge_base_docs if new
 * 4. Links them via niche_finder_saved_docs table
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
    // Get request body for optional configuration
    let body: { projectId?: string; clientId?: string; userId?: string; folderName?: string } = {}
    try {
      body = await request.json()
    } catch {
      // Body is optional
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('niche_finder_jobs')
      .select('*, session:playbook_sessions(*)')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Get project details
    const { data: project } = await supabase
      .from('projects')
      .select('id, name, client_id')
      .eq('id', job.project_id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const projectId = body.projectId || job.project_id
    const clientId = body.clientId || project.client_id
    const userId = body.userId || 'system'

    // Get scraped URLs with content
    const { data: scrapedUrls, error: urlsError } = await supabase
      .from('niche_finder_urls')
      .select('id, url, title, content_markdown, source_type, status')
      .eq('job_id', jobId)
      .eq('status', 'scraped')
      .not('content_markdown', 'is', null)

    if (urlsError) {
      console.error('Error fetching scraped URLs:', urlsError)
      return NextResponse.json({ error: urlsError.message }, { status: 500 })
    }

    if (!scrapedUrls || scrapedUrls.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No scraped URLs to save',
        saved: 0,
        skipped: 0,
        errors: 0,
      })
    }

    // Process each URL
    const results = {
      saved: 0,
      skipped: 0,
      errors: 0,
      errorMessages: [] as string[],
    }

    const dateStr = new Date().toISOString().split('T')[0]
    const folderName = body.folderName || `niche-finder/${dateStr}/${jobId.slice(0, 8)}`

    for (const url of scrapedUrls as ScrapedUrl[]) {
      try {
        if (!url.content_markdown) {
          results.skipped++
          continue
        }

        // Calculate content hash
        const contentHash = createHash('sha256').update(url.content_markdown).digest('hex')

        // Check if this content already exists
        const { data: existingDoc } = await supabase
          .from('niche_finder_saved_docs')
          .select('id, doc_id')
          .eq('content_hash', contentHash)
          .limit(1)
          .single()

        if (existingDoc) {
          // Link to existing document
          await supabase
            .from('niche_finder_saved_docs')
            .insert({
              job_id: jobId,
              url_id: url.id,
              doc_id: existingDoc.doc_id,
              url: url.url,
              title: url.title,
              source_type: url.source_type,
              content_hash: contentHash,
            })

          results.skipped++
          continue
        }

        // Create new document in knowledge_base_docs
        const filename = sanitizeFilename(url.title || url.url)
        const contentBytes = new TextEncoder().encode(url.content_markdown).length
        const tokenCountEstimate = Math.ceil(url.content_markdown.length / 4)

        const { data: newDoc, error: docError } = await supabase
          .from('knowledge_base_docs')
          .insert({
            project_id: projectId,
            client_id: clientId,
            filename: `${filename}.md`,
            category: 'research',
            extracted_content: url.content_markdown,
            file_size_bytes: contentBytes,
            mime_type: 'text/markdown',
            source_type: 'scraper',
            source_url: url.url,
            description: `Scraped from ${url.source_type || 'web'}: ${url.url}`,
            tags: [
              `source:${url.source_type || 'web'}`,
              `job:${jobId.slice(0, 8)}`,
              'niche-finder',
              'scraped',
            ],
            token_count: tokenCountEstimate,
            created_by: userId,
            updated_by: userId,
            source_metadata: {
              origin_type: 'scraper',
              job_id: jobId,
              session_id: job.session_id,
              url_id: url.id,
              source_type: url.source_type,
              scraped_at: new Date().toISOString(),
            },
          })
          .select()
          .single()

        if (docError) {
          console.error('Error creating document for URL:', url.url, docError)
          results.errors++
          results.errorMessages.push(`${url.url}: ${docError.message}`)
          continue
        }

        // Link URL to new document
        await supabase
          .from('niche_finder_saved_docs')
          .insert({
            job_id: jobId,
            url_id: url.id,
            doc_id: newDoc.id,
            url: url.url,
            title: url.title,
            source_type: url.source_type,
            content_hash: contentHash,
          })

        results.saved++

      } catch (urlError) {
        console.error('Error processing URL:', url.url, urlError)
        results.errors++
        results.errorMessages.push(`${url.url}: ${urlError instanceof Error ? urlError.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Saved ${results.saved} documents, skipped ${results.skipped} (duplicates), ${results.errors} errors`,
      ...results,
    })

  } catch (error) {
    console.error('Error in save-docs endpoint:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET: Check save status for a job
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
    // Get saved docs count
    const { count: savedCount } = await supabase
      .from('niche_finder_saved_docs')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', jobId)

    // Get scraped URLs count
    const { count: scrapedCount } = await supabase
      .from('niche_finder_urls')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('status', 'scraped')
      .not('content_markdown', 'is', null)

    // Get saved docs details
    const { data: savedDocs } = await supabase
      .from('niche_finder_saved_docs')
      .select('id, url, title, source_type, doc_id, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      totalScraped: scrapedCount || 0,
      totalSaved: savedCount || 0,
      recentDocs: savedDocs || [],
    })

  } catch (error) {
    console.error('Error getting save status:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function sanitizeFilename(input: string): string {
  // Remove or replace invalid filename characters
  return input
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 100) // Limit length
    .toLowerCase()
    .trim()
    || 'untitled'
}
