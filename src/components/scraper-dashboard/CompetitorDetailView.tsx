'use client'

/**
 * CompetitorDetailView Component
 *
 * Detailed view for a single competitor showing:
 * - Scraper configuration and execution
 * - Analysis flow steps with execution
 *
 * Both sections are integrated in one view.
 */

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Globe,
  Settings,
  Play,
  Loader2,
  CheckCircle,
  Circle,
  Lock,
  AlertTriangle,
  Search,
  Sparkles,
  MessageSquare,
  Star,
  FileText,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { useToast } from '@/components/ui'
import {
  STEP_DOCUMENT_REQUIREMENTS,
  ALL_DOCUMENT_REQUIREMENTS,
  SCRAPER_INPUT_MAPPINGS,
} from '@/lib/playbooks/competitor-analysis/constants'
import ScraperConfigModal from './ScraperConfigModal'

// ============================================
// TYPES
// ============================================

interface CompetitorCampaign {
  id: string
  ecp_name: string
  custom_variables: Record<string, string>
  created_at: string
  status: string
  step_outputs?: Record<string, unknown>
}

interface Document {
  id: string
  name?: string
  source_metadata?: {
    source_type?: string
    competitor?: string
  }
}

interface CompetitorDetailViewProps {
  campaign: CompetitorCampaign
  documents: Document[]
  projectId: string
  onBack: () => void
  onRefresh: () => void
}

// Analysis steps configuration
const ANALYSIS_STEPS = [
  {
    id: 'autopercepcion',
    name: 'Autopercepción',
    description: 'Cómo se presenta la marca a sí misma',
    icon: Sparkles,
    requiredSources: ['deep_research', 'website', 'instagram_posts', 'facebook_posts', 'youtube_videos', 'tiktok_posts', 'linkedin_posts', 'linkedin_insights'],
  },
  {
    id: 'percepcion-terceros',
    name: 'Percepción Terceros',
    description: 'Qué dicen los medios y buscadores',
    icon: Search,
    requiredSources: ['seo_serp', 'news_corpus'],
  },
  {
    id: 'percepcion-rrss',
    name: 'Percepción RRSS',
    description: 'Comentarios y engagement en redes sociales',
    icon: MessageSquare,
    requiredSources: ['instagram_comments', 'facebook_comments', 'youtube_comments', 'tiktok_comments', 'linkedin_comments'],
  },
  {
    id: 'percepcion-reviews',
    name: 'Percepción Reviews',
    description: 'Opiniones en plataformas de reviews',
    icon: Star,
    requiredSources: ['trustpilot_reviews', 'g2_reviews', 'capterra_reviews', 'playstore_reviews', 'appstore_reviews'],
  },
  {
    id: 'resumen',
    name: 'Síntesis Final',
    description: 'Battle card y resumen ejecutivo',
    icon: FileText,
    requiredSources: [],
    dependsOn: ['autopercepcion', 'percepcion-terceros', 'percepcion-rrss', 'percepcion-reviews'],
  },
]

// ============================================
// MAIN COMPONENT
// ============================================

export default function CompetitorDetailView({
  campaign,
  documents,
  projectId,
  onBack,
  onRefresh,
}: CompetitorDetailViewProps) {
  const toast = useToast()
  const router = useRouter()

  const [showConfigModal, setShowConfigModal] = useState(false)
  const [runningScrapers, setRunningScrapers] = useState<Set<string>>(new Set())
  const [runningSteps, setRunningSteps] = useState<Set<string>>(new Set())

  const competitorName = campaign.ecp_name || ''
  const normalizedName = competitorName.toLowerCase()
  const website = campaign.custom_variables?.competitor_website || ''

  // Calculate which inputs are configured
  const inputStatus = useMemo(() => {
    const vars = campaign.custom_variables || {}
    const allInputs = [
      'competitor_website',
      'instagram_username',
      'facebook_url',
      'linkedin_url',
      'youtube_url',
      'tiktok_username',
      'trustpilot_url',
      'g2_url',
      'capterra_url',
      'play_store_app_id',
      'app_store_app_id',
    ]
    const configured = allInputs.filter(key => !!vars[key]?.trim()).length
    return { configured, total: allInputs.length }
  }, [campaign.custom_variables])

  // Calculate scraper progress by step
  const scrapersByStep = useMemo(() => {
    const result: Record<string, {
      stepName: string
      scrapers: Array<{
        sourceType: string
        name: string
        isCompleted: boolean
        inputKey?: string
        inputValue?: string
      }>
      completed: number
      total: number
    }> = {}

    STEP_DOCUMENT_REQUIREMENTS.forEach(step => {
      const stepInfo = ANALYSIS_STEPS.find(s => s.id === step.stepId)
      const scrapers = step.source_types.map(sourceType => {
        const req = ALL_DOCUMENT_REQUIREMENTS.find(r => r.source_type === sourceType)
        const inputMapping = req ? SCRAPER_INPUT_MAPPINGS[req.id] : undefined
        const isCompleted = documents.some(doc =>
          doc.source_metadata?.source_type === sourceType &&
          doc.source_metadata?.competitor?.toLowerCase() === normalizedName
        )
        return {
          sourceType,
          name: req?.name || sourceType,
          isCompleted,
          inputKey: inputMapping?.inputKey,
          inputValue: inputMapping?.inputKey ? campaign.custom_variables?.[inputMapping.inputKey] : undefined,
        }
      })

      result[step.stepId] = {
        stepName: stepInfo?.name || step.stepId,
        scrapers,
        completed: scrapers.filter(s => s.isCompleted).length,
        total: scrapers.length,
      }
    })

    return result
  }, [documents, normalizedName, campaign.custom_variables])

  // Total scraper progress
  const totalScraperProgress = useMemo(() => {
    let completed = 0
    let total = 0
    Object.values(scrapersByStep).forEach(step => {
      completed += step.completed
      total += step.total
    })
    return { completed, total }
  }, [scrapersByStep])

  // Analysis step status
  const analysisStepStatus = useMemo(() => {
    const status: Record<string, {
      canRun: boolean
      isCompleted: boolean
      isRunning: boolean
      blockedReason?: string
      missingScrapers: number
    }> = {}

    ANALYSIS_STEPS.forEach(step => {
      const stepScrapers = scrapersByStep[step.id]
      const scrapersReady = !stepScrapers || stepScrapers.completed === stepScrapers.total
      const missingScrapers = stepScrapers ? stepScrapers.total - stepScrapers.completed : 0

      const dependenciesReady = !step.dependsOn || step.dependsOn.every(depId =>
        campaign.step_outputs?.[depId]
      )

      const isCompleted = !!campaign.step_outputs?.[step.id]
      const isRunning = runningSteps.has(step.id)

      let blockedReason: string | undefined
      if (!scrapersReady) {
        blockedReason = `Faltan ${missingScrapers} scraper(s)`
      } else if (!dependenciesReady && step.dependsOn) {
        const missingDeps = step.dependsOn.filter(depId => !campaign.step_outputs?.[depId])
        blockedReason = `Requiere: ${missingDeps.map(d => ANALYSIS_STEPS.find(s => s.id === d)?.name || d).join(', ')}`
      }

      status[step.id] = {
        canRun: scrapersReady && dependenciesReady && !isCompleted && !isRunning,
        isCompleted,
        isRunning,
        blockedReason,
        missingScrapers,
      }
    })

    return status
  }, [scrapersByStep, campaign.step_outputs, runningSteps])

  // Handle run scraper
  const handleRunScraper = useCallback(async (sourceType: string) => {
    if (runningScrapers.has(sourceType)) return

    const req = ALL_DOCUMENT_REQUIREMENTS.find(r => r.source_type === sourceType)
    if (!req) return

    const inputMapping = SCRAPER_INPUT_MAPPINGS[req.id]

    // Check if input is configured
    if (inputMapping?.inputKey && !campaign.custom_variables?.[inputMapping.inputKey]) {
      toast.error('Input faltante', `Configura ${inputMapping.label || inputMapping.inputKey} antes de ejecutar`)
      setShowConfigModal(true)
      return
    }

    setRunningScrapers(prev => new Set(prev).add(sourceType))
    toast.info('Ejecutando...', `Iniciando ${req.name}`)

    try {
      // TODO: Call actual scraper API
      // For now, simulate with a delay
      await new Promise(resolve => setTimeout(resolve, 2000))

      toast.success('Completado', `${req.name} ejecutado`)
      onRefresh()
    } catch (error) {
      console.error('Error running scraper:', error)
      toast.error('Error', 'No se pudo ejecutar el scraper')
    } finally {
      setRunningScrapers(prev => {
        const next = new Set(prev)
        next.delete(sourceType)
        return next
      })
    }
  }, [runningScrapers, campaign.custom_variables, toast, onRefresh])

  // Handle run all scrapers for a step
  const handleRunStepScrapers = useCallback(async (stepId: string) => {
    const stepData = scrapersByStep[stepId]
    if (!stepData) return

    const pendingScrapers = stepData.scrapers.filter(s => !s.isCompleted)
    if (pendingScrapers.length === 0) return

    toast.info('Ejecutando...', `Iniciando ${pendingScrapers.length} scrapers`)

    for (const scraper of pendingScrapers) {
      await handleRunScraper(scraper.sourceType)
    }
  }, [scrapersByStep, handleRunScraper, toast])

  // Handle run analysis step
  const handleRunAnalysisStep = useCallback(async (stepId: string) => {
    if (runningSteps.has(stepId)) return

    const stepInfo = ANALYSIS_STEPS.find(s => s.id === stepId)
    if (!stepInfo) return

    setRunningSteps(prev => new Set(prev).add(stepId))
    toast.info('Ejecutando...', `Iniciando ${stepInfo.name}`)

    try {
      // TODO: Navigate to campaign runner or execute step via API
      // For now, simulate
      await new Promise(resolve => setTimeout(resolve, 3000))

      toast.success('Completado', `${stepInfo.name} ejecutado`)
      onRefresh()
    } catch (error) {
      console.error('Error running analysis:', error)
      toast.error('Error', 'No se pudo ejecutar el análisis')
    } finally {
      setRunningSteps(prev => {
        const next = new Set(prev)
        next.delete(stepId)
        return next
      })
    }
  }, [runningSteps, toast, onRefresh])

  // Handle config saved
  const handleConfigSaved = () => {
    setShowConfigModal(false)
    onRefresh()
    toast.success('Guardado', 'Configuración actualizada')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{competitorName}</h2>
            {website && (
              <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                <Globe size={14} />
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 hover:underline"
                >
                  {website.replace(/^https?:\/\//, '')}
                </a>
                <ExternalLink size={12} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
          >
            <Settings size={18} />
            Configurar
          </button>
        </div>
      </div>

      {/* Input warning */}
      {inputStatus.configured < inputStatus.total && (
        <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">
                Configuración incompleta
              </p>
              <p className="text-sm text-amber-600">
                {inputStatus.configured}/{inputStatus.total} campos configurados. Algunos scrapers no podrán ejecutarse.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
          >
            Configurar
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Scrapers */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Search size={20} className="text-indigo-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Scrapers</h3>
                <p className="text-sm text-gray-500">
                  {totalScraperProgress.completed}/{totalScraperProgress.total} completados
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
            {Object.entries(scrapersByStep).map(([stepId, stepData]) => {
              const stepInfo = ANALYSIS_STEPS.find(s => s.id === stepId)
              const StepIcon = stepInfo?.icon || Circle
              const isComplete = stepData.completed === stepData.total
              const hasPending = stepData.completed < stepData.total

              return (
                <div key={stepId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StepIcon size={16} className={isComplete ? 'text-green-600' : 'text-gray-400'} />
                      <span className="text-sm font-medium text-gray-700">
                        {stepData.stepName}
                      </span>
                      <span className={`text-xs ${isComplete ? 'text-green-600' : 'text-gray-500'}`}>
                        ({stepData.completed}/{stepData.total})
                      </span>
                    </div>
                    {hasPending && (
                      <button
                        onClick={() => handleRunStepScrapers(stepId)}
                        className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                      >
                        Ejecutar todos
                      </button>
                    )}
                  </div>

                  <div className="space-y-1 pl-6">
                    {stepData.scrapers.map(scraper => {
                      const isRunning = runningScrapers.has(scraper.sourceType)
                      const hasInput = !scraper.inputKey || !!scraper.inputValue

                      return (
                        <div
                          key={scraper.sourceType}
                          className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${
                            scraper.isCompleted ? 'bg-green-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isRunning ? (
                              <Loader2 size={14} className="text-indigo-500 animate-spin" />
                            ) : scraper.isCompleted ? (
                              <CheckCircle size={14} className="text-green-500" />
                            ) : hasInput ? (
                              <Circle size={14} className="text-gray-300" />
                            ) : (
                              <AlertTriangle size={14} className="text-amber-500" />
                            )}
                            <span className={`text-sm ${
                              scraper.isCompleted ? 'text-green-700' : 'text-gray-600'
                            }`}>
                              {scraper.name}
                            </span>
                          </div>

                          {!scraper.isCompleted && (
                            <button
                              onClick={() => handleRunScraper(scraper.sourceType)}
                              disabled={isRunning || !hasInput}
                              className={`p-1 rounded transition-colors ${
                                isRunning || !hasInput
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-indigo-600 hover:bg-indigo-100'
                              }`}
                              title={!hasInput ? 'Configura el input primero' : 'Ejecutar'}
                            >
                              <Play size={14} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Analysis Flow */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <Sparkles size={20} className="text-purple-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Flujo de Análisis</h3>
              <p className="text-sm text-gray-500">
                {Object.values(analysisStepStatus).filter(s => s.isCompleted).length}/{ANALYSIS_STEPS.length} pasos completados
              </p>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {ANALYSIS_STEPS.map((step, index) => {
              const status = analysisStepStatus[step.id]
              const StepIcon = step.icon

              return (
                <div
                  key={step.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    status?.isCompleted
                      ? 'bg-green-50 border-green-200'
                      : status?.canRun
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                        status?.isCompleted
                          ? 'bg-green-600 text-white'
                          : status?.canRun
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-300 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <StepIcon size={16} className={
                            status?.isCompleted
                              ? 'text-green-600'
                              : status?.canRun
                                ? 'text-indigo-600'
                                : 'text-gray-400'
                          } />
                          <span className={`font-medium ${
                            status?.isCompleted
                              ? 'text-green-700'
                              : status?.canRun
                                ? 'text-indigo-700'
                                : 'text-gray-700'
                          }`}>
                            {step.name}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {step.description}
                        </p>
                        {status?.blockedReason && (
                          <p className="text-xs text-amber-600 mt-1">
                            {status.blockedReason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {status?.isRunning ? (
                        <Loader2 size={20} className="text-indigo-500 animate-spin" />
                      ) : status?.isCompleted ? (
                        <button
                          onClick={() => {
                            // TODO: View results
                            toast.info('Ver resultados', 'Funcionalidad en desarrollo')
                          }}
                          className="text-sm px-3 py-1.5 text-green-700 hover:bg-green-100 rounded-lg transition-colors"
                        >
                          Ver
                        </button>
                      ) : status?.canRun ? (
                        <button
                          onClick={() => handleRunAnalysisStep(step.id)}
                          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          <Play size={14} />
                          Ejecutar
                        </button>
                      ) : (
                        <Lock size={18} className="text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Config Modal */}
      {showConfigModal && (
        <ScraperConfigModal
          campaign={campaign}
          projectId={projectId}
          onClose={() => setShowConfigModal(false)}
          onSaved={handleConfigSaved}
        />
      )}
    </div>
  )
}
