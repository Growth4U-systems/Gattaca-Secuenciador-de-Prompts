/**
 * Competitor Analysis Playbook - Type Definitions
 *
 * Este archivo define todas las interfaces y tipos para el playbook
 * de análisis de competidores. Es exportable y reutilizable.
 */

// ============================================
// VARIABLE DEFINITIONS
// ============================================

export interface VariableDefinition {
  name: string
  default_value?: string
  required: boolean
  description: string
  type?: 'text' | 'textarea' | 'url' | 'select'
  options?: string[]  // For select type
  placeholder?: string
}

// ============================================
// DOCUMENT TYPES
// ============================================

export interface DocumentMetadata {
  // Para matching automático
  competitor: string
  source_type: SourceType

  // Trazabilidad
  campaign_id?: string
  scraper_id?: string
  scraped_at?: string
  generated_at?: string

  // Input usado (para scrapers)
  scraper_input?: Record<string, any>
}

export type SourceType =
  // Deep Research
  | 'deep_research'
  // Website & SEO
  | 'website'
  | 'seo_serp'
  | 'news_corpus'
  // Social Posts
  | 'instagram_posts'
  | 'facebook_posts'
  | 'linkedin_posts'
  | 'linkedin_insights'
  | 'youtube_videos'
  | 'tiktok_posts'
  // Social Comments
  | 'instagram_comments'
  | 'facebook_comments'
  | 'linkedin_comments'
  | 'youtube_comments'
  | 'tiktok_comments'
  // Reviews
  | 'trustpilot_reviews'
  | 'g2_reviews'
  | 'capterra_reviews'
  | 'playstore_reviews'
  | 'appstore_reviews'

export interface DocumentRequirement {
  id: string
  name: string
  description: string
  source: 'scraping' | 'deep_research' | 'manual' | 'generated'
  source_type: SourceType
  icon: 'globe' | 'social' | 'review' | 'search' | 'news' | 'file' | 'research'
  apifyActor?: string
  category: 'research' | 'website' | 'social_posts' | 'social_comments' | 'reviews' | 'seo'
}

// ============================================
// DOCUMENT MATCHING
// ============================================

export interface MatchResult {
  documentId: string | null
  status: 'available' | 'missing' | 'in_progress'
  document?: Document
  existingOptions?: ExistingDocumentOption[]
}

export interface ExistingDocumentOption {
  id: string
  name: string
  createdAt: string
  daysSinceCreation: number
}

export interface Document {
  id: string
  name: string
  content: string
  project_id: string
  metadata?: DocumentMetadata
  created_at: string
  updated_at?: string
}

// ============================================
// SCRAPER CONFIGURATION
// ============================================

export interface ScraperInputMapping {
  inputKey: string
  label: string
  placeholder?: string
  type?: 'text' | 'url' | 'textarea'
  required?: boolean
  // Algunos scrapers necesitan múltiples inputs
  additionalInputs?: {
    key: string
    label: string
    placeholder?: string
  }[]
}

// ============================================
// CAMPAIGN & FLOW
// ============================================

export interface CampaignVariables {
  // Requeridas
  competitor_name: string
  company_name: string
  industry: string

  // Opcionales
  competitor_description?: string
  company_description?: string
  country?: string
  target_audience?: string
  analysis_focus?: string
  key_questions?: string

  // Scraper inputs (opcionales, se piden después si no están)
  competitor_website?: string
  instagram_username?: string
  facebook_page_url?: string
  linkedin_company_url?: string
  tiktok_username?: string
  youtube_channel_url?: string
  trustpilot_url?: string
  g2_product_url?: string
  capterra_url?: string
  app_store_app_id?: string
  play_store_app_id?: string
}

export type CampaignStatus =
  | 'created'
  | 'preparing_knowledge'
  | 'ready'
  | 'running'
  | 'completed'
  | 'error'

export interface FlowStep {
  id: string
  name: string
  order: number
  type: 'llm' | 'scraping' | 'manual'
  prompt?: string
  model?: string
  temperature?: number
  max_tokens?: number
  output_format?: string
  description: string
  base_doc_ids?: string[]
  auto_receive_from?: string[]
  retrieval_mode?: 'full' | 'chunks' | 'summary'
  required_source_types?: SourceType[]
}

export interface StepDocumentRequirements {
  stepId: string
  source_types: SourceType[]
}

// ============================================
// PLAYBOOK TEMPLATE
// ============================================

export interface PlaybookTemplate {
  template_id: string
  name: string
  description: string
  playbook_type: string

  flow_config: {
    steps: FlowStep[]
    version: string
    description: string
  }

  variable_definitions: VariableDefinition[]

  required_documents: Record<string, string[]>

  campaign_docs_guide?: string
}

// ============================================
// COMPONENT PROPS
// ============================================

export interface KnowledgeBaseGeneratorProps {
  campaignId: string
  projectId: string
  competitorName: string
  scraperInputs: Partial<CampaignVariables>
  existingDocuments?: Document[]
  onDocumentGenerated?: (documentId: string, sourceType: SourceType) => void
  onComplete?: () => void
  onSkip?: () => void
}

export interface DocumentGeneratorCardProps {
  requirement: DocumentRequirement
  competitorName: string
  projectId: string
  campaignId: string
  scraperInput?: string
  existingDocument?: ExistingDocumentOption
  status: 'available' | 'missing' | 'in_progress'
  onGenerate: (sourceType: SourceType, input: Record<string, any>) => Promise<void>
  onUseExisting: (documentId: string) => void
  onSkip?: () => void
}

export interface DeepResearchLauncherProps {
  campaignId: string
  projectId: string
  competitorName: string
  industry: string
  country?: string
  onComplete: (documentId: string) => void
  onError?: (error: Error) => void
}
