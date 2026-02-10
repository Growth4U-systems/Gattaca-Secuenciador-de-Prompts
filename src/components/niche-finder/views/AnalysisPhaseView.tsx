'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Loader2,
  Check,
  AlertCircle,
  Circle,
  Brain,
  Sparkles,
  BarChart3,
  Table,
  DollarSign,
} from 'lucide-react'
import type { StepProgress } from '@/lib/playbooks/niche-finder/types'

interface AnalysisPhaseViewProps {
  jobId: string
  onComplete: () => void
  onStepProgressUpdate: (progress: Record<string, StepProgress>) => void
}

// 4 real analysis steps matching the backend pipeline
const ANALYSIS_STEPS = [
  {
    id: 'extract-problems',
    name: 'Extraer Problemas',
    icon: Brain,
    model: 'GPT-4o-mini',
    description: 'Extrayendo pain points de cada URL con JTBD framework',
    // job.status values that mean this step is active
    jobStatuses: ['scrape_done', 'extracting'],
  },
  {
    id: 'clean-filter',
    name: 'Limpiar y Filtrar',
    icon: Sparkles,
    model: 'GPT-4o-mini',
    description: 'Deduplicando y consolidando a 30-50 nichos válidos',
    jobStatuses: ['analyzing_1'],
  },
  {
    id: 'scoring',
    name: 'Scoring (Deep Research)',
    icon: BarChart3,
    model: 'Gemini 2.5 Pro',
    description: 'Pain Score, Market Size, Reachability con investigación web',
    jobStatuses: ['analyzing_2'],
  },
  {
    id: 'consolidate',
    name: 'Tabla Final Consolidada',
    icon: Table,
    model: 'GPT-4o-mini',
    description: 'Combinando tabla filtrada con scores en tabla final',
    jobStatuses: ['analyzing_3'],
  },
]

/** Map job.status to the index of the currently active step */
function getActiveStepIndex(jobStatus: string): number {
  for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
    if (ANALYSIS_STEPS[i].jobStatuses.includes(jobStatus)) return i
  }
  // Extraction done, about to start clean-filter
  if (jobStatus === 'extract_done') return 1
  // All done
  if (jobStatus === 'completed') return ANALYSIS_STEPS.length
  // Default (e.g. pending, unknown)
  return 0
}

/** Derive a step's display status from its position relative to the active step */
function deriveStepStatus(
  stepIndex: number,
  activeIndex: number,
  jobFailed: boolean
): StepProgress['status'] {
  if (jobFailed && stepIndex === activeIndex) return 'failed'
  if (stepIndex < activeIndex) return 'completed'
  if (stepIndex === activeIndex) return 'running'
  return 'pending'
}

export default function AnalysisPhaseView({
  jobId,
  onComplete,
  onStepProgressUpdate,
}: AnalysisPhaseViewProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [jobFailed, setJobFailed] = useState(false)
  const [extractProgress, setExtractProgress] = useState<{
    completed: number
    total: number
    filtered: number
  }>({ completed: 0, total: 0, filtered: 0 })
  const [costs, setCosts] = useState<{
    serp: number
    firecrawl: number
    llm: number
  }>({ serp: 0, firecrawl: 0, llm: 0 })

  const pipelineStarted = useRef(false)
  const analyzeTriggered = useRef(false)
  const completedRef = useRef(false)

  // Sync step progress up to PhaseNavigation sidebar
  const syncProgress = useCallback(
    (activeIdx: number, failed: boolean, extractProg?: typeof extractProgress) => {
      const progress: Record<string, StepProgress> = {}
      const ep = extractProg || extractProgress
      ANALYSIS_STEPS.forEach((step, i) => {
        progress[step.id] = {
          stepId: step.id,
          status: deriveStepStatus(i, activeIdx, failed),
          ...(i === 0 && ep.total > 0
            ? { progress: { completed: ep.completed, total: ep.total } }
            : {}),
        }
      })
      onStepProgressUpdate(progress)
    },
    [extractProgress, onStepProgressUpdate]
  )

  useEffect(() => {
    syncProgress(activeStepIndex, jobFailed)
  }, [activeStepIndex, jobFailed, syncProgress])

  // Run the pipeline: extraction loop → fire analyze
  useEffect(() => {
    if (pipelineStarted.current) return
    pipelineStarted.current = true

    const run = async () => {
      try {
        // Check initial job status (handles page refresh mid-pipeline)
        const statusResp = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
        const statusData = await statusResp.json()
        const initialStatus = statusData.job?.status

        // If already past extraction, skip to monitoring
        if (
          ['analyzing_1', 'analyzing_2', 'analyzing_3', 'completed'].includes(
            initialStatus
          )
        ) {
          setActiveStepIndex(getActiveStepIndex(initialStatus))
          if (initialStatus === 'completed') {
            completedRef.current = true
            onComplete()
          }
          return
        }

        // If extraction done but analysis not triggered, trigger it
        if (initialStatus === 'extract_done') {
          setActiveStepIndex(1)
          triggerAnalyze()
          return
        }

        // Run extraction batch loop
        let hasMore = true
        while (hasMore) {
          const resp = await fetch(
            `/api/niche-finder/jobs/${jobId}/extract`,
            { method: 'POST' }
          )
          const data = await resp.json()
          if (!data.success) throw new Error(data.error || 'Extraction failed')
          hasMore = data.has_more
        }

        // Extraction complete → trigger analysis
        triggerAnalyze()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Error en extracción'
        )
        setJobFailed(true)
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  /** Fire /analyze POST (fire-and-forget — we track progress via polling) */
  const triggerAnalyze = useCallback(() => {
    if (analyzeTriggered.current) return
    analyzeTriggered.current = true

    fetch(`/api/niche-finder/jobs/${jobId}/analyze`, { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success && !completedRef.current) {
          setError(data.error || 'Analysis failed')
          setJobFailed(true)
        }
      })
      .catch((err) => {
        if (!completedRef.current) {
          setError(err.message)
          setJobFailed(true)
        }
      })
  }, [jobId])

  // Poll job status every 3s for real-time step tracking
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const resp = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
        const data = await resp.json()
        if (!data.job) return

        const job = data.job

        // Derive active step from real job.status
        const newActiveIdx = getActiveStepIndex(job.status)
        if (newActiveIdx >= 0) setActiveStepIndex(newActiveIdx)

        // Update extraction progress from real counters
        if (data.progress?.extraction) {
          const ep = {
            completed: data.progress.extraction.completed || 0,
            total: data.progress.extraction.total || 0,
            filtered: data.progress.extraction.filtered || 0,
          }
          setExtractProgress(ep)
          // Sync progress with updated extraction data
          syncProgress(newActiveIdx >= 0 ? newActiveIdx : activeStepIndex, false, ep)
        }

        // Update costs
        if (data.costs) setCosts(data.costs)

        // Completion
        if (job.status === 'completed' && !completedRef.current) {
          completedRef.current = true
          setActiveStepIndex(ANALYSIS_STEPS.length)
          clearInterval(poll)
          onComplete()
        }

        // Failure
        if (job.status === 'failed') {
          setJobFailed(true)
          setError(job.error_message || 'Job failed')
          clearInterval(poll)
        }
      } catch {
        /* ignore transient poll errors */
      }
    }, 3000)

    return () => clearInterval(poll)
  }, [jobId, onComplete, activeStepIndex, syncProgress])

  const totalCost = costs.serp + costs.firecrawl + costs.llm

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Análisis en Progreso
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Pipeline de 4 pasos: extracción, filtrado, scoring y consolidación.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <div>
            <span className="font-medium">Error: </span>
            {error}
          </div>
        </div>
      )}

      {/* Step pipeline — 4 real steps */}
      <div className="space-y-3">
        {ANALYSIS_STEPS.map((step, i) => {
          const status = deriveStepStatus(i, activeStepIndex, jobFailed)
          const isActive = status === 'running'
          const isDone = status === 'completed'
          const isFailed = status === 'failed'
          const Icon = step.icon

          return (
            <div
              key={step.id}
              className={`p-4 rounded-lg border transition-all ${
                isDone
                  ? 'bg-green-50 border-green-200'
                  : isActive
                    ? 'bg-blue-50 border-blue-300 shadow-sm'
                    : isFailed
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Status icon */}
                {isDone ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                ) : isFailed ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300" />
                )}

                <Icon
                  className={`w-4 h-4 ${
                    isDone
                      ? 'text-green-600'
                      : isActive
                        ? 'text-blue-600'
                        : isFailed
                          ? 'text-red-500'
                          : 'text-gray-400'
                  }`}
                />

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-medium ${
                        isDone
                          ? 'text-green-900'
                          : isActive
                            ? 'text-blue-900'
                            : isFailed
                              ? 'text-red-900'
                              : 'text-gray-500'
                      }`}
                    >
                      {step.name}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {step.model}
                    </span>
                  </div>
                  {(isActive || isDone) && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Extraction progress bar (step 0 only) */}
              {step.id === 'extract-problems' &&
                isActive &&
                extractProgress.total > 0 && (
                  <div className="mt-3 ml-12">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>
                        {extractProgress.completed} / {extractProgress.total}{' '}
                        URLs procesadas
                      </span>
                      <span>
                        {Math.round(
                          (extractProgress.completed / extractProgress.total) *
                            100
                        )}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (extractProgress.completed /
                                extractProgress.total) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                    {extractProgress.filtered > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        {extractProgress.filtered} URLs filtradas (contenido
                        irrelevante)
                      </p>
                    )}
                  </div>
                )}
            </div>
          )
        })}
      </div>

      {/* Cost summary */}
      {totalCost > 0 && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
          <DollarSign className="w-4 h-4 text-gray-400" />
          <span>
            Coste acumulado: <strong>${totalCost.toFixed(4)}</strong>
          </span>
          <span className="text-xs text-gray-400 ml-auto">
            SERP: ${costs.serp.toFixed(3)} · Scraping: $
            {costs.firecrawl.toFixed(3)} · LLM: ${costs.llm.toFixed(3)}
          </span>
        </div>
      )}
    </div>
  )
}
