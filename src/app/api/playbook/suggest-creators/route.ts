import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'
import { decryptToken } from '@/lib/encryption'
import { trackLLMUsage } from '@/lib/polar-usage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60 // 1 minute for API call

interface SuggestCreatorsRequest {
  projectId: string
  playbookType: string
  topics: string[]
  icp: string
  country: string
  industry?: string
}

interface SuggestedCreator {
  name: string
  linkedinUrl: string
  topics: string[]
  estimatedFollowers: string
  relevanceReason: string
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

  // Get OpenRouter API key (now uses Perplexity models via OpenRouter)
  let openrouterApiKey: string | null = null

  // 1. Try user_api_keys table
  openrouterApiKey = await getUserApiKey({
    userId: session.user.id,
    serviceName: 'openrouter',
    supabase,
  })

  // 2. Try OAuth token
  if (!openrouterApiKey) {
    const { data: tokenRecord } = await supabase
      .from('user_openrouter_tokens')
      .select('encrypted_api_key')
      .eq('user_id', session.user.id)
      .single()

    if (tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
      try {
        openrouterApiKey = decryptToken(tokenRecord.encrypted_api_key)
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
        openrouterApiKey = decryptToken(agencyData.openrouter_api_key)
      } catch {
        // Ignore decryption errors
      }
    }
  }

  // 4. Fallback to env
  if (!openrouterApiKey) {
    openrouterApiKey = process.env.OPENROUTER_API_KEY || null
  }

  if (!openrouterApiKey) {
    return NextResponse.json({
      success: false,
      error: 'OpenRouter API key not configured. Please add your API key in Settings > APIs.'
    }, { status: 500 })
  }

  try {
    const body: SuggestCreatorsRequest = await request.json()
    const { topics, icp, country, industry } = body

    if (!topics?.length || !icp || !country) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: topics, icp, country'
      }, { status: 400 })
    }

    // Build query for Perplexity
    const topicsText = topics.filter(Boolean).join(', ')
    const industryText = industry ? ` in the ${industry} industry` : ''

    const query = `Find 8-10 top LinkedIn influencers and content creators in ${country}${industryText} who create content about: ${topicsText}.

Target audience (ICP): ${icp}

For each creator, provide:
1. Full name
2. LinkedIn profile URL (must be a real linkedin.com/in/... URL)
3. Main topics they cover (2-3 topics)
4. Estimated follower count (e.g., "45K", "120K")
5. Why they're relevant for reaching this target audience

Return the results as a JSON array with this exact structure:
\`\`\`json
[
  {
    "name": "Full Name",
    "linkedinUrl": "https://linkedin.com/in/username",
    "topics": ["topic1", "topic2"],
    "estimatedFollowers": "45K",
    "relevanceReason": "Why this creator is relevant for the ICP"
  }
]
\`\`\`

Important:
- Only include real, verifiable LinkedIn creators
- Focus on creators with active posting history (at least weekly)
- Prioritize creators whose audience matches the ICP
- Ensure LinkedIn URLs are valid profile URLs`

    // Call OpenRouter with Perplexity Sonar model (has web search)
    const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://gattaca.growth4u.ai',
        'X-Title': 'Gattaca Creator Suggestions',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar', // Perplexity Sonar via OpenRouter
        messages: [
          {
            role: 'system',
            content: 'You are a LinkedIn influencer research expert. You help find content creators whose audience matches specific target profiles. Always return results as valid JSON.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    })

    if (!openrouterResponse.ok) {
      const errorText = await openrouterResponse.text()
      console.error('[suggest-creators] OpenRouter API error:', errorText)
      throw new Error(`OpenRouter API error: ${openrouterResponse.status}`)
    }

    const responseData = await openrouterResponse.json()
    const content = responseData.choices?.[0]?.message?.content || ''

    // Track LLM usage in Polar (async, don't block response)
    if (responseData.usage?.total_tokens) {
      trackLLMUsage(session.user.id, responseData.usage.total_tokens, 'perplexity/sonar').catch((err) => {
        console.warn('[suggest-creators] Failed to track LLM usage in Polar:', err)
      })
    }

    // Parse creators from response
    const creators = parseCreatorsFromResponse(content)

    return NextResponse.json({
      success: true,
      creators,
      query_used: query,
      raw_response: content,
    })

  } catch (error) {
    console.error('[suggest-creators] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Parse creators from Perplexity response
 * Handles both JSON code blocks and plain JSON
 */
function parseCreatorsFromResponse(content: string): SuggestedCreator[] {
  try {
    // Try to extract JSON from code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    let jsonStr = jsonMatch ? jsonMatch[1].trim() : content

    // If no code block, try to find JSON array directly
    if (!jsonMatch) {
      const arrayMatch = content.match(/\[[\s\S]*\]/)
      if (arrayMatch) {
        jsonStr = arrayMatch[0]
      }
    }

    const parsed = JSON.parse(jsonStr)

    // Validate and clean the data
    if (!Array.isArray(parsed)) {
      console.error('[suggest-creators] Parsed data is not an array')
      return []
    }

    return parsed
      .filter((item: unknown) => {
        if (typeof item !== 'object' || item === null) return false
        const creator = item as Record<string, unknown>
        return (
          typeof creator.name === 'string' &&
          typeof creator.linkedinUrl === 'string' &&
          creator.linkedinUrl.includes('linkedin.com/in/')
        )
      })
      .map((item: unknown) => {
        const creator = item as Record<string, unknown>
        return {
          name: String(creator.name),
          linkedinUrl: normalizeLinkedInUrl(String(creator.linkedinUrl)),
          topics: Array.isArray(creator.topics)
            ? creator.topics.map(String)
            : [String(creator.topics || '')],
          estimatedFollowers: String(creator.estimatedFollowers || 'Unknown'),
          relevanceReason: String(creator.relevanceReason || ''),
        }
      })

  } catch (error) {
    console.error('[suggest-creators] Failed to parse response:', error)
    console.error('[suggest-creators] Content:', content)
    return []
  }
}

/**
 * Normalize LinkedIn URL to consistent format
 */
function normalizeLinkedInUrl(url: string): string {
  // Remove trailing slashes and query params
  let normalized = url.split('?')[0].replace(/\/$/, '')

  // Ensure https://
  if (!normalized.startsWith('http')) {
    normalized = 'https://' + normalized
  }

  // Ensure www. is removed for consistency
  normalized = normalized.replace('://www.', '://')

  return normalized
}
