'use client'

import { useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import {
  PlaybookConfig,
  PlaybookState,
  PhaseState,
  StepState,
  StepDefinition,
  PhaseDefinition,
} from './types'
import PlaybookWizardNav from './PlaybookWizardNav'
import NavigationPanel from './NavigationPanel'
import PlaybookStepContainer from './PlaybookStepContainer'
import SessionDataPanel from './SessionDataPanel'
import { PlaybookContextProvider } from './PlaybookContext'
import { useStepPersistence } from '@/hooks/useStepPersistence'
import { useStepRetry } from '@/hooks/useStepRetry'
import { WorkArea } from './WorkArea'
import { Database, PanelRightClose, PanelRightOpen } from 'lucide-react'

/**
 * Props for PlaybookShellV2
 */
export interface PlaybookShellV2Props {
  /** Project ID for the playbook session */
  projectId: string

  /** Playbook configuration defining phases and steps */
  playbookConfig: PlaybookConfig

  /** Optional initial state for resuming sessions */
  initialState?: Partial<PlaybookState>

  /** Session ID for persistence (enables auto-save) */
  sessionId?: string

  /**
   * Navigation style
   * - 'wizard': Horizontal stepper navigation (default)
   * - 'panel': Vertical tree-style navigation panel
   */
  navigationStyle?: 'wizard' | 'panel'

  /**
   * Whether to show the session data panel
   * @default true
   */
  showSessionPanel?: boolean

  /**
   * Custom step renderer - if provided, replaces the default WorkArea
   * Receives the current step definition and state
   */
  renderStep?: (props: StepRenderProps) => ReactNode

  /**
   * Callback when a step is completed
   */
  onStepComplete?: (stepId: string, output: unknown) => void

  /**
   * Callback when the playbook is completed
   */
  onPlaybookComplete?: () => void

  /**
   * Callback when step state changes
   */
  onStepStateChange?: (stepId: string, state: StepState) => void
}

/**
 * Props passed to custom step renderers
 */
export interface StepRenderProps {
  /** Current step definition */
  step: StepDefinition

  /** Current step state */
  stepState: StepState

  /** Current phase definition */
  phase: PhaseDefinition

  /** Whether this is the first step */
  isFirst: boolean

  /** Whether this is the last step */
  isLast: boolean

  /** Callback to continue to next step */
  onContinue: () => void

  /** Callback to go back to previous step */
  onBack: () => void

  /** Callback to execute the step */
  onExecute: (input?: unknown) => Promise<void>

  /** Callback to update step state */
  onUpdateState: (update: Partial<StepState>) => void

  /** Project ID */
  projectId: string

  /** Session ID */
  sessionId?: string

  /** Previous step output */
  previousStepOutput?: unknown

  /** Full playbook context data */
  playbookContext: Record<string, unknown>
}

/**
 * Initialize playbook state from config and optional initial state
 */
function initializeState(
  projectId: string,
  playbookConfig: PlaybookConfig,
  initialState?: Partial<PlaybookState>
): PlaybookState {
  const phases: PhaseState[] = playbookConfig.phases.map(phase => ({
    id: phase.id,
    status: 'pending',
    steps: phase.steps.map(step => ({
      id: step.id,
      status: 'pending',
    })),
  }))

  // Apply initial state if provided - match by ID for robustness
  if (initialState?.phases) {
    initialState.phases.forEach(savedPhaseState => {
      const phaseIndex = phases.findIndex(p => p.id === savedPhaseState.id)
      if (phaseIndex === -1) return

      phases[phaseIndex].status = savedPhaseState.status
      savedPhaseState.steps.forEach(savedStepState => {
        const stepIndex = phases[phaseIndex].steps.findIndex(s => s.id === savedStepState.id)
        if (stepIndex === -1) return

        phases[phaseIndex].steps[stepIndex] = {
          ...phases[phaseIndex].steps[stepIndex],
          ...savedStepState,
        }
      })
    })
  }

  const totalSteps = playbookConfig.phases.reduce((sum, phase) => sum + phase.steps.length, 0)
  const completedSteps = phases.reduce(
    (sum, phase) => sum + phase.steps.filter(s => s.status === 'completed').length,
    0
  )

  // Validate and set current indices
  let currentPhaseIndex = initialState?.currentPhaseIndex ?? 0
  let currentStepIndex = initialState?.currentStepIndex ?? 0

  // Ensure indices are within bounds
  if (currentPhaseIndex >= playbookConfig.phases.length) {
    currentPhaseIndex = Math.max(0, playbookConfig.phases.length - 1)
  }
  const currentPhaseSteps = playbookConfig.phases[currentPhaseIndex]?.steps.length ?? 0
  if (currentStepIndex >= currentPhaseSteps) {
    currentStepIndex = Math.max(0, currentPhaseSteps - 1)
  }

  // Find first non-completed step if current position is invalid
  if (currentPhaseSteps === 0 || currentStepIndex < 0) {
    outer: for (let pi = 0; pi < phases.length; pi++) {
      for (let si = 0; si < phases[pi].steps.length; si++) {
        if (phases[pi].steps[si].status !== 'completed') {
          currentPhaseIndex = pi
          currentStepIndex = si
          break outer
        }
      }
    }
  }

  return {
    projectId,
    playbookType: playbookConfig.type,
    phases,
    currentPhaseIndex,
    currentStepIndex,
    config: initialState?.config ?? {},
    completedSteps,
    totalSteps,
    startedAt: initialState?.startedAt ?? new Date(),
    completedAt: initialState?.completedAt,
  }
}

/**
 * PlaybookShellV2 - A reusable wrapper component for any playbook
 *
 * Features:
 * - Session initialization and management
 * - Step navigation (wizard or panel style)
 * - Auto-save with persistence
 * - Progress tracking
 * - Context provider for child components
 * - Session data panel
 *
 * @example
 * ```tsx
 * // Basic usage with default WorkArea
 * <PlaybookShellV2
 *   projectId={projectId}
 *   playbookConfig={myPlaybookConfig}
 *   sessionId={sessionId}
 * />
 *
 * // With custom step renderer
 * <PlaybookShellV2
 *   projectId={projectId}
 *   playbookConfig={myPlaybookConfig}
 *   sessionId={sessionId}
 *   renderStep={({ step, stepState, onContinue }) => (
 *     <MyCustomStep step={step} state={stepState} onComplete={onContinue} />
 *   )}
 * />
 * ```
 */
export default function PlaybookShellV2({
  projectId,
  playbookConfig,
  initialState,
  sessionId,
  navigationStyle = 'wizard',
  showSessionPanel = true,
  renderStep,
  onStepComplete,
  onPlaybookComplete,
  onStepStateChange,
}: PlaybookShellV2Props) {
  // Initialize state
  const [state, setState] = useState<PlaybookState>(() =>
    initializeState(projectId, playbookConfig, initialState)
  )

  // Session panel visibility
  const [showDataPanel, setShowDataPanel] = useState(false)

  // Step persistence hook
  const [persistenceState, persistenceActions] = useStepPersistence({
    sessionId: sessionId || null,
    autoSaveInterval: 30000,
    enabled: !!sessionId,
  })

  // Step retry hook
  const [retryState, retryActions] = useStepRetry(sessionId || null, {
    enabled: !!sessionId,
  })

  // Ref to track if we should save
  const shouldSaveRef = useRef(false)

  // Load step data from database on session resume
  useEffect(() => {
    if (!sessionId) return

    const loadStepData = async () => {
      try {
        const savedSteps = await persistenceActions.loadAllSteps()
        if (Object.keys(savedSteps).length === 0) return

        console.log('[PlaybookShellV2] Loaded step data from session:', Object.keys(savedSteps))

        setState(prev => {
          const newPhases = prev.phases.map(phase => ({
            ...phase,
            steps: phase.steps.map(step => {
              const savedStep = savedSteps[step.id]
              if (savedStep) {
                return { ...step, ...savedStep }
              }
              return step
            }),
          }))

          // Recalculate phase status
          newPhases.forEach(phase => {
            const hasError = phase.steps.some(s => s.status === 'error')
            const allCompleted = phase.steps.every(
              s => s.status === 'completed' || s.status === 'skipped'
            )
            const hasInProgress = phase.steps.some(s => s.status === 'in_progress')

            if (hasError) {
              phase.status = 'error'
            } else if (allCompleted) {
              phase.status = 'completed'
            } else if (hasInProgress) {
              phase.status = 'in_progress'
            } else {
              phase.status = 'pending'
            }
          })

          // Recalculate completed steps
          const completedSteps = newPhases.reduce(
            (sum, phase) => sum + phase.steps.filter(s => s.status === 'completed').length,
            0
          )

          // Find first non-completed step
          let currentPhaseIndex = 0
          let currentStepIndex = 0
          outer: for (let pi = 0; pi < newPhases.length; pi++) {
            for (let si = 0; si < newPhases[pi].steps.length; si++) {
              if (newPhases[pi].steps[si].status !== 'completed') {
                currentPhaseIndex = pi
                currentStepIndex = si
                break outer
              }
            }
          }

          return {
            ...prev,
            phases: newPhases,
            completedSteps,
            currentPhaseIndex,
            currentStepIndex,
          }
        })

        // Enable saving after load
        setTimeout(() => {
          shouldSaveRef.current = true
        }, 100)
      } catch (error) {
        console.error('[PlaybookShellV2] Error loading step data:', error)
      }
    }

    loadStepData()
  }, [sessionId, persistenceActions])

  // Get current phase and step
  const currentPhase = playbookConfig.phases[state.currentPhaseIndex]
  const currentStep = currentPhase?.steps[state.currentStepIndex]
  const currentStepState = state.phases[state.currentPhaseIndex]?.steps[state.currentStepIndex]

  // Navigation bounds
  const isFirstStep = state.currentPhaseIndex === 0 && state.currentStepIndex === 0
  const isLastStep =
    state.currentPhaseIndex === playbookConfig.phases.length - 1 &&
    state.currentStepIndex === currentPhase?.steps.length - 1

  // Navigate to specific step
  const goToStep = useCallback((phaseIndex: number, stepIndex: number) => {
    setState(prev => ({
      ...prev,
      currentPhaseIndex: phaseIndex,
      currentStepIndex: stepIndex,
    }))
  }, [])

  // Navigate to next step
  const goToNextStep = useCallback(() => {
    setState(prev => {
      const phase = playbookConfig.phases[prev.currentPhaseIndex]

      if (prev.currentStepIndex < phase.steps.length - 1) {
        return { ...prev, currentStepIndex: prev.currentStepIndex + 1 }
      }

      if (prev.currentPhaseIndex < playbookConfig.phases.length - 1) {
        return {
          ...prev,
          currentPhaseIndex: prev.currentPhaseIndex + 1,
          currentStepIndex: 0,
        }
      }

      // At the end - trigger completion
      if (onPlaybookComplete) {
        onPlaybookComplete()
      }

      return prev
    })
  }, [playbookConfig.phases, onPlaybookComplete])

  // Navigate to previous step
  const goToPreviousStep = useCallback(() => {
    setState(prev => {
      if (prev.currentStepIndex > 0) {
        return { ...prev, currentStepIndex: prev.currentStepIndex - 1 }
      }

      if (prev.currentPhaseIndex > 0) {
        const prevPhase = playbookConfig.phases[prev.currentPhaseIndex - 1]
        return {
          ...prev,
          currentPhaseIndex: prev.currentPhaseIndex - 1,
          currentStepIndex: prevPhase.steps.length - 1,
        }
      }

      return prev
    })
  }, [playbookConfig.phases])

  // Update step state
  const updateStepState = useCallback(
    (stepId: string, update: Partial<StepState>) => {
      // Persist to database if session is active
      if (sessionId) {
        if (update.status === 'in_progress') {
          persistenceActions.markStepRunning(stepId, update.input)
        } else if (update.status === 'completed') {
          persistenceActions.markStepCompleted(stepId, update.output)
        } else if (update.status === 'error') {
          persistenceActions.markStepFailed(stepId, update.error || 'Unknown error')
        } else if (update.output !== undefined) {
          persistenceActions.scheduleAutoSave(stepId, update.output)
        }
      }

      setState(prev => {
        const newPhases = prev.phases.map(phase => ({
          ...phase,
          steps: phase.steps.map(step =>
            step.id === stepId ? { ...step, ...update } : step
          ),
        }))

        // Recalculate phase status
        newPhases.forEach(phase => {
          const hasError = phase.steps.some(s => s.status === 'error')
          const allCompleted = phase.steps.every(
            s => s.status === 'completed' || s.status === 'skipped'
          )
          const hasInProgress = phase.steps.some(s => s.status === 'in_progress')

          if (hasError) {
            phase.status = 'error'
          } else if (allCompleted) {
            phase.status = 'completed'
          } else if (hasInProgress) {
            phase.status = 'in_progress'
          } else {
            phase.status = 'pending'
          }
        })

        const completedSteps = newPhases.reduce(
          (sum, phase) => sum + phase.steps.filter(s => s.status === 'completed').length,
          0
        )

        return { ...prev, phases: newPhases, completedSteps }
      })

      // Trigger callback if step completed
      if (update.status === 'completed' && onStepComplete) {
        onStepComplete(stepId, update.output)
      }

      // Trigger state change callback
      if (onStepStateChange) {
        const newState = state.phases
          .flatMap(p => p.steps)
          .find(s => s.id === stepId)
        if (newState) {
          onStepStateChange(stepId, { ...newState, ...update })
        }
      }
    },
    [sessionId, persistenceActions, onStepComplete, onStepStateChange, state.phases]
  )

  // Build playbook context for LLM/step execution
  const buildPlaybookContext = useCallback((): Record<string, unknown> => {
    const context: Record<string, unknown> = {
      ...state.config,
    }

    // Collect values from completed steps
    for (const phase of state.phases) {
      for (const stepState of phase.steps) {
        if (stepState.status === 'completed' || stepState.decision || stepState.suggestions) {
          if (stepState.decision) {
            context[stepState.id] = stepState.decision
          }
          if (stepState.suggestions?.length) {
            const selectedLabels = stepState.suggestions
              .filter(s => s.selected)
              .map(s => s.label)
            if (selectedLabels.length > 0) {
              context[stepState.id] = selectedLabels
            }
          }
          if (stepState.output) {
            context[`${stepState.id}_output`] = stepState.output
          }
        }
      }
    }

    return context
  }, [state.config, state.phases])

  // Get previous step output
  const getPreviousStepOutput = useCallback((): unknown | undefined => {
    if (!currentStep?.dependsOn?.length) return undefined

    const dependencyId = currentStep.dependsOn[0]
    for (const phase of state.phases) {
      const stepState = phase.steps.find(s => s.id === dependencyId)
      if (stepState?.output) return stepState.output
    }
    return undefined
  }, [currentStep, state.phases])

  // Execute step placeholder - actual execution handled by WorkArea
  const executeStep = useCallback(
    async (input?: unknown) => {
      // Mark step as in progress
      updateStepState(currentStep.id, {
        status: 'in_progress',
        startedAt: new Date(),
        input,
      })
    },
    [currentStep?.id, updateStepState]
  )

  // Render the step content
  const renderStepContent = () => {
    if (!currentStep || !currentStepState) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No step selected
        </div>
      )
    }

    // Use custom renderer if provided
    if (renderStep) {
      return renderStep({
        step: currentStep,
        stepState: currentStepState,
        phase: currentPhase,
        isFirst: isFirstStep,
        isLast: isLastStep,
        onContinue: goToNextStep,
        onBack: goToPreviousStep,
        onExecute: executeStep,
        onUpdateState: (update) => updateStepState(currentStep.id, update),
        projectId,
        sessionId,
        previousStepOutput: getPreviousStepOutput(),
        playbookContext: buildPlaybookContext(),
      })
    }

    // Default: Use WorkArea component
    // Calculate step number for display
    let stepNumber = 0
    for (let pi = 0; pi <= state.currentPhaseIndex; pi++) {
      const phase = playbookConfig.phases[pi]
      if (pi < state.currentPhaseIndex) {
        stepNumber += phase.steps.length
      } else {
        stepNumber += state.currentStepIndex + 1
      }
    }

    return (
      <PlaybookStepContainer
        step={currentStep}
        stepState={currentStepState}
        stepNumber={stepNumber}
        totalSteps={state.totalSteps}
        isFirst={isFirstStep}
        isLast={isLastStep}
        onBack={goToPreviousStep}
        onContinue={goToNextStep}
        saveState={persistenceState}
      >
        <WorkArea
          step={currentStep}
          stepState={currentStepState}
          onContinue={goToNextStep}
          onBack={goToPreviousStep}
          onExecute={executeStep}
          onUpdateState={(update) => updateStepState(currentStep.id, update)}
          isFirst={isFirstStep}
          isLast={isLastStep}
          previousStepOutput={getPreviousStepOutput()}
          projectId={projectId}
          playbookContext={buildPlaybookContext()}
          saveState={persistenceState}
          sessionId={sessionId}
        />
      </PlaybookStepContainer>
    )
  }

  return (
    <PlaybookContextProvider
      projectId={projectId}
      sessionId={sessionId || null}
      playbookConfig={playbookConfig}
      state={state}
      onGoToStep={goToStep}
      onGoToNextStep={goToNextStep}
      onGoToPreviousStep={goToPreviousStep}
      onUpdateStepState={updateStepState}
      onBuildPlaybookContext={buildPlaybookContext}
      persistenceState={persistenceState}
      persistenceActions={persistenceActions}
      retryState={retryState}
      retryActions={retryActions}
    >
      <div className="flex flex-col h-full bg-gray-50">
        {/* Navigation */}
        {navigationStyle === 'wizard' ? (
          <PlaybookWizardNav
            phases={playbookConfig.phases}
            phaseStates={state.phases}
            currentPhaseIndex={state.currentPhaseIndex}
            currentStepIndex={state.currentStepIndex}
            onStepClick={goToStep}
          />
        ) : (
          <div className="w-64 border-r border-gray-200 bg-white">
            <NavigationPanel
              phases={playbookConfig.phases}
              phaseStates={state.phases}
              currentPhaseIndex={state.currentPhaseIndex}
              currentStepIndex={state.currentStepIndex}
              onStepClick={goToStep}
            />
          </div>
        )}

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Step content */}
          <div className="flex-1 overflow-y-auto">
            {renderStepContent()}
          </div>

          {/* Session data panel toggle */}
          {showSessionPanel && (
            <div className="relative">
              <button
                onClick={() => setShowDataPanel(!showDataPanel)}
                className="absolute top-4 right-4 p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors z-10"
                title={showDataPanel ? 'Hide session data' : 'Show session data'}
              >
                {showDataPanel ? (
                  <PanelRightClose className="w-4 h-4 text-gray-500" />
                ) : (
                  <PanelRightOpen className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {/* Session data panel */}
              {showDataPanel && (
                <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
                  <div className="p-4">
                    <SessionDataPanel defaultCollapsed={false} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PlaybookContextProvider>
  )
}

/**
 * Re-export context hooks for convenience
 */
export {
  usePlaybook,
  usePlaybookData,
  usePlaybookActions,
  useCurrentStep,
  useStepProgress,
  useSaveState,
} from './PlaybookContext'
