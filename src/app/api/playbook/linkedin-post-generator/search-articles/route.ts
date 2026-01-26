/**
 * Search and Scrape Articles API
 *
 * Converted from n8n node: "Scrape Articles via Dumpling AI Search"
 * Uses Dumpling AI to search Google and scrape top 3 articles
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'

const DUMPLING_API_URL = 'https://app.dumplingai.com/api/v1/search'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { input, previousOutputs, sessionId, stepId } = body

    // Get topic from previousOutputs (from define_topic input step) or direct input
    const inputStepOutput = previousOutputs?.define_topic as Record<string, string> | undefined
    const topic = inputStepOutput?.topic || input?.topic

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required. Please fill in the topic in the previous step.' },
        { status: 400 }
      )
    }

    // Get Dumpling AI API key (user's key or env fallback)
    const dumplingApiKey = await getUserApiKey({
      userId: user.id,
      serviceName: 'dumpling',
      supabase,
    })

    if (!dumplingApiKey) {
      return NextResponse.json(
        { error: 'Dumpling AI API key not configured. Please add it in settings.' },
        { status: 400 }
      )
    }

    // Call Dumpling AI Search API
    const response = await fetch(DUMPLING_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dumplingApiKey}`
      },
      body: JSON.stringify({
        query: topic,
        numResultsToScrape: 3,
        scrapeResults: true
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Dumpling AI error:', errorData)
      return NextResponse.json(
        { error: 'Failed to search articles. Please check your Dumpling AI API key.' },
        { status: 500 }
      )
    }

    const searchResults = await response.json()

    // Extract article data
    const articles = (searchResults.organic || []).slice(0, 3).map((result: any, index: number) => ({
      index: index + 1,
      title: result.title || `Article ${index + 1}`,
      url: result.link || result.url || '',
      snippet: result.snippet || '',
      content: result.scrapeOutput?.content || result.content || '',
      hasContent: !!(result.scrapeOutput?.content || result.content)
    }))

    const successfulArticles = articles.filter((a: any) => a.hasContent)

    if (successfulArticles.length === 0) {
      return NextResponse.json(
        { error: 'Could not scrape any articles. Try a different topic.' },
        { status: 400 }
      )
    }

    const resultData = {
      topic,
      articles: successfulArticles,
      totalFound: searchResults.organic?.length || 0,
      scraped: successfulArticles.length
    }

    // Store result in session if provided
    if (sessionId) {
      await supabase
        .from('playbook_sessions')
        .update({
          state: supabase.rpc('jsonb_set_nested', {
            target: 'state',
            path: `{steps,${stepId || 'search_articles'}}`,
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
        searchEngine: 'Dumpling AI',
        scrapedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Article search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
