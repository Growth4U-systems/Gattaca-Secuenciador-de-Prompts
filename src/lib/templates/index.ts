/**
 * Playbook Templates Index
 * Centralized export of all playbook templates
 */

import type { PlaybookTemplate } from './types'
import { getECPPositioningTemplate } from './ecp-positioning-playbook'
import { getNicheFinderPlaybookTemplate } from './niche-finder-playbook'
import { getCompetitorAnalysisTemplate } from './competitor-analysis-playbook'

// Re-export types
export * from './types'

// Re-export individual template getters
export { getECPPositioningTemplate } from './ecp-positioning-playbook'
export { getNicheFinderPlaybookTemplate } from './niche-finder-playbook'
export { getCompetitorAnalysisTemplate } from './competitor-analysis-playbook'

// Re-export scraper utilities from niche finder
export {
  EXTRACTION_PROMPT,
  DEFAULT_SCRAPER_CONFIG,
  SPANISH_INDICATORS,
  getAllSpanishIndicators,
} from './niche-finder-playbook'

/**
 * Playbook type literals
 */
export type PlaybookType = 'ecp' | 'niche_finder' | 'competitor_analysis'

/**
 * Get a playbook template by type
 * @param type - The playbook type
 * @returns The template or null if not found
 */
export function getPlaybookTemplate(type: PlaybookType | string): PlaybookTemplate | null {
  switch (type) {
    case 'ecp':
      return getECPPositioningTemplate()
    case 'niche_finder':
      return getNicheFinderPlaybookTemplate()
    case 'competitor_analysis':
      return getCompetitorAnalysisTemplate()
    default:
      console.warn(`Unknown playbook type: ${type}`)
      return null
  }
}

/**
 * Get all available playbook templates
 * @returns Array of all templates
 */
export function getAllPlaybookTemplates(): PlaybookTemplate[] {
  return [
    getECPPositioningTemplate(),
    getNicheFinderPlaybookTemplate(),
    getCompetitorAnalysisTemplate(),
  ]
}

/**
 * Get template metadata (without full flow config)
 * Useful for listing templates in UI
 */
export function getPlaybookTemplatesMeta(): Array<{
  template_id: string
  name: string
  description: string
  playbook_type: string
  step_count: number
  variable_count: number
}> {
  return getAllPlaybookTemplates().map((template) => ({
    template_id: template.template_id,
    name: template.name,
    description: template.description,
    playbook_type: template.playbook_type,
    step_count: template.flow_config.steps.length,
    variable_count: template.variable_definitions.length,
  }))
}

/**
 * Check if a playbook type has a template
 */
export function hasPlaybookTemplate(type: string): boolean {
  return ['ecp', 'niche_finder', 'competitor_analysis'].includes(type)
}

/**
 * Get default flow config for a playbook type
 * This is used when creating new projects
 */
export function getDefaultFlowConfig(type: PlaybookType | string): { steps: unknown[] } {
  const template = getPlaybookTemplate(type)
  if (template) {
    return {
      steps: template.flow_config.steps,
    }
  }
  return { steps: [] }
}

/**
 * Get default variable definitions for a playbook type
 */
export function getDefaultVariableDefinitions(type: PlaybookType | string) {
  const template = getPlaybookTemplate(type)
  if (template) {
    return template.variable_definitions
  }
  return []
}
