'use client'

/**
 * KnowledgeBaseGenerator Component
 *
 * Vista principal de la Fase 2: Generar Base de Conocimiento.
 * Muestra todos los documentos requeridos organizados por categoría.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Sparkles,
  Globe,
  MessageSquare,
  Star,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import type {
  KnowledgeBaseGeneratorProps,
  DocumentRequirement,
  SourceType,
  MatchResult,
  CampaignVariables,
  Document,
} from '../types'
import {
  ALL_DOCUMENT_REQUIREMENTS,
  DOCUMENT_CATEGORIES,
  getDocumentsByCategory,
  getScraperTypeForSource,
  buildScraperInputConfig,
} from '../constants'
import { matchDocumentForStep, createDocumentMetadata, type SupabaseClientLike } from '../documentMatcher'
import DocumentGeneratorCard from './DocumentGeneratorCard'
import { createClient } from '@/lib/supabase-browser'

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
// COMPONENT
// ============================================

export default function KnowledgeBaseGenerator({
  campaignId,
  projectId,
  competitorName,
  scraperInputs = {},
  existingDocuments = [],
  onDocumentGenerated,
  onComplete,
  onSkip,
}: KnowledgeBaseGeneratorProps) {
  // Debug logging
  console.log('[KnowledgeBaseGenerator] Rendering with:', { campaignId, projectId, competitorName })

  // State
  const [documentStatuses, setDocumentStatuses] = useState<Map<SourceType, MatchResult>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['research']))
  const [generatingDocs, setGeneratingDocs] = useState<Set<SourceType>>(new Set())
  const [skippedDocs, setSkippedDocs] = useState<Set<SourceType>>(new Set())

  // Track active scraper jobs for polling (jobId -> sourceType)
  const [activeJobs, setActiveJobs] = useState<Map<string, SourceType>>(new Map())
  const pollingInterval = useRef<NodeJS.Timeout | null>(null)

  // Get documents grouped by category
  const documentsByCategory = useMemo(() => getDocumentsByCategory(), [])

  // Create Supabase client
  const supabase = useMemo(() => {
    console.log('[KnowledgeBaseGenerator] Creating Supabase client...')
    const client = createClient()
    console.log('[KnowledgeBaseGenerator] Supabase client created successfully')
    return client
  }, [])

  // Load document statuses - SIMPLIFIED: Skip all queries, just show as missing
  const loadDocumentStatuses = useCallback(async () => {
    console.log('[KnowledgeBaseGenerator] Starting loadDocumentStatuses (SIMPLIFIED)...')
    console.log('[KnowledgeBaseGenerator] Params:', { projectId, competitorName })
    setLoading(true)
    setLoadError(null)

    try {
      const statuses = new Map<SourceType, MatchResult>()

      // Initialize all documents as missing by default - NO QUERIES
      for (const doc of ALL_DOCUMENT_REQUIREMENTS) {
        statuses.set(doc.source_type, { documentId: null, status: 'missing' })
      }

      console.log('[KnowledgeBaseGenerator] Initialized all docs as missing:', statuses.size)

      // Also check existingDocuments prop for any additional matches
      for (const doc of existingDocuments) {
        if (doc.metadata?.source_type && doc.metadata?.competitor === competitorName) {
          const sourceType = doc.metadata.source_type as SourceType
          const existing = statuses.get(sourceType)

          // Only update if currently missing or add to existing options
          if (!existing || existing.status === 'missing') {
            statuses.set(sourceType, {
              documentId: doc.id,
              status: 'available',
              document: doc,
              existingOptions: [
                {
                  id: doc.id,
                  name: doc.name,
                  createdAt: doc.created_at,
                  daysSinceCreation: Math.ceil(
                    (Date.now() - new Date(doc.created_at).getTime()) / (1000 * 60 * 60 * 24)
                  ),
                },
              ],
            })
          }
        }
      }

      console.log('[KnowledgeBaseGenerator] Loaded statuses:', statuses.size)
      setDocumentStatuses(statuses)
    } catch (error) {
      console.error('[KnowledgeBaseGenerator] Error loading document statuses:', error)
      setLoadError(error instanceof Error ? error.message : 'Error cargando documentos')
      // Initialize with all documents as missing so UI still works
      const statuses = new Map<SourceType, MatchResult>()
      for (const doc of ALL_DOCUMENT_REQUIREMENTS) {
        statuses.set(doc.source_type, { documentId: null, status: 'missing' })
      }
      setDocumentStatuses(statuses)
    } finally {
      setLoading(false)
    }
  }, [supabase, projectId, competitorName, existingDocuments])

  useEffect(() => {
    loadDocumentStatuses()
  }, [loadDocumentStatuses])

  // Poll active scraper jobs for status updates
  const pollActiveJobs = useCallback(async () => {
    if (activeJobs.size === 0) return

    const completedJobs: string[] = []

    for (const [jobId, sourceType] of activeJobs.entries()) {
      try {
        console.log(`[KnowledgeBaseGenerator] Polling job ${jobId} for ${sourceType}...`)
        const response = await fetch(`/api/scraper/poll?jobId=${jobId}`)
        if (!response.ok) {
          console.error(`[KnowledgeBaseGenerator] Poll failed for ${jobId}: ${response.status} ${response.statusText}`)
          const errorText = await response.text().catch(() => 'Could not read error body')
          console.error(`[KnowledgeBaseGenerator] Error body:`, errorText)
          continue
        }

        const result = await response.json()

        if (result.completed) {
          completedJobs.push(jobId)

          if (result.status === 'completed') {
            // Job completed successfully - refresh document statuses
            await loadDocumentStatuses()
            onDocumentGenerated?.(result.document_id || '', sourceType)
          } else if (result.status === 'failed') {
            // Job failed - revert to missing
            setDocumentStatuses((prev) => {
              const newMap = new Map(prev)
              newMap.set(sourceType, { documentId: null, status: 'missing' })
              return newMap
            })
            console.error(`Scraper job ${jobId} failed:`, result.error)
          }
        }
      } catch (error) {
        console.warn(`Error polling job ${jobId}:`, error)
      }
    }

    // Remove completed jobs from tracking
    if (completedJobs.length > 0) {
      setActiveJobs((prev) => {
        const newMap = new Map(prev)
        completedJobs.forEach((jobId) => newMap.delete(jobId))
        return newMap
      })
    }
  }, [activeJobs, loadDocumentStatuses, onDocumentGenerated])

  // Set up polling interval when there are active jobs
  useEffect(() => {
    if (activeJobs.size > 0) {
      // Poll every 3 seconds
      pollingInterval.current = setInterval(pollActiveJobs, 3000)
      // Also poll immediately
      pollActiveJobs()
    } else if (pollingInterval.current) {
      clearInterval(pollingInterval.current)
      pollingInterval.current = null
    }

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current)
        pollingInterval.current = null
      }
    }
  }, [activeJobs.size, pollActiveJobs])

  // Calculate progress
  const progress = useMemo(() => {
    const total = ALL_DOCUMENT_REQUIREMENTS.length
    const available = Array.from(documentStatuses.values()).filter(
      (s) => s.status === 'available'
    ).length
    const skipped = skippedDocs.size
    const inProgress = Array.from(documentStatuses.values()).filter(
      (s) => s.status === 'in_progress'
    ).length

    return {
      total,
      available,
      skipped,
      inProgress,
      missing: total - available - skipped,
      percentage: Math.round(((available + skipped) / total) * 100),
    }
  }, [documentStatuses, skippedDocs])

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  // Handle document generation
  const handleGenerate = async (sourceType: SourceType, input: Record<string, any>) => {
    setGeneratingDocs((prev) => new Set(prev).add(sourceType))

    // Update status to in_progress
    setDocumentStatuses((prev) => {
      const newMap = new Map(prev)
      newMap.set(sourceType, { documentId: null, status: 'in_progress' })
      return newMap
    })

    try {
      // Get the document requirement to find the docId for input mapping
      const docRequirement = ALL_DOCUMENT_REQUIREMENTS.find(d => d.source_type === sourceType)
      if (!docRequirement) {
        throw new Error(`Document requirement not found for source type: ${sourceType}`)
      }

      // Handle Deep Research separately
      if (sourceType === 'deep_research') {
        // Deep Research uses a different API endpoint (Gemini)
        const response = await fetch('/api/deep-research/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            campaign_id: campaignId,
            competitor_name: competitorName,
            metadata: createDocumentMetadata(competitorName, sourceType, campaignId),
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to generate deep research')
        }

        const result = await response.json()

        // Update status to available
        setDocumentStatuses((prev) => {
          const newMap = new Map(prev)
          newMap.set(sourceType, {
            documentId: result.document_id,
            status: 'available',
            existingOptions: [
              {
                id: result.document_id,
                name: `Deep Research - ${competitorName}`,
                createdAt: new Date().toISOString(),
                daysSinceCreation: 0,
              },
            ],
          })
          return newMap
        })

        onDocumentGenerated?.(result.document_id, sourceType)
        return
      }

      // For scrapers, get the scraper type and build input config
      const scraperType = getScraperTypeForSource(sourceType)
      if (!scraperType) {
        throw new Error(`No scraper type found for source: ${sourceType}`)
      }

      // Get the input value from the input object
      const inputValue = Object.values(input)[0] as string
      const inputConfig = buildScraperInputConfig(sourceType, inputValue, docRequirement.id)

      // Call the scraper API
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
            source_type: sourceType,
            competitor: competitorName,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start scraper')
      }

      const result = await response.json()
      console.log('Scraper started:', result)

      // Track the job ID for polling (US-008)
      if (result.jobId) {
        setActiveJobs((prev) => {
          const newMap = new Map(prev)
          newMap.set(result.jobId, sourceType)
          return newMap
        })
      }

    } catch (error) {
      console.error('Error generating document:', error)
      // Revert to missing
      setDocumentStatuses((prev) => {
        const newMap = new Map(prev)
        newMap.set(sourceType, { documentId: null, status: 'missing' })
        return newMap
      })
    } finally {
      setGeneratingDocs((prev) => {
        const newSet = new Set(prev)
        newSet.delete(sourceType)
        return newSet
      })
    }
  }

  // Handle use existing document
  const handleUseExisting = (documentId: string, sourceType: SourceType) => {
    console.log('Using existing document:', documentId, 'for source type:', sourceType)

    // Update status to available with this document
    setDocumentStatuses((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(sourceType)
      newMap.set(sourceType, {
        documentId,
        status: 'available',
        existingOptions: existing?.existingOptions || [],
      })
      return newMap
    })

    // Notify parent
    onDocumentGenerated?.(documentId, sourceType)
  }

  // Handle skip document
  const handleSkip = (sourceType: SourceType) => {
    setSkippedDocs((prev) => new Set(prev).add(sourceType))
    setDocumentStatuses((prev) => {
      const newMap = new Map(prev)
      newMap.set(sourceType, { documentId: null, status: 'available' }) // Mark as "handled"
      return newMap
    })
  }

  // Generate all missing documents
  const handleGenerateAll = async () => {
    const missing = ALL_DOCUMENT_REQUIREMENTS.filter((doc) => {
      const status = documentStatuses.get(doc.source_type)
      return status?.status === 'missing' && !skippedDocs.has(doc.source_type)
    })

    for (const doc of missing) {
      // Get default input from scraperInputs
      const inputKey = doc.id
      const input = scraperInputs[inputKey as keyof CampaignVariables]

      if (doc.source === 'deep_research' || input) {
        await handleGenerate(doc.source_type, input ? { value: input } : {})
      }
    }
  }

  // Debug: Show what we're rendering
  console.log('[KnowledgeBaseGenerator] State:', { loading, loadError, documentStatusesSize: documentStatuses.size })

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-gray-500">Cargando documentos de {competitorName}...</p>
        <p className="text-xs text-gray-400">ProjectId: {projectId}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error message if any */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-800 font-medium">Error al cargar documentos</p>
            <p className="text-sm text-red-700 mt-1">{loadError}</p>
            <button
              onClick={() => loadDocumentStatuses()}
              className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}
      {/* Header with progress */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Base de Conocimiento: {competitorName}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Genera los documentos necesarios para el análisis. El playbook funcionará mejor
              con más documentos disponibles.
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">{progress.percentage}%</div>
            <div className="text-sm text-gray-500">
              {progress.available + progress.skipped}/{progress.total} docs
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>

        {/* Stats */}
        <div className="mt-4 flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle2 size={14} />
            {progress.available} disponibles
          </span>
          {progress.inProgress > 0 && (
            <span className="flex items-center gap-1 text-blue-600">
              <Loader2 size={14} className="animate-spin" />
              {progress.inProgress} generando
            </span>
          )}
          {progress.missing > 0 && (
            <span className="flex items-center gap-1 text-gray-500">
              <AlertTriangle size={14} />
              {progress.missing} faltantes
            </span>
          )}
        </div>
      </div>

      {/* Warning if missing documents */}
      {progress.missing > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-800 font-medium">
              Faltan {progress.missing} documentos
            </p>
            <p className="text-sm text-amber-700 mt-1">
              El playbook puede ejecutarse, pero la calidad del análisis será mejor con más
              documentos. Los documentos de redes sociales son especialmente importantes para
              el análisis triangulado.
            </p>
          </div>
        </div>
      )}

      {/* Document categories */}
      <div className="space-y-4">
        {Object.entries(documentsByCategory).map(([category, docs]) => {
          const CategoryIcon = categoryIcons[category as keyof typeof categoryIcons] || Globe
          const categoryInfo = DOCUMENT_CATEGORIES[category as keyof typeof DOCUMENT_CATEGORIES]
          const isExpanded = expandedCategories.has(category)

          // Count available in this category
          const categoryAvailable = docs.filter((doc) => {
            const status = documentStatuses.get(doc.source_type)
            return status?.status === 'available'
          }).length

          return (
            <div key={category} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <CategoryIcon size={18} className="text-gray-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900">{categoryInfo?.label || category}</h3>
                    <p className="text-xs text-gray-500">{categoryInfo?.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {categoryAvailable}/{docs.length}
                  </span>
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-400" />
                  )}
                </div>
              </button>

              {/* Category documents */}
              {isExpanded && (
                <div className="p-4 space-y-3">
                  {docs.map((doc) => {
                    const status = documentStatuses.get(doc.source_type)
                    const isSkipped = skippedDocs.has(doc.source_type)

                    if (isSkipped) return null

                    return (
                      <DocumentGeneratorCard
                        key={doc.id}
                        requirement={doc}
                        competitorName={competitorName}
                        projectId={projectId}
                        campaignId={campaignId}
                        scraperInput={
                          scraperInputs[doc.id as keyof CampaignVariables] as string | undefined
                        }
                        existingDocuments={status?.existingOptions}
                        status={status?.status || 'missing'}
                        isGenerating={generatingDocs.has(doc.source_type)}
                        onGenerate={handleGenerate}
                        onUseExisting={handleUseExisting}
                        onSkip={handleSkip}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          onClick={handleGenerateAll}
          disabled={progress.missing === 0 || generatingDocs.size > 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={16} />
          Generar todos los faltantes ({progress.missing})
        </button>

        <div className="flex items-center gap-3">
          {onSkip && (
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Omitir por ahora
            </button>
          )}

          <button
            onClick={onComplete}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            Continuar al Playbook
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
