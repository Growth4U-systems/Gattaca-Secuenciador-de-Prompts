/**
 * Niche Finder Playbook Template
 * "Buscador de Nichos 100x" - Full playbook configuration
 *
 * Based on real campaign flow_config from production database
 */

import type { PlaybookTemplate, VariableDefinition } from './types'
import type { FlowStep } from '@/types/flow.types'
import type { ScraperStepConfig } from '@/types/scraper.types'

// ============================================
// STEP PROMPTS (from real campaigns)
// ============================================

/**
 * Step 1: Find problems on Forums
 */
export const STEP_1_FIND_PROBLEMS_PROMPT = `ROLE
You are a Customer Research Analyst and Product Strategist working for a company in the {{industry}} industry.

CONTEXT — PRODUCT & MARKET
Category: {{category}}
Product Description: {{product}}
Target Audience: {{target}}

Your responsibility is to analyze forum conversations and determine whether they describe a functional, solvable problem that falls within the scope of this company's product and audience.

You must:
Extract precise, structured insights only when the pain discussed could plausibly be addressed by this product or service and filter out irrelevant or unrelated conversations.

STEP 1 — RELEVANCE CHECK
Before extracting any information, always follow this logic:

1. Read the entire conversation carefully.
2. Identify the main issue, friction, or recurring pain point.
3. Ask yourself: Is this problem related to {{category}} or connected to the functional space that {{product}} operates in?
4. Could {{company_name}} reasonably help or solve this type of problem for {{target}}?

If the answer is NO, output exactly: "IGNORAR" and stop here.

5. Only continue if the conversation clearly reflects a functional, operational, or financial challenge that aligns with the business scope.

STEP 2 — STRUCTURED EXTRACTION
If the conversation is relevant, extract one or more insights, with one line per distinct persona/problem pair, using this exact format:

"Problem";"Persona";"Functional Cause";"Emotional or Cognitive Load";"Evidence";"Alternatives";"URLs"

FIELD DEFINITIONS

Problem:
Describe the functional, solvable pain point. Focus on actions or tasks (e.g., paying taxes, managing invoices, receiving payments), not feelings.

Persona:
Define the type of user or business context (e.g., freelancer, family, small business, designer, expatriate).

Functional Cause:
Explain the root process, dependency, or system that creates the problem (e.g., bureaucracy, lack of automation, poor UX, regulation).

Emotional or Cognitive Load:
Describe the stress, confusion, or mental load clearly visible in the text. Only include what is explicitly mentioned or strongly implied.

Evidence:
Include two or three literal quotes from the conversation that best illustrate the problem, separated by "|".

Alternatives:
List the current workaround, tool, or method the user mentions (e.g., Excel, manual accounting, multiple accounts).

URLs:
Include the forum link or source where the conversation originated.

STEP 3 — OUTPUT RULES
- One line per distinct persona/problem.
- Exactly 7 quoted fields, separated by semicolons (;).
- Do not include headers, bullet points, or explanations.
- If no relevant problems are found, output only the word IGNORAR.
- Do not infer or invent missing information — use only what appears in the conversation.
- All text must be on a single line per record; no line breaks inside quoted text.

STEP 4 — QUALITY CHECK BEFORE OUTPUT
Before finalizing your output, confirm that:
- The problem could reasonably be solved by a product like {{product}}.
- The persona aligns with {{target}}.
- The evidence supports the described pain point.

If any of these fail, do not output anything except IGNORAR.`

/**
 * Step 2: Clean & Filter Niches
 */
export const STEP_2_CLEAN_FILTER_PROMPT = `<INSTRUCTIONS>
ROLE AND GOAL
You are an **Expert Product Strategist and Niche Validator**.
You work for {{company_name}} in the {{industry}} industry.
Your goal is to process a structured list of potential market niches (ECPs) and output a single, filtered, consolidated Markdown table.
You **MUST** filter, merge, and structure the list to a final count of **30-50 viable entries (Valid = TRUE)**.
Merge duplicates, refine definitions, and keep **ONLY** niches that are specific, reachable, and commercially relevant.

**PRIME DIRECTIVE: ABSOLUTE DATA ISOLATION**
YOU MUST NOT USE ANY EXTERNAL KNOWLEDGE, OPINIONS, OR DATA FROM OUTSIDE THE THREE PROVIDED DOCUMENTS. ALL FIELD VALUES, INCLUDING THE "WHY {{company_name}}?" SECTION, MUST BE JUSTIFIED PURELY BY THE INPUT CONTENT.

<INPUT_DATA>
All evidence (quotes, URLs) is in the input document. Do not use external knowledge.

DOC_ECP_FILTERED: A structured table of potential ECPs. Contains columns: Problem, Functional Cause, Emotional or Cognitive Load, Evidence, Alternatives, URLs.
DOC_FUNCTIONALITIES (Optional): A list of the company's current and near-term product capabilities. If NOT provided: Skip product-fit validation (Step 2.C).
DOC_STRATEGIC_SEGMENTS (Optional): A list of company's strategic focus areas. If NOT provided: Skip strategic-alignment validation (Step 2.D).
</INPUT_DATA>

<STEP_BY_STEP_PROCESSING>
STEP 1: CONSOLIDATE AND REFINE (MERGING & VALIDITY LOGIC)
1A. Unify Problem:
Combine the Problem and Functional Cause fields into a single **Unified Problem Statement**.
**Rule:** This new statement **MUST** capture the acute pain point (the trigger and mechanism).
**Rule:** This new statement **MUST** be written in the first person.

1B. Merge Similar Niches:
Merge rows that represent the same fundamental problem under similar circumstances.
**CRITICAL MERGE RULE:** DO NOT MERGE if the resulting niche definition becomes **less specific** or the underlying persona context is significantly different.

1C. Enforce Specificity (CRITICAL VALIDITY CHECK):
Mark any niche as **Valid = FALSE** if its definition is too broad, emotional, or unspecific.
**IF INVALIDATED HERE, USE REASON: "Lack of Specificity."**

STEP 2: APPLY DISCARD CRITERIA (VALIDATION)
2A. Low Financial Viability / Overlap:
Condition: Users with negligible income (< €300/month) or low commercial potential.
**REASON:** Low Viability/Persona Overlap.

2B. Low Digital Maturity / High Adoption Barrier:
Condition: Cash-reliant, offline, or unprofessionalized users.
**REASON:** "Long-term Potential Only".

2C. Non-Viable Product Fit (Optional Check):
Apply **ONLY** if DOC_FUNCTIONALITIES was provided.
**REASON:** Non-Viable Product Fit.

2D. Non-Strategic Alignment (Optional Check):
Apply **ONLY** if DOC_STRATEGIC_SEGMENTS was provided.
**REASON:** Non-Strategic Alignment.

STEP 3: CATEGORIZE (FOR VALID NICHES)
Categories: Income Chaos, Expense Chaos, Shared Expense Chaos, Compliance Chaos, Payment Friction, Administrative Overload, Financial Visibility Gap.

STEP 4: CONNECT TO PRODUCT & DEFINE GTM (FOR VALID NICHES)
- **Why {{company_name}}?** Max 30 words.
- **Positioning and Messaging** Max 15 words.
</STEP_BY_STEP_PROCESSING>

<OUTPUT_FORMAT_RULES>
**CRITICAL:** Your output MUST be **ONLY** the Markdown table.

A. TABLE STRUCTURE (14 columns):
| Niche_ID | Valid | Reason for Invalidation | Category | Niche (Consolidated) | Unified Problem Statement (first-person) | Why {{company_name}}? | Persona (Example) | Emotional Load | Alternatives | Tentative Marketing Channels | Positioning and Messaging | Reference URLs | Notes |

B. FIELD CONTENT RULES
- **Niche_ID:** Generate deterministically using keywords (lowercase, hyphenated).
- **Valid:** TRUE or FALSE.
- Include All Rows from input.
</OUTPUT_FORMAT_RULES>
</INSTRUCTIONS>`

/**
 * Step 3: Scoring (Deep Research)
 */
export const STEP_3_SCORING_PROMPT = `Rol: Eres un analista de estrategia de mercado de élite, con especialización en go to market en la industria {{industry}} y tienes un conocimiento granular del mercado de {{country}}. Tu metodología combina el análisis de datos riguroso con una profunda comprensión de la psicología del consumidor.

Objetivo: Realizar una investigación exhaustiva y multidimensional de cada nicho de mercado presentado. El objetivo final es generar un informe de viabilidad individual e independiente para cada nicho.

Regla Mandatoria: El análisis debe ser estrictamente individual. Está terminantemente prohibido agrupar, resumir o comparar nichos. Cada nicho debe ser tratado como un informe de viabilidad completamente autónomo.

Input de Datos:
Columna a filtrar: "Valid" (analiza solamente los nichos donde sea igual a "TRUE")
Columna a Analizar: "Niche (Consolidated)"

PARA CADA NICHO, GENERA EL SIGUIENTE ANÁLISIS:

## [Nombre del Nicho]

### 1. Intensidad del Dolor (Pain Score)
**Calificación: [2-99] / 100**

Evaluación basada en Jobs to be Done (Push, Pull, Habit, Anxiety):
- **Push (El Problema):**
  - Utility Job: ¿Cuál es la gravedad funcional?
  - Emotional Job: ¿Cuál es la gravedad emocional?
- **Product Fit (La Solución):**
  - Pull y Anxiety

Variables Cuantitativas:
- Pérdida Económica Directa (€/año)
- Coste de Oportunidad
- Pérdida de Tiempo (horas/mes)

Variables Cualitativas:
- Carga Cognitiva y Estrés
- Fricción y Complejidad
- Obstáculos a Objetivos Vitales
- Impacto Social o Profesional
- Frecuencia e Inevitabilidad

### 2. Tamaño del Mercado (Market Size)
**SAM Estimado: [número] personas en {{country}}**

- Nivel de Confianza: [Alto/Medio/Bajo]
- Método: Top-Down + Bottom-Up
- Fuentes: INE, Eurostat, Seguridad Social, Statista, etc.
- Tendencia: [Crecimiento Acelerado/Moderado/Estable/Decrecimiento]
- Competencia: ¿Quién está resolviendo esto ahora?

### 3. Reachability Score
**Calificación: [2-99] / 100**

Criterios:
- Comunidades Online (foros, grupos, plataformas específicas)
- Comunidades Físicas (eventos, lugares)
- Creadores de Contenido (influencers del nicho)
- Contenido y Palabras Clave
- Complejidad del Producto
- Competencia (afecta CACs)

Canales específicos:
- Subreddits/grupos exactos con nombre
- Influencers específicos con handle
- Táctica de ads detallada
- Partnerships estratégicos

---
Para cada nicho incluir:
- Pain Score (2-99)
- Reachability Score (2-99)
- Market Size (número de personas)
- Pain Explanation
- Reachability Explanation
- Market Size Explanation`

/**
 * Step 4: Consolidate Final Table
 */
export const STEP_4_CONSOLIDATE_PROMPT = `**ROL:** Eres un agente de procesamiento de datos especializado en la extracción y consolidación de información estructurada. Tu tarea es enriquecer una tabla CSV existente con datos extraídos del documento de Scoring.

**OBJETIVO:** Crear una tabla final consolidada que combine los datos del archivo base con los nuevos campos extraídos de la fuente de datos.

### INSTRUCCIONES SECUENCIALES:

**PASO 1: Procesamiento por Fila (Nicho)**
1. Para cada fila (nicho) en el archivo base, localiza la sección correspondiente en el documento de Scoring.
2. Si no encuentras una sección que coincida exactamente, completa TODAS las nuevas columnas con **"Unmatched Niche"**.
3. Si encuentras el nicho, procede a extraer las 7 nuevas columnas.

**PASO 2: Extracción y Mapeo de Campos**

1. **Pain Score (1–100):**
   Localiza el score numérico exacto y transcríbelo.

2. **Reachability Score (1–100):**
   Localiza el score numérico exacto y transcríbelo.

3. **Market Size (número de personas):**
   - Si encuentras un rango (ej. "180.000–250.000"), calcula el promedio.
   - Si encuentras una cifra única, transcríbela directamente.
   - Si no hay número, escribe **"Not specified"**.

4. **Pain (explanation):**
   Extrae las descripciones sobre causas raíz, consecuencias económicas y emocionales.
   **Restricción:** 600-800 caracteres.

5. **Reachability (explanation):**
   Extrae las justificaciones incluyendo nombres específicos de comunidades, plataformas, eventos.

6. **Market Size (explanation):**
   Incluye cifras, fuentes citadas, método de cálculo, tendencia del mercado.

7. **Reachability Channels (granular):**
   Lista separada por comas de todos los canales específicos:
   - Subreddits: r/autonomos, r/spain
   - Handles: @usuario_ejemplo
   - Plataformas: Reddit, LinkedIn, Instagram
   - Entidades offline: Asociaciones, eventos, conferencias

**PASO 3: Creación de la Tabla Final**
1. Genera una única tabla consolidada en Markdown.
2. Incluye TODAS las columnas originales + las 7 nuevas columnas.
3. No omitas ninguna fila.

### FORMATO DE SALIDA:
- Tabla Markdown únicamente.
- No incluyas texto introductorio ni conclusiones.`

// ============================================
// VARIABLE DEFINITIONS
// ============================================

export const NICHE_FINDER_VARIABLE_DEFINITIONS: VariableDefinition[] = [
  {
    name: 'product',
    default_value: '',
    required: true,
    description: 'Nombre del producto o servicio a posicionar',
  },
  {
    name: 'target',
    default_value: '',
    required: true,
    description: 'Audiencia objetivo principal (ej: "autónomos", "pymes", "freelancers")',
  },
  {
    name: 'industry',
    default_value: '',
    required: true,
    description: 'Industria o sector del mercado',
  },
  {
    name: 'company_name',
    default_value: '',
    required: true,
    description: 'Nombre de la empresa',
  },
  {
    name: 'country',
    default_value: 'España',
    required: true,
    description: 'País objetivo para el análisis de mercado',
  },
  {
    name: 'category',
    default_value: '',
    required: false,
    description: 'Categoría de producto (ej: "fintech", "banca digital")',
  },
  {
    name: 'life_contexts',
    default_value: '',
    required: false,
    description: 'Contextos de vida del target (ej: "primer año autónomo", "expansión negocio")',
  },
  {
    name: 'product_words',
    default_value: '',
    required: false,
    description: 'Palabras clave del producto para búsqueda (ej: "facturación", "contabilidad")',
  },
]

// ============================================
// SCRAPER CONFIGURATION
// ============================================

/**
 * Default extraction prompt for scraper step
 */
export const EXTRACTION_PROMPT = STEP_1_FIND_PROBLEMS_PROMPT

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
 * Life contexts (situaciones de vida) - used for search query combinations
 */
export const LIFE_CONTEXTS = {
  personal: [
    'bebé', 'casamiento', 'divorcio', 'mudanza', 'viaje',
    'herencia', 'ascenso', 'compra de casa', 'jubilación',
    'vivir con amigos', 'hobbies', 'pareja', 'hijos',
    'universidad', 'primer trabajo', 'emprender',
  ],
  business: [
    'expansión', 'cliente', 'factura', 'hacienda',
    'adquisición', 'compra', 'impuestos', 'contratación',
    'startup', 'freelance', 'pyme', 'autónomo',
    'socio', 'inversión', 'cierre', 'apertura',
  ],
}

/**
 * Need words (palabras de necesidad) - customer needs that the product solves
 * These combine with life contexts to create search queries
 */
export const NEED_WORDS = {
  financial: [
    'cuenta', 'dinero', 'ahorro', 'préstamo', 'crédito',
    'tarjeta', 'transferencia', 'pago', 'cobro', 'deuda',
  ],
  operational: [
    'gestión', 'organización', 'control', 'seguimiento',
    'automatización', 'simplificar', 'optimizar', 'planificar',
  ],
  compliance: [
    'impuestos', 'facturación', 'contabilidad', 'declaración',
    'IVA', 'IRPF', 'hacienda', 'seguridad social', 'autónomo',
  ],
  growth: [
    'crecer', 'escalar', 'expandir', 'mejorar', 'aumentar',
    'invertir', 'financiar', 'capitalizar',
  ],
}

/**
 * Get life contexts by type
 */
export function getLifeContexts(type: 'personal' | 'business' | 'both' = 'both'): string[] {
  if (type === 'personal') return LIFE_CONTEXTS.personal
  if (type === 'business') return LIFE_CONTEXTS.business
  return [...LIFE_CONTEXTS.personal, ...LIFE_CONTEXTS.business]
}

/**
 * Get all need words as flat array
 */
export function getAllNeedWords(): string[] {
  return Object.values(NEED_WORDS).flat()
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

// ============================================
// FLOW STEPS (matching real campaign structure)
// ============================================

export const NICHE_FINDER_FLOW_STEPS: FlowStep[] = [
  {
    id: 'step-1-find-problems',
    name: 'Find problems on Forums',
    order: 0,
    type: 'llm',
    prompt: STEP_1_FIND_PROBLEMS_PROMPT,
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 4096,
    output_format: 'csv',
    description: 'Analizar conversaciones de foros y extraer pain points relevantes',
    base_doc_ids: [],
    auto_receive_from: [],
    retrieval_mode: 'full',
  },
  {
    id: 'step-2-clean-filter',
    name: 'Clean & Filter Niches',
    order: 1,
    type: 'llm',
    prompt: STEP_2_CLEAN_FILTER_PROMPT,
    model: 'openai/gpt-4o-mini',
    temperature: 0.5,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Consolidar, validar y categorizar nichos extraídos (30-50 válidos)',
    base_doc_ids: [],
    auto_receive_from: ['step-1-find-problems'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-3-scoring',
    name: 'Scoring',
    order: 2,
    type: 'llm',
    prompt: STEP_3_SCORING_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.8,
    max_tokens: 16384,
    output_format: 'markdown',
    description: 'Análisis profundo: Pain Score, Market Size, Reachability Score',
    base_doc_ids: [],
    auto_receive_from: ['step-2-clean-filter'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-4-consolidate',
    name: 'Consolidate Niches Final Table',
    order: 3,
    type: 'llm',
    prompt: STEP_4_CONSOLIDATE_PROMPT,
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Combinar tabla filtrada con scores del Deep Research',
    base_doc_ids: [],
    auto_receive_from: ['step-2-clean-filter', 'step-3-scoring'],
    retrieval_mode: 'full',
  },
]

// ============================================
// TEMPLATE EXPORT
// ============================================

/**
 * Get full playbook template configuration
 */
export function getNicheFinderPlaybookTemplate(): PlaybookTemplate {
  return {
    template_id: 'niche-finder-100x-v2',
    name: 'Buscador de Nichos 100x',
    description: 'Encuentra y analiza nichos de mercado desde foros y redes sociales. Extrae pain points reales, los valida, puntúa y genera una tabla final con scoring de Pain, Market Size y Reachability.',
    playbook_type: 'niche_finder',

    flow_config: {
      steps: NICHE_FINDER_FLOW_STEPS,
      version: '2.0.0',
      description: 'Niche Discovery Process - From forum analysis to scored niche table',
    },

    variable_definitions: NICHE_FINDER_VARIABLE_DEFINITIONS,

    required_documents: {
      product: [
        'Product functionalities and features',
        'Strategic market segments document',
        'Product positioning guide',
      ],
      competitor: [
        'Competitor list (optional)',
        'Market alternatives analysis',
      ],
      research: [
        'Target audience personas',
        'Market data and statistics',
        'Previous niche research (if any)',
        'Forum conversation exports',
      ],
    },

    campaign_docs_guide: `## Guía de Documentos para Buscador de Nichos

### Configuración Inicial
Antes de ejecutar, configura las variables:
- **Producto**: El nombre de tu producto/servicio
- **Target**: Tu audiencia objetivo (ej: "autónomos", "pymes")
- **Industria**: El sector (ej: "fintech", "salud")
- **País**: Para datos de mercado localizados

### Paso 1: Find problems on Forums
Sube documentos con **conversaciones de foros** o contenido extraído:
- Exports de Reddit, foros temáticos
- Capturas de conversaciones relevantes
- Contenido de redes sociales

El sistema analizará cada conversación para identificar pain points.

### Paso 2: Clean & Filter Niches
El sistema usará la extracción raw del paso anterior.
**Opcional**: Sube documentos de producto para validar product fit:
- Lista de funcionalidades
- Segmentos estratégicos

### Paso 3: Scoring
Este paso hace research profundo de cada nicho.
- Pain Score (2-99)
- Market Size
- Reachability Score (2-99)

No requiere documentos adicionales.

### Paso 4: Consolidate Niches Final Table
Consolida automáticamente los datos de pasos anteriores en una tabla final.

---
💡 **Tip**: El proceso funciona mejor con targets específicos. "Autónomos que facturan menos de 50K" es mejor que solo "autónomos".

⚠️ **Nota**: La calidad del análisis depende de la relevancia de las conversaciones de foro que subas.`,
  }
}
