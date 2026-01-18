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

  // Life contexts suggestion prompt
  'suggest_life_contexts': `Eres un experto en identificación de nichos de mercado.

Contexto del producto/servicio:
- Producto: {{product}}
- Target: {{target}}
- Tipo de cliente: {{context_type}}

Tu tarea es generar una lista de SITUACIONES DE VIDA o NEGOCIO donde una persona podría necesitar lo que este producto resuelve.

{{#if context_type === 'personal' || context_type === 'both'}}
Para B2C (Personal), piensa en momentos vitales como:
- Cambios familiares (bebé, casamiento, divorcio)
- Cambios de vivienda (mudanza, compra de casa)
- Cambios financieros (herencia, jubilación)
- Cambios laborales (ascenso, primer trabajo)
- Etapas de vida (universidad, pareja, hijos)
{{/if}}

{{#if context_type === 'business' || context_type === 'both'}}
Para B2B (Empresas), piensa en situaciones de negocio como:
- Etapa del negocio (startup, pyme, expansión)
- Tipo de profesional (freelance, autónomo, consultor)
- Eventos de negocio (contratación, inversión, adquisición)
- Desafíos operativos (facturación, impuestos, clientes)
{{/if}}

Genera entre 10-15 contextos relevantes para el producto "{{product}}" y el target "{{target}}".

IMPORTANTE: Responde SOLO con un JSON array de objetos, sin texto adicional:
[
  {"id": "contexto_1", "label": "Nombre del contexto", "description": "Breve descripción de por qué es relevante"},
  {"id": "contexto_2", "label": "Otro contexto", "description": "Por qué aplica"}
]`,

  // Need words suggestion prompt
  'suggest_need_words': `Eres un experto en copywriting y análisis de necesidades del cliente.

Contexto:
- Producto: {{product}}
- Target: {{target}}
- Contextos de vida seleccionados: {{life_contexts}}

Tu tarea es generar PALABRAS DE NECESIDAD que representan los problemas, deseos o frustraciones que el producto "{{product}}" resuelve.

Estas palabras se usarán para buscar conversaciones en foros donde la gente expresa estos problemas.

Categorías de palabras a considerar:
1. **Palabras de dolor**: frustración, problema, no sé cómo, necesito ayuda con...
2. **Palabras de deseo**: quiero, busco, me gustaría, ojalá pudiera...
3. **Palabras de acción**: cómo hacer, consejos para, recomendaciones de...
4. **Palabras de urgencia**: urgente, cuanto antes, ya no aguanto...

Genera entre 10-20 palabras o frases cortas relevantes para las necesidades que "{{product}}" resuelve en el contexto de "{{target}}".

IMPORTANTE: Responde SOLO con un JSON array de objetos, sin texto adicional:
[
  {"id": "need_1", "label": "palabra o frase", "description": "Tipo de necesidad que representa"},
  {"id": "need_2", "label": "otra palabra", "description": "Qué problema indica"}
]`,
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
