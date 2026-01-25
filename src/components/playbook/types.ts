// Types for the unified playbook architecture with dual panel layout

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'error'
export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'error'

/**
 * Step types determine how the WorkArea renders and behaves:
 * - input: User must enter data (minimize these)
 * - suggestion: System suggests, user selects/edits
 * - auto: Executes without stopping
 * - auto_with_preview: Shows preview before continuing
 * - auto_with_review: Executes and shows result for optional review
 * - decision: User must make a decision (pause here)
 * - display: Only shows information
 * - action: User performs an action (e.g., export)
 * - manual_research: User performs manual research with external tools (e.g., ChatGPT/Perplexity)
 * - manual_review: User must review and approve before continuing (e.g., preview queries before SERP)
 * - search_with_preview: Shows search config preview with ability to adjust, then executes search
 * - review_with_action: Shows results for review/selection, then executes action on selected items
 */
export type StepType =
  | 'input'
  | 'suggestion'
  | 'auto'
  | 'auto_with_preview'
  | 'auto_with_review'
  | 'decision'
  | 'display'
  | 'display_scrape_results'
  | 'extract_with_preview' // Shows scraped URLs + extraction button + results table
  | 'action'
  | 'manual_research'
  | 'manual_review'
  | 'search_with_preview'
  | 'review_with_action'
  | 'unified_keyword_config' // Unified panel for keywords, indicators, and sources
  | 'unified_search_extract' // All-in-one: SERP → show URLs → scrape → extract

/**
 * Executor type determines how the step is executed:
 * - llm: Uses /api/playbook/execute-step with LLM
 * - job: Uses background job system (like Niche Finder scraping)
 * - api: Calls a specific API endpoint
 * - custom: Custom logic defined in the playbook
 * - none: No execution needed (display/input steps)
 */
export type ExecutorType = 'llm' | 'job' | 'api' | 'custom' | 'none'

export interface StepDefinition {
  id: string
  name: string
  description?: string
  type: StepType
  executor: ExecutorType

  // Required API keys - will show setup modal if not configured
  // e.g., ['blotato', 'wavespeed'] or ['serper', 'firecrawl']
  requiredApiKeys?: string[]

  // For LLM executor
  promptKey?: string

  // For job executor
  jobType?: string

  // For API executor
  apiEndpoint?: string

  // Dependencies
  dependsOn?: string[]

  // For suggestion type
  suggestionConfig?: {
    generateFrom: 'project' | 'previous_step' | 'api' | 'llm' | 'fixed'
    apiEndpoint?: string
    fixedOptionsKey?: string // For 'fixed' - key to identify which lists to load
    allowAdd?: boolean
    allowEdit?: boolean
    minSelections?: number
    maxSelections?: number
  }

  // For decision type
  decisionConfig?: {
    question: string
    optionsFrom: 'previous_step' | 'api' | 'fixed'
    fixedOptions?: Array<{ id: string; label: string; description?: string }>
    multiSelect?: boolean
    minSelections?: number
    maxSelections?: number
    defaultSelection?: string | string[]
  }

  // For action type
  actionConfig?: {
    label: string
    actionType: 'export' | 'save' | 'navigate' | 'custom'
    customHandler?: string
  }

  // Explanation shown before executing auto steps
  // Helps user understand what the step will do
  executionExplanation?: {
    title: string
    steps: string[] // List of what the step will do
    estimatedTime?: string
    estimatedCost?: string
    costService?: string // e.g., "Serper API", "Firecrawl"
  }

  // Guidance configuration for the step container
  // Provides clear instructions to users about what the step does and what they need to do
  guidance?: StepGuidance
}

/**
 * Step guidance configuration
 * Displayed in the PlaybookStepContainer to help users understand:
 * - What this step does (description)
 * - What actions they need to take (userActions)
 * - What conditions must be met to proceed (completionCriteria)
 */
export interface StepGuidance {
  /** Brief description of what this step accomplishes */
  description: string
  /** List of actions the user needs to take in this step */
  userActions: string[]
  /**
   * Completion criteria - defines when the "Next" button should be enabled
   * Can be a simple description or structured criteria
   */
  completionCriteria: StepCompletionCriteria
}

/**
 * Defines completion criteria for a step
 */
export interface StepCompletionCriteria {
  /** Human-readable description of what needs to be done */
  description: string
  /** Type of validation to perform */
  type: 'manual' | 'input_required' | 'selection_required' | 'auto_complete' | 'custom'
  /** Minimum number of items/characters required (for input_required or selection_required) */
  minCount?: number
  /** Custom validation function name (for custom type) */
  customValidator?: string
}

export interface PhaseDefinition {
  id: string
  name: string
  description?: string
  steps: StepDefinition[]
}

export interface PlaybookConfig {
  id: string
  type: string // playbook_type from database
  name: string
  description?: string
  icon?: string
  phases: PhaseDefinition[]

  // Variables needed for this playbook
  variables?: Array<{
    key: string
    label: string
    type: 'text' | 'textarea' | 'select' | 'multiselect' | 'number'
    required?: boolean
    defaultValue?: any
    description?: string
    placeholder?: string
    options?: Array<{ value: string; label: string }>
    // For number type
    min?: number
    max?: number
  }>
}

// Runtime state types

export interface StepState {
  id: string
  status: StepStatus
  startedAt?: Date
  completedAt?: Date
  error?: string

  // Input/output data
  input?: any
  output?: any

  // For suggestion steps
  suggestions?: Array<{ id: string; label: string; selected: boolean; description?: string; category?: string; contextType?: 'b2c' | 'b2b' }>

  // For decision steps
  decision?: any

  // Progress for auto steps
  progress?: {
    current: number
    total: number
    label?: string
    estimatedTimeRemaining?: string
  }

  // Partial results shown during execution
  partialResults?: {
    lastItems?: string[] // Last few items found/processed
    successCount?: number
    failedCount?: number
    lastSnippet?: string // Last content snippet (for scraping)
    lastUrl?: string // Last URL processed
    extracted?: number // Count of successfully extracted items (for extraction step)
    filtered?: number // Count of filtered/ignored items (for extraction step)
  }
}

export interface PhaseState {
  id: string
  status: PhaseStatus
  steps: StepState[]
}

export interface PlaybookState {
  projectId: string
  playbookType: string
  phases: PhaseState[]
  currentPhaseIndex: number
  currentStepIndex: number

  // Configuration values
  config: Record<string, any>

  // Overall progress
  completedSteps: number
  totalSteps: number

  // Timestamps
  startedAt?: Date
  completedAt?: Date
}

// Utility types

export interface PlaybookContext {
  projectId: string
  playbookConfig: PlaybookConfig
  state: PlaybookState

  // Actions
  goToStep: (phaseIndex: number, stepIndex: number) => void
  executeStep: (stepId: string, input?: any) => Promise<void>
  updateStepState: (stepId: string, update: Partial<StepState>) => void
  saveConfig: (config: Record<string, any>) => Promise<void>

  // Status helpers
  canExecuteStep: (stepId: string) => boolean
  getStepState: (stepId: string) => StepState | undefined
  getCurrentStep: () => { phase: PhaseDefinition; step: StepDefinition } | null
}

// Props types for components

export interface PlaybookShellProps {
  projectId: string
  playbookConfig: PlaybookConfig
  initialState?: Partial<PlaybookState>
  sessionId?: string
}

export interface NavigationPanelProps {
  phases: PhaseDefinition[]
  phaseStates: PhaseState[]
  currentPhaseIndex: number
  currentStepIndex: number
  onStepClick: (phaseIndex: number, stepIndex: number) => void
}

export interface WorkAreaProps {
  step: StepDefinition
  stepState: StepState
  onContinue: () => void
  onBack?: () => void
  onExecute: (input?: any) => Promise<void>
  onUpdateState: (update: Partial<StepState>) => void
  onEdit?: () => void           // Volver a editar un paso completado
  onCancel?: () => void         // Cancelar ejecución en curso
  onRerunPrevious?: () => void  // Re-ejecutar el paso anterior (para decisiones de regenerar)
  onRetry?: () => void          // Retry the current step after an error
  isFirst: boolean
  isLast: boolean
  previousStepOutput?: unknown  // Output from the previous step
  projectId?: string            // Project ID for API calls
  playbookContext?: Record<string, unknown>  // Context with all previous step outputs
  allSteps?: Array<{ definition: StepDefinition; state: StepState }>  // All steps info for inspection panel
}
