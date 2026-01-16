import { NextRequest, NextResponse } from 'next/server'
import type { SuggestSourcesRequest, SuggestSourcesResponse } from '@/types/scraper.types'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest
): Promise<NextResponse<SuggestSourcesResponse | { error: string }>> {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY

  if (!openrouterApiKey) {
    return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 })
  }

  try {
    const body: SuggestSourcesRequest = await request.json()
    const {
      industry,
      product_description,
      country,
      existing_life_contexts = [],
      existing_product_words = [],
    } = body

    const prompt = `You are an expert market researcher. Based on the following product/industry, suggest search parameters for finding customer pain points in forums.

INDUSTRY: ${industry}
PRODUCT: ${product_description}
COUNTRY: ${country}
${existing_life_contexts.length > 0 ? `EXISTING LIFE CONTEXTS: ${existing_life_contexts.join(', ')}` : ''}
${existing_product_words.length > 0 ? `EXISTING PRODUCT WORDS: ${existing_product_words.join(', ')}` : ''}

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
- Suggest 5-10 life contexts that represent situations where people might need ${product_description}
- Suggest 5-10 product words that people would use when discussing problems ${product_description} solves
- Suggest 5-8 forums/subreddits where these people discuss their problems
- Be specific to ${country} culture and language
- Don't repeat existing contexts/words
- Focus on finding frustrated users, not just any users

Respond ONLY with the JSON, no additional text.`

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

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '{}'

    // Parse JSON from response
    let suggestions: SuggestSourcesResponse
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content)
    } catch (parseError) {
      console.error('Failed to parse LLM response:', content)
      return NextResponse.json(
        { error: 'Failed to parse suggestions from AI' },
        { status: 500 }
      )
    }

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('Error getting suggestions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
