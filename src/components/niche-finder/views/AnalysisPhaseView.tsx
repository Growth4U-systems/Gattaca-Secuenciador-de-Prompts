'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Check, AlertCircle, Circle, Brain, Sparkles, BarChart3, Table } from 'lucide-react'
import type { StepProgress } from '@/lib/playbooks/niche-finder/types'

interface AnalysisPhaseViewProps {
  jobId: string
  onComplete: () => void
  onStepProgressUpdate: (progress: Record<string, StepProgress>) => void
}

const ANALYSIS_STEPS = [
  { id: 'extract-problems', name: 'Extraer Problemas', icon: Brain, description: 'Extrayendo pain points de cada URL' },
  { id: 'clean-filter', name: 'Limpiar y Filtrar', icon: Sparkles, description: 'Deduplicando y filtrando nichos' },
  { id: 'scoring', name: 'Scoring', icon: BarChart3, description: 'Puntuando Pain, Market Size, Reachability' },
  { id: 'consolidate', name: 'Tabla Final', icon: Table, description: 'Consolidando resultados' },
]

export default function AnalysisPhaseView({ jobId, onComplete, onStepProgressUpdate }: AnalysisPhaseViewProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [extractedProblems, setExtractedProblems] = useState<string[]>([])
  const [extractProgress, setExtractProgress] = useState<{ completed: number; total: number } | null>(null)
  const startedRef = useRef(false)

  // Run analysis pipeline sequentially
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const runPipeline = async () => {
      try {
        // Step 1: Extract
        setCurrentStep(0)
        updateProgress(0, 'running')

        let hasMore = true
        while (hasMore) {
          const resp = await fetch(`/api/niche-finder/jobs/${jobId}/extract`, { method: 'POST' })
          const data = await resp.json()
          if (!data.success) throw new Error(data.error || 'Extraction failed')

          setExtractProgress(prev => ({
            completed: (prev?.completed || 0) + (data.extracted || 0) + (data.filtered || 0),
            total: (prev?.completed || 0) + (data.extracted || 0) + (data.filtered || 0) + (data.remaining || 0),
          }))

          hasMore = data.has_more
        }

        updateProgress(0, 'completed')

        // Step 2: Analyze (clean + score + consolidate in one endpoint)
        setCurrentStep(1)
        updateProgress(1, 'running')

        const analyzeResp = await fetch(`/api/niche-finder/jobs/${jobId}/analyze`, { method: 'POST' })
        const analyzeData = await analyzeResp.json()

        if (!analyzeData.success) throw new Error(analyzeData.error || 'Analysis failed')

        // Mark all remaining steps as completed
        updateProgress(1, 'completed')
        setCurrentStep(2)
        updateProgress(2, 'completed')
        setCurrentStep(3)
        updateProgress(3, 'completed')

        onComplete()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error en an\u00e1lisis')
        updateProgress(currentStep, 'failed')
      }
    }

    runPipeline()
  }, [jobId]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateProgress = (stepIndex: number, status: StepProgress['status']) => {
    const stepId = ANALYSIS_STEPS[stepIndex]?.id
    if (!stepId) return

    onStepProgressUpdate(
      Object.fromEntries(
        ANALYSIS_STEPS.map((s, i) => [
          s.id,
          {
            stepId: s.id,
            status: i < stepIndex ? 'completed' as const
              : i === stepIndex ? status
              : 'pending' as const,
          },
        ])
      )
    )
  }

  // Poll job for live extraction progress
  useEffect(() => {
    if (currentStep !== 0) return

    const poll = setInterval(async () => {
      try {
        const resp = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
        const data = await resp.json()
        if (data.success && data.job) {
          if (data.job.last_extracted_problems) {
            setExtractedProblems(data.job.last_extracted_problems)
          }
          if (data.job.extract_total) {
            setExtractProgress({
              completed: data.job.extract_completed || 0,
              total: data.job.extract_total,
            })
          }
        }
      } catch { /* ignore */ }
    }, 3000)

    return () => clearInterval(poll)
  }, [jobId, currentStep])

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">An\u00e1lisis en Progreso</h2>
        <p className="text-sm text-gray-500 mt-1">
          Procesando contenido con IA para extraer y puntuar nichos.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Step list */}
      <div className="space-y-2">
        {ANALYSIS_STEPS.map((step, i) => {
          const isActive = i === currentStep
          const isDone = i < currentStep || (i === currentStep && i === 3 && !error)
          const Icon = step.icon

          return (
            <div
              key={step.id}
              className={`p-4 rounded-lg border transition-all ${
                isDone ? 'bg-green-50 border-green-200'
                : isActive ? 'bg-blue-50 border-blue-200'
                : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {isDone ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300" />
                )}
                <Icon className={`w-4 h-4 ${isDone ? 'text-green-600' : isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                <div className="flex-1">
                  <span className={`text-sm font-medium ${isDone ? 'text-green-900' : isActive ? 'text-blue-900' : 'text-gray-500'}`}>
                    {step.name}
                  </span>
                  {isActive && (
                    <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                  )}
                </div>
              </div>

              {/* Extract progress bar */}
              {step.id === 'extract-problems' && isActive && extractProgress && extractProgress.total > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{extractProgress.completed} / {extractProgress.total} URLs</span>
                    <span>{Math.round((extractProgress.completed / extractProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.round((extractProgress.completed / extractProgress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Live extracted problems */}
      {extractedProblems.length > 0 && currentStep === 0 && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">\u00daltimos problemas extra\u00eddos</h4>
          <ul className="space-y-1">
            {extractedProblems.map((problem, i) => (
              <li key={i} className="text-sm text-gray-700 truncate">{problem}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
