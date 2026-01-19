'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import { PlaybookConfig } from './types'

interface CampaignSettingsProps {
  campaignId: string
  playbookConfig: PlaybookConfig
  onClose: () => void
  onSaved: () => void
}

// Descriptions for common prompt variables
const VARIABLE_DESCRIPTIONS: Record<string, { description: string; placeholder: string }> = {
  product: {
    description: 'El producto o servicio que ofreces. Se usa para identificar problemas que tu solución resuelve.',
    placeholder: 'Ej: Software de contabilidad para autónomos',
  },
  target: {
    description: 'Tu público objetivo o cliente ideal. Define a quién va dirigido tu producto.',
    placeholder: 'Ej: Autónomos y pequeñas empresas en España',
  },
  industry: {
    description: 'El sector o industria de tu negocio. Se usa para buscar foros temáticos relevantes.',
    placeholder: 'Ej: Fintech, Salud, Educación, E-commerce',
  },
}

export default function CampaignSettings({
  campaignId,
  playbookConfig,
  onClose,
  onSaved,
}: CampaignSettingsProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Campaign data
  const [campaignName, setCampaignName] = useState('')
  const [customVariables, setCustomVariables] = useState<Record<string, any>>({})

  // Load campaign data
  useEffect(() => {
    const loadCampaign = async () => {
      try {
        // We need to fetch the campaign data
        // The API endpoint is /api/campaign/create?projectId=X but we need campaign by ID
        // Let's use the campaigns list and find ours, or add a GET endpoint for single campaign
        const response = await fetch(`/api/campaign/${campaignId}`)
        if (!response.ok) {
          throw new Error('Failed to load campaign')
        }
        const data = await response.json()
        if (data.campaign) {
          setCampaignName(data.campaign.ecp_name || '')
          setCustomVariables(data.campaign.custom_variables || {})
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading campaign')
      } finally {
        setLoading(false)
      }
    }

    loadCampaign()
  }, [campaignId])

  const updateVariable = (key: string, value: any) => {
    setCustomVariables(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/campaign/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ecp_name: campaignName,
          custom_variables: customVariables,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error saving campaign')
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  // Get all variables: system variables from playbook config + prompt variables from custom_variables
  const systemVariables = playbookConfig.variables || []
  const promptVariableKeys = Object.keys(customVariables).filter(
    key => !systemVariables.some(v => v.key === key)
  )

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Configuración de Campaña</h2>
            <p className="text-sm text-gray-500">Edita las variables de esta campaña</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la campaña
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Nombre de la campaña"
              className="w-full px-4 py-2 !bg-white !text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Prompt Variables */}
          {promptVariableKeys.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Variables de Prompts</h3>
              <div className="space-y-4">
                {promptVariableKeys.map((key) => {
                  const varInfo = VARIABLE_DESCRIPTIONS[key]
                  const label = key
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')

                  return (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {label}
                      </label>
                      {varInfo?.description && (
                        <p className="text-xs text-gray-500 mb-2">{varInfo.description}</p>
                      )}
                      <input
                        type="text"
                        value={customVariables[key] || ''}
                        onChange={(e) => updateVariable(key, e.target.value)}
                        placeholder={varInfo?.placeholder || `Valor para {{${key}}}`}
                        className="w-full px-4 py-2 !bg-white !text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-xs text-gray-400 mt-1 block">
                        Variable: {'{{' + key + '}}'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* System Variables */}
          {systemVariables.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Configuración del Sistema</h3>
              <div className="space-y-4">
                {systemVariables.map((variable) => (
                  <div key={variable.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {variable.label}
                    </label>

                    {variable.type === 'select' && variable.options ? (
                      <select
                        value={customVariables[variable.key] ?? variable.defaultValue ?? ''}
                        onChange={(e) => updateVariable(variable.key, e.target.value)}
                        className="w-full px-4 py-2 !bg-white !text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {variable.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : variable.type === 'number' ? (
                      <input
                        type="number"
                        value={customVariables[variable.key] ?? variable.defaultValue ?? ''}
                        onChange={(e) => updateVariable(variable.key, parseInt(e.target.value))}
                        min={variable.min}
                        max={variable.max}
                        className="w-full px-4 py-2 !bg-white !text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <input
                        type="text"
                        value={customVariables[variable.key] ?? variable.defaultValue ?? ''}
                        onChange={(e) => updateVariable(variable.key, e.target.value)}
                        className="w-full px-4 py-2 !bg-white !text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={16} />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
