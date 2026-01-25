'use client'

import { useEffect, useCallback, useRef } from 'react'

export interface UseUnsavedChangesWarningOptions {
  /** Whether there are unsaved changes that should trigger a warning */
  hasUnsavedChanges: boolean
  /** Custom message to show in the beforeunload dialog (browser may override this) */
  message?: string
  /** Whether to enable the warning (default: true) */
  enabled?: boolean
}

/**
 * Hook to warn users before leaving a page with unsaved changes.
 *
 * Handles:
 * - Browser beforeunload event (tab close, refresh, navigate away)
 * - Customizable warning state
 *
 * Note: Modern browsers often show a generic message instead of the custom message
 * for security reasons, but the dialog will still appear.
 *
 * Usage:
 * ```tsx
 * useUnsavedChangesWarning({
 *   hasUnsavedChanges: isDirty || stepState.status === 'in_progress',
 *   message: 'You have unsaved changes. Are you sure you want to leave?'
 * })
 * ```
 */
export function useUnsavedChangesWarning({
  hasUnsavedChanges,
  message = 'You have unsaved changes. Are you sure you want to leave?',
  enabled = true,
}: UseUnsavedChangesWarningOptions): void {
  // Use ref to always have access to the latest values in the event handler
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges)
  const enabledRef = useRef(enabled)

  // Keep refs in sync with props
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges
  }, [hasUnsavedChanges])

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  // Handle beforeunload event
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!enabledRef.current || !hasUnsavedChangesRef.current) {
        return
      }

      // Standard way to show browser's "Leave site?" dialog
      event.preventDefault()
      // For older browsers - set returnValue
      // Note: Most modern browsers ignore custom messages for security
      event.returnValue = message
      return message
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [message])
}

/**
 * Hook that returns a function to check if navigation should be blocked.
 *
 * Useful for programmatic navigation checks within the app.
 *
 * Usage:
 * ```tsx
 * const shouldBlockNavigation = useNavigationBlocker({
 *   hasUnsavedChanges: isDirty,
 * })
 *
 * const handleNavigate = () => {
 *   if (shouldBlockNavigation()) {
 *     // Show custom dialog
 *     return
 *   }
 *   // Proceed with navigation
 * }
 * ```
 */
export function useNavigationBlocker({
  hasUnsavedChanges,
  enabled = true,
}: Omit<UseUnsavedChangesWarningOptions, 'message'>): () => boolean {
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges)
  const enabledRef = useRef(enabled)

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges
  }, [hasUnsavedChanges])

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  return useCallback(() => {
    return enabledRef.current && hasUnsavedChangesRef.current
  }, [])
}

export default useUnsavedChangesWarning
