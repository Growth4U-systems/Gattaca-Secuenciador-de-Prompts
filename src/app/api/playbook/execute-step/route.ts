import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@/lib/supabase-server-admin'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'
import { SIGNAL_OUTREACH_FLOW_STEPS } from '@/lib/templates/signal-based-outreach-playbook'
import { NICHE_FINDER_FLOW_STEPS } from '@/lib/templates/niche-finder-playbook'
import { VIDEO_VIRAL_IA_FLOW_STEPS } from '@/lib/templates/video-viral-ia-playbook'
import { getDefaultPromptForStep } from '@/components/playbook/utils/getDefaultPrompts'
import { APIFY_ACTORS } from '@/lib/scraperTemplates'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for scraping operations

// ============================================
// TYPES
// ============================================

interface LinkedInPost {
  postUrl: string
  text: string
  likesCount: number
  commentsCount: number
  repostsCount?: number
  postedAt: string
  postType?: string
  authorName: string
  authorProfileUrl?: string
}

interface EvaluatedPost {
  id: string
  url: string
  creatorName: string
  text: string
  likes: number
  comments: number
  date: string
  type: string
  topic?: string
  fitScore: number
  fitReason?: string
}

// Mapeo de step IDs de UI a template - Signal Outreach
const SIGNAL_OUTREACH_STEP_ID_MAP: Record<string, string> = {
  'map_topics': 'step-1-value-prop-topics',
  'find_creators': 'step-2-search-creators',
  'evaluate_creators': 'step-3-evaluate-creators',
  'select_creators': 'step-4-select-creators',
  'scrape_posts': 'step-5-scrape-posts',
  'evaluate_posts': 'step-6-evaluate-posts',
  'select_posts': 'step-7-select-posts',
  'scrape_engagers': 'step-8-scrape-engagers',
  'filter_icp': 'step-9-filter-icp',
  'lead_magnet_messages': 'step-10-lead-magnet-messages',
  'export_launch': 'step-11-export-launch',
}

// Mapeo de step IDs de UI a template - Niche Finder
const NICHE_FINDER_STEP_ID_MAP: Record<string, string> = {
  'sources': 'suggest_forums',
  'need_words': 'suggest_need_words',
  'life_contexts': 'suggest_life_contexts',
  'extract_problems': 'step-1-find-problems',
  'clean_filter': 'step-2-clean-filter',
  'deep_research_manual': 'step-3-scoring',
  'consolidate': 'step-4-consolidate',
}

// Mapeo de step IDs de UI a template - Video Viral IA
const VIDEO_VIRAL_IA_STEP_ID_MAP: Record<string, string> = {
  'generate_idea': 'step-1-1-generate-idea',
  'review_idea': 'step-1-2-review-idea',
  'generate_scenes': 'step-2-1-generate-scenes',
  'generate_clips': 'step-2-2-generate-clips',
  'generate_audio': 'step-3-1-generate-audio',
  'compose_video': 'step-3-2-compose-video',
  'preview': 'step-4-1-preview',
  'export': 'step-4-2-export',
}

// Orden de los pasos para saber cuál es el anterior - Signal Outreach
const SIGNAL_OUTREACH_STEP_ORDER = [
  'map_topics',
  'find_creators',
  'evaluate_creators',
  'select_creators',
  'scrape_posts',
  'evaluate_posts',
  'select_posts',
  'scrape_engagers',
  'filter_icp',
  'lead_magnet_messages',
  'export_launch',
]

// Orden de los pasos para Niche Finder
const NICHE_FINDER_STEP_ORDER = [
  'life_contexts',
  'need_words',
  'indicators',
  'sources',
  'serp_search',
  'review_urls',
  'scrape',
  'extract_problems',
  'review_extraction',
  'clean_filter',
  'deep_research_manual',
  'consolidate',
  'select_niches',
  'dashboard',
  'export',
]

// Orden de los pasos para Video Viral IA
const VIDEO_VIRAL_IA_STEP_ORDER = [
  'generate_idea',
  'review_idea',
  'generate_scenes',
  'generate_clips',
  'generate_audio',
  'compose_video',
  'preview',
  'export',
]

interface ExecuteStepRequest {
  projectId: string
  stepId: string
  playbookType: string
  variables?: Record<string, string>
  input?: Record<string, string> // Alias for variables (backward compatibility)
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

  // Get session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (!session || sessionError) {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  // Get OpenRouter API key (same pattern as niche-finder/suggest)
  let openrouterApiKey: string | null = null
  let keySource = 'none'

  // Helper to validate OpenRouter key format
  const isValidOpenRouterKey = (key: string | null): boolean => {
    return !!key && key.startsWith('sk-or-') && key.length > 20
  }

  // 1. Try user_api_keys table
  const userKey = await getUserApiKey({
    userId: session.user.id,
    serviceName: 'openrouter',
    supabase,
  })
  if (isValidOpenRouterKey(userKey)) {
    openrouterApiKey = userKey
    keySource = 'user_api_keys'
  }

  // 2. Try user_openrouter_tokens (OAuth)
  if (!openrouterApiKey) {
    const { data: tokenRecord } = await supabase
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

  // 3. Try agency key
  if (!openrouterApiKey) {
    const { data: membership } = await supabase
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

  console.log(`[execute-step] OpenRouter key source: ${keySource}, valid: ${!!openrouterApiKey}`)

  if (!openrouterApiKey) {
    return NextResponse.json({
      success: false,
      error: 'OpenRouter API key not configured. Please add your API key in Settings > APIs.'
    }, { status: 500 })
  }

  try {
    const body: ExecuteStepRequest = await request.json()
    const { projectId, stepId, playbookType, variables, input } = body
    // Support both 'variables' and 'input' field names for backward compatibility
    const vars = variables || input || {}

    if (!projectId || !stepId || !playbookType) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: projectId, stepId, playbookType'
      }, { status: 400 })
    }

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    // Get the template step based on playbook type
    let stepIdMap: Record<string, string>
    let stepOrder: string[]
    let flowSteps: typeof NICHE_FINDER_FLOW_STEPS

    if (playbookType === 'niche_finder') {
      stepIdMap = NICHE_FINDER_STEP_ID_MAP
      stepOrder = NICHE_FINDER_STEP_ORDER
      flowSteps = NICHE_FINDER_FLOW_STEPS
    } else if (playbookType === 'video_viral_ia') {
      stepIdMap = VIDEO_VIRAL_IA_STEP_ID_MAP
      stepOrder = VIDEO_VIRAL_IA_STEP_ORDER
      flowSteps = VIDEO_VIRAL_IA_FLOW_STEPS
    } else {
      // Default to signal_based_outreach
      stepIdMap = SIGNAL_OUTREACH_STEP_ID_MAP
      stepOrder = SIGNAL_OUTREACH_STEP_ORDER
      flowSteps = SIGNAL_OUTREACH_FLOW_STEPS
    }

    // Initialize prompt variables
    let prompt = ''
    let model = 'google/gemini-2.0-flash-001'
    let maxTokens = 4096
    let temperature = 0.7

    const templateStepId = stepIdMap[stepId]

    if (playbookType === 'niche_finder') {
      // Niche Finder: Get prompt from getDefaultPrompts utility
      const promptKey = templateStepId || stepId
      prompt = getDefaultPromptForStep(stepId, promptKey)

      if (!prompt) {
        return NextResponse.json({
          success: false,
          error: `No prompt found for step: ${stepId} (promptKey: ${promptKey})`
        }, { status: 400 })
      }

      // Find step config in flow steps if available
      const flowStep = flowSteps.find(s => s.id === templateStepId)
      if (flowStep) {
        model = flowStep.model || model
        maxTokens = flowStep.max_tokens || maxTokens
        temperature = flowStep.temperature || temperature
      }
    } else {
      // Signal Outreach & Video Viral IA: Get prompt from flow steps
      if (!templateStepId) {
        return NextResponse.json({
          success: false,
          error: `Unknown step ID: ${stepId} for playbook type: ${playbookType}`
        }, { status: 400 })
      }

      const templateStep = flowSteps.find(s => s.id === templateStepId)
      if (!templateStep) {
        return NextResponse.json({
          success: false,
          error: `Template step not found: ${templateStepId}`
        }, { status: 500 })
      }

      prompt = templateStep.prompt
      model = templateStep.model || model
      maxTokens = templateStep.max_tokens || maxTokens
      temperature = templateStep.temperature || temperature
    }

    // Get outputs from previous steps
    const adminClient = createAdminClient()
    const { data: previousOutputs } = await adminClient
      .from('playbook_step_outputs')
      .select('step_id, output_content, imported_data')
      .eq('project_id', projectId)
      .eq('playbook_type', playbookType)
      .eq('status', 'completed')

    // Build previous_step_output from the immediately previous step
    // If previous step is a decision step (no output), look back further
    const currentStepIndex = stepOrder.indexOf(stepId)
    let previousStepOutput = ''

    // Decision steps don't produce new output, so we need to look back further
    const DECISION_STEPS = ['review_idea', 'select_creators', 'select_posts', 'review_urls', 'review_extraction', 'select_niches']

    if (currentStepIndex > 0) {
      // Find the most recent step with actual output (skip decision steps)
      for (let i = currentStepIndex - 1; i >= 0; i--) {
        const candidateStepId = stepOrder[i]
        const candidateStep = previousOutputs?.find(o => o.step_id === candidateStepId)

        // Skip if no output found
        if (!candidateStep) continue

        // Skip decision steps that have no meaningful output
        if (DECISION_STEPS.includes(candidateStepId) && !candidateStep.output_content) {
          continue
        }

        // Found a step with output
        if (candidateStep.imported_data) {
          const importedData = candidateStep.imported_data as unknown[]
          if (Array.isArray(importedData)) {
            previousStepOutput = `## Datos Importados (${importedData.length} registros)\n\n`
            previousStepOutput += '```json\n' + JSON.stringify(importedData.slice(0, 50), null, 2) + '\n```\n'
            if (importedData.length > 50) {
              previousStepOutput += `\n*... y ${importedData.length - 50} registros más*\n`
            }
          } else {
            // imported_data is an object, not array
            previousStepOutput = '```json\n' + JSON.stringify(candidateStep.imported_data, null, 2) + '\n```\n'
          }
        }
        if (candidateStep.output_content) {
          previousStepOutput += '\n\n' + candidateStep.output_content
        }

        console.log(`[execute-step] Using output from step "${candidateStepId}" for step "${stepId}"`)
        break
      }
    }

    // Try to parse JSON from previous step output to extract individual fields
    let parsedPreviousOutput: Record<string, unknown> = {}
    if (previousStepOutput) {
      try {
        // Try to extract JSON from markdown code block
        const jsonMatch = previousStepOutput.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch) {
          parsedPreviousOutput = JSON.parse(jsonMatch[1].trim())
          console.log('[execute-step] Parsed JSON from previous step:', Object.keys(parsedPreviousOutput))
        } else {
          // Try to parse as raw JSON
          const rawJsonMatch = previousStepOutput.match(/\{[\s\S]*\}/)
          if (rawJsonMatch) {
            parsedPreviousOutput = JSON.parse(rawJsonMatch[0])
            console.log('[execute-step] Parsed raw JSON from previous step:', Object.keys(parsedPreviousOutput))
          }
        }
      } catch (e) {
        console.log('[execute-step] Could not parse JSON from previous step output')
      }
    }

    // Replace variables in prompt
    const allVariables = {
      ...vars,
      previous_step_output: previousStepOutput || vars?.previous_step_output || '(No hay output del paso anterior)',
    }

    // First, replace nested variables like {{previous_step_output.idea}}
    for (const [key, value] of Object.entries(parsedPreviousOutput)) {
      const nestedPattern = new RegExp(`\\{\\{previous_step_output\\.${key}\\}\\}`, 'g')
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
      prompt = prompt.replace(nestedPattern, stringValue || '')
    }

    // Then replace regular variables
    for (const [key, value] of Object.entries(allVariables)) {
      prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '')
    }

    // Mark step as running
    await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: stepId,
        status: 'running',
        variables_used: vars,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id'
      })

    // ============================================
    // SPECIAL HANDLING: scrape_posts
    // Uses Apify to scrape posts, then LLM evaluates
    // ============================================
    if (stepId === 'scrape_posts') {
      const result = await handleScrapePostsStep(
        adminClient,
        projectId,
        playbookType,
        stepId,
        vars,
        session.user.id,
        supabase,
        openrouterApiKey
      )
      return result
    }

    // ============================================
    // SPECIAL HANDLING: Video Viral IA steps
    // ============================================
    if (playbookType === 'video_viral_ia') {
      // generate_clips: Call Wavespeed API
      if (stepId === 'generate_clips') {
        return await handleGenerateClipsStep(
          adminClient,
          projectId,
          playbookType,
          stepId,
          vars,
          previousStepOutput,
          session.user.id,
          supabase
        )
      }

      // generate_audio: Call Fal AI MMAudio
      if (stepId === 'generate_audio') {
        return await handleGenerateAudioStep(
          adminClient,
          projectId,
          playbookType,
          stepId,
          vars,
          previousStepOutput,
          session.user.id,
          supabase
        )
      }

      // compose_video: Call Fal AI FFmpeg
      if (stepId === 'compose_video') {
        return await handleComposeVideoStep(
          adminClient,
          projectId,
          playbookType,
          stepId,
          vars,
          previousStepOutput,
          session.user.id,
          supabase
        )
      }
    }

    // Execute LLM call
    const llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
    })

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text()
      throw new Error(`OpenRouter API error: ${llmResponse.status} - ${errorText}`)
    }

    const llmData = await llmResponse.json()
    const output = llmData.choices?.[0]?.message?.content || ''

    if (!output) {
      throw new Error('LLM returned empty response')
    }

    // Save output to database
    await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: stepId,
        output_content: output,
        status: 'completed',
        variables_used: vars,
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id'
      })

    return NextResponse.json({
      success: true,
      output,
      stepId,
      model,
    })

  } catch (error) {
    console.error('[playbook/execute-step] Error:', error)

    // Try to mark step as error
    try {
      const body = await request.clone().json()
      const adminClient = createAdminClient()
      await adminClient
        .from('playbook_step_outputs')
        .upsert({
          project_id: body.projectId,
          playbook_type: body.playbookType,
          step_id: body.stepId,
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'project_id,playbook_type,step_id'
        })
    } catch {
      // Ignore errors when trying to save error state
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ============================================
// SCRAPE POSTS STEP HANDLER
// ============================================

async function handleScrapePostsStep(
  adminClient: ReturnType<typeof createAdminClient>,
  projectId: string,
  playbookType: string,
  stepId: string,
  variables: Record<string, string>,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  openrouterApiKey: string
): Promise<NextResponse> {
  try {
    // 1. Parse creator URLs from known_creators variable
    const creatorUrls = parseCreatorUrls(variables.known_creators || '')

    if (creatorUrls.length === 0) {
      throw new Error('No se encontraron URLs de creadores. Usa "Sugerir Creadores" o ingresa URLs manualmente.')
    }

    console.log(`[scrape_posts] Scraping posts from ${creatorUrls.length} creators`)

    // 2. Get Apify API key
    const apifyToken = await getUserApiKey({
      userId,
      serviceName: 'apify',
      supabase,
    }) || process.env.APIFY_TOKEN

    if (!apifyToken) {
      throw new Error('Apify API key not configured. Please add your API key in Settings > APIs.')
    }

    // 3. Scrape posts from each creator using Apify
    const allPosts: LinkedInPost[] = []

    for (const creatorUrl of creatorUrls) {
      console.log(`[scrape_posts] Scraping: ${creatorUrl}`)

      try {
        const posts = await scrapeLinkedInPersonPosts(apifyToken, creatorUrl)
        allPosts.push(...posts)
        console.log(`[scrape_posts] Got ${posts.length} posts from ${creatorUrl}`)
      } catch (error) {
        console.error(`[scrape_posts] Error scraping ${creatorUrl}:`, error)
        // Continue with other creators
      }
    }

    if (allPosts.length === 0) {
      throw new Error('No se pudieron scrapear posts de los creadores. Verifica las URLs.')
    }

    console.log(`[scrape_posts] Total posts scraped: ${allPosts.length}`)

    // 4. Have LLM evaluate each post for ICP fit
    const evaluatedPosts = await evaluatePostsWithLLM(
      openrouterApiKey,
      allPosts,
      variables.icp_description || '',
      variables.value_proposition || ''
    )

    // 5. Format output with markdown + JSON for UI
    const output = formatPostsOutput(evaluatedPosts, creatorUrls.length)

    // 6. Save output to database
    await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: stepId,
        output_content: output,
        imported_data: evaluatedPosts, // Store structured data for UI
        status: 'completed',
        variables_used: variables,
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id'
      })

    return NextResponse.json({
      success: true,
      output,
      stepId,
      postsCount: evaluatedPosts.length,
      creatorsCount: creatorUrls.length,
    })

  } catch (error) {
    console.error('[scrape_posts] Error:', error)

    await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: stepId,
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id'
      })

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse creator URLs from multiline string
 */
function parseCreatorUrls(input: string): string[] {
  if (!input) return []

  return input
    .split(/[\n,]/)
    .map(url => url.trim())
    .filter(url => url.includes('linkedin.com/in/'))
    .map(url => {
      // Normalize URL
      let normalized = url.split('?')[0].replace(/\/$/, '')
      if (!normalized.startsWith('http')) {
        normalized = 'https://' + normalized
      }
      return normalized.replace('://www.', '://')
    })
}

/**
 * Scrape posts from a LinkedIn person using Apify
 * Uses synchronous run with wait for results
 */
async function scrapeLinkedInPersonPosts(
  apifyToken: string,
  profileUrl: string,
  maxPosts: number = 30
): Promise<LinkedInPost[]> {
  // Start the actor run
  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTORS.LINKEDIN_PERSON_POSTS}/runs?token=${apifyToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileUrls: [profileUrl],
        maxPosts,
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL'],
        },
      }),
    }
  )

  if (!runResponse.ok) {
    const errorText = await runResponse.text()
    throw new Error(`Apify run failed: ${runResponse.status} - ${errorText}`)
  }

  const runData = await runResponse.json()
  const runId = runData.data?.id

  if (!runId) {
    throw new Error('Apify did not return a run ID')
  }

  // Poll for completion (max 3 minutes)
  const maxWaitMs = 180000
  const pollIntervalMs = 5000
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
    )

    if (!statusResponse.ok) {
      throw new Error(`Failed to check run status: ${statusResponse.status}`)
    }

    const statusData = await statusResponse.json()
    const status = statusData.data?.status

    if (status === 'SUCCEEDED') {
      // Get results from dataset
      const datasetId = statusData.data?.defaultDatasetId
      const resultsResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`
      )

      if (!resultsResponse.ok) {
        throw new Error(`Failed to fetch results: ${resultsResponse.status}`)
      }

      const results = await resultsResponse.json()
      return results.map((item: Record<string, unknown>) => ({
        postUrl: item.postUrl || item.url || '',
        text: item.text || item.content || '',
        likesCount: Number(item.likesCount || item.likes || 0),
        commentsCount: Number(item.commentsCount || item.comments || 0),
        repostsCount: Number(item.repostsCount || item.reposts || 0),
        postedAt: item.postedAt || item.date || '',
        postType: item.postType || item.type || 'text',
        authorName: item.authorName || item.author || '',
        authorProfileUrl: item.authorProfileUrl || profileUrl,
      }))
    }

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify run ${status}: ${statusData.data?.statusMessage || 'Unknown error'}`)
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
  }

  throw new Error('Apify run timed out after 3 minutes')
}

/**
 * Have LLM evaluate posts for ICP fit
 */
async function evaluatePostsWithLLM(
  openrouterApiKey: string,
  posts: LinkedInPost[],
  icpDescription: string,
  valueProposition: string
): Promise<EvaluatedPost[]> {
  // If no ICP description, just return posts without evaluation
  if (!icpDescription) {
    return posts.map((post, index) => ({
      id: `post_${index + 1}`,
      url: post.postUrl,
      creatorName: post.authorName,
      text: post.text.slice(0, 300),
      likes: post.likesCount,
      comments: post.commentsCount,
      date: post.postedAt,
      type: post.postType || 'text',
      fitScore: 3,
      fitReason: 'Sin ICP definido para evaluar',
    }))
  }

  // Prepare posts summary for LLM (limit to avoid token limits)
  const postsForEval = posts.slice(0, 50).map((post, index) => ({
    id: `post_${index + 1}`,
    url: post.postUrl,
    creator: post.authorName,
    text: post.text.slice(0, 200),
    likes: post.likesCount,
    comments: post.commentsCount,
    date: post.postedAt,
    type: post.postType,
  }))

  const prompt = `Eres un experto en análisis de contenido LinkedIn y segmentación B2B.

**ICP (Ideal Customer Profile):**
${icpDescription}

**Propuesta de valor:**
${valueProposition || 'No especificada'}

**Posts a evaluar:**
${JSON.stringify(postsForEval, null, 2)}

**Tu tarea:**
Para cada post, evalúa qué tan relevante es para atraer al ICP definido. Considera:
1. ¿El tema del post atrae a personas del ICP?
2. ¿El engagement (likes, comentarios) indica que el ICP interactúa?
3. ¿El contenido genera debate o discusión donde el ICP participa?

**Devuelve un JSON array con este formato exacto:**
\`\`\`json
[
  {
    "id": "post_1",
    "url": "URL del post",
    "creatorName": "Nombre del creador",
    "text": "Resumen del texto (max 150 chars)",
    "likes": 123,
    "comments": 45,
    "date": "fecha",
    "type": "text|carousel|video",
    "topic": "Tema detectado",
    "fitScore": 1-5,
    "fitReason": "Por qué este score (max 50 chars)"
  }
]
\`\`\`

**Scores:**
- 5: Muy alto fit - Post directamente sobre tema del ICP, alto engagement
- 4: Alto fit - Tema adyacente, buen engagement
- 3: Medio - Tema tangencial o engagement moderado
- 2: Bajo - Tema poco relevante
- 1: Muy bajo - No relevante para el ICP

Ordena los posts por fitScore descendente. Solo devuelve el JSON, sin texto adicional.`

  const llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
      temperature: 0.3,
    }),
  })

  if (!llmResponse.ok) {
    console.error('[evaluatePostsWithLLM] LLM error, returning unevaluated posts')
    return posts.map((post, index) => ({
      id: `post_${index + 1}`,
      url: post.postUrl,
      creatorName: post.authorName,
      text: post.text.slice(0, 300),
      likes: post.likesCount,
      comments: post.commentsCount,
      date: post.postedAt,
      type: post.postType || 'text',
      fitScore: 3,
    }))
  }

  const llmData = await llmResponse.json()
  const content = llmData.choices?.[0]?.message?.content || ''

  // Parse JSON from LLM response
  try {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    let jsonStr = jsonMatch ? jsonMatch[1].trim() : content
    if (!jsonMatch) {
      const arrayMatch = content.match(/\[[\s\S]*\]/)
      if (arrayMatch) jsonStr = arrayMatch[0]
    }

    const evaluated = JSON.parse(jsonStr)
    if (Array.isArray(evaluated)) {
      return evaluated as EvaluatedPost[]
    }
  } catch (error) {
    console.error('[evaluatePostsWithLLM] Failed to parse LLM response:', error)
  }

  // Fallback: return original posts without deep evaluation
  return posts.map((post, index) => ({
    id: `post_${index + 1}`,
    url: post.postUrl,
    creatorName: post.authorName,
    text: post.text.slice(0, 300),
    likes: post.likesCount,
    comments: post.commentsCount,
    date: post.postedAt,
    type: post.postType || 'text',
    fitScore: 3,
  }))
}

/**
 * Format posts output with markdown + JSON for UI parsing
 */
function formatPostsOutput(posts: EvaluatedPost[], creatorsCount: number): string {
  // Group posts by creator
  const byCreator = posts.reduce((acc, post) => {
    const creator = post.creatorName || 'Unknown'
    if (!acc[creator]) acc[creator] = []
    acc[creator].push(post)
    return acc
  }, {} as Record<string, EvaluatedPost[]>)

  // Calculate stats
  const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0)
  const totalComments = posts.reduce((sum, p) => sum + p.comments, 0)
  const avgEngagement = posts.length > 0 ? Math.round((totalLikes + totalComments) / posts.length) : 0

  let output = `## Posts Scrapeados

Se scrapearon **${posts.length} posts** de **${creatorsCount} creadores**.

### Métricas Generales
- Total likes: ${totalLikes.toLocaleString()}
- Total comentarios: ${totalComments.toLocaleString()}
- Engagement promedio: ${avgEngagement} interacciones/post

### Resumen por Creador
| Creador | Posts | Avg Likes | Top Post |
|---------|-------|-----------|----------|
`

  for (const [creator, creatorPosts] of Object.entries(byCreator)) {
    const avgLikes = Math.round(creatorPosts.reduce((sum, p) => sum + p.likes, 0) / creatorPosts.length)
    const topPost = creatorPosts.reduce((max, p) => p.likes > max.likes ? p : max, creatorPosts[0])
    output += `| ${creator} | ${creatorPosts.length} | ${avgLikes} | ${topPost.likes} likes |\n`
  }

  output += `
### Top 10 Posts por Engagement

| # | Creador | Likes | Comments | Fit | Tema |
|---|---------|-------|----------|-----|------|
`

  const sortedPosts = [...posts].sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))
  for (let i = 0; i < Math.min(10, sortedPosts.length); i++) {
    const p = sortedPosts[i]
    const stars = '⭐'.repeat(p.fitScore || 0)
    output += `| ${i + 1} | ${p.creatorName} | ${p.likes} | ${p.comments} | ${stars} | ${p.topic || '-'} |\n`
  }

  output += `

---

## DATOS PARA SELECCIÓN

Selecciona los posts que quieres usar para scrapear engagers. Los posts con mayor engagement y fitScore son los mejores candidatos.

\`\`\`json
${JSON.stringify({ posts }, null, 2)}
\`\`\`
`

  return output
}

// ============================================
// VIDEO VIRAL IA STEP HANDLERS
// ============================================

/**
 * Handle generate_clips step - calls Wavespeed API
 */
async function handleGenerateClipsStep(
  adminClient: ReturnType<typeof createAdminClient>,
  projectId: string,
  playbookType: string,
  stepId: string,
  variables: Record<string, string>,
  previousStepOutput: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<NextResponse> {
  try {
    console.log('[generate_clips] Starting video clip generation')

    // Parse scenes from previous step output (generate_scenes)
    const scenes = parseScenes(previousStepOutput)

    if (scenes.length === 0) {
      throw new Error('No se encontraron escenas en el paso anterior. Ejecuta "Generar Prompts de Escenas" primero.')
    }

    console.log(`[generate_clips] Found ${scenes.length} scenes to generate`)

    // Call the generate-clips API endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/playbook/video-viral/generate-clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sb-access-token=${await getAccessToken(supabase)}`,
      },
      body: JSON.stringify({
        projectId,
        scenes,
        aspect_ratio: variables.aspect_ratio || '9:16',
        duration: parseInt(variables.video_duration || '30') / scenes.length,
        resolution: '720p',
        generate_audio: false,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `Error generating clips: ${response.status}`)
    }

    // Format output
    const output = formatClipsOutput(data)

    // Save to database
    await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: stepId,
        output_content: output,
        imported_data: data,
        status: 'completed',
        variables_used: variables,
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id'
      })

    return NextResponse.json({
      success: true,
      output,
      stepId,
      clips: data.video_urls,
    })

  } catch (error) {
    console.error('[generate_clips] Error:', error)

    await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: stepId,
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id'
      })

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Handle generate_audio step - calls Fal AI MMAudio directly
 */
async function handleGenerateAudioStep(
  adminClient: ReturnType<typeof createAdminClient>,
  projectId: string,
  playbookType: string,
  stepId: string,
  variables: Record<string, string>,
  previousStepOutput: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<NextResponse> {
  try {
    console.log('[generate_audio] Starting audio generation')

    // Get video URL from previous step (generate_clips)
    const videoUrls = parseVideoUrls(previousStepOutput)
    const videoUrl = videoUrls.length > 0 ? videoUrls[0] : undefined

    // Get sound description from idea step
    const { data: ideaOutput } = await adminClient
      .from('playbook_step_outputs')
      .select('output_content, imported_data')
      .eq('project_id', projectId)
      .eq('playbook_type', playbookType)
      .eq('step_id', 'generate_idea')
      .single()

    // Parse sound from idea
    let soundPrompt = `${variables.content_style || 'ASMR'} soothing sound effects`
    if (ideaOutput?.imported_data) {
      const ideaData = ideaOutput.imported_data as { sound?: string }
      if (ideaData.sound) {
        soundPrompt = `${variables.content_style || 'ASMR'} ${ideaData.sound}`
      }
    } else if (ideaOutput?.output_content) {
      // Try to parse from JSON in output
      const soundMatch = ideaOutput.output_content.match(/"sound"\s*:\s*"([^"]+)"/)
      if (soundMatch) {
        soundPrompt = `${variables.content_style || 'ASMR'} ${soundMatch[1]}`
      }
    }

    console.log(`[generate_audio] Using prompt: ${soundPrompt}`)
    console.log(`[generate_audio] Video URL: ${videoUrl || 'none'}`)

    // Get Fal AI API key
    const falApiKey = await getUserApiKey({
      userId,
      serviceName: 'fal',
      supabase,
    }) || process.env.FAL_API_KEY

    if (!falApiKey) {
      throw new Error('API key de Fal AI no configurada. Ve a Settings > APIs para configurarla.')
    }

    // Call Fal AI directly
    const FAL_API_BASE = 'https://fal.run/fal-ai/mmaudio-v2'
    const endpoint = videoUrl ? FAL_API_BASE : `${FAL_API_BASE}/text-to-audio`
    const duration = parseInt(variables.video_duration || '30')

    const requestBody: Record<string, unknown> = {
      prompt: soundPrompt,
      num_steps: 25,
      duration: Math.min(duration, 30), // Max 30 seconds
      cfg_strength: 4.5,
      seed: 0,
    }

    if (videoUrl) {
      requestBody.video_url = videoUrl
    }

    console.log(`[generate_audio] Calling Fal AI: ${endpoint}`)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Fal AI error: ${response.status} - ${errorText}`)
    }

    const data = await response.json() as {
      video?: { url: string; file_name?: string; file_size?: number }
      audio?: { url: string; file_name?: string; file_size?: number }
    }

    console.log('[generate_audio] Fal AI response:', JSON.stringify(data, null, 2))

    // Extract URL from the nested structure
    // If we sent a video_url, we get video back with audio mixed in
    // If text-to-audio mode, we get just audio
    const audioUrl = videoUrl ? data.video?.url : data.audio?.url
    const mode = videoUrl ? 'video_with_audio' : 'audio_only'
    const fileName = videoUrl ? data.video?.file_name : data.audio?.file_name
    const fileSize = videoUrl ? data.video?.file_size : data.audio?.file_size

    if (!audioUrl) {
      throw new Error('Fal AI no generó audio. Respuesta: ' + JSON.stringify(data))
    }

    // Format output
    const output = `## Audio Generado

**Modo**: ${mode === 'video_with_audio' ? 'Video + Audio sincronizado' : 'Audio independiente'}
**Prompt usado**: ${soundPrompt}

### Resultado
🎵 **Audio URL**: [Descargar audio](${audioUrl})

${fileName ? `**Archivo**: ${fileName}` : ''}
${fileSize ? `**Tamaño**: ${Math.round(fileSize / 1024)} KB` : ''}

\`\`\`json
${JSON.stringify({ audio_url: audioUrl, mode, ...data }, null, 2)}
\`\`\`
`

    // Save to database
    await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: stepId,
        output_content: output,
        imported_data: { audio_url: audioUrl, mode, file_name: fileName, file_size: fileSize },
        status: 'completed',
        variables_used: variables,
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id'
      })

    return NextResponse.json({
      success: true,
      output,
      stepId,
      audio_url: audioUrl,
      mode,
    })

  } catch (error) {
    console.error('[generate_audio] Error:', error)

    await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: stepId,
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id'
      })

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Handle compose_video step - calls Fal AI FFmpeg
 */
async function handleComposeVideoStep(
  adminClient: ReturnType<typeof createAdminClient>,
  projectId: string,
  playbookType: string,
  stepId: string,
  variables: Record<string, string>,
  previousStepOutput: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<NextResponse> {
  try {
    console.log('[compose_video] Starting video composition')
    console.log('[compose_video] Looking for clips with:', { projectId, playbookType, stepId: 'generate_clips' })

    // Get video clips from generate_clips step
    const { data: clipsOutput, error: clipsError } = await adminClient
      .from('playbook_step_outputs')
      .select('output_content, imported_data')
      .eq('project_id', projectId)
      .eq('playbook_type', playbookType)
      .eq('step_id', 'generate_clips')
      .single()

    console.log('[compose_video] Clips query result:', {
      hasData: !!clipsOutput,
      error: clipsError?.message,
      importedData: clipsOutput?.imported_data ? JSON.stringify(clipsOutput.imported_data).substring(0, 200) : 'null'
    })

    const clipUrls = clipsOutput?.imported_data?.video_urls as string[] || parseVideoUrls(clipsOutput?.output_content || '')
    console.log('[compose_video] Parsed clipUrls:', clipUrls)

    // Get audio from generate_audio step
    const { data: audioOutput } = await adminClient
      .from('playbook_step_outputs')
      .select('output_content, imported_data')
      .eq('project_id', projectId)
      .eq('playbook_type', playbookType)
      .eq('step_id', 'generate_audio')
      .single()

    const audioUrl = audioOutput?.imported_data?.audio_url as string || parseAudioUrl(audioOutput?.output_content || '')

    if (clipUrls.length === 0) {
      throw new Error('No se encontraron clips de video. Ejecuta "Generar Clips de Video" primero.')
    }

    console.log(`[compose_video] Found ${clipUrls.length} clips and audio: ${!!audioUrl}`)

    // Call the compose-video API endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/playbook/video-viral/compose-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sb-access-token=${await getAccessToken(supabase)}`,
      },
      body: JSON.stringify({
        projectId,
        video_urls: clipUrls,
        audio_url: audioUrl,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `Error composing video: ${response.status}`)
    }

    // Format output
    const finalVideoUrl = data.video_url
    const output = `## Video Final Compuesto

✅ **Video compuesto exitosamente**

### Detalles
- **Clips unidos**: ${clipUrls.length}
- **Audio incluido**: ${audioUrl ? 'Sí' : 'No'}

### Resultado Final
🎬 **Video URL**: [Ver/Descargar video](${finalVideoUrl})

${data.file_name ? `**Archivo**: ${data.file_name}` : ''}
${data.duration ? `**Duración**: ${data.duration} segundos` : ''}

---

El video está listo para revisión en el siguiente paso.

\`\`\`json
${JSON.stringify({ video_url: finalVideoUrl, clips_used: clipUrls.length, has_audio: !!audioUrl, ...data }, null, 2)}
\`\`\`
`

    // Save to database
    await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: stepId,
        output_content: output,
        imported_data: { video_url: finalVideoUrl, ...data },
        status: 'completed',
        variables_used: variables,
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id'
      })

    return NextResponse.json({
      success: true,
      output,
      stepId,
      video_url: finalVideoUrl,
    })

  } catch (error) {
    console.error('[compose_video] Error:', error)

    await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: stepId,
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id'
      })

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ============================================
// VIDEO VIRAL IA HELPER FUNCTIONS
// ============================================

/**
 * Parse scenes from LLM output (generate_scenes step)
 */
function parseScenes(output: string): string[] {
  const scenes: string[] = []

  // Try to parse JSON first
  try {
    const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1])
      // Extract scene_1, scene_2, scene_3, etc.
      for (let i = 1; i <= 10; i++) {
        const sceneKey = `scene_${i}`
        if (parsed[sceneKey]) {
          scenes.push(parsed[sceneKey])
        }
      }
    }
  } catch {
    // Fall through to regex parsing
  }

  // If no JSON scenes found, try to extract from markdown
  if (scenes.length === 0) {
    const sceneMatches = output.matchAll(/(?:scene[_\s]*\d+|escena[_\s]*\d+)[:\s]*([^\n]+(?:\n(?![#\-*])[^\n]+)*)/gi)
    for (const match of sceneMatches) {
      if (match[1]) {
        scenes.push(match[1].trim())
      }
    }
  }

  return scenes
}

/**
 * Parse video URLs from output
 */
function parseVideoUrls(output: string): string[] {
  const urls: string[] = []

  // Parse from JSON
  try {
    const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1])
      if (parsed.video_urls && Array.isArray(parsed.video_urls)) {
        return parsed.video_urls
      }
      if (parsed.clips && Array.isArray(parsed.clips)) {
        for (const clip of parsed.clips) {
          if (clip.video_url) urls.push(clip.video_url)
        }
      }
    }
  } catch {
    // Fall through to regex
  }

  // Extract URLs from text
  const urlMatches = output.matchAll(/https?:\/\/[^\s"'<>]+\.(?:mp4|webm|mov)/gi)
  for (const match of urlMatches) {
    urls.push(match[0])
  }

  return urls
}

/**
 * Parse audio URL from output
 */
function parseAudioUrl(output: string): string | undefined {
  // Parse from JSON
  try {
    const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1])
      if (parsed.audio_url) return parsed.audio_url
    }
  } catch {
    // Fall through to regex
  }

  // Extract URL from text
  const urlMatch = output.match(/https?:\/\/[^\s"'<>]+\.(?:mp3|wav|m4a|aac)/i)
  return urlMatch?.[0]
}

/**
 * Format clips output for display
 */
function formatClipsOutput(data: { success: boolean; message?: string; clips?: Array<{ scene_index: number; status: string; video_url?: string; error?: string }>; video_urls?: string[]; errors?: Array<{ scene: number; error: string }> }): string {
  let output = `## Clips de Video Generados

${data.message || `Se procesaron ${data.clips?.length || 0} escenas`}

### Resultados por Escena
`

  if (data.clips) {
    for (const clip of data.clips) {
      const status = clip.status === 'completed' ? '✅' : clip.status === 'timeout' ? '⏰' : '❌'
      output += `\n${status} **Escena ${clip.scene_index + 1}**: ${clip.status}`
      if (clip.video_url) {
        output += `\n   🎬 [Ver clip](${clip.video_url})`
      }
      if (clip.error) {
        output += `\n   ⚠️ Error: ${clip.error}`
      }
    }
  }

  if (data.video_urls && data.video_urls.length > 0) {
    output += `\n\n### URLs de Videos Generados
`
    data.video_urls.forEach((url, i) => {
      output += `- Clip ${i + 1}: [${url}](${url})\n`
    })
  }

  output += `\n\n\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`

  return output
}

/**
 * Get access token from supabase client for internal API calls
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAccessToken(supabase: any): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  } catch {
    return ''
  }
}
