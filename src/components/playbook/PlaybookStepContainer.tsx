'use client'

import { useState, useCallback, ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Circle,
  Info,
  X,
} from 'lucide-react'
import {
  StepDefinition,
  StepState,
  StepGuidance,
  StepCompletionCriteria,
} from './types'

export interface PlaybookStepContainerProps {
  /** The step definition containing metadata and guidance */
  step: StepDefinition
  /** Current state of the step */
  stepState: StepState
  /** The step number to display (1-indexed) */
  stepNumber: number
  /** Total number of steps in the playbook */
  totalSteps: number
  /** Whether this is the first step */
  isFirst: boolean
  /** Whether this is the last step */
  isLast: boolean
  /** Callback when user clicks Back */
  onBack?: () => void
  /** Callback when user clicks Next/Continue */
  onContinue: () => void
  /** Main content area - rendered by parent component */
  children: ReactNode
  /**
   * Whether the step completion criteria is met
   * If not provided, uses stepState.status === 'completed' as fallback
   */
  isComplete?: boolean
  /**
   * Custom label for the continue button
   * Defaults to "Continue" or "Finish" for last step
   */
  continueLabel?: string
  /**
   * Helper text shown in the footer
   */
  footerHelperText?: string
  /**
   * Whether there is user data that would be lost on back navigation
   */
  hasUnsavedData?: boolean
}

/**
 * Back navigation warning modal
 */
function BackWarningModal({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Go back to previous step?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              You have entered data in this step. Going back may cause you to lose
              your current progress. Are you sure you want to continue?
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
          >
            Go Back Anyway
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * User action item in the guidance section
 */
function UserActionItem({
  action,
  index,
}: {
  action: string
  index: number
}) {
  return (
    <li className="flex items-start gap-2">
      <Circle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
      <span className="text-sm text-gray-700">{action}</span>
    </li>
  )
}

/**
 * Guidance section showing what the user needs to do
 */
function GuidanceSection({
  guidance,
  stepDescription,
}: {
  guidance?: StepGuidance
  stepDescription?: string
}) {
  // If no guidance config, use the step description as a fallback
  if (!guidance && !stepDescription) return null

  const description = guidance?.description || stepDescription
  const userActions = guidance?.userActions || []

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          {/* Description */}
          {description && (
            <p className="text-sm text-blue-800 mb-3">{description}</p>
          )}

          {/* User actions list */}
          {userActions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                What you need to do
              </p>
              <ul className="space-y-2">
                {userActions.map((action, index) => (
                  <UserActionItem key={index} action={action} index={index} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Determines if the continue button should be enabled based on completion criteria
 */
function evaluateCompletionCriteria(
  criteria: StepCompletionCriteria | undefined,
  stepState: StepState,
  isComplete?: boolean
): boolean {
  // If explicit isComplete prop is provided, use that
  if (typeof isComplete === 'boolean') {
    return isComplete
  }

  // If step is already marked as completed, enable continue
  if (stepState.status === 'completed') {
    return true
  }

  // If no criteria defined, default to allowing continue
  if (!criteria) {
    return true
  }

  switch (criteria.type) {
    case 'auto_complete':
      // Auto-complete steps can always continue (they handle their own flow)
      return true

    case 'manual':
      // Manual steps require explicit completion via stepState
      // Note: If we reach here, status is not 'completed' (early return above)
      return false

    case 'input_required':
      // Check if input exists and meets minimum requirements
      if (!stepState.input) return false
      if (criteria.minCount) {
        if (typeof stepState.input === 'string') {
          return stepState.input.length >= criteria.minCount
        }
        if (Array.isArray(stepState.input)) {
          return stepState.input.length >= criteria.minCount
        }
      }
      return true

    case 'selection_required':
      // Check if selections exist and meet minimum requirements
      const selections = stepState.suggestions?.filter(s => s.selected) || []
      const minSelections = criteria.minCount || 1
      return selections.length >= minSelections

    case 'custom':
      // Custom validation is handled by the parent component via isComplete prop
      return false

    default:
      // For unknown criteria types, default to not allowing continue
      // (completed case is already handled by early return above)
      return false
  }
}

/**
 * PlaybookStepContainer - Wraps each step's content with consistent header, guidance, and footer
 *
 * Features:
 * - Header section with step number/title and brief description
 * - "What you need to do" guidance section with bullet points
 * - Main content area for step-specific UI
 * - Footer with Back/Next buttons
 * - Back button shows warning if there's unsaved data
 * - Next button disabled until completion criteria met
 */
export default function PlaybookStepContainer({
  step,
  stepState,
  stepNumber,
  totalSteps,
  isFirst,
  isLast,
  onBack,
  onContinue,
  children,
  isComplete,
  continueLabel,
  footerHelperText,
  hasUnsavedData = false,
}: PlaybookStepContainerProps) {
  const [showBackWarning, setShowBackWarning] = useState(false)

  // Determine if continue button should be enabled
  const canContinue = evaluateCompletionCriteria(
    step.guidance?.completionCriteria,
    stepState,
    isComplete
  )

  // Handle back button click
  const handleBackClick = useCallback(() => {
    if (hasUnsavedData) {
      setShowBackWarning(true)
    } else if (onBack) {
      onBack()
    }
  }, [hasUnsavedData, onBack])

  // Handle confirmed back navigation
  const handleConfirmBack = useCallback(() => {
    setShowBackWarning(false)
    if (onBack) {
      onBack()
    }
  }, [onBack])

  // Determine continue button label
  const buttonLabel = continueLabel || (isLast ? 'Finish' : 'Continue')

  // Determine step status icon
  const getStatusIcon = () => {
    if (stepState.status === 'completed') {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    }
    if (stepState.status === 'error') {
      return <AlertTriangle className="w-5 h-5 text-red-500" />
    }
    return null
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header section */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Step number and title */}
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                {stepNumber}
              </span>
              <h2 className="text-lg font-semibold text-gray-900">{step.name}</h2>
              {getStatusIcon()}
            </div>

            {/* Step description (from step definition) */}
            {step.description && (
              <p className="text-sm text-gray-600 ml-8">{step.description}</p>
            )}
          </div>

          {/* Step counter */}
          <div className="text-xs text-gray-400 whitespace-nowrap">
            Step {stepNumber} of {totalSteps}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Guidance section */}
        <GuidanceSection
          guidance={step.guidance}
          stepDescription={step.guidance?.description}
        />

        {/* Step-specific content (children) */}
        {children}
      </div>

      {/* Footer section */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          {/* Helper text */}
          <div className="flex-1 mr-4">
            {footerHelperText && (
              <p className="text-sm text-gray-500">{footerHelperText}</p>
            )}
            {!footerHelperText && step.guidance?.completionCriteria && !canContinue && (
              <p className="text-sm text-gray-500">
                {step.guidance.completionCriteria.description}
              </p>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-3">
            {/* Back button */}
            {!isFirst && onBack && (
              <button
                onClick={handleBackClick}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}

            {/* Continue/Next button */}
            <button
              onClick={onContinue}
              disabled={!canContinue}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {buttonLabel}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Back warning modal */}
      <BackWarningModal
        isOpen={showBackWarning}
        onClose={() => setShowBackWarning(false)}
        onConfirm={handleConfirmBack}
      />
    </div>
  )
}
