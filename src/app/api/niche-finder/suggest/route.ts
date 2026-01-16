import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Extended request type that supports both component format and direct params
interface SuggestRequest {
  // Component format (from NicheFinderPlaybook)
  type?: 'life_contexts' | 'product_words' | 'thematic_forums'
  existing?: string[]
  life_contexts?: string[]
  product_words?: string[]
  project_id?: string

  // Direct params format (legacy)
  industry?: string
  product_description?: string
  country?: string
  existing_life_contexts?: string[]
  existing_product_words?: string[]
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Get user session to look up their API key
  let openrouterApiKey: string | null = null
  try {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user?.id) {
      openrouterApiKey = await getUserApiKey({
        userId: session.user.id,
        serviceName: 'openrouter',
        supabase,
      })
    }
  } catch (e) {
    console.warn('Could not get user session for API key lookup:', e)
  }

  // Fallback to environment variable if no user key found
  if (!openrouterApiKey) {
    openrouterApiKey = process.env.OPENROUTER_API_KEY || null
  }

  console.log('Suggest API called, OpenRouter key exists:', !!openrouterApiKey)

  if (!openrouterApiKey) {
    console.error('OPENROUTER_API_KEY not configured')
    return NextResponse.json({ success: false, error: 'OpenRouter API key not configured. Please add your API key in Settings > APIs.' }, { status: 500 })
  }

  try {
    const body: SuggestRequest = await request.json()

    // Support both component format and direct params format
    const type = body.type // 'life_contexts' | 'product_words' | undefined

    // Get existing lists from either format
    let existingLifeContexts = body.existing_life_contexts || []
    let existingProductWords = body.existing_product_words || []

    // If using component format, populate from existing/life_contexts/product_words
    if (type === 'life_contexts') {
      existingLifeContexts = body.existing || []
      existingProductWords = body.product_words || []
    } else if (type === 'product_words') {
      existingProductWords = body.existing || []
      existingLifeContexts = body.life_contexts || []
    }

    // Get industry, product, country from body or from project settings
    let industry = body.industry || ''
    let productDescription = body.product_description || ''
    let country = body.country || 'España'

    // If project_id is provided, try to get settings from project
    if (body.project_id && supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { data: project } = await supabase
          .from('projects')
          .select('settings, name, description')
          .eq('id', body.project_id)
          .single()

        if (project?.settings) {
          industry = industry || project.settings.industry || ''
          productDescription = productDescription || project.settings.product || project.description || ''
          country = country || project.settings.country || 'España'
        }
      } catch (e) {
        console.warn('Could not fetch project settings:', e)
      }
    }

    const prompt = `You are an expert market researcher. Based on the following product/industry, suggest search parameters for finding customer pain points in forums.

INDUSTRY: ${industry || 'general'}
PRODUCT: ${productDescription || 'product/service'}
COUNTRY: ${country}
${existingLifeContexts.length > 0 ? `EXISTING LIFE CONTEXTS: ${existingLifeContexts.join(', ')}` : ''}
${existingProductWords.length > 0 ? `EXISTING PRODUCT WORDS: ${existingProductWords.join(', ')}` : ''}

Respond in JSON format with this structure:
{
  "life_contexts": [
    {"value": "context word/phrase", "category": "personal|family|work|events|relationships", "reason": "why this context is relevant"}
  ],
  "product_words": [
    {"value": "product-related word/phrase", "category": "category name", "reason": "why this word is relevant"}
  ],
  "sources": [
    {"source_type": "reddit|thematic_forum|general_forum", "value": "domain or subreddit name", "life_context": "related context if applicable", "reason": "why this source is relevant"}
  ]
}

IMPORTANT:
- Suggest 5-10 life contexts that represent situations where people might need ${productDescription || 'the product'}
- Suggest 5-10 product words that people would use when discussing problems ${productDescription || 'the product'} solves
- Suggest 5-8 forums/subreddits where these people discuss their problems
- Be specific to ${country} culture and language
- Don't repeat existing contexts/words
- Focus on finding frustrated users, not just any users

Respond ONLY with the JSON, no additional text.`

    console.log('Calling OpenRouter API...')
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    console.log('OpenRouter response status:', response.status)

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('OpenRouter error:', response.status, errorBody)
      throw new Error(`OpenRouter error: ${response.status} - ${errorBody.slice(0, 200)}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '{}'

    // Parse JSON from response
    interface ParsedSuggestions {
      life_contexts?: Array<{ value: string; category?: string; reason?: string }>
      product_words?: Array<{ value: string; category?: string; reason?: string }>
      sources?: Array<{ source_type: string; value: string; life_context?: string; reason?: string }>
    }

    let parsedSuggestions: ParsedSuggestions
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      parsedSuggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content)
    } catch (parseError) {
      console.error('Failed to parse LLM response:', content)
      return NextResponse.json(
        { success: false, error: 'Failed to parse suggestions from AI' },
        { status: 500 }
      )
    }

    // If type was specified (component format), return suggestions as simple array
    if (type === 'life_contexts') {
      const suggestions = (parsedSuggestions.life_contexts || [])
        .map(c => c.value)
        .filter(v => v && !existingLifeContexts.includes(v))
      return NextResponse.json({ success: true, suggestions })
    } else if (type === 'product_words') {
      const suggestions = (parsedSuggestions.product_words || [])
        .map(w => w.value)
        .filter(v => v && !existingProductWords.includes(v))
      return NextResponse.json({ success: true, suggestions })
    } else if (type === 'thematic_forums') {
      // Return thematic forums with their context mapping
      const existingForums = body.existing || []
      const forums = (parsedSuggestions.sources || [])
        .filter(s => s.source_type === 'thematic_forum' && s.value && !existingForums.includes(s.value))
        .map(s => ({
          domain: s.value,
          context: s.life_context || '',
          reason: s.reason || '',
        }))
      return NextResponse.json({ success: true, suggestions: forums })
    } else if (type === 'general_forums') {
      // Return general forums (high-traffic, active discussion sites)
      const existingForums = body.existing || []
      const forums = (parsedSuggestions.sources || [])
        .filter(s => s.source_type === 'general_forum' && s.value && !existingForums.includes(s.value))
        .map(s => s.value)
      return NextResponse.json({ success: true, suggestions: forums })
    }

    // Otherwise return full response (legacy format)
    return NextResponse.json({ success: true, ...parsedSuggestions })
  } catch (error) {
    console.error('Error getting suggestions:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
