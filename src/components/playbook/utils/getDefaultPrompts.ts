/**
 * Utility to get default prompts from playbook templates
 *
 * This maps promptKey values from playbook configs to actual prompts
 * from the template files, providing fallback values when database
 * doesn't have customized prompts.
 */

import {
  STEP_1_FIND_PROBLEMS_PROMPT,
  STEP_2_CLEAN_FILTER_PROMPT,
  STEP_3_SCORING_PROMPT,
  STEP_4_CONSOLIDATE_PROMPT,
} from '@/lib/templates/niche-finder-playbook'

// Mapping of promptKey to actual prompt content
const PROMPT_KEY_MAP: Record<string, string> = {
  // Niche Finder prompts
  'step_1_find_problems': STEP_1_FIND_PROBLEMS_PROMPT,
  'step_2_clean_filter': STEP_2_CLEAN_FILTER_PROMPT,
  'step_3_scoring': STEP_3_SCORING_PROMPT,
  'step_4_consolidate': STEP_4_CONSOLIDATE_PROMPT,

  // Legacy ID formats (for backward compatibility)
  'step-1-find-problems': STEP_1_FIND_PROBLEMS_PROMPT,
  'step-2-clean-filter': STEP_2_CLEAN_FILTER_PROMPT,
  'step-3-scoring': STEP_3_SCORING_PROMPT,
  'step-4-consolidate': STEP_4_CONSOLIDATE_PROMPT,

  // Config step IDs mapped to prompts
  'extract_problems': STEP_1_FIND_PROBLEMS_PROMPT,
  'clean_filter': STEP_2_CLEAN_FILTER_PROMPT,
  'deep_research_manual': STEP_3_SCORING_PROMPT,
  'consolidate': STEP_4_CONSOLIDATE_PROMPT,

  // Forum suggestion prompt (still uses LLM)
  'suggest_forums': `Sugiere fuentes de datos para buscar conversaciones relevantes sobre {{product}} para el target {{target}}.

Incluye:
1. Subreddits relevantes (r/spain, r/autonomos, etc.)
2. Foros temáticos de la industria {{industry}}
3. Foros generales españoles

Formato de salida (JSON):
{
  "reddit": {
    "enabled": true,
    "subreddits": ["spain", "autonomos", "emprendedores"]
  },
  "thematic_forums": {
    "enabled": true,
    "forums": ["foro.autonomos.com", "etc"]
  },
  "general_forums": {
    "enabled": true,
    "forums": ["forocoches.com", "mediavida.com"]
  }
}`,
}

/**
 * Get default prompt for a given promptKey
 */
export function getDefaultPrompt(promptKey: string): string {
  return PROMPT_KEY_MAP[promptKey] || ''
}

/**
 * Get default prompt for a step, checking both promptKey and step.id
 */
export function getDefaultPromptForStep(
  stepId: string,
  promptKey?: string
): string {
  // First try promptKey if provided
  if (promptKey && PROMPT_KEY_MAP[promptKey]) {
    return PROMPT_KEY_MAP[promptKey]
  }

  // Then try step ID
  if (PROMPT_KEY_MAP[stepId]) {
    return PROMPT_KEY_MAP[stepId]
  }

  return ''
}

/**
 * Check if a promptKey has a default prompt available
 */
export function hasDefaultPrompt(promptKey: string): boolean {
  return !!PROMPT_KEY_MAP[promptKey]
}

export default PROMPT_KEY_MAP
