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
 */
export type StepType =
  | 'input'
  | 'suggestion'
  | 'auto'
  | 'auto_with_preview'
  | 'auto_with_review'
  | 'decision'
  | 'display'
  | 'action'
  | 'manual_research'
  | 'manual_review'

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
  onBack: () => void
  onExecute: (input?: any) => Promise<void>
  onUpdateState: (update: Partial<StepState>) => void
  onEdit?: () => void       // Volver a editar un paso completado
  onCancel?: () => void     // Cancelar ejecución en curso
  isFirst: boolean
  isLast: boolean
}
