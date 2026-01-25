/**
 * Artifact Browser Types
 *
 * Types for the session data browser that allows users to explore
 * all artifacts generated during a playbook session.
 */

export type ArtifactType =
  | 'serp_results'      // SERP search results (URLs)
  | 'scraped_content'   // Scraped page content
  | 'extracted_data'    // LLM-extracted structured data
  | 'step_output'       // Regular step output (text/markdown)
  | 'generated_content' // AI-generated content
  | 'analysis'          // Analysis results
  | 'suggestions'       // Generated suggestions
  | 'decision'          // User decisions
  | 'custom'            // Custom data type

export interface Artifact {
  id: string
  type: ArtifactType
  name: string
  description?: string

  // Source information
  stepId: string
  stepName: string
  stepOrder: number

  // Content
  content: unknown  // Can be string, array, or object
  contentType: 'text' | 'markdown' | 'json' | 'table' | 'list'

  // Metadata
  createdAt: string
  itemCount?: number    // For arrays/tables
  wordCount?: number    // For text content
  size?: number         // Content size in bytes

  // Status
  savedToContextLake?: boolean
  contextLakeDocId?: string
}

export interface ArtifactGroup {
  type: ArtifactType
  label: string
  icon: string  // Lucide icon name
  count: number
  artifacts: Artifact[]
  stepId?: string
  stepName?: string
}

export interface SessionArtifacts {
  sessionId: string
  projectId: string
  campaignId?: string
  campaignName?: string
  playbookType: string

  // Grouped by type
  groups: ArtifactGroup[]

  // Total counts
  totalArtifacts: number
  totalSteps: number

  // Timestamps
  sessionStartedAt: string
  lastUpdatedAt: string
}

export interface ArtifactFilter {
  searchQuery: string
  types: ArtifactType[]
  stepIds: string[]
  dateRange?: {
    from: string
    to: string
  }
  savedOnly?: boolean
}

export interface ArtifactViewerState {
  isOpen: boolean
  artifact: Artifact | null
  viewMode: 'preview' | 'full' | 'raw'
}

export interface ExportOptions {
  format: 'csv' | 'json'
  includeMetadata: boolean
  selectedArtifactIds?: string[]
}

// Label mapping for artifact types
export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, { label: string; icon: string; color: string }> = {
  serp_results: { label: 'SERP Results', icon: 'Search', color: 'text-blue-600 bg-blue-50' },
  scraped_content: { label: 'Scraped Content', icon: 'FileText', color: 'text-green-600 bg-green-50' },
  extracted_data: { label: 'Extracted Data', icon: 'Database', color: 'text-purple-600 bg-purple-50' },
  step_output: { label: 'Step Output', icon: 'Sparkles', color: 'text-indigo-600 bg-indigo-50' },
  generated_content: { label: 'Generated Content', icon: 'Wand2', color: 'text-pink-600 bg-pink-50' },
  analysis: { label: 'Analysis', icon: 'BarChart3', color: 'text-orange-600 bg-orange-50' },
  suggestions: { label: 'Suggestions', icon: 'Lightbulb', color: 'text-yellow-600 bg-yellow-50' },
  decision: { label: 'Decisions', icon: 'GitBranch', color: 'text-teal-600 bg-teal-50' },
  custom: { label: 'Other', icon: 'Package', color: 'text-gray-600 bg-gray-50' },
}
