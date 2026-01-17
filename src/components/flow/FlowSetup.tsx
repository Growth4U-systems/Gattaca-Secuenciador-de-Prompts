'use client'

import { useState, useEffect } from 'react'
import { Save, Edit, FileText, ArrowRight, Trash2, Plus, ChevronUp, ChevronDown, RefreshCw, Workflow, GripVertical, Sparkles, ArrowDown } from 'lucide-react'
import { FlowStep, FlowConfig } from '@/types/flow.types'
import { DEFAULT_FLOW_CONFIG } from '@/lib/defaultFlowConfig'
import StepEditor from './StepEditor'
import { useToast, useModal } from '@/components/ui'

interface FlowSetupProps {
  projectId: string
  clientId: string
  documents: any[]
}

export default function FlowSetup({ projectId, clientId, documents }: FlowSetupProps) {
  const toast = useToast()
  const modal = useModal()

  const [flowConfig, setFlowConfig] = useState<FlowConfig>(DEFAULT_FLOW_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null)
  const [projectVariables, setProjectVariables] = useState<any[]>([])

  // Load flow config and project variables
  useEffect(() => {
    loadFlowConfig()
    loadProjectVariables()
  }, [projectId])

  const loadProjectVariables = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      const data = await response.json()

      if (data.success && data.project) {
        setProjectVariables(data.project.variable_definitions || [])
      }
    } catch (error) {
      console.error('Error loading project variables:', error)
    }
  }

  const loadFlowConfig = async () => {
    try {
      const response = await fetch(`/api/flow/save-config?projectId=${projectId}`)
      const data = await response.json()

      if (data.success && data.flowConfig) {
        setFlowConfig(data.flowConfig)
      } else {
        // Use default config
        setFlowConfig(DEFAULT_FLOW_CONFIG)
      }
    } catch (error) {
      console.error('Error loading flow config:', error)
      toast.error('Error', 'Error al cargar configuración del flow')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/flow/save-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          flowConfig,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Guardado', 'Configuración del flow guardada exitosamente')
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Error saving flow config:', error)
      toast.error('Error al guardar', error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  const handleStepUpdate = async (updatedStep: FlowStep) => {
    // Update local state
    const newConfig = {
      ...flowConfig,
      steps: flowConfig.steps.map((step) =>
        step.id === updatedStep.id ? updatedStep : step
      ),
    }
    setFlowConfig(newConfig)
    setEditingStep(null)

    // Auto-save to API
    try {
      const response = await fetch('/api/flow/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, flowConfig: newConfig }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Guardado', 'Paso guardado automáticamente')
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Auto-save error:', error)
      toast.error('Error al guardar', 'No se pudo guardar automáticamente. Usa el botón Guardar.')
    }
  }

  const handleDeleteStep = async (stepId: string, stepName: string) => {
    const confirmed = await modal.confirm({
      title: 'Eliminar paso',
      message: `¿Estás seguro de que quieres eliminar el paso "${stepName}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    })
    if (!confirmed) return

    setFlowConfig((prev) => ({
      ...prev,
      steps: prev.steps.filter((step) => step.id !== stepId),
    }))
    toast.success('Eliminado', `Paso "${stepName}" eliminado`)
  }

  const handleAddStep = () => {
    const newOrder = flowConfig.steps.length > 0
      ? Math.max(...flowConfig.steps.map(s => s.order)) + 1
      : 1

    const newStep: FlowStep = {
      id: `step_${Date.now()}`,
      name: `Nuevo Paso ${newOrder}`,
      description: '',
      order: newOrder,
      prompt: '',
      base_doc_ids: [],
      auto_receive_from: [],
      output_format: 'text',
    }

    setFlowConfig((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep],
    }))
    setEditingStep(newStep)
  }

  // Move step up (decrease order)
  const handleMoveUp = (stepId: string) => {
    const sortedSteps = [...flowConfig.steps].sort((a, b) => a.order - b.order)
    const currentIndex = sortedSteps.findIndex(s => s.id === stepId)

    if (currentIndex <= 0) return // Already at top

    // Swap orders with previous step
    const currentStep = sortedSteps[currentIndex]
    const prevStep = sortedSteps[currentIndex - 1]

    setFlowConfig((prev) => ({
      ...prev,
      steps: prev.steps.map((step) => {
        if (step.id === currentStep.id) return { ...step, order: prevStep.order }
        if (step.id === prevStep.id) return { ...step, order: currentStep.order }
        return step
      }),
    }))
  }

  // Move step down (increase order)
  const handleMoveDown = (stepId: string) => {
    const sortedSteps = [...flowConfig.steps].sort((a, b) => a.order - b.order)
    const currentIndex = sortedSteps.findIndex(s => s.id === stepId)

    if (currentIndex >= sortedSteps.length - 1) return // Already at bottom

    // Swap orders with next step
    const currentStep = sortedSteps[currentIndex]
    const nextStep = sortedSteps[currentIndex + 1]

    setFlowConfig((prev) => ({
      ...prev,
      steps: prev.steps.map((step) => {
        if (step.id === currentStep.id) return { ...step, order: nextStep.order }
        if (step.id === nextStep.id) return { ...step, order: currentStep.order }
        return step
      }),
    }))
  }

  // Auto-renumber all steps sequentially (1, 2, 3, ...)
  const handleAutoRenumber = () => {
    const sortedSteps = [...flowConfig.steps].sort((a, b) => a.order - b.order)

    setFlowConfig((prev) => ({
      ...prev,
      steps: prev.steps.map((step) => {
        const newOrder = sortedSteps.findIndex(s => s.id === step.id) + 1
        return { ...step, order: newOrder }
      }),
    }))
  }

  // Add a new variable to the project
  const handleAddProjectVariable = async (variable: {
    name: string
    default_value: string
    description?: string
  }) => {
    try {
      // Add to existing variables
      const newVariables = [
        ...projectVariables,
        {
          name: variable.name,
          default_value: variable.default_value || '',
          required: false,
          description: variable.description || '',
        },
      ]

      // Save to API
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variable_definitions: newVariables,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add variable')
      }

      // Update local state
      setProjectVariables(newVariables)
      toast.success('Variable agregada', `Variable "{{ ${variable.name} }}" agregada al proyecto`)
    } catch (error) {
      console.error('Error adding project variable:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error al agregar variable')
      throw error // Re-throw so UI can handle it
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-500">Cargando configuración...</p>
        </div>
      </div>
    )
  }

  const sortedSteps = [...flowConfig.steps].sort((a, b) => a.order - b.order)

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <Workflow className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Configuración del Flow</h2>
              <p className="text-sm text-gray-600 mt-1">
                Configura documentos y prompts para cada paso. Esta configuración se usará en todas las campañas.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAutoRenumber}
              className="px-4 py-2.5 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 inline-flex items-center gap-2 font-medium transition-colors"
              title="Renumerar pasos secuencialmente (1, 2, 3...)"
            >
              <RefreshCw size={18} />
              Renumerar
            </button>
            <button
              onClick={handleAddStep}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 inline-flex items-center gap-2 font-medium shadow-md hover:shadow-lg transition-all"
            >
              <Plus size={18} />
              Agregar Paso
            </button>
          </div>
        </div>
      </div>

      {/* Steps list */}
      <div className="p-6">
        {sortedSteps.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl mb-4">
              <Sparkles className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay pasos configurados</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
              Agrega pasos para definir el flujo de trabajo de tus campañas
            </p>
            <button
              onClick={handleAddStep}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 inline-flex items-center gap-2 font-medium shadow-md"
            >
              <Plus size={18} />
              Crear Primer Paso
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedSteps.map((step, index) => {
              const prevStep = index > 0 ? sortedSteps[index - 1] : null

              return (
                <div key={step.id}>
                  {/* Connection arrow between steps */}
                  {index > 0 && (
                    <div className="flex items-center justify-center py-2">
                      <div className="flex flex-col items-center text-gray-300">
                        <ArrowDown size={20} />
                      </div>
                    </div>
                  )}

                  {/* Step Card */}
                  <div className="group bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-xl p-5 hover:border-indigo-200 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                      {/* Order Badge & Move Controls */}
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-md">
                          {step.order}
                        </div>
                        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleMoveUp(step.id)}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mover arriba"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            onClick={() => handleMoveDown(step.id)}
                            disabled={index === sortedSteps.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mover abajo"
                          >
                            <ChevronDown size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Step Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-lg text-gray-900">{step.name}</h3>
                            {step.description && (
                              <p className="text-sm text-gray-500 mt-1">{step.description}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingStep(step)}
                              className="px-4 py-2 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 inline-flex items-center gap-1.5 font-medium transition-colors"
                            >
                              <Edit size={16} />
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteStep(step.id, step.name)}
                              className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 inline-flex items-center gap-1.5 font-medium transition-colors"
                            >
                              <Trash2 size={16} />
                              Eliminar
                            </button>
                          </div>
                        </div>

                        {/* Step Meta Info */}
                        <div className="flex flex-wrap gap-4 text-sm">
                          {/* Documents */}
                          <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                            <FileText size={16} className="text-blue-500" />
                            <span className="text-blue-700">
                              {step.base_doc_ids.length === 0 ? (
                                <span className="text-blue-400 italic">Sin documentos</span>
                              ) : (
                                <span className="font-medium">{step.base_doc_ids.length} documento{step.base_doc_ids.length !== 1 ? 's' : ''}</span>
                              )}
                            </span>
                          </div>

                          {/* Auto-receives */}
                          <div className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg">
                            <ArrowRight size={16} className="text-purple-500" />
                            <span className="text-purple-700">
                              {step.auto_receive_from.length === 0 ? (
                                <span className="text-purple-400 italic">Sin dependencias</span>
                              ) : (
                                <span className="font-medium">
                                  Recibe de: {step.auto_receive_from.map((stepId) => {
                                    const sourceStep = flowConfig.steps.find((s) => s.id === stepId)
                                    return sourceStep?.name || stepId
                                  }).join(', ')}
                                </span>
                              )}
                            </span>
                          </div>

                          {/* Output format */}
                          <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
                            <span className="text-gray-500 text-xs uppercase font-medium">Formato:</span>
                            <span className="text-gray-700 font-medium">{step.output_format || 'text'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Save button - always visible */}
        <div className="flex justify-end mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-2 font-medium shadow-md hover:shadow-lg transition-all"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={20} />
                Guardar Configuración
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step editor modal */}
      {editingStep && (
        <StepEditor
          step={editingStep}
          projectId={projectId}
          clientId={clientId}
          documents={documents}
          allSteps={flowConfig.steps}
          projectVariables={projectVariables}
          onSave={handleStepUpdate}
          onCancel={() => setEditingStep(null)}
          onAddProjectVariable={handleAddProjectVariable}
        />
      )}
    </div>
  )
}
