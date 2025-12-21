'use client'

import { useState, useEffect, useCallback } from 'react'
import { Brain, Clock, Search, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface DeepResearchProgressProps {
  campaignId: string
  stepId: string
  stepName: string
  interactionId: string
  logId: string
  onComplete: (result: string) => void
  onError: (error: string) => void
}

interface PollResponse {
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED' | string
  result?: string
  error?: string
  thinking_summaries?: string[]
}

export default function DeepResearchProgress({
  campaignId,
  stepId,
  stepName,
  interactionId,
  logId,
  onComplete,
  onError
}: DeepResearchProgressProps) {
  const [status, setStatus] = useState<string>('PROCESSING')
  const [thinkingSummaries, setThinkingSummaries] = useState<string[]>([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isPolling, setIsPolling] = useState(true)

  const pollStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/campaign/poll-deep-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interaction_id: interactionId,
          campaign_id: campaignId,
          step_id: stepId,
          log_id: logId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Polling failed')
      }

      const data: PollResponse = await response.json()

      setStatus(data.status)
      if (data.thinking_summaries && data.thinking_summaries.length > 0) {
        setThinkingSummaries(data.thinking_summaries)
      }

      if (data.status === 'COMPLETED') {
        setIsPolling(false)
        onComplete(data.result || '')
      } else if (data.status === 'FAILED') {
        setIsPolling(false)
        onError(data.error || 'Deep Research failed')
      }
    } catch (error) {
      console.error('Poll error:', error)
      // Don't stop polling on transient errors
    }
  }, [campaignId, stepId, interactionId, logId, onComplete, onError])

  // Timer for elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Polling loop - every 20 seconds
  useEffect(() => {
    if (!isPolling) return

    // Poll immediately
    pollStatus()

    // Then poll every 20 seconds
    const pollInterval = setInterval(pollStatus, 20000)

    return () => clearInterval(pollInterval)
  }, [isPolling, pollStatus])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'PROCESSING':
        return <Search className="w-4 h-4 animate-pulse" />
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'FAILED':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Loader2 className="w-4 h-4 animate-spin" />
    }
  }

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'PROCESSING':
        return 'Investigando...'
      case 'COMPLETED':
        return 'Completado'
      case 'FAILED':
        return 'Error'
      default:
        return 'Procesando...'
    }
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 rounded-lg p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Brain className="w-5 h-5 text-purple-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-purple-900">Deep Research en progreso</h4>
          <p className="text-sm text-purple-600">{stepName}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
          <Clock className="w-4 h-4" />
          <span>{formatTime(elapsedSeconds)}</span>
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 mb-3 text-sm text-indigo-700">
        {getStateIcon(status)}
        <span>{getStateLabel(status)}</span>
      </div>

      {/* Thinking summaries */}
      {thinkingSummaries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-600 uppercase tracking-wide">
            <FileText className="w-3 h-3" />
            Proceso de investigación
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {thinkingSummaries.map((summary, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg text-sm ${
                  index === thinkingSummaries.length - 1
                    ? 'bg-white border border-indigo-200 text-indigo-800 shadow-sm'
                    : 'bg-gray-50 text-gray-600'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 font-mono mt-0.5">
                    {index + 1}.
                  </span>
                  <span>{summary}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading state when no progress yet */}
      {thinkingSummaries.length === 0 && isPolling && (
        <div className="flex items-center justify-center gap-3 py-4 text-purple-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Iniciando Deep Research...</span>
        </div>
      )}

      {/* Progress bar animation */}
      <div className="mt-4 h-1 bg-purple-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 rounded-full animate-pulse"
          style={{
            width: status === 'COMPLETED' ? '100%' : `${Math.min((elapsedSeconds / 600) * 100, 95)}%`,
            transition: 'width 1s ease-out'
          }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Deep Research puede tardar entre 5-10 minutos
      </p>
    </div>
  )
}
