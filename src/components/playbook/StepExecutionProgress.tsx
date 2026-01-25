'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  RotateCcw,
  Globe,
  Search,
  FileText,
  Sparkles,
  X,
} from 'lucide-react'

/**
 * Execution type determines the display style and available information
 */
export type ExecutionType = 'search' | 'scrape' | 'extract' | 'llm' | 'generic'

/**
 * Execution status
 */
export type ExecutionStatus = 'running' | 'paused' | 'completed' | 'error'

/**
 * Log entry for the details section
 */
export interface LogEntry {
  timestamp: Date
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

/**
 * Progress data for countable operations
 */
export interface ProgressData {
  current: number
  total: number
  label?: string
}

/**
 * Partial results shown during execution
 */
export interface PartialResults {
  /** Last URL being processed (for scraping/search) */
  lastUrl?: string
  /** Content snippet from last operation */
  lastSnippet?: string
  /** Count of items found so far (for extraction) */
  itemsFound?: number
  /** Success count */
  successCount?: number
  /** Failed count */
  failedCount?: number
  /** Last few items found/processed */
  lastItems?: string[]
}

export interface StepExecutionProgressProps {
  /** Type of execution for appropriate display */
  executionType: ExecutionType
  /** Current status of the execution */
  status: ExecutionStatus
  /** Current action being performed - updates in real-time */
  actionText: string
  /** Progress data if operation is countable */
  progress?: ProgressData
  /** Partial results to display during execution */
  partialResults?: PartialResults
  /** Recent log entries for the details section */
  logEntries?: LogEntry[]
  /** Error message when status is 'error' */
  errorMessage?: string
  /** Callback when pause is clicked - if not provided, pause button is hidden */
  onPause?: () => void
  /** Callback when resume is clicked */
  onResume?: () => void
  /** Callback when retry is clicked after error */
  onRetry?: () => void
  /** Callback when cancel is clicked */
  onCancel?: () => void
  /** Start time for elapsed time calculation - defaults to mount time */
  startTime?: Date
  /** Whether to show the details section expanded by default */
  defaultExpanded?: boolean
  /** Custom title for the progress component */
  title?: string
  /** Additional class names */
  className?: string
}

/**
 * Format elapsed time as mm:ss or hh:mm:ss
 */
function formatElapsedTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Get the appropriate icon for the execution type
 */
function getExecutionIcon(type: ExecutionType) {
  switch (type) {
    case 'search':
      return <Search className="w-5 h-5" />
    case 'scrape':
      return <Globe className="w-5 h-5" />
    case 'extract':
      return <FileText className="w-5 h-5" />
    case 'llm':
      return <Sparkles className="w-5 h-5" />
    default:
      return <Loader2 className="w-5 h-5" />
  }
}

/**
 * Get the status icon
 */
function getStatusIcon(status: ExecutionStatus, isPaused: boolean = false) {
  if (isPaused) {
    return <Pause className="w-4 h-4 text-amber-500" />
  }
  switch (status) {
    case 'running':
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
    case 'paused':
      return <Pause className="w-4 h-4 text-amber-500" />
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-500" />
  }
}

/**
 * Get color theme based on execution type
 */
function getColorTheme(type: ExecutionType) {
  switch (type) {
    case 'search':
      return {
        bg: 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50',
        border: 'border-blue-200',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        progressBg: 'bg-blue-100',
        progressBar: 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500',
        accent: 'text-blue-700',
        timeBg: 'bg-blue-100',
      }
    case 'scrape':
      return {
        bg: 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50',
        border: 'border-green-200',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
        progressBg: 'bg-green-100',
        progressBar: 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500',
        accent: 'text-green-700',
        timeBg: 'bg-green-100',
      }
    case 'extract':
      return {
        bg: 'bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50',
        border: 'border-purple-200',
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-600',
        progressBg: 'bg-purple-100',
        progressBar: 'bg-gradient-to-r from-purple-500 via-violet-500 to-fuchsia-500',
        accent: 'text-purple-700',
        timeBg: 'bg-purple-100',
      }
    case 'llm':
      return {
        bg: 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50',
        border: 'border-amber-200',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        progressBg: 'bg-amber-100',
        progressBar: 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500',
        accent: 'text-amber-700',
        timeBg: 'bg-amber-100',
      }
    default:
      return {
        bg: 'bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50',
        border: 'border-gray-200',
        iconBg: 'bg-gray-100',
        iconColor: 'text-gray-600',
        progressBg: 'bg-gray-100',
        progressBar: 'bg-gradient-to-r from-gray-500 via-slate-500 to-zinc-500',
        accent: 'text-gray-700',
        timeBg: 'bg-gray-100',
      }
  }
}

/**
 * Get default title based on execution type
 */
function getDefaultTitle(type: ExecutionType): string {
  switch (type) {
    case 'search':
      return 'Searching...'
    case 'scrape':
      return 'Scraping content...'
    case 'extract':
      return 'Extracting data...'
    case 'llm':
      return 'Processing with AI...'
    default:
      return 'Processing...'
  }
}

/**
 * Format log entry timestamp
 */
function formatLogTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Get log entry color
 */
function getLogEntryColor(type: LogEntry['type']): string {
  switch (type) {
    case 'success':
      return 'text-green-700 bg-green-50'
    case 'warning':
      return 'text-amber-700 bg-amber-50'
    case 'error':
      return 'text-red-700 bg-red-50'
    default:
      return 'text-gray-700 bg-gray-50'
  }
}

/**
 * StepExecutionProgress - Live progress component for long-running step execution
 *
 * Features:
 * - Real-time action text updates
 * - Progress bar for countable operations
 * - Elapsed time display
 * - Type-specific displays (scraping: URL + snippet, extraction: items found)
 * - Expandable details section with log entries
 * - Pause/Resume functionality (where technically feasible)
 * - Error state with Retry button
 */
export default function StepExecutionProgress({
  executionType,
  status,
  actionText,
  progress,
  partialResults,
  logEntries = [],
  errorMessage,
  onPause,
  onResume,
  onRetry,
  onCancel,
  startTime,
  defaultExpanded = false,
  title,
  className = '',
}: StepExecutionProgressProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(defaultExpanded)
  const [internalStartTime] = useState<Date>(startTime || new Date())

  // Timer for elapsed time
  useEffect(() => {
    if (status === 'running') {
      const timer = setInterval(() => {
        const now = new Date()
        const elapsed = Math.floor((now.getTime() - internalStartTime.getTime()) / 1000)
        setElapsedSeconds(elapsed)
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [status, internalStartTime])

  // Color theme based on execution type
  const theme = getColorTheme(executionType)

  // Calculate progress percentage
  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : null

  // Handle pause/resume toggle
  const handlePauseResume = useCallback(() => {
    if (status === 'paused' && onResume) {
      onResume()
    } else if (status === 'running' && onPause) {
      onPause()
    }
  }, [status, onPause, onResume])

  // Determine display title
  const displayTitle = title || getDefaultTitle(executionType)

  // Render error state
  if (status === 'error') {
    return (
      <div className={`${theme.bg} border ${theme.border} rounded-lg shadow-sm ${className}`}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-red-900">Execution Failed</h4>
              <p className="text-sm text-red-700 mt-1">
                {errorMessage || 'An error occurred during execution'}
              </p>
            </div>
          </div>

          {/* Error details and retry button */}
          <div className="mt-4 flex items-center gap-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
            )}
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            )}
          </div>

          {/* Elapsed time */}
          {elapsedSeconds > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
              <Clock className="w-4 h-4" />
              <span>Failed after {formatElapsedTime(elapsedSeconds)}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Render completed state
  if (status === 'completed') {
    return (
      <div className={`${theme.bg} border ${theme.border} rounded-lg shadow-sm ${className}`}>
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-green-900">Completed</h4>
              <p className="text-sm text-green-700">
                {actionText || 'Execution completed successfully'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-100 px-3 py-1 rounded-full">
              <Clock className="w-4 h-4" />
              <span>{formatElapsedTime(elapsedSeconds)}</span>
            </div>
          </div>

          {/* Final stats */}
          {progress && (
            <div className="mt-3 text-sm text-green-700">
              Processed {progress.current} {progress.label || 'items'}
            </div>
          )}
          {partialResults?.successCount !== undefined && (
            <div className="mt-2 flex gap-4 text-sm">
              <span className="text-green-700">
                {partialResults.successCount} successful
              </span>
              {partialResults.failedCount !== undefined && partialResults.failedCount > 0 && (
                <span className="text-red-600">
                  {partialResults.failedCount} failed
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Render running/paused state
  return (
    <div className={`${theme.bg} border ${theme.border} rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className={`p-2 ${theme.iconBg} rounded-lg`}>
          <div className={theme.iconColor}>
            {getExecutionIcon(executionType)}
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className={`font-medium ${theme.accent}`}>{displayTitle}</h4>
            {getStatusIcon(status)}
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{actionText}</p>
        </div>

        {/* Elapsed time */}
        <div className={`flex items-center gap-2 text-sm ${theme.accent} ${theme.timeBg} px-3 py-1 rounded-full`}>
          <Clock className="w-4 h-4" />
          <span>{formatElapsedTime(elapsedSeconds)}</span>
        </div>

        {/* Pause/Resume button */}
        {(onPause || onResume) && (
          <button
            onClick={handlePauseResume}
            className={`p-2 rounded-lg transition-colors ${
              status === 'paused'
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}
            title={status === 'paused' ? 'Resume' : 'Pause'}
          >
            {status === 'paused' ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Details toggle */}
        <button
          onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
          className="p-2 hover:bg-white/50 rounded-lg transition-colors"
        >
          {isDetailsExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-4">
        {/* Progress stats */}
        {progress && (
          <div className="flex justify-between items-center mb-2 text-sm">
            <span className="text-gray-600">{progress.label || 'Progress'}</span>
            <span className={`font-medium ${theme.accent}`}>
              {progress.current} / {progress.total}
              {progressPercent !== null && (
                <span className="ml-2 text-gray-500">({progressPercent}%)</span>
              )}
            </span>
          </div>
        )}

        {/* Progress bar */}
        <div className={`h-2 ${theme.progressBg} rounded-full overflow-hidden`}>
          <div
            className={`h-full ${theme.progressBar} rounded-full transition-all duration-300 ${
              status === 'running' ? 'animate-pulse' : ''
            }`}
            style={{
              width: progressPercent !== null
                ? `${progressPercent}%`
                : status === 'running'
                  ? `${Math.min((elapsedSeconds / 300) * 100, 95)}%`
                  : '0%',
            }}
          />
        </div>

        {/* Success/Failed counts */}
        {(partialResults?.successCount !== undefined || partialResults?.failedCount !== undefined) && (
          <div className="flex gap-4 text-sm mt-2">
            {partialResults.successCount !== undefined && (
              <div className="flex items-center gap-1.5 text-green-700">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{partialResults.successCount} successful</span>
              </div>
            )}
            {partialResults.failedCount !== undefined && partialResults.failedCount > 0 && (
              <div className="flex items-center gap-1.5 text-red-600">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{partialResults.failedCount} failed</span>
              </div>
            )}
          </div>
        )}

        {/* Type-specific partial results */}
        {/* For scraping: show last URL and snippet */}
        {executionType === 'scrape' && partialResults?.lastUrl && (
          <div className="mt-3 p-3 bg-white/60 rounded-lg border border-gray-200 space-y-2">
            <div className="flex items-start gap-2">
              <Globe className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-500 break-all line-clamp-1">
                {partialResults.lastUrl}
              </p>
            </div>
            {partialResults.lastSnippet && (
              <p className="text-sm text-gray-700 line-clamp-2 italic">
                "{partialResults.lastSnippet}"
              </p>
            )}
          </div>
        )}

        {/* For extraction: show items found count */}
        {executionType === 'extract' && partialResults?.itemsFound !== undefined && (
          <div className="mt-3 p-3 bg-white/60 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-purple-700">
                {partialResults.itemsFound} items extracted so far
              </span>
            </div>
            {partialResults.lastItems && partialResults.lastItems.length > 0 && (
              <div className="mt-2 space-y-1">
                {partialResults.lastItems.slice(-3).map((item, index) => (
                  <p key={index} className="text-xs text-gray-600 line-clamp-1">
                    • {item}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* For search: show last query */}
        {executionType === 'search' && partialResults?.lastItems && partialResults.lastItems.length > 0 && (
          <div className="mt-3 p-3 bg-white/60 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-medium text-blue-700">Recent queries</span>
            </div>
            <div className="space-y-1">
              {partialResults.lastItems.slice(-3).map((query, index) => (
                <p key={index} className="text-xs text-gray-600">
                  • {query}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Paused indicator */}
        {status === 'paused' && (
          <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700">
              <Pause className="w-4 h-4" />
              <span className="text-sm font-medium">Execution paused</span>
            </div>
            <p className="text-xs text-amber-600 mt-1">
              Click the play button to resume execution
            </p>
          </div>
        )}
      </div>

      {/* Expandable details section */}
      {isDetailsExpanded && (
        <div className="border-t border-gray-200 bg-white/50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-600 uppercase tracking-wide mb-3">
            <FileText className="w-3 h-3" />
            Execution Log ({logEntries.length} entries)
          </div>

          {logEntries.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No log entries yet...</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {logEntries.map((entry, index) => (
                <div
                  key={index}
                  className={`p-2 rounded text-sm ${getLogEntryColor(entry.type)}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 font-mono flex-shrink-0">
                      {formatLogTime(entry.timestamp)}
                    </span>
                    <span className="flex-1">{entry.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
