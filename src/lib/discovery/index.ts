/**
 * Discovery Module
 *
 * Auto-discovery system for finding competitor social media profiles.
 */

// Types
export * from './types'

// Core modules
export { extractSocialLinksFromHtml, scrapeWebsiteForSocialLinks, extractDomain } from './websiteScraper'
export { searchForProfile, searchForProfiles, searchMissingProfiles } from './profileSearcher'
export type { SearchProvider } from './profileSearcher'
export { validateProfile, validateProfiles, upgradeConfidenceForWebsiteLink } from './profileValidator'
export {
  startDiscovery,
  getJobStatus,
  runDiscoverySync,
  resultsToCustomVariables,
  cleanupOldJobs,
} from './discoveryOrchestrator'
export type { DiscoveryOptions } from './discoveryOrchestrator'
