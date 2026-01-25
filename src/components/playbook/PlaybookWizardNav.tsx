'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Lock } from 'lucide-react'
import { PhaseDefinition, PhaseState, StepDefinition, StepState } from './types'

export interface WizardStep {
  id: string
  label: string
  shortLabel: string
  phaseIndex: number
  stepIndex: number
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'error'
}

export interface PlaybookWizardNavProps {
  phases: PhaseDefinition[]
  phaseStates: PhaseState[]
  currentPhaseIndex: number
  currentStepIndex: number
  onStepClick: (phaseIndex: number, stepIndex: number) => void
  /** If true, clicking on completed steps is disabled */
  readOnlyNavigation?: boolean
}

/**
 * Flattens phases/steps into a sequential list of wizard steps
 */
function flattenSteps(
  phases: PhaseDefinition[],
  phaseStates: PhaseState[]
): WizardStep[] {
  const steps: WizardStep[] = []
  let stepNumber = 1

  phases.forEach((phase, phaseIndex) => {
    const phaseState = phaseStates[phaseIndex]
    if (!phaseState) return

    phase.steps.forEach((step, stepIndex) => {
      const stepState = phaseState.steps[stepIndex]
      if (!stepState) return

      // Create short label with step number
      const shortLabel = `${stepNumber}. ${truncateLabel(step.name, 12)}`

      steps.push({
        id: step.id,
        label: step.name,
        shortLabel,
        phaseIndex,
        stepIndex,
        status: stepState.status,
      })
      stepNumber++
    })
  })

  return steps
}

/**
 * Truncates a label to fit within the stepper
 */
function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label
  return label.substring(0, maxLength - 1) + '…'
}

/**
 * Gets the current step index in the flattened list
 */
function getCurrentFlatIndex(
  steps: WizardStep[],
  currentPhaseIndex: number,
  currentStepIndex: number
): number {
  return steps.findIndex(
    s => s.phaseIndex === currentPhaseIndex && s.stepIndex === currentStepIndex
  )
}

/**
 * Desktop stepper item component
 */
function StepperItem({
  step,
  index,
  isCurrent,
  isCompleted,
  isFuture,
  onClick,
  isClickable,
}: {
  step: WizardStep
  index: number
  isCurrent: boolean
  isCompleted: boolean
  isFuture: boolean
  onClick: () => void
  isClickable: boolean
}) {
  const getStepStyles = () => {
    if (isCurrent) {
      return {
        circle: 'bg-blue-600 text-white border-blue-600 ring-4 ring-blue-100',
        label: 'text-blue-600 font-semibold',
        connector: 'bg-gray-200',
      }
    }
    if (isCompleted) {
      return {
        circle: 'bg-green-500 text-white border-green-500',
        label: 'text-green-600',
        connector: 'bg-green-500',
      }
    }
    if (step.status === 'error') {
      return {
        circle: 'bg-red-500 text-white border-red-500',
        label: 'text-red-600',
        connector: 'bg-gray-200',
      }
    }
    // Future/pending
    return {
      circle: 'bg-gray-100 text-gray-400 border-gray-300',
      label: 'text-gray-400',
      connector: 'bg-gray-200',
    }
  }

  const styles = getStepStyles()

  return (
    <div className="flex items-center">
      {/* Step circle and label */}
      <button
        onClick={onClick}
        disabled={!isClickable}
        className={`flex flex-col items-center group ${
          isClickable ? 'cursor-pointer' : 'cursor-default'
        }`}
        title={isClickable ? `Go to: ${step.label}` : step.label}
      >
        {/* Circle with number or checkmark */}
        <div
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${styles.circle} ${
            isClickable && !isCurrent ? 'group-hover:ring-2 group-hover:ring-gray-200' : ''
          }`}
        >
          {isCompleted ? (
            <Check className="w-4 h-4" />
          ) : isFuture ? (
            <Lock className="w-3.5 h-3.5" />
          ) : (
            <span className="text-sm font-medium">{index + 1}</span>
          )}
        </div>

        {/* Label */}
        <div className="mt-2 flex flex-col items-center">
          <span className={`text-xs whitespace-nowrap ${styles.label}`}>
            {step.shortLabel}
          </span>
          {isCurrent && (
            <span className="text-[10px] text-blue-500 font-medium mt-0.5">
              Current
            </span>
          )}
        </div>
      </button>
    </div>
  )
}

/**
 * Connector line between steps
 */
function StepConnector({ isCompleted }: { isCompleted: boolean }) {
  return (
    <div
      className={`flex-1 h-0.5 mx-2 mt-[-20px] transition-colors ${
        isCompleted ? 'bg-green-500' : 'bg-gray-200'
      }`}
    />
  )
}

/**
 * Mobile dropdown component
 */
function MobileStepDropdown({
  steps,
  currentIndex,
  onStepSelect,
  readOnlyNavigation,
}: {
  steps: WizardStep[]
  currentIndex: number
  onStepSelect: (step: WizardStep) => void
  readOnlyNavigation?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentStep = steps[currentIndex]
  const completedCount = steps.filter(s => s.status === 'completed').length

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-medium flex items-center justify-center">
            {currentIndex + 1}
          </span>
          <span className="text-sm font-medium text-gray-700">
            Step {currentIndex + 1} of {steps.length}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {steps.map((step, index) => {
            const isCurrent = index === currentIndex
            const isCompleted = step.status === 'completed'
            const isClickable = isCompleted && !readOnlyNavigation

            return (
              <button
                key={step.id}
                onClick={() => {
                  if (isClickable || isCurrent) {
                    onStepSelect(step)
                    setIsOpen(false)
                  }
                }}
                disabled={!isClickable && !isCurrent}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isCurrent
                    ? 'bg-blue-50'
                    : isClickable
                    ? 'hover:bg-gray-50'
                    : 'opacity-50 cursor-not-allowed'
                } ${index !== 0 ? 'border-t border-gray-100' : ''}`}
              >
                {/* Status indicator */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
                </div>

                {/* Step info */}
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm ${
                      isCurrent
                        ? 'text-blue-600 font-medium'
                        : isCompleted
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Current indicator */}
                {isCurrent && (
                  <span className="text-xs text-blue-500 font-medium">Current</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Progress indicator below dropdown */}
      <div className="mt-2 text-xs text-gray-500 text-center">
        {completedCount} of {steps.length} completed
      </div>
    </div>
  )
}

/**
 * Progress bar component
 */
function ProgressBar({
  completedSteps,
  totalSteps,
}: {
  completedSteps: number
  totalSteps: number
}) {
  const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">Overall Progress</span>
        <span className="text-xs font-medium text-gray-700">{percentage}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

/**
 * PlaybookWizardNav - A horizontal stepper navigation component
 *
 * Features:
 * - Horizontal stepper showing all steps
 * - Current step highlighted with distinct color and "Current" indicator
 * - Completed steps show checkmark and are clickable for review
 * - Future steps shown but disabled/grayed out
 * - Mobile responsive: collapses to dropdown on small screens
 * - Progress bar showing overall percentage
 */
export default function PlaybookWizardNav({
  phases,
  phaseStates,
  currentPhaseIndex,
  currentStepIndex,
  onStepClick,
  readOnlyNavigation = false,
}: PlaybookWizardNavProps) {
  const steps = flattenSteps(phases, phaseStates)
  const currentFlatIndex = getCurrentFlatIndex(steps, currentPhaseIndex, currentStepIndex)
  const completedSteps = steps.filter(s => s.status === 'completed').length

  const handleStepClick = (step: WizardStep) => {
    onStepClick(step.phaseIndex, step.stepIndex)
  }

  return (
    <div className="w-full bg-white border-b border-gray-200 px-4 py-4">
      {/* Desktop view - horizontal stepper */}
      <div className="hidden md:block">
        <div className="flex items-start justify-between max-w-4xl mx-auto">
          {steps.map((step, index) => {
            const isCurrent = index === currentFlatIndex
            const isCompleted = step.status === 'completed'
            const isFuture = !isCurrent && !isCompleted && step.status !== 'error'
            const isClickable = isCompleted && !readOnlyNavigation
            const showConnector = index < steps.length - 1

            return (
              <div key={step.id} className="flex items-start flex-1">
                <StepperItem
                  step={step}
                  index={index}
                  isCurrent={isCurrent}
                  isCompleted={isCompleted}
                  isFuture={isFuture}
                  onClick={() => isClickable && handleStepClick(step)}
                  isClickable={isClickable}
                />
                {showConnector && (
                  <StepConnector isCompleted={isCompleted && steps[index + 1]?.status === 'completed'} />
                )}
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-4 max-w-4xl mx-auto">
          <ProgressBar completedSteps={completedSteps} totalSteps={steps.length} />
        </div>
      </div>

      {/* Mobile view - dropdown */}
      <div className="md:hidden flex flex-col items-center">
        <MobileStepDropdown
          steps={steps}
          currentIndex={currentFlatIndex >= 0 ? currentFlatIndex : 0}
          onStepSelect={handleStepClick}
          readOnlyNavigation={readOnlyNavigation}
        />

        {/* Progress bar */}
        <div className="mt-4 w-full max-w-xs">
          <ProgressBar completedSteps={completedSteps} totalSteps={steps.length} />
        </div>
      </div>
    </div>
  )
}
