/**
 * Generate LinkedIn Post API
 *
 * Converted from n8n nodes:
 * - "Summarize 3 Articles + Generate LinkedIn Post + Image Prompt" (LangChain Agent)
 * - "Extract Post Text and Image Prompt" (Set node)
 *
 * Uses GPT-4o to summarize articles and generate a LinkedIn post with image prompt
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { decryptToken } from '@/lib/encryption'

function isValidOpenRouterKey(key: string | null): key is string {
  return !!key && key.length > 10 && key !== 'PENDING'
}

const SYSTEM_PROMPT = `You are a professional AI content assistant. Based on the articles I will provide, generate a LinkedIn post and also create an image prompt that visually represents the message of the post.

Instructions:
1. Read all articles provided.
2. Combine key insights from them into a single LinkedIn post.
3. Write the post in a conversational, professional tone — no robotic language.
4. The first line must grab attention and spark curiosity.
5. Avoid hashtags, emojis, and clickbait phrases.
6. Keep the post under 1,300 characters.
7. Use correct punctuation only. Do not use hyphens.
8. After writing the post, generate a short and clear image prompt that can be used to create a LinkedIn graphic.

Return your response in the following JSON format:
{
  "postText": "Write the full LinkedIn post here...",
  "imagePrompt": "A short visual prompt that summarizes the theme of the post"
}`

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { input, previousOutputs, sessionId, stepId } = body

    // Get articles from search_articles step output
    const searchStepOutput = previousOutputs?.search_articles as Record<string, unknown> | undefined
    const articles = searchStepOutput?.articles || input?.articles

    // Get topic from input step (define_topic)
    const inputStepOutput = previousOutputs?.define_topic as Record<string, unknown> | undefined
    const topic = inputStepOutput?.topic || searchStepOutput?.topic || input?.topic
    const tone = inputStepOutput?.tone || input?.tone || 'Conversational'
    const targetAudience = inputStepOutput?.targetAudience || input?.targetAudience || ''

    if (!articles || articles.length === 0) {
      return NextResponse.json(
        { error: 'No articles provided. Run the search step first.' },
        { status: 400 }
      )
    }

    // Build the user prompt with article content
    const articleTexts = articles.map((article: any, i: number) =>
      `Article ${i + 1}: ${article.title}\n${article.content?.substring(0, 3000) || article.snippet}`
    ).join('\n\n---\n\n')

    const userPrompt = `Topic: ${topic}
Tone: ${tone}
${targetAudience ? `Target Audience: ${targetAudience}` : ''}

Here are the articles to summarize:

${articleTexts}

Generate a LinkedIn post and image prompt based on these articles.`

    // Get OpenRouter API key (OAuth flow)
    let openrouterApiKey: string | null = null

    // 1. Try user_openrouter_tokens (OAuth)
    const { data: tokenRecord } = await supabase
      .from('user_openrouter_tokens')
      .select('encrypted_api_key')
      .eq('user_id', user.id)
      .single()

    if (tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
      try {
        const oauthKey = decryptToken(tokenRecord.encrypted_api_key)
        if (isValidOpenRouterKey(oauthKey)) {
          openrouterApiKey = oauthKey
        }
      } catch {
        // Ignore decryption errors
      }
    }

    // 2. Try agency key
    if (!openrouterApiKey) {
      const { data: membership } = await supabase
        .from('agency_members')
        .select('agency_id, agencies(id, openrouter_api_key)')
        .eq('user_id', user.id)
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
          }
        } catch {
          // Ignore decryption errors
        }
      }
    }

    // 3. Fallback to env
    if (!openrouterApiKey) {
      const envKey = process.env.OPENROUTER_API_KEY || null
      if (isValidOpenRouterKey(envKey)) {
        openrouterApiKey = envKey
      }
    }

    if (!openrouterApiKey) {
      return NextResponse.json(
        { error: 'OpenRouter not connected. Please connect OpenRouter from the header menu.' },
        { status: 400 }
      )
    }

    const apiKey = openrouterApiKey

    // Call AI API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Gattaca LinkedIn Post Generator'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('AI API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to generate post. Please check your API key.' },
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

    const resultData = {
      postText: parsedResponse.postText || '',
      imagePrompt: parsedResponse.imagePrompt || '',
      topic,
      tone,
      sources: articles.map((a: any) => ({ title: a.title, url: a.url })),
      characterCount: parsedResponse.postText?.length || 0
    }

    // Store result in session
    if (sessionId) {
      await supabase
        .from('playbook_sessions')
        .update({
          state: supabase.rpc('jsonb_set_nested', {
            target: 'state',
            path: `{steps,${stepId || 'generate_post'}}`,
            value: JSON.stringify({
              status: 'completed',
              output: resultData,
              completedAt: new Date().toISOString()
            })
          }),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
    }

    return NextResponse.json({
      success: true,
      data: resultData,
      metadata: {
        model: 'gpt-4o-mini',
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Post generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
