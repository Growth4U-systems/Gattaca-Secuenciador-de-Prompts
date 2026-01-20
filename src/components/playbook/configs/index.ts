// Playbook configurations
// Each playbook type has its own configuration file that defines phases, steps, and behavior

import { PlaybookConfig } from '../types'
import nicheFinderConfig from './niche-finder.config'
import videoViralIAConfig from './video-viral-ia.config'

// Registry of all playbook configurations
export const playbookConfigs: Record<string, PlaybookConfig> = {
  niche_finder: nicheFinderConfig,
  video_viral_ia: videoViralIAConfig,
}

// Helper to get config by type
export function getPlaybookConfig(playbookType: string): PlaybookConfig | undefined {
  return playbookConfigs[playbookType]
}

// Export individual configs
export { nicheFinderConfig }
export { videoViralIAConfig }
