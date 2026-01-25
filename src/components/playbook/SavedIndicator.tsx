'use client'

import { useState, useEffect } from 'react'
import { Check, Cloud, CloudOff, Loader2 } from 'lucide-react'

export interface SavedIndicatorProps {
  /** Whether a save is currently in progress */
  isSaving: boolean
  /** Timestamp of last successful save */
  lastSavedAt: Date | null
  /** Error message if last save failed */
  saveError: string | null
  /** Whether there are unsaved changes */
  isDirty?: boolean
  /** Show as compact icon only (no text) */
  compact?: boolean
  /** Additional class names */
  className?: string
}

/**
 * Subtle indicator showing save status.
 * Shows different states: saving, saved, error, unsaved changes.
 */
export default function SavedIndicator({
  isSaving,
  lastSavedAt,
  saveError,
  isDirty = false,
  compact = false,
  className = '',
}: SavedIndicatorProps) {
  // Show "Saved" text briefly after save completes
  const [showSavedText, setShowSavedText] = useState(false)

  // When lastSavedAt changes, briefly show the "Saved" text
  useEffect(() => {
    if (lastSavedAt && !isSaving) {
      setShowSavedText(true)
      const timer = setTimeout(() => {
        setShowSavedText(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [lastSavedAt, isSaving])

  // Format relative time
  const formatLastSaved = (date: Date): string => {
    const now = new Date()
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffSeconds < 5) return 'just now'
    if (diffSeconds < 60) return `${diffSeconds}s ago`
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Determine display state
  if (saveError) {
    return (
      <div
        className={`flex items-center gap-1.5 text-xs text-red-600 ${className}`}
        title={saveError}
      >
        <CloudOff className="w-3.5 h-3.5" />
        {!compact && <span>Save failed</span>}
      </div>
    )
  }

  if (isSaving) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-gray-400 ${className}`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {!compact && <span>Saving...</span>}
      </div>
    )
  }

  if (showSavedText && lastSavedAt) {
    return (
      <div
        className={`flex items-center gap-1.5 text-xs text-green-600 transition-opacity duration-300 ${className}`}
      >
        <Check className="w-3.5 h-3.5" />
        {!compact && <span>Saved</span>}
      </div>
    )
  }

  if (isDirty) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-amber-500 ${className}`}>
        <Cloud className="w-3.5 h-3.5" />
        {!compact && <span>Unsaved changes</span>}
      </div>
    )
  }

  if (lastSavedAt) {
    return (
      <div
        className={`flex items-center gap-1.5 text-xs text-gray-400 ${className}`}
        title={`Last saved: ${lastSavedAt.toLocaleString()}`}
      >
        <Cloud className="w-3.5 h-3.5" />
        {!compact && <span>Saved {formatLastSaved(lastSavedAt)}</span>}
      </div>
    )
  }

  // No save status to show
  return null
}
