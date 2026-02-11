/**
 * Scraper Dependencies System
 *
 * Defines dependencies between scrapers (e.g., comments need post URLs).
 * Provides URL extraction logic and batch organization considering dependencies.
 */

// ============================================
// TYPES
// ============================================

export interface ScraperDependency {
  /** The scraper that has a dependency */
  scraper: string
  /** The scraper it depends on */
  dependsOn: string
  /** The Apify input field name where extracted URLs should be injected */
  targetInputField: string
  /** Whether URLs should be wrapped as {url: string} objects (for Facebook/YouTube) */
  urlAsObject: boolean
  /** Function to extract URLs from the parent scraper's document */
  urlExtractor: (document: Document) => string[]
}

interface Document {
  id: string
  extracted_content?: string
  source_metadata?: Record<string, unknown>
}

interface Scraper {
  sourceType: string
  name: string
  inputValue?: string
  isCompleted: boolean
}

// ============================================
// DEPENDENCY DEFINITIONS
// ============================================

export const SCRAPER_DEPENDENCIES: ScraperDependency[] = [
  {
    scraper: 'youtube_comments',
    dependsOn: 'youtube_videos',
    targetInputField: 'startUrls',
    urlAsObject: true,
    urlExtractor: (doc: Document) => {
      if (!doc.extracted_content) return []

      // Try JSON field extraction first (most reliable for Apify output)
      const jsonUrls = extractUrlsFromJson(
        doc.extracted_content,
        ['url', 'videoUrl', 'link', 'videoLink'],
        /youtube\.com|youtu\.be/
      )
      if (jsonUrls.length > 0) return Array.from(new Set(jsonUrls))

      // Fallback: regex extraction from text content
      const watchRegex = /https:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/g
      const shortsRegex = /https:\/\/(?:www\.)?youtube\.com\/shorts\/[\w-]+/g
      const shortUrlRegex = /https:\/\/youtu\.be\/[\w-]+/g

      const watchMatches = Array.from(doc.extracted_content.matchAll(watchRegex)).map(m => m[0])
      const shortsMatches = Array.from(doc.extracted_content.matchAll(shortsRegex)).map(m => m[0])
      const shortUrlMatches = Array.from(doc.extracted_content.matchAll(shortUrlRegex)).map(m => m[0])

      return Array.from(new Set([...watchMatches, ...shortsMatches, ...shortUrlMatches]))
    }
  },

  {
    scraper: 'linkedin_comments',
    dependsOn: 'linkedin_posts',
    targetInputField: 'postIds',
    urlAsObject: false,
    urlExtractor: (doc: Document) => {
      if (!doc.extracted_content) return []

      // Try JSON field extraction first (most reliable for Apify output)
      const jsonUrls = extractUrlsFromJson(
        doc.extracted_content,
        ['url', 'postUrl', 'link', 'shareUrl'],
        /linkedin\.com/
      )
      if (jsonUrls.length > 0) return Array.from(new Set(jsonUrls))

      // Fallback: regex extraction from text content
      const postsRegex = /https:\/\/(?:www\.)?linkedin\.com\/posts\/[\w-]+/g
      const feedRegex = /https:\/\/(?:www\.)?linkedin\.com\/feed\/update\/urn:li:(?:activity|share|ugcPost):\d+/g

      const postsMatches = Array.from(doc.extracted_content.matchAll(postsRegex)).map(m => m[0])
      const feedMatches = Array.from(doc.extracted_content.matchAll(feedRegex)).map(m => m[0])

      return Array.from(new Set([...postsMatches, ...feedMatches]))
    }
  },

  {
    scraper: 'instagram_posts_comments',
    dependsOn: 'instagram_posts',
    targetInputField: 'username',
    urlAsObject: false,
    urlExtractor: (doc: Document) => {
      // Instagram posts already include comments in the same scraper
      // This dependency is informational - no need for second scraper
      return []
    }
  },

  {
    scraper: 'tiktok_comments',
    dependsOn: 'tiktok_posts',
    targetInputField: 'postURLs',
    urlAsObject: false,
    urlExtractor: (doc: Document) => {
      if (!doc.extracted_content) return []

      // Try JSON field extraction first (most reliable for Apify output)
      const jsonUrls = extractUrlsFromJson(
        doc.extracted_content,
        ['webVideoUrl', 'videoUrl', 'url', 'link', 'video_url'],
        /tiktok\.com/
      )
      if (jsonUrls.length > 0) return Array.from(new Set(jsonUrls))

      // Fallback: regex extraction from text content
      const videoRegex = /https:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/g
      const shortRegex = /https:\/\/vm\.tiktok\.com\/[\w]+\/?/g

      const videoMatches = Array.from(doc.extracted_content.matchAll(videoRegex)).map(m => m[0])
      const shortMatches = Array.from(doc.extracted_content.matchAll(shortRegex)).map(m => m[0])

      return Array.from(new Set([...videoMatches, ...shortMatches]))
    }
  },

  {
    scraper: 'facebook_comments',
    dependsOn: 'facebook_posts',
    targetInputField: 'startUrls',
    urlAsObject: true,
    urlExtractor: (doc: Document) => {
      if (!doc.extracted_content) return []

      // Try JSON field extraction first (most reliable for Apify output)
      const jsonUrls = extractUrlsFromJson(
        doc.extracted_content,
        ['postUrl', 'url', 'link', 'postLink'],
        /facebook\.com/
      )
      if (jsonUrls.length > 0) return Array.from(new Set(jsonUrls))

      // Fallback: regex extraction from text content
      const postsRegex = /https:\/\/(?:www\.)?facebook\.com\/[\w.-]+\/posts\/[\w]+/g
      const permalinkRegex = /https:\/\/(?:www\.)?facebook\.com\/(?:permalink|story)\.php\?[^"'\s}]+/g
      const photoRegex = /https:\/\/(?:www\.)?facebook\.com\/photo\/?\?fbid=\d+/g
      const watchRegex = /https:\/\/(?:www\.)?facebook\.com\/watch\/?\?v=\d+/g

      const postsMatches = Array.from(doc.extracted_content.matchAll(postsRegex)).map(m => m[0])
      const permalinkMatches = Array.from(doc.extracted_content.matchAll(permalinkRegex)).map(m => m[0])
      const photoMatches = Array.from(doc.extracted_content.matchAll(photoRegex)).map(m => m[0])
      const watchMatches = Array.from(doc.extracted_content.matchAll(watchRegex)).map(m => m[0])

      return Array.from(new Set([...postsMatches, ...permalinkMatches, ...photoMatches, ...watchMatches]))
    }
  }
]

// ============================================
// JSON URL EXTRACTION HELPER
// ============================================

/**
 * Extract URLs from JSON-formatted document content by checking known fields.
 * Apify scrapers store output as JSON arrays - this extracts URLs from common field names.
 */
function extractUrlsFromJson(content: string, urlFields: string[], urlPattern?: RegExp): string[] {
  try {
    const parsed = JSON.parse(content)
    const items = Array.isArray(parsed) ? parsed : [parsed]
    const urls: string[] = []

    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      for (const field of urlFields) {
        const value = item[field]
        if (typeof value === 'string' && value.startsWith('http')) {
          if (!urlPattern || urlPattern.test(value)) {
            urls.push(value)
          }
        }
      }
    }

    return urls
  } catch {
    return []
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a scraper has dependencies
 */
export function getScraperDependency(scraperType: string): ScraperDependency | undefined {
  return SCRAPER_DEPENDENCIES.find(d => d.scraper === scraperType)
}

/**
 * Organize scrapers into batches considering dependencies
 * Returns: [independent scrapers, dependent scrapers]
 */
export function organizeBatchesWithDependencies(scrapers: Scraper[]): Scraper[][] {
  const independent: Scraper[] = []
  const dependent: Scraper[] = []

  for (const scraper of scrapers) {
    const dep = getScraperDependency(scraper.sourceType)

    if (dep) {
      // Has dependency - put in second batch
      dependent.push(scraper)
    } else {
      // No dependency - put in first batch
      independent.push(scraper)
    }
  }

  // Return batches, filtering out empty ones
  const batches: Scraper[][] = []

  if (independent.length > 0) {
    batches.push(independent)
  }

  if (dependent.length > 0) {
    batches.push(dependent)
  }

  return batches
}

/**
 * Get all parent scrapers that need to run before the given scraper
 */
export function getRequiredParents(scraperType: string): string[] {
  const dep = getScraperDependency(scraperType)
  if (!dep) return []

  return [dep.dependsOn]
}

/**
 * Check if scraper A must run before scraper B
 */
export function mustRunBefore(scraperA: string, scraperB: string): boolean {
  const depB = getScraperDependency(scraperB)
  if (!depB) return false

  return depB.dependsOn === scraperA
}
