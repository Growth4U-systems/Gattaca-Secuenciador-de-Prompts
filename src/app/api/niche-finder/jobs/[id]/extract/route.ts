import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'
import { parseNicheExtractionOutput, prepareExtractionPrompt } from '@/lib/scraper/extractor'
import { EXTRACTION_PROMPT } from '@/lib/templates/niche-finder-playbook'
import { trackLLMUsage } from '@/lib/polar-usage'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  // Get authenticated user
  const serverClient = await createServerClient()
  const { data: { session } } = await serverClient.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Helper to validate OpenRouter key format
  const isValidOpenRouterKey = (key: string | null): boolean => {
    return !!key && key.startsWith('sk-or-') && key.length > 20
  }

  // Get OpenRouter API key with hierarchy:
  // 1. User personal key (user_api_keys)
  // 2. User OAuth token (user_openrouter_tokens)
  // 3. Agency key (agencies table)
  // 4. Environment variable
  let openrouterApiKey: string | null = null
  let keySource = 'none'

  // 1. Try user_api_keys table
  const userKey = await getUserApiKey({
    userId: session.user.id,
    serviceName: 'openrouter',
    supabase: serverClient,
  })
  if (isValidOpenRouterKey(userKey)) {
    openrouterApiKey = userKey
    keySource = 'user_api_keys'
  }

  // 2. Try user_openrouter_tokens (OAuth)
  if (!openrouterApiKey) {
    const { data: tokenRecord } = await serverClient
      .from('user_openrouter_tokens')
      .select('encrypted_api_key')
      .eq('user_id', session.user.id)
      .single()

    if (tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
      try {
        const oauthKey = decryptToken(tokenRecord.encrypted_api_key)
        if (isValidOpenRouterKey(oauthKey)) {
          openrouterApiKey = oauthKey
          keySource = 'user_openrouter_tokens'
        }
      } catch {
        // Ignore decryption errors
      }
    }
  }

  // 3. Try agency key (from agencies table via agency_members)
  if (!openrouterApiKey) {
    const { data: membership } = await serverClient
      .from('agency_members')
      .select('agency_id, agencies(id, openrouter_api_key)')
      .eq('user_id', session.user.id)
      .single()

    const agencyData = membership?.agencies as unknown as {
      id: string
      openrouter_api_key: string | null
    } | null

    if (agencyData?.openrouter_api_key) {
      try {
        const agencyKey = decryptToken(agencyData.openrouter_api_key)
        if (isValidOpenRouterKey(agencyKey)) {
          openrouterApiKey = agencyKey
          keySource = 'agency'
        }
      } catch {
        // Ignore decryption errors
      }
    }
  }

  // 4. Fallback to env
  if (!openrouterApiKey) {
    const envKey = process.env.OPENROUTER_API_KEY || null
    if (isValidOpenRouterKey(envKey)) {
      openrouterApiKey = envKey
      keySource = 'env'
    }
  }

  console.log(`[EXTRACT] OpenRouter key source: ${keySource}, valid: ${!!openrouterApiKey}`)

  if (!openrouterApiKey) {
    return NextResponse.json({
      error: 'OpenRouter API key not configured. Please add your API key in Settings > API Keys or configure it at the agency level.',
      code: 'MISSING_API_KEY',
      service: 'openrouter',
    }, { status: 400 })
  }

  // Create Supabase client with caching disabled to avoid stale data
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  })
  const { id: jobId } = await params

  try {
    // Get job with project info (using left join so it doesn't fail if project is missing)
    const { data: job, error: jobError } = await supabase
      .from('niche_finder_jobs')
      .select('*, projects(name)')
      .eq('id', jobId)
      .single()

    if (jobError) {
      console.error('[EXTRACT] Job query error:', jobError)
      return NextResponse.json({ error: 'Job not found', details: jobError.message }, { status: 404 })
    }

    if (!job) {
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

    const project = job.projects
    const jobConfig = job.config || {}

    // Try to get campaign variables - with improved fallback logic
    let campaignVars: Record<string, string> = {}
    let campaignSource = 'none'

    if (jobConfig.campaign_id) {
      // Best case: campaign_id in job config
      const { data: campaign, error: campaignError } = await supabase
        .from('ecp_campaigns')
        .select('custom_variables, ecp_name, industry')
        .eq('id', jobConfig.campaign_id)
        .single()

      if (campaign?.custom_variables) {
        campaignVars = campaign.custom_variables as Record<string, string>
        campaignSource = 'campaign_id'
      } else {
        console.warn(`[EXTRACT] Campaign ${jobConfig.campaign_id} found but no custom_variables`, campaignError)
      }
    }

    // Fallback: look up by project_id if no variables yet
    if (!campaignVars.product && !campaignVars.target) {
      console.log(`[EXTRACT] No campaign variables from config, trying project_id lookup...`)
      const { data: campaigns } = await supabase
        .from('ecp_campaigns')
        .select('id, ecp_name, custom_variables')
        .eq('project_id', job.project_id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (campaigns?.[0]?.custom_variables) {
        campaignVars = campaigns[0].custom_variables as Record<string, string>
        campaignSource = `project_fallback:${campaigns[0].id}`
        console.log(`[EXTRACT] Found campaign "${campaigns[0].ecp_name}" via project_id fallback`)
      }
    }

    console.log(`[EXTRACT] Campaign vars source: ${campaignSource}`, {
      hasProduct: !!campaignVars.product,
      hasTarget: !!campaignVars.target,
      hasIndustry: !!campaignVars.industry,
    })

    // Priority: job config > campaign custom_variables > project name > defaults
    // IMPORTANT: Check for actual values, not just truthy (empty string is falsy but exists)
    const variables = {
      product: jobConfig.ecp_product || campaignVars.product || project?.name || 'nuestro producto',
      target: jobConfig.ecp_target || campaignVars.target || 'usuarios potenciales',
      industry: jobConfig.ecp_industry || campaignVars.industry || 'tecnología',
      company_name: jobConfig.ecp_name || campaignVars.company_name || project?.name || 'nuestra empresa',
      category: jobConfig.ecp_category || campaignVars.category || '',
      country: jobConfig.ecp_country || campaignVars.country || '',
    }

    // Validate that we have real product/target (not defaults) to avoid filtering everything
    if (variables.product === 'nuestro producto' || variables.target === 'usuarios potenciales') {
      console.error(`[EXTRACT] CRITICAL: Using default variables! This will likely filter all URLs.`, {
        jobConfig_ecp_product: jobConfig.ecp_product,
        campaignVars_product: campaignVars.product,
        project_name: project?.name,
        final_product: variables.product,
      })
    }

    console.log(`[EXTRACT] Using variables:`, {
      product: variables.product?.slice(0, 80),
      target: variables.target?.slice(0, 80),
      industry: variables.industry
    })

    // Get scraped URLs pending extraction (all scraped URLs)
    const { data: scrapedUrls, error: urlsError } = await supabase
      .from('niche_finder_urls')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'scraped')
      .neq('selected', false)  // Respect user URL selection (default true)
      .not('content_markdown', 'is', null)
      .limit(batchSize)

    if (urlsError) {
      throw new Error(`Failed to fetch URLs: ${urlsError.message}`)
    }

    if (!scrapedUrls || scrapedUrls.length === 0) {
      // No more URLs to extract, mark extraction done (analysis steps follow)
      console.log(`[EXTRACT] Job ${jobId}: No more URLs to extract, marking as extract_done`)
      await supabase
        .from('niche_finder_jobs')
        .update({
          status: 'extract_done',
        })
        .eq('id', jobId)

      return NextResponse.json({
        success: true,
        extracted: 0,
        filtered: 0,
        remaining: 0,
        has_more: false,
        message: 'Extraction complete',
      })
    }

    console.log(`[EXTRACT] Job ${jobId}: Found ${scrapedUrls.length} URLs to extract in this batch`)

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
          const errorText = await response.text()
          console.error(`[EXTRACT] OpenRouter error ${response.status}:`, errorText)
          throw new Error(`OpenRouter error: ${response.status} - ${errorText.slice(0, 200)}`)
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

      // Track usage in Polar (async, don't block response)
      trackLLMUsage(session.user.id, totalInputTokens + totalOutputTokens, model).catch((err) => {
        console.warn('[EXTRACT] Failed to track LLM usage in Polar:', err)
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
      .neq('selected', false)  // Respect user URL selection

    const hasMore = (remainingCount || 0) > 0

    // Update job status if extraction done (analysis steps follow)
    if (!hasMore) {
      await supabase
        .from('niche_finder_jobs')
        .update({
          status: 'extract_done',
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
