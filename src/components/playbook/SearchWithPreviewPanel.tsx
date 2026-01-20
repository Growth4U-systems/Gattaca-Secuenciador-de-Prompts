'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Search,
  DollarSign,
  Clock,
  AlertCircle,
  Play,
  Loader2,
  X,
  Minus,
  Plus,
  Check,
} from 'lucide-react'
import { generateSearchQueries } from '@/lib/scraper/query-builder'
import type { ScraperStepConfig } from '@/types/scraper.types'

// Config that can be edited in this panel
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

interface SearchWithPreviewPanelProps {
  config: Partial<EditableConfig>
  onExecute: (finalConfig: EditableConfig) => void
  onBack: () => void
  onCancel?: () => void // Para cancelar la ejecución
  isExecuting?: boolean
  progress?: {
    current: number
    total: number
    label?: string
  }
}

const COST_PER_SEARCH = 0.004 // Serper cost
const SECONDS_PER_SEARCH = 0.15 // ~150ms per search with rate limiting

export function SearchWithPreviewPanel({
  config,
  onExecute,
  onBack,
  onCancel,
  isExecuting = false,
  progress,
}: SearchWithPreviewPanelProps) {
  // Editable state - initialize from config
  const [editableConfig, setEditableConfig] = useState<EditableConfig>(() => ({
    life_contexts: config.life_contexts || [],
    product_words: config.product_words || [],
    indicators: config.indicators || [],
    sources: config.sources || {
      reddit: true,
      thematic_forums: false,
      general_forums: [],
    },
    serp_pages: config.serp_pages || 3,
  }))

  const [showExamples, setShowExamples] = useState(false)
  const [showContexts, setShowContexts] = useState(false)
  const [showWords, setShowWords] = useState(false)

  // Validate config structure
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

  // Calculate totals
  const stats = useMemo(() => {
    if (configError) {
      return {
        queries: [],
        totalQueries: 0,
        totalSearches: 0,
        estimatedCost: 0,
        estimatedTimeMinutes: 0,
        sourceBreakdown: {},
        exampleQueries: [],
      }
    }

    const queries = generateSearchQueries(editableConfig as ScraperStepConfig)
    const serpPages = editableConfig.serp_pages || 3
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
    const exampleQueries = queries.slice(0, 5).map((q) => q.query)

    return {
      queries,
      totalQueries: queries.length,
      totalSearches,
      estimatedCost,
      estimatedTimeMinutes,
      sourceBreakdown,
      exampleQueries,
    }
  }, [editableConfig, configError])

  // Quick edit handlers
  const removeContext = useCallback((context: string) => {
    setEditableConfig((prev) => ({
      ...prev,
      life_contexts: prev.life_contexts.filter((c) => c !== context),
    }))
  }, [])

  const removeWord = useCallback((word: string) => {
    setEditableConfig((prev) => ({
      ...prev,
      product_words: prev.product_words.filter((w) => w !== word),
    }))
  }, [])

  const adjustPages = useCallback((delta: number) => {
    setEditableConfig((prev) => ({
      ...prev,
      serp_pages: Math.max(1, Math.min(5, prev.serp_pages + delta)),
    }))
  }, [])

  const toggleSource = useCallback((source: 'reddit' | 'thematic_forums') => {
    setEditableConfig((prev) => ({
      ...prev,
      sources: {
        ...prev.sources,
        [source]: !prev.sources[source],
      },
    }))
  }, [])

  // Warning levels
  const isHighVolume = stats.totalSearches > 500
  const isVeryHighVolume = stats.totalSearches > 2000

  // Render executing state
  if (isExecuting) {
    const totalSearches = progress?.total || stats.totalSearches
    const currentProgress = progress?.current || 0
    const remaining = totalSearches - currentProgress
    const percentComplete = totalSearches > 0 ? (currentProgress / totalSearches) * 100 : 0

    // Estimate time remaining based on progress
    const estimatedSecondsRemaining = remaining * SECONDS_PER_SEARCH
    const estimatedMinutesRemaining = Math.ceil(estimatedSecondsRemaining / 60)

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          <div>
            <h3 className="font-semibold text-gray-900">Buscando URLs...</h3>
            <p className="text-sm text-gray-500">
              Ejecutando {totalSearches.toLocaleString()} búsquedas en Google
            </p>
          </div>
        </div>

        {/* Progress bar with detailed info */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              Búsquedas: {currentProgress.toLocaleString()}/{totalSearches.toLocaleString()}
              {remaining > 0 && <span className="text-gray-400 ml-1">(faltan {remaining.toLocaleString()})</span>}
            </span>
            <span className="text-gray-700 font-medium">
              {currentProgress} / {totalSearches}
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-700">
            {estimatedMinutesRemaining > 0
              ? `Esto puede tomar ~${estimatedMinutesRemaining} minutos. No cierres esta ventana.`
              : 'Finalizando búsqueda...'}
          </p>
        </div>

        {/* Cancel button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full px-4 py-2.5 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 border border-red-200 flex items-center justify-center gap-2 transition-colors"
          >
            <X className="w-4 h-4" />
            Cancelar Búsqueda
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <Search className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Configurar Búsqueda</h3>
          <p className="text-sm text-gray-500">
            Ajusta la configuración y ejecuta la búsqueda
          </p>
        </div>
      </div>

      {/* Error state */}
      {configError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Configuración incompleta</p>
            <p className="text-sm text-red-700 mt-1">{configError}</p>
          </div>
        </div>
      )}

      {/* Warning for high volume */}
      {isVeryHighVolume && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Volumen muy alto</p>
            <p className="text-sm text-red-700 mt-1">
              {stats.totalSearches.toLocaleString()} búsquedas es demasiado. Reduce
              contextos, palabras o páginas.
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
              Puedes reducir para ir más rápido.
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
            {stats.totalQueries} queries × {editableConfig.serp_pages} pág
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
          <p className="text-xs text-gray-500 mt-1">Serper API</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Tiempo</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ~{stats.estimatedTimeMinutes} min
          </p>
          <p className="text-xs text-gray-500 mt-1">Estimado</p>
        </div>
      </div>

      {/* Quick Edit: Contexts */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowContexts(!showContexts)}
          className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">Contextos</span>
            <span className="text-sm text-gray-500">
              ({editableConfig.life_contexts.length})
            </span>
          </div>
          {showContexts ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
        {showContexts && (
          <div className="p-4 bg-white">
            <p className="text-xs text-gray-500 mb-3">
              Haz clic en × para quitar contextos y reducir búsquedas
            </p>
            <div className="flex flex-wrap gap-2">
              {editableConfig.life_contexts.map((ctx) => (
                <span
                  key={ctx}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm"
                >
                  {ctx}
                  <button
                    onClick={() => removeContext(ctx)}
                    className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                    disabled={editableConfig.life_contexts.length <= 1}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Edit: Words */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowWords(!showWords)}
          className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">Palabras de necesidad</span>
            <span className="text-sm text-gray-500">
              ({editableConfig.product_words.length})
            </span>
          </div>
          {showWords ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
        {showWords && (
          <div className="p-4 bg-white">
            <p className="text-xs text-gray-500 mb-3">
              Haz clic en × para quitar palabras y reducir búsquedas
            </p>
            <div className="flex flex-wrap gap-2">
              {editableConfig.product_words.map((word) => (
                <span
                  key={word}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm"
                >
                  {word}
                  <button
                    onClick={() => removeWord(word)}
                    className="ml-1 hover:bg-green-200 rounded-full p-0.5"
                    disabled={editableConfig.product_words.length <= 1}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Edit: Pages & Sources */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        {/* Pages per query */}
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-gray-700">Páginas por query</span>
            <p className="text-xs text-gray-500">Más páginas = más resultados pero más costo</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustPages(-1)}
              disabled={editableConfig.serp_pages <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-medium">{editableConfig.serp_pages}</span>
            <button
              onClick={() => adjustPages(1)}
              disabled={editableConfig.serp_pages >= 5}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sources toggles */}
        <div className="border-t pt-4">
          <span className="font-medium text-gray-700 block mb-3">Fuentes</span>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                onClick={() => toggleSource('reddit')}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  editableConfig.sources.reddit
                    ? 'bg-orange-500 border-orange-500'
                    : 'border-gray-300'
                }`}
              >
                {editableConfig.sources.reddit && <Check className="w-3 h-3 text-white" />}
              </button>
              <span className="text-gray-700">Reddit</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                onClick={() => toggleSource('thematic_forums')}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  editableConfig.sources.thematic_forums
                    ? 'bg-purple-500 border-purple-500'
                    : 'border-gray-300'
                }`}
              >
                {editableConfig.sources.thematic_forums && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </button>
              <span className="text-gray-700">Foros Temáticos</span>
              <span className="text-xs text-gray-500">(auto-detecta según contexto)</span>
            </label>
          </div>
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
            {stats.exampleQueries.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                Configura contextos y palabras para ver ejemplos
              </p>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
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
          onClick={() => onExecute(editableConfig)}
          disabled={!!configError || isVeryHighVolume}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            configError || isVeryHighVolume
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Play className="w-4 h-4" />
          Buscar {stats.totalSearches.toLocaleString()} URLs
        </button>
      </div>
    </div>
  )
}
