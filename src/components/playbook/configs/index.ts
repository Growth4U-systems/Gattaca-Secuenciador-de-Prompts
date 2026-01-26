// Playbook configurations
// Each playbook type has its own configuration file that defines phases, steps, and behavior

import { PlaybookConfig } from '../types'
import nicheFinderConfig from './niche-finder.config'
import videoViralIAConfig from './video-viral-ia.config'
import signalOutreachConfig from './signal-outreach.config'
import seoSeedKeywordsConfig from './seo-seed-keywords.config'
import linkedinPostGeneratorConfig from './linkedin-post-generator.config'
import githubForkToCrmConfig from './github-fork-to-crm.config'

// Registry of all playbook configurations
export const playbookConfigs: Record<string, PlaybookConfig> = {
  niche_finder: nicheFinderConfig,
  video_viral_ia: videoViralIAConfig,
  'signal-outreach': signalOutreachConfig,
  'seo-seed-keywords': seoSeedKeywordsConfig,
  'linkedin-post-generator': linkedinPostGeneratorConfig,
  'github-fork-to-crm': githubForkToCrmConfig,
}

// Helper to get config by type
export function getPlaybookConfig(playbookType: string): PlaybookConfig | undefined {
  return playbookConfigs[playbookType]
}

// Export individual configs
export { nicheFinderConfig }
export { videoViralIAConfig }
export { signalOutreachConfig }
export { seoSeedKeywordsConfig }
export { linkedinPostGeneratorConfig }
export { githubForkToCrmConfig }
