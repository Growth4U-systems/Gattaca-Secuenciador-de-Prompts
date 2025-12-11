'use client'

import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  X
} from 'lucide-react'
import {
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
  getSeverityClasses
} from '@/hooks/usePromptValidator'

interface PromptValidationPanelProps {
  validation: ValidationResult
  onApplySuggestion?: (original: string, suggestion: string) => void
  compact?: boolean
}

function SeverityIcon({ severity, size = 16 }: { severity: ValidationSeverity; size?: number }) {
  const classes = getSeverityClasses(severity)

  switch (severity) {
    case 'error':
      return <AlertCircle size={size} className={classes.icon} />
    case 'warning':
      return <AlertTriangle size={size} className={classes.icon} />
    case 'info':
      return <Info size={size} className={classes.icon} />
  }
}

function IssueItem({
  issue,
  onApplySuggestion
}: {
  issue: ValidationIssue
  onApplySuggestion?: (original: string, suggestion: string) => void
}) {
  const classes = getSeverityClasses(issue.severity)

  return (
    <div className={`flex items-start gap-2 p-2 rounded ${classes.bg} ${classes.border} border`}>
      <SeverityIcon severity={issue.severity} size={14} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs ${classes.text}`}>{issue.message}</p>
        {issue.suggestion && onApplySuggestion && (
          <button
            type="button"
            onClick={() => onApplySuggestion(issue.variable || '', issue.suggestion!)}
            className="mt-1 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-white hover:bg-gray-50 border border-gray-200 text-gray-700"
          >
            <Lightbulb size={12} />
            Aplicar: <code className="font-mono">{`{{${issue.suggestion}}}`}</code>
          </button>
        )}
      </div>
    </div>
  )
}

export default function PromptValidationPanel({
  validation,
  onApplySuggestion,
  compact = false
}: PromptValidationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showInfo, setShowInfo] = useState(false)

  const { isValid, issues, stats } = validation

  // Don't show panel if everything is valid and no info messages
  if (isValid && issues.length === 0) {
    return (
      <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle2 size={16} className="text-green-500" />
        <span className="text-xs text-green-700">
          Prompt válido - {stats.totalVariablesUsed} variable{stats.totalVariablesUsed !== 1 ? 's' : ''} en uso
        </span>
      </div>
    )
  }

  const errorIssues = issues.filter(i => i.severity === 'error')
  const warningIssues = issues.filter(i => i.severity === 'warning')
  const infoIssues = issues.filter(i => i.severity === 'info')

  // Compact mode - just show summary
  if (compact) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        {stats.errorCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle size={14} />
            {stats.errorCount} error{stats.errorCount !== 1 ? 'es' : ''}
          </div>
        )}
        {stats.warningCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-yellow-600">
            <AlertTriangle size={14} />
            {stats.warningCount} advertencia{stats.warningCount !== 1 ? 's' : ''}
          </div>
        )}
        {stats.errorCount === 0 && stats.warningCount === 0 && (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 size={14} />
            Válido
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`rounded-lg border ${isValid ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-opacity-80 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isValid ? (
            <AlertTriangle size={18} className="text-yellow-500" />
          ) : (
            <AlertCircle size={18} className="text-red-500" />
          )}
          <span className={`text-sm font-medium ${isValid ? 'text-yellow-700' : 'text-red-700'}`}>
            Validación del Prompt
          </span>
          <div className="flex items-center gap-2 ml-2">
            {stats.errorCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700">
                {stats.errorCount} error{stats.errorCount !== 1 ? 'es' : ''}
              </span>
            )}
            {stats.warningCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700">
                {stats.warningCount} advertencia{stats.warningCount !== 1 ? 's' : ''}
              </span>
            )}
            {infoIssues.length > 0 && !showInfo && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700">
                {infoIssues.length} info
              </span>
            )}
          </div>
        </div>
        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-2">
          {/* Errors */}
          {errorIssues.length > 0 && (
            <div className="space-y-1.5">
              {errorIssues.map((issue, idx) => (
                <IssueItem key={`error-${idx}`} issue={issue} onApplySuggestion={onApplySuggestion} />
              ))}
            </div>
          )}

          {/* Warnings */}
          {warningIssues.length > 0 && (
            <div className="space-y-1.5">
              {warningIssues.map((issue, idx) => (
                <IssueItem key={`warning-${idx}`} issue={issue} onApplySuggestion={onApplySuggestion} />
              ))}
            </div>
          )}

          {/* Info toggle */}
          {infoIssues.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowInfo(!showInfo)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Info size={12} />
                {showInfo ? 'Ocultar' : 'Mostrar'} {infoIssues.length} sugerencia{infoIssues.length !== 1 ? 's' : ''} informativas
              </button>
              {showInfo && (
                <div className="mt-2 space-y-1.5">
                  {infoIssues.map((issue, idx) => (
                    <IssueItem key={`info-${idx}`} issue={issue} onApplySuggestion={onApplySuggestion} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stats summary */}
          <div className="pt-2 border-t border-gray-200 flex items-center gap-4 text-xs text-gray-500">
            <span>Variables usadas: {stats.totalVariablesUsed}</span>
            <span>Variables declaradas: {stats.totalVariablesDeclared}</span>
            {stats.undeclaredCount > 0 && (
              <span className="text-red-600">No declaradas: {stats.undeclaredCount}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Compact inline badge for showing validation status
export function ValidationBadge({ validation }: { validation: ValidationResult }) {
  const { isValid, stats } = validation

  if (isValid && stats.warningCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">
        <CheckCircle2 size={12} />
        Válido
      </span>
    )
  }

  if (!isValid) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">
        <AlertCircle size={12} />
        {stats.errorCount} error{stats.errorCount !== 1 ? 'es' : ''}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs">
      <AlertTriangle size={12} />
      {stats.warningCount} advertencia{stats.warningCount !== 1 ? 's' : ''}
    </span>
  )
}
