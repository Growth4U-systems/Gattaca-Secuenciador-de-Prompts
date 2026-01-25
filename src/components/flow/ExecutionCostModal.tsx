'use client'

import { useState, useMemo } from 'react'
import { X, DollarSign, Zap, FileText, AlertTriangle, Check, Play, RefreshCcw } from 'lucide-react'
import { FlowStep, MODEL_PRICING, RetrievalMode } from '@/types/flow.types'
import { formatTokenCount } from '@/lib/supabase'

interface Document {
  id: string
  filename: string
  token_count?: number
}

interface ExecutionCostModalProps {
  step: FlowStep
  documents: Document[]
  previousStepsTokens: number
  onConfirm: (useRag?: boolean) => void
  onCancel: () => void
  isExecuting?: boolean
}

export default function ExecutionCostModal({
  step,
  documents,
  previousStepsTokens,
  onConfirm,
  onCancel,
  isExecuting = false,
}: ExecutionCostModalProps) {
  const [selectedMode, setSelectedMode] = useState<RetrievalMode>(step.retrieval_mode || 'full')

  // Calculate costs
  const costs = useMemo(() => {
    // Get tokens from selected documents
    const selectedDocs = documents.filter(d => step.base_doc_ids.includes(d.id))
    const docTokens = selectedDocs.reduce((sum, d) => sum + (d.token_count || 0), 0)

    // Estimate prompt tokens (rough estimate)
    const promptTokens = Math.ceil(step.prompt.length / 4)

    // Total input tokens for full mode
    const fullInputTokens = docTokens + promptTokens + previousStepsTokens

    // RAG mode tokens (estimated based on config)
    const ragConfig = step.rag_config || { top_k: 10, min_score: 0.7 }
    const ragInputTokens = (ragConfig.top_k * 500) + promptTokens + previousStepsTokens // ~500 tokens per chunk

    // Get pricing for selected model
    const model = step.model || 'google/gemini-3-pro-preview'
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['default']

    // Calculate costs
    const fullCost = (fullInputTokens / 1_000_000) * pricing.input
    const ragCost = (ragInputTokens / 1_000_000) * pricing.input

    // Savings
    const savingsPercent = fullInputTokens > 0
      ? ((fullInputTokens - ragInputTokens) / fullInputTokens) * 100
      : 0

    return {
      docTokens,
      promptTokens,
      previousTokens: previousStepsTokens,
      fullInputTokens,
      ragInputTokens,
      fullCost,
      ragCost,
      savingsPercent,
      model,
      pricing,
    }
  }, [step, documents, previousStepsTokens])

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(4)}`
    if (cost < 1) return `$${cost.toFixed(3)}`
    return `$${cost.toFixed(2)}`
  }

  const isHighCost = costs.fullCost > 0.50 // Warn if cost > $0.50

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-5 border-b ${isHighCost ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isHighCost ? (
                <AlertTriangle size={24} className="text-amber-500" />
              ) : (
                <DollarSign size={24} className="text-indigo-500" />
              )}
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Confirmar Ejecucion</h2>
                <p className="text-sm text-gray-600">
                  {step.name}
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              disabled={isExecuting}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Token breakdown */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Desglose de tokens</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Documentos ({step.base_doc_ids.length})</span>
                <span className="font-medium">{formatTokenCount(costs.docTokens)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Prompt</span>
                <span className="font-medium">{formatTokenCount(costs.promptTokens)}</span>
              </div>
              {costs.previousTokens > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Pasos anteriores</span>
                  <span className="font-medium">{formatTokenCount(costs.previousTokens)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-1 mt-1 flex justify-between font-medium">
                <span className="text-gray-900">Total estimado</span>
                <span>{formatTokenCount(selectedMode === 'rag' ? costs.ragInputTokens : costs.fullInputTokens)}</span>
              </div>
            </div>
          </div>

          {/* Mode selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Modo de documentos</h3>

            {/* Full mode option */}
            <label
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedMode === 'full'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="mode"
                value="full"
                checked={selectedMode === 'full'}
                onChange={() => setSelectedMode('full')}
                className="sr-only"
              />
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                selectedMode === 'full' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                <FileText size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">Documento Completo</span>
                  <span className={`text-sm font-bold ${isHighCost && selectedMode === 'full' ? 'text-amber-600' : 'text-gray-900'}`}>
                    {formatCost(costs.fullCost)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Analisis holistico con contexto completo
                </p>
              </div>
            </label>

            {/* RAG mode option */}
            <label
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedMode === 'rag'
                  ? 'border-cyan-500 bg-cyan-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="mode"
                value="rag"
                checked={selectedMode === 'rag'}
                onChange={() => setSelectedMode('rag')}
                className="sr-only"
              />
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                selectedMode === 'rag' ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                <Zap size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">RAG (Chunks)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-green-600">{formatCost(costs.ragCost)}</span>
                    {costs.savingsPercent > 10 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        -{Math.round(costs.savingsPercent)}%
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Solo chunks relevantes (~{formatTokenCount(costs.ragInputTokens)} tokens)
                </p>
              </div>
            </label>
          </div>

          {/* Model info */}
          <div className="flex items-center justify-between text-sm p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-600">Modelo</span>
            <span className="font-medium text-gray-900">
              {costs.model.replace('google/', '').replace('openai/', '')}
            </span>
          </div>

          {/* Warning for high cost */}
          {isHighCost && selectedMode === 'full' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 text-sm">Costo alto detectado</p>
                <p className="text-xs text-amber-700 mt-1">
                  Considera usar RAG para ahorrar {Math.round(costs.savingsPercent)}% en costos,
                  o cambiar a un modelo mas economico.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isExecuting}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-white font-medium transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(selectedMode === 'rag')}
            disabled={isExecuting}
            className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all inline-flex items-center justify-center gap-2 ${
              selectedMode === 'rag'
                ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-600 hover:to-cyan-700'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
            } disabled:opacity-50`}
          >
            {isExecuting ? (
              <>
                <RefreshCcw size={16} className="animate-spin" />
                Ejecutando...
              </>
            ) : (
              <>
                <Play size={16} />
                Ejecutar ({formatCost(selectedMode === 'rag' ? costs.ragCost : costs.fullCost)})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
