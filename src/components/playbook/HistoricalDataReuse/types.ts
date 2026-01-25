/**
 * Historical Data Reuse Types
 *
 * Types for reusing data from previous sessions to avoid
 * repeating expensive operations like SERP searches and scraping.
 */

import { ArtifactType } from '../ArtifactBrowser/types'

export interface HistoricalSession {
  id: string
  name: string | null
  playbookType: string
  status: string
  tags: string[] | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  variables: Record<string, unknown>
}

export interface HistoricalArtifact {
  id: string
  sessionId: string
  sessionName: string | null
  sessionCreatedAt: string
  stepId: string
  stepName: string
  type: ArtifactType
  name: string
  description?: string

  // Content
  content: unknown
  contentType: 'text' | 'markdown' | 'json' | 'table' | 'list'

  // Metadata
  createdAt: string
  itemCount?: number
  wordCount?: number
  size?: number

  // Session context
  playbookType: string
  variables?: Record<string, unknown>
  tags?: string[] | null
}

export interface ImportedDataReference {
  sourceSessionId: string
  sourceSessionName: string | null
  sourceStepId: string
  sourceStepName: string
  sourceArtifactId: string
  importedAt: string
  artifactType: ArtifactType
}

export interface HistoricalDataFilter {
  searchQuery: string
  sessionName: string
  dateFrom: string | null
  dateTo: string | null
  tags: string[]
  stepIds: string[]
  types: ArtifactType[]
  playbookType?: string
}

export interface HistoricalDataImportResult {
  success: boolean
  artifact: HistoricalArtifact
  reference: ImportedDataReference
}

// Step compatibility configuration
// Maps step IDs to compatible artifact types that can be imported
export const STEP_ARTIFACT_COMPATIBILITY: Record<string, ArtifactType[]> = {
  // SERP Search steps - can import previous search results
  'serp_search': ['serp_results'],
  'find_creators': ['serp_results', 'extracted_data'],

  // Scraping steps - can import previous scraped content
  'scrape': ['scraped_content'],
  'scrape_posts': ['scraped_content', 'extracted_data'],
  'scrape_engagers': ['scraped_content', 'extracted_data'],

  // Extraction steps - can import previous extractions
  'extract_problems': ['extracted_data', 'scraped_content'],
  'evaluate_creators': ['extracted_data', 'analysis'],
  'evaluate_posts': ['extracted_data', 'analysis'],
  'filter_icp': ['extracted_data', 'analysis'],

  // Analysis steps - can import previous analysis
  'clean_filter': ['analysis', 'extracted_data'],
  'deep_research_manual': ['analysis', 'extracted_data'],
  'consolidate': ['analysis', 'extracted_data'],

  // Generation steps - can import previous generated content
  'map_topics': ['suggestions', 'generated_content'],
  'lead_magnet_messages': ['generated_content', 'suggestions'],
  'generate_idea': ['generated_content', 'suggestions'],
  'generate_scenes': ['generated_content'],

  // Default: most steps can import step_output
  'default': ['step_output', 'extracted_data', 'analysis'],
}

// Human-readable step names
export const STEP_DISPLAY_NAMES: Record<string, string> = {
  'serp_search': 'SERP Search',
  'find_creators': 'Find Creators',
  'scrape': 'Scrape Pages',
  'scrape_posts': 'Scrape Posts',
  'scrape_engagers': 'Scrape Engagers',
  'extract_problems': 'Extract Problems',
  'evaluate_creators': 'Evaluate Creators',
  'evaluate_posts': 'Evaluate Posts',
  'filter_icp': 'Filter ICP',
  'clean_filter': 'Clean & Filter',
  'deep_research_manual': 'Deep Research',
  'consolidate': 'Consolidate',
  'map_topics': 'Map Topics',
  'lead_magnet_messages': 'Lead Magnet Messages',
  'generate_idea': 'Generate Idea',
  'generate_scenes': 'Generate Scenes',
}

// Steps that commonly benefit from historical data reuse
export const REUSABLE_STEP_CATEGORIES: Record<string, string[]> = {
  'Expensive Operations': [
    'serp_search',
    'scrape',
    'scrape_posts',
    'scrape_engagers',
  ],
  'AI Analysis': [
    'extract_problems',
    'evaluate_creators',
    'evaluate_posts',
    'filter_icp',
  ],
  'Content Generation': [
    'map_topics',
    'lead_magnet_messages',
    'generate_idea',
  ],
}

export function getCompatibleArtifactTypes(stepId: string): ArtifactType[] {
  return STEP_ARTIFACT_COMPATIBILITY[stepId] || STEP_ARTIFACT_COMPATIBILITY['default']
}

export function getStepDisplayName(stepId: string): string {
  return STEP_DISPLAY_NAMES[stepId] || stepId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}
