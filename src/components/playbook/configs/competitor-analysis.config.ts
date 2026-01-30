/**
 * Competitor Analysis Playbook Configuration
 *
 * BRIDGE FILE - Re-exports from the new playbook package for backwards compatibility.
 *
 * The main playbook code has moved to:
 * @/lib/playbooks/competitor-analysis
 *
 * This file maintains compatibility with existing components that import from here.
 *
 * Flow (5 steps, Deep Research is foundational doc):
 * 1. Autopercepción → 8 docs (Deep Research, Web, FB, YT, TikTok, LI, IG)
 * 2. Percepción Terceros → 3 docs (Deep Research, SEO/SERP, Noticias)
 * 3. Percepción RRSS → 6 docs (Deep Research, Comments from all platforms)
 * 4. Percepción Reviews → 6 docs (Deep Research, Trustpilot, G2, Capterra, Stores)
 * 5. Síntesis → Receives from all previous steps
 *
 * Total: 1 Deep Research + 19 scraping documents = 20 per competitor
 */

import type { StepRequirements, DocumentRequirement } from '../DocumentRequirementsMap'

// ============================================
// RE-EXPORT FROM PACKAGE
// ============================================

// Import from the new playbook package
import {
  // Config and template
  STEP_REQUIREMENTS,
  COMPETITOR_ANALYSIS_PRESENTATION as PACKAGE_PRESENTATION,
  getCompetitorAnalysisTemplate,
  DEEP_RESEARCH_CONFIG,

  // Constants
  ALL_DOCUMENT_REQUIREMENTS,
  COMPETITOR_VARIABLE_DEFINITIONS,
  SCRAPER_INPUT_MAPPINGS,
  STEP_DOCUMENT_REQUIREMENTS,
  getDocumentsByCategory as packageGetDocumentsByCategory,
  getDocumentsForStep,
  getScraperInputForDocument,

  // Prompts
  ALL_PROMPTS,
  DEEP_RESEARCH_PROMPT,
  AUTOPERCEPCION_PROMPT,
  PERCEPCION_TERCEROS_PROMPT,
  PERCEPCION_RRSS_PROMPT,
  PERCEPCION_REVIEWS_PROMPT,
  SINTESIS_PROMPT,

  // Document matcher
  matchDocumentForStep,
  findAllDocumentsForCompetitor,
  getDocumentStatusForStep,
  formatCreatedAt,
  createDocumentMetadata,
  generateDocumentName,

  // Components
  KnowledgeBaseGenerator,
  DocumentGeneratorCard,
  DeepResearchLauncher,

  // Types
  type SourceType,
  type DocumentMetadata,
  type MatchResult,
  type CampaignVariables,
  type FlowStep,
  type PlaybookTemplate,
  type KnowledgeBaseGeneratorProps,
  type DeepResearchLauncherProps,
} from '@/lib/playbooks/competitor-analysis'

// Re-export everything from the package
export {
  // Config
  getCompetitorAnalysisTemplate,
  DEEP_RESEARCH_CONFIG,
  STEP_REQUIREMENTS,

  // Constants
  ALL_DOCUMENT_REQUIREMENTS,
  COMPETITOR_VARIABLE_DEFINITIONS,
  SCRAPER_INPUT_MAPPINGS,
  STEP_DOCUMENT_REQUIREMENTS,
  getDocumentsForStep,
  getScraperInputForDocument,

  // Prompts
  ALL_PROMPTS,
  DEEP_RESEARCH_PROMPT,
  AUTOPERCEPCION_PROMPT,
  PERCEPCION_TERCEROS_PROMPT,
  PERCEPCION_RRSS_PROMPT,
  PERCEPCION_REVIEWS_PROMPT,
  SINTESIS_PROMPT,

  // Document matcher
  matchDocumentForStep,
  findAllDocumentsForCompetitor,
  getDocumentStatusForStep,
  formatCreatedAt,
  createDocumentMetadata,
  generateDocumentName,

  // Components
  KnowledgeBaseGenerator,
  DocumentGeneratorCard,
  DeepResearchLauncher,

  // Types
  type SourceType,
  type DocumentMetadata,
  type MatchResult,
  type CampaignVariables,
  type FlowStep,
  type PlaybookTemplate,
  type KnowledgeBaseGeneratorProps,
  type DeepResearchLauncherProps,
}

// ============================================
// BACKWARDS COMPATIBILITY - Document arrays
// ============================================

// Map package icon types to legacy icon types
const iconMapping: Record<string, 'globe' | 'social' | 'review' | 'search' | 'news' | 'file'> = {
  research: 'search', // Map 'research' to 'search' for legacy compatibility
  globe: 'globe',
  social: 'social',
  review: 'review',
  search: 'search',
  news: 'news',
  file: 'file',
}

// Convert package DocumentRequirement to legacy format
function convertToLegacyFormat(doc: typeof ALL_DOCUMENT_REQUIREMENTS[0]): DocumentRequirement {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description,
    source: doc.source,
    icon: iconMapping[doc.icon] || 'file',
    apifyActor: doc.apifyActor,
    category: doc.category,
  }
}

/** Step 1: Autopercepción - How the competitor positions themselves */
export const AUTOPERCEPCION_DOCUMENTS: DocumentRequirement[] = ALL_DOCUMENT_REQUIREMENTS
  .filter(d => [
    'website', 'instagram_posts', 'facebook_posts',
    'youtube_videos', 'tiktok_posts', 'linkedin_posts', 'linkedin_insights'
  ].includes(d.source_type))
  .map(convertToLegacyFormat)

/** Step 2: Percepción Terceros - How others see the competitor */
export const PERCEPCION_TERCEROS_DOCUMENTS: DocumentRequirement[] = ALL_DOCUMENT_REQUIREMENTS
  .filter(d => ['seo_serp', 'news_corpus'].includes(d.source_type))
  .map(convertToLegacyFormat)

/** Step 3: Percepción RRSS - How social media users see the competitor */
export const PERCEPCION_RRSS_DOCUMENTS: DocumentRequirement[] = ALL_DOCUMENT_REQUIREMENTS
  .filter(d => [
    'instagram_comments', 'facebook_comments', 'youtube_comments',
    'tiktok_comments', 'linkedin_comments'
  ].includes(d.source_type))
  .map(convertToLegacyFormat)

/** Step 4: Percepción Reviews - How customers review the competitor */
export const PERCEPCION_REVIEWS_DOCUMENTS: DocumentRequirement[] = ALL_DOCUMENT_REQUIREMENTS
  .filter(d => [
    'trustpilot_reviews', 'g2_reviews', 'capterra_reviews',
    'playstore_reviews', 'appstore_reviews'
  ].includes(d.source_type))
  .map(convertToLegacyFormat)

// ============================================
// BACKWARDS COMPATIBILITY - Step requirements
// ============================================

/**
 * Legacy step requirements for backwards compatibility.
 * Note: Now includes 6 steps with Deep Research as step 1 for display purposes,
 * but the actual playbook execution uses 5 steps (Deep Research is a foundational doc).
 */
export const COMPETITOR_ANALYSIS_STEP_REQUIREMENTS: StepRequirements[] = [
  {
    stepId: 'deep-research',
    stepName: 'Deep Research Competidor',
    stepOrder: 1,
    description: 'Investigación profunda del competidor usando búsqueda web con IA',
    documents: [], // No documents needed - uses Gemini web search
    receivesFromPrevious: false,
  },
  {
    stepId: 'autopercepcion',
    stepName: 'Autopercepción',
    stepOrder: 2,
    description: 'Cómo se posiciona el competidor a sí mismo',
    documents: AUTOPERCEPCION_DOCUMENTS,
    receivesFromPrevious: true, // Receives Deep Research output
  },
  {
    stepId: 'percepcion-terceros',
    stepName: 'Percepción de Terceros',
    stepOrder: 3,
    description: 'Cómo ven al competidor los medios y buscadores',
    documents: PERCEPCION_TERCEROS_DOCUMENTS,
    receivesFromPrevious: false,
  },
  {
    stepId: 'percepcion-rrss',
    stepName: 'Percepción del Consumidor en RRSS',
    stepOrder: 4,
    description: 'Qué dicen los usuarios en redes sociales',
    documents: PERCEPCION_RRSS_DOCUMENTS,
    receivesFromPrevious: false,
  },
  {
    stepId: 'percepcion-reviews',
    stepName: 'Percepción del Consumidor en Reviews',
    stepOrder: 5,
    description: 'Qué dicen los clientes que probaron el producto',
    documents: PERCEPCION_REVIEWS_DOCUMENTS,
    receivesFromPrevious: false,
  },
  {
    stepId: 'resumen',
    stepName: 'Resumen de Percepciones',
    stepOrder: 6,
    description: 'Síntesis triangulada de todas las perspectivas',
    documents: [], // No new documents - receives from all previous steps
    receivesFromPrevious: true,
  },
]

// ============================================
// BACKWARDS COMPATIBILITY - Utility functions
// ============================================

/**
 * Get all document requirements as a flat array (legacy format)
 */
export function getAllDocumentRequirements(): DocumentRequirement[] {
  return ALL_DOCUMENT_REQUIREMENTS.map(convertToLegacyFormat)
}

/**
 * Get total number of documents required
 */
export function getTotalDocumentCount(): number {
  return ALL_DOCUMENT_REQUIREMENTS.length // 20 documents (including Deep Research)
}

/**
 * Get documents grouped by category (legacy format)
 */
export function getDocumentsByCategory(): Record<string, DocumentRequirement[]> {
  const all = getAllDocumentRequirements()
  return all.reduce((acc, doc) => {
    const category = doc.category || 'other'
    if (!acc[category]) acc[category] = []
    acc[category].push(doc)
    return acc
  }, {} as Record<string, DocumentRequirement[]>)
}

/**
 * Get documents grouped by source type (legacy format)
 */
export function getDocumentsBySource(): Record<string, DocumentRequirement[]> {
  const all = getAllDocumentRequirements()
  return all.reduce((acc, doc) => {
    if (!acc[doc.source]) acc[doc.source] = []
    acc[doc.source].push(doc)
    return acc
  }, {} as Record<string, DocumentRequirement[]>)
}

// ============================================
// BACKWARDS COMPATIBILITY - Presentation config
// ============================================

export const COMPETITOR_ANALYSIS_PRESENTATION = {
  ...PACKAGE_PRESENTATION,
  // Override tagline to maintain backwards compatibility with 6-step wording
  tagline: 'Análisis triangulado de competidores en 6 pasos',
}

// ============================================
// PLAYBOOK CONFIG (for CampaignWizard)
// ============================================

import type { PlaybookConfig, PlaybookPresentation } from '../types'

/**
 * PlaybookConfig for competitor-analysis playbook.
 * Used by CampaignWizard to show the campaign creation wizard.
 */
const presentation: PlaybookPresentation = {
  tagline: COMPETITOR_ANALYSIS_PRESENTATION.tagline,
  valueProposition: COMPETITOR_ANALYSIS_PRESENTATION.valueProposition,
  estimatedTime: COMPETITOR_ANALYSIS_PRESENTATION.estimatedTime,
  estimatedCost: COMPETITOR_ANALYSIS_PRESENTATION.estimatedCost,
  requiredServices: COMPETITOR_ANALYSIS_PRESENTATION.requiredServices,
}

export const competitorAnalysisConfig: PlaybookConfig = {
  id: 'competitor-analysis',
  type: 'competitor_analysis',
  name: 'Análisis de Competidores',
  description: 'Análisis triangulado de competidores en 5 pasos: autopercepción, percepción de terceros, percepción de consumidores (RRSS y Reviews), y síntesis final con battle card.',
  icon: '🔍',
  presentation,

  // Variables needed for this playbook (converted from COMPETITOR_VARIABLE_DEFINITIONS)
  variables: COMPETITOR_VARIABLE_DEFINITIONS.map(v => ({
    key: v.name,
    label: v.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    type: v.type === 'textarea' ? 'textarea' as const : 'text' as const,
    required: v.required,
    defaultValue: v.default_value,
    description: v.description,
    placeholder: v.placeholder,
  })),

  // Phases - simplified for wizard (actual execution uses flow_config)
  phases: [
    {
      id: 'knowledge-base',
      name: 'Base de Conocimiento',
      description: 'Generar documentos fundacionales para el análisis',
      steps: [
        {
          id: 'deep-research',
          name: 'Deep Research',
          description: 'Investigación profunda del competidor usando Gemini con búsqueda web',
          type: 'auto_with_review',
          executor: 'llm',
          promptKey: 'deep_research',
        },
        {
          id: 'scraping',
          name: 'Scraping de Fuentes',
          description: 'Obtener datos de redes sociales, reviews y sitio web',
          type: 'auto_with_review',
          executor: 'job',
          jobType: 'apify_scraping',
        },
      ],
    },
    {
      id: 'analysis',
      name: 'Análisis',
      description: 'Ejecutar los pasos del análisis triangulado',
      steps: [
        {
          id: 'autopercepcion',
          name: 'Autopercepción',
          description: 'Cómo se posiciona el competidor a sí mismo',
          type: 'auto_with_review',
          executor: 'llm',
          promptKey: 'autopercepcion',
        },
        {
          id: 'percepcion-terceros',
          name: 'Percepción de Terceros',
          description: 'Cómo ven al competidor los medios y buscadores',
          type: 'auto_with_review',
          executor: 'llm',
          promptKey: 'percepcion_terceros',
        },
        {
          id: 'percepcion-rrss',
          name: 'Percepción RRSS',
          description: 'Qué dicen los usuarios en redes sociales',
          type: 'auto_with_review',
          executor: 'llm',
          promptKey: 'percepcion_rrss',
        },
        {
          id: 'percepcion-reviews',
          name: 'Percepción Reviews',
          description: 'Qué dicen los clientes que probaron el producto',
          type: 'auto_with_review',
          executor: 'llm',
          promptKey: 'percepcion_reviews',
        },
        {
          id: 'sintesis',
          name: 'Síntesis y Battle Card',
          description: 'Síntesis triangulada de todas las perspectivas',
          type: 'auto_with_review',
          executor: 'llm',
          promptKey: 'sintesis',
        },
      ],
    },
  ],
}

export default competitorAnalysisConfig
