'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Play,
  Pause,
  XCircle,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface JobStatus {
  job_id: string
  status: string
  phase: string
  progress: {
    serp: { total: number; completed: number }
    scraping: { total: number; completed: number; failed: number }
    extraction: { total: number; completed: number; filtered: number }
  }
  costs?: {
    serp: number
    firecrawl: number
    llm: number
  }
  url_counts?: {
    pending: number
    scraped: number
    filtered: number
    extracted: number
    failed: number
  }
}

interface JobControlPanelProps {
  jobId: string
  onStatusChange?: (status: string) => void
  compact?: boolean
}

export default function JobControlPanel({ jobId, onStatusChange, compact = false }: JobControlPanelProps) {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(!compact)

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
      if (!response.ok) {
        throw new Error('Error fetching job status')
      }
      const data = await response.json()
      setStatus(data)

      if (onStatusChange) {
        onStatusChange(data.status)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [jobId, onStatusChange])

  useEffect(() => {
    fetchStatus()

    // Poll for status updates if job is in progress
    const interval = setInterval(() => {
      if (status?.status && !['completed', 'failed'].includes(status.status)) {
        fetchStatus()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchStatus, status?.status])

  const handleResume = async () => {
    setActionLoading('resume')
    try {
      // Determine which phase to resume based on current status
      let endpoint = ''
      if (status?.status === 'serp_running' || status?.status === 'pending') {
        endpoint = `/api/niche-finder/jobs/${jobId}/serp`
      } else if (status?.status === 'scraping' || status?.status === 'serp_done') {
        endpoint = `/api/niche-finder/jobs/${jobId}/scrape`
      } else if (status?.status === 'extracting' || status?.status === 'scrape_done') {
        endpoint = `/api/niche-finder/jobs/${jobId}/extract`
      }

      if (endpoint) {
        const response = await fetch(endpoint, { method: 'POST' })
        if (!response.ok) {
          throw new Error('Error resuming job')
        }
      }

      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error resuming job')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async () => {
    if (!confirm('\u00bfEst\u00e1s seguro de que quieres cancelar este job? Esta acci\u00f3n no se puede deshacer.')) {
      return
    }

    setActionLoading('cancel')
    try {
      const response = await fetch(`/api/niche-finder/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed', error_message: 'Cancelled by user' }),
      })

      if (!response.ok) {
        throw new Error('Error cancelling job')
      }

      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cancelling job')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="animate-spin text-gray-400" size={20} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
        <AlertTriangle size={16} />
        {error}
        <button
          onClick={fetchStatus}
          className="ml-auto text-red-600 hover:text-red-800"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    )
  }

  if (!status) {
    return null
  }

  const isRunning = ['serp_running', 'scraping', 'extracting'].includes(status.status)
  const canResume = ['pending', 'serp_done', 'scrape_done'].includes(status.status)
  const isCompleted = status.status === 'completed'
  const isFailed = status.status === 'failed'

  const getStatusColor = () => {
    if (isCompleted) return 'bg-green-100 text-green-700 border-green-200'
    if (isFailed) return 'bg-red-100 text-red-700 border-red-200'
    if (isRunning) return 'bg-blue-100 text-blue-700 border-blue-200'
    return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  }

  const getStatusIcon = () => {
    if (isCompleted) return <CheckCircle size={16} />
    if (isFailed) return <XCircle size={16} />
    if (isRunning) return <Loader2 size={16} className="animate-spin" />
    return <Pause size={16} />
  }

  return (
    <div className={`border rounded-lg ${getStatusColor()}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium capitalize">{status.status.replace(/_/g, ' ')}</span>
          <span className="text-xs opacity-75">({status.phase})</span>
        </div>
        <div className="flex items-center gap-2">
          {!isCompleted && !isFailed && (
            <>
              {canResume && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleResume()
                  }}
                  disabled={actionLoading !== null}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-white/50 rounded hover:bg-white/80 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'resume' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Play size={12} />
                  )}
                  Reanudar
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCancel()
                }}
                disabled={actionLoading !== null}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'cancel' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <XCircle size={12} />
                )}
                Cancelar
              </button>
            </>
          )}
          {compact && (
            expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-current/20 p-3 space-y-3 bg-white/30">
          {/* Progress bars */}
          <div className="space-y-2">
            {/* SERP Progress */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>B\u00fasquedas SERP</span>
                <span>{status.progress.serp.completed}/{status.progress.serp.total}</span>
              </div>
              <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{
                    width: status.progress.serp.total > 0
                      ? `${(status.progress.serp.completed / status.progress.serp.total) * 100}%`
                      : '0%'
                  }}
                />
              </div>
            </div>

            {/* Scraping Progress */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Scraping</span>
                <span>
                  {status.progress.scraping.completed}/{status.progress.scraping.total}
                  {status.progress.scraping.failed > 0 && (
                    <span className="text-red-600 ml-1">
                      ({status.progress.scraping.failed} fallidos)
                    </span>
                  )}
                </span>
              </div>
              <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{
                    width: status.progress.scraping.total > 0
                      ? `${(status.progress.scraping.completed / status.progress.scraping.total) * 100}%`
                      : '0%'
                  }}
                />
              </div>
            </div>

            {/* Extraction Progress */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Extracci\u00f3n</span>
                <span>
                  {status.progress.extraction.completed}/{status.progress.extraction.total}
                  {status.progress.extraction.filtered > 0 && (
                    <span className="text-yellow-600 ml-1">
                      ({status.progress.extraction.filtered} filtrados)
                    </span>
                  )}
                </span>
              </div>
              <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all"
                  style={{
                    width: status.progress.extraction.total > 0
                      ? `${(status.progress.extraction.completed / status.progress.extraction.total) * 100}%`
                      : '0%'
                  }}
                />
              </div>
            </div>
          </div>

          {/* URL Counts */}
          {status.url_counts && (
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              <div>
                <div className="font-medium">{status.url_counts.pending}</div>
                <div className="text-gray-500">Pending</div>
              </div>
              <div>
                <div className="font-medium text-blue-600">{status.url_counts.scraped}</div>
                <div className="text-gray-500">Scraped</div>
              </div>
              <div>
                <div className="font-medium text-green-600">{status.url_counts.extracted}</div>
                <div className="text-gray-500">Extracted</div>
              </div>
              <div>
                <div className="font-medium text-yellow-600">{status.url_counts.filtered}</div>
                <div className="text-gray-500">Filtered</div>
              </div>
              <div>
                <div className="font-medium text-red-600">{status.url_counts.failed}</div>
                <div className="text-gray-500">Failed</div>
              </div>
            </div>
          )}

          {/* Costs */}
          {status.costs && (
            <div className="pt-2 border-t border-current/20 flex justify-between text-xs">
              <span>Costos:</span>
              <span>
                SERP: ${status.costs.serp.toFixed(3)} |
                Scrape: ${status.costs.firecrawl.toFixed(3)} |
                LLM: ${status.costs.llm.toFixed(3)}
              </span>
            </div>
          )}

          {/* Refresh button */}
          <div className="flex justify-end">
            <button
              onClick={fetchStatus}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
            >
              <RefreshCw size={12} />
              Actualizar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
