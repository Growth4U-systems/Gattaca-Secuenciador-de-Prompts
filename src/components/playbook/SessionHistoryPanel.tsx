'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, CheckCircle, XCircle, Loader2, AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'

interface SessionStep {
  id: string
  step_id: string
  status: string
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  output: unknown
}

interface SessionJob {
  id: string
  status: string
  urls_found: number
  urls_scraped: number
  urls_failed: number
  niches_extracted: number
  created_at: string
  updated_at: string
}

interface TimelineEvent {
  type: 'step' | 'job'
  id: string
  title: string
  status: string
  timestamp: string
  details?: Record<string, unknown>
}

interface Session {
  id: string
  project_id: string
  playbook_type: string
  status: string
  current_phase: string | null
  current_step: string | null
  config: Record<string, unknown>
  variables: Record<string, unknown>
  created_at: string
  updated_at: string
  completed_at: string | null
  active_job_id: string | null
}

interface SessionHistoryPanelProps {
  sessionId: string
  onClose?: () => void
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle size={16} className="text-green-500" />
    case 'in_progress':
      return <Loader2 size={16} className="text-blue-500 animate-spin" />
    case 'error':
    case 'failed':
      return <XCircle size={16} className="text-red-500" />
    case 'pending':
      return <Clock size={16} className="text-gray-400" />
    default:
      return <AlertTriangle size={16} className="text-yellow-500" />
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SessionHistoryPanel({ sessionId, onClose }: SessionHistoryPanelProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [steps, setSteps] = useState<SessionStep[]>([])
  const [jobs, setJobs] = useState<SessionJob[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())

  const loadSessionData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/playbook/sessions/${sessionId}`)
      if (!response.ok) {
        throw new Error('Error loading session data')
      }

      const data = await response.json()
      setSession(data.session)
      setSteps(data.steps || [])
      setJobs(data.jobs || [])
      setTimeline(data.timeline || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    loadSessionData()
  }, [loadSessionData])

  const toggleEvent = (eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev)
      if (newSet.has(eventId)) {
        newSet.delete(eventId)
      } else {
        newSet.add(eventId)
      }
      return newSet
    })
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 text-sm">
        <AlertTriangle size={16} className="inline mr-2" />
        {error}
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No session data available
      </div>
    )
  }

  return (
    <div className="bg-white border-l border-gray-200 h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">Historial de Sesi\u00f3n</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {session.playbook_type} - {formatTimestamp(session.created_at)}
          </p>
        </div>
        <button
          onClick={loadSessionData}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          title="Actualizar"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Session Status */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          {getStatusIcon(session.status)}
          <span className="text-sm font-medium capitalize">{session.status}</span>
        </div>
        {session.current_step && (
          <p className="text-xs text-gray-500 mt-1">
            Paso actual: {session.current_step}
          </p>
        )}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-2">
          {timeline.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No hay eventos registrados
            </p>
          ) : (
            timeline.map((event, index) => (
              <div
                key={`${event.type}-${event.id}`}
                className="relative pl-6 pb-4"
              >
                {/* Timeline line */}
                {index < timeline.length - 1 && (
                  <div className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200" />
                )}

                {/* Status dot */}
                <div className="absolute left-0 top-0.5">
                  {getStatusIcon(event.status)}
                </div>

                {/* Event content */}
                <div
                  className="bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleEvent(event.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {expandedEvents.has(event.id) ? (
                        <ChevronDown size={14} className="text-gray-400" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-400" />
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {event.title}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                        {event.type}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </div>

                  {/* Expanded details */}
                  {expandedEvents.has(event.id) && event.details && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <pre className="text-xs text-gray-600 overflow-x-auto">
                        {JSON.stringify(event.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Jobs section */}
      {jobs.length > 0 && (
        <div className="border-t border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Jobs</h4>
          <div className="space-y-2">
            {jobs.map(job => (
              <div
                key={job.id}
                className="bg-gray-50 rounded-lg p-2 text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-gray-600">
                    {job.id.slice(0, 8)}...
                  </span>
                  <span className={`px-1.5 py-0.5 rounded ${
                    job.status === 'completed' ? 'bg-green-100 text-green-700' :
                    job.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-gray-500">
                  <span>URLs: {job.urls_found}</span>
                  <span>Scraped: {job.urls_scraped}</span>
                  <span>Failed: {job.urls_failed}</span>
                  <span>Niches: {job.niches_extracted}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
