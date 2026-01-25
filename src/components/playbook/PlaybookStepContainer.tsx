'use client'

import { useState, useCallback, ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Circle,
  Info,
  Database,
  Check,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import {
  StepDefinition,
  StepState,
  StepGuidance,
  StepCompletionCriteria,
} from './types'
import SavedIndicator from './SavedIndicator'
import NavigationWarningDialog, {
  NavigationWarningAction,
  NavigationWarningInfo,
} from './NavigationWarningDialog'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'

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
  /**
   * Auto-save state for showing saved indicator
   */
  saveState?: {
    isSaving: boolean
    lastSavedAt: Date | null
    saveError: string | null
    isDirty?: boolean
  }
  /**
   * Description of current progress for the navigation warning dialog
   * e.g., "45 URLs scraped", "3 keywords configured"
   */
  progressDescription?: string
  /**
   * Callback to save current output to Context Lake before navigating back
   * If provided, enables the "Save to Context Lake First" option
   */
  onSaveToContextLake?: () => Promise<void>
  /**
   * Whether Context Lake save is currently in progress
   */
  isSavingToContextLake?: boolean
  /**
   * The step output content to save (visible in footer when present)
   */
  stepOutput?: string
  /**
   * Callback when user clicks the standalone "Save to Context Lake" button
   * Opens the save modal for the user to configure the save
   */
  onOpenSaveModal?: () => void
  /**
   * List of documents saved from this step (allows multiple saves)
   * Each save creates a new document
   */
  savedDocuments?: Array<{
    id: string
    name: string
    savedAt: Date
  }>
  /**
   * Base URL for viewing saved documents (e.g., "/projects/123")
   */
  documentViewBasePath?: string
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
 * - Back button shows navigation warning if there's unsaved data with three options:
 *   - "Go Back Anyway" - proceed with navigation
 *   - "Save to Context Lake First" - save output then navigate
 *   - "Cancel" - stay on current step
 * - Browser beforeunload warning when session has unsaved changes
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
  saveState,
  progressDescription,
  onSaveToContextLake,
  isSavingToContextLake = false,
  stepOutput,
  onOpenSaveModal,
  savedDocuments = [],
  documentViewBasePath,
}: PlaybookStepContainerProps) {
  const [showNavigationWarning, setShowNavigationWarning] = useState(false)

  // Browser beforeunload warning for unsaved changes
  useUnsavedChangesWarning({
    hasUnsavedChanges: hasUnsavedData || stepState.status === 'in_progress',
    message: 'You have unsaved changes. Are you sure you want to leave?',
    enabled: true,
  })

  // Determine if continue button should be enabled
  const canContinue = evaluateCompletionCriteria(
    step.guidance?.completionCriteria,
    stepState,
    isComplete
  )

  // Build warning info for the dialog
  const warningInfo: NavigationWarningInfo = {
    stepName: step.name,
    stepNumber,
    progressDescription,
  }

  // Handle back button click
  const handleBackClick = useCallback(() => {
    if (hasUnsavedData || stepState.status === 'in_progress') {
      setShowNavigationWarning(true)
    } else if (onBack) {
      onBack()
    }
  }, [hasUnsavedData, stepState.status, onBack])

  // Handle navigation warning dialog actions
  const handleNavigationAction = useCallback(async (action: NavigationWarningAction) => {
    switch (action) {
      case 'cancel':
        setShowNavigationWarning(false)
        break

      case 'go_back':
        setShowNavigationWarning(false)
        if (onBack) {
          onBack()
        }
        break

      case 'save_first':
        if (onSaveToContextLake) {
          try {
            await onSaveToContextLake()
            setShowNavigationWarning(false)
            if (onBack) {
              onBack()
            }
          } catch (error) {
            // Keep dialog open on error - user can retry or choose another option
            console.error('[PlaybookStepContainer] Save to Context Lake failed:', error)
          }
        } else {
          // If no save handler, just go back
          setShowNavigationWarning(false)
          if (onBack) {
            onBack()
          }
        }
        break
    }
  }, [onBack, onSaveToContextLake])

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

          {/* Step counter and save indicator */}
          <div className="flex items-center gap-3">
            {/* Save indicator */}
            {saveState && (
              <SavedIndicator
                isSaving={saveState.isSaving}
                lastSavedAt={saveState.lastSavedAt}
                saveError={saveState.saveError}
                isDirty={saveState.isDirty}
                compact={false}
              />
            )}
            {/* Step counter */}
            <div className="text-xs text-gray-400 whitespace-nowrap">
              Step {stepNumber} of {totalSteps}
            </div>
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
          {/* Left side: Helper text and saved documents indicator */}
          <div className="flex-1 mr-4 flex items-center gap-4">
            {/* Helper text */}
            <div className="flex-1">
              {footerHelperText && (
                <p className="text-sm text-gray-500">{footerHelperText}</p>
              )}
              {!footerHelperText && step.guidance?.completionCriteria && !canContinue && (
                <p className="text-sm text-gray-500">
                  {step.guidance.completionCriteria.description}
                </p>
              )}
            </div>

            {/* Saved documents indicator */}
            {savedDocuments.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                  <Check className="w-4 h-4" />
                  <span>
                    Saved {savedDocuments.length === 1 ? '' : `(${savedDocuments.length})`}
                  </span>
                </div>
                {documentViewBasePath && savedDocuments.length > 0 && (
                  <a
                    href={`${documentViewBasePath}?tab=context-lake&highlight=${savedDocuments[savedDocuments.length - 1].id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                    title={`View "${savedDocuments[savedDocuments.length - 1].name}" in Context Lake`}
                  >
                    View
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Right side: Action buttons */}
          <div className="flex items-center gap-3">
            {/* Save to Context Lake button - visible when step has output */}
            {stepOutput && onOpenSaveModal && (
              <button
                onClick={onOpenSaveModal}
                disabled={isSavingToContextLake}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 hover:border-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Save this step's output to Context Lake"
              >
                {isSavingToContextLake ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    Save to Context Lake
                  </>
                )}
              </button>
            )}

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

      {/* Navigation warning dialog */}
      <NavigationWarningDialog
        isOpen={showNavigationWarning}
        warningInfo={warningInfo}
        onAction={handleNavigationAction}
        isSaving={isSavingToContextLake}
      />
    </div>
  )
}
