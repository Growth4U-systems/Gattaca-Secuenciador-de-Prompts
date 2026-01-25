'use client'

import { ChevronDown, ChevronRight, Loader2, Clock, DollarSign, Zap } from 'lucide-react'
import { useState, useEffect } from 'react'
import { StepDefinition, StepState } from '../types'

interface JobStatus {
  job_id: string
  status: string
  phase?: string
  progress?: {
    serp?: { total: number; completed: number }
    scraping?: { total: number; completed: number; failed: number }
    extraction?: { total: number; completed: number; filtered: number }
  }
  costs?: { serp: number; firecrawl: number; llm: number }
  url_counts?: { pending: number; scraped: number; filtered: number; extracted: number; failed: number }
}

interface ExecutionSectionProps {
  step: StepDefinition
  stepState: StepState
  playbookContext: Record<string, unknown>
  defaultExpanded?: boolean
}

// Hook to fetch job status
function useJobStatus(jobId: string | undefined) {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return

    let cancelled = false

    async function fetchStatus() {
      setLoading(true)
      try {
        const res = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
        if (!res.ok) throw new Error('Error fetching job status')
        const data = await res.json()
        if (!cancelled) setStatus(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStatus()

    return () => {
      cancelled = true
    }
  }, [jobId])

  return { status, loading, error }
}

// Format duration
function formatDuration(startedAt?: Date, completedAt?: Date): string {
  if (!startedAt) return '-'

  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const durationMs = end - start

  if (durationMs < 1000) return '<1s'
  if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`
  if (durationMs < 3600000) return `${Math.round(durationMs / 60000)}m`
  return `${Math.round(durationMs / 3600000)}h`
}

// Get executor label
function getExecutorLabel(executor: StepDefinition['executor']): string {
  switch (executor) {
    case 'llm':
      return 'LLM (OpenRouter)'
    case 'job':
      return 'Background Job'
    case 'api':
      return 'API Call'
    case 'custom':
      return 'Custom Logic'
    case 'none':
      return 'Sin ejecución'
    default:
      return executor
  }
}

export function ExecutionSection({
  step,
  stepState,
  playbookContext,
  defaultExpanded = false,
}: ExecutionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || stepState.status === 'in_progress')

  // Get jobId from various sources
  const jobId =
    (stepState.output as { jobId?: string })?.jobId ||
    (playbookContext.serpJobId as string) ||
    undefined

  const { status: jobStatus, loading: jobLoading } = useJobStatus(
    step.executor === 'job' ? jobId : undefined
  )

  // Calculate total cost
  const totalCost = jobStatus?.costs
    ? (jobStatus.costs.serp || 0) + (jobStatus.costs.firecrawl || 0) + (jobStatus.costs.llm || 0)
    : 0

  const isRunning = stepState.status === 'in_progress'
  const hasJobInfo = step.executor === 'job' && jobId

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
          <span className="text-sm font-medium text-gray-700">Ejecución</span>
          {isRunning && <Loader2 size={14} className="animate-spin text-blue-500" />}
        </div>
        {!isExpanded && (
          <span className="text-xs text-gray-500">
            {getExecutorLabel(step.executor)}
            {totalCost > 0 && ` · $${totalCost.toFixed(3)}`}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="p-3 space-y-3 bg-white">
          {/* Executor Type */}
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-gray-500">Tipo</span>
              <div className="flex items-center gap-1.5 text-sm text-gray-700">
                <Zap size={14} className="text-amber-500" />
                {getExecutorLabel(step.executor)}
              </div>
            </div>

            {/* Duration */}
            {stepState.startedAt && (
              <div>
                <span className="text-xs text-gray-500">Duración</span>
                <div className="flex items-center gap-1.5 text-sm text-gray-700">
                  <Clock size={14} className="text-gray-400" />
                  {formatDuration(stepState.startedAt, stepState.completedAt)}
                </div>
              </div>
            )}

            {/* Cost */}
            {totalCost > 0 && (
              <div>
                <span className="text-xs text-gray-500">Costo</span>
                <div className="flex items-center gap-1.5 text-sm text-gray-700">
                  <DollarSign size={14} className="text-green-500" />
                  ${totalCost.toFixed(3)}
                </div>
              </div>
            )}
          </div>

          {/* Progress (from stepState) */}
          {stepState.progress && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{stepState.progress.label || 'Progreso'}</span>
                <span>
                  {stepState.progress.current}/{stepState.progress.total}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${stepState.progress.total > 0 ? (stepState.progress.current / stepState.progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Job Status Details */}
          {hasJobInfo && (
            <div className="pt-2 border-t border-gray-100">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Estado del Job
              </h4>

              {jobLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 size={14} className="animate-spin" />
                  Cargando...
                </div>
              ) : jobStatus ? (
                <div className="space-y-2">
                  {/* Job Status */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Estado:</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        jobStatus.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : jobStatus.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {jobStatus.status}
                    </span>
                  </div>

                  {/* URL Counts */}
                  {jobStatus.url_counts && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {jobStatus.url_counts.scraped > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-gray-600">
                            {jobStatus.url_counts.scraped} scrapeadas
                          </span>
                        </div>
                      )}
                      {jobStatus.url_counts.failed > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-red-500 rounded-full" />
                          <span className="text-gray-600">
                            {jobStatus.url_counts.failed} fallidas
                          </span>
                        </div>
                      )}
                      {jobStatus.url_counts.extracted > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-purple-500 rounded-full" />
                          <span className="text-gray-600">
                            {jobStatus.url_counts.extracted} extraídas
                          </span>
                        </div>
                      )}
                      {jobStatus.url_counts.filtered > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-gray-400 rounded-full" />
                          <span className="text-gray-600">
                            {jobStatus.url_counts.filtered} filtradas
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cost Breakdown */}
                  {jobStatus.costs && totalCost > 0 && (
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {jobStatus.costs.serp > 0 && (
                        <div>SERP: ${jobStatus.costs.serp.toFixed(3)}</div>
                      )}
                      {jobStatus.costs.firecrawl > 0 && (
                        <div>Firecrawl: ${jobStatus.costs.firecrawl.toFixed(3)}</div>
                      )}
                      {jobStatus.costs.llm > 0 && (
                        <div>LLM: ${jobStatus.costs.llm.toFixed(3)}</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs text-gray-400">No se pudo cargar el estado</span>
              )}
            </div>
          )}

          {/* Partial Results */}
          {stepState.partialResults && (
            <div className="pt-2 border-t border-gray-100">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Resultados Parciales
              </h4>
              <div className="space-y-1 text-xs">
                {stepState.partialResults.successCount !== undefined && (
                  <div className="text-green-600">
                    {stepState.partialResults.successCount} exitosos
                  </div>
                )}
                {stepState.partialResults.failedCount !== undefined &&
                  stepState.partialResults.failedCount > 0 && (
                    <div className="text-red-600">
                      {stepState.partialResults.failedCount} fallidos
                    </div>
                  )}
                {stepState.partialResults.lastUrl && (
                  <div className="text-gray-500 truncate">
                    Última: {stepState.partialResults.lastUrl}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
