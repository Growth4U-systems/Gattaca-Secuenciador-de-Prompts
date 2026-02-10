'use client'

import { useState, useCallback } from 'react'
import PhaseNavigation from './PhaseNavigation'
import SetupPhaseView from '../views/SetupPhaseView'
import StrategyReviewView from '../views/StrategyReviewView'
import SearchPhaseView from '../views/SearchPhaseView'
import UrlReviewView from '../views/UrlReviewView'
import AnalysisPhaseView from '../views/AnalysisPhaseView'
import ResultsPhaseView from '../views/ResultsPhaseView'
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

  const updatePhaseStatus = useCallback((phaseId: PhaseId, status: NicheFinderPhase['status']) => {
    setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, status } : p))
  }, [])

  const advanceToPhase = useCallback((phaseId: PhaseId) => {
    // Mark current as completed, advance to next
    const currentIndex = PHASE_ORDER.indexOf(currentPhaseId)
    const nextIndex = PHASE_ORDER.indexOf(phaseId)

    setPhases(prev => prev.map((p, i) => {
      const pIndex = PHASE_ORDER.indexOf(p.id)
      if (pIndex < nextIndex) return { ...p, status: 'completed' }
      if (pIndex === nextIndex) return { ...p, status: 'in_progress' }
      return p
    }))

    setCurrentPhaseId(phaseId)
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
    sources: StrategySources
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
              general_forums: sources.general_forums || ['forocoches.com', 'mediavida.com'],
            },
            serp_pages: 5,
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

  const handleSearchComplete = useCallback(() => {
    updatePhaseStatus('search', 'completed')
    advanceToPhase('url-review')
  }, [updatePhaseStatus, advanceToPhase])

  const handleUrlsApproved = useCallback(() => {
    updatePhaseStatus('url-review', 'completed')
    advanceToPhase('analysis')
  }, [updatePhaseStatus, advanceToPhase])

  const handleAnalysisComplete = useCallback(() => {
    updatePhaseStatus('analysis', 'completed')
    advanceToPhase('results')
  }, [updatePhaseStatus, advanceToPhase])

  const handleStepProgressUpdate = useCallback((progress: Record<string, StepProgress>) => {
    setStepProgress(prev => ({ ...prev, ...progress }))
  }, [])

  const handleNavigate = useCallback((phaseId: PhaseId) => {
    // Only allow navigating to completed phases or current phase
    const targetPhase = phases.find(p => p.id === phaseId)
    if (targetPhase && (targetPhase.status === 'completed' || phaseId === currentPhaseId)) {
      setCurrentPhaseId(phaseId)
    }
  }, [phases, currentPhaseId])

  // -- Phase content rendering --

  function renderPhaseContent() {
    switch (currentPhaseId) {
      case 'setup':
        return (
          <SetupPhaseView
            projectId={projectId}
            onStrategyGenerated={handleStrategyGenerated}
          />
        )

      case 'strategy-review':
        if (!strategy) return <div className="p-6 text-gray-500">No strategy generated yet.</div>
        return (
          <StrategyReviewView
            strategy={strategy}
            projectId={projectId}
            onApprove={handleStrategyApproved}
            onRegenerate={handleRegenerate}
            regenerating={regenerating}
          />
        )

      case 'search':
        if (!jobId) return <div className="p-6 text-gray-500">No job started yet.</div>
        return (
          <SearchPhaseView
            jobId={jobId}
            onComplete={handleSearchComplete}
            onStepProgressUpdate={handleStepProgressUpdate}
          />
        )

      case 'url-review':
        if (!jobId) return <div className="p-6 text-gray-500">No job started yet.</div>
        return (
          <UrlReviewView
            jobId={jobId}
            onApprove={handleUrlsApproved}
          />
        )

      case 'analysis':
        if (!jobId) return <div className="p-6 text-gray-500">No job started yet.</div>
        return (
          <AnalysisPhaseView
            jobId={jobId}
            onComplete={handleAnalysisComplete}
            onStepProgressUpdate={handleStepProgressUpdate}
          />
        )

      case 'results':
        if (!jobId) return <div className="p-6 text-gray-500">No job started yet.</div>
        return (
          <ResultsPhaseView
            jobId={jobId}
          />
        )

      default:
        return <div className="p-6 text-gray-500">Phase not found.</div>
    }
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
          {renderPhaseContent()}
        </div>
      </div>
    </div>
  )
}
