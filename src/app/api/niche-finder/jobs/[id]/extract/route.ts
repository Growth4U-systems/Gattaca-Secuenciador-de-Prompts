import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseNicheExtractionOutput, prepareExtractionPrompt } from '@/lib/scraper/extractor'
import { EXTRACTION_PROMPT } from '@/lib/templates/niche-finder-playbook'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const openrouterApiKey = process.env.OPENROUTER_API_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  if (!openrouterApiKey) {
    return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: jobId } = await params

  try {
    // Get job with project info
    const { data: job, error: jobError } = await supabase
      .from('niche_finder_jobs')
      .select('*, projects!inner(name, ecp_name, ecp_industry, ecp_target)')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (!['scrape_done', 'extracting'].includes(job.status)) {
      return NextResponse.json(
        { error: `Cannot extract for job in status: ${job.status}` },
        { status: 400 }
      )
    }

    // Update job status
    await supabase.from('niche_finder_jobs').update({ status: 'extracting' }).eq('id', jobId)

    const batchSize = job.config?.batch_size || 10
    const model = job.config?.extraction_model || 'openai/gpt-4o-mini'
    const extractionPrompt = job.config?.extraction_prompt || EXTRACTION_PROMPT

    // Get project variables
    const project = job.projects
    const variables = {
      product: project?.ecp_name || project?.name || 'nuestro producto',
      target: project?.ecp_target || 'usuarios potenciales',
      industry: project?.ecp_industry || 'tecnología',
      company_name: project?.ecp_name || project?.name || 'nuestra empresa',
    }

    // Get scraped URLs pending extraction
    const { data: scrapedUrls, error: urlsError } = await supabase
      .from('niche_finder_urls')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'scraped')
      .not('content_markdown', 'is', null)
      .limit(batchSize)

    if (urlsError) {
      throw new Error(`Failed to fetch URLs: ${urlsError.message}`)
    }

    if (!scrapedUrls || scrapedUrls.length === 0) {
      // No more URLs to extract, complete job
      await supabase
        .from('niche_finder_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      return NextResponse.json({
        success: true,
        extracted: 0,
        filtered: 0,
        remaining: 0,
        message: 'Extraction complete',
      })
    }

    let extractedCount = 0
    let filteredCount = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let processedCount = 0
    const lastExtractedProblems: string[] = []

    // Get total count for progress tracking
    const { count: totalScrapedCount } = await supabase
      .from('niche_finder_urls')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('status', 'scraped')

    const totalToExtract = (totalScrapedCount || 0) + scrapedUrls.length

    // Update initial progress
    await supabase
      .from('niche_finder_jobs')
      .update({
        extract_total: totalToExtract,
        extract_completed: 0,
      })
      .eq('id', jobId)

    // Process URLs sequentially to avoid rate limits
    for (const urlRecord of scrapedUrls) {
      try {
        const content = urlRecord.content_markdown || ''

        // Prepare prompt with content
        const prompt = prepareExtractionPrompt(extractionPrompt, {
          ...variables,
          content: content.slice(0, 15000), // Limit content length
        })

        // Call LLM
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000,
            temperature: 0.3,
          }),
        })

        if (!response.ok) {
          throw new Error(`OpenRouter error: ${response.status}`)
        }

        const data = await response.json()
        const output = data.choices?.[0]?.message?.content || ''

        // Track token usage
        totalInputTokens += data.usage?.prompt_tokens || 0
        totalOutputTokens += data.usage?.completion_tokens || 0

        // Parse output
        const { niches, filtered, reason } = parseNicheExtractionOutput(
          output,
          jobId,
          urlRecord.id,
          urlRecord.url
        )

        if (filtered) {
          // URL was filtered (not relevant)
          await supabase
            .from('niche_finder_urls')
            .update({
              status: 'filtered',
              filtered_reason: reason,
            })
            .eq('id', urlRecord.id)

          filteredCount++
        } else if (niches.length > 0) {
          // Insert extracted niches
          await supabase.from('niche_finder_extracted').insert(niches)

          // Update URL status
          await supabase
            .from('niche_finder_urls')
            .update({ status: 'extracted' })
            .eq('id', urlRecord.id)

          extractedCount += niches.length

          // Track last extracted problems for UI feedback
          for (const niche of niches) {
            if (niche.problem) {
              lastExtractedProblems.push(niche.problem)
              // Keep only last 5
              if (lastExtractedProblems.length > 5) {
                lastExtractedProblems.shift()
              }
            }
          }
        } else {
          // No niches found but not explicitly filtered
          await supabase
            .from('niche_finder_urls')
            .update({
              status: 'filtered',
              filtered_reason: 'No niches found in content',
            })
            .eq('id', urlRecord.id)

          filteredCount++
        }

        processedCount++

        // Update progress in real-time for UI feedback
        await supabase
          .from('niche_finder_jobs')
          .update({
            extract_completed: processedCount + (job.extract_completed || 0),
            last_extracted_problems: lastExtractedProblems,
            niches_extracted: extractedCount + (job.niches_extracted || 0),
          })
          .eq('id', jobId)

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200))
      } catch (error) {
        console.error(`Error extracting from ${urlRecord.url}:`, error)

        await supabase
          .from('niche_finder_urls')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', urlRecord.id)
      }
    }

    // Calculate LLM cost (approximate)
    const inputCost = (totalInputTokens / 1_000_000) * 0.15 // GPT-4o-mini input
    const outputCost = (totalOutputTokens / 1_000_000) * 0.60 // GPT-4o-mini output
    const llmCost = inputCost + outputCost

    // Record cost
    if (llmCost > 0) {
      await supabase.from('niche_finder_costs').insert({
        job_id: jobId,
        cost_type: 'llm_extraction',
        service: 'openrouter',
        units: totalInputTokens + totalOutputTokens,
        cost_usd: llmCost,
        metadata: { model, input_tokens: totalInputTokens, output_tokens: totalOutputTokens },
      })
    }

    // Update job counters using RPC for atomic update
    await supabase.rpc('increment_niche_finder_counters', {
      p_job_id: jobId,
      p_urls_filtered: filteredCount,
      p_niches_extracted: extractedCount,
    })

    // Check if more URLs remain
    const { count: remainingCount } = await supabase
      .from('niche_finder_urls')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('status', 'scraped')

    const hasMore = (remainingCount || 0) > 0

    // Update job status if done
    if (!hasMore) {
      await supabase
        .from('niche_finder_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    }

    return NextResponse.json({
      success: true,
      extracted: extractedCount,
      filtered: filteredCount,
      remaining: remainingCount || 0,
      cost_usd: llmCost,
      has_more: hasMore,
    })
  } catch (error) {
    console.error('Error in extract route:', error)

    await supabase
      .from('niche_finder_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', jobId)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
