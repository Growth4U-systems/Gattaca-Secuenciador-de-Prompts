'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Database,
  FileText,
  Copy,
  Check,
} from 'lucide-react'
import { usePlaybook } from './PlaybookContext'
import { StepState } from './types'

interface SessionDataPanelProps {
  /** Whether to show the panel in collapsed mode initially */
  defaultCollapsed?: boolean
  /** Custom class name for the container */
  className?: string
}

/**
 * SessionDataPanel - Displays session information and step data
 *
 * Shows:
 * - Session ID and timestamps
 * - Step completion status
 * - Step outputs for debugging/review
 * - Copy functionality for step data
 */
export default function SessionDataPanel({
  defaultCollapsed = true,
  className = '',
}: SessionDataPanelProps) {
  const { data } = usePlaybook()
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const toggleStepExpanded = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const formatTimestamp = (date: Date | undefined) => {
    if (!date) return '-'
    return new Intl.DateTimeFormat('es', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(date))
  }

  const getStatusIcon = (status: StepState['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-200" />
    }
  }

  // Collect all steps with their states
  const allSteps = data.playbookConfig.phases.flatMap((phase, phaseIndex) =>
    phase.steps.map((step, stepIndex) => ({
      step,
      state: data.state.phases[phaseIndex]?.steps[stepIndex],
      phaseName: phase.name,
    }))
  )

  const completedStepsData = allSteps.filter(s => s.state?.status === 'completed')
  const inProgressStep = allSteps.find(s => s.state?.status === 'in_progress')
  const errorSteps = allSteps.filter(s => s.state?.status === 'error')

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
          <Database className="w-4 h-4 text-indigo-500" />
          <span className="font-medium text-gray-700">Session Data</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{data.completedSteps}/{data.totalSteps} steps</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
            {data.progressPercentage}%
          </span>
        </div>
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="border-t border-gray-200 px-4 py-4 space-y-4">
          {/* Session Info */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Session Info
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Session ID:</span>
                <div className="flex items-center gap-1">
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                    {data.sessionId ? `${data.sessionId.slice(0, 8)}...` : 'N/A'}
                  </code>
                  {data.sessionId && (
                    <button
                      onClick={() => copyToClipboard(data.sessionId!, 'sessionId')}
                      className="p-0.5 hover:bg-gray-100 rounded"
                      title="Copy full session ID"
                    >
                      {copiedId === 'sessionId' ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400" />
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Playbook:</span>
                <span className="ml-1 text-gray-700">{data.playbookConfig.name}</span>
              </div>
              <div>
                <span className="text-gray-500">Started:</span>
                <span className="ml-1 text-gray-700">
                  {formatTimestamp(data.state.startedAt)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Current Step:</span>
                <span className="ml-1 text-gray-700">
                  {data.currentStep?.name ?? 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Save State */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Save Status
            </h4>
            <div className="flex items-center gap-4 text-sm">
              {data.saveState.isSaving ? (
                <span className="flex items-center gap-1 text-blue-600">
                  <Clock className="w-3 h-3 animate-spin" />
                  Saving...
                </span>
              ) : data.saveState.lastSavedAt ? (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-3 h-3" />
                  Last saved: {formatTimestamp(data.saveState.lastSavedAt)}
                </span>
              ) : (
                <span className="text-gray-500">Not saved yet</span>
              )}
              {data.saveState.saveError && (
                <span className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="w-3 h-3" />
                  {data.saveState.saveError}
                </span>
              )}
            </div>
          </div>

          {/* Step Status Summary */}
          {(errorSteps.length > 0 || inProgressStep) && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Step Status
              </h4>
              <div className="space-y-1">
                {inProgressStep && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Clock className="w-4 h-4 animate-pulse" />
                    <span>In Progress: {inProgressStep.step.name}</span>
                  </div>
                )}
                {errorSteps.map(({ step, state }) => (
                  <div key={step.id} className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>Error: {step.name}</span>
                    {state?.error && (
                      <span className="text-xs text-gray-500">- {state.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Steps with Data */}
          {completedStepsData.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Completed Steps ({completedStepsData.length})
              </h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {completedStepsData.map(({ step, state, phaseName }) => (
                  <div key={step.id} className="border border-gray-100 rounded">
                    <button
                      onClick={() => toggleStepExpanded(step.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      {expandedSteps.has(step.id) ? (
                        <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      )}
                      {getStatusIcon(state?.status || 'pending')}
                      <span className="text-sm text-gray-700 truncate flex-1">
                        {step.name}
                      </span>
                      <span className="text-xs text-gray-400">{phaseName}</span>
                      {state?.output && (
                        <FileText className="w-3 h-3 text-gray-400" />
                      )}
                    </button>

                    {expandedSteps.has(step.id) && state?.output && (
                      <div className="px-2 pb-2 border-t border-gray-100">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs text-gray-500">Output:</span>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                JSON.stringify(state.output, null, 2),
                                step.id
                              )
                            }
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                          >
                            {copiedId === step.id ? (
                              <>
                                <Check className="w-3 h-3 text-green-500" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                          {typeof state.output === 'string'
                            ? state.output.slice(0, 500) + (state.output.length > 500 ? '...' : '')
                            : JSON.stringify(state.output, null, 2).slice(0, 500) +
                              (JSON.stringify(state.output, null, 2).length > 500 ? '...' : '')}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
