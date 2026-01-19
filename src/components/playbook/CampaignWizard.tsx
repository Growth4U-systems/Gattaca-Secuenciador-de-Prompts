'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react'
import { PlaybookConfig } from './types'
import { getDefaultPromptForStep } from './utils/getDefaultPrompts'

interface CampaignWizardProps {
  projectId: string
  playbookConfig: PlaybookConfig
  onClose: () => void
  onCreated: (campaignId: string) => void
}

interface PromptVariable {
  key: string
  label: string
  value: string
  description?: string
  required?: boolean
}

export default function CampaignWizard({
  projectId,
  playbookConfig,
  onClose,
  onCreated,
}: CampaignWizardProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Basic info
  const [campaignName, setCampaignName] = useState('')
  const [campaignDescription, setCampaignDescription] = useState('')

  // Step 2: Prompt variables (extracted from prompts)
  const [promptVariables, setPromptVariables] = useState<PromptVariable[]>([])

  // Step 3: System config (from playbook variables)
  const [systemConfig, setSystemConfig] = useState<Record<string, any>>({})

  // Extract variables from prompts
  useEffect(() => {
    const extractVariables = async () => {
      try {
        // Fetch flow config to get custom prompts (if any)
        const response = await fetch(`/api/projects/${projectId}`)
        const data = await response.json()
        const flowConfig = data.project?.legacy_flow_config

        const variableSet = new Set<string>()

        // Helper function to extract variables from a prompt string
        const extractFromPrompt = (prompt: string) => {
          // Match {{variable}} but not {{#if ...}} or {{/if}}
          const matches = prompt.match(/\{\{(\w+)\}\}/g) || []
          matches.forEach((match: string) => {
            const varName = match.replace(/\{\{|\}\}/g, '')
            // Skip template control keywords
            if (!['if', 'else', 'endif'].includes(varName)) {
              variableSet.add(varName)
            }
          })
        }

        // 1. Extract from custom prompts in flow config (if saved)
        if (flowConfig?.steps) {
          flowConfig.steps.forEach((flowStep: any) => {
            if (flowStep.prompt) {
              extractFromPrompt(flowStep.prompt)
            }
          })
        }

        // 2. Extract from default template prompts for all steps with promptKey
        playbookConfig.phases.forEach(phase => {
          phase.steps.forEach(step => {
            if (step.promptKey) {
              const defaultPrompt = getDefaultPromptForStep(step.id, step.promptKey)
              if (defaultPrompt) {
                extractFromPrompt(defaultPrompt)
              }
            }
          })
        })

        // Filter out system variables (those defined in playbookConfig.variables)
        const systemVarKeys = new Set(playbookConfig.variables?.map(v => v.key) || [])

        // Convert to array with labels, excluding system variables
        const variables = Array.from(variableSet)
          .filter(key => !systemVarKeys.has(key))
          .map(key => {
            return {
              key,
              label: formatLabel(key),
              value: '',
              description: undefined,
              required: true,
            }
          })

        setPromptVariables(variables)

        // Initialize system config from playbook variables
        const initialConfig: Record<string, any> = {}
        playbookConfig.variables?.forEach(v => {
          if (v.defaultValue !== undefined) {
            initialConfig[v.key] = v.defaultValue
          }
        })
        setSystemConfig(initialConfig)
      } catch (error) {
        console.error('Error extracting variables:', error)
      }
    }

    extractVariables()
  }, [projectId, playbookConfig])

  const formatLabel = (key: string): string => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const updateVariable = (key: string, value: string) => {
    setPromptVariables(prev =>
      prev.map(v => (v.key === key ? { ...v, value } : v))
    )
  }

  const updateSystemConfig = (key: string, value: any) => {
    setSystemConfig(prev => ({ ...prev, [key]: value }))
  }

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return campaignName.trim().length > 0
      case 2:
        return promptVariables.filter(v => v.required).every(v => v.value.trim().length > 0)
      case 3:
        return true
      default:
        return false
    }
  }

  const handleCreate = async () => {
    setLoading(true)
    setError(null)

    try {
      // Build custom variables from prompt variables
      const customVariables: Record<string, string> = {}
      promptVariables.forEach(v => {
        customVariables[v.key] = v.value
      })

      // Merge with system config
      const allVariables = { ...customVariables, ...systemConfig }

      // Create campaign via API
      // Note: API expects 'ecp_name' not 'name'
      const response = await fetch('/api/campaign/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          ecp_name: campaignName,
          problem_core: campaignDescription || null,
          custom_variables: allVariables,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error creating campaign')
      }

      onCreated(data.campaign.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const totalSteps = 3

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Nueva Campaña</h2>
            <p className="text-sm text-gray-500">Paso {step} de {totalSteps}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <span className="text-3xl">📝</span>
                <h3 className="text-lg font-medium text-gray-900 mt-2">Información Básica</h3>
                <p className="text-sm text-gray-500">Dale un nombre descriptivo a tu campaña</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la campaña *
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Ej: Nicho Fitness Q1 2024"
                  className="w-full px-4 py-2 !bg-white !text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={campaignDescription}
                  onChange={(e) => setCampaignDescription(e.target.value)}
                  placeholder="Describe brevemente el objetivo de esta campaña..."
                  rows={3}
                  className="w-full px-4 py-2 !bg-white !text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Step 2: Prompt Variables */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <span className="text-3xl">🎯</span>
                <h3 className="text-lg font-medium text-gray-900 mt-2">Variables de los Prompts</h3>
                <p className="text-sm text-gray-500">
                  Estas variables se usarán en todos los prompts de esta campaña
                </p>
              </div>

              {promptVariables.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No se encontraron variables en los prompts
                </div>
              ) : (
                <div className="space-y-4">
                  {promptVariables.map((variable) => (
                    <div key={variable.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {variable.label}
                        {variable.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={variable.value}
                        onChange={(e) => updateVariable(variable.key, e.target.value)}
                        placeholder={`Valor para {{${variable.key}}}`}
                        className="w-full px-4 py-2 !bg-white !text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-xs text-gray-400 mt-1">
                        Variable: {'{{' + variable.key + '}}'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: System Config */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <span className="text-3xl">⚙️</span>
                <h3 className="text-lg font-medium text-gray-900 mt-2">Configuración del Sistema</h3>
                <p className="text-sm text-gray-500">
                  Ajusta los parámetros de ejecución
                </p>
              </div>

              {!playbookConfig.variables || playbookConfig.variables.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay configuraciones adicionales para este playbook
                </div>
              ) : (
                <div className="space-y-4">
                  {playbookConfig.variables.map((variable) => (
                    <div key={variable.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {variable.label}
                        {variable.required && <span className="text-red-500 ml-1">*</span>}
                      </label>

                      {variable.type === 'select' && variable.options ? (
                        <select
                          value={systemConfig[variable.key] ?? variable.defaultValue ?? ''}
                          onChange={(e) => updateSystemConfig(variable.key, e.target.value)}
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
                          value={systemConfig[variable.key] ?? variable.defaultValue ?? ''}
                          onChange={(e) => updateSystemConfig(variable.key, parseInt(e.target.value))}
                          className="w-full px-4 py-2 !bg-white !text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : variable.type === 'textarea' ? (
                        <textarea
                          value={systemConfig[variable.key] ?? variable.defaultValue ?? ''}
                          onChange={(e) => updateSystemConfig(variable.key, e.target.value)}
                          rows={3}
                          className="w-full px-4 py-2 !bg-white !text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : (
                        <input
                          type="text"
                          value={systemConfig[variable.key] ?? variable.defaultValue ?? ''}
                          onChange={(e) => updateSystemConfig(variable.key, e.target.value)}
                          className="w-full px-4 py-2 !bg-white !text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft size={16} />
            {step > 1 ? 'Atrás' : 'Cancelar'}
          </button>

          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={loading || !canProceed()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Crear Campaña
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
