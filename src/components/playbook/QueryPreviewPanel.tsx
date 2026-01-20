'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Search, DollarSign, Clock, AlertCircle } from 'lucide-react'
import { generateSearchQueries, calculateTotalQueries } from '@/lib/scraper/query-builder'
import type { ScraperStepConfig } from '@/types/scraper.types'

// Partial config for preview - only requires the fields needed for query generation
type QueryPreviewConfig = Pick<ScraperStepConfig, 'life_contexts' | 'product_words' | 'indicators' | 'sources' | 'serp_pages'>

interface QueryPreviewPanelProps {
  config: QueryPreviewConfig
  onApprove: () => void
  onAdjust: () => void
}

const COST_PER_SEARCH = 0.004 // Serper cost
const SECONDS_PER_SEARCH = 0.15 // ~150ms per search with rate limiting

export function QueryPreviewPanel({ config, onApprove, onAdjust }: QueryPreviewPanelProps) {
  const [showExamples, setShowExamples] = useState(false)

  // Calculate totals
  const stats = useMemo(() => {
    const queries = generateSearchQueries(config)
    const serpPages = config.serp_pages || 3
    const totalSearches = queries.length * serpPages
    const estimatedCost = totalSearches * COST_PER_SEARCH
    const estimatedTimeSeconds = totalSearches * SECONDS_PER_SEARCH
    const estimatedTimeMinutes = Math.ceil(estimatedTimeSeconds / 60)

    // Count by source type
    const sourceBreakdown: Record<string, number> = {}
    for (const q of queries) {
      sourceBreakdown[q.sourceType] = (sourceBreakdown[q.sourceType] || 0) + 1
    }

    // Get example queries (first 5)
    const exampleQueries = queries.slice(0, 5).map(q => q.query)

    return {
      queries,
      totalQueries: queries.length,
      totalSearches,
      estimatedCost,
      estimatedTimeMinutes,
      sourceBreakdown,
      exampleQueries,
      contexts: config.life_contexts?.length || 0,
      words: config.product_words?.length || 0,
      pages: serpPages
    }
  }, [config])

  // Warning if too many searches
  const isHighVolume = stats.totalSearches > 500
  const isVeryHighVolume = stats.totalSearches > 2000

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <Search className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Resumen de Búsqueda</h3>
          <p className="text-sm text-gray-500">Revisa antes de ejecutar</p>
        </div>
      </div>

      {/* Warning for high volume */}
      {isVeryHighVolume && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Volumen muy alto</p>
            <p className="text-sm text-red-700 mt-1">
              {stats.totalSearches.toLocaleString()} búsquedas es demasiado.
              Considera reducir contextos, palabras o páginas.
            </p>
          </div>
        </div>
      )}

      {isHighVolume && !isVeryHighVolume && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Volumen alto</p>
            <p className="text-sm text-yellow-700 mt-1">
              {stats.totalSearches.toLocaleString()} búsquedas tomará varios minutos.
              Puedes continuar o ajustar la configuración.
            </p>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Search className="w-4 h-4" />
            <span className="text-sm">Búsquedas</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats.totalSearches.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.totalQueries} queries × {stats.pages} páginas
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Costo estimado</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${stats.estimatedCost.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Serper API
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Tiempo estimado</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ~{stats.estimatedTimeMinutes} min
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Con rate limiting
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Combinaciones</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Contextos seleccionados</span>
            <span className="font-medium">{stats.contexts}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Palabras de necesidad</span>
            <span className="font-medium">{stats.words}</span>
          </div>
          <div className="flex justify-between border-t pt-2 mt-2">
            <span className="text-gray-600">Total combinaciones base</span>
            <span className="font-medium">{stats.contexts * stats.words}</span>
          </div>
        </div>

        <h4 className="font-medium text-gray-900 mt-4 mb-3">Por fuente</h4>
        <div className="space-y-2 text-sm">
          {Object.entries(stats.sourceBreakdown).map(([source, count]) => (
            <div key={source} className="flex justify-between">
              <span className="text-gray-600">{formatSourceName(source)}</span>
              <span className="font-medium">{count} queries</span>
            </div>
          ))}
        </div>
      </div>

      {/* Example queries (expandable) */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowExamples(!showExamples)}
          className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <span className="font-medium text-gray-700">Ver ejemplos de queries</span>
          {showExamples ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
        {showExamples && (
          <div className="p-4 space-y-2 bg-white">
            {stats.exampleQueries.map((query, i) => (
              <div key={i} className="text-sm font-mono bg-gray-50 px-3 py-2 rounded">
                {query}
              </div>
            ))}
            {stats.totalQueries > 5 && (
              <p className="text-xs text-gray-500 mt-2">
                ...y {stats.totalQueries - 5} queries más
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-2">
        <button
          onClick={onAdjust}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ← Ajustar configuración
        </button>
        <button
          onClick={onApprove}
          disabled={isVeryHighVolume}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
            isVeryHighVolume
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          Ejecutar {stats.totalSearches.toLocaleString()} búsquedas →
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
