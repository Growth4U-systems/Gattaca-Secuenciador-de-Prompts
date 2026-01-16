import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// User agents to rotate
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
]

// Date range mapping for Bing News
const DATE_RANGE_MAP: Record<string, string> = {
  'past_day': 'interval="4"',      // Last 24 hours
  'past_week': 'interval="7"',     // Last 7 days
  'past_month': 'interval="8"',    // Last 30 days
  'past_year': 'interval="9"',     // Last year
  'anytime': '',                   // No filter
}

interface NewsArticle {
  title: string
  url: string
  source: string
  snippet: string
  publishedAt: string | null
  content: string | null
  imageUrl: string | null
  query: string
  country: string
}

interface ScrapeRequest {
  queries: string[]
  country: string        // es-ES, en-US, etc.
  maxPages: number       // pages per query
  maxArticles: number    // total max articles
  dateRange: string      // past_day, past_week, past_month, past_year, anytime
  extractContent: boolean // whether to extract full article content
}

// Get random user agent
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

// Parse HTML to extract text content (simple extraction)
function extractTextContent(html: string): string {
  // Remove scripts, styles, and other non-content elements
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Try to find main content areas
  const mainContentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
    /<div[^>]*class="[^"]*(?:content|article|post|entry|story)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ]

  let mainContent = ''
  for (const pattern of mainContentPatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      mainContent += match[1] + ' '
    }
  }

  // If no main content found, use the whole body
  if (!mainContent) {
    const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    mainContent = bodyMatch ? bodyMatch[1] : text
  }

  // Remove remaining HTML tags and clean up
  mainContent = mainContent
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  // Limit content length
  if (mainContent.length > 15000) {
    mainContent = mainContent.substring(0, 15000) + '...'
  }

  return mainContent
}

// Extract publication date from HTML meta tags
function extractPublishDate(html: string): string | null {
  const datePatterns = [
    /<meta[^>]*property="article:published_time"[^>]*content="([^"]+)"/i,
    /<meta[^>]*name="pubdate"[^>]*content="([^"]+)"/i,
    /<meta[^>]*name="publishdate"[^>]*content="([^"]+)"/i,
    /<meta[^>]*name="date"[^>]*content="([^"]+)"/i,
    /<time[^>]*datetime="([^"]+)"/i,
    /"datePublished":\s*"([^"]+)"/i,
    /"publishedTime":\s*"([^"]+)"/i,
  ]

  for (const pattern of datePatterns) {
    const match = html.match(pattern)
    if (match && match[1]) {
      try {
        const date = new Date(match[1])
        if (!isNaN(date.getTime())) {
          return date.toISOString()
        }
      } catch {
        continue
      }
    }
  }

  return null
}

// Extract image URL from HTML
function extractImageUrl(html: string): string | null {
  const imagePatterns = [
    /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i,
    /<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i,
  ]

  for (const pattern of imagePatterns) {
    const match = html.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

// Fetch article content with retry
async function fetchArticleContent(url: string): Promise<{
  content: string | null
  publishedAt: string | null
  imageUrl: string | null
}> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return { content: null, publishedAt: null, imageUrl: null }
    }

    const html = await response.text()

    return {
      content: extractTextContent(html),
      publishedAt: extractPublishDate(html),
      imageUrl: extractImageUrl(html),
    }
  } catch (error) {
    console.error(`Error fetching ${url}:`, error)
    return { content: null, publishedAt: null, imageUrl: null }
  }
}

// Parse Bing News search results
function parseBingNewsResults(html: string, query: string, country: string): Omit<NewsArticle, 'content' | 'publishedAt' | 'imageUrl'>[] {
  const articles: Omit<NewsArticle, 'content' | 'publishedAt' | 'imageUrl'>[] = []

  // Pattern to match news article links with class "title" - title is inside <h2>
  // Format: <a class="title" href="URL"><h2>TITLE</h2></a>
  const articlePattern = /<a[^>]*class="title"[^>]*href="([^"]+)"[^>]*><h2[^>]*>([^<]+)<\/h2><\/a>/gi

  let match
  while ((match = articlePattern.exec(html)) !== null) {
    const url = match[1]
    // Decode HTML entities in title
    const title = match[2]
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()

    // Skip if URL is internal Bing link
    if (url.startsWith('/') || url.includes('bing.com')) {
      continue
    }

    // Try to extract source from nearby HTML - look for source in the card
    const contextBefore = html.slice(Math.max(0, match.index - 1000), match.index)
    const sourceMatch = contextBefore.match(/<a[^>]*aria-label="Buscar noticias de ([^"]+)"/i) ||
                        contextBefore.match(/class="publogo"[^>]*>[^<]*<\/div>([^<]+)<\/a>/i)

    // Try to extract snippet after the title
    const contextAfter = html.slice(match.index, match.index + 1500)
    const snippetMatch = contextAfter.match(/class="snippet"[^>]*title="([^"]+)"/i) ||
                         contextAfter.match(/class="snippet"[^>]*>([^<]+)</i)

    articles.push({
      title,
      url,
      source: sourceMatch ? sourceMatch[1].trim() : 'Unknown',
      snippet: snippetMatch ? snippetMatch[1].replace(/&quot;/g, '"').trim() : '',
      query,
      country,
    })
  }

  return articles
}

// Main scraping function
async function scrapeBingNews(request: ScrapeRequest): Promise<{
  success: boolean
  articles: NewsArticle[]
  totalFound: number
  errors: string[]
}> {
  const { queries, country, maxPages, maxArticles, dateRange, extractContent } = request
  const articles: NewsArticle[] = []
  const seenUrls = new Set<string>()
  const errors: string[] = []

  const dateFilter = DATE_RANGE_MAP[dateRange] || ''

  for (const query of queries) {
    if (articles.length >= maxArticles) break

    console.log(`Searching for: ${query}`)

    for (let page = 0; page < maxPages; page++) {
      if (articles.length >= maxArticles) break

      const offset = page * 10
      const encodedQuery = encodeURIComponent(query)

      // Build Bing News URL with filters
      let searchUrl = `https://www.bing.com/news/search?q=${encodedQuery}&first=${offset}&form=QBNH&setmkt=${country}`
      if (dateFilter) {
        searchUrl += `&qft=${dateFilter}`
      }

      console.log(`Page ${page + 1}: ${searchUrl}`)

      try {
        // Add delay between requests to avoid blocking
        if (page > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))
        }

        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': country.split('-')[0] + ',' + country + ';q=0.9,en;q=0.8',
          },
        })

        if (!response.ok) {
          errors.push(`Failed to fetch page ${page + 1} for query "${query}": ${response.status}`)
          continue
        }

        const html = await response.text()
        const pageArticles = parseBingNewsResults(html, query, country)

        if (pageArticles.length === 0) {
          console.log(`No more results for query: ${query}`)
          break
        }

        // Process each article
        for (const article of pageArticles) {
          if (articles.length >= maxArticles) break
          if (seenUrls.has(article.url)) continue

          seenUrls.add(article.url)

          let fullArticle: NewsArticle = {
            ...article,
            content: null,
            publishedAt: null,
            imageUrl: null,
          }

          // Extract full content if requested
          if (extractContent) {
            console.log(`Extracting content from: ${article.url}`)

            // Add delay before fetching article
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500))

            const { content, publishedAt, imageUrl } = await fetchArticleContent(article.url)
            fullArticle = {
              ...fullArticle,
              content,
              publishedAt,
              imageUrl,
            }
          }

          articles.push(fullArticle)
          console.log(`Found: ${article.title}`)
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Error on page ${page + 1} for query "${query}": ${errorMsg}`)
        console.error(errorMsg)
      }
    }
  }

  return {
    success: true,
    articles,
    totalFound: articles.length,
    errors,
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const request: ScrapeRequest = await req.json()

    // Validate request
    if (!request.queries || !Array.isArray(request.queries) || request.queries.length === 0) {
      return new Response(
        JSON.stringify({ error: 'queries is required and must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Set defaults
    const scrapeRequest: ScrapeRequest = {
      queries: request.queries,
      country: request.country || 'es-ES',
      maxPages: Math.min(request.maxPages || 10, 50),
      maxArticles: Math.min(request.maxArticles || 50, 200),
      dateRange: request.dateRange || 'anytime',
      extractContent: request.extractContent !== false, // Default to true
    }

    console.log('Starting Bing News scrape:', JSON.stringify(scrapeRequest))

    const result = await scrapeBingNews(scrapeRequest)

    console.log(`Scrape completed: ${result.totalFound} articles found`)

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in scrape-bing-news:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false,
        articles: [],
        totalFound: 0,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
