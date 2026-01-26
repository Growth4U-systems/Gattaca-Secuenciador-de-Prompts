'use client'

import { useState, useEffect } from 'react'
import { PlaybookConfig, PlaybookPresentation } from './types'
import { Check, AlertCircle, Clock, DollarSign, ChevronRight, Sparkles, Settings } from 'lucide-react'

interface ApiKeyStatus {
  key: string
  name: string
  description: string
  configured: boolean
  loading: boolean
}

interface PlaybookIntroScreenProps {
  playbookConfig: PlaybookConfig
  onStart: () => void
  /** Optional: callback to open API key settings */
  onConfigureApiKey?: (serviceKey: string) => void
}

/**
 * PlaybookIntroScreen - Welcome screen shown before starting a playbook
 *
 * Communicates:
 * - What the playbook does (value proposition)
 * - What the user will get (example output)
 * - Required services and their status
 * - Time and cost estimates
 */
export default function PlaybookIntroScreen({
  playbookConfig,
  onStart,
  onConfigureApiKey,
}: PlaybookIntroScreenProps) {
  const [apiKeyStatuses, setApiKeyStatuses] = useState<ApiKeyStatus[]>([])
  const [checkingKeys, setCheckingKeys] = useState(true)

  const presentation = playbookConfig.presentation

  // Check API key statuses on mount
  useEffect(() => {
    const checkApiKeys = async () => {
      if (!presentation?.requiredServices?.length) {
        setCheckingKeys(false)
        return
      }

      // Initialize statuses
      const statuses: ApiKeyStatus[] = presentation.requiredServices.map(service => ({
        key: service.key,
        name: service.name,
        description: service.description,
        configured: false,
        loading: true,
      }))
      setApiKeyStatuses(statuses)

      // Check each service
      const updatedStatuses = await Promise.all(
        presentation.requiredServices.map(async (service) => {
          try {
            const response = await fetch(`/api/user/api-keys/check?services=${service.key}`)
            if (response.ok) {
              const data = await response.json()
              // API returns { results: { [service]: { configured: boolean } }, allConfigured, missing }
              const isConfigured = data.results?.[service.key]?.configured ?? false
              return {
                key: service.key,
                name: service.name,
                description: service.description,
                configured: isConfigured,
                loading: false,
              }
            }
          } catch (error) {
            console.error(`Error checking ${service.key} API key:`, error)
          }
          return {
            key: service.key,
            name: service.name,
            description: service.description,
            configured: false,
            loading: false,
          }
        })
      )

      setApiKeyStatuses(updatedStatuses)
      setCheckingKeys(false)
    }

    checkApiKeys()
  }, [presentation?.requiredServices])

  const allServicesConfigured = apiKeyStatuses.every(s => s.configured || s.loading)
  const hasUnconfiguredServices = apiKeyStatuses.some(s => !s.configured && !s.loading)

  // If no presentation data, show a simpler version
  if (!presentation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <div className="text-6xl mb-4">{playbookConfig.icon || '📋'}</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{playbookConfig.name}</h1>
        {playbookConfig.description && (
          <p className="text-gray-600 mb-8 max-w-md">{playbookConfig.description}</p>
        )}
        <button
          onClick={onStart}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors"
        >
          Comenzar Playbook
          <ChevronRight size={20} />
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">{playbookConfig.icon || '📋'}</div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          {playbookConfig.name}
        </h1>
        <p className="text-lg text-gray-600 max-w-xl mx-auto">
          {presentation.tagline || playbookConfig.description}
        </p>
      </div>

      {/* Example Output Preview */}
      {presentation.exampleOutput && (
        <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h2 className="font-semibold text-gray-900">Ejemplo de resultado</h2>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            {presentation.exampleOutput.type === 'linkedin-post' && (
              <LinkedInPostPreview preview={presentation.exampleOutput.preview} />
            )}
            {presentation.exampleOutput.type === 'keywords' && (
              <KeywordsPreview preview={presentation.exampleOutput.preview} />
            )}
            {presentation.exampleOutput.type === 'data' && (
              <DataPreview preview={presentation.exampleOutput.preview} />
            )}
            {['report', 'custom'].includes(presentation.exampleOutput.type) && (
              <GenericPreview preview={presentation.exampleOutput.preview} />
            )}
          </div>
        </div>
      )}

      {/* Value Proposition */}
      {presentation.valueProposition?.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-100">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            Lo que vas a obtener
          </h2>
          <ul className="space-y-3">
            {presentation.valueProposition.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-600" />
                </span>
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Required Services */}
      {apiKeyStatuses.length > 0 && (
        <div className="bg-white rounded-xl p-6 mb-6 border border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-500" />
            Servicios necesarios
          </h2>
          <div className="space-y-3">
            {apiKeyStatuses.map((status) => (
              <div
                key={status.key}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  status.loading
                    ? 'bg-gray-50'
                    : status.configured
                    ? 'bg-green-50 border border-green-100'
                    : 'bg-amber-50 border border-amber-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  {status.loading ? (
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  ) : status.configured ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{status.name}</p>
                    <p className="text-sm text-gray-500">{status.description}</p>
                  </div>
                </div>
                {!status.loading && !status.configured && onConfigureApiKey && (
                  <button
                    onClick={() => onConfigureApiKey(status.key)}
                    className="px-3 py-1.5 text-sm text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                  >
                    Configurar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time and Cost Estimates */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 border border-gray-200 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Tiempo estimado</p>
            <p className="font-semibold text-gray-900">{presentation.estimatedTime}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Costo aproximado</p>
            <p className="font-semibold text-gray-900">{presentation.estimatedCost}</p>
          </div>
        </div>
      </div>

      {/* Start Button */}
      <div className="text-center">
        {hasUnconfiguredServices && (
          <p className="text-amber-600 text-sm mb-3">
            ⚠️ Algunos servicios no están configurados. Puedes continuar pero algunas funciones podrían no estar disponibles.
          </p>
        )}
        <button
          onClick={onStart}
          disabled={checkingKeys}
          className={`px-8 py-4 rounded-xl font-semibold text-lg flex items-center gap-2 mx-auto transition-all ${
            checkingKeys
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
          }`}
        >
          {checkingKeys ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              Comenzar Playbook
              <ChevronRight size={20} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// Preview Components

function LinkedInPostPreview({ preview }: { preview: { text?: string; imageUrl?: string } }) {
  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div>
            <p className="font-medium text-sm text-gray-900">Tu nombre</p>
            <p className="text-xs text-gray-500">Headline • Ahora</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 line-clamp-4">
          {preview.text || 'Tu post de LinkedIn generado aparecerá aquí con un hook atractivo y contenido profesional...'}
        </p>
      </div>
      {preview.imageUrl && (
        <div className="w-32 h-24 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
          <img src={preview.imageUrl} alt="Preview" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  )
}

function KeywordsPreview({ preview }: { preview: { text?: string } }) {
  const sampleKeywords = preview.text?.split(',').slice(0, 6) || [
    'keyword ejemplo 1',
    'keyword ejemplo 2',
    'keyword ejemplo 3',
    'keyword ejemplo 4',
    'keyword ejemplo 5',
    '...'
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {sampleKeywords.map((kw, i) => (
        <span
          key={i}
          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
        >
          {kw.trim()}
        </span>
      ))}
    </div>
  )
}

function DataPreview({ preview }: { preview: { text?: string } }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs font-medium text-gray-500 border-b pb-2">
        <span className="flex-1">Columna 1</span>
        <span className="flex-1">Columna 2</span>
        <span className="flex-1">Columna 3</span>
      </div>
      {[1, 2, 3].map((row) => (
        <div key={row} className="flex gap-2 text-sm text-gray-700">
          <span className="flex-1">Dato {row}A</span>
          <span className="flex-1">Dato {row}B</span>
          <span className="flex-1">Dato {row}C</span>
        </div>
      ))}
      <p className="text-xs text-gray-400 italic pt-2">+ más filas...</p>
    </div>
  )
}

function GenericPreview({ preview }: { preview: { text?: string; imageUrl?: string } }) {
  return (
    <div className="text-center text-gray-500 py-4">
      {preview.imageUrl ? (
        <img src={preview.imageUrl} alt="Preview" className="max-h-32 mx-auto rounded-lg" />
      ) : (
        <p className="text-sm">{preview.text || 'Vista previa del resultado'}</p>
      )}
    </div>
  )
}
