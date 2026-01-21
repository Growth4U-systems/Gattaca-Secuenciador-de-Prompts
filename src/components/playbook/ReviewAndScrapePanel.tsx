'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Check,
  X,
  Globe,
  Loader2,
  Play,
  AlertCircle,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface UrlSummary {
  source: string
  count: number
  urls: string[]
  selected: boolean
}

interface ReviewAndScrapePanelProps {
  jobId?: string // SERP job ID to fetch URLs from (optional, can be fetched from projectId)
  projectId?: string // Project ID to fetch latest job from if jobId not provided
  onExecute: (selectedUrls: string[]) => void
  onBack: () => void
  isExecuting?: boolean
  progress?: {
    current: number
    total: number
    label?: string
    successCount?: number
    failedCount?: number
    lastUrl?: string // Last URL being scraped
    lastSnippet?: string // Content snippet from last scrape
  }
}

const COST_PER_URL = 0.001 // Firecrawl approximate cost

export function ReviewAndScrapePanel({
  jobId: initialJobId,
  projectId,
  onExecute,
  onBack,
  isExecuting = false,
  progress,
}: ReviewAndScrapePanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [urlsBySource, setUrlsBySource] = useState<UrlSummary[]>([])
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())
  const [resolvedJobId, setResolvedJobId] = useState<string | null>(initialJobId || null)

  // First, resolve jobId if not provided but projectId is available
  useEffect(() => {
    const resolveJobId = async () => {
      console.log('[ReviewPanel] resolveJobId called, initialJobId:', initialJobId, 'projectId:', projectId)

      if (initialJobId) {
        console.log('[ReviewPanel] Using initialJobId:', initialJobId)
        setResolvedJobId(initialJobId)
        return
      }

      if (!projectId) {
        console.log('[ReviewPanel] No projectId available')
        setError('No se puede cargar URLs: falta jobId o projectId')
        setLoading(false)
        return
      }

      try {
        // Fetch latest job for this project
        console.log('[ReviewPanel] Fetching job for projectId:', projectId)
        const response = await fetch(`/api/niche-finder/jobs?project_id=${projectId}&status=serp_done&limit=1`)
        if (!response.ok) {
          throw new Error('Error buscando job del proyecto')
        }
        const data = await response.json()
        console.log('[ReviewPanel] Jobs response:', data)
        if (data.jobs && data.jobs.length > 0) {
          console.log('[ReviewPanel] Found job:', data.jobs[0].id)
          setResolvedJobId(data.jobs[0].id)
        } else {
          console.log('[ReviewPanel] No jobs found')
          setError('No se encontró un job SERP completado para este proyecto')
          setLoading(false)
        }
      } catch (err) {
        console.error('[ReviewPanel] Error resolving job:', err)
        setError(err instanceof Error ? err.message : 'Error buscando job')
        setLoading(false)
      }
    }

    resolveJobId()
  }, [initialJobId, projectId])

  // Fetch URL summary from API
  useEffect(() => {
    const fetchUrls = async () => {
      console.log('[ReviewPanel] fetchUrls called, resolvedJobId:', resolvedJobId)
      if (!resolvedJobId) return

      try {
        setLoading(true)
        setError(null)

        console.log('[ReviewPanel] Fetching URLs for job:', resolvedJobId)
        const response = await fetch(`/api/niche-finder/jobs/${resolvedJobId}/urls/summary`)
        if (!response.ok) {
          throw new Error('Error cargando URLs')
        }

        const data = await response.json()
        console.log('[ReviewPanel] URLs response:', data)

        // Transform to our format - all sources selected by default
        // API returns { sources: [{ source_type, count, sampleUrls }] }
        const summaries: UrlSummary[] = (data.sources || []).map(
          (source: { source_type: string; count: number; sampleUrls: { url: string }[] }) => ({
            source: source.source_type,
            count: source.count,
            urls: source.sampleUrls.map((u: { url: string }) => u.url),
            selected: true,
          })
        )

        console.log('[ReviewPanel] Summaries:', summaries)
        setUrlsBySource(summaries)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    if (resolvedJobId) {
      fetchUrls()
    }
  }, [resolvedJobId])

  // Calculate totals
  const stats = useMemo(() => {
    const selectedSources = urlsBySource.filter((s) => s.selected)
    const totalUrls = urlsBySource.reduce((sum, s) => sum + s.count, 0)
    const selectedUrls = selectedSources.reduce((sum, s) => sum + s.count, 0)
    const estimatedCost = selectedUrls * COST_PER_URL
    const estimatedTimeMinutes = Math.ceil(selectedUrls * 0.5 / 60) // ~0.5s per URL

    return {
      totalUrls,
      selectedUrls,
      estimatedCost,
      estimatedTimeMinutes,
      selectedSources: selectedSources.length,
      totalSources: urlsBySource.length,
    }
  }, [urlsBySource])

  // Get all selected URLs
  const getSelectedUrls = () => {
    return urlsBySource
      .filter((s) => s.selected)
      .flatMap((s) => s.urls)
  }

  // Toggle source selection
  const toggleSource = (source: string) => {
    setUrlsBySource((prev) =>
      prev.map((s) => (s.source === source ? { ...s, selected: !s.selected } : s))
    )
  }

  // Toggle source expansion
  const toggleExpanded = (source: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev)
      if (next.has(source)) {
        next.delete(source)
      } else {
        next.add(source)
      }
      return next
    })
  }

  // Select/deselect all
  const selectAll = (selected: boolean) => {
    setUrlsBySource((prev) => prev.map((s) => ({ ...s, selected })))
  }

  // Format source name for display
  const formatSourceName = (source: string): string => {
    // Extract domain from full URL or source identifier
    try {
      if (source.includes('reddit.com')) return 'Reddit'
      if (source.includes('forocoches')) return 'Forocoches'
      if (source.includes('mediavida')) return 'Mediavida'
      if (source.includes('burbuja')) return 'Burbuja.info'
      // Try to extract domain
      const url = new URL(source.startsWith('http') ? source : `https://${source}`)
      return url.hostname.replace('www.', '')
    } catch {
      return source
    }
  }

  // Get source icon/color
  const getSourceColor = (source: string): string => {
    if (source.includes('reddit')) return 'bg-orange-100 text-orange-700 border-orange-200'
    if (source.includes('forocoches') || source.includes('mediavida'))
      return 'bg-blue-100 text-blue-700 border-blue-200'
    return 'bg-purple-100 text-purple-700 border-purple-200'
  }

  // Render executing state
  if (isExecuting) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          <div>
            <h3 className="font-semibold text-gray-900">Scrapeando contenido...</h3>
            <p className="text-sm text-gray-500">
              Descargando {stats.selectedUrls.toLocaleString()} URLs
            </p>
          </div>
        </div>

        {progress && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{progress.label || 'Progreso'}</span>
              <span className="text-gray-700 font-medium">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>

            {/* Success/Failed counts */}
            {(progress.successCount !== undefined || progress.failedCount !== undefined) && (
              <div className="flex gap-4 text-sm">
                {progress.successCount !== undefined && (
                  <div className="flex items-center gap-1.5 text-green-700">
                    <Check size={14} />
                    <span>{progress.successCount} exitosos</span>
                  </div>
                )}
                {progress.failedCount !== undefined && progress.failedCount > 0 && (
                  <div className="flex items-center gap-1.5 text-red-600">
                    <AlertCircle size={14} />
                    <span>{progress.failedCount} fallidos</span>
                  </div>
                )}
              </div>
            )}

            {/* Real-time feedback: Last scraped URL and content snippet */}
            {progress.lastUrl && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                <div className="flex items-start gap-2">
                  <Globe size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-500 break-all line-clamp-1">
                    {progress.lastUrl}
                  </p>
                </div>
                {progress.lastSnippet && (
                  <p className="text-sm text-gray-700 line-clamp-2 italic">
                    "{progress.lastSnippet}"
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-700">
            {progress?.lastUrl
              ? 'Extrayendo contenido...'
              : 'Descargando contenido de foros y redes sociales...'}
          </p>
        </div>
      </div>
    )
  }

  // Render loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          <div>
            <h3 className="font-semibold text-gray-900">Cargando URLs...</h3>
            <p className="text-sm text-gray-500">
              Obteniendo resultados de la búsqueda
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Error cargando URLs</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ← Volver
        </button>
      </div>
    )
  }

  // Render empty state
  if (urlsBySource.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">No se encontraron URLs</p>
            <p className="text-sm text-yellow-700 mt-1">
              La búsqueda no encontró resultados. Intenta ajustar los contextos o
              palabras de búsqueda.
            </p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ← Volver a configurar búsqueda
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <Globe className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Revisar URLs Encontradas</h3>
          <p className="text-sm text-gray-500">
            Selecciona las fuentes a scrapear
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Globe className="w-4 h-4" />
            <span className="text-sm">URLs</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats.selectedUrls.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            de {stats.totalUrls.toLocaleString()} encontradas
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Costo</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${stats.estimatedCost.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Firecrawl</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Check className="w-4 h-4" />
            <span className="text-sm">Fuentes</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats.selectedSources}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            de {stats.totalSources} disponibles
          </p>
        </div>
      </div>

      {/* Select all / none */}
      <div className="flex gap-2">
        <button
          onClick={() => selectAll(true)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Seleccionar todas
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={() => selectAll(false)}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          Ninguna
        </button>
      </div>

      {/* Sources list */}
      <div className="space-y-2">
        {urlsBySource.map((source) => (
          <div
            key={source.source}
            className={`border rounded-lg overflow-hidden transition-colors ${
              source.selected ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'
            }`}
          >
            {/* Source header */}
            <div className="flex items-center gap-3 p-3">
              {/* Checkbox */}
              <button
                onClick={() => toggleSource(source.source)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  source.selected
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {source.selected && <Check className="w-3 h-3 text-white" />}
              </button>

              {/* Source info */}
              <div className="flex-1 flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium border ${getSourceColor(
                    source.source
                  )}`}
                >
                  {formatSourceName(source.source)}
                </span>
                <span className="text-sm text-gray-600">
                  {source.count} URLs
                </span>
              </div>

              {/* Expand button */}
              <button
                onClick={() => toggleExpanded(source.source)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {expandedSources.has(source.source) ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>

            {/* Expanded URL list */}
            {expandedSources.has(source.source) && (
              <div className="border-t border-gray-200 bg-white p-3 max-h-48 overflow-y-auto">
                <div className="space-y-1">
                  {source.urls.slice(0, 20).map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-blue-600 hover:text-blue-800 truncate"
                    >
                      {url}
                    </a>
                  ))}
                  {source.urls.length > 20 && (
                    <p className="text-xs text-gray-500 pt-1">
                      ...y {source.urls.length - 20} URLs más
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Warning if nothing selected */}
      {stats.selectedUrls === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Ninguna URL seleccionada</p>
            <p className="text-sm text-yellow-700 mt-1">
              Selecciona al menos una fuente para continuar.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ← Volver
        </button>
        <button
          onClick={() => {
            console.log('[ReviewAndScrapePanel] Scrapear button clicked!')
            console.log('[ReviewAndScrapePanel] Selected sources:', urlsBySource.filter(s => s.selected).map(s => s.source))
            console.log('[ReviewAndScrapePanel] Total selected URLs count:', stats.selectedUrls)
            console.log('[ReviewAndScrapePanel] Sample URLs from getSelectedUrls():', getSelectedUrls().slice(0, 5))
            console.log('[ReviewAndScrapePanel] Calling onExecute with selected sources...')
            // Pass selected source types so the scraper knows which to process
            const selectedSources = urlsBySource.filter(s => s.selected).map(s => s.source)
            onExecute(selectedSources)
          }}
          disabled={stats.selectedUrls === 0}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            stats.selectedUrls === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          <Play className="w-4 h-4" />
          Scrapear {stats.selectedUrls.toLocaleString()} URLs
        </button>
      </div>
    </div>
  )
}
