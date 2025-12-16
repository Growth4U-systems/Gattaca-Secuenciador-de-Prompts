'use client'

import { useState, useEffect } from 'react'
import { Save, Edit, FileText, ArrowRight, X, Trash2, Plus, Workflow, ChevronDown, Loader2, Layers, GitBranch } from 'lucide-react'
import { FlowStep, FlowConfig } from '@/types/flow.types'
import { DEFAULT_FLOW_CONFIG } from '@/lib/defaultFlowConfig'
import StepEditor from '../flow/StepEditor'

interface CampaignFlowEditorProps {
  campaignId: string
  initialFlowConfig: FlowConfig | null
  documents: any[]
  projectVariables: any[]
  campaignVariables?: Record<string, string> // Variables reales de la campaña
  onClose: () => void
  onSave: (flowConfig: FlowConfig) => void
}

export default function CampaignFlowEditor({
  campaignId,
  initialFlowConfig,
  documents,
  projectVariables,
  campaignVariables = {},
  onClose,
  onSave,
}: CampaignFlowEditorProps) {
  // If no flow config provided, use default
  const [flowConfig, setFlowConfig] = useState<FlowConfig>(initialFlowConfig || DEFAULT_FLOW_CONFIG)
  const [saving, setSaving] = useState(false)
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (!saving && !editingStep) {
          handleSave()
        }
      }
      // Escape to close
      if (e.key === 'Escape' && !editingStep) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saving, editingStep])

  const handleSave = async () => {
    if (!flowConfig) return

    setSaving(true)
    try {
      const response = await fetch(`/api/campaign/${campaignId}/flow`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ flowConfig }),
      })

      const data = await response.json()

      if (data.success) {
        onSave(flowConfig)
        onClose()
      } else {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error || 'Failed to save'
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('Error saving campaign flow config:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleStepUpdate = (updatedStep: FlowStep) => {
    setFlowConfig((prev) => ({
      ...prev,
      steps: prev.steps.map((step) =>
        step.id === updatedStep.id ? updatedStep : step
      ),
    }))
    setEditingStep(null)
  }

  const handleDeleteStep = (stepId: string, stepName: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar el paso "${stepName}"? Esta acción no se puede deshacer.`)) {
      return
    }

    setFlowConfig((prev) => ({
      ...prev,
      steps: prev.steps.filter((step) => step.id !== stepId),
    }))
  }

  const handleAddStep = () => {
    const newOrder = flowConfig.steps.length > 0
      ? Math.max(...flowConfig.steps.map(s => s.order)) + 1
      : 1

    const newStep: FlowStep = {
      id: `step_${Date.now()}`,
      name: `New Step ${newOrder}`,
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

  const sortedSteps = [...flowConfig.steps].sort((a, b) => a.order - b.order)

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Workflow className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Editar Flujo de Campaña</h2>
                  <p className="text-indigo-100 text-sm mt-1">
                    Personaliza documentos y prompts para esta campaña específica
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2 text-indigo-100 text-sm">
                <Layers size={14} />
                <span>{sortedSteps.length} pasos</span>
              </div>
              <div className="flex items-center gap-2 text-indigo-100 text-sm">
                <FileText size={14} />
                <span>{sortedSteps.reduce((acc, s) => acc + s.base_doc_ids.length, 0)} documentos asignados</span>
              </div>
            </div>
          </div>

          {/* Add Step Button */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-indigo-50/30">
            <button
              onClick={handleAddStep}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 inline-flex items-center gap-2 text-sm font-medium shadow-md hover:shadow-lg transition-all"
            >
              <Plus size={16} />
              Agregar Paso
            </button>
          </div>

          {/* Steps list - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-gray-50/50 to-white">
            {sortedSteps.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-block p-4 bg-indigo-100 rounded-2xl mb-4">
                  <Workflow className="w-12 h-12 text-indigo-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay pasos configurados</h3>
                <p className="text-gray-500 text-sm mb-4">
                  Agrega pasos al flujo para definir el proceso de generación
                </p>
                <button
                  onClick={handleAddStep}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 inline-flex items-center gap-2 text-sm font-medium"
                >
                  <Plus size={16} />
                  Agregar Primer Paso
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedSteps.map((step, index) => (
                  <div key={step.id} className="relative">
                    <div className="group bg-white border border-gray-200 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          {/* Order Badge */}
                          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                            {step.order}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg text-gray-900 group-hover:text-indigo-600 transition-colors">
                              {step.name}
                            </h3>
                            {step.description && (
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{step.description}</p>
                            )}

                            {/* Step Info */}
                            <div className="flex flex-wrap gap-3 mt-3">
                              {/* Documents Badge */}
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                                step.base_doc_ids.length > 0
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                <FileText size={12} />
                                {step.base_doc_ids.length === 0 ? (
                                  <span>Sin documentos</span>
                                ) : (
                                  <span>{step.base_doc_ids.length} documento{step.base_doc_ids.length !== 1 ? 's' : ''}</span>
                                )}
                              </div>

                              {/* Dependencies Badge */}
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                                step.auto_receive_from.length > 0
                                  ? 'bg-purple-50 text-purple-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                <GitBranch size={12} />
                                {step.auto_receive_from.length === 0 ? (
                                  <span>Sin dependencias</span>
                                ) : (
                                  <span>
                                    Recibe de: {step.auto_receive_from.map((stepId) => {
                                      const sourceStep = flowConfig.steps.find((s) => s.id === stepId)
                                      return sourceStep?.name || stepId
                                    }).join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingStep(step)}
                            className="px-3 py-2 text-sm bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-xl hover:from-indigo-100 hover:to-purple-100 inline-flex items-center gap-1.5 font-medium transition-all"
                          >
                            <Edit size={14} />
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteStep(step.id, step.name)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Eliminar paso"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Connection Line */}
                    {index < sortedSteps.length - 1 && (
                      <div className="flex justify-center py-2">
                        <div className="flex flex-col items-center">
                          <div className="w-0.5 h-4 bg-gradient-to-b from-indigo-300 to-purple-300" />
                          <ChevronDown size={16} className="text-indigo-400 -my-1" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-indigo-50/30 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Presiona <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-mono">Ctrl+S</kbd> para guardar
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed inline-flex items-center gap-2 font-medium shadow-md hover:shadow-lg transition-all"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar Flujo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Step editor modal */}
      {editingStep && (
        <StepEditor
          step={editingStep}
          documents={documents}
          allSteps={flowConfig.steps}
          projectVariables={projectVariables}
          campaignVariables={campaignVariables}
          onSave={handleStepUpdate}
          onCancel={() => setEditingStep(null)}
        />
      )}
    </>
  )
}
