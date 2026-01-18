'use client'

import { useState, useEffect } from 'react'
import { PlaybookConfig, PhaseDefinition, StepDefinition } from './types'
import { ChevronDown, ChevronRight, Save, Edit3, X, Check, Settings } from 'lucide-react'

interface ConfigurationModeProps {
  projectId: string
  playbookConfig: PlaybookConfig
  onSave?: () => void
}

interface FlowStep {
  id: string
  name: string
  prompt?: string
  model?: string
  temperature?: number
  max_tokens?: number
  [key: string]: any
}

interface FlowConfig {
  steps: FlowStep[]
  version?: string
}

export default function ConfigurationMode({
  projectId,
  playbookConfig,
  onSave,
}: ConfigurationModeProps) {
  const [flowConfig, setFlowConfig] = useState<FlowConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set())
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editedPrompt, setEditedPrompt] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Load flow config from project
  useEffect(() => {
    const loadFlowConfig = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`)
        const data = await response.json()
        if (data.project?.legacy_flow_config) {
          setFlowConfig(data.project.legacy_flow_config)
        }
      } catch (error) {
        console.error('Error loading flow config:', error)
      } finally {
        setLoading(false)
      }
    }
    loadFlowConfig()
  }, [projectId])

  // Toggle phase expansion
  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phaseId)) {
        next.delete(phaseId)
      } else {
        next.add(phaseId)
      }
      return next
    })
  }

  // Get prompt for a step from flow config
  const getStepPrompt = (stepDef: StepDefinition): string => {
    if (!flowConfig?.steps) return ''
    const flowStep = flowConfig.steps.find(s =>
      s.id === stepDef.id || s.name?.toLowerCase() === stepDef.name.toLowerCase()
    )
    return flowStep?.prompt || ''
  }

  // Start editing a step
  const startEditing = (stepDef: StepDefinition) => {
    setEditingStepId(stepDef.id)
    setEditedPrompt(getStepPrompt(stepDef))
  }

  // Save prompt changes locally
  const savePromptLocal = (stepDef: StepDefinition) => {
    if (!flowConfig) return

    const newSteps = flowConfig.steps.map(s => {
      if (s.id === stepDef.id || s.name?.toLowerCase() === stepDef.name.toLowerCase()) {
        return { ...s, prompt: editedPrompt }
      }
      return s
    })

    setFlowConfig({ ...flowConfig, steps: newSteps })
    setEditingStepId(null)
    setHasChanges(true)
  }

  // Save all changes to database
  const saveAllChanges = async () => {
    if (!flowConfig) return

    setSaving(true)
    try {
      const response = await fetch('/api/flow/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          flowConfig,
        }),
      })

      if (!response.ok) {
        throw new Error('Error saving configuration')
      }

      setHasChanges(false)
      onSave?.()
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Settings className="text-gray-500" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Configuración Base</h3>
        </div>
        {hasChanges && (
          <button
            onClick={saveAllChanges}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <p className="text-sm text-gray-600 mb-6">
            Edita los prompts base de cada paso. Estos prompts serán heredados por todas las nuevas campañas.
          </p>

          {playbookConfig.phases.map((phase) => (
            <div
              key={phase.id}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* Phase header */}
              <button
                onClick={() => togglePhase(phase.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedPhases.has(phase.id) ? (
                    <ChevronDown size={18} className="text-gray-500" />
                  ) : (
                    <ChevronRight size={18} className="text-gray-500" />
                  )}
                  <span className="font-medium text-gray-900">{phase.name}</span>
                  <span className="text-sm text-gray-500">
                    ({phase.steps.length} pasos)
                  </span>
                </div>
              </button>

              {/* Phase steps */}
              {expandedPhases.has(phase.id) && (
                <div className="divide-y divide-gray-100">
                  {phase.steps.map((step) => (
                    <div key={step.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900">{step.name}</h4>
                          {step.description && (
                            <p className="text-sm text-gray-500">{step.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              step.executor === 'llm' ? 'bg-purple-100 text-purple-700' :
                              step.executor === 'job' ? 'bg-orange-100 text-orange-700' :
                              step.executor === 'api' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {step.executor}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                              {step.type}
                            </span>
                          </div>
                        </div>

                        {step.executor === 'llm' && editingStepId !== step.id && (
                          <button
                            onClick={() => startEditing(step)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit3 size={14} />
                            Editar Prompt
                          </button>
                        )}
                      </div>

                      {/* Prompt display or editor */}
                      {step.executor === 'llm' && (
                        <>
                          {editingStepId === step.id ? (
                            <div className="mt-3">
                              <textarea
                                value={editedPrompt}
                                onChange={(e) => setEditedPrompt(e.target.value)}
                                className="w-full h-64 p-3 !bg-white !text-gray-900 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Escribe el prompt..."
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <button
                                  onClick={() => setEditingStepId(null)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                  <X size={14} />
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => savePromptLocal(step)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
                                >
                                  <Check size={14} />
                                  Aplicar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                                {getStepPrompt(step) || '(Sin prompt configurado)'}
                              </pre>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* System variables section */}
          {playbookConfig.variables && playbookConfig.variables.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden mt-6">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Variables del Sistema</h3>
                <p className="text-sm text-gray-500">
                  Estas variables se configuran al crear cada campaña
                </p>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  {playbookConfig.variables.map((variable) => (
                    <div key={variable.key} className="flex flex-col">
                      <span className="text-sm font-medium text-gray-700">
                        {variable.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        {'{{' + variable.key + '}}'}
                        {variable.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                      {variable.defaultValue && (
                        <span className="text-xs text-gray-400 mt-1">
                          Default: {String(variable.defaultValue)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
