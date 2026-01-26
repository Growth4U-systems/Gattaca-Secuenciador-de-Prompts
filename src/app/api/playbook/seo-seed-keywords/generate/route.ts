/**
 * SEO Seed Keywords Generator API
 *
 * Converted from n8n workflow: "Generate SEO Seed Keywords Using AI"
 * Original nodes: Set ICP → Aggregate → AI Agent (Anthropic) → Split Out
 *
 * Generates 15-20 SEO seed keywords based on the Ideal Customer Profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const SYSTEM_PROMPT = `You are an expert SEO strategist tasked with generating 15-20 key head search terms (seed keywords) for a B2B SaaS company. Your goal is to create a comprehensive list of keywords that will attract and engage the ideal customer profile (ICP) described.`

const USER_PROMPT_TEMPLATE = `Here are some important rules for you to follow:
<rules>
1. Analyze the ICP information carefully.
2. Generate 15-20 seed keywords that are relevant to the ICP's needs, challenges, goals, and search behavior.
3. Ensure the keywords are broad enough to be considered "head" terms, but specific enough to target the ICP effectively.
4. Consider various aspects of the ICP's journey, including awareness, consideration, and decision stages.
5. Include a mix of product-related, problem-related, and solution-related terms.
6. Think beyond just the product itself - consider industry trends, related technologies, and broader business concepts that would interest the ICP.
7. Avoid overly generic terms that might attract irrelevant traffic.
8. Aim for a mix of keyword difficulties, including both competitive and less competitive terms.
9. Include keywords that cover different search intents: informational, navigational, commercial, and transactional.
10. Consider related tools or platforms that the ICP might use, and include relevant integration-related keywords.
11. If applicable, include some location-specific keywords based on the ICP's geographic information.
12. Incorporate industry-specific terminology or jargon that the ICP would likely use in their searches.
13. Consider emerging trends or pain points in the ICP's industry that they might be searching for solutions to.
14. Format the keywords in lowercase, without punctuation. Trim any leading or trailing white space.
</rules>

Here is the Ideal Customer Profile (ICP) information:
<icp>
**Product/Service:** {{product}}

**Pain Points:** {{painPoints}}

**Goals:** {{goals}}

**Current Solutions:** {{currentSolutions}}

**Expertise Level:** {{expertiseLevel}}

**Industry:** {{industry}}
</icp>

Based on the provided ICP, generate an array of 15-20 seed keywords that will form the foundation of a comprehensive SEO strategy. These keywords should reflect a deep understanding of the ICP's needs, challenges, and search behavior, while also considering broader industry trends and related concepts.

First, provide your analysis in a "thoughts" section, then provide the keywords.

Respond in this exact JSON format:
{
  "thoughts": "Your analysis of the ICP and keyword strategy...",
  "keywords": ["keyword1", "keyword2", "keyword3", ...],
  "categories": {
    "product_related": ["keyword1", "keyword2"],
    "problem_related": ["keyword3", "keyword4"],
    "solution_related": ["keyword5", "keyword6"],
    "industry_trends": ["keyword7", "keyword8"],
    "search_intent": {
      "informational": ["keyword9"],
      "commercial": ["keyword10"],
      "transactional": ["keyword11"]
    }
  }
}`

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { input, sessionId, stepId } = body

    // Validate required fields
    if (!input?.product || !input?.painPoints || !input?.goals) {
      return NextResponse.json(
        { error: 'Missing required ICP fields: product, painPoints, goals' },
        { status: 400 }
      )
    }

    // Build the user prompt with ICP data
    const userPrompt = USER_PROMPT_TEMPLATE
      .replace('{{product}}', input.product || 'Not specified')
      .replace('{{painPoints}}', input.painPoints || 'Not specified')
      .replace('{{goals}}', input.goals || 'Not specified')
      .replace('{{currentSolutions}}', input.currentSolutions || 'Not specified')
      .replace('{{expertiseLevel}}', input.expertiseLevel || 'Not specified')
      .replace('{{industry}}', input.industry || 'Not specified')

    // Get user's API key for OpenRouter/Anthropic
    const { data: apiKeys } = await supabase
      .from('user_api_keys')
      .select('key_value, provider')
      .eq('user_id', user.id)
      .in('provider', ['openrouter', 'anthropic'])
      .single()

    // Use OpenRouter API (supports multiple models)
    const apiKey = apiKeys?.key_value || process.env.OPENROUTER_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API key configured. Please add your OpenRouter or Anthropic API key in settings.' },
        { status: 400 }
      )
    }

    // Call AI API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Gattaca SEO Keywords Generator'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('AI API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to generate keywords. Please check your API key and try again.' },
        { status: 500 }
      )
    }

    const aiResponse = await response.json()
    const content = aiResponse.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: 'Empty response from AI' },
        { status: 500 }
      )
    }

    // Parse the JSON response
    let parsedResponse
    try {
      parsedResponse = JSON.parse(content)
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0])
      } else {
        return NextResponse.json(
          { error: 'Failed to parse AI response' },
          { status: 500 }
        )
      }
    }

    // Store result in playbook session if sessionId provided
    if (sessionId) {
      await supabase
        .from('playbook_sessions')
        .update({
          state: {
            steps: {
              [stepId || 'generate_keywords']: {
                status: 'completed',
                output: parsedResponse,
                completedAt: new Date().toISOString()
              }
            }
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
    }

    return NextResponse.json({
      success: true,
      data: {
        keywords: parsedResponse.keywords || [],
        categories: parsedResponse.categories || {},
        analysis: parsedResponse.thoughts || '',
        totalKeywords: parsedResponse.keywords?.length || 0
      },
      metadata: {
        model: 'claude-sonnet-4-20250514',
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('SEO Keywords generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
