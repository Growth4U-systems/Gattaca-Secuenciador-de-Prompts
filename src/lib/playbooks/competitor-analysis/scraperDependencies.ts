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

      // Extract YouTube video URLs from content
      // Matches: https://www.youtube.com/watch?v=ABC123
      // Or: https://youtube.com/watch?v=ABC123
      const urlRegex = /https:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/g
      const matches = Array.from(doc.extracted_content.matchAll(urlRegex))
      const urls = matches.map(m => m[0])

      // Deduplicate
      return Array.from(new Set(urls))
    }
  },

  {
    scraper: 'linkedin_comments',
    dependsOn: 'linkedin_posts',
    targetInputField: 'postIds',
    urlAsObject: false,
    urlExtractor: (doc: Document) => {
      if (!doc.extracted_content) return []

      // Extract LinkedIn post URLs from content
      // Matches: https://www.linkedin.com/posts/username-12345
      // Or: https://linkedin.com/feed/update/urn:li:activity:1234567890
      const urlRegex = /https:\/\/(?:www\.)?linkedin\.com\/(?:posts\/[\w-]+|feed\/update\/urn:li:activity:\d+)/g
      const matches = Array.from(doc.extracted_content.matchAll(urlRegex))
      const urls = matches.map(m => m[0])

      return Array.from(new Set(urls))
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

      // Extract TikTok video URLs from content
      // Matches: https://www.tiktok.com/@username/video/1234567890
      // Or: https://tiktok.com/@username/video/1234567890
      const urlRegex = /https:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/g
      const matches = Array.from(doc.extracted_content.matchAll(urlRegex))
      const urls = matches.map(m => m[0])

      return Array.from(new Set(urls))
    }
  },

  {
    scraper: 'facebook_comments',
    dependsOn: 'facebook_posts',
    targetInputField: 'startUrls',
    urlAsObject: true,
    urlExtractor: (doc: Document) => {
      if (!doc.extracted_content) return []

      // Extract Facebook post URLs from content
      // Matches: https://www.facebook.com/username/posts/123456
      // Or: https://facebook.com/permalink.php?story_fbid=123&id=456
      const urlRegex = /https:\/\/(?:www\.)?facebook\.com\/(?:[\w.-]+\/posts\/\d+|permalink\.php\?[^"'\s]+)/g
      const matches = Array.from(doc.extracted_content.matchAll(urlRegex))
      const urls = matches.map(m => m[0])

      return Array.from(new Set(urls))
    }
  }
]

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
