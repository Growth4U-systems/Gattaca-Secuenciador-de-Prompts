'use client'

import { Check, Loader2, AlertCircle, Circle, Settings, Search, Globe, Filter, BarChart3, Trophy, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { NicheFinderPhase, PhaseId, StepProgress } from '@/lib/playbooks/niche-finder/types'
import { STEP_PHASES } from '@/lib/playbooks/niche-finder/steps'
import { ALL_STEPS } from '@/lib/playbooks/niche-finder/steps'

interface PhaseNavigationProps {
  phases: NicheFinderPhase[]
  currentPhaseId: PhaseId
  stepProgress: Record<string, StepProgress>
  onNavigate: (phaseId: PhaseId) => void
}

const PHASE_ICONS: Record<PhaseId, React.ComponentType<{ className?: string }>> = {
  'setup': Settings,
  'strategy-review': Search,
  'search': Globe,
  'url-review': Filter,
  'analysis': BarChart3,
  'results': Trophy,
}

function getStatusIcon(status: NicheFinderPhase['status'], size: 'sm' | 'md' = 'md') {
  const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'
  switch (status) {
    case 'completed':
      return <Check className={`${sizeClass} text-green-600`} />
    case 'in_progress':
      return <Loader2 className={`${sizeClass} text-blue-600 animate-spin`} />
    case 'error':
      return <AlertCircle className={`${sizeClass} text-red-500`} />
    default:
      return <Circle className={`${size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-gray-400`} />
  }
}

function getStepStatusIcon(stepProgress: StepProgress | undefined) {
  if (!stepProgress) return <Circle className="w-2.5 h-2.5 text-gray-400" />
  switch (stepProgress.status) {
    case 'completed':
      return <Check className="w-3 h-3 text-green-600" />
    case 'running':
      return <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
    case 'failed':
      return <AlertCircle className="w-3 h-3 text-red-500" />
    default:
      return <Circle className="w-2.5 h-2.5 text-gray-400" />
  }
}

export default function PhaseNavigation({
  phases,
  currentPhaseId,
  stepProgress,
  onNavigate,
}: PhaseNavigationProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<PhaseId>>(new Set([currentPhaseId]))

  const togglePhase = (phaseId: PhaseId) => {
    setExpandedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phaseId)) next.delete(phaseId)
      else next.add(phaseId)
      return next
    })
  }

  const getPhaseStepIds = (phaseId: PhaseId): string[] => {
    return STEP_PHASES[phaseId] || []
  }

  const getPhaseProgress = (phaseId: PhaseId) => {
    const stepIds = getPhaseStepIds(phaseId)
    const completed = stepIds.filter(id => stepProgress[id]?.status === 'completed').length
    return { completed, total: stepIds.length }
  }

  return (
    <div className="w-72 border-r border-gray-200 bg-gray-50/50 flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Fases del An\u00e1lisis
        </h3>
      </div>

      <div className="flex-1 py-2 space-y-0.5">
        {phases.map((phase, index) => {
          const isActive = currentPhaseId === phase.id
          const isExpanded = expandedPhases.has(phase.id)
          const Icon = PHASE_ICONS[phase.id]
          const stepIds = getPhaseStepIds(phase.id)
          const progress = getPhaseProgress(phase.id)
          const hasMultipleSteps = stepIds.length > 1

          return (
            <div key={phase.id}>
              {/* Phase header */}
              <button
                onClick={() => {
                  onNavigate(phase.id)
                  if (hasMultipleSteps) togglePhase(phase.id)
                }}
                className={`
                  w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all
                  ${isActive
                    ? 'bg-blue-50 border-l-4 border-blue-600 pl-2'
                    : 'hover:bg-gray-100 border-l-4 border-transparent pl-2'
                  }
                `}
              >
                {hasMultipleSteps && (
                  isExpanded
                    ? <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                )}
                <span className="text-xs font-mono text-gray-400 w-4 flex-shrink-0">
                  {index + 1}
                </span>
                <Icon className="w-4 h-4 text-gray-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium truncate ${isActive ? 'text-blue-900' : 'text-gray-700'}`}>
                      {phase.name}
                    </span>
                    <div className="flex items-center gap-1.5 ml-2">
                      {hasMultipleSteps && (
                        <span className="text-xs text-gray-400">
                          {progress.completed}/{progress.total}
                        </span>
                      )}
                      {getStatusIcon(phase.status)}
                    </div>
                  </div>
                  {phase.isCheckpoint && (
                    <span className="text-[10px] text-amber-600 font-medium">CHECKPOINT</span>
                  )}
                </div>
              </button>

              {/* Sub-steps (for search and analysis phases) */}
              {hasMultipleSteps && isExpanded && (
                <div className="ml-8 py-1 space-y-0.5">
                  {stepIds.map(stepId => {
                    const step = ALL_STEPS.find(s => s.id === stepId)
                    const sp = stepProgress[stepId]
                    return (
                      <div
                        key={stepId}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600"
                      >
                        {getStepStatusIcon(sp)}
                        <span className="truncate">{step?.name || stepId}</span>
                        {sp?.progress && (
                          <span className="text-gray-400 ml-auto">
                            {sp.progress.completed}/{sp.progress.total}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
