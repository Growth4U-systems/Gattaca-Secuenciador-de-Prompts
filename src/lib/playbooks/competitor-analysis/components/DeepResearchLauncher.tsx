'use client'

/**
 * DeepResearchLauncher Component
 *
 * Componente especializado para lanzar Deep Research con Gemini.
 * Incluye preview del prompt y opciones de configuración.
 */

import { useState } from 'react'
import {
  Sparkles,
  Search,
  Globe,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Copy,
  ExternalLink,
} from 'lucide-react'
import type { DeepResearchLauncherProps } from '../types'
import { DEEP_RESEARCH_PROMPT } from '../prompts'

// ============================================
// COMPONENT
// ============================================

export default function DeepResearchLauncher({
  campaignId,
  projectId,
  competitorName,
  industry,
  country = 'España',
  onComplete,
  onError,
}: DeepResearchLauncherProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [result, setResult] = useState<{ documentId: string; preview: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  // Generate the final prompt with variables
  const finalPrompt = DEEP_RESEARCH_PROMPT
    .replace(/\{\{competitor_name\}\}/g, competitorName)
    .replace(/\{\{industry\}\}/g, industry)
    .replace(/\{\{country\}\}/g, country)

  // Handle copy prompt
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(finalPrompt)
  }

  // Handle generate
  const handleGenerate = async () => {
    setIsGenerating(true)
    setProgress('Iniciando investigación...')
    setError(null)

    try {
      // Show progress updates during the API call
      const progressMessages = [
        'Buscando información en la web...',
        'Analizando datos de la empresa...',
        'Sintetizando hallazgos...',
        'Generando documento...',
      ]

      let progressIndex = 0
      const progressInterval = setInterval(() => {
        progressIndex = (progressIndex + 1) % progressMessages.length
        setProgress(progressMessages[progressIndex])
      }, 5000)

      // Call the real API
      const response = await fetch('/api/deep-research/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          campaign_id: campaignId,
          competitor_name: competitorName,
          industry,
          country,
          prompt: finalPrompt,
          metadata: {
            competitor: competitorName,
            source_type: 'deep_research',
          },
        }),
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Error ${response.status}`)
      }

      const data = await response.json()

      const generatedResult = {
        documentId: data.document_id,
        preview: data.content_preview || `## Deep Research: ${competitorName}\n\n(Documento generado correctamente)`,
      }

      setResult(generatedResult)
      setProgress(null)
      onComplete(generatedResult.documentId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      setProgress(null)
      onError?.(err instanceof Error ? err : new Error(errorMessage))
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-purple-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 rounded-xl">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Deep Research</h3>
              <p className="text-sm text-gray-600">
                Investigación profunda de {competitorName} usando Gemini 2.5 Pro con búsqueda web
              </p>
            </div>
          </div>

          {result && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
              <CheckCircle size={14} />
              Completado
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Variables preview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/60 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Competidor</div>
            <div className="font-medium text-gray-900">{competitorName}</div>
          </div>
          <div className="bg-white/60 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Industria</div>
            <div className="font-medium text-gray-900">{industry}</div>
          </div>
          <div className="bg-white/60 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">País/Región</div>
            <div className="font-medium text-gray-900">{country}</div>
          </div>
        </div>

        {/* Show prompt toggle */}
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700"
        >
          <ChevronDown
            size={14}
            className={`transition-transform ${showPrompt ? 'rotate-180' : ''}`}
          />
          {showPrompt ? 'Ocultar prompt' : 'Ver prompt completo'}
        </button>

        {showPrompt && (
          <div className="relative">
            <pre className="bg-white/60 rounded-lg p-4 text-xs text-gray-700 overflow-auto max-h-64 whitespace-pre-wrap font-mono">
              {finalPrompt}
            </pre>
            <button
              onClick={handleCopyPrompt}
              className="absolute top-2 right-2 p-1.5 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
              title="Copiar prompt"
            >
              <Copy size={14} className="text-gray-500" />
            </button>
          </div>
        )}

        {/* Features */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1.5">
            <Search size={14} className="text-purple-500" />
            Búsqueda web en tiempo real
          </span>
          <span className="flex items-center gap-1.5">
            <Globe size={14} className="text-purple-500" />
            Datos actualizados
          </span>
        </div>

        {/* Progress */}
        {isGenerating && progress && (
          <div className="flex items-center gap-3 bg-white/60 rounded-lg p-4">
            <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
            <div>
              <div className="text-sm font-medium text-gray-900">{progress}</div>
              <div className="text-xs text-gray-500">Esto puede tomar 30-60 segundos...</div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-red-800">Error al generar</div>
              <div className="text-sm text-red-600 mt-1">{error}</div>
            </div>
          </div>
        )}

        {/* Result preview */}
        {result && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Vista previa del documento</span>
              <button
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                onClick={() => {
                  /* Navigate to document */
                }}
              >
                Ver completo
                <ExternalLink size={14} />
              </button>
            </div>
            <pre className="p-4 text-sm text-gray-700 overflow-auto max-h-48 whitespace-pre-wrap">
              {result.preview}
            </pre>
          </div>
        )}

        {/* Action button */}
        {!result && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isGenerating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generar Deep Research
              </>
            )}
          </button>
        )}

        {result && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles size={18} />
            Regenerar Deep Research
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-purple-100/50 border-t border-purple-100">
        <p className="text-xs text-purple-700">
          <strong>Modelo:</strong> Gemini 2.5 Pro con búsqueda web •{' '}
          <strong>Costo estimado:</strong> ~$0.10-0.20 USD
        </p>
      </div>
    </div>
  )
}
