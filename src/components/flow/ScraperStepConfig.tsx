'use client'

import React, { useState, useMemo } from 'react'
import {
  Globe,
  Plus,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  DollarSign,
  AlertCircle,
  Loader2,
  Settings,
} from 'lucide-react'
import type { ScraperStepConfig as ScraperConfig } from '@/types/scraper.types'

interface ScraperStepConfigProps {
  config: ScraperConfig
  onChange: (config: ScraperConfig) => void
  projectId?: string
}

export default function ScraperStepConfig({
  config,
  onChange,
  projectId,
}: ScraperStepConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [suggestingContexts, setSuggestingContexts] = useState(false)
  const [suggestingWords, setSuggestingWords] = useState(false)
  const [newContext, setNewContext] = useState('')
  const [newWord, setNewWord] = useState('')
  const [newForum, setNewForum] = useState('')
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null)
  const [loadingEstimate, setLoadingEstimate] = useState(false)

  // Calculate combinations
  const totalCombinations = useMemo(() => {
    return (config.life_contexts?.length || 0) * (config.product_words?.length || 0)
  }, [config.life_contexts, config.product_words])

  // Update a field in config
  const updateConfig = (field: keyof ScraperConfig, value: unknown) => {
    onChange({ ...config, [field]: value })
  }

  // Add item to array field
  const addToArray = (field: 'life_contexts' | 'product_words' | 'indicators', value: string) => {
    if (!value.trim()) return
    const currentArray = config[field] || []
    if (!currentArray.includes(value.trim())) {
      updateConfig(field, [...currentArray, value.trim()])
    }
  }

  // Remove item from array field
  const removeFromArray = (field: 'life_contexts' | 'product_words' | 'indicators', value: string) => {
    const currentArray = config[field] || []
    updateConfig(field, currentArray.filter((item) => item !== value))
  }

  // Add forum to sources
  const addForum = () => {
    if (!newForum.trim()) return
    const currentForums = config.sources?.general_forums || []
    if (!currentForums.includes(newForum.trim())) {
      updateConfig('sources', {
        ...config.sources,
        general_forums: [...currentForums, newForum.trim()],
      })
    }
    setNewForum('')
  }

  // Remove forum from sources
  const removeForum = (forum: string) => {
    const currentForums = config.sources?.general_forums || []
    updateConfig('sources', {
      ...config.sources,
      general_forums: currentForums.filter((f) => f !== forum),
    })
  }

  // Estimate cost
  const estimateCost = async () => {
    setLoadingEstimate(true)
    try {
      const response = await fetch('/api/niche-finder/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, config }),
      })
      if (response.ok) {
        const data = await response.json()
        setEstimatedCost(data.costs?.total || 0)
      }
    } catch (error) {
      console.error('Error estimating cost:', error)
    } finally {
      setLoadingEstimate(false)
    }
  }

  // Suggest with AI
  const suggestContexts = async () => {
    setSuggestingContexts(true)
    try {
      const response = await fetch('/api/niche-finder/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          industry: 'general',
          product_description: 'producto',
          country: 'ES',
          existing_life_contexts: config.life_contexts,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.life_contexts?.length > 0) {
          const newContexts = data.life_contexts.map((c: { value: string }) => c.value)
          updateConfig('life_contexts', [...(config.life_contexts || []), ...newContexts])
        }
      }
    } catch (error) {
      console.error('Error suggesting contexts:', error)
    } finally {
      setSuggestingContexts(false)
    }
  }

  const suggestWords = async () => {
    setSuggestingWords(true)
    try {
      const response = await fetch('/api/niche-finder/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          industry: 'general',
          product_description: 'producto',
          country: 'ES',
          existing_product_words: config.product_words,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.product_words?.length > 0) {
          const newWords = data.product_words.map((w: { value: string }) => w.value)
          updateConfig('product_words', [...(config.product_words || []), ...newWords])
        }
      }
    } catch (error) {
      console.error('Error suggesting words:', error)
    } finally {
      setSuggestingWords(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Combination System Header */}
      <div className="bg-gradient-to-r from-rose-50 to-orange-50 rounded-lg p-4 border border-rose-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-rose-600" />
            <span className="font-semibold text-gray-900">Sistema de Combinaciones A × B</span>
          </div>
          <span className="px-3 py-1 bg-rose-100 text-rose-700 text-sm font-medium rounded-full">
            {totalCombinations} combinaciones
          </span>
        </div>
        <p className="text-sm text-gray-600">
          Combina contextos de vida con palabras del producto para encontrar nichos en foros.
        </p>
      </div>

      {/* Two columns: Life Contexts × Product Words */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column A: Life Contexts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Columna A: Contextos de Vida
            </label>
            <button
              onClick={suggestContexts}
              disabled={suggestingContexts}
              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
            >
              {suggestingContexts ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              Sugerir con AI
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addToArray('life_contexts', newContext)
                  setNewContext('')
                }
              }}
              placeholder="familia, hijos, universidad..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => {
                addToArray('life_contexts', newContext)
                setNewContext('')
              }}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[80px] p-3 bg-gray-50 rounded-lg border border-gray-200">
            {(config.life_contexts || []).length === 0 ? (
              <span className="text-sm text-gray-400">Sin contextos añadidos</span>
            ) : (
              (config.life_contexts || []).map((context) => (
                <span
                  key={context}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700"
                >
                  {context}
                  <button
                    onClick={() => removeFromArray('life_contexts', context)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Column B: Product Words */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Columna B: Palabras del Producto
            </label>
            <button
              onClick={suggestWords}
              disabled={suggestingWords}
              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
            >
              {suggestingWords ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              Sugerir con AI
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addToArray('product_words', newWord)
                  setNewWord('')
                }
              }}
              placeholder="pagos, ahorro, gastos..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => {
                addToArray('product_words', newWord)
                setNewWord('')
              }}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[80px] p-3 bg-gray-50 rounded-lg border border-gray-200">
            {(config.product_words || []).length === 0 ? (
              <span className="text-sm text-gray-400">Sin palabras añadidas</span>
            ) : (
              (config.product_words || []).map((word) => (
                <span
                  key={word}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700"
                >
                  {word}
                  <button
                    onClick={() => removeFromArray('product_words', word)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sources Section */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700">Fuentes de Datos</label>

        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          {/* Reddit toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.sources?.reddit ?? true}
              onChange={(e) =>
                updateConfig('sources', { ...config.sources, reddit: e.target.checked })
              }
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Reddit (búsqueda general)</span>
          </label>

          {/* Thematic forums toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.sources?.thematic_forums ?? true}
              onChange={(e) =>
                updateConfig('sources', { ...config.sources, thematic_forums: e.target.checked })
              }
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Foros temáticos (según contexto)</span>
          </label>

          {/* General forums */}
          <div className="pt-2 border-t border-gray-200">
            <label className="text-xs font-medium text-gray-600 mb-2 block">
              Foros Generales
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newForum}
                onChange={(e) => setNewForum(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addForum()
                  }
                }}
                placeholder="forocoches.com"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={addForum}
                className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(config.sources?.general_forums || []).map((forum) => (
                <span
                  key={forum}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600"
                >
                  {forum}
                  <button
                    onClick={() => removeForum(forum)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="border border-gray-200 rounded-lg">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Settings size={16} />
            Configuración Avanzada
          </div>
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdvanced && (
          <div className="p-4 border-t border-gray-200 space-y-4">
            {/* SERP pages */}
            <div>
              <label className="text-sm text-gray-600 block mb-1">
                Páginas de resultados SERP
              </label>
              <select
                value={config.serp_pages || 5}
                onChange={(e) => updateConfig('serp_pages', parseInt(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={1}>1 página (10 resultados)</option>
                <option value={3}>3 páginas (30 resultados)</option>
                <option value={5}>5 páginas (50 resultados)</option>
                <option value={10}>10 páginas (100 resultados)</option>
              </select>
            </div>

            {/* Batch size */}
            <div>
              <label className="text-sm text-gray-600 block mb-1">
                URLs en paralelo (batch size)
              </label>
              <select
                value={config.batch_size || 10}
                onChange={(e) => updateConfig('batch_size', parseInt(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={5}>5 URLs</option>
                <option value={10}>10 URLs</option>
                <option value={20}>20 URLs</option>
                <option value={50}>50 URLs</option>
              </select>
            </div>

            {/* Extraction model */}
            <div>
              <label className="text-sm text-gray-600 block mb-1">
                Modelo de extracción LLM
              </label>
              <select
                value={config.extraction_model || 'openai/gpt-4o-mini'}
                onChange={(e) => updateConfig('extraction_model', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="openai/gpt-4o-mini">GPT-4o Mini (Recomendado)</option>
                <option value="openai/gpt-4o">GPT-4o</option>
                <option value="google/gemini-2.5-flash-preview">Gemini 2.5 Flash</option>
                <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Cost Estimate */}
      <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-green-600" />
          <span className="text-sm font-medium text-gray-700">Coste Estimado:</span>
          {estimatedCost !== null ? (
            <span className="text-lg font-bold text-green-700">${estimatedCost.toFixed(3)}</span>
          ) : (
            <span className="text-sm text-gray-500">Calcular...</span>
          )}
        </div>
        <button
          onClick={estimateCost}
          disabled={loadingEstimate || totalCombinations === 0}
          className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loadingEstimate ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            'Calcular Coste'
          )}
        </button>
      </div>

      {/* Warning if no combinations */}
      {totalCombinations === 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          <AlertCircle size={16} />
          Añade al menos un contexto de vida y una palabra del producto para continuar.
        </div>
      )}
    </div>
  )
}
