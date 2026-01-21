'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronDown, ChevronUp, ExternalLink, Loader2 } from 'lucide-react'

interface SourceGroup {
  source_type: string
  count: number
  selected: boolean
  sampleUrls: Array<{ id: string; url: string; title: string; life_context: string; product_word: string }>
}

interface SerpResultsPanelProps {
  jobId: string
  onContinue: (selectedSources: string[]) => void
  onBack: () => void
}

const FIRECRAWL_COST_PER_URL = 0.001 // Approximate cost

export function SerpResultsPanel({ jobId, onContinue, onBack }: SerpResultsPanelProps) {
  const [groups, setGroups] = useState<SourceGroup[]>([])
  const [expandedSource, setExpandedSource] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch URL summary from API
  useEffect(() => {
    async function loadSummary() {
      try {
        setLoading(true)
        const response = await fetch(`/api/niche-finder/jobs/${jobId}/urls/summary`)
        if (!response.ok) {
          throw new Error('Failed to load URL summary')
        }
        const data = await response.json()

        // Initialize all sources as selected
        setGroups(data.sources.map((s: Omit<SourceGroup, 'selected'>) => ({
          ...s,
          selected: true
        })))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    loadSummary()
  }, [jobId])

  const totalUrls = groups.reduce((sum, g) => sum + g.count, 0)
  const selectedUrls = groups.filter(g => g.selected).reduce((sum, g) => sum + g.count, 0)
  const estimatedCost = selectedUrls * FIRECRAWL_COST_PER_URL

  const toggleSource = (sourceType: string) => {
    setGroups(gs => gs.map(g =>
      g.source_type === sourceType
        ? { ...g, selected: !g.selected }
        : g
    ))
  }

  const toggleExpand = (sourceType: string) => {
    setExpandedSource(prev => prev === sourceType ? null : sourceType)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        <span className="ml-3 text-gray-600">Cargando resultados...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-red-600 underline"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-yellow-800 font-medium">No se encontraron URLs</p>
        <p className="text-yellow-700 text-sm mt-2">
          Las búsquedas no devolvieron resultados relevantes.
          Intenta ajustar los contextos o palabras de búsqueda.
        </p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors"
        >
          ← Volver a configurar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-green-700">
        <Check className="w-5 h-5" />
        <span className="font-medium">Búsqueda completada</span>
      </div>

      <p className="text-gray-600">
        Se encontraron <strong>{totalUrls.toLocaleString()} URLs</strong> únicas en {groups.length} fuentes
      </p>

      {/* Source groups */}
      <div className="space-y-3">
        {groups.map(group => (
          <div
            key={group.source_type}
            className={`border rounded-lg overflow-hidden transition-colors ${
              group.selected ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-gray-50/50'
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between p-4">
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={group.selected}
                  onChange={() => toggleSource(group.source_type)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium text-gray-900">
                    {formatSourceName(group.source_type)}
                  </span>
                  <span className="ml-2 text-gray-500">
                    ({group.count.toLocaleString()} URLs)
                  </span>
                </div>
              </label>
              <button
                onClick={() => toggleExpand(group.source_type)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                {expandedSource === group.source_type ? (
                  <>
                    <span>ocultar</span>
                    <ChevronUp className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>ver muestra</span>
                    <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Expanded samples */}
            {expandedSource === group.source_type && (
              <div className="border-t border-gray-200 bg-white p-4 space-y-3">
                {group.sampleUrls.map((url, i) => (
                  <div key={url.id || i} className="flex items-start gap-3">
                    <ExternalLink className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <a
                        href={url.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm font-medium block truncate"
                      >
                        {url.title || url.url}
                      </a>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {url.url}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {url.life_context}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {url.product_word}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {group.count > group.sampleUrls.length && (
                  <p className="text-xs text-gray-400 pt-2">
                    ...y {(group.count - group.sampleUrls.length).toLocaleString()} URLs más
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">URLs seleccionadas</span>
          <span className="font-medium">{selectedUrls.toLocaleString()} de {totalUrls.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Costo estimado scraping</span>
          <span className="font-medium">~${estimatedCost.toFixed(2)} USD</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ← Volver
        </button>
        <button
          onClick={() => onContinue(groups.filter(g => g.selected).map(g => g.source_type))}
          disabled={selectedUrls === 0}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
            selectedUrls === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          Continuar con {selectedUrls.toLocaleString()} URLs →
        </button>
      </div>
    </div>
  )
}

function formatSourceName(source: string): string {
  const names: Record<string, string> = {
    reddit: 'Reddit',
    thematic_forum: 'Foros Temáticos',
    general_forum: 'Foros Generales',
  }
  return names[source] || source
}
