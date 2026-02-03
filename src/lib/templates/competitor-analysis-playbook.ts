/**
 * Competitor Analysis Playbook Template - Version 2.0
 *
 * Análisis triangulado de competidores en 6 pasos:
 * 1. Deep Research Competidor - Investigación profunda con búsqueda web
 * 2. Autopercepción - Cómo se posiciona el competidor (7 docs scraping)
 * 3. Percepción de Terceros - Cómo lo ven medios y SEO (2 docs)
 * 4. Percepción del Consumidor RRSS - Comentarios en redes (5 docs)
 * 5. Percepción del Consumidor Reviews - Reseñas de clientes (5 docs)
 * 6. Resumen de Percepciones - Síntesis triangulada final
 *
 * Total: 19 documentos de scraping por competidor
 */

import type { PlaybookTemplate, VariableDefinition } from './types'
import type { FlowStep } from '@/types/flow.types'

// ============================================
// STEP PROMPTS - 6 STEP TRIANGULATED ANALYSIS
// ============================================

export const STEP_1_DEEP_RESEARCH_PROMPT = `Actúa como analista de inteligencia competitiva experto.

COMPETIDOR A ANALIZAR: {{competitor_name}}
INDUSTRIA: {{industry}}
PAÍS/REGIÓN: {{country}}

TAREA:
Realiza una investigación profunda del competidor {{competitor_name}} usando búsqueda web.

INVESTIGA:
1. **Información General**:
   - Historia y fundación de la empresa
   - Tamaño (empleados, revenue estimado)
   - Ubicación y mercados donde opera
   - Rondas de inversión (si aplica)

2. **Producto/Servicio**:
   - Qué ofrece exactamente
   - Modelo de negocio y pricing
   - Propuesta de valor principal
   - Integraciones y tecnología

3. **Mercado y Clientes**:
   - Segmentos objetivo
   - Casos de uso principales
   - Clientes conocidos/testimonios

4. **Presencia Digital**:
   - Website principal
   - Redes sociales activas
   - Blog/contenido educativo
   - Presencia en review sites

5. **Noticias Recientes**:
   - Lanzamientos de producto
   - Expansiones o cambios
   - Menciones en prensa

OUTPUT FORMAT:
## Deep Research: {{competitor_name}}

### Información General
[Resumen ejecutivo de la empresa]

### Producto/Servicio
[Descripción detallada de la oferta]

### Mercado y Clientes
[Análisis del target y posicionamiento]

### Presencia Digital
[Canales y estrategia de contenido]

### Noticias y Desarrollos Recientes
[Últimas novedades relevantes]

### Datos Clave para Análisis
[Bullet points de los insights más importantes]`

export const STEP_2_AUTOPERCEPCION_PROMPT = `Actúa como analista de comunicación y branding.

COMPETIDOR: {{competitor_name}}
DEEP RESEARCH PREVIO:
{{step:Deep Research Competidor}}

DOCUMENTOS DISPONIBLES:
Los documentos adjuntos contienen:
- Contenido scrapeado del website del competidor
- Posts de Facebook
- Videos/transcripciones de YouTube
- Posts de TikTok
- Posts de LinkedIn
- Insights del perfil de empresa en LinkedIn
- Posts de Instagram

TAREA:
Analiza cómo el competidor {{competitor_name}} SE PERCIBE Y SE PRESENTA A SÍ MISMO.

ANALIZA:
1. **Mensaje Central**:
   - ¿Cuál es su propuesta de valor principal?
   - ¿Qué promesa hacen a sus clientes?
   - ¿Qué problema dicen resolver?

2. **Tono y Personalidad**:
   - ¿Cómo se comunican? (formal/informal, técnico/accesible)
   - ¿Qué emociones intentan evocar?
   - ¿Cuál es su "voz" de marca?

3. **Posicionamiento Declarado**:
   - ¿Cómo se definen vs la competencia?
   - ¿Qué diferenciadores destacan?
   - ¿Qué segmento dicen atender?

4. **Consistencia entre Canales**:
   - ¿El mensaje es consistente en web, RRSS?
   - ¿Hay variaciones por canal?
   - ¿Qué canal priorizan?

5. **Contenido y Temas**:
   - ¿De qué hablan más?
   - ¿Qué temas evitan?
   - ¿Qué tipo de contenido publican?

OUTPUT FORMAT:
## Autopercepción: {{competitor_name}}

### Mensaje Central y Propuesta de Valor
[Análisis del mensaje principal]

### Tono y Personalidad de Marca
[Descripción del voice & tone]

### Posicionamiento Declarado
[Cómo se posicionan ellos mismos]

### Consistencia Cross-Channel
[Análisis de consistencia entre canales]

### Temas y Contenido Prioritario
[Qué comunican y qué evitan]

### Insights Clave de Autopercepción
[Resumen de hallazgos principales]`

export const STEP_3_PERCEPCION_TERCEROS_PROMPT = `Actúa como analista de relaciones públicas y SEO.

COMPETIDOR: {{competitor_name}}
CONTEXTO PREVIO:
{{step:Deep Research Competidor}}

DOCUMENTOS DISPONIBLES:
Los documentos adjuntos contienen:
- Datos de SEO/SERP (posicionamiento en buscadores, keywords orgánicas)
- Corpus de noticias (menciones en prensa y medios)

TAREA:
Analiza cómo TERCEROS (medios, buscadores, industria) perciben al competidor {{competitor_name}}.

ANALIZA:
1. **Visibilidad SEO**:
   - ¿Por qué keywords rankean?
   - ¿Cuál es su autoridad de dominio estimada?
   - ¿Qué términos dominan vs cuáles no?

2. **Cobertura de Medios**:
   - ¿Qué medios hablan de ellos?
   - ¿El tono es positivo, neutral o negativo?
   - ¿Qué aspectos destacan los periodistas?

3. **Reconocimiento de Industria**:
   - ¿Aparecen en rankings o premios?
   - ¿Son citados como referentes?
   - ¿Qué posición ocupan en el mercado según terceros?

4. **Narrative de Terceros**:
   - ¿Cómo los describen externamente?
   - ¿Coincide con su autopercepción?
   - ¿Hay gaps entre lo que dicen y lo que otros dicen?

OUTPUT FORMAT:
## Percepción de Terceros: {{competitor_name}}

### Visibilidad y Posicionamiento SEO
[Análisis de presencia en buscadores]

### Cobertura Mediática
[Resumen de menciones en prensa]

### Reconocimiento de Industria
[Premios, rankings, menciones como referente]

### Narrativa Externa vs Autopercepción
[Comparación de cómo los ven vs cómo se ven]

### Insights Clave de Percepción de Terceros
[Resumen de hallazgos principales]`

export const STEP_4_PERCEPCION_RRSS_PROMPT = `Actúa como analista de social listening y sentiment analysis.

COMPETIDOR: {{competitor_name}}
CONTEXTO PREVIO:
{{step:Deep Research Competidor}}
{{step:Autopercepción}}

DOCUMENTOS DISPONIBLES:
Los documentos adjuntos contienen comentarios de usuarios en:
- LinkedIn (comentarios en posts)
- Instagram (comentarios en publicaciones)
- TikTok (comentarios en videos)
- YouTube (comentarios en videos)
- Facebook (comentarios en publicaciones)

TAREA:
Analiza qué dicen los CONSUMIDORES Y USUARIOS sobre {{competitor_name}} en redes sociales.

ANALIZA:
1. **Sentimiento General**:
   - ¿Predominan comentarios positivos, negativos o neutros?
   - ¿Cuál es el engagement promedio?
   - ¿Hay defensores de marca activos?

2. **Temas Recurrentes**:
   - ¿De qué se quejan más?
   - ¿Qué elogian frecuentemente?
   - ¿Qué preguntas hacen?

3. **Pain Points Detectados**:
   - ¿Qué problemas mencionan los usuarios?
   - ¿Hay quejas recurrentes?
   - ¿Qué funcionalidades piden?

4. **Comparaciones con Competencia**:
   - ¿Mencionan alternativas?
   - ¿Cómo los comparan?
   - ¿Por qué eligieron o dejaron el producto?

5. **Análisis por Canal**:
   - ¿El sentimiento varía por red social?
   - ¿Qué canal tiene mejor/peor percepción?

OUTPUT FORMAT:
## Percepción del Consumidor (RRSS): {{competitor_name}}

### Análisis de Sentimiento General
[Resumen del sentiment predominante]

### Temas Recurrentes en Comentarios
[Qué dicen más frecuentemente]

### Pain Points y Quejas Detectadas
[Problemas mencionados por usuarios]

### Comparaciones con Competencia
[Cómo los comparan con alternativas]

### Análisis por Canal Social
[Diferencias de percepción por red]

### Insights Clave de Percepción RRSS
[Resumen de hallazgos principales]`

export const STEP_5_PERCEPCION_REVIEWS_PROMPT = `Actúa como analista de customer experience y product reviews.

COMPETIDOR: {{competitor_name}}
CONTEXTO PREVIO:
{{step:Deep Research Competidor}}
{{step:Autopercepción}}

DOCUMENTOS DISPONIBLES:
Los documentos adjuntos contienen reseñas de:
- Trustpilot
- G2 Crowd
- Capterra
- Google Play Store
- Apple App Store

TAREA:
Analiza las RESEÑAS DE CLIENTES que han usado el producto de {{competitor_name}}.

ANALIZA:
1. **Rating y Tendencia**:
   - ¿Cuál es el rating promedio por plataforma?
   - ¿La tendencia es ascendente o descendente?
   - ¿Cuántas reseñas tienen?

2. **Pros Más Mencionados**:
   - ¿Qué valoran más los clientes?
   - ¿Qué features destacan positivamente?
   - ¿Qué los hace recomendar el producto?

3. **Cons Más Mencionados**:
   - ¿Qué frustraciones tienen los usuarios?
   - ¿Qué features faltan o son débiles?
   - ¿Por qué darían malas reviews?

4. **Perfiles de Reviewers**:
   - ¿Qué tipo de empresas/usuarios reviewean?
   - ¿Hay patrones por tamaño de empresa?
   - ¿Qué casos de uso mencionan?

5. **Competencia Mencionada**:
   - ¿De qué producto migraron?
   - ¿A qué producto se van si cancelan?
   - ¿Cómo los comparan con alternativas?

OUTPUT FORMAT:
## Percepción del Consumidor (Reviews): {{competitor_name}}

### Rating y Volumen de Reviews
[Métricas por plataforma]

### Fortalezas Según Clientes
[Lo que más valoran]

### Debilidades y Frustraciones
[Quejas y features faltantes]

### Perfil de Usuarios que Reviewean
[Quiénes son y qué casos de uso tienen]

### Competencia Mencionada en Reviews
[Migraciones y comparaciones]

### Insights Clave de Reviews
[Resumen de hallazgos principales]`

export const STEP_6_RESUMEN_PERCEPCIONES_PROMPT = `Actúa como estratega de inteligencia competitiva senior.

COMPETIDOR: {{competitor_name}}
EMPRESA QUE ANALIZA: {{company_name}}

ANÁLISIS PREVIOS COMPLETOS:
1. Deep Research:
{{step:Deep Research Competidor}}

2. Autopercepción (cómo se ven ellos):
{{step:Autopercepción}}

3. Percepción de Terceros (medios y SEO):
{{step:Percepción Terceros}}

4. Percepción de Consumidores en RRSS:
{{step:Percepción del consumidor RRSS}}

5. Percepción de Consumidores en Reviews:
{{step:Percepción del consumidor Reviews}}

TAREA:
Sintetiza TODAS las percepciones anteriores en un análisis triangulado que compare cómo el competidor se ve a sí mismo vs cómo lo ven terceros y consumidores.

SINTETIZA:
1. **Triangulación de Percepciones**:
   - ¿Coincide la autopercepción con la realidad?
   - ¿Hay gaps entre lo que prometen y lo que entregan?
   - ¿La percepción de terceros coincide con la de consumidores?

2. **Fortalezas Reales** (confirmadas por múltiples fuentes):
   - ¿Qué fortalezas son consistentes entre todas las perspectivas?
   - ¿Qué ventajas competitivas son reales?

3. **Debilidades Reales** (confirmadas por múltiples fuentes):
   - ¿Qué debilidades aparecen consistentemente?
   - ¿Qué promesas no cumplen?

4. **Oportunidades para {{company_name}}**:
   - ¿Dónde puede atacar {{company_name}}?
   - ¿Qué pain points puede resolver mejor?
   - ¿Qué segmentos están desatendidos?

5. **Battle Card**:
   - Argumentos para vender contra este competidor
   - Respuestas a objeciones comunes
   - Diferenciadores clave a destacar

OUTPUT FORMAT:
## Resumen Ejecutivo: Análisis de {{competitor_name}}

### Triangulación de Percepciones
| Aspecto | Autopercepción | Terceros | Consumidores | Realidad |
|---------|---------------|----------|--------------|----------|

### Fortalezas Confirmadas
[Lo que realmente hacen bien]

### Debilidades Confirmadas
[Lo que realmente hacen mal]

### Gaps Percepción vs Realidad
[Diferencias entre lo que dicen y lo que entregan]

### Oportunidades para {{company_name}}
[Donde podemos ganarles]

---

## Battle Card: {{company_name}} vs {{competitor_name}}

### Cuándo Elegir {{company_name}}
[Escenarios donde somos mejor opción]

### Cuándo Considerar {{competitor_name}}
[Ser honestos sobre sus fortalezas]

### Argumentos de Venta
[Puntos clave para el pitch]

### Manejo de Objeciones
| Objeción | Respuesta |
|----------|-----------|

### Diferenciadores Clave
[Top 3 razones para elegirnos]`

// ============================================
// VARIABLE DEFINITIONS
// ============================================

export const COMPETITOR_VARIABLE_DEFINITIONS: VariableDefinition[] = [
  {
    name: 'competitor_name',
    default_value: '',
    required: true,
    description: 'Nombre del competidor a analizar (usado en nombre de campaña)',
  },
  {
    name: 'company_name',
    default_value: '',
    required: true,
    description: 'Nombre de tu empresa (para el battle card final)',
  },
  {
    name: 'industry',
    default_value: '',
    required: true,
    description: 'Industria o sector del mercado',
  },
  {
    name: 'country',
    default_value: 'España',
    required: false,
    description: 'País o región objetivo del análisis',
  },
]

// ============================================
// FLOW STEPS - 6 STEP TRIANGULATED ANALYSIS
// ============================================

export const COMPETITOR_FLOW_STEPS: FlowStep[] = [
  {
    id: 'comp-step-1-deep-research',
    name: 'Deep Research Competidor',
    order: 1,
    type: 'llm',
    prompt: STEP_1_DEEP_RESEARCH_PROMPT,
    model: 'google/gemini-2.5-pro-preview', // Usa web search
    temperature: 0.5,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Investigación profunda del competidor usando búsqueda web con IA',
    base_doc_ids: [], // No requiere documentos, usa web search
    auto_receive_from: [],
    retrieval_mode: 'full',
  },
  {
    id: 'comp-step-2-autopercepcion',
    name: 'Autopercepción',
    order: 2,
    type: 'llm',
    prompt: STEP_2_AUTOPERCEPCION_PROMPT,
    model: 'google/gemini-2.0-flash-exp',
    temperature: 0.6,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Cómo se posiciona el competidor a sí mismo',
    base_doc_ids: [], // Requiere: Web scraping, FB, YT, TikTok, LI posts, LI Insights, IG
    auto_receive_from: ['comp-step-1-deep-research'],
    retrieval_mode: 'full',
    // required_documents defined in competitor-analysis.config.ts
  },
  {
    id: 'comp-step-3-percepcion-terceros',
    name: 'Percepción Terceros',
    order: 3,
    type: 'llm',
    prompt: STEP_3_PERCEPCION_TERCEROS_PROMPT,
    model: 'google/gemini-2.0-flash-exp',
    temperature: 0.6,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Cómo ven al competidor los medios y buscadores',
    base_doc_ids: [], // Requiere: SEO/SERP data, News corpus
    auto_receive_from: ['comp-step-1-deep-research'],
    retrieval_mode: 'full',
  },
  {
    id: 'comp-step-4-percepcion-rrss',
    name: 'Percepción del consumidor RRSS',
    order: 4,
    type: 'llm',
    prompt: STEP_4_PERCEPCION_RRSS_PROMPT,
    model: 'google/gemini-2.0-flash-exp',
    temperature: 0.6,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Qué dicen los usuarios en redes sociales',
    base_doc_ids: [], // Requiere: Comments de LI, IG, TikTok, YT, FB
    auto_receive_from: ['comp-step-1-deep-research', 'comp-step-2-autopercepcion'],
    retrieval_mode: 'full',
  },
  {
    id: 'comp-step-5-percepcion-reviews',
    name: 'Percepción del consumidor Reviews',
    order: 5,
    type: 'llm',
    prompt: STEP_5_PERCEPCION_REVIEWS_PROMPT,
    model: 'google/gemini-2.0-flash-exp',
    temperature: 0.6,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Qué dicen los clientes que probaron el producto',
    base_doc_ids: [], // Requiere: Trustpilot, G2, Capterra, Play Store, App Store
    auto_receive_from: ['comp-step-1-deep-research', 'comp-step-2-autopercepcion'],
    retrieval_mode: 'full',
  },
  {
    id: 'comp-step-6-resumen',
    name: 'Resumen de todas las percepciones',
    order: 6,
    type: 'llm',
    prompt: STEP_6_RESUMEN_PERCEPCIONES_PROMPT,
    model: 'google/gemini-2.5-pro-preview', // Modelo más potente para síntesis
    temperature: 0.7,
    max_tokens: 12000,
    output_format: 'markdown',
    description: 'Síntesis triangulada de todas las perspectivas',
    base_doc_ids: [], // No requiere docs adicionales
    auto_receive_from: [
      'comp-step-1-deep-research',
      'comp-step-2-autopercepcion',
      'comp-step-3-percepcion-terceros',
      'comp-step-4-percepcion-rrss',
      'comp-step-5-percepcion-reviews',
    ],
    retrieval_mode: 'full',
  },
]

// ============================================
// TEMPLATE EXPORT
// ============================================

export function getCompetitorAnalysisTemplate(): PlaybookTemplate {
  return {
    template_id: 'competitor-analysis-v2',
    name: 'Competitor Analysis',
    description: 'Análisis triangulado de competidores en 6 pasos: deep research, autopercepción, percepción de terceros, percepción de consumidores (RRSS y Reviews), y síntesis final con battle card.',
    playbook_type: 'competitor_analysis',

    flow_config: {
      steps: COMPETITOR_FLOW_STEPS,
      version: '2.0.0',
      description: 'Triangulated Competitor Analysis - 6 step perception analysis',
    },

    variable_definitions: COMPETITOR_VARIABLE_DEFINITIONS,

    required_documents: {
      // Step 2: Autopercepción (7 docs)
      autopercepcion: [
        'Web Scraping - Contenido del sitio web',
        'Facebook Posts',
        'YouTube Videos/Transcripciones',
        'TikTok Posts',
        'LinkedIn Posts',
        'LinkedIn Company Insights',
        'Instagram Posts',
      ],
      // Step 3: Percepción Terceros (2 docs)
      percepcion_terceros: [
        'Datos SEO/SERP',
        'Corpus de Noticias',
      ],
      // Step 4: Percepción RRSS (5 docs)
      percepcion_rrss: [
        'LinkedIn Comments',
        'Instagram Comments',
        'TikTok Comments',
        'YouTube Comments',
        'Facebook Comments',
      ],
      // Step 5: Percepción Reviews (5 docs)
      percepcion_reviews: [
        'Trustpilot Reviews',
        'G2 Reviews',
        'Capterra Reviews',
        'Play Store Reviews',
        'App Store Reviews',
      ],
    },

    campaign_docs_guide: `## Guía de Documentos para Análisis de Competidores (v2.0)

Este playbook usa análisis triangulado: compara cómo el competidor se ve a sí mismo vs cómo lo ven terceros y consumidores.

### Paso 1: Deep Research Competidor
**No requiere documentos** - Usa búsqueda web con IA (Gemini).

### Paso 2: Autopercepción (7 documentos)
Cómo el competidor se presenta a sí mismo:
- 🌐 **Web Scraping** - Sitio web completo
- 📘 **Facebook Posts** - Publicaciones recientes
- ▶️ **YouTube Videos** - Videos y transcripciones
- 🎵 **TikTok Posts** - Videos del perfil
- 💼 **LinkedIn Posts** - Publicaciones de empresa
- 📊 **LinkedIn Insights** - Datos del perfil
- 📷 **Instagram Posts** - Publicaciones

### Paso 3: Percepción de Terceros (2 documentos)
Cómo lo ven medios y buscadores:
- 🔍 **SEO/SERP Data** - Keywords, rankings
- 📰 **Noticias** - Menciones en prensa

### Paso 4: Percepción Consumidores RRSS (5 documentos)
Qué dicen en redes sociales:
- 💬 Comentarios de LinkedIn
- 💬 Comentarios de Instagram
- 💬 Comentarios de TikTok
- 💬 Comentarios de YouTube
- 💬 Comentarios de Facebook

### Paso 5: Percepción Consumidores Reviews (5 documentos)
Qué dicen los que probaron el producto:
- ⭐ Trustpilot Reviews
- ⭐ G2 Reviews
- ⭐ Capterra Reviews
- ⭐ Play Store Reviews
- ⭐ App Store Reviews

### Paso 6: Resumen de Percepciones
**No requiere documentos nuevos** - Sintetiza todos los pasos anteriores.

---

**Total: 19 documentos por competidor**

💡 **Tip**: Usa Apify para automatizar el scraping de todos estos documentos. El botón "Importar Documentos" tiene integraciones listas.`,
  }
}

// ============================================
// LEGACY EXPORTS (for backwards compatibility)
// ============================================

// These are the old 4-step prompts, kept for backwards compatibility
export const STEP_0_COMPETITOR_MAPPING_PROMPT = STEP_1_DEEP_RESEARCH_PROMPT
export const STEP_1_FEATURE_COMPARISON_PROMPT = STEP_2_AUTOPERCEPCION_PROMPT
export const STEP_2_POSITIONING_ANALYSIS_PROMPT = STEP_3_PERCEPCION_TERCEROS_PROMPT
export const STEP_3_SWOT_SYNTHESIS_PROMPT = STEP_6_RESUMEN_PERCEPCIONES_PROMPT
