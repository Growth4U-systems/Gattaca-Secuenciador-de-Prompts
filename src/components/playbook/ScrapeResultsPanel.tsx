'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  RefreshCw,
  FileText,
  ExternalLink,
  HelpCircle,
  CheckSquare,
  Square,
  DollarSign,
} from 'lucide-react'
import MarkdownRenderer from '@/components/common/MarkdownRenderer'

interface ScrapedUrl {
  id: string
  url: string
  title: string
  source_type: string
  status: 'scraped' | 'failed'
  content_markdown: string | null
  word_count: number
  error_message: string | null
  selected: boolean
  life_context?: string
  product_word?: string
}

interface Summary {
  total: number
  scraped: number
  failed: number
  selected: number
  totalWords: number
  selectedWords: number
  estimatedCost: number
}

interface ExtractionProgress {
  current: number
  total: number
  extracted: number
  filtered: number
  label?: string
}

interface ScrapeResultsPanelProps {
  jobId: string
  onContinue: () => void
  onBack: () => void
  onExecuteExtraction?: () => Promise<void>
  isExtracting?: boolean
  extractionProgress?: ExtractionProgress
  onResetExtractionState?: () => void
}

// Source type display names and colors
const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  reddit: { label: 'Reddit', color: 'bg-orange-100 text-orange-800' },
  forum: { label: 'Forum', color: 'bg-blue-100 text-blue-800' },
  quora: { label: 'Quora', color: 'bg-red-100 text-red-800' },
  general: { label: 'Web', color: 'bg-gray-100 text-gray-800' },
}

export function ScrapeResultsPanel({
  jobId,
  onContinue,
  onBack,
  onExecuteExtraction,
  isExtracting = false,
  extractionProgress,
  onResetExtractionState,
}: ScrapeResultsPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [urls, setUrls] = useState<ScrapedUrl[]>([])
  const [failedUrls, setFailedUrls] = useState<ScrapedUrl[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set())
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const LIMIT = 20

  // Fetch URLs
  const fetchUrls = useCallback(async (newOffset = 0, append = false) => {
    try {
      if (newOffset === 0) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const response = await fetch(
        `/api/niche-finder/jobs/${jobId}/urls/scraped?limit=${LIMIT}&offset=${newOffset}`
      )

      if (!response.ok) {
        throw new Error('Error al cargar URLs scrapeadas')
      }

      const data = await response.json()

      // Debug: Log response to see what we're getting
      console.log('[ScrapeResultsPanel] API response:', {
        urlsCount: data.urls?.length,
        failedCount: data.failedUrls?.length,
        summary: data.summary,
        pagination: data.pagination,
      })

      if (append) {
        setUrls(prev => [...prev, ...data.urls])
      } else {
        setUrls(data.urls || [])
        setFailedUrls(data.failedUrls || [])
      }

      setSummary(data.summary)
      setHasMore(data.pagination?.hasMore || false)
      setOffset(newOffset + (data.urls?.length || 0))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchUrls(0, false)
  }, [fetchUrls])

  // Reset stale extraction state if detected
  useEffect(() => {
    if (onResetExtractionState) {
      console.log('[ScrapeResultsPanel] Resetting stale extraction state')
      onResetExtractionState()
    }
  }, [onResetExtractionState])

  // Scroll infinite loading
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || loadingMore || !hasMore) return

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      fetchUrls(offset, true)
    }
  }, [loadingMore, hasMore, offset, fetchUrls])

  // Toggle URL selection
  const toggleSelection = async (urlId: string, selected: boolean) => {
    // Optimistic update
    setUrls(prev => prev.map(u => u.id === urlId ? { ...u, selected } : u))

    try {
      await fetch(`/api/niche-finder/jobs/${jobId}/urls/selection`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlIds: [urlId], selected }),
      })

      // Refresh summary
      const response = await fetch(`/api/niche-finder/jobs/${jobId}/urls/scraped?limit=1`)
      const data = await response.json()
      setSummary(data.summary)
    } catch (err) {
      // Revert on error
      setUrls(prev => prev.map(u => u.id === urlId ? { ...u, selected: !selected } : u))
    }
  }

  // Select/deselect all
  const toggleSelectAll = async (selectAll: boolean) => {
    // Optimistic update
    setUrls(prev => prev.map(u => ({ ...u, selected: selectAll })))

    try {
      await fetch(`/api/niche-finder/jobs/${jobId}/urls/selection`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectAll }),
      })

      // Refresh summary
      const response = await fetch(`/api/niche-finder/jobs/${jobId}/urls/scraped?limit=1`)
      const data = await response.json()
      setSummary(data.summary)
    } catch (err) {
      // Revert on error
      setUrls(prev => prev.map(u => ({ ...u, selected: !selectAll })))
    }
  }

  // Retry failed URLs
  const retryFailed = async () => {
    setRetrying(true)
    try {
      await fetch(`/api/niche-finder/jobs/${jobId}/urls/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      // Refresh list
      await fetchUrls(0, false)
    } catch (err) {
      console.error('Error retrying:', err)
    } finally {
      setRetrying(false)
    }
  }

  // Toggle URL expansion
  const toggleExpanded = (urlId: string) => {
    setExpandedUrls(prev => {
      const next = new Set(prev)
      if (next.has(urlId)) {
        next.delete(urlId)
      } else {
        next.add(urlId)
      }
      return next
    })
  }

  // Get unique source types for filter
  const sourceTypes = [...new Set(urls.map(u => u.source_type))]

  // Filter URLs by source
  const filteredUrls = sourceFilter
    ? urls.filter(u => u.source_type === sourceFilter)
    : urls

  // Calculate selected count for display
  const selectedCount = summary?.selected || urls.filter(u => u.selected).length
  const allSelected = urls.length > 0 && urls.every(u => u.selected)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600">Cargando resultados del scraping...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 mb-6 text-sm">
        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">
          Scraping
        </span>
        <span className="text-gray-400">→</span>
        <span className="px-3 py-1 bg-blue-500 text-white rounded-full font-medium">
          Revisar
        </span>
        <span className="text-gray-400">→</span>
        <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full">
          Extraer
        </span>
      </div>

      {/* Header with explanation */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">Revisa el contenido scrapeado</h3>
            <p className="text-sm text-blue-700 mt-1">
              Selecciona las URLs que quieres analizar. Las no seleccionadas se ignorarán
              en el paso de extracción.
            </p>
          </div>
          <button className="ml-auto text-blue-500 hover:text-blue-700" title="Más información">
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-green-800 font-medium">{summary?.scraped || 0}</span>
          <span className="text-green-600 text-sm">scrapeadas</span>
        </div>
        {(summary?.failed || 0) > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg">
            <X className="w-4 h-4 text-red-600" />
            <span className="text-red-800 font-medium">{summary?.failed || 0}</span>
            <span className="text-red-600 text-sm">fallidas</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
          <FileText className="w-4 h-4 text-gray-600" />
          <span className="text-gray-800 font-medium">
            {(summary?.totalWords || 0).toLocaleString()}
          </span>
          <span className="text-gray-600 text-sm">palabras</span>
        </div>
      </div>

      {/* Source filters */}
      {sourceTypes.length > 1 && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSourceFilter(null)}
            className={`px-3 py-1 rounded-full text-sm transition ${
              !sourceFilter
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          {sourceTypes.map(source => {
            const { label, color } = SOURCE_LABELS[source] || { label: source, color: 'bg-gray-100 text-gray-800' }
            return (
              <button
                key={source}
                onClick={() => setSourceFilter(source)}
                className={`px-3 py-1 rounded-full text-sm transition ${
                  sourceFilter === source
                    ? 'bg-gray-800 text-white'
                    : `${color} hover:opacity-80`
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Select all */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b">
        <button
          onClick={() => toggleSelectAll(!allSelected)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          {allSelected ? (
            <CheckSquare className="w-4 h-4 text-blue-600" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          <span>{allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}</span>
        </button>
        <span className="text-gray-400 text-sm ml-auto">
          {selectedCount} de {summary?.scraped || 0} seleccionadas
        </span>
      </div>

      {/* URL list with scroll */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-y-auto space-y-3 border rounded-lg p-2 bg-gray-50"
        style={{ maxHeight: '400px', minHeight: '150px' }}
      >
        {/* Debug info for development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-400 mb-2">
            Debug: {filteredUrls.length} URLs cargadas, filter: {sourceFilter || 'ninguno'}
          </div>
        )}

        {/* Empty state */}
        {filteredUrls.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No hay URLs para mostrar.</p>
            <p className="text-sm mt-1">Verifica que el scraping se completó correctamente.</p>
          </div>
        )}

        {filteredUrls.map(url => (
          <div
            key={url.id}
            className={`border rounded-lg transition ${
              url.selected ? 'border-blue-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
            }`}
          >
            {/* URL header */}
            <div className="flex items-center gap-3 p-3">
              <button
                onClick={() => toggleSelection(url.id, !url.selected)}
                className="flex-shrink-0"
              >
                {url.selected ? (
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400" />
                )}
              </button>

              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                SOURCE_LABELS[url.source_type]?.color || 'bg-gray-100 text-gray-800'
              }`}>
                {SOURCE_LABELS[url.source_type]?.label || url.source_type}
              </span>

              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">
                  {url.title || url.url}
                </h4>
                <p className="text-xs text-gray-500 truncate">{url.url}</p>
              </div>

              <span className="text-xs text-gray-500 flex-shrink-0">
                {url.word_count.toLocaleString()} palabras
              </span>

              <a
                href={url.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                onClick={() => toggleExpanded(url.id)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                {expandedUrls.has(url.id) ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Expanded content */}
            {expandedUrls.has(url.id) && url.content_markdown && (
              <div className="border-t p-4 bg-gray-50">
                <div className="max-h-[500px] overflow-y-auto prose prose-sm max-w-none">
                  <MarkdownRenderer content={url.content_markdown} />
                </div>
              </div>
            )}
          </div>
        ))}

        {loadingMore && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {/* Failed URLs section */}
      {failedUrls.length > 0 && (
        <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="font-medium text-red-900">
                URLs Fallidas ({failedUrls.length})
              </h3>
            </div>
            <button
              onClick={retryFailed}
              disabled={retrying}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
            >
              {retrying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>Reintentar</span>
            </button>
          </div>
          <div className="space-y-2 max-h-[150px] overflow-y-auto">
            {failedUrls.map(url => (
              <div key={url.id} className="flex items-center gap-2 text-sm">
                <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-gray-700 truncate">{url.url}</span>
                <span className="text-red-600 text-xs flex-shrink-0">
                  {url.error_message || 'Error desconocido'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary section */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
        <h3 className="font-medium text-gray-900 mb-3">Resumen</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>• {selectedCount} URLs seleccionadas de {summary?.scraped || 0}</p>
          <p>• ~{(summary?.selectedWords || 0).toLocaleString()} palabras a procesar</p>
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            <span>Costo estimado: ~${summary?.estimatedCost?.toFixed(2) || '0.00'}</span>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-100">
          <p className="text-sm text-blue-800">
            <strong>Siguiente paso:</strong> Se analizará cada URL buscando problemas,
            frustraciones y necesidades. El LLM filtrará conversaciones no relacionadas
            con tu propuesta de valor y extraerá los pain points relevantes.
          </p>
        </div>
      </div>

      {/* Extraction progress */}
      {isExtracting && extractionProgress && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="font-medium text-blue-800">Extrayendo problemas...</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-blue-700">
              <span>{extractionProgress.label || 'Procesando URLs...'}</span>
              <span>{extractionProgress.current}/{extractionProgress.total}</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: extractionProgress.total > 0
                    ? `${(extractionProgress.current / extractionProgress.total) * 100}%`
                    : '0%'
                }}
              />
            </div>
            <div className="flex gap-4 text-xs text-blue-600 mt-2">
              <span>✓ {extractionProgress.extracted} problemas encontrados</span>
              <span>⊘ {extractionProgress.filtered} URLs filtradas</span>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-between mt-6 pt-4 border-t">
        <button
          onClick={onBack}
          disabled={isExtracting}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          ← Atrás
        </button>
        <button
          onClick={() => setShowConfirmModal(true)}
          disabled={selectedCount === 0 || isExtracting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isExtracting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Extrayendo...
            </>
          ) : (
            <>Extraer de {selectedCount} URLs (~${summary?.estimatedCost?.toFixed(2) || '0.00'}) →</>
          )}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirmar Extracción
            </h3>
            <p className="text-gray-600 mb-4">
              Vas a analizar {selectedCount} URLs buscando pain points y problemas
              relevantes para tu propuesta de valor.
            </p>
            <div className="space-y-2 mb-6 text-sm text-gray-600 bg-gray-50 p-3 rounded">
              <p>• URLs a procesar: <strong>{selectedCount}</strong></p>
              <p>• URLs excluidas: <strong>{(summary?.scraped || 0) - selectedCount}</strong></p>
              <p>• Costo estimado: <strong>~${summary?.estimatedCost?.toFixed(2) || '0.00'}</strong></p>
            </div>
            <p className="text-sm text-amber-600 mb-6">
              Este proceso puede tomar varios minutos dependiendo de la cantidad de URLs.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  if (onExecuteExtraction) {
                    onExecuteExtraction()
                  } else {
                    // Fallback to old behavior if no extraction handler
                    onContinue()
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Confirmar y Extraer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
