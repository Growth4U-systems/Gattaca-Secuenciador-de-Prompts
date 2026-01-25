'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Loader2,
  ExternalLink,
  FileText,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface ExtractedNiche {
  id: string
  problem: string
  persona: string
  emotion: string
  context: string
  raw_data?: Record<string, unknown>
  created_at: string
}

interface UrlData {
  id: string
  url: string
  title: string
  source_type: string
  status: string
  selected: boolean
  life_context: string
  product_word: string
  content_markdown: string | null
  content_length: number
  word_count: number
  error_message: string | null
  scraped_at: string | null
  created_at: string
}

interface ScrapedContentViewerProps {
  jobId: string
  urlId: string
  onClose: () => void
}

export function ScrapedContentViewer({ jobId, urlId, onClose }: ScrapedContentViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [urlData, setUrlData] = useState<UrlData | null>(null)
  const [extractedNiches, setExtractedNiches] = useState<ExtractedNiche[]>([])
  const [copied, setCopied] = useState(false)
  const [showNiches, setShowNiches] = useState(true)

  const fetchUrlContent = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/niche-finder/jobs/${jobId}/urls/${urlId}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al cargar contenido')
      }
      const data = await response.json()
      setUrlData(data.url)
      setExtractedNiches(data.extracted_niches || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [jobId, urlId])

  useEffect(() => {
    fetchUrlContent()
  }, [fetchUrlContent])

  const handleCopyMarkdown = async () => {
    if (!urlData?.content_markdown) return
    try {
      await navigator.clipboard.writeText(urlData.content_markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Error copying:', err)
    }
  }

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {loading ? 'Cargando...' : urlData?.title || 'Contenido Scrapeado'}
            </h2>
            {urlData && (
              <a
                href={urlData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
              >
                <span className="truncate max-w-lg">{urlData.url}</span>
                <ExternalLink size={12} className="flex-shrink-0" />
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-blue-600 mr-3" size={24} />
              <span className="text-gray-600">Cargando contenido...</span>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-medium text-red-800">Error al cargar</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          ) : urlData ? (
            <div className="p-6 space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Estado</p>
                  <p className={`text-sm font-medium ${
                    urlData.status === 'scraped' ? 'text-green-600' :
                    urlData.status === 'failed' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {urlData.status}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Palabras</p>
                  <p className="text-sm font-medium text-gray-800">
                    {urlData.word_count.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Caracteres</p>
                  <p className="text-sm font-medium text-gray-800">
                    {urlData.content_length.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Fuente</p>
                  <p className="text-sm font-medium text-gray-800">
                    {urlData.source_type}
                  </p>
                </div>
              </div>

              {/* Search context */}
              {(urlData.life_context || urlData.product_word) && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs text-blue-600 mb-2 font-medium">Contexto de búsqueda</p>
                  <div className="flex flex-wrap gap-2">
                    {urlData.life_context && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                        {urlData.life_context}
                      </span>
                    )}
                    {urlData.product_word && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm">
                        {urlData.product_word}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Extracted niches */}
              {extractedNiches.length > 0 && (
                <div className="border border-green-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowNiches(!showNiches)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-green-600" />
                      <span className="font-medium text-sm text-green-800">
                        Problemas extraídos ({extractedNiches.length})
                      </span>
                    </div>
                    {showNiches ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {showNiches && (
                    <div className="p-4 space-y-3 bg-white">
                      {extractedNiches.map((niche, idx) => (
                        <div key={niche.id} className="border border-gray-100 rounded-lg p-3">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs text-gray-400">#{idx + 1}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              niche.emotion?.toLowerCase().includes('frustrat') ? 'bg-red-100 text-red-700' :
                              niche.emotion?.toLowerCase().includes('confus') ? 'bg-amber-100 text-amber-700' :
                              niche.emotion?.toLowerCase().includes('preocup') ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {niche.emotion || 'Sin emoción'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 mb-2">{niche.problem}</p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {niche.persona && (
                              <span className="text-gray-500">
                                <strong>Persona:</strong> {niche.persona}
                              </span>
                            )}
                            {niche.context && (
                              <span className="text-gray-500">
                                <strong>Contexto:</strong> {niche.context}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Error message if failed */}
              {urlData.status === 'failed' && urlData.error_message && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-xs text-red-600 mb-1 font-medium">Error de scraping</p>
                  <p className="text-sm text-red-700">{urlData.error_message}</p>
                </div>
              )}

              {/* Markdown content */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">
                    Contenido Markdown
                  </h3>
                  {urlData.content_markdown && (
                    <button
                      onClick={handleCopyMarkdown}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                    >
                      {copied ? (
                        <>
                          <Check size={14} className="text-green-600" />
                          <span className="text-green-600">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {urlData.content_markdown ? (
                  <div className="bg-gray-900 rounded-lg overflow-hidden">
                    <pre className="p-4 text-sm text-gray-100 overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap font-mono">
                      {urlData.content_markdown}
                    </pre>
                  </div>
                ) : (
                  <div className="bg-gray-100 rounded-lg p-6 text-center text-gray-500">
                    <FileText size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No hay contenido scrapeado disponible</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
          >
            Cerrar
          </button>
          {urlData?.url && (
            <a
              href={urlData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2"
            >
              <ExternalLink size={14} />
              Ver original
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default ScrapedContentViewer
