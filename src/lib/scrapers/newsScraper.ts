/**
 * News Scraper - Bing News Search
 *
 * TypeScript implementation of noticias_scraper.py
 * Uses Bing News search (free) + article extraction
 *
 * Scalable for multiple users with rate limiting and error handling
 */

import * as cheerio from 'cheerio'

// ============================================
// TYPES
// ============================================

export interface NewsArticle {
  title: string
  url: string
  content: string | null
  publishedAt: string | null
  source: string | null
  snippet: string | null
}

export interface NewsScraperInput {
  query: string
  country?: string // es-ES, en-US, etc.
  maxPages?: number
  maxArticles?: number
}

export interface NewsScraperResult {
  success: boolean
  articles: NewsArticle[]
  totalFound: number
  query: string
  country: string
  error?: string
}

// ============================================
// CONSTANTS
// ============================================

const COUNTRY_CODES: Record<string, string> = {
  'es': 'es-ES',
  'es-ES': 'es-ES',
  'es-MX': 'es-MX',
  'es-AR': 'es-AR',
  'en': 'en-US',
  'en-US': 'en-US',
  'en-GB': 'en-GB',
  'fr': 'fr-FR',
  'fr-FR': 'fr-FR',
  'de': 'de-DE',
  'de-DE': 'de-DE',
  'pt': 'pt-BR',
  'pt-BR': 'pt-BR',
  'it': 'it-IT',
  'it-IT': 'it-IT',
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
]

// ============================================
// HELPER FUNCTIONS
// ============================================

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function normalizeCountry(country?: string): string {
  if (!country) return 'es-ES'
  return COUNTRY_CODES[country] || country
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Extract article content using simple heuristics
 * Falls back gracefully if extraction fails
 */
async function extractArticleContent(url: string): Promise<{
  content: string | null
  publishedAt: string | null
  source: string | null
}> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      return { content: null, publishedAt: null, source: null }
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Remove script, style, nav, footer, aside elements
    $('script, style, nav, footer, aside, .ad, .advertisement, .social-share, .comments').remove()

    // Try to find main content
    let content = ''
    const contentSelectors = [
      'article',
      '[role="main"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content-body',
      'main',
      '.story-body',
    ]

    for (const selector of contentSelectors) {
      const element = $(selector)
      if (element.length > 0) {
        content = element.text().trim()
        if (content.length > 200) break
      }
    }

    // Fallback to body paragraphs
    if (content.length < 200) {
      const paragraphs = $('p').map((_, el) => $(el).text().trim()).get()
      content = paragraphs.filter(p => p.length > 50).join('\n\n')
    }

    // Clean up content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim()
      .slice(0, 10000) // Limit to 10k chars

    // Try to extract publication date
    let publishedAt: string | null = null
    const dateSelectors = [
      'time[datetime]',
      'meta[property="article:published_time"]',
      'meta[name="date"]',
      'meta[name="DC.date"]',
      '.date',
      '.published',
      '.post-date',
    ]

    for (const selector of dateSelectors) {
      const element = $(selector)
      if (element.length > 0) {
        publishedAt = element.attr('datetime') || element.attr('content') || element.text().trim()
        if (publishedAt) break
      }
    }

    // Extract source/publisher
    let source: string | null = null
    const sourceSelectors = [
      'meta[property="og:site_name"]',
      'meta[name="publisher"]',
    ]
    for (const selector of sourceSelectors) {
      const element = $(selector)
      if (element.length > 0) {
        source = element.attr('content') || null
        if (source) break
      }
    }

    return {
      content: content.length > 100 ? content : null,
      publishedAt,
      source,
    }
  } catch (error) {
    console.error(`[newsScraper] Error extracting content from ${url}:`, error)
    return { content: null, publishedAt: null, source: null }
  }
}

// ============================================
// MAIN SCRAPER FUNCTION
// ============================================

/**
 * Scrape news articles from Bing News
 *
 * @param input - Scraper configuration
 * @returns Promise<NewsScraperResult>
 */
export async function scrapeNews(input: NewsScraperInput): Promise<NewsScraperResult> {
  const {
    query,
    country = 'es-ES',
    maxPages = 5,
    maxArticles = 20,
  } = input

  const normalizedCountry = normalizeCountry(country)
  const articles: NewsArticle[] = []
  const seenUrls = new Set<string>()
  const seenTitles = new Set<string>()

  console.log(`[newsScraper] Starting search for: "${query}" (${normalizedCountry})`)

  try {
    for (let page = 0; page < maxPages && articles.length < maxArticles; page++) {
      const offset = page * 10
      const encodedQuery = encodeURIComponent(query)
      const searchUrl = `https://www.bing.com/news/search?q=${encodedQuery}&first=${offset}&form=QBNH&setmkt=${normalizedCountry}`

      console.log(`[newsScraper] Fetching page ${page + 1}: ${searchUrl}`)

      try {
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          },
          signal: AbortSignal.timeout(15000), // 15 second timeout
        })

        if (!response.ok) {
          console.warn(`[newsScraper] HTTP ${response.status} for page ${page + 1}`)
          continue
        }

        const html = await response.text()
        const $ = cheerio.load(html)

        // Select news article links (Bing News uses 'a.title' class)
        const articleLinks = $('a.title')

        if (articleLinks.length === 0) {
          console.log(`[newsScraper] No more results on page ${page + 1}`)
          break
        }

        for (let i = 0; i < articleLinks.length && articles.length < maxArticles; i++) {
          const element = articleLinks.eq(i)
          const title = element.text().trim()
          const url = element.attr('href')

          if (!url || !title) continue

          // Skip duplicates
          if (seenUrls.has(url) || seenTitles.has(title.toLowerCase())) {
            continue
          }
          seenUrls.add(url)
          seenTitles.add(title.toLowerCase())

          // Get snippet from parent card if available
          const card = element.closest('.news-card, .newsitem')
          const snippet = card.find('.snippet, .description').text().trim() || null

          console.log(`[newsScraper] Found: ${title.slice(0, 60)}...`)

          // Extract full article content
          const { content, publishedAt, source } = await extractArticleContent(url)

          articles.push({
            title,
            url,
            content,
            publishedAt,
            source,
            snippet,
          })

          // Rate limiting: 500ms between article fetches
          await delay(500)
        }

        // Rate limiting: 1s between search pages
        await delay(1000)

      } catch (pageError) {
        console.error(`[newsScraper] Error on page ${page + 1}:`, pageError)
        continue
      }
    }

    console.log(`[newsScraper] Completed: ${articles.length} articles found`)

    return {
      success: true,
      articles,
      totalFound: articles.length,
      query,
      country: normalizedCountry,
    }

  } catch (error) {
    console.error('[newsScraper] Fatal error:', error)
    return {
      success: false,
      articles: [],
      totalFound: 0,
      query,
      country: normalizedCountry,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Format news articles for document storage
 */
export function formatNewsForDocument(result: NewsScraperResult): string {
  if (!result.success || result.articles.length === 0) {
    return `No news articles found for "${result.query}"`
  }

  const lines: string[] = [
    `# News Articles: ${result.query}`,
    `Country: ${result.country}`,
    `Total articles: ${result.totalFound}`,
    `Extracted: ${new Date().toISOString()}`,
    '',
    '---',
    '',
  ]

  for (const article of result.articles) {
    lines.push(`## ${article.title}`)
    lines.push('')
    if (article.source) lines.push(`**Source:** ${article.source}`)
    if (article.publishedAt) lines.push(`**Published:** ${article.publishedAt}`)
    lines.push(`**URL:** ${article.url}`)
    lines.push('')
    if (article.snippet) {
      lines.push(`> ${article.snippet}`)
      lines.push('')
    }
    if (article.content) {
      lines.push(article.content)
    } else {
      lines.push('*Content could not be extracted*')
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}
