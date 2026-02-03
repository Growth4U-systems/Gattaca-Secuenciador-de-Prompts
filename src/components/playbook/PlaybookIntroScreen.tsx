'use client'

import { useState, useEffect } from 'react'
import { PlaybookConfig, PlaybookPresentation } from './types'
import { Check, AlertCircle, Clock, DollarSign, ChevronRight, ChevronDown, Sparkles, Settings, Info } from 'lucide-react'

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
 * PlaybookIntroScreen - Compact welcome screen before starting a playbook
 *
 * Simplified to show only essential info:
 * - Name and brief tagline
 * - Time/cost estimate (inline)
 * - Warning if services are not configured
 * - Start button
 *
 * Details moved to expandable section to reduce scroll.
 */
export default function PlaybookIntroScreen({
  playbookConfig,
  onStart,
  onConfigureApiKey,
}: PlaybookIntroScreenProps) {
  const [apiKeyStatuses, setApiKeyStatuses] = useState<ApiKeyStatus[]>([])
  const [checkingKeys, setCheckingKeys] = useState(true)
  const [showDetails, setShowDetails] = useState(false)

  const presentation = playbookConfig.presentation

  // Check API key statuses on mount
  useEffect(() => {
    const checkApiKeys = async () => {
      if (!presentation?.requiredServices?.length) {
        setCheckingKeys(false)
        return
      }

      const statuses: ApiKeyStatus[] = presentation.requiredServices.map(service => ({
        key: service.key,
        name: service.name,
        description: service.description,
        configured: false,
        loading: true,
      }))
      setApiKeyStatuses(statuses)

      const updatedStatuses = await Promise.all(
        presentation.requiredServices.map(async (service) => {
          try {
            const response = await fetch(`/api/user/api-keys/check?services=${service.key}`)
            if (response.ok) {
              const data = await response.json()
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

  const hasUnconfiguredServices = apiKeyStatuses.some(s => !s.configured && !s.loading)
  const unconfiguredServices = apiKeyStatuses.filter(s => !s.configured && !s.loading)

  // Simple version without presentation data
  if (!presentation) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
        <div className="text-5xl mb-3">{playbookConfig.icon || '📋'}</div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">{playbookConfig.name}</h1>
        {playbookConfig.description && (
          <p className="text-sm text-gray-600 mb-6 max-w-md">{playbookConfig.description}</p>
        )}
        <button
          onClick={onStart}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors"
        >
          Comenzar
          <ChevronRight size={18} />
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      {/* Compact Header */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">{playbookConfig.icon || '📋'}</div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">{playbookConfig.name}</h1>
        <p className="text-sm text-gray-600">{presentation.tagline || playbookConfig.description}</p>
      </div>

      {/* Inline Time/Cost */}
      {(presentation.estimatedTime || presentation.estimatedCost) && (
        <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mb-6">
          {presentation.estimatedTime && (
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {presentation.estimatedTime}
            </span>
          )}
          {presentation.estimatedCost && (
            <span className="flex items-center gap-1">
              <DollarSign size={14} />
              {presentation.estimatedCost}
            </span>
          )}
        </div>
      )}

      {/* Warning for unconfigured services - compact */}
      {hasUnconfiguredServices && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800">
                {unconfiguredServices.length === 1
                  ? `Falta configurar: ${unconfiguredServices[0].name}`
                  : `Faltan ${unconfiguredServices.length} servicios por configurar`}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Puedes continuar, pero algunas funciones podrian no estar disponibles.
              </p>
              {onConfigureApiKey && unconfiguredServices.length === 1 && (
                <button
                  onClick={() => onConfigureApiKey(unconfiguredServices[0].key)}
                  className="text-xs text-amber-700 hover:text-amber-900 underline mt-1"
                >
                  Configurar ahora
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Start Button */}
      <div className="text-center mb-6">
        <button
          onClick={onStart}
          disabled={checkingKeys}
          className={`px-8 py-3 rounded-xl font-semibold flex items-center gap-2 mx-auto transition-all ${
            checkingKeys
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
          }`}
        >
          {checkingKeys ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              Configurar Campana
              <ChevronRight size={18} />
            </>
          )}
        </button>
      </div>

      {/* Expandable Details Section */}
      {(presentation.valueProposition?.length > 0 || presentation.exampleOutput) && (
        <div className="border-t border-gray-200 pt-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mx-auto"
          >
            <Info size={14} />
            <span>Ver mas detalles sobre este playbook</span>
            <ChevronDown size={14} className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
          </button>

          {showDetails && (
            <div className="mt-4 space-y-4">
              {/* Value Proposition - compact */}
              {presentation.valueProposition?.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Lo que vas a obtener</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {presentation.valueProposition.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Required Services - if multiple */}
              {apiKeyStatuses.length > 1 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Servicios requeridos</h3>
                  <div className="space-y-2">
                    {apiKeyStatuses.map((status) => (
                      <div key={status.key} className="flex items-center gap-2 text-sm">
                        {status.loading ? (
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                        ) : status.configured ? (
                          <Check size={14} className="text-green-500" />
                        ) : (
                          <AlertCircle size={14} className="text-amber-500" />
                        )}
                        <span className={status.configured ? 'text-gray-600' : 'text-amber-700'}>
                          {status.name}
                        </span>
                        {!status.loading && !status.configured && onConfigureApiKey && (
                          <button
                            onClick={() => onConfigureApiKey(status.key)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline ml-auto"
                          >
                            Configurar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
