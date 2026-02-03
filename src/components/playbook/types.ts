// Types for the unified playbook architecture with dual panel layout

import type { FlowConfig } from '@/types/flow.types'

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

/**
 * Preview output type for the intro screen
 * Shows users what they'll get from the playbook
 */
export type PreviewOutputType = 'linkedin-post' | 'report' | 'data' | 'keywords' | 'custom'

/**
 * Presentation metadata for the playbook intro screen
 * Helps users understand what the playbook does before starting
 */
export interface PlaybookPresentation {
  /** Short tagline describing the playbook (e.g., "Genera posts de LinkedIn en minutos") */
  tagline: string
  /** List of benefits/outputs the user will get */
  valueProposition: string[]
  /** Optional example of what the output looks like */
  exampleOutput?: {
    type: PreviewOutputType
    preview: {
      text?: string
      imageUrl?: string
      /** Component name for custom previews */
      customComponent?: string
    }
  }
  /** Estimated time to complete (e.g., "2-3 minutos") */
  estimatedTime: string
  /** Estimated cost (e.g., "~$0.05 USD") */
  estimatedCost: string
  /** Required services/APIs with their status */
  requiredServices?: Array<{
    key: string // API key service name (e.g., 'openrouter', 'dumpling')
    name: string // Display name (e.g., 'OpenRouter', 'Dumpling AI')
    description: string // What it's used for
  }>
}

export interface PlaybookConfig {
  id: string
  type: string // playbook_type from database
  name: string
  description?: string
  icon?: string
  phases: PhaseDefinition[]

  /**
   * Flow configuration with steps and prompts
   * If provided, will be used when creating campaigns from this playbook
   * Falls back to project.flow_config if not present
   */
  flow_config?: FlowConfig | null

  /**
   * Presentation metadata for the intro screen
   * Communicates value and sets expectations before user starts
   */
  presentation?: PlaybookPresentation

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

  // Retry tracking for failed steps
  retryInfo?: StepRetryInfo
}

/**
 * Retry information for tracking step execution attempts
 */
export interface StepRetryInfo {
  /** Current attempt number (1-based) */
  attemptNumber: number
  /** Maximum allowed attempts before suggesting alternative actions */
  maxAttempts: number
  /** History of all attempts for this step */
  attempts: StepAttempt[]
}

/**
 * Individual step execution attempt record
 */
export interface StepAttempt {
  /** Unique identifier for this attempt */
  attemptId: string
  /** Attempt number (1-based) */
  attemptNumber: number
  /** When this attempt started */
  startedAt: Date
  /** When this attempt ended (null if still running) */
  endedAt?: Date
  /** Status of this attempt */
  status: 'running' | 'completed' | 'failed'
  /** Error message if failed */
  errorMessage?: string
  /** Configuration used for this attempt (useful for tracking changes) */
  configSnapshot?: StepAttemptConfig
  /** Output data if completed */
  output?: unknown
}

/**
 * Configuration snapshot for a step attempt
 * Allows users to modify settings before retry
 */
export interface StepAttemptConfig {
  /** Model override (e.g., switch from gpt-4 to gpt-4-turbo) */
  model?: string
  /** Temperature override for LLM steps */
  temperature?: number
  /** Max tokens override */
  maxTokens?: number
  /** Timeout override in milliseconds */
  timeout?: number
  /** Custom parameters specific to the step type */
  customParams?: Record<string, unknown>
}

/**
 * Retry configuration for step execution
 */
export interface StepRetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number
  /** Whether to allow config modification before retry (default: true) */
  allowConfigModification?: boolean
  /** Available models for retry (if different from default) */
  availableModels?: string[]
  /** Default retry delay in milliseconds (default: 0 - immediate) */
  retryDelay?: number
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
  /**
   * If true, use horizontal wizard-style navigation instead of vertical navigation panel
   * Default: false (uses NavigationPanel)
   */
  useWizardNav?: boolean
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
  onRetry?: () => void          // Quick retry the current step after an error
  onRetryWithConfig?: () => void // Open retry dialog with config modification
  onSkipStep?: () => void       // Skip the current step after max retries
  isFirst: boolean
  isLast: boolean
  previousStepOutput?: unknown  // Output from the previous step
  projectId?: string            // Project ID for API calls
  playbookContext?: Record<string, unknown>  // Context with all previous step outputs
  playbookConfig?: PlaybookConfig  // Full playbook config for input steps
  allSteps?: Array<{ definition: StepDefinition; state: StepState }>  // All steps info for inspection panel
  saveState?: {                 // Auto-save state for showing saved indicator
    isSaving: boolean
    lastSavedAt: Date | null
    saveError: string | null
    isDirty?: boolean
  }
  retryInfo?: StepRetryInfo     // Retry tracking information for the step
  maxRetriesReached?: boolean   // Whether max retries have been reached
  sessionId?: string            // Session ID for support reference
}
