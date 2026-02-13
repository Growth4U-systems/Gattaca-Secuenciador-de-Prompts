'use client'

/**
 * CompetitorCard Component
 *
 * Main card for a single competitor showing:
 * - Pending actions alert (what needs to be done)
 * - Scraper progress by step
 * - Analysis steps with progressive unlock
 *
 * This is the new competitor-centric UX that guides users through the workflow.
 */

import { useState, useMemo } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Globe,
  AlertTriangle,
  CheckCircle,
  Circle,
  Lock,
  Play,
  Loader2,
  Settings,
  Search,
  ExternalLink,
  Sparkles,
  MessageSquare,
  Star,
  FileText,
} from 'lucide-react'
import {
  ALL_DOCUMENT_REQUIREMENTS,
  STEP_DOCUMENT_REQUIREMENTS,
} from '@/lib/playbooks/competitor-analysis/constants'
import type { DocumentRequirement } from '@/lib/playbooks/competitor-analysis/types'

// ============================================
// TYPES
// ============================================

interface CompetitorCampaign {
  id: string
  ecp_name: string
  custom_variables: Record<string, string>
  created_at: string
  status: string
  step_outputs?: Record<string, any>
}

interface Document {
  id: string
  name?: string
  source_metadata?: {
    source_type?: string
    competitor?: string
  }
}

interface CompetitorCardProps {
  campaign: CompetitorCampaign
  documents: Document[]
  projectId: string
  onConfigureInputs: () => void
  onDiscoverSocials: () => void
  onRunScrapers: (stepId: string) => void
  onRunAnalysis: (stepId: string) => void
  onViewResults: (stepId: string) => void
}

// Step configuration
const ANALYSIS_STEPS = [
  { id: 'autopercepcion', name: 'Autopercepción', icon: Sparkles, requiredSources: ['deep_research', 'website', 'instagram_posts', 'facebook_posts', 'youtube_videos', 'tiktok_posts', 'linkedin_posts', 'linkedin_insights'] },
  { id: 'percepcion-terceros', name: 'Percepción Terceros', icon: Search, requiredSources: ['seo_serp', 'news_corpus'] },
  { id: 'percepcion-rrss', name: 'Percepción RRSS', icon: MessageSquare, requiredSources: ['instagram_comments', 'facebook_comments', 'youtube_comments', 'tiktok_comments', 'linkedin_comments'] },
  { id: 'percepcion-reviews', name: 'Percepción Reviews', icon: Star, requiredSources: ['trustpilot_reviews', 'g2_reviews', 'capterra_reviews', 'playstore_reviews', 'appstore_reviews'] },
  { id: 'resumen', name: 'Síntesis Final', icon: FileText, requiredSources: [], dependsOn: ['autopercepcion', 'percepcion-terceros', 'percepcion-rrss', 'percepcion-reviews'] },
]

// Mapping from ANALYSIS_STEPS id to flow step IDs (used in step_outputs keys)
const STEP_ID_MAPPING: Record<string, string> = {
  'autopercepcion': 'comp-step-1-autopercepcion',
  'percepcion-terceros': 'comp-step-2-percepcion-terceros',
  'percepcion-rrss': 'comp-step-3-percepcion-rrss',
  'percepcion-reviews': 'comp-step-4-percepcion-reviews',
  'resumen': 'comp-step-5-sintesis',
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CompetitorCard({
  campaign,
  documents,
  projectId,
  onConfigureInputs,
  onDiscoverSocials,
  onRunScrapers,
  onRunAnalysis,
  onViewResults,
}: CompetitorCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [expandedSection, setExpandedSection] = useState<'scrapers' | 'analysis' | null>('scrapers')

  const competitorName = campaign.ecp_name || ''
  const normalizedCompetitorName = competitorName.toLowerCase()
  const website = campaign.custom_variables?.competitor_website || ''

  // Check which inputs are configured
  const inputStatus = useMemo(() => {
    const vars = campaign.custom_variables || {}
    const requiredInputs = [
      'competitor_website',
      'instagram_username',
      'facebook_url',
      'linkedin_url',
      'youtube_url',
      'tiktok_username',
      'trustpilot_url',
    ]
    const configured = requiredInputs.filter(key => !!vars[key]).length
    const total = requiredInputs.length
    const missing = requiredInputs.filter(key => !vars[key])
    return { configured, total, missing }
  }, [campaign.custom_variables])

  // Check scraper progress for each step
  const scraperProgress = useMemo(() => {
    const progress: Record<string, { completed: number; total: number; sources: string[] }> = {}

    STEP_DOCUMENT_REQUIREMENTS.forEach(step => {
      const completed = step.source_types.filter(sourceType =>
        documents.some(doc =>
          doc.source_metadata?.source_type === sourceType &&
          doc.source_metadata?.competitor?.toLowerCase() === normalizedCompetitorName
        )
      ).length
      progress[step.stepId] = {
        completed,
        total: step.source_types.length,
        sources: step.source_types,
      }
    })

    return progress
  }, [documents, normalizedCompetitorName])

  // Total scraper progress
  const totalProgress = useMemo(() => {
    let completed = 0
    let total = 0
    Object.values(scraperProgress).forEach(p => {
      completed += p.completed
      total += p.total
    })
    return { completed, total }
  }, [scraperProgress])

  // Check analysis step status
  const analysisStatus = useMemo(() => {
    const status: Record<string, { canRun: boolean; isCompleted: boolean; blockedBy: string[] }> = {}

    ANALYSIS_STEPS.forEach(step => {
      const scraperReady = step.requiredSources.length === 0 ||
        step.requiredSources.every(sourceType =>
          documents.some(doc =>
            doc.source_metadata?.source_type === sourceType &&
            doc.source_metadata?.competitor?.toLowerCase() === normalizedCompetitorName
          )
        )

      // Use flow step IDs to check step_outputs (edge function saves with flow IDs like "comp-step-1-autopercepcion")
      const flowStepId = STEP_ID_MAPPING[step.id] || step.id
      const dependenciesReady = !step.dependsOn || step.dependsOn.every(depId => {
        const depFlowId = STEP_ID_MAPPING[depId] || depId
        return campaign.step_outputs?.[depFlowId]
      })

      const isCompleted = !!campaign.step_outputs?.[flowStepId]

      const blockedBy: string[] = []
      if (!scraperReady) {
        const missing = step.requiredSources.filter(sourceType =>
          !documents.some(doc =>
            doc.source_metadata?.source_type === sourceType &&
            doc.source_metadata?.competitor?.toLowerCase() === normalizedCompetitorName
          )
        )
        blockedBy.push(`${missing.length} scraper(s) pendientes`)
      }
      if (!dependenciesReady && step.dependsOn) {
        const missingDeps = step.dependsOn.filter(depId => {
          const depFlowId = STEP_ID_MAPPING[depId] || depId
          return !campaign.step_outputs?.[depFlowId]
        })
        blockedBy.push(`Requiere: ${missingDeps.join(', ')}`)
      }

      status[step.id] = {
        canRun: scraperReady && dependenciesReady && !isCompleted,
        isCompleted,
        blockedBy,
      }
    })

    return status
  }, [documents, normalizedCompetitorName, campaign.step_outputs])

  // Determine pending action
  const pendingAction = useMemo(() => {
    if (inputStatus.missing.length > 0) {
      return {
        type: 'configure',
        message: `Configura ${inputStatus.missing.length} campo(s) de redes sociales`,
        action: onConfigureInputs,
        actionLabel: 'Configurar',
        secondaryAction: onDiscoverSocials,
        secondaryLabel: 'Descubrir desde web',
      }
    }

    if (totalProgress.completed < totalProgress.total) {
      const pending = totalProgress.total - totalProgress.completed
      return {
        type: 'scrapers',
        message: `Ejecuta ${pending} scraper(s) pendientes`,
        action: () => onRunScrapers('all'),
        actionLabel: 'Ejecutar todos',
      }
    }

    const nextStep = ANALYSIS_STEPS.find(step => analysisStatus[step.id]?.canRun)
    if (nextStep) {
      return {
        type: 'analysis',
        message: `Listo para ejecutar: ${nextStep.name}`,
        action: () => onRunAnalysis(nextStep.id),
        actionLabel: 'Ejecutar análisis',
      }
    }

    return null
  }, [inputStatus, totalProgress, analysisStatus, onConfigureInputs, onDiscoverSocials, onRunScrapers, onRunAnalysis])

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header - Always visible */}
      <div
        className="p-5 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {competitorName}
              </h3>
              {totalProgress.completed === totalProgress.total ? (
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                  Completo
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                  En progreso
                </span>
              )}
            </div>
            {website && (
              <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                <Globe size={14} />
                <span className="truncate">{website.replace(/^https?:\/\//, '')}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Progress indicator */}
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {totalProgress.completed}/{totalProgress.total}
              </div>
              <div className="text-xs text-gray-500">scrapers</div>
            </div>

            {/* Expand/collapse */}
            <button
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
            >
              {isExpanded ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Pending action alert */}
        {pendingAction && (
          <div className="mt-4 flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
              <span className="text-sm text-amber-800">{pendingAction.message}</span>
            </div>
            <div className="flex items-center gap-2">
              {pendingAction.secondaryAction && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    pendingAction.secondaryAction?.()
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
                >
                  {pendingAction.secondaryLabel}
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  pendingAction.action()
                }}
                className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                {pendingAction.actionLabel}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Scrapers Section */}
          <div className="border-b border-gray-100">
            <button
              onClick={() => setExpandedSection(expandedSection === 'scrapers' ? null : 'scrapers')}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Search size={16} className="text-gray-400" />
                <span className="font-medium text-gray-700">Scrapers</span>
                <span className="text-sm text-gray-500">
                  ({totalProgress.completed}/{totalProgress.total})
                </span>
              </div>
              {expandedSection === 'scrapers' ? (
                <ChevronUp size={18} className="text-gray-400" />
              ) : (
                <ChevronDown size={18} className="text-gray-400" />
              )}
            </button>

            {expandedSection === 'scrapers' && (
              <div className="px-5 pb-4 space-y-2">
                {STEP_DOCUMENT_REQUIREMENTS.filter(s => s.source_types.length > 0).map(step => {
                  const progress = scraperProgress[step.stepId]
                  const isComplete = progress?.completed === progress?.total
                  const stepInfo = ANALYSIS_STEPS.find(s => s.id === step.stepId)
                  const Icon = stepInfo?.icon || Circle

                  return (
                    <div
                      key={step.stepId}
                      className={`flex items-center justify-between p-3 rounded-xl ${
                        isComplete ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className={isComplete ? 'text-green-600' : 'text-gray-400'} />
                        <span className={`text-sm font-medium ${isComplete ? 'text-green-700' : 'text-gray-700'}`}>
                          {stepInfo?.name || step.stepId}
                        </span>
                        <span className={`text-xs ${isComplete ? 'text-green-600' : 'text-gray-500'}`}>
                          {progress?.completed}/{progress?.total}
                        </span>
                      </div>

                      {!isComplete && progress && progress.completed < progress.total && (
                        <button
                          onClick={() => onRunScrapers(step.stepId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          <Play size={12} />
                          Ejecutar ({progress.total - progress.completed})
                        </button>
                      )}

                      {isComplete && (
                        <CheckCircle size={18} className="text-green-600" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Analysis Section */}
          <div>
            <button
              onClick={() => setExpandedSection(expandedSection === 'analysis' ? null : 'analysis')}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-gray-400" />
                <span className="font-medium text-gray-700">Análisis</span>
              </div>
              {expandedSection === 'analysis' ? (
                <ChevronUp size={18} className="text-gray-400" />
              ) : (
                <ChevronDown size={18} className="text-gray-400" />
              )}
            </button>

            {expandedSection === 'analysis' && (
              <div className="px-5 pb-4 space-y-2">
                {ANALYSIS_STEPS.map((step, index) => {
                  const status = analysisStatus[step.id]
                  const Icon = step.icon

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center justify-between p-3 rounded-xl ${
                        status?.isCompleted
                          ? 'bg-green-50'
                          : status?.canRun
                            ? 'bg-indigo-50'
                            : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                          status?.isCompleted
                            ? 'bg-green-600 text-white'
                            : status?.canRun
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-300 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                        <Icon size={18} className={
                          status?.isCompleted
                            ? 'text-green-600'
                            : status?.canRun
                              ? 'text-indigo-600'
                              : 'text-gray-400'
                        } />
                        <div>
                          <span className={`text-sm font-medium ${
                            status?.isCompleted
                              ? 'text-green-700'
                              : status?.canRun
                                ? 'text-indigo-700'
                                : 'text-gray-700'
                          }`}>
                            {step.name}
                          </span>
                          {status?.blockedBy.length > 0 && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {status.blockedBy.join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {status?.isCompleted ? (
                        <button
                          onClick={() => onViewResults(step.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 rounded-lg transition-colors"
                        >
                          Ver resultado
                          <ExternalLink size={12} />
                        </button>
                      ) : status?.canRun ? (
                        <button
                          onClick={() => onRunAnalysis(step.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          <Play size={12} />
                          Ejecutar
                        </button>
                      ) : (
                        <Lock size={16} className="text-gray-400" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
