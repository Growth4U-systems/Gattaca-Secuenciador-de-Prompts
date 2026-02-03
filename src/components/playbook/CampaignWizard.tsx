'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react'
import { PlaybookConfig } from './types'
import { getDefaultPromptForStep } from './utils/getDefaultPrompts'
import DocumentChecklist, { useDocumentStatus } from './DocumentChecklist'
import {
  COMPETITOR_ANALYSIS_STEP_REQUIREMENTS,
  getAllDocumentRequirements,
  ScraperInputsForm,
  type CampaignVariables,
} from './configs/competitor-analysis.config'
import type { StepRequirements, DocumentRequirement, DocumentStatus } from './DocumentRequirementsMap'

interface CampaignWizardProps {
  projectId: string
  playbookConfig: PlaybookConfig
  onClose: () => void
  onCreated: (campaignId: string) => void
  /** Project documents for document checklist matching */
  projectDocuments?: Array<{
    id: string
    name: string
    category?: string
    folder?: string
  }>
  /** Callback when user wants to import a document */
  onImportDocument?: (requirement: DocumentRequirement, stepId: string) => void
}

interface PromptVariable {
  key: string
  label: string
  value: string
  description?: string
  placeholder?: string
  required?: boolean
}

// Descriptions for common prompt variables based on their usage in prompts
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
  niche: {
    description: 'El nicho específico de mercado al que te diriges.',
    placeholder: 'Ej: Gestión fiscal para freelancers tech',
  },
  problem: {
    description: 'El problema principal que tu producto resuelve.',
    placeholder: 'Ej: Dificultad para gestionar facturas y declaraciones trimestrales',
  },
  solution: {
    description: 'La solución que ofreces al problema identificado.',
    placeholder: 'Ej: Automatización de facturación y declaraciones fiscales',
  },
  competitor: {
    description: 'Competidores o alternativas existentes en el mercado.',
    placeholder: 'Ej: Holded, Quaderno, Contasimple',
  },
  value_proposition: {
    description: 'Lo que diferencia tu producto de la competencia.',
    placeholder: 'Ej: Integración directa con hacienda y bancos',
  },
}

export default function CampaignWizard({
  projectId,
  playbookConfig,
  onClose,
  onCreated,
  projectDocuments = [],
  onImportDocument,
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

  // Step 3: Scraper inputs (URLs, usernames)
  const [scraperInputValues, setScraperInputValues] = useState<Record<string, string>>({})

  // Determine if this playbook has document requirements
  const documentRequirements = useMemo<StepRequirements[]>(() => {
    // Check if this is a competitor analysis playbook
    if (
      playbookConfig.type === 'competitor_analysis' ||
      playbookConfig.type === 'competitor-analysis' ||
      playbookConfig.id?.includes('competitor')
    ) {
      return COMPETITOR_ANALYSIS_STEP_REQUIREMENTS
    }
    // Future: Add other playbook document requirements here
    return []
  }, [playbookConfig])

  const hasDocumentRequirements = documentRequirements.some(s => s.documents.length > 0)

  // Get document status for checklist
  const allRequiredDocs = useMemo(() => getAllDocumentRequirements(), [])
  const documentStatuses = useDocumentStatus(allRequiredDocs, projectDocuments)

  // Initialize variables from playbook config
  useEffect(() => {
    const initializeVariables = () => {
      // Get all text/textarea variables (both required and optional)
      const allVariables = playbookConfig.variables || []

      // Filter to text-input variables and map to our format
      const textVariables = allVariables
        .filter(v => !v.type || v.type === 'text' || v.type === 'textarea')
        .map(v => ({
          key: v.key,
          label: v.label || formatLabel(v.key),
          value: v.defaultValue?.toString() || '',
          description: v.description || VARIABLE_DESCRIPTIONS[v.key]?.description,
          placeholder: v.placeholder || VARIABLE_DESCRIPTIONS[v.key]?.placeholder,
          required: v.required === true,
        }))

      console.log('[CampaignWizard] textVariables:', textVariables)
      setPromptVariables(textVariables)

      // Step 3: System config (select, number, etc. - non-text variables)
      const initialConfig: Record<string, any> = {}
      playbookConfig.variables?.forEach(v => {
        if (v.type && v.type !== 'text' && v.type !== 'textarea') {
          // Only system config variables (select, number)
          initialConfig[v.key] = v.defaultValue
        }
      })
      setSystemConfig(initialConfig)
    }

    initializeVariables()
  }, [playbookConfig])

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

  // Handle step navigation
  const handleNextStep = async () => {
    if (!canProceed()) return
    setStep(step + 1)
  }

  // Calculate total steps dynamically based on whether we have document requirements
  const totalSteps = hasDocumentRequirements ? 4 : 3

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return campaignName.trim().length > 0
      case 2:
        return promptVariables.filter(v => v.required).every(v => v.value.trim().length > 0)
      case 3:
        // Document checklist step (if present) - always can proceed, just informational
        return true
      case 4:
        // System config (moved to step 4 when docs present)
        return true
      default:
        return false
    }
  }

  // Determine which content to show based on whether we have document requirements
  const getStepContent = () => {
    if (hasDocumentRequirements) {
      // With documents: 1=Basic, 2=Variables, 3=Documents, 4=Config
      return {
        basic: 1,
        variables: 2,
        documents: 3,
        config: 4,
      }
    }
    // Without documents: 1=Basic, 2=Variables, 3=Config
    return {
      basic: 1,
      variables: 2,
      documents: -1, // Never shown
      config: 3,
    }
  }
  const stepMapping = getStepContent()

  const handleCreate = async () => {
    setLoading(true)
    setError(null)

    try {
      // Build custom variables from prompt variables
      const customVariables: Record<string, string> = {}
      promptVariables.forEach(v => {
        customVariables[v.key] = v.value
      })

      // Merge with system config and scraper inputs
      const allVariables = { ...customVariables, ...systemConfig, ...scraperInputValues }

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
          flow_config: playbookConfig.flow_config || null,
          playbook_type: playbookConfig.type, // Campaign-specific playbook type
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

  // Get competitor name from prompt variables for Knowledge Base
  const competitorName = useMemo(() => {
    const competitorVar = promptVariables.find(v => v.key === 'competitor_name')
    return competitorVar?.value || ''
  }, [promptVariables])

  // Get scraper inputs from prompt variables
  const scraperInputs = useMemo((): Partial<CampaignVariables> => {
    const inputs: Partial<CampaignVariables> = {}
    promptVariables.forEach(v => {
      if (v.value) {
        inputs[v.key as keyof CampaignVariables] = v.value
      }
    })
    return inputs
  }, [promptVariables])

  return (
    <div className="flex flex-col h-full min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Full-screen wizard header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <X size={20} />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Nueva Campaña</h2>
            <p className="text-sm text-gray-500">Paso {step} de {totalSteps}</p>
          </div>
        </div>
        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`h-2 w-8 rounded-full transition-colors ${
                i + 1 <= step ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>

      {/* Content - full height */}
      <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            {/* Step: Basic Info */}
          {step === stepMapping.basic && (
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

          {/* Step: Prompt Variables */}
          {step === stepMapping.variables && (
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
                      {variable.description && (
                        <p className="text-xs text-gray-500 mb-2">{variable.description}</p>
                      )}
                      <input
                        type="text"
                        value={variable.value}
                        onChange={(e) => updateVariable(variable.key, e.target.value)}
                        placeholder={variable.placeholder || `Valor para {{${variable.key}}}`}
                        className="w-full px-4 py-2 !bg-white !text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-xs text-gray-400 mt-1 block">
                        Variable: {'{{' + variable.key + '}}'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Scraper Inputs (URLs, usernames) */}
          {step === stepMapping.documents && hasDocumentRequirements && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <span className="text-3xl">🔗</span>
                <h3 className="text-lg font-medium text-gray-900 mt-2">Fuentes de Datos</h3>
                <p className="text-sm text-gray-500">
                  Configura las URLs y perfiles del competidor para extraer informacion
                </p>
              </div>

              <ScraperInputsForm
                competitorName={competitorName}
                initialValues={scraperInputValues}
                onChange={setScraperInputValues}
              />
            </div>
          )}

          {/* Step: System Config */}
          {step === stepMapping.config && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <span className="text-3xl">⚙️</span>
                <h3 className="text-lg font-medium text-gray-900 mt-2">Configuración del Sistema</h3>
                <p className="text-sm text-gray-500">
                  Ajusta los parámetros de ejecución
                </p>
              </div>

              {(() => {
                // Only show non-text variables (select, number, etc.)
                const systemVariables = (playbookConfig.variables || [])
                  .filter(v => v.type && v.type !== 'text' && v.type !== 'textarea')

                if (systemVariables.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      No hay configuraciones adicionales para este playbook
                    </div>
                  )
                }

                return (
                  <div className="space-y-4">
                    {systemVariables.map((variable) => (
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
                )
              })()}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          )}
          </div>
        </div>

      {/* Footer - sticky at bottom */}
      <div className="flex items-center justify-between px-8 py-4 border-t border-gray-200 bg-white shadow-lg">
            <button
              onClick={() => step > 1 ? setStep(step - 1) : onClose()}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft size={16} />
              {step > 1 ? 'Atrás' : 'Cancelar'}
            </button>

            {step < totalSteps ? (
              <button
                onClick={handleNextStep}
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
  )
}
