'use client'

import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, Check, Lightbulb, Info } from 'lucide-react'
import {
  validateDocumentName,
  suggestDocumentName,
  getConfidenceClasses,
  type DocumentNameValidation,
} from '@/lib/utils/documentNamingValidator'

interface DocumentNameInputProps {
  value: string
  onChange: (value: string) => void
  source?: string // Pre-fill suggestion source
  target?: string // Pre-fill suggestion target
  showValidation?: boolean
  onApplySuggestion?: (suggested: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  disabled?: boolean
}

/**
 * DocumentNameInput
 *
 * An input field with real-time validation against the naming convention:
 * {Fuente} - {Objetivo} - {YYYY-MM-DD}
 *
 * Shows warnings (not errors) for non-compliant names and offers suggestions.
 */
export default function DocumentNameInput({
  value,
  onChange,
  source,
  target,
  showValidation = true,
  onApplySuggestion,
  placeholder = 'Nombre del documento',
  className = '',
  autoFocus = false,
  disabled = false,
}: DocumentNameInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [showTip, setShowTip] = useState(false)

  // Validate the current name
  const validation = useMemo(() => {
    if (!value.trim()) return null
    return validateDocumentName(value)
  }, [value])

  // Generate suggestion if we have source/target
  const suggestion = useMemo(() => {
    if (source && target) {
      return suggestDocumentName(source, target)
    }
    return validation?.suggestedName
  }, [source, target, validation?.suggestedName])

  const handleApplySuggestion = () => {
    if (suggestion) {
      onChange(suggestion)
      onApplySuggestion?.(suggestion)
    }
  }

  const hasWarnings =
    validation && validation.issues.filter((i) => i.severity === 'warning').length > 0

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Input field */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          className={`
            w-full px-3 py-2 text-sm border rounded-lg transition-all
            focus:ring-2 focus:ring-indigo-500 focus:border-transparent
            ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white text-gray-900'}
            ${hasWarnings && showValidation ? 'border-amber-300' : 'border-gray-200'}
          `}
        />
        {/* Status indicator */}
        {showValidation && validation && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {validation.isValid ? (
              <Check size={16} className="text-green-500" />
            ) : (
              <AlertTriangle size={16} className="text-amber-500" />
            )}
          </div>
        )}
      </div>

      {/* Validation feedback */}
      {showValidation && validation && hasWarnings && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Lightbulb size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-800 mb-1">
                Formato recomendado: Fuente - Objetivo - YYYY-MM-DD
              </p>
              <ul className="text-xs text-amber-700 space-y-0.5">
                {validation.issues
                  .filter((i) => i.severity === 'warning')
                  .slice(0, 3)
                  .map((issue, idx) => (
                    <li key={idx}>• {issue.message}</li>
                  ))}
              </ul>
              {suggestion && (
                <button
                  type="button"
                  onClick={handleApplySuggestion}
                  className="mt-2 text-xs text-amber-600 hover:text-amber-800 underline font-medium"
                >
                  Usar nombre sugerido: "{suggestion}"
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Help tooltip (show on first focus) */}
      {isFocused && !validation && (
        <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Tip: Usa el formato "Fuente - Objetivo - Fecha" para mejor organizacion
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Compact validation badge for inline display
 */
export function DocumentNameValidationBadge({
  filename,
  size = 'sm',
}: {
  filename: string
  size?: 'sm' | 'xs'
}) {
  const validation = useMemo(() => {
    if (!filename.trim()) return null
    return validateDocumentName(filename)
  }, [filename])

  if (!validation) return null

  const { bg, text, border } = getConfidenceClasses(validation.confidence)
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px]'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${bg} ${text} border ${border} ${sizeClasses}`}
      title={
        validation.isValid
          ? 'Nombre bien formateado'
          : validation.issues.map((i) => i.message).join('; ')
      }
    >
      {validation.isValid ? (
        <>
          <Check size={size === 'sm' ? 12 : 10} />
          <span>OK</span>
        </>
      ) : (
        <>
          <AlertTriangle size={size === 'sm' ? 12 : 10} />
          <span>Formato</span>
        </>
      )}
    </span>
  )
}
