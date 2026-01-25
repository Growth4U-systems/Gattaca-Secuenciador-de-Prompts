'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  RotateCcw,
  SkipForward,
  HelpCircle,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react'
import { StepRetryInfo, StepAttempt } from './types'

export interface FailedStepActionsProps {
  /** Step name for display */
  stepName: string
  /** Current error message */
  errorMessage: string
  /** Retry information */
  retryInfo: StepRetryInfo
  /** Session ID for support reference */
  sessionId?: string
  /** Step ID for support reference */
  stepId: string
  /** Callback when retry is clicked (only shown if retries available) */
  onRetry?: () => void
  /** Callback when retry with config is requested */
  onRetryWithConfig?: () => void
  /** Callback when skip step is clicked */
  onSkip?: () => void
  /** Whether actions are disabled (e.g., during retry) */
  disabled?: boolean
  /** Additional class names */
  className?: string
}

/**
 * Format attempt for display
 */
function formatAttemptTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * FailedStepActions - Comprehensive action panel for failed steps
 *
 * Features:
 * - Shows when max retries reached OR as a fallback for any failed step
 * - Provides skip step option
 * - Contact support with pre-filled context
 * - Shows attempt history for debugging
 */
export default function FailedStepActions({
  stepName,
  errorMessage,
  retryInfo,
  sessionId,
  stepId,
  onRetry,
  onRetryWithConfig,
  onSkip,
  disabled = false,
  className = '',
}: FailedStepActionsProps) {
  const [showHistory, setShowHistory] = useState(false)
  const [copiedToClipboard, setCopiedToClipboard] = useState(false)

  const canRetry = retryInfo.attemptNumber < retryInfo.maxAttempts
  const maxRetriesReached = !canRetry

  /**
   * Generate support context text
   */
  const generateSupportContext = (): string => {
    const failedAttempts = retryInfo.attempts.filter(a => a.status === 'failed')
    const lastAttempt = failedAttempts[failedAttempts.length - 1]

    return `
Step Failure Report
===================
Step: ${stepName}
Step ID: ${stepId}
Session ID: ${sessionId || 'N/A'}

Error: ${errorMessage}

Attempt History:
${retryInfo.attempts.map((a, i) => `  ${i + 1}. ${a.status} at ${a.startedAt.toISOString()}${a.errorMessage ? ` - ${a.errorMessage}` : ''}`).join('\n')}

Config Used: ${lastAttempt?.configSnapshot ? JSON.stringify(lastAttempt.configSnapshot, null, 2) : 'Default'}
    `.trim()
  }

  /**
   * Copy support context to clipboard
   */
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateSupportContext())
      setCopiedToClipboard(true)
      setTimeout(() => setCopiedToClipboard(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  /**
   * Get status color for attempt
   */
  const getAttemptStatusColor = (attempt: StepAttempt): string => {
    switch (attempt.status) {
      case 'completed':
        return 'text-green-600 bg-green-50'
      case 'failed':
        return 'text-red-600 bg-red-50'
      case 'running':
        return 'text-blue-600 bg-blue-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${maxRetriesReached ? 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200' : 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${maxRetriesReached ? 'bg-orange-100' : 'bg-red-100'}`}>
            <AlertTriangle className={`w-5 h-5 ${maxRetriesReached ? 'text-orange-600' : 'text-red-600'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {maxRetriesReached ? 'Maximum Retries Reached' : 'Step Failed'}
            </h3>
            <p className="text-sm text-gray-600">{stepName}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-5">
        {/* Error message */}
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">Error Details:</p>
          <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
        </div>

        {/* Attempt summary */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <RotateCcw className="w-4 h-4" />
            <span>
              {retryInfo.attemptNumber} of {retryInfo.maxAttempts} attempts used
            </span>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <span>View History</span>
            {showHistory ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Attempt history */}
        {showHistory && (
          <div className="space-y-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Attempt History
            </h4>
            <div className="space-y-2">
              {retryInfo.attempts.map((attempt, index) => (
                <div
                  key={attempt.attemptId}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100"
                >
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getAttemptStatusColor(attempt)}`}>
                        {attempt.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatAttemptTime(attempt.startedAt)}
                      </span>
                    </div>
                    {attempt.errorMessage && (
                      <p className="text-xs text-gray-600 mt-1 truncate">
                        {attempt.errorMessage}
                      </p>
                    )}
                    {attempt.configSnapshot && Object.keys(attempt.configSnapshot).length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Config: {Object.entries(attempt.configSnapshot).map(([k, v]) => `${k}=${v}`).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">What would you like to do?</h4>

          <div className="grid gap-3">
            {/* Retry options (if retries available) */}
            {canRetry && (
              <div className="flex gap-2">
                {onRetry && (
                  <button
                    onClick={onRetry}
                    disabled={disabled}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Quick Retry
                  </button>
                )}
                {onRetryWithConfig && (
                  <button
                    onClick={onRetryWithConfig}
                    disabled={disabled}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 font-medium"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Retry with Settings
                  </button>
                )}
              </div>
            )}

            {/* Skip step */}
            {onSkip && (
              <button
                onClick={onSkip}
                disabled={disabled}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium"
              >
                <SkipForward className="w-4 h-4" />
                Skip This Step
                <span className="text-xs text-gray-500 ml-1">(Continue without this step&apos;s output)</span>
              </button>
            )}

            {/* Contact support section */}
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Need Help?</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  {copiedToClipboard ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Error Details
                    </>
                  )}
                </button>

                <a
                  href="mailto:support@example.com?subject=Step%20Failure%20Report"
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  <MessageSquare className="w-4 h-4" />
                  Contact Support
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Copy the error details above to share with our support team for faster resolution.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
