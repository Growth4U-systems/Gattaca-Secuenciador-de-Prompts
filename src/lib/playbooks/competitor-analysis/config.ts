/**
 * Competitor Analysis Playbook - Configuration
 *
 * Template principal y configuración del flujo de 5 pasos.
 * Exportable y reutilizable.
 */

import type { PlaybookTemplate, FlowStep } from './types'
import {
  COMPETITOR_VARIABLE_DEFINITIONS,
  ALL_DOCUMENT_REQUIREMENTS,
} from './constants'
import {
  DEEP_RESEARCH_PROMPT,
  AUTOPERCEPCION_PROMPT,
  PERCEPCION_TERCEROS_PROMPT,
  PERCEPCION_RRSS_PROMPT,
  PERCEPCION_REVIEWS_PROMPT,
  SINTESIS_PROMPT,
} from './prompts'

// ============================================
// FLOW STEPS - 5 STEP TRIANGULATED ANALYSIS
// ============================================

/**
 * Flujo de 5 pasos del playbook.
 * Deep Research es ahora un documento fundacional, no un paso.
 */
export const COMPETITOR_FLOW_STEPS: FlowStep[] = [
  {
    id: 'comp-step-1-autopercepcion',
    name: 'Autopercepción',
    order: 1,
    type: 'llm',
    prompt: AUTOPERCEPCION_PROMPT,
    model: 'google/gemini-3-flash-preview',
    temperature: 0.6,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Cómo se posiciona el competidor a sí mismo',
    base_doc_ids: [],
    auto_receive_from: [],
    retrieval_mode: 'full',
    required_source_types: [
      'deep_research',
      'website',
      'instagram_posts',
      'facebook_posts',
      'youtube_videos',
      'tiktok_posts',
      'linkedin_posts',
      'linkedin_insights',
    ],
  },
  {
    id: 'comp-step-2-percepcion-terceros',
    name: 'Percepción Terceros',
    order: 2,
    type: 'llm',
    prompt: PERCEPCION_TERCEROS_PROMPT,
    model: 'google/gemini-3-flash-preview',
    temperature: 0.6,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Cómo ven al competidor los medios y buscadores',
    base_doc_ids: [],
    auto_receive_from: [],
    retrieval_mode: 'full',
    required_source_types: ['deep_research', 'seo_serp', 'news_corpus'],
  },
  {
    id: 'comp-step-3-percepcion-rrss',
    name: 'Percepción del consumidor RRSS',
    order: 3,
    type: 'llm',
    prompt: PERCEPCION_RRSS_PROMPT,
    model: 'google/gemini-3-flash-preview',
    temperature: 0.6,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Qué dicen los usuarios en redes sociales',
    base_doc_ids: [],
    auto_receive_from: ['comp-step-1-autopercepcion'],
    retrieval_mode: 'full',
    required_source_types: [
      'deep_research',
      'instagram_comments',
      'facebook_comments',
      'youtube_comments',
      'tiktok_comments',
      'linkedin_comments',
    ],
  },
  {
    id: 'comp-step-4-percepcion-reviews',
    name: 'Percepción del consumidor Reviews',
    order: 4,
    type: 'llm',
    prompt: PERCEPCION_REVIEWS_PROMPT,
    model: 'google/gemini-3-flash-preview',
    temperature: 0.6,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Qué dicen los clientes que probaron el producto',
    base_doc_ids: [],
    auto_receive_from: ['comp-step-1-autopercepcion'],
    retrieval_mode: 'full',
    required_source_types: [
      'deep_research',
      'trustpilot_reviews',
      'g2_reviews',
      'capterra_reviews',
      'playstore_reviews',
      'appstore_reviews',
    ],
  },
  {
    id: 'comp-step-5-sintesis',
    name: 'Síntesis y Battle Card',
    order: 5,
    type: 'llm',
    prompt: SINTESIS_PROMPT,
    model: 'google/gemini-3-flash-preview',
    temperature: 0.7,
    max_tokens: 12000,
    output_format: 'markdown',
    description: 'Síntesis triangulada de todas las perspectivas',
    base_doc_ids: [],
    auto_receive_from: [
      'comp-step-1-autopercepcion',
      'comp-step-2-percepcion-terceros',
      'comp-step-3-percepcion-rrss',
      'comp-step-4-percepcion-reviews',
    ],
    retrieval_mode: 'full',
    required_source_types: ['deep_research'],
  },
]

// ============================================
// TEMPLATE EXPORT
// ============================================

/**
 * Genera el template completo del playbook.
 * Esta función es el punto de entrada principal para usar el playbook.
 */
export function getCompetitorAnalysisTemplate(): PlaybookTemplate {
  return {
    template_id: 'competitor-analysis-v3',
    name: 'Competitor Analysis',
    description:
      'Análisis triangulado de competidores en 5 pasos: autopercepción, percepción de terceros, percepción de consumidores (RRSS y Reviews), y síntesis final con battle card.',
    playbook_type: 'competitor_analysis',

    flow_config: {
      steps: COMPETITOR_FLOW_STEPS,
      version: '3.0.0',
      description:
        'Triangulated Competitor Analysis - 5 step perception analysis (Deep Research as foundational document)',
    },

    variable_definitions: COMPETITOR_VARIABLE_DEFINITIONS,

    required_documents: {
      // Step 1: Autopercepción (8 docs)
      autopercepcion: [
        'Deep Research',
        'Web Scraping - Contenido del sitio web',
        'Instagram Posts',
        'Facebook Posts',
        'YouTube Videos/Transcripciones',
        'TikTok Posts',
        'LinkedIn Posts',
        'LinkedIn Company Insights',
      ],
      // Step 2: Percepción Terceros (3 docs)
      percepcion_terceros: ['Deep Research', 'Datos SEO/SERP', 'Corpus de Noticias'],
      // Step 3: Percepción RRSS (6 docs)
      percepcion_rrss: [
        'Deep Research',
        'LinkedIn Comments',
        'Instagram Comments',
        'TikTok Comments',
        'YouTube Comments',
        'Facebook Comments',
      ],
      // Step 4: Percepción Reviews (6 docs)
      percepcion_reviews: [
        'Deep Research',
        'Trustpilot Reviews',
        'G2 Reviews',
        'Capterra Reviews',
        'Play Store Reviews',
        'App Store Reviews',
      ],
      // Step 5: Síntesis
      sintesis: ['Deep Research'],
    },

    campaign_docs_guide: `## Guía de Documentos para Análisis de Competidores (v3.0)

Este playbook usa análisis triangulado: compara cómo el competidor se ve a sí mismo vs cómo lo ven terceros y consumidores.

### Documento Fundacional (RECOMENDADO)
**🔬 Deep Research** - Investigación profunda usando Gemini con búsqueda web.
Este documento proporciona contexto para TODOS los pasos del playbook.

### Paso 1: Autopercepción (7 documentos)
Cómo el competidor se presenta a sí mismo:
- 🌐 **Web Scraping** - Sitio web completo
- 📘 **Facebook Posts** - Publicaciones recientes
- ▶️ **YouTube Videos** - Videos y transcripciones
- 🎵 **TikTok Posts** - Videos del perfil
- 💼 **LinkedIn Posts** - Publicaciones de empresa
- 📊 **LinkedIn Insights** - Datos del perfil
- 📷 **Instagram Posts** - Publicaciones

### Paso 2: Percepción de Terceros (2 documentos)
Cómo lo ven medios y buscadores:
- 🔍 **SEO/SERP Data** - Keywords, rankings
- 📰 **Noticias** - Menciones en prensa

### Paso 3: Percepción Consumidores RRSS (5 documentos)
Qué dicen en redes sociales:
- 💬 Comentarios de LinkedIn
- 💬 Comentarios de Instagram
- 💬 Comentarios de TikTok
- 💬 Comentarios de YouTube
- 💬 Comentarios de Facebook

### Paso 4: Percepción Consumidores Reviews (5 documentos)
Qué dicen los que probaron el producto:
- ⭐ Trustpilot Reviews
- ⭐ G2 Reviews
- ⭐ Capterra Reviews
- ⭐ Play Store Reviews
- ⭐ App Store Reviews

### Paso 5: Síntesis y Battle Card
**No requiere documentos nuevos** - Sintetiza todos los pasos anteriores.

---

**Total: 1 Deep Research + 19 documentos de scraping = 20 documentos por competidor**

⚠️ **Nota**: El playbook puede ejecutarse sin todos los documentos, pero la calidad del análisis será mejor con más documentos disponibles.

💡 **Tip**: Usa Apify para automatizar el scraping. El botón "Importar Documentos" tiene integraciones listas.`,
  }
}

// ============================================
// DEEP RESEARCH CONFIG
// ============================================

/**
 * Configuración específica para Deep Research.
 * Usado como documento fundacional antes del playbook.
 */
export const DEEP_RESEARCH_CONFIG = {
  id: 'deep-research',
  name: 'Deep Research',
  prompt: DEEP_RESEARCH_PROMPT,
  model: 'google/gemini-2.5-pro-preview',
  temperature: 0.5,
  max_tokens: 8192,
  useWebSearch: true,
  description: 'Investigación profunda del competidor usando Gemini con búsqueda web',
}

// ============================================
// PRESENTATION CONFIG
// ============================================

/**
 * Configuración de presentación del playbook.
 * Usado para mostrar info en la UI.
 */
export const COMPETITOR_ANALYSIS_PRESENTATION = {
  tagline: 'Análisis triangulado de competidores en 5 pasos',
  valueProposition: [
    'Deep research inicial con IA para contexto completo',
    'Análisis de autopercepción: cómo se posicionan ellos mismos',
    'Percepción de terceros: medios, SEO y prensa',
    'Percepción de consumidores: redes sociales y reviews',
    'Síntesis ejecutiva con insights accionables',
  ],
  estimatedTime: '30-45 minutos por competidor',
  estimatedCost: '~$2-5 USD por competidor (scraping + LLM)',
  requiredServices: [
    {
      key: 'openrouter',
      name: 'OpenRouter',
      description: 'Para ejecutar modelos de IA (Gemini, GPT-4, etc.)',
    },
    {
      key: 'apify',
      name: 'Apify',
      description: 'Para scraping de redes sociales y reviews',
    },
  ],
  documentStats: {
    total: ALL_DOCUMENT_REQUIREMENTS.length,
    deepResearch: 1,
    scraping: ALL_DOCUMENT_REQUIREMENTS.filter((d) => d.source === 'scraping').length,
  },
}

// ============================================
// STEP REQUIREMENTS (for UI)
// ============================================

/**
 * Requisitos de documentos por paso.
 * Usado para mostrar el checklist en la UI.
 */
export const STEP_REQUIREMENTS = [
  {
    stepId: 'autopercepcion',
    stepName: 'Autopercepción',
    stepOrder: 1,
    description: 'Cómo se posiciona el competidor a sí mismo',
    documents: ALL_DOCUMENT_REQUIREMENTS.filter((d) =>
      [
        'deep_research',
        'website',
        'instagram_posts',
        'facebook_posts',
        'youtube_videos',
        'tiktok_posts',
        'linkedin_posts',
        'linkedin_insights',
      ].includes(d.source_type)
    ),
    receivesFromPrevious: false,
  },
  {
    stepId: 'percepcion-terceros',
    stepName: 'Percepción de Terceros',
    stepOrder: 2,
    description: 'Cómo ven al competidor los medios y buscadores',
    documents: ALL_DOCUMENT_REQUIREMENTS.filter((d) =>
      ['deep_research', 'seo_serp', 'news_corpus'].includes(d.source_type)
    ),
    receivesFromPrevious: false,
  },
  {
    stepId: 'percepcion-rrss',
    stepName: 'Percepción del Consumidor en RRSS',
    stepOrder: 3,
    description: 'Qué dicen los usuarios en redes sociales',
    documents: ALL_DOCUMENT_REQUIREMENTS.filter((d) =>
      [
        'deep_research',
        'instagram_comments',
        'facebook_comments',
        'youtube_comments',
        'tiktok_comments',
        'linkedin_comments',
      ].includes(d.source_type)
    ),
    receivesFromPrevious: true,
  },
  {
    stepId: 'percepcion-reviews',
    stepName: 'Percepción del Consumidor en Reviews',
    stepOrder: 4,
    description: 'Qué dicen los clientes que probaron el producto',
    documents: ALL_DOCUMENT_REQUIREMENTS.filter((d) =>
      [
        'deep_research',
        'trustpilot_reviews',
        'g2_reviews',
        'capterra_reviews',
        'playstore_reviews',
        'appstore_reviews',
      ].includes(d.source_type)
    ),
    receivesFromPrevious: true,
  },
  {
    stepId: 'sintesis',
    stepName: 'Síntesis y Battle Card',
    stepOrder: 5,
    description: 'Síntesis triangulada de todas las perspectivas',
    documents: ALL_DOCUMENT_REQUIREMENTS.filter((d) => d.source_type === 'deep_research'),
    receivesFromPrevious: true,
  },
]
