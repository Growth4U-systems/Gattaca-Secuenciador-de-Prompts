// Unified Playbook Architecture
// Export all components and types for the dual-panel playbook system

// Main components
export { default as PlaybookShell } from './PlaybookShell'
export { default as PlaybookShellV2 } from './PlaybookShellV2'
export type { PlaybookShellV2Props, StepRenderProps } from './PlaybookShellV2'
export { default as NavigationPanel } from './NavigationPanel'
export { default as PlaybookWizardNav } from './PlaybookWizardNav'
export type { PlaybookWizardNavProps, WizardStep } from './PlaybookWizardNav'
export { WorkArea } from './WorkArea'
export { default as ConfigurationMode } from './ConfigurationMode'
export { default as CampaignWizard } from './CampaignWizard'
export { default as StartSessionDialog } from './StartSessionDialog'
export { default as AllSessionsPanel } from './AllSessionsPanel'
export { default as PlaybookStepContainer } from './PlaybookStepContainer'
export type { PlaybookStepContainerProps } from './PlaybookStepContainer'
export { default as SessionDataPanel } from './SessionDataPanel'
export { default as SavedIndicator } from './SavedIndicator'
export type { SavedIndicatorProps } from './SavedIndicator'
export { default as StepExecutionProgress } from './StepExecutionProgress'
export type {
  StepExecutionProgressProps,
  ExecutionType,
  ExecutionStatus,
  LogEntry,
  ProgressData,
  PartialResults,
} from './StepExecutionProgress'

// Context and hooks for PlaybookShellV2
export {
  PlaybookContextProvider,
  usePlaybook,
  usePlaybookData,
  usePlaybookActions,
  useCurrentStep,
  useStepProgress,
  useSaveState,
} from './PlaybookContext'
export type {
  PlaybookContextData,
  PlaybookContextActions,
  PlaybookContextValue,
  PlaybookContextProviderProps,
} from './PlaybookContext'

// Types
export type {
  StepStatus,
  PhaseStatus,
  StepType,
  ExecutorType,
  StepDefinition,
  PhaseDefinition,
  PlaybookConfig,
  StepState,
  PhaseState,
  PlaybookState,
  PlaybookContext,
  PlaybookShellProps,
  NavigationPanelProps,
  WorkAreaProps,
  StepGuidance,
  StepCompletionCriteria,
} from './types'

// Configurations
export {
  playbookConfigs,
  getPlaybookConfig,
  nicheFinderConfig,
  videoViralIAConfig,
  seoSeedKeywordsConfig,
  linkedinPostGeneratorConfig,
  githubForkToCrmConfig,
} from './configs'
