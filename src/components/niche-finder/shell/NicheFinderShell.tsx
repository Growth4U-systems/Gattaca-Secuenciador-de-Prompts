'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { AlertCircle, CheckCircle, FileText, Loader2, RefreshCw, Rocket } from 'lucide-react'
import PhaseNavigation from './PhaseNavigation'
import SetupPhaseView from '../views/SetupPhaseView'
import StrategyReviewView from '../views/StrategyReviewView'
import SearchPhaseView from '../views/SearchPhaseView'
import {
  DEFAULT_PHASES,
  PHASE_ORDER,
  type PhaseId,
  type NicheFinderPhase,
  type GeneratedStrategy,
  type StepProgress,
  type StrategySources,
} from '@/lib/playbooks/niche-finder/types'

interface NicheFinderShellProps {
  projectId: string
}

export default function NicheFinderShell({ projectId }: NicheFinderShellProps) {
  const [currentPhaseId, setCurrentPhaseId] = useState<PhaseId>('setup')
  const [phases, setPhases] = useState<NicheFinderPhase[]>(
    DEFAULT_PHASES.map(p => ({ ...p }))
  )
  const [jobId, setJobId] = useState<string | null>(null)
  const [strategy, setStrategy] = useState<GeneratedStrategy | null>(null)
  const [stepProgress, setStepProgress] = useState<Record<string, StepProgress>>({})
  const [regenerating, setRegenerating] = useState(false)
  const [visitedPhases, setVisitedPhases] = useState<Set<PhaseId>>(new Set(['setup']))
  const [savingDocs, setSavingDocs] = useState(false)
  const [docsSaved, setDocsSaved] = useState<{ saved: number; skipped: number; errors?: number; error?: string } | null>(null)
  const [restoring, setRestoring] = useState(true)
  const restoredRef = useRef(false)

  // Restore state from existing job on mount
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    async function restore() {
      try {
        // Find most recent job for this project
        const resp = await fetch(`/api/niche-finder/jobs/latest?project_id=${projectId}`)
        if (!resp.ok) {
          setRestoring(false)
          return
        }
        const data = await resp.json()
        if (!data.job) {
          setRestoring(false)
          return
        }

        const job = data.job
        const status = job.status as string

        // Job exists - restore state based on status
        setJobId(job.id)

        // Determine which phase we should be on
        const isSearching = ['pending', 'serp_running', 'serp_done', 'scraping'].includes(status)
        const isSearchDone = ['scrape_done', 'extracting', 'extract_done', 'completed'].includes(status)

        if (isSearching || isSearchDone) {
          // Mark setup and strategy-review as completed
          setPhases(prev => prev.map(p => {
            if (p.id === 'setup') return { ...p, status: 'completed' as const }
            if (p.id === 'strategy-review') return { ...p, status: 'completed' as const }
            if (p.id === 'search') return { ...p, status: isSearchDone ? 'completed' as const : 'in_progress' as const }
            return p
          }))
          setCurrentPhaseId('search')
          setVisitedPhases(new Set<PhaseId>(['setup', 'strategy-review', 'search']))

          // If search is done, check if docs were already saved
          if (isSearchDone && data.saved_docs_count !== undefined) {
            if (data.saved_docs_count > 0) {
              setDocsSaved({ saved: data.saved_docs_count, skipped: 0 })
            }
            // If 0 saved docs but URLs were scraped, user can retry saving
          }
        }
      } catch (err) {
        console.error('Error restoring niche finder state:', err)
      } finally {
        setRestoring(false)
      }
    }

    restore()
  }, [projectId])

  const updatePhaseStatus = useCallback((phaseId: PhaseId, status: NicheFinderPhase['status']) => {
    setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, status } : p))
  }, [])

  const advanceToPhase = useCallback((phaseId: PhaseId) => {
    // Mark current as completed, advance to next
    const nextIndex = PHASE_ORDER.indexOf(phaseId)

    setPhases(prev => prev.map(p => {
      const pIndex = PHASE_ORDER.indexOf(p.id)
      if (pIndex < nextIndex) return { ...p, status: 'completed' }
      if (pIndex === nextIndex) return { ...p, status: 'in_progress' }
      return p
    }))

    setCurrentPhaseId(phaseId)
    setVisitedPhases(prev => new Set(prev).add(phaseId))
  }, [currentPhaseId])

  // -- Phase handlers --

  const handleStrategyGenerated = useCallback((generatedStrategy: GeneratedStrategy) => {
    setStrategy(generatedStrategy)
    updatePhaseStatus('setup', 'completed')
    advanceToPhase('strategy-review')
  }, [updatePhaseStatus, advanceToPhase])

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)
    setCurrentPhaseId('setup')
    updatePhaseStatus('setup', 'in_progress')
    updatePhaseStatus('strategy-review', 'pending')
    setStrategy(null)
    setRegenerating(false)
  }, [updatePhaseStatus])

  const handleStrategyApproved = useCallback(async (
    lifeContexts: string[],
    benefitWords: string[],
    sources: StrategySources,
    serpPages: number
  ) => {
    updatePhaseStatus('strategy-review', 'completed')

    try {
      // Create job with approved config
      const resp = await fetch('/api/niche-finder/jobs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          config: {
            life_contexts: lifeContexts,
            product_words: benefitWords,
            indicators: [],
            sources: {
              reddit: sources.reddit?.enabled ?? true,
              thematic_forums: (sources.thematic_forums?.length || 0) > 0,
              general_forums: sources.general_forums || ['forocoches.com', 'burbuja.info'],
            },
            serp_pages: serpPages,
            batch_size: 10,
          },
        }),
      })

      const data = await resp.json()
      if (!data.success) throw new Error(data.error || 'Error creating job')

      const newJobId = data.job_id || data.jobId
      setJobId(newJobId)
      advanceToPhase('search')
    } catch (err) {
      console.error('Error creating job:', err)
      updatePhaseStatus('strategy-review', 'error')
    }
  }, [projectId, updatePhaseStatus, advanceToPhase])

  const saveDocs = useCallback(async () => {
    if (!jobId) return

    setSavingDocs(true)
    setDocsSaved(null)
    try {
      const resp = await fetch(`/api/niche-finder/jobs/${jobId}/save-docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await resp.json()
      if (data.success) {
        setDocsSaved({ saved: data.saved, skipped: data.skipped, errors: data.errors || 0 })
      } else {
        console.error('Error saving docs:', data.error)
        setDocsSaved({ saved: 0, skipped: 0, errors: 0, error: data.error })
      }
    } catch (err) {
      console.error('Error saving docs:', err)
      setDocsSaved({ saved: 0, skipped: 0, errors: 0, error: err instanceof Error ? err.message : 'Error de conexión' })
    } finally {
      setSavingDocs(false)
    }
  }, [jobId, projectId])

  const handleSearchComplete = useCallback(async () => {
    if (!jobId) return

    updatePhaseStatus('search', 'completed')
    setCurrentPhaseId('search')

    // Auto-save scraped docs to Context Lake
    await saveDocs()
  }, [jobId, updatePhaseStatus, saveDocs])

  const handleStepProgressUpdate = useCallback((progress: Record<string, StepProgress>) => {
    setStepProgress(prev => ({ ...prev, ...progress }))
  }, [])

  const handleNavigate = useCallback((phaseId: PhaseId) => {
    // Allow navigating to any non-pending phase (completed, in_progress, error, or current)
    const targetPhase = phases.find(p => p.id === phaseId)
    if (targetPhase && targetPhase.status !== 'pending') {
      setCurrentPhaseId(phaseId)
    }
  }, [phases])

  // -- Keep-mounted phase rendering (navigate without re-launching) --

  const isVisited = (id: PhaseId) => visitedPhases.has(id)

  // Determine if search is done (docs saved or saving)
  const searchDone = docsSaved !== null || savingDocs

  if (restoring) {
    return (
      <div className="flex h-full bg-white items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando estado...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-white">
      <PhaseNavigation
        phases={phases}
        currentPhaseId={currentPhaseId}
        stepProgress={stepProgress}
        onNavigate={handleNavigate}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {/* All visited phases stay mounted, only the active one is visible */}
          <div className={currentPhaseId === 'setup' ? '' : 'hidden'}>
            {isVisited('setup') && (
              <SetupPhaseView
                projectId={projectId}
                onStrategyGenerated={handleStrategyGenerated}
              />
            )}
          </div>

          <div className={currentPhaseId === 'strategy-review' ? '' : 'hidden'}>
            {isVisited('strategy-review') && strategy && (
              <StrategyReviewView
                strategy={strategy}
                projectId={projectId}
                onApprove={handleStrategyApproved}
                onRegenerate={handleRegenerate}
                regenerating={regenerating}
              />
            )}
          </div>

          <div className={currentPhaseId === 'search' ? '' : 'hidden'}>
            {isVisited('search') && jobId && (
              <>
                <SearchPhaseView
                  jobId={jobId}
                  onComplete={handleSearchComplete}
                  onStepProgressUpdate={handleStepProgressUpdate}
                />

                {/* Post-search: saving docs + redirect to campaigns */}
                {searchDone && (
                  <div className="max-w-2xl mx-auto px-6 pb-6 space-y-4">
                    {savingDocs && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        <div>
                          <p className="font-medium text-blue-900 text-sm">Guardando documentos...</p>
                          <p className="text-xs text-blue-600">Los contenidos scrapeados se estan guardando en la Base de Conocimiento.</p>
                        </div>
                      </div>
                    )}

                    {docsSaved && (docsSaved.error || (docsSaved.errors ?? 0) > 0) && docsSaved.saved === 0 && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          <div>
                            <p className="font-medium text-red-900 text-sm">
                              Error al guardar documentos
                            </p>
                            <p className="text-xs text-red-600 mt-0.5">
                              {docsSaved.error
                                ? docsSaved.error
                                : `${docsSaved.errors} documentos fallaron al guardarse. Reintenta para volver a intentarlo.`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => saveDocs()}
                          disabled={savingDocs}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-red-300 rounded-lg text-red-700 bg-white hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Reintentar guardado
                        </button>
                      </div>
                    )}

                    {docsSaved && docsSaved.saved > 0 && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <div>
                            <p className="font-medium text-green-900 text-sm">
                              {docsSaved.saved} documentos guardados
                              {docsSaved.skipped > 0 && ` (${docsSaved.skipped} duplicados omitidos)`}
                            </p>
                            <p className="text-xs text-green-600 mt-0.5">
                              Los contenidos scrapeados estan disponibles en la pestana Documentos.
                            </p>
                          </div>
                        </div>

                        <div className="bg-white border border-green-100 rounded-lg p-4 space-y-2">
                          <h4 className="font-medium text-gray-900 text-sm flex items-center gap-2">
                            <Rocket className="w-4 h-4 text-indigo-600" />
                            Siguiente paso: Analizar con Campanas
                          </h4>
                          <p className="text-xs text-gray-600">
                            Ve a la pestana <strong>Campanas</strong> para crear una campana de analisis.
                            Ahi podras ejecutar cada paso (extraer problemas, filtrar, scoring, consolidar)
                            usando los documentos scrapeados como contexto.
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Asigna los documentos a cada paso antes de ejecutar.</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
