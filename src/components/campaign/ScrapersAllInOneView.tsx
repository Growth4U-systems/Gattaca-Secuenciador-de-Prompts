'use client'

/**
 * ScrapersAllInOneView Component
 *
 * Grid view showing all scrapers for a campaign in one screen.
 * Allows batch execution and individual scraper management.
 * Now with job persistence - survives navigation and shows history.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Loader2,
  Play,
  Search,
  Sparkles,
  Globe,
  MessageSquare,
  Star,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import ScraperCard, { ScraperCardStatus } from './ScraperCard'
import ScraperHistory from './ScraperHistory'
import {
  ALL_DOCUMENT_REQUIREMENTS,
  SCRAPER_INPUT_MAPPINGS,
  SOURCE_TYPE_TO_SCRAPER_TYPE,
  buildScraperInputConfig,
  getScraperTypeForSource,
} from '@/lib/playbooks/competitor-analysis/constants'
import type { DocumentRequirement, SourceType } from '@/lib/playbooks/competitor-analysis/types'
import type { ScraperType } from '@/types/scraper.types'
import { createDocumentMetadata } from '@/lib/playbooks/competitor-analysis/documentMatcher'
import { useScraperJobPersistence, PersistedJob } from '@/hooks/useScraperJobPersistence'
import { SCRAPER_TEMPLATES } from '@/lib/scraperTemplates'

// ============================================
// TYPES
// ============================================

interface ExistingDocument {
  id: string
  name: string
  created_at: string
  metadata?: {
    source_type?: string
    competitor?: string
  }
}

interface ScraperState {
  status: ScraperCardStatus
  jobId?: string
  documentId?: string
  error?: string
  inputConfig: Record<string, unknown>
}

export interface ScrapersAllInOneViewProps {
  campaignId: string
  projectId: string
  competitorName: string
  scraperInputs?: Record<string, string>
  existingDocuments?: ExistingDocument[]
  onDocumentGenerated?: (documentId: string, sourceType: string) => void
  onViewDocument?: (documentId: string) => void
}

// ============================================
// CATEGORY CONFIG
// ============================================

type CategoryKey = 'all' | 'research' | 'website' | 'seo' | 'social_posts' | 'social_comments' | 'reviews'

const CATEGORY_TABS: { key: CategoryKey; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'Todos', icon: <Globe size={16} /> },
  { key: 'research', label: 'Research', icon: <Sparkles size={16} /> },
  { key: 'website', label: 'Website', icon: <Globe size={16} /> },
  { key: 'seo', label: 'SEO & Noticias', icon: <Search size={16} /> },
  { key: 'social_posts', label: 'Social Posts', icon: <MessageSquare size={16} /> },
  { key: 'social_comments', label: 'Comments', icon: <MessageSquare size={16} /> },
  { key: 'reviews', label: 'Reviews', icon: <Star size={16} /> },
]

// ============================================
// MAIN COMPONENT
// ============================================

export default function ScrapersAllInOneView({
  campaignId,
  projectId,
  competitorName,
  scraperInputs = {},
  existingDocuments = [],
  onDocumentGenerated,
  onViewDocument,
}: ScrapersAllInOneViewProps) {
  // State for each scraper
  const [scraperStates, setScraperStates] = useState<Record<string, ScraperState>>({})
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all')
  const [isExecutingAll, setIsExecutingAll] = useState(false)

  // All documents from constants
  const allDocuments = useMemo(() => ALL_DOCUMENT_REQUIREMENTS, [])

  // Handle job completion from persistence hook
  const handleJobCompleted = useCallback(
    (job: PersistedJob) => {
      setScraperStates((prev) => ({
        ...prev,
        [job.sourceType]: {
          ...prev[job.sourceType],
          status: 'completed',
          documentId: job.documentId,
          error: undefined,
        },
      }))
      onDocumentGenerated?.(job.documentId || '', job.sourceType)
    },
    [onDocumentGenerated]
  )

  // Handle job failure from persistence hook
  const handleJobFailed = useCallback((job: PersistedJob) => {
    setScraperStates((prev) => ({
      ...prev,
      [job.sourceType]: {
        ...prev[job.sourceType],
        status: 'failed',
        error: job.error || 'Error desconocido',
      },
    }))
  }, [])

  // Use the persistence hook for job tracking
  const {
    activeJobs,
    jobHistory,
    trackJob,
    clearHistory,
    isRecovering,
  } = useScraperJobPersistence({
    projectId,
    onJobCompleted: handleJobCompleted,
    onJobFailed: handleJobFailed,
  })

  // Initialize scraper states from existing documents
  useEffect(() => {
    const initialStates: Record<string, ScraperState> = {}

    for (const doc of allDocuments) {
      const existingDoc = existingDocuments.find(
        (d) =>
          d.metadata?.source_type === doc.source_type && d.metadata?.competitor === competitorName
      )

      // Get default input from scraperInputs or empty
      const inputMapping = SCRAPER_INPUT_MAPPINGS[doc.id]
      const inputKey = inputMapping?.inputKey || 'url'
      const defaultValue = scraperInputs[doc.id] || ''

      initialStates[doc.source_type] = {
        status: existingDoc ? 'completed' : 'pending',
        documentId: existingDoc?.id,
        inputConfig: {
          [inputKey]: defaultValue,
        },
      }
    }

    setScraperStates(initialStates)
  }, [allDocuments, existingDocuments, competitorName, scraperInputs])

  // Filter documents by category
  const filteredDocuments = useMemo(() => {
    if (activeCategory === 'all') return allDocuments
    return allDocuments.filter((doc) => doc.category === activeCategory)
  }, [allDocuments, activeCategory])

  // Calculate stats
  const stats = useMemo(() => {
    const total = allDocuments.length
    const completed = Object.values(scraperStates).filter((s) => s.status === 'completed').length
    const running = Object.values(scraperStates).filter((s) => s.status === 'running').length
    const failed = Object.values(scraperStates).filter((s) => s.status === 'failed').length
    const pending = total - completed - running - failed

    return { total, completed, running, failed, pending }
  }, [allDocuments, scraperStates])

  // Get existing document for a source type
  const getExistingDocument = useCallback(
    (sourceType: string) => {
      const state = scraperStates[sourceType]
      if (state?.status === 'completed' && state.documentId) {
        const doc = existingDocuments.find((d) => d.id === state.documentId)
        if (doc) {
          return {
            id: doc.id,
            name: doc.name,
            created_at: doc.created_at,
          }
        }
      }
      return undefined
    },
    [scraperStates, existingDocuments]
  )

  // Sync recovered jobs with scraper states on mount
  useEffect(() => {
    if (isRecovering) return

    // Update scraper states for any active jobs from persistence
    for (const job of activeJobs.values()) {
      setScraperStates((prev) => {
        if (prev[job.sourceType]?.status !== 'running') {
          return {
            ...prev,
            [job.sourceType]: {
              ...prev[job.sourceType],
              status: 'running',
              jobId: job.jobId,
            },
          }
        }
        return prev
      })
    }
  }, [activeJobs, isRecovering])

  // Handle input change for a scraper
  const handleInputChange = (sourceType: string, key: string, value: unknown) => {
    setScraperStates((prev) => ({
      ...prev,
      [sourceType]: {
        ...prev[sourceType],
        inputConfig: {
          ...prev[sourceType]?.inputConfig,
          [key]: value,
        },
      },
    }))
  }

  // Get scraper name for display
  const getScraperName = (sourceType: string): string => {
    const scraperType = SOURCE_TYPE_TO_SCRAPER_TYPE[sourceType as SourceType]
    if (scraperType) {
      const template = SCRAPER_TEMPLATES[scraperType as ScraperType]
      if (template) {
        return template.name
      }
    }
    // Fallback: humanize source_type
    return sourceType
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  // Execute a single scraper
  const executeScraper = async (doc: DocumentRequirement) => {
    const sourceType = doc.source_type
    const state = scraperStates[sourceType]
    const scraperName = getScraperName(sourceType)

    // Update state to running
    setScraperStates((prev) => ({
      ...prev,
      [sourceType]: {
        ...prev[sourceType],
        status: 'running',
        error: undefined,
      },
    }))

    try {
      // Handle Deep Research separately
      if (sourceType === 'deep_research') {
        const response = await fetch('/api/deep-research/start', {
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
          throw new Error(error.error || 'Failed to start deep research')
        }

        const result = await response.json()

        // Track job for polling with persistence
        if (result.jobId) {
          trackJob({
            jobId: result.jobId,
            scraperId: 'deep_research',
            scraperName: 'Deep Research',
            sourceType,
            projectId,
          })
        }
        return
      }

      // For regular scrapers
      const scraperType = getScraperTypeForSource(sourceType as SourceType)
      if (!scraperType) {
        throw new Error(`No scraper type found for source: ${sourceType}`)
      }

      // Get input value from state
      const inputMapping = SCRAPER_INPUT_MAPPINGS[doc.id]
      const inputKey = inputMapping?.inputKey || 'url'
      const inputValue = (state?.inputConfig?.[inputKey] as string) || ''

      const inputConfig = buildScraperInputConfig(sourceType as SourceType, inputValue, doc.id)

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

      // Track job for polling with persistence
      if (result.jobId) {
        trackJob({
          jobId: result.jobId,
          scraperId: scraperType,
          scraperName,
          sourceType,
          projectId,
        })
      }
    } catch (error) {
      console.error('Error executing scraper:', error)
      setScraperStates((prev) => ({
        ...prev,
        [sourceType]: {
          ...prev[sourceType],
          status: 'failed',
          error: error instanceof Error ? error.message : 'Error desconocido',
        },
      }))
    }
  }

  // Execute all pending scrapers
  const executeAllPending = async () => {
    setIsExecutingAll(true)

    const pendingDocs = allDocuments.filter(
      (doc) => scraperStates[doc.source_type]?.status === 'pending'
    )

    // Execute scrapers sequentially with small delay to avoid rate limiting
    for (const doc of pendingDocs) {
      await executeScraper(doc)
      // Small delay between starts
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    setIsExecutingAll(false)
  }

  // Re-execute a failed or completed scraper
  const reExecuteScraper = async (doc: DocumentRequirement) => {
    await executeScraper(doc)
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Base de Conocimiento</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {competitorName} · {stats.completed}/{stats.total} completados
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Active jobs indicator */}
            {activeJobs.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
                <Loader2 size={14} className="text-blue-600 animate-spin" />
                <span className="text-sm text-blue-700 font-medium">
                  {activeJobs.size} {activeJobs.size === 1 ? 'scraper activo' : 'scrapers activos'}
                </span>
              </div>
            )}

            {/* Execute all button */}
            <button
              onClick={executeAllPending}
              disabled={isExecutingAll || stats.pending === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExecutingAll ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Ejecutar Pendientes ({stats.pending})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full flex">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${(stats.completed / stats.total) * 100}%` }}
            />
            <div
              className="h-full bg-blue-500 animate-pulse transition-all duration-500"
              style={{ width: `${(stats.running / stats.total) * 100}%` }}
            />
            <div
              className="h-full bg-red-400 transition-all duration-500"
              style={{ width: `${(stats.failed / stats.total) * 100}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-green-600">
            <CheckCircle size={12} />
            {stats.completed} completados
          </span>
          {stats.running > 0 && (
            <span className="flex items-center gap-1.5 text-blue-600">
              <Loader2 size={12} className="animate-spin" />
              {stats.running} en progreso
            </span>
          )}
          {stats.failed > 0 && (
            <span className="flex items-center gap-1.5 text-red-600">
              <AlertCircle size={12} />
              {stats.failed} con errores
            </span>
          )}
          <span className="text-gray-500">{stats.pending} pendientes</span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 overflow-x-auto">
          {CATEGORY_TABS.map((tab) => {
            const count =
              tab.key === 'all'
                ? allDocuments.length
                : allDocuments.filter((d) => d.category === tab.key).length

            return (
              <button
                key={tab.key}
                onClick={() => setActiveCategory(tab.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeCategory === tab.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.icon}
                {tab.label}
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs ${
                    activeCategory === tab.key ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Scrapers Grid */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* History Section */}
        {jobHistory.length > 0 && (
          <ScraperHistory
            history={jobHistory}
            onViewDocument={onViewDocument}
            onClearHistory={clearHistory}
          />
        )}

        {/* Recovering indicator */}
        {isRecovering && (
          <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <Loader2 size={16} className="text-blue-600 animate-spin" />
            <span className="text-sm text-blue-700">Recuperando estado de scrapers...</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const state = scraperStates[doc.source_type]

            // Get the scraper type, fallback to source_type if not mapped
            const scraperType = (SOURCE_TYPE_TO_SCRAPER_TYPE[doc.source_type as SourceType] || doc.source_type) as ScraperType

            return (
              <ScraperCard
                key={doc.id}
                scraperType={scraperType}
                status={state?.status || 'pending'}
                inputConfig={state?.inputConfig || {}}
                existingDocument={getExistingDocument(doc.source_type)}
                error={state?.error}
                onInputChange={(key, value) => handleInputChange(doc.source_type, key, value)}
                onExecute={() => executeScraper(doc)}
                onReExecute={() => reExecuteScraper(doc)}
                onViewDocument={onViewDocument}
                disabled={isExecutingAll}
                compact={false}
              />
            )
          })}
        </div>

        {filteredDocuments.length === 0 && (
          <div className="text-center py-12">
            <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay scrapers en esta categoría</h3>
            <p className="text-gray-500">Selecciona otra categoría para ver los scrapers disponibles.</p>
          </div>
        )}
      </div>
    </div>
  )
}
