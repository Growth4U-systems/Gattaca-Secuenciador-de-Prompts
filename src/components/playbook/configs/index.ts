// Playbook configurations
// Each playbook type has its own configuration file that defines phases, steps, and behavior

import { PlaybookConfig } from '../types'
import nicheFinderConfig from './niche-finder.config'
import videoViralIAConfig from './video-viral-ia.config'
import signalOutreachConfig from './signal-outreach.config'
import seoSeedKeywordsConfig from './seo-seed-keywords.config'
import linkedinPostGeneratorConfig from './linkedin-post-generator.config'
import githubForkToCrmConfig from './github-fork-to-crm.config'
import competitorAnalysisConfig from './competitor-analysis.config'

// Registry of all playbook configurations
export const playbookConfigs: Record<string, PlaybookConfig> = {
  niche_finder: nicheFinderConfig,
  video_viral_ia: videoViralIAConfig,
  'signal-outreach': signalOutreachConfig,
  'seo-seed-keywords': seoSeedKeywordsConfig,
  'linkedin-post-generator': linkedinPostGeneratorConfig,
  'github-fork-to-crm': githubForkToCrmConfig,
  'competitor-analysis': competitorAnalysisConfig,
  'competitor_analysis': competitorAnalysisConfig, // Also register with underscore for compatibility
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
export { competitorAnalysisConfig }

// Export competitor analysis document requirements config
export {
  COMPETITOR_ANALYSIS_STEP_REQUIREMENTS,
  COMPETITOR_ANALYSIS_PRESENTATION,
  AUTOPERCEPCION_DOCUMENTS,
  PERCEPCION_TERCEROS_DOCUMENTS,
  PERCEPCION_RRSS_DOCUMENTS,
  PERCEPCION_REVIEWS_DOCUMENTS,
  getAllDocumentRequirements,
  getTotalDocumentCount,
  getDocumentsByCategory,
  getDocumentsBySource,
} from './competitor-analysis.config'
