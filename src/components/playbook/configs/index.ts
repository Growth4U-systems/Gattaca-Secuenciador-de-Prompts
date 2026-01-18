// Playbook configurations
// Each playbook type has its own configuration file that defines phases, steps, and behavior

import { PlaybookConfig } from '../types'
import nicheFinderConfig from './niche-finder.config'

// Registry of all playbook configurations
export const playbookConfigs: Record<string, PlaybookConfig> = {
  niche_finder: nicheFinderConfig,
}

// Helper to get config by type
export function getPlaybookConfig(playbookType: string): PlaybookConfig | undefined {
  return playbookConfigs[playbookType]
}

// Export individual configs
export { nicheFinderConfig }
