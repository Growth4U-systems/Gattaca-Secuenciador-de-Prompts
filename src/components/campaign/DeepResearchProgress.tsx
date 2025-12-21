'use client'

import { useState, useEffect } from 'react'
import { Brain, Clock, Search, FileText, Loader2, CheckCircle } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface DeepResearchProgressProps {
  campaignId: string
  stepId: string
  stepName: string
}

interface ProgressData {
  type: 'deep_research_progress'
  state: string
  elapsedSeconds: number
  thinkingSummaries: string[]
  currentAction?: string
}

export default function DeepResearchProgress({ campaignId, stepId, stepName }: DeepResearchProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [isPolling, setIsPolling] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null
    let mounted = true

    const pollProgress = async () => {
      try {
        // Fetch latest execution log for this campaign/step
        const { data, error } = await supabase
          .from('execution_logs')
          .select('error_details, status')
          .eq('campaign_id', campaignId)
          .eq('step_id', stepId)
          .eq('status', 'running')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (error) {
          // No running log found, maybe completed or not started
          if (error.code === 'PGRST116') {
            // No rows found - check if completed
            const { data: completedData } = await supabase
              .from('execution_logs')
              .select('status')
              .eq('campaign_id', campaignId)
              .eq('step_id', stepId)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()

            if (completedData?.status === 'completed') {
              setIsPolling(false)
            }
          }
          return
        }

        if (data?.error_details && mounted) {
          try {
            const progressData = typeof data.error_details === 'string'
              ? JSON.parse(data.error_details)
              : data.error_details

            if (progressData?.type === 'deep_research_progress') {
              setProgress(progressData)
            }
          } catch (e) {
            // Not valid JSON or not progress data
          }
        }
      } catch (err) {
        console.error('Error polling progress:', err)
      }
    }

    // Poll immediately and then every 3 seconds
    pollProgress()
    intervalId = setInterval(pollProgress, 3000)

    return () => {
      mounted = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [campaignId, stepId, supabase])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'PROCESSING':
        return <Search className="w-4 h-4 animate-pulse" />
      case 'THINKING':
        return <Brain className="w-4 h-4 animate-pulse" />
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4" />
      default:
        return <Loader2 className="w-4 h-4 animate-spin" />
    }
  }

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'PROCESSING':
        return 'Investigando...'
      case 'THINKING':
        return 'Analizando...'
      case 'COMPLETED':
        return 'Completado'
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
        {progress && (
          <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
            <Clock className="w-4 h-4" />
            <span>{formatTime(progress.elapsedSeconds)}</span>
          </div>
        )}
      </div>

      {/* Status indicator */}
      {progress && (
        <div className="flex items-center gap-2 mb-3 text-sm text-indigo-700">
          {getStateIcon(progress.state)}
          <span>{getStateLabel(progress.state)}</span>
          {progress.currentAction && (
            <span className="text-indigo-500">- {progress.currentAction}</span>
          )}
        </div>
      )}

      {/* Thinking summaries */}
      {progress?.thinkingSummaries && progress.thinkingSummaries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-600 uppercase tracking-wide">
            <FileText className="w-3 h-3" />
            Proceso de investigación
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {progress.thinkingSummaries.map((summary, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg text-sm ${
                  index === progress.thinkingSummaries.length - 1
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
      {!progress && isPolling && (
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
            width: progress ? `${Math.min((progress.elapsedSeconds / 600) * 100, 95)}%` : '5%',
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
