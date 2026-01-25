// Unified Playbook Architecture
// Export all components and types for the dual-panel playbook system

// Main components
export { default as PlaybookShell } from './PlaybookShell'
export { default as NavigationPanel } from './NavigationPanel'
export { WorkArea } from './WorkArea'
export { default as ConfigurationMode } from './ConfigurationMode'
export { default as CampaignWizard } from './CampaignWizard'
export { default as StartSessionDialog } from './StartSessionDialog'
export { default as AllSessionsPanel } from './AllSessionsPanel'
export { default as PlaybookStepContainer } from './PlaybookStepContainer'
export type { PlaybookStepContainerProps } from './PlaybookStepContainer'
export { default as SavedIndicator } from './SavedIndicator'
export type { SavedIndicatorProps } from './SavedIndicator'

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
export { playbookConfigs, getPlaybookConfig, nicheFinderConfig, videoViralIAConfig } from './configs'
