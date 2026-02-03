/**
 * Competitor Analysis Playbook Package
 *
 * Package exportable para análisis triangulado de competidores.
 * Diseñado para ser portable a otros proyectos con mínimas dependencias.
 *
 * ## Uso básico:
 *
 * ```typescript
 * import {
 *   getCompetitorAnalysisTemplate,
 *   KnowledgeBaseGenerator,
 *   matchDocumentForStep,
 * } from '@/lib/playbooks/competitor-analysis'
 *
 * // Obtener template del playbook
 * const template = getCompetitorAnalysisTemplate()
 *
 * // Usar componente de generación de base de conocimiento
 * <KnowledgeBaseGenerator
 *   campaignId={campaignId}
 *   projectId={projectId}
 *   variables={campaignVariables}
 *   onComplete={handleComplete}
 * />
 * ```
 *
 * ## Peer Dependencies:
 * - react
 * - @supabase/supabase-js (para documentMatcher)
 * - lucide-react (iconos)
 */

// ============================================
// TYPES
// ============================================

export type {
  // Core types
  VariableDefinition,
  DocumentMetadata,
  SourceType,
  DocumentRequirement,
  MatchResult,
  ExistingDocumentOption,
  Document,
  ScraperInputMapping,
  CampaignVariables,

  // Flow types
  FlowStep,
  PlaybookTemplate,
  StepDocumentRequirements,

  // Component props
  KnowledgeBaseGeneratorProps,
  DeepResearchLauncherProps,
} from './types'

// ============================================
// CONSTANTS
// ============================================

export {
  // Variable definitions
  COMPETITOR_VARIABLE_DEFINITIONS,

  // Scraper mappings
  SCRAPER_INPUT_MAPPINGS,
  SOURCE_TYPE_TO_SCRAPER_TYPE,

  // Document requirements
  ALL_DOCUMENT_REQUIREMENTS,
  STEP_DOCUMENT_REQUIREMENTS,
  DOCUMENT_CATEGORIES,

  // Utility functions
  getRequiredVariables,
  getDocumentsForStep,
  getDocumentsByCategory,
  getScraperInputForDocument,
  getScraperTypeForSource,
  buildScraperInputConfig,
} from './constants'

// ============================================
// PROMPTS
// ============================================

export {
  // Individual prompts
  DEEP_RESEARCH_PROMPT,
  AUTOPERCEPCION_PROMPT,
  PERCEPCION_TERCEROS_PROMPT,
  PERCEPCION_RRSS_PROMPT,
  PERCEPCION_REVIEWS_PROMPT,
  SINTESIS_PROMPT,

  // All prompts object
  ALL_PROMPTS,

  // Types
  type PromptKey,
} from './prompts'

// ============================================
// CONFIG
// ============================================

export {
  // Template generator
  getCompetitorAnalysisTemplate,

  // Flow steps
  COMPETITOR_FLOW_STEPS,

  // Deep Research config
  DEEP_RESEARCH_CONFIG,

  // Presentation data (for UI)
  COMPETITOR_ANALYSIS_PRESENTATION,

  // Step requirements (for UI checklist)
  STEP_REQUIREMENTS,
} from './config'

// ============================================
// DOCUMENT MATCHER
// ============================================

export {
  // Matching functions
  matchDocumentForStep,
  findAllDocumentsForCompetitor,
  checkScraperJobInProgress,
  getDocumentStatusForStep,

  // Helper functions
  formatCreatedAt,
  createDocumentMetadata,
  generateDocumentName,

  // Types
  type SupabaseClientLike,
} from './documentMatcher'

// ============================================
// COMPONENTS
// ============================================

export {
  // Main components
  KnowledgeBaseGenerator,
  DocumentGeneratorCard,
  DeepResearchLauncher,
  ScraperInputsForm,

  // Component props
  type DocumentGeneratorCardProps,
} from './components'
