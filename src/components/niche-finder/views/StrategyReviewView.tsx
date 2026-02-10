'use client'

import { useState, useMemo } from 'react'
import { X, Plus, RefreshCw, Loader2, ArrowRight } from 'lucide-react'
import type { GeneratedStrategy, StrategyWord, StrategySources } from '@/lib/playbooks/niche-finder/types'

interface StrategyReviewViewProps {
  strategy: GeneratedStrategy
  projectId: string
  onApprove: (lifeContexts: string[], benefitWords: string[], sources: StrategySources) => void
  onRegenerate: () => void
  regenerating?: boolean
}

function ChipList({
  items,
  color,
  onRemove,
  onAdd,
}: {
  items: StrategyWord[]
  color: 'blue' | 'green'
  onRemove: (index: number) => void
  onAdd: (value: string) => void
}) {
  const [inputValue, setInputValue] = useState('')

  const colorClasses = color === 'blue'
    ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
    : 'bg-green-100 text-green-800 hover:bg-green-200'

  const handleAdd = () => {
    const values = inputValue.split(',').map(v => v.trim()).filter(Boolean)
    values.forEach(v => onAdd(v))
    setInputValue('')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={`${item.value}-${i}`}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${colorClasses} transition-colors`}
            title={item.reason}
          >
            {item.value}
            <button
              onClick={() => onRemove(i)}
              className="ml-0.5 hover:text-red-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="A\u00f1adir palabras (separadas por coma)"
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={handleAdd}
          disabled={!inputValue.trim()}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default function StrategyReviewView({
  strategy,
  projectId,
  onApprove,
  onRegenerate,
  regenerating,
}: StrategyReviewViewProps) {
  const [lifeContexts, setLifeContexts] = useState<StrategyWord[]>(strategy.life_contexts || [])
  const [benefitWords, setBenefitWords] = useState<StrategyWord[]>(strategy.benefit_words || [])
  const [sources, setSources] = useState<StrategySources>(strategy.sources || {
    reddit: { enabled: true, subreddits: [] },
    thematic_forums: [],
    general_forums: ['forocoches.com', 'mediavida.com', 'burbuja.info'],
  })

  const stats = useMemo(() => {
    const combinations = lifeContexts.length * benefitWords.length
    const sourceCount = (sources.reddit?.enabled ? 1 : 0)
      + sources.general_forums.length
      + (sources.thematic_forums?.length || 0)
    const queries = combinations * Math.max(sourceCount, 1)
    return { combinations, queries, sourceCount }
  }, [lifeContexts, benefitWords, sources])

  const handleApprove = () => {
    onApprove(
      lifeContexts.map(c => c.value),
      benefitWords.map(w => w.value),
      sources
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Revisi\u00f3n de Estrategia</h2>
        <p className="text-sm text-gray-500 mt-1">
          Revisa y ajusta la estrategia generada. Puedes a\u00f1adir o quitar palabras.
        </p>
      </div>

      {/* Company info summary */}
      {strategy.company_info && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Industria</span>
              <p className="font-medium text-gray-900">{strategy.company_info.industry}</p>
            </div>
            <div>
              <span className="text-gray-500">Producto</span>
              <p className="font-medium text-gray-900">{strategy.company_info.product_description}</p>
            </div>
            <div>
              <span className="text-gray-500">Audiencia</span>
              <p className="font-medium text-gray-900">{strategy.company_info.target_audience}</p>
            </div>
          </div>
        </div>
      )}

      {/* Life contexts */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Palabras de Contexto ({lifeContexts.length})
          <span className="text-gray-400 font-normal ml-1">- Situaciones de vida/empresa</span>
        </h3>
        <ChipList
          items={lifeContexts}
          color="blue"
          onRemove={i => setLifeContexts(prev => prev.filter((_, idx) => idx !== i))}
          onAdd={v => setLifeContexts(prev => [...prev, { value: v, category: 'custom', reason: 'A\u00f1adido manualmente' }])}
        />
      </div>

      {/* Benefit words */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Palabras de Necesidad ({benefitWords.length})
          <span className="text-gray-400 font-normal ml-1">- Lo que el producto resuelve</span>
        </h3>
        <ChipList
          items={benefitWords}
          color="green"
          onRemove={i => setBenefitWords(prev => prev.filter((_, idx) => idx !== i))}
          onAdd={v => setBenefitWords(prev => [...prev, { value: v, category: 'custom', reason: 'A\u00f1adido manualmente' }])}
        />
      </div>

      {/* Sources */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Fuentes de B\u00fasqueda</h3>
        <div className="space-y-3">
          {/* Reddit toggle */}
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={sources.reddit?.enabled ?? true}
              onChange={e => setSources(prev => ({
                ...prev,
                reddit: { ...prev.reddit, enabled: e.target.checked },
              }))}
              className="rounded border-gray-300"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Reddit</span>
              {sources.reddit?.subreddits?.length > 0 && (
                <span className="text-xs text-gray-400 ml-2">
                  ({sources.reddit.subreddits.join(', ')})
                </span>
              )}
            </div>
          </label>

          {/* Thematic forums */}
          {sources.thematic_forums?.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Foros Tem\u00e1ticos</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {sources.thematic_forums.map((forum, i) => (
                  <span
                    key={forum.domain}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs"
                    title={forum.reason}
                  >
                    {forum.domain}
                    <button
                      onClick={() => setSources(prev => ({
                        ...prev,
                        thematic_forums: prev.thematic_forums.filter((_, idx) => idx !== i),
                      }))}
                      className="hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* General forums */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Foros Generales</span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {sources.general_forums.map((forum, i) => (
                <span
                  key={forum}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs"
                >
                  {forum}
                  <button
                    onClick={() => setSources(prev => ({
                      ...prev,
                      general_forums: prev.general_forums.filter((_, idx) => idx !== i),
                    }))}
                    className="hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
        <span className="text-blue-800">
          <strong>{lifeContexts.length}</strong> contextos \u00d7{' '}
          <strong>{benefitWords.length}</strong> necesidades ={' '}
          <strong>{stats.combinations}</strong> combinaciones
        </span>
        <span className="text-blue-600">
          ~{stats.queries} b\u00fasquedas en {stats.sourceCount} fuentes
        </span>
        {strategy.estimated_cost > 0 && (
          <span className="text-blue-600 ml-auto">
            ~${strategy.estimated_cost.toFixed(2)} USD
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="flex items-center gap-2 px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {regenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Regenerar
        </button>
        <button
          onClick={handleApprove}
          disabled={lifeContexts.length === 0 || benefitWords.length === 0}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Aprobar y Buscar
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
