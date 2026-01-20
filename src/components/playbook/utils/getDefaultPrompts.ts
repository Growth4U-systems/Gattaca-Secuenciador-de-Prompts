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

import {
  STEP_1_1_GENERATE_IDEA_PROMPT,
  STEP_2_1_GENERATE_SCENES_PROMPT,
} from '@/lib/templates/video-viral-ia-playbook'

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

  // Video Viral IA prompts
  step_1_1_generate_idea: STEP_1_1_GENERATE_IDEA_PROMPT,
  step_2_1_generate_scenes: STEP_2_1_GENERATE_SCENES_PROMPT,
  generate_idea: STEP_1_1_GENERATE_IDEA_PROMPT,
  generate_scenes: STEP_2_1_GENERATE_SCENES_PROMPT,

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

  // Need words suggestion prompt - generates single-word need keywords
  'suggest_need_words': `Eres un experto en análisis de necesidades del cliente.

Contexto:
- Producto: {{product}}
- Target: {{target}}

Tu tarea es identificar las NECESIDADES DE VIDA que el producto "{{product}}" resuelve para "{{target}}".

NO pienses en funcionalidades del producto. Piensa en las necesidades humanas o de negocio que satisface.

**Ejemplo - Banco digital:**
- Necesidad: gestionar su dinero → Palabra: "dinero"
- Necesidad: ahorrar para el futuro → Palabra: "ahorro"
- Necesidad: pagar cuentas → Palabra: "pago"
- Necesidad: transferir a otros → Palabra: "transferencia"
- Necesidad: invertir ahorros → Palabra: "inversión"
- Necesidad: cobrar salario → Palabra: "sueldo"
- Necesidad: financiar compra → Palabra: "préstamo"

**Instrucciones:**
1. Analiza qué necesidades de la vida cotidiana o del negocio resuelve "{{product}}"
2. Para cada necesidad, extrae UNA SOLA PALABRA que la represente
3. Las palabras deben ser sustantivos comunes que la gente usa al hablar de esas necesidades
4. Genera entre 10-20 palabras

IMPORTANTE: Responde SOLO con un JSON array de objetos, sin texto adicional:
[
  {"id": "need_1", "label": "palabra", "description": "La necesidad que representa"},
  {"id": "need_2", "label": "otra", "description": "Qué necesidad cubre"}
]

Ejemplo de respuesta para un banco digital:
[
  {"id": "need_1", "label": "ahorro", "description": "Necesidad de guardar dinero para el futuro"},
  {"id": "need_2", "label": "pago", "description": "Necesidad de pagar cuentas y servicios"},
  {"id": "need_3", "label": "transferencia", "description": "Necesidad de enviar dinero a otros"},
  {"id": "need_4", "label": "inversión", "description": "Necesidad de hacer crecer el dinero"},
  {"id": "need_5", "label": "sueldo", "description": "Necesidad de cobrar y gestionar ingresos"},
  {"id": "need_6", "label": "préstamo", "description": "Necesidad de financiación"},
  {"id": "need_7", "label": "tarjeta", "description": "Necesidad de medio de pago"},
  {"id": "need_8", "label": "hipoteca", "description": "Necesidad de financiar vivienda"}
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
