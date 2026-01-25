'use client'

import { ChevronDown, ChevronRight, AlertCircle, Check, ExternalLink, RefreshCw, Settings } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepDefinition, StepState } from '../types'
import { analyzeError, getErrorCategoryColor, ErrorAction } from './ErrorAnalyzer'

interface OutputSectionProps {
  step: StepDefinition
  stepState: StepState
  onRetry?: () => void
  defaultExpanded?: boolean
}

// Format output for display
function formatOutput(output: unknown): string {
  if (output === null || output === undefined) {
    return 'Sin output'
  }

  if (typeof output === 'string') {
    return output
  }

  return JSON.stringify(output, null, 2)
}

// Check if output is just a jobId wrapper
function isJobIdOutput(output: unknown): output is { jobId: string } {
  return (
    typeof output === 'object' &&
    output !== null &&
    'jobId' in output &&
    Object.keys(output).length <= 3 // jobId + maybe scrapedCount, failedCount
  )
}

export function OutputSection({
  step,
  stepState,
  onRetry,
  defaultExpanded = false,
}: OutputSectionProps) {
  const router = useRouter()
  const hasError = stepState.status === 'error' && stepState.error
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || hasError)

  // Analyze error if present
  const errorAnalysis = hasError ? analyzeError(stepState.error!, step) : null

  // Handle action clicks
  const handleAction = (action: ErrorAction) => {
    switch (action.type) {
      case 'navigate':
        if (action.href) {
          // If it's a query param, update current URL
          if (action.href.startsWith('?')) {
            const url = new URL(window.location.href)
            const params = new URLSearchParams(action.href.slice(1))
            params.forEach((value, key) => {
              url.searchParams.set(key, value)
            })
            router.push(url.toString())
          } else {
            router.push(action.href)
          }
        }
        break
      case 'retry':
        if (onRetry) onRetry()
        break
      case 'configure':
        router.push('?tab=setup')
        break
      case 'external':
        if (action.onClick) action.onClick()
        break
    }
  }

  const output = stepState.output
  const hasOutput = output !== null && output !== undefined

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        hasError ? getErrorCategoryColor(errorAnalysis!.category) : 'border-gray-200'
      }`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-3 transition-colors ${
          hasError ? 'hover:opacity-90' : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown size={16} className={hasError ? 'opacity-70' : 'text-gray-500'} />
          ) : (
            <ChevronRight size={16} className={hasError ? 'opacity-70' : 'text-gray-500'} />
          )}
          <span className={`text-sm font-medium ${hasError ? '' : 'text-gray-700'}`}>
            {hasError ? 'Error' : 'Resultado'}
          </span>
          {hasError && <AlertCircle size={14} />}
          {stepState.status === 'completed' && !hasError && (
            <Check size={14} className="text-green-600" />
          )}
        </div>
        {!isExpanded && !hasError && hasOutput && (
          <span className="text-xs text-gray-500">
            {isJobIdOutput(output) ? `Job: ${output.jobId.slice(0, 8)}...` : 'Ver resultado'}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className={`p-3 space-y-3 ${hasError ? '' : 'bg-white'}`}>
          {/* Error Display */}
          {hasError && errorAnalysis && (
            <div className="space-y-3">
              {/* Human readable message */}
              <div>
                <h4 className="font-medium">{errorAnalysis.humanMessage}</h4>
                <p className="text-sm mt-1 opacity-80">{errorAnalysis.suggestion}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {errorAnalysis.actions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAction(action)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      action.type === 'navigate' || action.type === 'configure'
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : action.type === 'retry'
                          ? 'bg-white/50 hover:bg-white/70 border'
                          : 'bg-white/30 hover:bg-white/50'
                    }`}
                  >
                    {action.type === 'navigate' || action.type === 'configure' ? (
                      <Settings size={14} />
                    ) : action.type === 'retry' ? (
                      <RefreshCw size={14} />
                    ) : (
                      <ExternalLink size={14} />
                    )}
                    {action.label}
                  </button>
                ))}
              </div>

              {/* Raw error (collapsible) */}
              <details className="text-xs opacity-60">
                <summary className="cursor-pointer hover:opacity-100">
                  Ver error completo
                </summary>
                <pre className="mt-2 p-2 bg-black/10 rounded overflow-auto max-h-32 font-mono">
                  {stepState.error}
                </pre>
              </details>
            </div>
          )}

          {/* Success Output */}
          {!hasError && hasOutput && (
            <div>
              {/* Special handling for jobId outputs */}
              {isJobIdOutput(output) ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Job ID:</span>
                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                      {output.jobId}
                    </code>
                  </div>
                  {(output as Record<string, unknown>).scrapedCount !== undefined && (
                    <div className="text-xs text-gray-600">
                      {String((output as Record<string, unknown>).scrapedCount)} URLs scrapeadas
                    </div>
                  )}
                  {(output as Record<string, unknown>).failedCount !== undefined &&
                    ((output as Record<string, unknown>).failedCount as number) > 0 && (
                      <div className="text-xs text-amber-600">
                        {String((output as Record<string, unknown>).failedCount)} URLs fallidas
                      </div>
                    )}
                </div>
              ) : (
                /* Generic output display */
                <div>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-48 text-gray-700 font-mono whitespace-pre-wrap">
                    {formatOutput(output).slice(0, 2000)}
                    {formatOutput(output).length > 2000 && '\n\n... (truncado)'}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* No output */}
          {!hasError && !hasOutput && stepState.status === 'completed' && (
            <div className="text-sm text-gray-500 italic">
              Paso completado sin output
            </div>
          )}

          {/* Pending state */}
          {!hasError && !hasOutput && stepState.status === 'pending' && (
            <div className="text-sm text-gray-400 italic">
              Pendiente de ejecución
            </div>
          )}
        </div>
      )}
    </div>
  )
}
