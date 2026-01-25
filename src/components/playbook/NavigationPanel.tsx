'use client'

import { ChevronRight, Check, Circle, Loader2, AlertCircle } from 'lucide-react'
import { NavigationPanelProps, PhaseDefinition, StepDefinition, PhaseState, StepState } from './types'

interface PhaseItemProps {
  phase: PhaseDefinition
  phaseState: PhaseState
  phaseIndex: number
  currentPhaseIndex: number
  currentStepIndex: number
  onStepClick: (phaseIndex: number, stepIndex: number) => void
}

function PhaseItem({
  phase,
  phaseState,
  phaseIndex,
  currentPhaseIndex,
  currentStepIndex,
  onStepClick,
}: PhaseItemProps) {
  return (
    <div className="py-1">
      {phase.steps.map((step, stepIndex) => {
        const stepState = phaseState.steps[stepIndex]
        if (!stepState) return null
        return (
          <StepItem
            key={step.id}
            step={step}
            stepState={stepState}
            phaseIndex={phaseIndex}
            stepIndex={stepIndex}
            isCurrentStep={phaseIndex === currentPhaseIndex && stepIndex === currentStepIndex}
            onClick={() => onStepClick(phaseIndex, stepIndex)}
          />
        )
      })}
    </div>
  )
}

interface StepItemProps {
  step: StepDefinition
  stepState: StepState
  phaseIndex: number
  stepIndex: number
  isCurrentStep: boolean
  onClick: () => void
}

function StepItem({ step, stepState, isCurrentStep, onClick }: StepItemProps) {
  const getStepIcon = () => {
    switch (stepState.status) {
      case 'completed':
        return <Check className="w-3.5 h-3.5 text-green-600" />
      case 'in_progress':
        return <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />
      case 'skipped':
        return <Circle className="w-3 h-3 text-gray-300 line-through" />
      default:
        return <Circle className="w-3 h-3 text-gray-300" />
    }
  }

  const getStepTypeIndicator = () => {
    switch (step.type) {
      case 'auto':
      case 'auto_with_preview':
      case 'auto_with_review':
        return <span className="text-[10px] text-gray-400 ml-1">auto</span>
      case 'decision':
        return <span className="text-[10px] text-orange-500 ml-1">decisión</span>
      case 'input':
        return <span className="text-[10px] text-purple-500 ml-1">input</span>
      default:
        return null
    }
  }

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 pl-6 pr-4 py-2 text-left transition-colors ${
        isCurrentStep
          ? 'bg-blue-600 border-l-2 border-blue-700'
          : 'border-l-2 border-transparent hover:bg-gray-100'
      }`}
    >
      <span className={`flex-shrink-0 ${isCurrentStep ? '[&>svg]:text-white' : ''}`}>{getStepIcon()}</span>
      <span className={`flex-1 text-sm ${
        isCurrentStep ? 'text-white font-medium' :
        stepState.status === 'completed' ? 'text-green-600' :
        stepState.status === 'error' ? 'text-red-600' :
        'text-gray-600'
      }`}>
        {step.name}
      </span>
      {!isCurrentStep && getStepTypeIndicator()}
      {isCurrentStep && (
        <span className="text-white">
          <ChevronRight size={14} />
        </span>
      )}
    </button>
  )
}

export default function NavigationPanel({
  phases,
  phaseStates,
  currentPhaseIndex,
  currentStepIndex,
  onStepClick,
}: NavigationPanelProps) {
  const totalSteps = phases.reduce((sum, phase) => sum + phase.steps.length, 0)
  const completedSteps = phaseStates.reduce(
    (sum, phase) => sum + phase.steps.filter(s => s.status === 'completed').length,
    0
  )

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Progress header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Progreso
          </span>
          <span className="text-sm font-semibold text-gray-700">
            {completedSteps}/{totalSteps}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Phases list */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-2">
          {phases.map((phase, phaseIndex) => {
            const phaseState = phaseStates[phaseIndex]
            if (!phaseState) return null
            return (
              <PhaseItem
                key={phase.id}
                phase={phase}
                phaseState={phaseState}
                phaseIndex={phaseIndex}
                currentPhaseIndex={currentPhaseIndex}
                currentStepIndex={currentStepIndex}
                onStepClick={onStepClick}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
