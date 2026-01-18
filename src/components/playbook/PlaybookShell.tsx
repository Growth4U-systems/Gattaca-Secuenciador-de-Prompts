'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  PlaybookShellProps,
  PlaybookState,
  PhaseState,
  StepState,
  StepDefinition,
  PhaseDefinition,
} from './types'
import NavigationPanel from './NavigationPanel'
import WorkArea from './WorkArea'

function initializeState(
  projectId: string,
  playbookConfig: PlaybookShellProps['playbookConfig'],
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

  // Apply initial state if provided
  if (initialState?.phases) {
    initialState.phases.forEach((phaseState, phaseIndex) => {
      if (phases[phaseIndex]) {
        phases[phaseIndex].status = phaseState.status
        phaseState.steps.forEach((stepState, stepIndex) => {
          if (phases[phaseIndex].steps[stepIndex]) {
            phases[phaseIndex].steps[stepIndex] = {
              ...phases[phaseIndex].steps[stepIndex],
              ...stepState,
            }
          }
        })
      }
    })
  }

  const totalSteps = playbookConfig.phases.reduce((sum, phase) => sum + phase.steps.length, 0)
  const completedSteps = phases.reduce(
    (sum, phase) => sum + phase.steps.filter(s => s.status === 'completed').length,
    0
  )

  return {
    projectId,
    playbookType: playbookConfig.type,
    phases,
    currentPhaseIndex: initialState?.currentPhaseIndex ?? 0,
    currentStepIndex: initialState?.currentStepIndex ?? 0,
    config: initialState?.config ?? {},
    completedSteps,
    totalSteps,
    startedAt: initialState?.startedAt,
    completedAt: initialState?.completedAt,
  }
}

export default function PlaybookShell({
  projectId,
  playbookConfig,
  initialState,
}: PlaybookShellProps) {
  const [state, setState] = useState<PlaybookState>(() =>
    initializeState(projectId, playbookConfig, initialState)
  )

  // Get current phase and step definitions
  const currentPhase = playbookConfig.phases[state.currentPhaseIndex]
  const currentStep = currentPhase?.steps[state.currentStepIndex]
  const currentStepState = state.phases[state.currentPhaseIndex]?.steps[state.currentStepIndex]

  // Calculate navigation bounds
  const isFirstStep = state.currentPhaseIndex === 0 && state.currentStepIndex === 0
  const isLastStep =
    state.currentPhaseIndex === playbookConfig.phases.length - 1 &&
    state.currentStepIndex === currentPhase.steps.length - 1

  // Navigate to a specific step
  const goToStep = useCallback((phaseIndex: number, stepIndex: number) => {
    setState(prev => ({
      ...prev,
      currentPhaseIndex: phaseIndex,
      currentStepIndex: stepIndex,
    }))
  }, [])

  // Go to next step
  const goToNextStep = useCallback(() => {
    setState(prev => {
      const currentPhase = playbookConfig.phases[prev.currentPhaseIndex]

      // Check if there's a next step in current phase
      if (prev.currentStepIndex < currentPhase.steps.length - 1) {
        return {
          ...prev,
          currentStepIndex: prev.currentStepIndex + 1,
        }
      }

      // Check if there's a next phase
      if (prev.currentPhaseIndex < playbookConfig.phases.length - 1) {
        return {
          ...prev,
          currentPhaseIndex: prev.currentPhaseIndex + 1,
          currentStepIndex: 0,
        }
      }

      // Already at the end
      return prev
    })
  }, [playbookConfig.phases])

  // Go to previous step
  const goToPreviousStep = useCallback(() => {
    setState(prev => {
      // Check if there's a previous step in current phase
      if (prev.currentStepIndex > 0) {
        return {
          ...prev,
          currentStepIndex: prev.currentStepIndex - 1,
        }
      }

      // Check if there's a previous phase
      if (prev.currentPhaseIndex > 0) {
        const prevPhase = playbookConfig.phases[prev.currentPhaseIndex - 1]
        return {
          ...prev,
          currentPhaseIndex: prev.currentPhaseIndex - 1,
          currentStepIndex: prevPhase.steps.length - 1,
        }
      }

      // Already at the beginning
      return prev
    })
  }, [playbookConfig.phases])

  // Update step state
  const updateStepState = useCallback(
    (stepId: string, update: Partial<StepState>) => {
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
          const allCompleted = phase.steps.every(s => s.status === 'completed' || s.status === 'skipped')
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

        return {
          ...prev,
          phases: newPhases,
          completedSteps,
        }
      })
    },
    []
  )

  // Execute a step
  const executeStep = useCallback(
    async (stepId: string, input?: any) => {
      const step = playbookConfig.phases
        .flatMap(p => p.steps)
        .find(s => s.id === stepId)

      if (!step) return

      // Mark as in progress
      updateStepState(stepId, {
        status: 'in_progress',
        startedAt: new Date(),
        input,
      })

      try {
        let result: any

        switch (step.executor) {
          case 'llm':
            // Call LLM API
            const response = await fetch('/api/playbook/execute-step', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId,
                stepId,
                promptKey: step.promptKey,
                input,
              }),
            })
            const data = await response.json()
            if (!data.success) throw new Error(data.error || 'Error ejecutando paso')
            result = data.output
            break

          case 'api':
            // Call custom API endpoint
            if (step.apiEndpoint) {
              const apiResponse = await fetch(step.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, stepId, input }),
              })
              const apiData = await apiResponse.json()
              if (!apiData.success) throw new Error(apiData.error || 'Error en API')
              result = apiData.result
            }
            break

          case 'job':
            // Job-based execution handled differently (polling)
            // The job system will update the state externally
            return

          case 'none':
          default:
            // No execution needed, just proceed
            result = input
            break
        }

        // Mark as completed
        updateStepState(stepId, {
          status: 'completed',
          completedAt: new Date(),
          output: result,
        })

        // Auto-advance for auto steps
        if (['auto', 'auto_with_review'].includes(step.type)) {
          setTimeout(goToNextStep, 500)
        }
      } catch (error) {
        updateStepState(stepId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido',
        })
      }
    },
    [projectId, playbookConfig.phases, updateStepState, goToNextStep]
  )

  // Handle continue from current step
  const handleContinue = useCallback(() => {
    if (currentStepState?.status !== 'completed') {
      // Mark as completed if not already
      updateStepState(currentStep.id, { status: 'completed', completedAt: new Date() })
    }
    goToNextStep()
  }, [currentStep?.id, currentStepState?.status, updateStepState, goToNextStep])

  // Auto-start current step if it's an auto step and pending
  useEffect(() => {
    if (
      currentStep &&
      currentStepState?.status === 'pending' &&
      ['auto'].includes(currentStep.type)
    ) {
      // Small delay to allow UI to render first
      const timer = setTimeout(() => {
        executeStep(currentStep.id)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [currentStep, currentStepState?.status, executeStep])

  if (!currentPhase || !currentStep || !currentStepState) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Error: Configuración de playbook inválida
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
      {/* Navigation Panel - Left side */}
      <div className="w-80 flex-shrink-0">
        <NavigationPanel
          phases={playbookConfig.phases}
          phaseStates={state.phases}
          currentPhaseIndex={state.currentPhaseIndex}
          currentStepIndex={state.currentStepIndex}
          onStepClick={goToStep}
        />
      </div>

      {/* Work Area - Right side */}
      <div className="flex-1 overflow-hidden">
        <WorkArea
          step={currentStep}
          stepState={currentStepState}
          onContinue={handleContinue}
          onBack={goToPreviousStep}
          onExecute={(input) => executeStep(currentStep.id, input)}
          onUpdateState={(update) => updateStepState(currentStep.id, update)}
          isFirst={isFirstStep}
          isLast={isLastStep}
        />
      </div>
    </div>
  )
}
