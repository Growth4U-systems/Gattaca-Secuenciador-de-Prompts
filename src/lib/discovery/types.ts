/**
 * Discovery Types
 *
 * Types for the auto-discovery system that finds competitor social profiles.
 */

// Supported platforms for discovery
export type Platform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'youtube'
  | 'tiktok'
  | 'twitter'
  | 'trustpilot'
  | 'g2'
  | 'capterra'
  | 'playstore'
  | 'appstore'

// Confidence level for discovered profiles
export type ConfidenceLevel = 'verified' | 'likely' | 'uncertain' | 'not_found'

// Source of how the profile was discovered
export type DiscoverySource = 'website_link' | 'google_search' | 'deep_research' | 'manual'

// A discovered profile
export interface DiscoveredProfile {
  platform: Platform
  url: string | null
  handle: string | null
  confidence: ConfidenceLevel
  source: DiscoverySource
  validationDetails?: {
    nameMatch: boolean
    bioMatch: boolean
    websiteMatch: boolean
  }
}

// Result of website scraping for social links
export interface WebsiteSocialLinks {
  instagram?: string
  facebook?: string
  linkedin?: string
  youtube?: string
  tiktok?: string
  twitter?: string
  trustpilot?: string
  appStore?: string
  playStore?: string
  // Raw links found (for debugging)
  rawLinks?: string[]
}

// Discovery job status
export interface DiscoveryJobStatus {
  jobId: string
  status: 'pending' | 'scraping_website' | 'searching_profiles' | 'validating' | 'completed' | 'failed'
  progress: number // 0-100
  currentStep: string
  results: DiscoveryResults | null
  error?: string
  startedAt: string
  completedAt?: string
}

// Final discovery results
export interface DiscoveryResults {
  competitorName: string
  websiteUrl: string
  profiles: Record<Platform, DiscoveredProfile>
  discoveryDate: string
  // Stats
  totalFound: number
  verifiedCount: number
  likelyCount: number
  notFoundCount: number
}

// Discovery request
export interface DiscoveryRequest {
  competitorName: string
  websiteUrl: string
  projectId: string
  // Optional: platforms to skip
  skipPlatforms?: Platform[]
}

// Platform configuration for discovery
export interface PlatformConfig {
  platform: Platform
  displayName: string
  urlPatterns: RegExp[]
  searchQuery: (competitorName: string) => string
  extractHandle: (url: string) => string | null
  inputKey: string // Key to use in custom_variables
}

// All platform configurations
export const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    platform: 'instagram',
    displayName: 'Instagram',
    urlPatterns: [/instagram\.com\/([^\/\?\s#]+)/i],
    searchQuery: (name) => `${name} instagram official`,
    extractHandle: (url) => {
      const match = url.match(/instagram\.com\/([^\/\?\s#]+)/i)
      return match ? match[1] : null
    },
    inputKey: 'instagram_username',
  },
  {
    platform: 'facebook',
    displayName: 'Facebook',
    urlPatterns: [/facebook\.com\/([^\/\?\s#]+)/i, /fb\.com\/([^\/\?\s#]+)/i],
    searchQuery: (name) => `${name} facebook page official`,
    extractHandle: (url) => {
      const match = url.match(/(?:facebook|fb)\.com\/([^\/\?\s#]+)/i)
      return match ? match[1] : null
    },
    inputKey: 'facebook_url',
  },
  {
    platform: 'linkedin',
    displayName: 'LinkedIn',
    urlPatterns: [/linkedin\.com\/company\/([^\/\?\s#]+)/i],
    searchQuery: (name) => `site:linkedin.com/company "${name}"`,
    extractHandle: (url) => {
      const match = url.match(/linkedin\.com\/company\/([^\/\?\s#]+)/i)
      return match ? match[1] : null
    },
    inputKey: 'linkedin_url',
  },
  {
    platform: 'youtube',
    displayName: 'YouTube',
    urlPatterns: [
      /youtube\.com\/@([^\/\?\s#]+)/i,
      /youtube\.com\/c\/([^\/\?\s#]+)/i,
      /youtube\.com\/channel\/([^\/\?\s#]+)/i,
      /youtube\.com\/user\/([^\/\?\s#]+)/i,
    ],
    searchQuery: (name) => `${name} youtube channel official`,
    extractHandle: (url) => {
      const patterns = [
        /youtube\.com\/@([^\/\?\s#]+)/i,
        /youtube\.com\/c\/([^\/\?\s#]+)/i,
        /youtube\.com\/channel\/([^\/\?\s#]+)/i,
        /youtube\.com\/user\/([^\/\?\s#]+)/i,
      ]
      for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
      }
      return null
    },
    inputKey: 'youtube_url',
  },
  {
    platform: 'tiktok',
    displayName: 'TikTok',
    urlPatterns: [/tiktok\.com\/@([^\/\?\s#]+)/i],
    searchQuery: (name) => `${name} tiktok official`,
    extractHandle: (url) => {
      const match = url.match(/tiktok\.com\/@([^\/\?\s#]+)/i)
      return match ? match[1].replace('@', '') : null
    },
    inputKey: 'tiktok_username',
  },
  {
    platform: 'twitter',
    displayName: 'Twitter/X',
    urlPatterns: [/(?:twitter|x)\.com\/([^\/\?\s#]+)/i],
    searchQuery: (name) => `${name} twitter official`,
    extractHandle: (url) => {
      const match = url.match(/(?:twitter|x)\.com\/([^\/\?\s#]+)/i)
      return match ? match[1] : null
    },
    inputKey: 'twitter_username',
  },
  {
    platform: 'trustpilot',
    displayName: 'Trustpilot',
    urlPatterns: [/trustpilot\.com\/review\/([^\/\?\s#]+)/i],
    searchQuery: (name) => `site:trustpilot.com/review "${name}"`,
    extractHandle: (url) => {
      const match = url.match(/trustpilot\.com\/review\/([^\/\?\s#]+)/i)
      return match ? match[1] : null
    },
    inputKey: 'trustpilot_url',
  },
  {
    platform: 'g2',
    displayName: 'G2',
    urlPatterns: [/g2\.com\/products\/([^\/\?\s#]+)/i],
    searchQuery: (name) => `site:g2.com/products "${name}"`,
    extractHandle: (url) => {
      const match = url.match(/g2\.com\/products\/([^\/\?\s#]+)/i)
      return match ? match[1] : null
    },
    inputKey: 'g2_url',
  },
  {
    platform: 'capterra',
    displayName: 'Capterra',
    urlPatterns: [/capterra\.com\/p\/(\d+)/i, /capterra\.com\/software\/(\d+)/i],
    searchQuery: (name) => `site:capterra.com "${name}" reviews`,
    extractHandle: (url) => {
      const match = url.match(/capterra\.com\/(?:p|software)\/(\d+)/i)
      return match ? match[1] : null
    },
    inputKey: 'capterra_url',
  },
  {
    platform: 'playstore',
    displayName: 'Google Play',
    urlPatterns: [/play\.google\.com\/store\/apps\/details\?id=([^&\s#]+)/i],
    searchQuery: (name) => `site:play.google.com "${name}" app`,
    extractHandle: (url) => {
      const match = url.match(/play\.google\.com\/store\/apps\/details\?id=([^&\s#]+)/i)
      return match ? match[1] : null
    },
    inputKey: 'play_store_app_id',
  },
  {
    platform: 'appstore',
    displayName: 'App Store',
    urlPatterns: [/apps\.apple\.com\/[^\/]+\/app\/[^\/]+\/id(\d+)/i],
    searchQuery: (name) => `site:apps.apple.com "${name}" app`,
    extractHandle: (url) => {
      const match = url.match(/apps\.apple\.com\/[^\/]+\/app\/[^\/]+\/id(\d+)/i)
      return match ? match[1] : null
    },
    inputKey: 'app_store_app_id',
  },
]

// Helper to get platform config
export function getPlatformConfig(platform: Platform): PlatformConfig | undefined {
  return PLATFORM_CONFIGS.find((c) => c.platform === platform)
}

// Helper to get all platforms
export function getAllPlatforms(): Platform[] {
  return PLATFORM_CONFIGS.map((c) => c.platform)
}
