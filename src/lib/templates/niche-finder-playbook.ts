/**
 * Niche Finder Playbook Template
 * "Buscador de Nichos 100x" - Full playbook configuration
 */

import type { ScraperStepConfig } from '@/types/scraper.types'

/**
 * Default extraction prompt for Step 0 (Scraper)
 */
export const EXTRACTION_PROMPT = `ROLE: Customer Research Analyst and Product Strategist

PRODUCTO: {{product}}
TARGET: {{target}}
INDUSTRIA: {{industry}}
EMPRESA: {{company_name}}

CONTENIDO DE FORO:
{{content}}

INSTRUCCIÓN:
1. Lee la conversación completa con atención
2. Identifica si hay un PAIN POINT relevante para el producto/industria
3. Si la conversación NO es relevante al producto/target, responde SOLO: "IGNORAR"
4. Si ES relevante, extrae nichos en formato CSV

CRITERIOS DE RELEVANCIA:
- El problema debe estar relacionado con {{industry}} o necesidades que {{product}} podría resolver
- El problema debe ser funcional y solucionable (no solo emocional)
- Debe haber evidencia clara en el texto (citas, quejas específicas)

FORMATO DE OUTPUT (si es relevante):
"Problem";"Persona";"Functional Cause";"Emotional Load";"Evidence";"Alternatives";"URL"

CAMPOS:
- Problem: Pain point en formato "Cuando [contexto], me frustro por [obstáculo], lo que me impide [resultado]"
- Persona: Tipo de usuario específico con contexto (ej: "Autónomo que acaba de darse de alta")
- Functional Cause: Raíz del problema (burocracia, falta de automatización, falta de información)
- Emotional Load: Estrés, confusión, frustración visible en el texto
- Evidence: 2-3 citas literales del texto separadas por |
- Alternatives: Soluciones actuales mencionadas (Excel, manual, otra app)
- URL: URL de la fuente

IMPORTANTE:
- Solo extrae nichos que tengan EVIDENCIA CLARA en el texto
- No inventes información ni completes campos sin datos
- Si hay múltiples nichos distintos, genera múltiples líneas CSV
- Si el contenido no es relevante, responde SOLO "IGNORAR"
`

/**
 * Step 1: Clean & Filter Niches
 */
export const STEP_1_CLEAN_FILTER_PROMPT = `ROLE: Expert Product Strategist and Niche Validator

INPUT: CSV table of raw niches extracted from forums

OBJETIVO: Filtrar, consolidar y reducir a 30-50 nichos viables (Valid = TRUE)

PROCESO DE 4 PASOS:

1. CONSOLIDATE AND REFINE (Merge & Validity)
   - Unificar Problem + Functional Cause en "Unified Problem Statement" (1ra persona)
   - Merge nichos similares (sin perder especificidad)
   - Invalidar nichos demasiado genéricos → Valid = FALSE, Reason: "Lack of Specificity"

2. APPLY DISCARD CRITERIA (Validation)
   - Low Financial Viability: ingresos < €300/mes
   - Low Digital Maturity: usuarios offline/cash-reliant
   - Non-Viable Product Fit (si hay DOC_FUNCTIONALITIES)
   - Non-Strategic Alignment (si hay DOC_STRATEGIC_SEGMENTS)

3. CATEGORIZE (para Valid = TRUE)
   Categorías posibles:
   - Income Chaos
   - Expense Chaos
   - Shared Expense Chaos
   - Compliance Chaos
   - Payment Friction
   - Administrative Overload
   - Financial Visibility Gap

4. CONNECT TO PRODUCT & DEFINE GTM
   - Why {{company_name}}? (max 30 palabras)
   - Positioning and Messaging (max 15 palabras)

OUTPUT: Markdown table con 14 columnas:
| Niche_ID | Valid | Reason for Invalidation | Category | Niche (Consolidated) | Unified Problem Statement | Why {{company_name}}? | Persona (Example) | Emotional Load | Alternatives | Tentative Marketing Channels | Positioning and Messaging | Reference URLs | Notes |

REGLAS:
- Mantener entre 30-50 nichos con Valid = TRUE
- Ser específico, no genérico
- Cada nicho debe tener evidencia real
`

/**
 * Step 2: Scoring (Deep Research)
 */
export const STEP_2_SCORING_PROMPT = `Rol: Analista de estrategia de mercado de élite con conocimiento granular del mercado de {{country}}

INDUSTRIA: {{industry}}
PAÍS: {{country}}
PRODUCTO: {{product}}

Para CADA NICHO de la tabla, analiza de forma INDIVIDUAL (no comparativa):

## 1. PAIN SCORE (2-99)
Basado en modelo JTBD (Jobs to be Done):

**Push (El Problema):**
- Utility Job: ¿Qué tarea funcional necesita resolver?
- Emotional Job: ¿Qué carga emocional genera?

**Pull (La Solución):**
- Atracción: ¿Qué tan atractiva es una solución?
- Ansiedad: ¿Qué miedos/dudas tiene al cambiar?

**Habit:**
- Fuerza del hábito actual a superar

Variables cuantitativas:
- Pérdida económica directa (€/año)
- Coste de oportunidad
- Pérdida de tiempo (horas/mes)

Variables cualitativas:
- Carga cognitiva y estrés
- Fricción y complejidad
- Obstáculos a objetivos vitales
- Impacto social/profesional
- Frecuencia e inevitabilidad

## 2. MARKET SIZE (SAM)
- Valor específico: "entre X y Y personas"
- Nivel de confianza: Alto/Medio/Bajo
- Métodos: Top-Down + Bottom-Up
- Fuentes: INE, Eurostat, Seguridad Social, Statista, etc.
- Tendencia: Crecimiento Acelerado/Moderado/Estable/Decrecimiento
- Competencia: quién está resolviendo el problema

## 3. REACHABILITY SCORE (2-99)
Criterios:
- Comunidades Online (foros, grupos, plataformas)
- Comunidades Físicas (eventos, lugares)
- Creadores de Contenido (influencers del nicho)
- Contenido y Palabras Clave (volumen de búsqueda)
- Complejidad del Producto
- Competencia (afecta CACs)

Canales específicos:
- Subreddits/grupos exactos con nombre
- Influencers específicos
- Táctica de ads detallada
- Partnerships estratégicos

OUTPUT por cada nicho:
\`\`\`
### [NOMBRE DEL NICHO]

**Pain Score: XX/99**
[Análisis JTBD detallado...]

**Market Size: XXX,XXX personas**
- Confianza: [Alto/Medio/Bajo]
- Método: [Top-Down/Bottom-Up]
- Tendencia: [...]
- Fuentes: [...]

**Reachability Score: XX/99**
- Comunidades: [nombres específicos]
- Influencers: [handles específicos]
- Canales: [tácticas detalladas]
\`\`\`
`

/**
 * Step 3: Consolidate Final Table
 */
export const STEP_3_CONSOLIDATE_PROMPT = `ROL: Agente de procesamiento de datos

OBJETIVO: Enriquecer la tabla CSV del Step 1 (Clean & Filter) con datos del Step 2 (Scoring)

Extraer 7 nuevas columnas del análisis de Scoring:

| Campo | Descripción |
|-------|-------------|
| Pain Score (1-100) | Score numérico del Deep Research |
| Reachability Score (1-100) | Score numérico del Deep Research |
| Market Size | Número de personas (promedio si es rango) |
| Pain (explanation) | 600-800 caracteres con causas raíz y citas |
| Reachability (explanation) | Nombres específicos de comunidades/plataformas |
| Market Size (explanation) | Cifras, fuentes, método, tendencia |
| Reachability Channels (granular) | Lista separada por comas: subreddits, handles, plataformas, entidades offline |

REGLAS DE MATCHING:
- Buscar cada nicho de Step 1 en el análisis de Step 2
- Si nicho no encontrado → todas las columnas nuevas = "Unmatched Niche"
- Si dato no encontrado → columna = "Info not found"

OUTPUT: Tabla markdown combinada con TODAS las columnas originales + 7 nuevas columnas
`

/**
 * Default scraper configuration
 */
export const DEFAULT_SCRAPER_CONFIG: Omit<ScraperStepConfig, 'life_contexts' | 'product_words'> = {
  indicators: [],
  sources: {
    reddit: true,
    thematic_forums: true,
    general_forums: ['forocoches.com', 'mediavida.com'],
  },
  serp_pages: 5,
  batch_size: 10,
  extraction_prompt: EXTRACTION_PROMPT,
  extraction_model: 'openai/gpt-4o-mini',
}

/**
 * Spanish indicators presets
 */
export const SPANISH_INDICATORS = {
  frustration: ['me frustra', 'estoy harto', 'no aguanto más', 'es una pesadilla', 'me tiene loco'],
  help: ['¿alguien sabe', 'necesito ayuda', '¿qué hago?', 'consejos para', '¿cómo puedo'],
  complaint: ['problema con', 'no puedo', 'me cuesta', 'dificultad para', 'es horrible'],
  need: ['busco alternativa', '¿hay algo mejor?', 'ojalá existiera', 'me gustaría poder', 'necesito encontrar'],
}

/**
 * Get all Spanish indicators as flat array
 */
export function getAllSpanishIndicators(): string[] {
  return Object.values(SPANISH_INDICATORS).flat()
}

/**
 * Get full playbook template configuration
 */
export function getNicheFinderPlaybookTemplate() {
  return {
    name: 'Buscador de Nichos 100x',
    description: 'Encuentra y analiza nichos de mercado desde foros y redes sociales usando combinaciones A×B',
    template_id: 'niche-finder-100x',
    steps: [
      {
        name: 'Búsqueda y Extracción',
        order: 0,
        type: 'scraper' as const,
        scraper_config: DEFAULT_SCRAPER_CONFIG,
      },
      {
        name: 'Limpiar y Filtrar Nichos',
        order: 1,
        type: 'llm' as const,
        prompt: STEP_1_CLEAN_FILTER_PROMPT,
        model: 'openai/gpt-4o-mini',
        temperature: 0.5,
        max_tokens: 8192,
      },
      {
        name: 'Scoring (Deep Research)',
        order: 2,
        type: 'llm' as const,
        prompt: STEP_2_SCORING_PROMPT,
        model: 'google/gemini-2.5-pro-preview',
        temperature: 0.8,
        max_tokens: 16384,
      },
      {
        name: 'Tabla Final Consolidada',
        order: 3,
        type: 'llm' as const,
        prompt: STEP_3_CONSOLIDATE_PROMPT,
        model: 'openai/gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 8192,
      },
    ],
  }
}
