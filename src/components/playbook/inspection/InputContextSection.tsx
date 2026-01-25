'use client'

import { ChevronDown, ChevronRight, Check, Clock, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { StepDefinition, StepState } from '../types'

interface StepInfo {
  definition: StepDefinition
  state: StepState
}

interface InputContextSectionProps {
  step: StepDefinition
  stepState: StepState
  allSteps: StepInfo[]
  playbookContext: Record<string, unknown>
  defaultExpanded?: boolean
}

// Get status icon for a step
function StepStatusIcon({ status }: { status: StepState['status'] }) {
  switch (status) {
    case 'completed':
      return <Check size={12} className="text-green-600" />
    case 'in_progress':
      return <Clock size={12} className="text-blue-600 animate-pulse" />
    case 'error':
      return <AlertCircle size={12} className="text-red-600" />
    default:
      return <div className="w-3 h-3 rounded-full bg-gray-300" />
  }
}

export function InputContextSection({
  step,
  stepState,
  allSteps,
  playbookContext,
  defaultExpanded = false,
}: InputContextSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Find dependent steps
  const dependentSteps = (step.dependsOn || [])
    .map(depId => allSteps.find(s => s.definition.id === depId))
    .filter(Boolean) as StepInfo[]

  // Extract relevant context variables (excluding internal ones)
  const relevantContext = Object.entries(playbookContext).filter(([key]) => {
    // Skip internal keys
    if (key.endsWith('_output')) return false
    if (key === 'serpJobId') return false
    if (key === 'latestJobId') return false
    return true
  })

  // Get jobId if present in context
  const jobId = playbookContext.serpJobId as string | undefined

  // Get input data if present
  const inputData = stepState.input

  const hasContent = dependentSteps.length > 0 || relevantContext.length > 0 || jobId || inputData

  if (!hasContent) {
    return null
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown size={16} className="text-gray-500" />
          ) : (
            <ChevronRight size={16} className="text-gray-500" />
          )}
          <span className="text-sm font-medium text-gray-700">Contexto de Entrada</span>
        </div>
        {!isExpanded && (
          <span className="text-xs text-gray-500">
            {dependentSteps.length > 0 && `${dependentSteps.length} dependencia(s)`}
            {relevantContext.length > 0 && ` · ${relevantContext.length} variable(s)`}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="p-3 space-y-3 bg-white">
          {/* Dependencies */}
          {dependentSteps.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Depende de
              </h4>
              <div className="space-y-1">
                {dependentSteps.map(dep => (
                  <div
                    key={dep.definition.id}
                    className="flex items-center gap-2 text-sm text-gray-700"
                  >
                    <StepStatusIcon status={dep.state.status} />
                    <span>{dep.definition.name}</span>
                    {dep.state.status === 'completed' && dep.state.output && (
                      <span className="text-xs text-gray-400">
                        ({typeof dep.state.output === 'object' && 'jobId' in dep.state.output
                          ? 'jobId: ' + (dep.state.output.jobId as string).slice(0, 8) + '...'
                          : 'con output'})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Job ID */}
          {jobId && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Job ID
              </h4>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700 font-mono">
                {jobId}
              </code>
            </div>
          )}

          {/* Context Variables */}
          {relevantContext.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Variables
              </h4>
              <div className="space-y-1">
                {relevantContext.slice(0, 5).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-2 text-sm">
                    <span className="text-gray-500 font-mono text-xs">{key}:</span>
                    <span className="text-gray-700 text-xs truncate max-w-[200px]">
                      {Array.isArray(value)
                        ? `[${value.length} items]`
                        : typeof value === 'object'
                          ? JSON.stringify(value).slice(0, 50) + '...'
                          : String(value).slice(0, 50)}
                    </span>
                  </div>
                ))}
                {relevantContext.length > 5 && (
                  <span className="text-xs text-gray-400">
                    +{relevantContext.length - 5} más
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Input data */}
          {inputData && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Input
              </h4>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-24 text-gray-700">
                {typeof inputData === 'string'
                  ? inputData.slice(0, 200)
                  : JSON.stringify(inputData, null, 2).slice(0, 200)}
                {(typeof inputData === 'string' ? inputData.length : JSON.stringify(inputData).length) > 200 && '...'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
