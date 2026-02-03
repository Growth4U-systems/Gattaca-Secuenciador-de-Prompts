/**
 * Profile Validator for Social Links Discovery
 *
 * Validates that discovered profiles actually belong to the competitor.
 * Uses heuristics like name matching, bio checking, and website verification.
 */

import {
  Platform,
  DiscoveredProfile,
  ConfidenceLevel,
  getPlatformConfig,
} from './types'

interface ValidationResult {
  isValid: boolean
  confidence: ConfidenceLevel
  details: {
    nameMatch: boolean
    bioMatch: boolean
    websiteMatch: boolean
  }
  reason?: string
}

/**
 * Validate a discovered profile
 * Uses simple heuristics to check if the profile belongs to the competitor
 */
export function validateProfile(
  profile: DiscoveredProfile,
  competitorName: string,
  competitorWebsite: string
): ValidationResult {
  // If no URL, nothing to validate
  if (!profile.url) {
    return {
      isValid: false,
      confidence: 'not_found',
      details: { nameMatch: false, bioMatch: false, websiteMatch: false },
      reason: 'No URL to validate',
    }
  }

  const config = getPlatformConfig(profile.platform)
  if (!config) {
    return {
      isValid: false,
      confidence: 'uncertain',
      details: { nameMatch: false, bioMatch: false, websiteMatch: false },
      reason: 'Unknown platform',
    }
  }

  // Extract handle from URL
  const handle = config.extractHandle(profile.url)
  if (!handle) {
    return {
      isValid: false,
      confidence: 'uncertain',
      details: { nameMatch: false, bioMatch: false, websiteMatch: false },
      reason: 'Could not extract handle from URL',
    }
  }

  // Validation checks
  const nameMatch = validateNameMatch(handle, competitorName)
  const websiteMatch = validateWebsiteInUrl(profile.url, competitorWebsite)

  // Determine confidence based on matches
  let confidence: ConfidenceLevel = 'uncertain'
  let isValid = false

  if (nameMatch && websiteMatch) {
    confidence = 'verified'
    isValid = true
  } else if (nameMatch) {
    confidence = 'likely'
    isValid = true
  } else if (websiteMatch) {
    confidence = 'likely'
    isValid = true
  } else {
    // Check for partial matches
    const partialMatch = validatePartialMatch(handle, competitorName)
    if (partialMatch) {
      confidence = 'uncertain'
      isValid = true
    } else {
      confidence = 'uncertain'
      isValid = false
    }
  }

  return {
    isValid,
    confidence,
    details: {
      nameMatch,
      bioMatch: false, // Would need to fetch profile to check bio
      websiteMatch,
    },
  }
}

/**
 * Check if the handle matches the competitor name
 */
function validateNameMatch(handle: string, competitorName: string): boolean {
  const normalizedHandle = normalizeString(handle)
  const normalizedName = normalizeString(competitorName)

  // Exact match
  if (normalizedHandle === normalizedName) {
    return true
  }

  // Handle contains company name
  if (normalizedHandle.includes(normalizedName)) {
    return true
  }

  // Company name contains handle (for short handles)
  if (normalizedName.includes(normalizedHandle) && normalizedHandle.length >= 3) {
    return true
  }

  return false
}

/**
 * Check for partial matches (fuzzy matching)
 */
function validatePartialMatch(handle: string, competitorName: string): boolean {
  const normalizedHandle = normalizeString(handle)
  const normalizedName = normalizeString(competitorName)

  // Split into words and check for any common words
  const handleWords = normalizedHandle.split(/[\s\-_]+/).filter((w) => w.length >= 3)
  const nameWords = normalizedName.split(/[\s\-_]+/).filter((w) => w.length >= 3)

  // Check if any significant word matches
  for (const hWord of handleWords) {
    for (const nWord of nameWords) {
      if (hWord === nWord || hWord.includes(nWord) || nWord.includes(hWord)) {
        return true
      }
    }
  }

  // Check Levenshtein distance for short names
  if (normalizedHandle.length <= 15 && normalizedName.length <= 15) {
    const distance = levenshteinDistance(normalizedHandle, normalizedName)
    const maxLength = Math.max(normalizedHandle.length, normalizedName.length)
    const similarity = 1 - distance / maxLength

    // 70% similarity threshold
    if (similarity >= 0.7) {
      return true
    }
  }

  return false
}

/**
 * Check if the website domain is referenced in the profile URL
 */
function validateWebsiteInUrl(profileUrl: string, competitorWebsite: string): boolean {
  try {
    const websiteDomain = extractDomain(competitorWebsite)

    // For review sites, check if the domain is in the URL
    if (
      profileUrl.includes('trustpilot.com') ||
      profileUrl.includes('g2.com') ||
      profileUrl.includes('capterra.com')
    ) {
      return profileUrl.toLowerCase().includes(websiteDomain.toLowerCase())
    }

    return false
  } catch {
    return false
  }
}

/**
 * Normalize string for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
    .trim()
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    let normalized = url.trim()
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`
    }
    const urlObj = new URL(normalized)
    return urlObj.hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
  }
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length

  // Create distance matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  // Initialize first column
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i
  }

  // Initialize first row
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j
  }

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return dp[m][n]
}

/**
 * Batch validate multiple profiles
 */
export function validateProfiles(
  profiles: Record<Platform, DiscoveredProfile>,
  competitorName: string,
  competitorWebsite: string
): Record<Platform, DiscoveredProfile> {
  const validated: Record<Platform, DiscoveredProfile> = {} as Record<Platform, DiscoveredProfile>

  for (const [platform, profile] of Object.entries(profiles)) {
    const result = validateProfile(profile, competitorName, competitorWebsite)

    validated[platform as Platform] = {
      ...profile,
      confidence: result.confidence,
      validationDetails: result.details,
    }
  }

  return validated
}

/**
 * Upgrade confidence level based on additional validation
 * Called when profile was found on website (source = 'website_link')
 */
export function upgradeConfidenceForWebsiteLink(profile: DiscoveredProfile): DiscoveredProfile {
  if (profile.source === 'website_link' && profile.url) {
    // If found on the competitor's website, it's likely verified
    return {
      ...profile,
      confidence: 'verified',
      validationDetails: {
        ...profile.validationDetails,
        websiteMatch: true,
        nameMatch: profile.validationDetails?.nameMatch ?? false,
        bioMatch: profile.validationDetails?.bioMatch ?? false,
      },
    }
  }
  return profile
}
