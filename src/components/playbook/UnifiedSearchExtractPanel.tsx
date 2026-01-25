'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search,
  Download,
  FileText,
  Loader2,
  Play,
  AlertCircle,
  DollarSign,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Globe,
  ExternalLink,
  History,
  Database,
  Settings,
  Info,
  Eye,
  Save,
  FolderOpen,
} from 'lucide-react'
import StepExecutionProgress, { ExecutionType, ExecutionStatus, PartialResults } from './StepExecutionProgress'
import { generateSearchQueries } from '@/lib/scraper/query-builder'
import { EXTRACTION_PROMPT } from '@/lib/templates/niche-finder-playbook'
import { ScrapedContentViewer } from '@/components/niche-finder/ScrapedContentViewer'
import { saveScrapedContentToContextLake, getProjectClientId, NicheFinderSaveContext } from '@/lib/niche-finder-context-lake'

// Types
interface EditableConfig {
  life_contexts: string[]
  product_words: string[]
  indicators: string[]
  sources: {
    reddit: boolean
    thematic_forums: boolean
    general_forums: string[]
  }
  serp_pages: number
}

interface UrlInfo {
  id: string
  url: string
  title?: string
  life_context?: string
  product_word?: string
  content_markdown?: string
  word_count?: number
  status?: string
}

interface UrlSummary {
  source: string
  count: number
  urls: UrlInfo[]
  selected: boolean
}

interface ExtractedNiche {
  id: string
  job_id: string
  url_id: string
  problem: string
  persona: string
  emotion: string
  context: string
  raw_data?: Record<string, unknown>
  created_at: string
  url_info?: {
    url: string
    source_type: string
  } | null
}

interface ExtractionStats {
  job_status?: string
  urls_found: number
  urls_scraped: number
  urls_filtered: number
  niches_extracted: number
  extract_completed: number
  extract_total: number
  url_status_breakdown: Record<string, number>
}

type Phase = 'preview' | 'serp_executing' | 'serp_complete' | 'scraping' | 'scrape_done' | 'extracting' | 'completed' | 'error'

interface UnifiedSearchExtractPanelProps {
  config: Partial<EditableConfig>
  projectId?: string
  jobId?: string // Existing job ID if resuming
  onExecuteSerp: (finalConfig: EditableConfig) => Promise<void>
  onExecuteAnalysis: (jobId: string, selectedSources: string[], extractionPrompt?: string) => Promise<void>
  onComplete: (output: { jobId: string; extractedCount: number }) => void
  onBack?: () => void
  onCancel?: () => void
  onResetPhase?: () => void // Callback to reset external phase (for "Modificar búsqueda" button)
  // Current execution state
  currentPhase?: Phase
  serpProgress?: {
    current: number
    total: number
    label?: string
  }
  analysisProgress?: {
    current: number
    total: number
    label?: string
    scrapedCount?: number
    extractedCount?: number
    filteredCount?: number
  }
}

const COST_PER_SEARCH = 0.004
const COST_PER_URL_SCRAPE = 0.001
const COST_PER_URL_EXTRACT = 0.0005

export function UnifiedSearchExtractPanel({
  config,
  projectId,
  jobId: initialJobId,
  onExecuteSerp,
  onExecuteAnalysis,
  onComplete,
  onBack,
  onCancel,
  onResetPhase,
  currentPhase: externalPhase,
  serpProgress,
  analysisProgress,
}: UnifiedSearchExtractPanelProps) {
  // Internal phase tracking
  const [internalPhase, setInternalPhase] = useState<Phase>('preview')
  // Track if user explicitly navigated back (to override external phase)
  const [userNavigatedBack, setUserNavigatedBack] = useState(false)

  // Use internal phase if user navigated back, otherwise prefer external
  const phase = userNavigatedBack ? internalPhase : (externalPhase || internalPhase)

  // Reset userNavigatedBack when external phase changes to match our target
  // This allows external phase to take control again after state syncs
  useEffect(() => {
    if (userNavigatedBack && externalPhase === internalPhase) {
      setUserNavigatedBack(false)
    }
  }, [userNavigatedBack, externalPhase, internalPhase])

  // Config state
  const [editableConfig, setEditableConfig] = useState<EditableConfig>(() => ({
    life_contexts: config.life_contexts || [],
    product_words: config.product_words || [],
    indicators: config.indicators || [],
    sources: config.sources || {
      reddit: true,
      thematic_forums: false,
      general_forums: [],
    },
    serp_pages: config.serp_pages || 5,
  }))

  // SERP results state
  const [jobId, setJobId] = useState<string | null>(initialJobId || null)
  const [urlsBySource, setUrlsBySource] = useState<UrlSummary[]>([])
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())
  const [loadingUrls, setLoadingUrls] = useState(false)

  // UI state
  const [showQueryExamples, setShowQueryExamples] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extraction prompt state
  const [extractionPrompt, setExtractionPrompt] = useState(EXTRACTION_PROMPT)
  const [showPromptEditor, setShowPromptEditor] = useState(false)

  // Previous jobs state (for loading existing SERP results)
  const [showPreviousJobs, setShowPreviousJobs] = useState(false)
  const [previousJobs, setPreviousJobs] = useState<Array<{
    id: string
    status: string
    urls_found: number
    urls_scraped: number
    niches_extracted: number
    config: Record<string, unknown>
    created_at: string
  }>>([])
  const [loadingPreviousJobs, setLoadingPreviousJobs] = useState(false)

  // Extracted niches state (live results during analysis)
  const [extractedNiches, setExtractedNiches] = useState<ExtractedNiche[]>([])
  const [extractionStats, setExtractionStats] = useState<ExtractionStats | null>(null)
  const [showNichesTable, setShowNichesTable] = useState(true)

  // URL content viewer state
  const [viewingUrlId, setViewingUrlId] = useState<string | null>(null)

  // Context Lake save state
  const [savingToContextLake, setSavingToContextLake] = useState(false)
  const [contextLakeSaved, setContextLakeSaved] = useState(false)

  // All URLs state (for expanded view)
  const [allScrapedUrls, setAllScrapedUrls] = useState<UrlInfo[]>([])
  const [loadingAllUrls, setLoadingAllUrls] = useState(false)
  const [showAllUrlsModal, setShowAllUrlsModal] = useState(false)

  // Scraping progress state (separate from extraction)
  const [scrapingProgress, setScrapingProgress] = useState<{
    total: number
    completed: number
    failed: number
  } | null>(null)

  // Validate config
  const configError = useMemo(() => {
    if (!editableConfig.sources || typeof editableConfig.sources !== 'object') {
      return 'Configuración de fuentes no disponible'
    }
    if (!Array.isArray(editableConfig.life_contexts) || editableConfig.life_contexts.length === 0) {
      return 'Debes seleccionar al menos un contexto de búsqueda'
    }
    if (!Array.isArray(editableConfig.product_words) || editableConfig.product_words.length === 0) {
      return 'Debes seleccionar al menos una palabra de necesidad'
    }
    return null
  }, [editableConfig])

  // Calculate SERP stats
  const serpStats = useMemo(() => {
    if (configError) {
      return { totalQueries: 0, totalSearches: 0, estimatedCost: 0, exampleQueries: [] }
    }

    const queries = generateSearchQueries({
      life_contexts: editableConfig.life_contexts,
      product_words: editableConfig.product_words,
      indicators: editableConfig.indicators,
      sources: editableConfig.sources,
      serp_pages: editableConfig.serp_pages,
    })

    const totalSearches = queries.length * editableConfig.serp_pages
    const estimatedCost = totalSearches * COST_PER_SEARCH

    // Sample queries for preview
    const exampleQueries = queries.slice(0, 5).map(q => q.query)

    return {
      totalQueries: queries.length,
      totalSearches,
      estimatedCost,
      exampleQueries,
    }
  }, [editableConfig, configError])

  // Load URLs when we have a jobId and need to show them
  const loadUrls = useCallback(async (jid: string) => {
    setLoadingUrls(true)
    setError(null)
    try {
      // Use /urls/summary endpoint which groups URLs by source_type
      const response = await fetch(`/api/niche-finder/jobs/${jid}/urls/summary`)
      if (!response.ok) throw new Error('Error cargando URLs')
      const data = await response.json()

      // Convert API response to UrlSummary format
      const summaries: UrlSummary[] = (data.sources || []).map((source: {
        source_type: string
        count: number
        sampleUrls: Array<{ id: string; url: string; title?: string; life_context?: string; product_word?: string }>
      }) => ({
        source: source.source_type,
        count: source.count,
        urls: source.sampleUrls.map(u => ({
          id: u.id,
          url: u.url,
          title: u.title,
          life_context: u.life_context,
          product_word: u.product_word,
        })),
        selected: true, // All selected by default
      }))

      setUrlsBySource(summaries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando URLs')
    } finally {
      setLoadingUrls(false)
    }
  }, [])

  // Load all scraped URLs with content
  const loadAllScrapedUrls = useCallback(async (jid: string) => {
    setLoadingAllUrls(true)
    try {
      const response = await fetch(`/api/niche-finder/jobs/${jid}/urls/scraped?limit=1000&status=scraped`)
      if (!response.ok) throw new Error('Error cargando URLs')
      const data = await response.json()
      const urls = (data.urls || []).map((u: {
        id: string
        url: string
        title?: string
        content_markdown?: string
        word_count?: number
        life_context?: string
        product_word?: string
        status?: string
      }) => ({
        id: u.id,
        url: u.url,
        title: u.title,
        content_markdown: u.content_markdown,
        word_count: u.word_count,
        life_context: u.life_context,
        product_word: u.product_word,
        status: u.status,
      }))
      setAllScrapedUrls(urls)
      setShowAllUrlsModal(true)
    } catch (err) {
      console.error('Error loading all URLs:', err)
      setError(err instanceof Error ? err.message : 'Error cargando URLs')
    } finally {
      setLoadingAllUrls(false)
    }
  }, [])

  // Save scraped content to Context Lake
  const handleSaveToContextLake = useCallback(async () => {
    if (!jobId || !projectId) return
    setSavingToContextLake(true)
    try {
      // Get client ID for the project
      const clientId = await getProjectClientId(projectId)
      if (!clientId) {
        throw new Error('No se pudo obtener el cliente del proyecto')
      }

      // Fetch all scraped content
      const response = await fetch(`/api/niche-finder/jobs/${jobId}/urls/scraped?limit=1000&status=scraped`)
      if (!response.ok) throw new Error('Error cargando contenido scrapeado')
      const data = await response.json()

      const scrapedData = (data.urls || [])
        .filter((u: { content_markdown?: string }) => u.content_markdown)
        .map((u: { url: string; content_markdown: string; title?: string }) => ({
          url: u.url,
          markdown: u.content_markdown,
          title: u.title,
        }))

      if (scrapedData.length === 0) {
        throw new Error('No hay contenido scrapeado para guardar')
      }

      // Create save context
      const saveContext: NicheFinderSaveContext = {
        projectId,
        clientId,
        userId: 'system', // TODO: get actual user ID from session
        campaignId: jobId,
        campaignName: `Niche Finder Job ${jobId.slice(0, 8)}`,
        jobId,
      }

      // Save to Context Lake
      const result = await saveScrapedContentToContextLake(scrapedData, {
        context: saveContext,
        stepId: 'scrape',
        stepName: 'Scraping de Conversaciones',
        stepOrder: 2,
      })

      if (!result.success) {
        throw new Error(result.error || 'Error guardando en Context Lake')
      }

      setContextLakeSaved(true)
      console.log('[Context Lake] Content saved successfully:', result.documentId)
    } catch (err) {
      console.error('Error saving to Context Lake:', err)
      setError(err instanceof Error ? err.message : 'Error guardando en Context Lake')
    } finally {
      setSavingToContextLake(false)
    }
  }, [jobId, projectId])

  // Load previous jobs with URLs
  const loadPreviousJobs = useCallback(async () => {
    if (!projectId) return
    setLoadingPreviousJobs(true)
    try {
      const response = await fetch(`/api/niche-finder/jobs?project_id=${projectId}&with_urls=true&limit=20`)
      if (!response.ok) throw new Error('Error cargando trabajos anteriores')
      const data = await response.json()
      setPreviousJobs(data.jobs || [])
    } catch (err) {
      console.error('Error loading previous jobs:', err)
    } finally {
      setLoadingPreviousJobs(false)
    }
  }, [projectId])

  // Load a previous job's URLs
  const handleLoadPreviousJob = async (previousJobId: string) => {
    setJobId(previousJobId)
    setShowPreviousJobs(false)
    setInternalPhase('serp_complete')
    setUserNavigatedBack(true)
    await loadUrls(previousJobId)
  }

  // When jobId changes or phase becomes serp_complete, load URLs
  useEffect(() => {
    if (jobId && (phase === 'serp_complete' || phase === 'preview') && urlsBySource.length === 0) {
      loadUrls(jobId)
    }
  }, [jobId, phase, loadUrls, urlsBySource.length])

  // Periodically check job status when executing SERP, scraping, or extracting
  useEffect(() => {
    if (!jobId) return
    // Only poll during active execution phases
    if (!['serp_executing', 'scraping', 'extracting'].includes(phase)) return

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
        if (!response.ok) return
        const data = await response.json()
        const jobStatus = data.job?.status

        // Update scraping progress if available
        if (data.progress?.scraping) {
          setScrapingProgress({
            total: data.progress.scraping.total || 0,
            completed: data.progress.scraping.completed || 0,
            failed: data.progress.scraping.failed || 0,
          })
        }

        // Handle SERP completion
        if (phase === 'serp_executing') {
          if (jobStatus === 'serp_done' || jobStatus === 'serp_completed') {
            setInternalPhase('serp_complete')
            await loadUrls(jobId)
          } else if (jobStatus === 'failed') {
            setInternalPhase('error')
            setError(data.job?.error || 'SERP falló')
          }
        }

        // Handle scraping completion
        if (phase === 'scraping') {
          if (jobStatus === 'scrape_done') {
            setInternalPhase('scrape_done')
            await loadUrls(jobId) // Refresh URLs with scraped counts
          } else if (jobStatus === 'extracting') {
            // Started extraction automatically - shouldn't happen with new flow
            setInternalPhase('extracting')
          } else if (jobStatus === 'failed') {
            setInternalPhase('error')
            setError(data.job?.error || 'Scraping falló')
          }
        }

        // Handle extraction completion
        if (phase === 'extracting') {
          if (jobStatus === 'completed') {
            setInternalPhase('completed')
          } else if (jobStatus === 'failed') {
            setInternalPhase('error')
            setError(data.job?.error || 'Extracción falló')
          }
        }
      } catch {
        // Ignore polling errors
      }
    }

    // Check immediately
    checkStatus()

    const interval = setInterval(checkStatus, 2000)
    return () => clearInterval(interval)
  }, [phase, jobId, loadUrls])

  // Fetch extracted niches during analysis/completed phases
  const fetchExtractedNiches = useCallback(async (jid: string) => {
    try {
      const response = await fetch(`/api/niche-finder/jobs/${jid}/extracted?limit=100`)
      if (!response.ok) return
      const data = await response.json()
      setExtractedNiches(data.niches || [])
      setExtractionStats(data.stats || null)
    } catch (err) {
      console.error('[ExtractedNiches] Error fetching:', err)
    }
  }, [])

  // Poll for extracted niches during extracting phase
  useEffect(() => {
    if (!jobId) return
    // Only poll during extracting phase, also fetch once on completed
    if (phase !== 'extracting' && phase !== 'completed') {
      // Reset niches when going back to earlier phases
      if (phase === 'preview' || phase === 'serp_complete' || phase === 'scrape_done') {
        setExtractedNiches([])
        setExtractionStats(null)
      }
      return
    }

    // Fetch immediately
    fetchExtractedNiches(jobId)

    // Only continue polling during extracting phase
    if (phase !== 'extracting') return

    const interval = setInterval(() => fetchExtractedNiches(jobId), 3000)
    return () => clearInterval(interval)
  }, [phase, jobId, fetchExtractedNiches])

  // Total URLs and analysis cost
  const totalUrls = useMemo(() => {
    return urlsBySource
      .filter(s => s.selected)
      .reduce((sum, s) => sum + s.count, 0)
  }, [urlsBySource])

  const analysisCost = useMemo(() => {
    return totalUrls * (COST_PER_URL_SCRAPE + COST_PER_URL_EXTRACT)
  }, [totalUrls])

  // Toggle source selection
  const toggleSource = (source: string) => {
    setUrlsBySource(prev =>
      prev.map(s => s.source === source ? { ...s, selected: !s.selected } : s)
    )
  }

  // Execute SERP
  const handleExecuteSerp = async () => {
    if (configError) return
    setInternalPhase('serp_executing')
    setError(null)
    try {
      await onExecuteSerp(editableConfig)
      // The parent will update jobId through props or state
    } catch (err) {
      setInternalPhase('error')
      setError(err instanceof Error ? err.message : 'Error en búsqueda')
    }
  }

  // Execute Scraping (download content from URLs)
  const handleExecuteScraping = async () => {
    if (!jobId) return
    setInternalPhase('scraping')
    setScrapingProgress(null)
    setError(null)
    try {
      const selectedSources = urlsBySource
        .filter(s => s.selected)
        .map(s => s.source)
      // Start scraping only (not extraction)
      await fetch(`/api/niche-finder/jobs/${jobId}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: selectedSources }),
      })
      // Polling will detect when scraping is done
    } catch (err) {
      setInternalPhase('error')
      setError(err instanceof Error ? err.message : 'Error en scraping')
    }
  }

  // Execute Extraction (analyze scraped content with LLM)
  const handleExecuteExtraction = async () => {
    if (!jobId) return
    setInternalPhase('extracting')
    setError(null)
    try {
      // Pass custom extraction prompt if modified
      const customPrompt = extractionPrompt !== EXTRACTION_PROMPT ? extractionPrompt : undefined
      await fetch(`/api/niche-finder/jobs/${jobId}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraction_prompt: customPrompt,
        }),
      })
      // Polling will detect when extraction is done
    } catch (err) {
      setInternalPhase('error')
      setError(err instanceof Error ? err.message : 'Error en extracción')
    }
  }

  // Execute Analysis (scrape + extract) - for backward compatibility
  const handleExecuteAnalysis = async () => {
    if (!jobId) return
    setInternalPhase('scraping')
    setScrapingProgress(null)
    setError(null)
    try {
      const selectedSources = urlsBySource
        .filter(s => s.selected)
        .map(s => s.source)
      // Pass custom extraction prompt if modified
      const customPrompt = extractionPrompt !== EXTRACTION_PROMPT ? extractionPrompt : undefined
      await onExecuteAnalysis(jobId, selectedSources, customPrompt)
    } catch (err) {
      setInternalPhase('error')
      setError(err instanceof Error ? err.message : 'Error en análisis')
    }
  }

  // Render based on phase
  const renderContent = () => {
    // Phase: Preview (show SERP config)
    if (phase === 'preview' && urlsBySource.length === 0) {
      return (
        <div className="space-y-4">
          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <Search size={14} />
                <span>Consultas</span>
              </div>
              <p className="text-xl font-semibold text-gray-900">
                {serpStats.totalQueries.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <FileText size={14} />
                <span>Búsquedas</span>
              </div>
              <p className="text-xl font-semibold text-gray-900">
                {serpStats.totalSearches.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <DollarSign size={14} />
                <span>Costo est.</span>
              </div>
              <p className="text-xl font-semibold text-gray-900">
                ${serpStats.estimatedCost.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Query examples */}
          {serpStats.exampleQueries.length > 0 && (
            <div>
              <button
                onClick={() => setShowQueryExamples(!showQueryExamples)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                {showQueryExamples ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Ver ejemplos de consultas
              </button>
              {showQueryExamples && (
                <div className="mt-2 bg-gray-50 rounded-lg p-3 space-y-1">
                  {serpStats.exampleQueries.map((q, i) => (
                    <p key={i} className="text-sm text-gray-700 font-mono">{q}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Load previous jobs */}
          {projectId && (
            <div className="border-t border-gray-200 pt-4">
              <button
                onClick={() => {
                  setShowPreviousJobs(!showPreviousJobs)
                  if (!showPreviousJobs && previousJobs.length === 0) {
                    loadPreviousJobs()
                  }
                }}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                {showPreviousJobs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <History size={16} />
                Usar búsquedas anteriores
              </button>
              {showPreviousJobs && (
                <div className="mt-3 space-y-2">
                  {loadingPreviousJobs ? (
                    <div className="flex items-center gap-2 text-gray-500 text-sm p-3">
                      <Loader2 size={16} className="animate-spin" />
                      Cargando trabajos anteriores...
                    </div>
                  ) : previousJobs.length === 0 ? (
                    <p className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                      No hay búsquedas anteriores con URLs disponibles
                    </p>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-2 max-h-60 overflow-y-auto space-y-2">
                      {previousJobs.map(job => (
                        <button
                          key={job.id}
                          onClick={() => handleLoadPreviousJob(job.id)}
                          className="w-full text-left bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">
                              {new Date(job.created_at).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              job.status === 'completed' ? 'bg-green-100 text-green-700' :
                              job.status === 'serp_done' ? 'bg-blue-100 text-blue-700' :
                              job.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {job.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="flex items-center gap-1 text-blue-600">
                              <Database size={14} />
                              <strong>{job.urls_found}</strong> URLs
                            </span>
                            {job.urls_scraped > 0 && (
                              <span className="text-gray-500">
                                {job.urls_scraped} scrapeadas
                              </span>
                            )}
                            {job.niches_extracted > 0 && (
                              <span className="text-green-600">
                                {job.niches_extracted} nichos
                              </span>
                            )}
                          </div>
                          {job.config && (
                            <p className="text-xs text-gray-400 mt-1 truncate">
                              {(job.config as { life_contexts?: string[] }).life_contexts?.slice(0, 2).join(', ')}
                              {((job.config as { life_contexts?: string[] }).life_contexts?.length || 0) > 2 && '...'}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {configError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {configError}
              </p>
            </div>
          )}

          {/* Execute button */}
          <div className="flex justify-between items-center pt-2">
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                ← Anterior
              </button>
            )}
            <button
              onClick={handleExecuteSerp}
              disabled={!!configError}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Play size={18} />
              Buscar Conversaciones
            </button>
          </div>
        </div>
      )
    }

    // Phase: SERP Executing
    if (phase === 'serp_executing') {
      return (
        <div className="space-y-4">
          <StepExecutionProgress
            executionType="search"
            status="running"
            title="Buscando conversaciones..."
            actionText={serpProgress?.label || 'Iniciando búsqueda SERP...'}
            progress={serpProgress ? {
              current: serpProgress.current,
              total: serpProgress.total,
              label: 'búsquedas',
            } : undefined}
            onCancel={onCancel}
          />
        </div>
      )
    }

    // Phase: SERP Complete or URLs loaded - Show URLs and analysis button
    if (phase === 'serp_complete' || urlsBySource.length > 0) {
      return (
        <div className="space-y-4">
          {/* URLs found summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <Check size={20} />
              <span className="font-medium">
                {totalUrls} URLs encontradas
              </span>
            </div>
          </div>

          {/* URL sources */}
          {loadingUrls ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="animate-spin mr-2" size={20} />
              Cargando URLs...
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 font-medium">
                Selecciona las fuentes a analizar:
              </p>
              {urlsBySource.map(source => (
                <div
                  key={source.source}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <div
                    className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer"
                    onClick={() => toggleSource(source.source)}
                  >
                    <button
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        source.selected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-gray-300'
                      }`}
                    >
                      {source.selected && <Check size={14} />}
                    </button>
                    <Globe size={16} className="text-gray-500" />
                    <span className="flex-1 font-medium text-gray-800">{source.source}</span>
                    <span className="text-sm text-gray-500">{source.count} URLs</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedSources(prev => {
                          const next = new Set(prev)
                          if (next.has(source.source)) next.delete(source.source)
                          else next.add(source.source)
                          return next
                        })
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedSources.has(source.source) ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>
                  </div>
                  {expandedSources.has(source.source) && (
                    <div className="px-4 py-2 bg-white border-t border-gray-100 max-h-48 overflow-y-auto">
                      {source.urls.slice(0, 10).map((urlInfo, i) => (
                        <div key={urlInfo.id || i} className="flex items-center gap-2 py-1.5 text-xs text-gray-600 group">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setViewingUrlId(urlInfo.id)
                            }}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Ver contenido scrapeado"
                          >
                            <Eye size={14} />
                          </button>
                          <span className="truncate flex-1">{urlInfo.title || urlInfo.url}</span>
                          <a
                            href={urlInfo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Abrir en nueva pestaña"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      ))}
                      {source.count > 10 && (
                        <p className="text-xs text-gray-400 py-1 pl-7">
                          +{source.count - 10} más URLs disponibles
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions: View all URLs, Save to Context Lake */}
          <div className="flex items-center gap-3 py-2">
            <button
              onClick={() => jobId && loadAllScrapedUrls(jobId)}
              disabled={!jobId || loadingAllUrls}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              {loadingAllUrls ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FolderOpen size={16} />
              )}
              Ver todas las URLs scrapeadas
            </button>
            <button
              onClick={handleSaveToContextLake}
              disabled={!jobId || savingToContextLake || contextLakeSaved}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                contextLakeSaved
                  ? 'bg-green-100 text-green-700'
                  : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
              } disabled:opacity-50`}
            >
              {savingToContextLake ? (
                <Loader2 size={16} className="animate-spin" />
              ) : contextLakeSaved ? (
                <Check size={16} />
              ) : (
                <Save size={16} />
              )}
              {contextLakeSaved ? 'Guardado en Context Lake' : 'Guardar en Context Lake'}
            </button>
          </div>

          {/* What scraping does - explanation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">¿Qué hace el scraping?</p>
                <p className="text-blue-700">
                  Descarga el contenido de cada URL y lo convierte a texto.
                  Después podrás revisar el contenido y ejecutar la extracción de problemas por separado.
                </p>
              </div>
            </div>
          </div>

          {/* Scraping cost */}
          <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{totalUrls}</span> URLs ×
              <span className="text-gray-400"> scraping</span>
            </div>
            <div className="flex items-center gap-1 text-gray-700">
              <DollarSign size={14} />
              <span className="font-semibold">${(totalUrls * COST_PER_URL_SCRAPE).toFixed(2)}</span>
            </div>
          </div>

          {/* Execute scraping button */}
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => {
                setUrlsBySource([])
                setJobId(null)
                setInternalPhase('preview')
                onResetPhase?.() // Notify parent to reset external phase
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              ← Modificar búsqueda
            </button>
            <button
              onClick={handleExecuteScraping}
              disabled={totalUrls === 0}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download size={18} />
              Descargar {totalUrls} Páginas
            </button>
          </div>
        </div>
      )
    }

    // Phase: Scraping (downloading content)
    if (phase === 'scraping') {
      const scrapingPartialResults: PartialResults | undefined = scrapingProgress ? {
        successCount: scrapingProgress.completed - scrapingProgress.failed,
        failedCount: scrapingProgress.failed,
      } : undefined

      return (
        <div className="space-y-4">
          <StepExecutionProgress
            executionType="scrape"
            status="running"
            title="Descargando contenido..."
            actionText={scrapingProgress
              ? `Procesando URL ${scrapingProgress.completed} de ${scrapingProgress.total}`
              : 'Iniciando scraping...'}
            progress={scrapingProgress ? {
              current: scrapingProgress.completed,
              total: scrapingProgress.total,
              label: 'URLs',
            } : undefined}
            partialResults={scrapingPartialResults}
            onCancel={onCancel}
          />
        </div>
      )
    }

    // Phase: Scrape Done (ready for extraction)
    if (phase === 'scrape_done') {
      return (
        <div className="space-y-4">
          {/* Scraping complete summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <Check size={20} />
              <span className="font-medium">
                Scraping completado: {scrapingProgress?.completed || extractionStats?.urls_scraped || 0} URLs descargadas
              </span>
            </div>
            {scrapingProgress?.failed && scrapingProgress.failed > 0 && (
              <p className="text-sm text-amber-600 mt-1">
                {scrapingProgress.failed} URLs no pudieron descargarse
              </p>
            )}
          </div>

          {/* Actions: View all URLs, Save to Context Lake */}
          <div className="flex items-center gap-3 py-2">
            <button
              onClick={() => jobId && loadAllScrapedUrls(jobId)}
              disabled={!jobId || loadingAllUrls}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              {loadingAllUrls ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FolderOpen size={16} />
              )}
              Ver contenido scrapeado
            </button>
            <button
              onClick={handleSaveToContextLake}
              disabled={!jobId || savingToContextLake || contextLakeSaved}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                contextLakeSaved
                  ? 'bg-green-100 text-green-700'
                  : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
              } disabled:opacity-50`}
            >
              {savingToContextLake ? (
                <Loader2 size={16} className="animate-spin" />
              ) : contextLakeSaved ? (
                <Check size={16} />
              ) : (
                <Save size={16} />
              )}
              {contextLakeSaved ? 'Guardado en Context Lake' : 'Guardar en Context Lake'}
            </button>
          </div>

          {/* What extraction does - explanation */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info size={18} className="text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-purple-800">
                <p className="font-medium mb-1">Siguiente paso: Extracción con IA</p>
                <p className="text-purple-700">
                  Analiza el contenido descargado con IA para identificar problemas y necesidades reales de tu audiencia.
                </p>
              </div>
            </div>
          </div>

          {/* Extraction prompt editor */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowPromptEditor(!showPromptEditor)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2 text-gray-700">
                <Settings size={16} />
                <span className="font-medium text-sm">Prompt de extracción</span>
                {extractionPrompt !== EXTRACTION_PROMPT && (
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                    Modificado
                  </span>
                )}
              </div>
              {showPromptEditor ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showPromptEditor && (
              <div className="p-4 bg-white border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">
                  Este prompt se usa para extraer problemas de cada página. Variables disponibles:{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{product}}'}</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{target}}'}</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{industry}}'}</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{content}}'}</code>
                </p>
                <textarea
                  value={extractionPrompt}
                  onChange={(e) => setExtractionPrompt(e.target.value)}
                  className="w-full h-64 p-3 text-xs font-mono border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-y"
                  placeholder="Prompt de extracción..."
                />
                <div className="flex justify-between mt-2">
                  <button
                    onClick={() => setExtractionPrompt(EXTRACTION_PROMPT)}
                    disabled={extractionPrompt === EXTRACTION_PROMPT}
                    className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    Restaurar original
                  </button>
                  <span className="text-xs text-gray-400">
                    {extractionPrompt.length} caracteres
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Extraction cost */}
          <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{scrapingProgress?.completed || extractionStats?.urls_scraped || 0}</span> URLs ×
              <span className="text-gray-400"> extracción con IA</span>
            </div>
            <div className="flex items-center gap-1 text-gray-700">
              <DollarSign size={14} />
              <span className="font-semibold">${((scrapingProgress?.completed || extractionStats?.urls_scraped || 0) * COST_PER_URL_EXTRACT).toFixed(2)}</span>
            </div>
          </div>

          {/* Execute extraction button */}
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => {
                setInternalPhase('serp_complete')
                setUserNavigatedBack(true)
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              ← Volver a URLs
            </button>
            <button
              onClick={handleExecuteExtraction}
              disabled={!scrapingProgress?.completed && !extractionStats?.urls_scraped}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Play size={18} />
              Ejecutar Extracción
            </button>
          </div>
        </div>
      )
    }

    // Phase: Extracting (LLM analysis)
    if (phase === 'extracting') {
      const extractionPartialResults: PartialResults | undefined = extractionStats ? {
        itemsFound: extractionStats.niches_extracted,
        successCount: extractionStats.extract_completed,
        failedCount: extractionStats.urls_filtered,
        lastItems: extractedNiches.slice(-3).map(n => n.problem),
      } : undefined

      return (
        <div className="space-y-4">
          <StepExecutionProgress
            executionType="extract"
            status="running"
            title="Extrayendo problemas con IA..."
            actionText={extractionStats
              ? `Analizando URL ${extractionStats.extract_completed} de ${extractionStats.extract_total || extractionStats.urls_scraped}`
              : 'Iniciando extracción...'}
            progress={extractionStats ? {
              current: extractionStats.extract_completed,
              total: extractionStats.extract_total || extractionStats.urls_scraped,
              label: 'URLs analizadas',
            } : undefined}
            partialResults={extractionPartialResults}
            onCancel={onCancel}
            defaultExpanded={extractedNiches.length > 0}
          />

          {/* Live extraction results table */}
          {extractedNiches.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowNichesTable(!showNichesTable)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-purple-600" />
                  <span className="font-medium text-sm text-gray-800">
                    Problemas extraídos ({extractedNiches.length})
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded animate-pulse">
                    En vivo
                  </span>
                </div>
                {showNichesTable ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showNichesTable && (
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-700 w-12">#</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-700">Problema</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-700 w-32">Persona</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-700 w-24">Emoción</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-700 w-32">Fuente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedNiches.map((niche, idx) => (
                        <tr
                          key={niche.id}
                          className={`border-t border-gray-100 ${idx === 0 ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-3 py-2 text-gray-500 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <p className="text-gray-800 line-clamp-2">{niche.problem}</p>
                            {niche.context && (
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{niche.context}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{niche.persona || '-'}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              niche.emotion?.toLowerCase().includes('frustrat') ? 'bg-red-100 text-red-700' :
                              niche.emotion?.toLowerCase().includes('confus') ? 'bg-amber-100 text-amber-700' :
                              niche.emotion?.toLowerCase().includes('preocup') ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {niche.emotion || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {niche.url_info ? (
                              <a
                                href={niche.url_info.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <span className="truncate max-w-[100px]">
                                  {niche.url_info.source_type || 'Link'}
                                </span>
                                <ExternalLink size={10} />
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Stats summary */}
          {extractionStats && (
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="bg-blue-50 rounded p-2 text-center">
                <span className="block text-blue-600 font-semibold">{extractionStats.urls_scraped}</span>
                <span className="text-blue-500">Scrapeadas</span>
              </div>
              <div className="bg-green-50 rounded p-2 text-center">
                <span className="block text-green-600 font-semibold">{extractionStats.niches_extracted}</span>
                <span className="text-green-500">Problemas</span>
              </div>
              <div className="bg-amber-50 rounded p-2 text-center">
                <span className="block text-amber-600 font-semibold">{extractionStats.urls_filtered}</span>
                <span className="text-amber-500">Filtradas</span>
              </div>
              <div className="bg-purple-50 rounded p-2 text-center">
                <span className="block text-purple-600 font-semibold">{extractionStats.extract_completed}/{extractionStats.extract_total || '?'}</span>
                <span className="text-purple-500">Analizadas</span>
              </div>
            </div>
          )}

          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 hover:text-red-600 text-sm"
            >
              Cancelar
            </button>
          )}
        </div>
      )
    }

    // Phase: Completed
    if (phase === 'completed') {
      return (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <Check size={20} />
              <span className="font-medium">Análisis completado</span>
            </div>
            {analysisProgress && (
              <div className="mt-2 text-sm text-green-700">
                <p>{analysisProgress.extractedCount || 0} problemas extraídos</p>
                {(analysisProgress.filteredCount || 0) > 0 && (
                  <p className="text-amber-700">
                    {analysisProgress.filteredCount} URLs filtradas (sin contenido relevante)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Full extraction results table */}
          {extractedNiches.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowNichesTable(!showNichesTable)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-green-600" />
                  <span className="font-medium text-sm text-gray-800">
                    Problemas extraídos ({extractedNiches.length})
                  </span>
                </div>
                {showNichesTable ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showNichesTable && (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-700 w-12">#</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-700">Problema</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-700 w-32">Persona</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-700 w-24">Emoción</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-700 w-32">Fuente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedNiches.map((niche, idx) => (
                        <tr
                          key={niche.id}
                          className="border-t border-gray-100 hover:bg-gray-50"
                        >
                          <td className="px-3 py-2 text-gray-500 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <p className="text-gray-800 line-clamp-2">{niche.problem}</p>
                            {niche.context && (
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{niche.context}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{niche.persona || '-'}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              niche.emotion?.toLowerCase().includes('frustrat') ? 'bg-red-100 text-red-700' :
                              niche.emotion?.toLowerCase().includes('confus') ? 'bg-amber-100 text-amber-700' :
                              niche.emotion?.toLowerCase().includes('preocup') ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {niche.emotion || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {niche.url_info ? (
                              <a
                                href={niche.url_info.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <span className="truncate max-w-[100px]">
                                  {niche.url_info.source_type || 'Link'}
                                </span>
                                <ExternalLink size={10} />
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Stats summary */}
          {extractionStats && (
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="bg-blue-50 rounded p-2 text-center">
                <span className="block text-blue-600 font-semibold">{extractionStats.urls_scraped}</span>
                <span className="text-blue-500">Scrapeadas</span>
              </div>
              <div className="bg-green-50 rounded p-2 text-center">
                <span className="block text-green-600 font-semibold">{extractionStats.niches_extracted}</span>
                <span className="text-green-500">Problemas</span>
              </div>
              <div className="bg-amber-50 rounded p-2 text-center">
                <span className="block text-amber-600 font-semibold">{extractionStats.urls_filtered}</span>
                <span className="text-amber-500">Filtradas</span>
              </div>
              <div className="bg-purple-50 rounded p-2 text-center">
                <span className="block text-purple-600 font-semibold">{extractionStats.urls_found}</span>
                <span className="text-purple-500">Total URLs</span>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => onComplete({ jobId: jobId || '', extractedCount: analysisProgress?.extractedCount || 0 })}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              Continuar
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )
    }

    // Phase: Error
    if (phase === 'error') {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle size={20} />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-sm text-red-700">{error || 'Ha ocurrido un error'}</p>
          <button
            onClick={() => {
              setError(null)
              setInternalPhase('preview')
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Reintentar
          </button>
        </div>
      )
    }

    return null
  }

  // Determine if we can navigate backwards
  const isExecuting = phase === 'serp_executing' || phase === 'scraping' || phase === 'extracting'
  // Can go to config from any non-preview phase (including during execution - will cancel)
  const canGoToConfig = phase !== 'preview'
  // Can go to search from scraping onwards (will cancel if scraping)
  const canGoToSearch = ['scraping', 'scrape_done', 'extracting', 'completed'].includes(phase)
  // Can go to scrape results from extracting or completed
  const canGoToScrapeResults = phase === 'extracting' || phase === 'completed'

  // Navigation helper to go back to a specific phase
  const handleNavigateToConfig = () => {
    if (!canGoToConfig) return
    // If executing, this will effectively cancel the operation
    if (isExecuting) {
      console.log('[UnifiedSearchExtract] Cancelling execution to go back to config')
    }
    // Reset everything and go back to config
    setUrlsBySource([])
    setJobId(null)
    setInternalPhase('preview')
    setUserNavigatedBack(true) // Override external phase until parent syncs
    setError(null)
    setScrapingProgress(null)
    onResetPhase?.()
    onCancel?.() // Notify parent to cancel any ongoing operation
  }

  const handleNavigateToSearch = () => {
    if (!canGoToSearch) return
    // If scraping, this will cancel but may leave partial scraped content
    if (phase === 'scraping') {
      console.log('[UnifiedSearchExtract] Cancelling scraping to go back to URL selection')
    }
    // Go back to URL selection (keep URLs if available)
    setInternalPhase('serp_complete')
    setUserNavigatedBack(true) // Override external phase until parent syncs
    setError(null)
    // Don't call onResetPhase here - we want to keep the job and URLs
  }

  const handleNavigateToScrapeResults = () => {
    if (!canGoToScrapeResults) return
    // If extracting, this will cancel extraction but keep scraped content
    if (phase === 'extracting') {
      console.log('[UnifiedSearchExtract] Cancelling extraction to go back to scrape results')
    }
    // Go back to scrape results
    setInternalPhase('scrape_done')
    setUserNavigatedBack(true) // Override external phase until parent syncs
    setError(null)
    // Don't call onResetPhase - we want to keep the scraped content
  }

  return (
    <div className="space-y-4">
      {/* URL Content Viewer Modal */}
      {viewingUrlId && jobId && (
        <ScrapedContentViewer
          jobId={jobId}
          urlId={viewingUrlId}
          onClose={() => setViewingUrlId(null)}
        />
      )}

      {/* All Scraped URLs Modal */}
      {showAllUrlsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAllUrlsModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col m-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  URLs Scrapeadas ({allScrapedUrls.length})
                </h2>
                <p className="text-sm text-gray-500">
                  Contenido descargado de conversaciones encontradas
                </p>
              </div>
              <button
                onClick={() => setShowAllUrlsModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {allScrapedUrls.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay contenido scrapeado disponible
                </div>
              ) : (
                <div className="space-y-2">
                  {allScrapedUrls.map((url, idx) => (
                    <div
                      key={url.id}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 group"
                    >
                      <span className="text-xs text-gray-400 w-8">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {url.title || url.url}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{url.url}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{url.word_count?.toLocaleString() || 0} palabras</span>
                        {url.life_context && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {url.life_context}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setShowAllUrlsModal(false)
                          setViewingUrlId(url.id)
                        }}
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Ver contenido"
                      >
                        <Eye size={16} />
                      </button>
                      <a
                        href={url.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Abrir en nueva pestaña"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
              <p className="text-xs text-gray-500">
                Total: {allScrapedUrls.reduce((sum, u) => sum + (u.word_count || 0), 0).toLocaleString()} palabras
              </p>
              <button
                onClick={() => setShowAllUrlsModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase indicator - clickable breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2 flex-wrap">
        <button
          type="button"
          onClick={handleNavigateToConfig}
          disabled={!canGoToConfig}
          title={isExecuting ? 'Cancelar y volver a configurar' : undefined}
          className={`transition-colors ${
            phase === 'preview'
              ? 'text-blue-600 font-medium'
              : canGoToConfig
                ? isExecuting
                  ? 'text-red-500 hover:text-red-600 hover:underline cursor-pointer'
                  : 'text-gray-500 hover:text-blue-600 hover:underline cursor-pointer'
                : 'text-gray-400'
          }`}
        >
          1. Configurar
        </button>
        <span>→</span>
        <button
          type="button"
          onClick={handleNavigateToSearch}
          disabled={!canGoToSearch}
          title={phase === 'scraping' ? 'Cancelar scraping y volver a URLs' : undefined}
          className={`transition-colors ${
            phase === 'serp_executing' || phase === 'serp_complete'
              ? 'text-blue-600 font-medium'
              : canGoToSearch
                ? phase === 'scraping'
                  ? 'text-amber-500 hover:text-amber-600 hover:underline cursor-pointer'
                  : 'text-gray-500 hover:text-blue-600 hover:underline cursor-pointer'
                : 'text-gray-400'
          }`}
        >
          2. Buscar
        </button>
        <span>→</span>
        <button
          type="button"
          onClick={handleNavigateToScrapeResults}
          disabled={!canGoToScrapeResults}
          title={phase === 'extracting' ? 'Cancelar extracción y volver a scraping' : undefined}
          className={`transition-colors ${
            phase === 'scraping' || phase === 'scrape_done'
              ? 'text-blue-600 font-medium'
              : canGoToScrapeResults
                ? phase === 'extracting'
                  ? 'text-amber-500 hover:text-amber-600 hover:underline cursor-pointer'
                  : 'text-gray-500 hover:text-blue-600 hover:underline cursor-pointer'
                : 'text-gray-400'
          }`}
        >
          3. Descargar
        </button>
        <span>→</span>
        <span className={phase === 'extracting' ? 'text-purple-600 font-medium' : ''}>
          4. Extraer
        </span>
        <span>→</span>
        <span className={phase === 'completed' ? 'text-green-600 font-medium' : ''}>
          5. Resultados
        </span>
      </div>

      {renderContent()}
    </div>
  )
}

export default UnifiedSearchExtractPanel
