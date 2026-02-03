'use client'

/**
 * KnowledgeBaseGenerator Component (Wizard Version)
 *
 * Vista principal de la Fase 1: Generar Base de Conocimiento.
 * Wizard secuencial que guía al usuario documento por documento.
 * Now with job persistence - survives navigation.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Sparkles,
  Globe,
  MessageSquare,
  Star,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  SkipForward,
  Circle,
  Clock,
  FileText,
} from 'lucide-react'
import type {
  KnowledgeBaseGeneratorProps,
  DocumentRequirement,
  SourceType,
  CampaignVariables,
  ScraperInputMapping,
} from '../types'
import {
  ALL_DOCUMENT_REQUIREMENTS,
  DOCUMENT_CATEGORIES,
  getScraperTypeForSource,
  buildScraperInputConfig,
  SCRAPER_INPUT_MAPPINGS,
} from '../constants'
import { createDocumentMetadata, formatCreatedAt } from '../documentMatcher'
import { createClient } from '@/lib/supabase-browser'
import { useScraperJobPersistence, PersistedJob } from '@/hooks/useScraperJobPersistence'
import { SCRAPER_TEMPLATES } from '@/lib/scraperTemplates'

// ============================================
// CATEGORY ICONS
// ============================================

const categoryIcons = {
  research: Sparkles,
  website: Globe,
  social_posts: MessageSquare,
  social_comments: MessageSquare,
  reviews: Star,
  seo: Search,
}

// ============================================
// DOCUMENT STATUS TYPE
// ============================================

type DocumentProgress = 'pending' | 'in_progress' | 'completed' | 'skipped'

// ============================================
// COMPONENT
// ============================================

export default function KnowledgeBaseGenerator({
  campaignId,
  projectId,
  competitorName,
  scraperInputs = {},
  existingDocuments = [],
  initialStep = 0,
  initialProgress = {},
  onDocumentGenerated,
  onComplete,
  onSkip,
  onProgressUpdate,
}: KnowledgeBaseGeneratorProps & {
  initialStep?: number
  initialProgress?: Record<string, DocumentProgress>
  onProgressUpdate?: (step: number, progress: Record<string, DocumentProgress>) => void
}) {
  // State
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [documentsProgress, setDocumentsProgress] = useState<Record<string, DocumentProgress>>(
    initialProgress
  )
  const [inputValues, setInputValues] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)

  // Get all documents in order
  const allDocuments = useMemo(() => ALL_DOCUMENT_REQUIREMENTS, [])
  const currentDocument = allDocuments[currentStep]

  // Create Supabase client
  const supabase = useMemo(() => createClient(), [])

  // Advance to next document (declared early for use in callbacks)
  const advanceToNext = useCallback(() => {
    if (currentStep < allDocuments.length - 1) {
      setCurrentStep((prev) => prev + 1)
      setGenerationError(null)
    } else {
      // All documents done, complete the phase
      onComplete?.()
    }
  }, [currentStep, allDocuments.length, onComplete])

  // Handle job completion from persistence hook
  const handleJobCompleted = useCallback(
    (job: PersistedJob) => {
      setDocumentsProgress((prev) => ({
        ...prev,
        [job.sourceType]: 'completed',
      }))
      onDocumentGenerated?.(job.documentId || '', job.sourceType as SourceType)

      // Auto-advance if this was the current document
      if (job.sourceType === currentDocument?.source_type) {
        advanceToNext()
      }
    },
    [onDocumentGenerated, currentDocument, advanceToNext]
  )

  // Handle job failure from persistence hook
  const handleJobFailed = useCallback((job: PersistedJob) => {
    setDocumentsProgress((prev) => ({
      ...prev,
      [job.sourceType]: 'pending',
    }))
    setGenerationError(job.error || 'La generación falló')
  }, [])

  // Use the persistence hook for job tracking
  const {
    activeJobs,
    trackJob,
    isRecovering,
  } = useScraperJobPersistence({
    projectId,
    onJobCompleted: handleJobCompleted,
    onJobFailed: handleJobFailed,
  })

  // Get scraper name for display
  const getScraperName = (sourceType: string): string => {
    const scraperType = getScraperTypeForSource(sourceType as SourceType)
    if (scraperType && scraperType in SCRAPER_TEMPLATES) {
      const template = SCRAPER_TEMPLATES[scraperType as keyof typeof SCRAPER_TEMPLATES]
      if (template) {
        return template.name
      }
    }
    return sourceType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  // Initialize progress from existing documents
  useEffect(() => {
    const newProgress: Record<string, DocumentProgress> = { ...initialProgress }

    for (const doc of existingDocuments) {
      if (doc.metadata?.source_type && doc.metadata?.competitor === competitorName) {
        const sourceType = doc.metadata.source_type as string
        if (!newProgress[sourceType]) {
          newProgress[sourceType] = 'completed'
        }
      }
    }

    setDocumentsProgress(newProgress)
  }, [existingDocuments, competitorName, initialProgress])

  // Notify parent of progress updates
  useEffect(() => {
    onProgressUpdate?.(currentStep, documentsProgress)
  }, [currentStep, documentsProgress, onProgressUpdate])

  // Get scraperMapping for current document
  const scraperMapping = useMemo(() => {
    if (!currentDocument) return null
    return SCRAPER_INPUT_MAPPINGS[currentDocument.id] as ScraperInputMapping | undefined
  }, [currentDocument])

  // Get current input value
  const currentInputValue = useMemo(() => {
    if (!currentDocument) return ''
    return (
      inputValues[currentDocument.source_type] ||
      (scraperInputs[currentDocument.id as keyof CampaignVariables] as string) ||
      ''
    )
  }, [currentDocument, inputValues, scraperInputs])

  // Calculate progress stats
  const progress = useMemo(() => {
    const total = allDocuments.length
    const completed = Object.values(documentsProgress).filter((s) => s === 'completed').length
    const skipped = Object.values(documentsProgress).filter((s) => s === 'skipped').length
    const inProgress = Object.values(documentsProgress).filter((s) => s === 'in_progress').length

    return {
      total,
      completed,
      skipped,
      inProgress,
      pending: total - completed - skipped - inProgress,
      percentage: Math.round(((completed + skipped) / total) * 100),
    }
  }, [allDocuments, documentsProgress])

  // Sync recovered jobs with document progress on mount
  useEffect(() => {
    if (isRecovering) return

    // Update document progress for any active jobs from persistence
    for (const job of activeJobs.values()) {
      setDocumentsProgress((prev) => {
        if (prev[job.sourceType] !== 'in_progress') {
          return {
            ...prev,
            [job.sourceType]: 'in_progress',
          }
        }
        return prev
      })
    }
  }, [activeJobs, isRecovering])

  // Go to previous document
  const goToPrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
      setGenerationError(null)
    }
  }

  // Handle generate document
  const handleGenerate = async () => {
    if (!currentDocument) return

    setIsGenerating(true)
    setGenerationError(null)

    // Update progress to in_progress
    setDocumentsProgress((prev) => ({
      ...prev,
      [currentDocument.source_type]: 'in_progress',
    }))

    try {
      // Handle Deep Research separately
      if (currentDocument.source_type === 'deep_research') {
        const response = await fetch('/api/deep-research/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            campaign_id: campaignId,
            competitor_name: competitorName,
            metadata: createDocumentMetadata(competitorName, currentDocument.source_type, campaignId),
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to generate deep research')
        }

        const result = await response.json()

        // Mark as completed
        setDocumentsProgress((prev) => ({
          ...prev,
          [currentDocument.source_type]: 'completed',
        }))

        onDocumentGenerated?.(result.document_id, currentDocument.source_type)
        setIsGenerating(false)
        advanceToNext()
        return
      }

      // For scrapers
      const scraperType = getScraperTypeForSource(currentDocument.source_type)
      if (!scraperType) {
        throw new Error(`No scraper type found for source: ${currentDocument.source_type}`)
      }

      const inputConfig = buildScraperInputConfig(
        currentDocument.source_type,
        currentInputValue,
        currentDocument.id
      )

      const response = await fetch('/api/scraper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          scraper_type: scraperType,
          input_config: inputConfig,
          target_name: competitorName,
          target_category: 'competitor',
          metadata: {
            campaign_id: campaignId,
            source_type: currentDocument.source_type,
            competitor: competitorName,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start scraper')
      }

      const result = await response.json()

      // Track the job for polling with persistence
      if (result.jobId) {
        trackJob({
          jobId: result.jobId,
          scraperId: scraperType,
          scraperName: getScraperName(currentDocument.source_type),
          sourceType: currentDocument.source_type,
          projectId,
        })
      }

      setIsGenerating(false)
    } catch (error) {
      console.error('Error generating document:', error)
      setGenerationError(error instanceof Error ? error.message : 'Error desconocido')
      setDocumentsProgress((prev) => ({
        ...prev,
        [currentDocument.source_type]: 'pending',
      }))
      setIsGenerating(false)
    }
  }

  // Handle skip document
  const handleSkip = () => {
    if (!currentDocument) return

    setDocumentsProgress((prev) => ({
      ...prev,
      [currentDocument.source_type]: 'skipped',
    }))
    advanceToNext()
  }

  // Handle input change
  const handleInputChange = (value: string) => {
    if (!currentDocument) return
    setInputValues((prev) => ({
      ...prev,
      [currentDocument.source_type]: value,
    }))
  }

  // Get status icon for sidebar
  const getStatusIcon = (doc: DocumentRequirement) => {
    const status = documentsProgress[doc.source_type]
    const isActive = doc.source_type === currentDocument?.source_type

    if (status === 'completed') {
      return <CheckCircle2 size={16} className="text-green-500" />
    }
    if (status === 'in_progress') {
      return <Clock size={16} className="text-blue-500 animate-pulse" />
    }
    if (status === 'skipped') {
      return <SkipForward size={16} className="text-gray-400" />
    }
    if (isActive) {
      return <Circle size={16} className="text-blue-500 fill-blue-500" />
    }
    return <Circle size={16} className="text-gray-300" />
  }

  // Get category for current document
  const getCurrentCategory = () => {
    if (!currentDocument) return null
    return Object.entries(DOCUMENT_CATEGORIES).find(([key]) =>
      currentDocument.category === key
    )?.[1]
  }

  const currentCategory = getCurrentCategory()
  const Icon = currentDocument
    ? categoryIcons[currentDocument.icon as keyof typeof categoryIcons] || FileText
    : FileText

  const isCurrentInProgress = documentsProgress[currentDocument?.source_type || ''] === 'in_progress'

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      {/* Sidebar - Document List */}
      <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h3 className="font-medium text-gray-900 text-sm">Documentos</h3>
          <p className="text-xs text-gray-500 mt-1">
            {progress.completed + progress.skipped}/{progress.total} completados
          </p>
          {/* Mini progress bar */}
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        <div className="py-2">
          {allDocuments.map((doc, index) => {
            const isActive = index === currentStep
            const status = documentsProgress[doc.source_type]

            return (
              <button
                key={doc.id}
                onClick={() => {
                  setCurrentStep(index)
                  setGenerationError(null)
                }}
                className={`w-full px-4 py-2 flex items-center gap-3 text-left transition-colors ${
                  isActive
                    ? 'bg-blue-50 border-l-2 border-blue-500'
                    : 'hover:bg-gray-100 border-l-2 border-transparent'
                }`}
              >
                {getStatusIcon(doc)}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm truncate ${
                      isActive ? 'text-blue-700 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {doc.name}
                  </p>
                  {status === 'in_progress' && (
                    <p className="text-xs text-blue-500">Generando...</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content - Current Document */}
      <div className="flex-1 flex flex-col">
        {/* Header with overall progress */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Fase 1 de 2: Base de Conocimiento</p>
              <h2 className="text-lg font-semibold text-gray-900">
                Analizando: {competitorName}
              </h2>
            </div>

            {/* Active jobs indicator */}
            {activeJobs.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 rounded-full">
                <Loader2 size={14} className="text-blue-600 animate-spin" />
                <span className="text-sm text-blue-700 font-medium">
                  {activeJobs.size} {activeJobs.size === 1 ? 'scraper activo' : 'scrapers activos'}
                </span>
              </div>
            )}

            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{progress.percentage}%</div>
              <div className="text-xs text-gray-500">
                {progress.completed} completados · {progress.skipped} omitidos · {progress.inProgress} en progreso
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full flex">
              {/* Completed portion - green */}
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
              />
              {/* In progress portion - blue animated */}
              <div
                className="h-full bg-blue-500 animate-pulse transition-all duration-500"
                style={{ width: `${(progress.inProgress / progress.total) * 100}%` }}
              />
              {/* Skipped portion - gray */}
              <div
                className="h-full bg-gray-400 transition-all duration-500"
                style={{ width: `${(progress.skipped / progress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Current document form */}
        {currentDocument && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Document header */}
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Icon size={24} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900">{currentDocument.name}</h3>
                  <p className="text-gray-600 mt-1">{currentDocument.description}</p>
                  {currentCategory && (
                    <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      {currentCategory.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Scraper info */}
              {currentDocument.apifyActor && (
                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                  <span className="font-medium">Scraper:</span> {currentDocument.apifyActor}
                </div>
              )}

              {/* Input field for scrapers */}
              {currentDocument.source === 'scraping' && scraperMapping && !isCurrentInProgress && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {scraperMapping.label}
                    {scraperMapping.required !== false && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  {scraperMapping.type === 'textarea' ? (
                    <textarea
                      value={currentInputValue}
                      onChange={(e) => handleInputChange(e.target.value)}
                      placeholder={scraperMapping.placeholder}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      rows={4}
                    />
                  ) : (
                    <input
                      type={scraperMapping.type === 'url' ? 'url' : 'text'}
                      value={currentInputValue}
                      onChange={(e) => handleInputChange(e.target.value)}
                      placeholder={scraperMapping.placeholder}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                  {scraperMapping.required === false && (
                    <p className="text-xs text-gray-400">Opcional</p>
                  )}
                </div>
              )}

              {/* Deep Research info */}
              {currentDocument.source === 'deep_research' && !isCurrentInProgress && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
                  <div className="flex items-start gap-3">
                    <Sparkles size={20} className="text-purple-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-purple-900 font-medium">
                        Investigación con IA
                      </p>
                      <p className="text-sm text-purple-700 mt-1">
                        Se generará un análisis profundo de {competitorName} usando Gemini 2.5 Pro
                        con búsqueda web en tiempo real.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* In progress state */}
              {isCurrentInProgress && (
                <div className="bg-blue-50 rounded-xl p-6 border border-blue-100 text-center">
                  <Loader2 size={32} className="text-blue-500 animate-spin mx-auto" />
                  <p className="text-blue-700 font-medium mt-3">Generando documento...</p>
                  <p className="text-sm text-blue-600 mt-1">
                    Esto puede tomar unos minutos. No cierres esta página.
                  </p>
                </div>
              )}

              {/* Error message */}
              {generationError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-800 font-medium">Error al generar</p>
                    <p className="text-sm text-red-700 mt-1">{generationError}</p>
                  </div>
                </div>
              )}

              {/* Existing documents */}
              {existingDocuments.some(
                (d) =>
                  d.metadata?.source_type === currentDocument.source_type &&
                  d.metadata?.competitor === competitorName
              ) && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm text-green-800 font-medium mb-2">
                    Documento existente encontrado
                  </p>
                  {existingDocuments
                    .filter(
                      (d) =>
                        d.metadata?.source_type === currentDocument.source_type &&
                        d.metadata?.competitor === competitorName
                    )
                    .map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between bg-white rounded-lg p-3 mt-2"
                      >
                        <div>
                          <span className="text-sm text-gray-700">{doc.name}</span>
                          <span className="text-xs text-gray-400 ml-2">
                            ({formatCreatedAt(doc.created_at)})
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setDocumentsProgress((prev) => ({
                              ...prev,
                              [currentDocument.source_type]: 'completed',
                            }))
                            onDocumentGenerated?.(doc.id, currentDocument.source_type)
                            advanceToNext()
                          }}
                          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                        >
                          Usar este
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer with navigation */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPrevious}
              disabled={currentStep === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft size={16} />
              Anterior
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSkip}
                disabled={isGenerating || isCurrentInProgress}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Omitir
              </button>

              {!isCurrentInProgress && (
                <button
                  onClick={handleGenerate}
                  disabled={
                    isGenerating ||
                    (currentDocument?.source === 'scraping' &&
                      scraperMapping?.required !== false &&
                      !currentInputValue.trim())
                  }
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generando...
                    </>
                  ) : currentDocument?.source === 'deep_research' ? (
                    <>
                      <Sparkles size={16} />
                      Generar Investigación
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      Generar y Continuar
                    </>
                  )}
                </button>
              )}

              {isCurrentInProgress && (
                <button
                  onClick={advanceToNext}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Continuar sin esperar
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
