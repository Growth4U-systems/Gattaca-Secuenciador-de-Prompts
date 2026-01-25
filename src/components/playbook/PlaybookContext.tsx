'use client'

import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useMemo,
} from 'react'
import {
  PlaybookConfig,
  PlaybookState,
  StepState,
  StepDefinition,
  PhaseDefinition,
  StepRetryInfo,
} from './types'
import { StepPersistenceState, StepPersistenceActions } from '@/hooks/useStepPersistence'
import { StepRetryState, StepRetryActions } from '@/hooks/useStepRetry'

/**
 * Data available in the playbook context for child components
 */
export interface PlaybookContextData {
  // Core identifiers
  projectId: string
  sessionId: string | null

  // Configuration
  playbookConfig: PlaybookConfig

  // Current state
  state: PlaybookState
  currentPhase: PhaseDefinition | null
  currentStep: StepDefinition | null
  currentStepState: StepState | null

  // Navigation info
  currentPhaseIndex: number
  currentStepIndex: number
  isFirstStep: boolean
  isLastStep: boolean

  // Progress info
  completedSteps: number
  totalSteps: number
  progressPercentage: number

  // Persistence state
  saveState: StepPersistenceState
  retryState: StepRetryState
}

/**
 * Actions available in the playbook context for child components
 */
export interface PlaybookContextActions {
  // Navigation
  goToStep: (phaseIndex: number, stepIndex: number) => void
  goToNextStep: () => void
  goToPreviousStep: () => void

  // Step state management
  updateStepState: (stepId: string, update: Partial<StepState>) => void
  markStepComplete: (stepId: string, output?: unknown) => void
  markStepFailed: (stepId: string, error: string) => void
  markStepInProgress: (stepId: string, input?: unknown) => void

  // Data access
  getStepState: (stepId: string) => StepState | undefined
  getStepOutput: (stepId: string) => unknown | undefined
  getPreviousStepOutput: () => unknown | undefined
  buildPlaybookContext: () => Record<string, unknown>

  // Persistence actions
  saveStepOutput: (stepId: string, output: unknown) => Promise<void>
  scheduleAutoSave: (stepId: string, output: unknown) => void

  // Retry actions
  canRetry: (stepId: string) => boolean
  getRetryInfo: (stepId: string) => StepRetryInfo | null
  startRetry: (stepId: string, configOverrides?: Record<string, unknown>) => Promise<void>
}

/**
 * Combined context value
 */
export interface PlaybookContextValue {
  data: PlaybookContextData
  actions: PlaybookContextActions
}

// Create the context with undefined default
const PlaybookReactContext = createContext<PlaybookContextValue | undefined>(undefined)

/**
 * Props for the PlaybookContextProvider
 */
export interface PlaybookContextProviderProps {
  children: ReactNode
  projectId: string
  sessionId: string | null
  playbookConfig: PlaybookConfig
  state: PlaybookState

  // Navigation callbacks
  onGoToStep: (phaseIndex: number, stepIndex: number) => void
  onGoToNextStep: () => void
  onGoToPreviousStep: () => void

  // State update callback
  onUpdateStepState: (stepId: string, update: Partial<StepState>) => void

  // Context builder callback
  onBuildPlaybookContext: () => Record<string, unknown>

  // Persistence hooks
  persistenceState: StepPersistenceState
  persistenceActions: StepPersistenceActions
  retryState: StepRetryState
  retryActions: StepRetryActions
}

/**
 * PlaybookContextProvider - Provides playbook data and actions to child components
 *
 * This provider wraps the playbook content and makes session data, step state,
 * and various actions available via React Context. Child components can access
 * this data using the usePlaybook() hook.
 */
export function PlaybookContextProvider({
  children,
  projectId,
  sessionId,
  playbookConfig,
  state,
  onGoToStep,
  onGoToNextStep,
  onGoToPreviousStep,
  onUpdateStepState,
  onBuildPlaybookContext,
  persistenceState,
  persistenceActions,
  retryState,
  retryActions,
}: PlaybookContextProviderProps) {
  // Calculate derived values
  const currentPhase = playbookConfig.phases[state.currentPhaseIndex] ?? null
  const currentStep = currentPhase?.steps[state.currentStepIndex] ?? null
  const currentStepState = state.phases[state.currentPhaseIndex]?.steps[state.currentStepIndex] ?? null

  const isFirstStep = state.currentPhaseIndex === 0 && state.currentStepIndex === 0
  const isLastStep =
    state.currentPhaseIndex === playbookConfig.phases.length - 1 &&
    state.currentStepIndex === (currentPhase?.steps.length ?? 1) - 1

  const totalSteps = playbookConfig.phases.reduce(
    (sum, phase) => sum + phase.steps.length,
    0
  )
  const completedSteps = state.phases.reduce(
    (sum, phase) => sum + phase.steps.filter(s => s.status === 'completed').length,
    0
  )
  const progressPercentage = totalSteps > 0
    ? Math.round((completedSteps / totalSteps) * 100)
    : 0

  // Get step state by ID
  const getStepState = useCallback((stepId: string): StepState | undefined => {
    for (const phase of state.phases) {
      const stepState = phase.steps.find(s => s.id === stepId)
      if (stepState) return stepState
    }
    return undefined
  }, [state.phases])

  // Get step output by ID
  const getStepOutput = useCallback((stepId: string): unknown | undefined => {
    const stepState = getStepState(stepId)
    return stepState?.output
  }, [getStepState])

  // Get previous step output
  const getPreviousStepOutput = useCallback((): unknown | undefined => {
    if (!currentStep?.dependsOn?.length) return undefined

    const dependencyId = currentStep.dependsOn[0]
    return getStepOutput(dependencyId)
  }, [currentStep, getStepOutput])

  // Mark step as complete
  const markStepComplete = useCallback((stepId: string, output?: unknown) => {
    onUpdateStepState(stepId, {
      status: 'completed',
      completedAt: new Date(),
      output,
      error: undefined,
    })
  }, [onUpdateStepState])

  // Mark step as failed
  const markStepFailed = useCallback((stepId: string, error: string) => {
    onUpdateStepState(stepId, {
      status: 'error',
      error,
    })
  }, [onUpdateStepState])

  // Mark step as in progress
  const markStepInProgress = useCallback((stepId: string, input?: unknown) => {
    onUpdateStepState(stepId, {
      status: 'in_progress',
      startedAt: new Date(),
      input,
      error: undefined,
    })
  }, [onUpdateStepState])

  // Save step output
  const saveStepOutput = useCallback(async (stepId: string, output: unknown) => {
    await persistenceActions.saveStepOutput(stepId, output)
  }, [persistenceActions])

  // Schedule auto-save
  const scheduleAutoSave = useCallback((stepId: string, output: unknown) => {
    persistenceActions.scheduleAutoSave(stepId, output)
  }, [persistenceActions])

  // Check if can retry
  const canRetry = useCallback((stepId: string): boolean => {
    return retryActions.canRetry(stepId)
  }, [retryActions])

  // Get retry info
  const getRetryInfo = useCallback((stepId: string): StepRetryInfo | null => {
    return retryActions.getRetryInfo(stepId)
  }, [retryActions])

  // Start retry
  const startRetry = useCallback(async (stepId: string, configOverrides?: Record<string, unknown>) => {
    await retryActions.startRetry(stepId, configOverrides)
  }, [retryActions])

  // Build context data
  const data: PlaybookContextData = useMemo(() => ({
    projectId,
    sessionId,
    playbookConfig,
    state,
    currentPhase,
    currentStep,
    currentStepState,
    currentPhaseIndex: state.currentPhaseIndex,
    currentStepIndex: state.currentStepIndex,
    isFirstStep,
    isLastStep,
    completedSteps,
    totalSteps,
    progressPercentage,
    saveState: persistenceState,
    retryState,
  }), [
    projectId,
    sessionId,
    playbookConfig,
    state,
    currentPhase,
    currentStep,
    currentStepState,
    isFirstStep,
    isLastStep,
    completedSteps,
    totalSteps,
    progressPercentage,
    persistenceState,
    retryState,
  ])

  // Build context actions
  const actions: PlaybookContextActions = useMemo(() => ({
    goToStep: onGoToStep,
    goToNextStep: onGoToNextStep,
    goToPreviousStep: onGoToPreviousStep,
    updateStepState: onUpdateStepState,
    markStepComplete,
    markStepFailed,
    markStepInProgress,
    getStepState,
    getStepOutput,
    getPreviousStepOutput,
    buildPlaybookContext: onBuildPlaybookContext,
    saveStepOutput,
    scheduleAutoSave,
    canRetry,
    getRetryInfo,
    startRetry,
  }), [
    onGoToStep,
    onGoToNextStep,
    onGoToPreviousStep,
    onUpdateStepState,
    markStepComplete,
    markStepFailed,
    markStepInProgress,
    getStepState,
    getStepOutput,
    getPreviousStepOutput,
    onBuildPlaybookContext,
    saveStepOutput,
    scheduleAutoSave,
    canRetry,
    getRetryInfo,
    startRetry,
  ])

  const contextValue: PlaybookContextValue = useMemo(() => ({
    data,
    actions,
  }), [data, actions])

  return (
    <PlaybookReactContext.Provider value={contextValue}>
      {children}
    </PlaybookReactContext.Provider>
  )
}

/**
 * usePlaybook - Hook to access playbook context in child components
 *
 * @throws Error if used outside of PlaybookContextProvider
 *
 * @example
 * ```tsx
 * function MyStepComponent() {
 *   const { data, actions } = usePlaybook()
 *
 *   const handleComplete = () => {
 *     actions.markStepComplete(data.currentStep.id, { result: 'success' })
 *     actions.goToNextStep()
 *   }
 *
 *   return (
 *     <div>
 *       <p>Step: {data.currentStep.name}</p>
 *       <p>Progress: {data.progressPercentage}%</p>
 *       <button onClick={handleComplete}>Complete</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function usePlaybook(): PlaybookContextValue {
  const context = useContext(PlaybookReactContext)

  if (context === undefined) {
    throw new Error('usePlaybook must be used within a PlaybookContextProvider')
  }

  return context
}

/**
 * usePlaybookData - Hook to access only playbook data (no actions)
 * Useful for components that only need to read state
 */
export function usePlaybookData(): PlaybookContextData {
  const { data } = usePlaybook()
  return data
}

/**
 * usePlaybookActions - Hook to access only playbook actions (no data)
 * Useful for components that only need to trigger actions
 */
export function usePlaybookActions(): PlaybookContextActions {
  const { actions } = usePlaybook()
  return actions
}

/**
 * useCurrentStep - Hook to access current step info
 */
export function useCurrentStep() {
  const { data } = usePlaybook()
  return {
    step: data.currentStep,
    stepState: data.currentStepState,
    phase: data.currentPhase,
    phaseIndex: data.currentPhaseIndex,
    stepIndex: data.currentStepIndex,
    isFirst: data.isFirstStep,
    isLast: data.isLastStep,
  }
}

/**
 * useStepProgress - Hook to access step progress info
 */
export function useStepProgress() {
  const { data } = usePlaybook()
  return {
    completedSteps: data.completedSteps,
    totalSteps: data.totalSteps,
    progressPercentage: data.progressPercentage,
  }
}

/**
 * useSaveState - Hook to access save state
 */
export function useSaveState() {
  const { data } = usePlaybook()
  return data.saveState
}

export default PlaybookReactContext
