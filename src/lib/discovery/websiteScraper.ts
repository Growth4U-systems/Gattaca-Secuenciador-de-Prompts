/**
 * Website Scraper for Social Links Discovery
 *
 * Extracts social media links from a competitor's website.
 * Uses Firecrawl for simple scraping (faster than Apify for single pages).
 */

import { WebsiteSocialLinks, PLATFORM_CONFIGS, Platform } from './types'

// Pages to check for social links (in order of priority)
const PAGES_TO_CHECK = ['', '/about', '/about-us', '/contact', '/contact-us', '/impressum', '/legal']

// Common footer/header selectors where social links are found
const SOCIAL_LINK_SELECTORS = [
  'footer a[href*="instagram"]',
  'footer a[href*="facebook"]',
  'footer a[href*="linkedin"]',
  'footer a[href*="youtube"]',
  'footer a[href*="tiktok"]',
  'footer a[href*="twitter"]',
  'footer a[href*="x.com"]',
  'header a[href*="instagram"]',
  // Generic social links
  'a[href*="instagram.com"]',
  'a[href*="facebook.com"]',
  'a[href*="linkedin.com"]',
  'a[href*="youtube.com"]',
  'a[href*="tiktok.com"]',
  'a[href*="twitter.com"]',
  'a[href*="x.com"]',
  'a[href*="trustpilot.com"]',
  'a[href*="g2.com"]',
  'a[href*="capterra.com"]',
  'a[href*="play.google.com"]',
  'a[href*="apps.apple.com"]',
]

/**
 * Extract social links from raw HTML content
 */
export function extractSocialLinksFromHtml(html: string): WebsiteSocialLinks {
  const results: WebsiteSocialLinks = {}
  const rawLinks: string[] = []

  // Find all href attributes in the HTML
  const hrefMatches = html.matchAll(/href=["']([^"']+)["']/gi)

  for (const match of hrefMatches) {
    const url = match[1]
    if (!url) continue

    rawLinks.push(url)

    // Check each platform's patterns
    for (const config of PLATFORM_CONFIGS) {
      for (const pattern of config.urlPatterns) {
        if (pattern.test(url)) {
          // Map platform to result key
          const key = platformToKey(config.platform)
          if (key && key !== 'rawLinks') {
            const typedKey = key as Exclude<keyof WebsiteSocialLinks, 'rawLinks'>
            if (!results[typedKey]) {
              results[typedKey] = url
            }
          }
          break
        }
      }
    }
  }

  results.rawLinks = rawLinks.filter((link) =>
    PLATFORM_CONFIGS.some((config) => config.urlPatterns.some((p) => p.test(link)))
  )

  return results
}

/**
 * Map platform name to WebsiteSocialLinks key
 */
function platformToKey(platform: Platform): string | null {
  const mapping: Record<Platform, keyof WebsiteSocialLinks | null> = {
    instagram: 'instagram',
    facebook: 'facebook',
    linkedin: 'linkedin',
    youtube: 'youtube',
    tiktok: 'tiktok',
    twitter: 'twitter',
    trustpilot: 'trustpilot',
    g2: null, // Not typically linked from websites
    capterra: null,
    playstore: 'playStore',
    appstore: 'appStore',
  }
  return mapping[platform] || null
}

/**
 * Scrape a website for social media links using Firecrawl
 */
export async function scrapeWebsiteForSocialLinks(
  websiteUrl: string,
  firecrawlApiKey?: string
): Promise<WebsiteSocialLinks> {
  const apiKey = firecrawlApiKey || process.env.FIRECRAWL_API_KEY

  if (!apiKey) {
    console.warn('[websiteScraper] No Firecrawl API key, using fetch fallback')
    return scrapeWithFetch(websiteUrl)
  }

  try {
    // Normalize URL
    const baseUrl = normalizeUrl(websiteUrl)

    // Scrape multiple pages to find social links
    const allLinks: WebsiteSocialLinks = {}

    for (const path of PAGES_TO_CHECK) {
      const pageUrl = `${baseUrl}${path}`

      try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            url: pageUrl,
            formats: ['html'],
            onlyMainContent: false, // We need footer/header
            timeout: 30000,
          }),
        })

        if (!response.ok) {
          console.warn(`[websiteScraper] Failed to scrape ${pageUrl}: ${response.status}`)
          continue
        }

        const data = await response.json()
        const html = data.data?.html || ''

        if (html) {
          const pageLinks = extractSocialLinksFromHtml(html)

          // Merge found links (first found wins)
          Object.entries(pageLinks).forEach(([key, value]) => {
            if (value && key !== 'rawLinks' && !allLinks[key as keyof WebsiteSocialLinks]) {
              ;(allLinks as Record<string, unknown>)[key] = value
            }
          })
        }

        // If we found most common platforms, stop early
        if (allLinks.instagram && allLinks.facebook && allLinks.linkedin) {
          break
        }
      } catch (pageError) {
        console.warn(`[websiteScraper] Error scraping ${pageUrl}:`, pageError)
        continue
      }
    }

    return allLinks
  } catch (error) {
    console.error('[websiteScraper] Error:', error)
    return scrapeWithFetch(websiteUrl)
  }
}

/**
 * Fallback: scrape with simple fetch (no JS rendering)
 */
async function scrapeWithFetch(websiteUrl: string): Promise<WebsiteSocialLinks> {
  const baseUrl = normalizeUrl(websiteUrl)
  console.log(`[websiteScraper] Using fetch fallback for ${baseUrl}`)

  try {
    const response = await fetch(baseUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    })

    if (!response.ok) {
      console.warn(`[websiteScraper] Fetch failed: ${response.status}`)
      return {}
    }

    const html = await response.text()
    console.log(`[websiteScraper] Fetched ${html.length} characters of HTML`)

    const results = extractSocialLinksFromHtml(html)
    console.log(`[websiteScraper] Extracted links:`, JSON.stringify(results, null, 2))

    return results
  } catch (error) {
    console.error('[websiteScraper] Fetch error:', error)
    return {}
  }
}

/**
 * Normalize URL to ensure it has protocol and no trailing slash
 */
function normalizeUrl(url: string): string {
  let normalized = url.trim()

  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`
  }

  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '')

  return normalized
}

/**
 * Extract domain from URL for search queries
 */
export function extractDomain(url: string): string {
  try {
    const normalized = normalizeUrl(url)
    const urlObj = new URL(normalized)
    return urlObj.hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
  }
}
