// Unified Playbook Architecture
// Export all components and types for the dual-panel playbook system

// Main components
export { default as PlaybookShell } from './PlaybookShell'
export { default as NavigationPanel } from './NavigationPanel'
export { default as WorkArea } from './WorkArea'

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
} from './types'

// Configurations
export { playbookConfigs, getPlaybookConfig, nicheFinderConfig } from './configs'
