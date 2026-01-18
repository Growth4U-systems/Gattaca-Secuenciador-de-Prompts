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

  // Suggestion prompts for configuration phase
  'suggest_life_contexts': `Genera una lista de 10-15 contextos de vida relevantes para el target {{target}} en la industria {{industry}}.

Contextos de vida son situaciones específicas donde el cliente potencial podría necesitar el producto {{product}}.

Formato de salida (JSON array):
[
  { "id": "contexto-1", "label": "Descripción del contexto", "selected": true },
  { "id": "contexto-2", "label": "Descripción del contexto", "selected": true },
  ...
]

Ejemplos de contextos de vida para autónomos:
- "Primer año como autónomo"
- "Expansión a nuevos clientes"
- "Gestión de impuestos trimestrales"
- "Contratación del primer empleado"

Genera contextos específicos y accionables, no genéricos.`,

  'suggest_product_words': `Genera una lista de 15-20 palabras clave relacionadas con el producto {{product}} y las necesidades del target {{target}}.

Estas palabras se usarán para buscar conversaciones en foros donde la gente habla de estos temas.

Formato de salida (JSON array):
[
  { "id": "palabra-1", "label": "palabra clave", "selected": true },
  { "id": "palabra-2", "label": "palabra clave", "selected": true },
  ...
]

Las palabras deben ser:
- Términos que la gente usa en conversaciones reales
- Relacionadas con problemas que el producto resuelve
- Una mezcla de términos técnicos y coloquiales`,

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
