import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for scraping

interface ScrapeEngagersRequest {
  projectId: string
  playbookType: string
  postUrls: string[]
}

interface Engager {
  profileUrl: string
  fullName?: string
  headline?: string
  connectionDegree?: string
  reactionType?: string
  commentText?: string
  sourcePostUrl: string
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

  // Get Apify API key
  let apifyApiKey: string | null = null

  // 1. Try user_api_keys table
  apifyApiKey = await getUserApiKey({
    userId: session.user.id,
    serviceName: 'apify',
    supabase,
  })

  // 2. Try agency key
  if (!apifyApiKey) {
    const { data: membership } = await supabase
      .from('agency_members')
      .select('agency_id, agencies(id, apify_api_key)')
      .eq('user_id', session.user.id)
      .single()

    const agencyData = membership?.agencies as unknown as {
      id: string
      apify_api_key: string | null
    } | null

    if (agencyData?.apify_api_key) {
      try {
        apifyApiKey = decryptToken(agencyData.apify_api_key)
      } catch {
        // Ignore decryption errors
      }
    }
  }

  // 3. Fallback to env
  if (!apifyApiKey) {
    apifyApiKey = process.env.APIFY_API_TOKEN || null
  }

  if (!apifyApiKey) {
    return NextResponse.json({
      success: false,
      error: 'Apify API key not configured. Please add your API key in Settings > APIs.'
    }, { status: 500 })
  }

  try {
    const body: ScrapeEngagersRequest = await request.json()
    const { projectId, playbookType, postUrls } = body

    if (!projectId || !postUrls?.length) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: projectId, postUrls'
      }, { status: 400 })
    }

    console.log(`[scrape-engagers] Starting scrape for ${postUrls.length} posts`)

    // Admin client for database operations
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Mark step as running
    await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: 'scrape_engagers',
        status: 'running',
        variables_used: { postUrls },
        executed_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id',
      })

    // Scrape engagers using Apify
    const allEngagers: Engager[] = []

    // Use LinkedIn Post Likers scraper for each post
    // Actor: curious_coder/linkedin-post-likers
    const ACTOR_ID = 'curious_coder/linkedin-post-likers'

    for (const postUrl of postUrls) {
      try {
        console.log(`[scrape-engagers] Scraping engagers for: ${postUrl}`)

        // Start actor run
        const runResponse = await fetch(
          `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${apifyApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postUrls: [postUrl],
              maxResults: 100,
              cookie: process.env.LINKEDIN_COOKIE || '',
            }),
          }
        )

        if (!runResponse.ok) {
          console.error(`[scrape-engagers] Apify run failed for ${postUrl}:`, await runResponse.text())
          continue
        }

        const runData = await runResponse.json()
        const runId = runData.data?.id

        if (!runId) {
          console.error('[scrape-engagers] No run ID returned')
          continue
        }

        // Poll for completion (max 2 minutes per post)
        let attempts = 0
        const maxAttempts = 24 // 2 minutes at 5 second intervals
        let results: unknown[] = []

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000))
          attempts++

          const statusResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyApiKey}`
          )
          const statusData = await statusResponse.json()
          const status = statusData.data?.status

          if (status === 'SUCCEEDED') {
            // Get results
            const datasetResponse = await fetch(
              `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyApiKey}`
            )
            results = await datasetResponse.json()
            break
          } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
            console.error(`[scrape-engagers] Run ${runId} ended with status: ${status}`)
            break
          }
        }

        // Process results
        if (Array.isArray(results)) {
          for (const item of results) {
            const engager = item as Record<string, unknown>
            allEngagers.push({
              profileUrl: String(engager.profileUrl || engager.profile_url || engager.url || ''),
              fullName: engager.fullName ? String(engager.fullName) : engager.name ? String(engager.name) : undefined,
              headline: engager.headline ? String(engager.headline) : undefined,
              connectionDegree: engager.connectionDegree ? String(engager.connectionDegree) : undefined,
              reactionType: engager.reactionType ? String(engager.reactionType) : engager.reaction ? String(engager.reaction) : undefined,
              sourcePostUrl: postUrl,
            })
          }
        }

      } catch (postError) {
        console.error(`[scrape-engagers] Error scraping ${postUrl}:`, postError)
      }
    }

    console.log(`[scrape-engagers] Total engagers found: ${allEngagers.length}`)

    // Generate output markdown
    const output = generateEngagersOutput(allEngagers, postUrls.length)

    // Save results
    await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: 'scrape_engagers',
        status: 'completed',
        output_content: output,
        imported_data: allEngagers,
        variables_used: { postUrls },
        executed_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id',
      })

    return NextResponse.json({
      success: true,
      engagers: allEngagers,
      count: allEngagers.length,
      output,
    })

  } catch (error) {
    console.error('[scrape-engagers] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function generateEngagersOutput(engagers: Engager[], postCount: number): string {
  const uniqueProfiles = new Set(engagers.map(e => e.profileUrl)).size
  const byPost = new Map<string, number>()

  for (const e of engagers) {
    byPost.set(e.sourcePostUrl, (byPost.get(e.sourcePostUrl) || 0) + 1)
  }

  let output = `## Engagers Scrapeados

Se extrajeron **${engagers.length} interacciones** de ${postCount} posts.
- **${uniqueProfiles} perfiles unicos**

### Resumen por Post

| Post | Engagers |
|------|----------|
`

  for (const [url, count] of byPost.entries()) {
    const shortUrl = url.length > 50 ? url.substring(0, 50) + '...' : url
    output += `| [${shortUrl}](${url}) | ${count} |\n`
  }

  output += `
### Muestra de Perfiles

| Nombre | Headline | Perfil |
|--------|----------|--------|
`

  const sample = engagers.slice(0, 10)
  for (const e of sample) {
    const name = e.fullName || 'N/A'
    const headline = e.headline ? (e.headline.length > 40 ? e.headline.substring(0, 40) + '...' : e.headline) : 'N/A'
    output += `| ${name} | ${headline} | [Ver](${e.profileUrl}) |\n`
  }

  if (engagers.length > 10) {
    output += `\n*... y ${engagers.length - 10} mas*\n`
  }

  output += `
---

**Siguiente paso:** Filtrar estos perfiles por ICP para identificar leads calificados.
`

  return output
}
