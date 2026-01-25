'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle, ArrowLeft, Save, XCircle } from 'lucide-react'

export type NavigationWarningAction = 'go_back' | 'save_first' | 'cancel'

export interface NavigationWarningInfo {
  /** The step name that will be affected */
  stepName: string
  /** The step number (1-indexed) */
  stepNumber: number
  /** Description of current progress that will be saved */
  progressDescription?: string
}

export interface NavigationWarningDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Information about the step and progress */
  warningInfo: NavigationWarningInfo
  /** Callback when user makes a choice */
  onAction: (action: NavigationWarningAction) => void
  /** Whether save is in progress */
  isSaving?: boolean
}

/**
 * Navigation Warning Dialog - Warns users before back navigation that could lose data
 *
 * Provides three options per acceptance criteria:
 * - "Go Back Anyway" - Proceed with navigation, progress saved to session but step needs re-run
 * - "Save to Context Lake First" - Save current output to Context Lake, then proceed
 * - "Cancel" - Stay on current step
 */
export default function NavigationWarningDialog({
  isOpen,
  warningInfo,
  onAction,
  isSaving = false,
}: NavigationWarningDialogProps) {
  const [mounted, setMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      // Trigger enter animation
      requestAnimationFrame(() => {
        setIsVisible(true)
      })
      // Focus cancel button by default (safest option)
      cancelButtonRef.current?.focus()
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onAction('cancel')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onAction, isSaving])

  // Trap focus within modal
  useEffect(() => {
    if (!isOpen) return

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return

      const focusableElements = modalRef.current.querySelectorAll(
        'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleTabKey)
    return () => document.removeEventListener('keydown', handleTabKey)
  }, [isOpen])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!mounted || !isOpen) return null

  const { stepName, stepNumber, progressDescription } = warningInfo

  return createPortal(
    <div
      className={`
        fixed inset-0 z-[10000] flex items-center justify-center p-4
        transition-all duration-200
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nav-warning-title"
      aria-describedby="nav-warning-description"
    >
      {/* Backdrop */}
      <div
        className={`
          absolute inset-0 bg-gray-900/60 backdrop-blur-sm
          transition-opacity duration-200
          ${isVisible ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={() => !isSaving && onAction('cancel')}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`
          relative w-full max-w-lg
          bg-white dark:bg-gray-900
          rounded-2xl shadow-2xl
          transform transition-all duration-200
          ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        `}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => onAction('cancel')}
          disabled={isSaving}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Cancel"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30">
              <AlertTriangle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <h3
              id="nav-warning-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              Go back to previous step?
            </h3>
            <p
              id="nav-warning-description"
              className="mt-3 text-sm text-gray-600 dark:text-gray-400"
            >
              Going back will reset <span className="font-medium text-gray-900 dark:text-gray-200">Step {stepNumber}</span>.
              {progressDescription ? (
                <>
                  {' '}Your current progress ({progressDescription}) will be saved to the session but this step will need to be re-run.
                </>
              ) : (
                <> Your current progress will be saved to the session but this step will need to be re-run.</>
              )}
            </p>
          </div>

          {/* Actions - Three buttons stacked for clarity */}
          <div className="space-y-3">
            {/* Cancel - Primary safe action */}
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={() => onAction('cancel')}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>

            {/* Save to Context Lake First */}
            <button
              type="button"
              onClick={() => onAction('save_first')}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save to Context Lake First
                </>
              )}
            </button>

            {/* Go Back Anyway */}
            <button
              type="button"
              onClick={() => onAction('go_back')}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back Anyway
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
