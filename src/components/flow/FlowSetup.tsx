'use client'

import { useState, useEffect } from 'react'
import { Save, Edit, FileText, ArrowRight, Trash2, Plus } from 'lucide-react'
import { FlowStep, FlowConfig } from '@/types/flow.types'
import { DEFAULT_FLOW_CONFIG } from '@/lib/defaultFlowConfig'
import StepEditor from './StepEditor'

interface FlowSetupProps {
  projectId: string
  documents: any[]
}

export default function FlowSetup({ projectId, documents }: FlowSetupProps) {
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
      alert('Error al cargar configuración del flow')
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
        alert('✅ Flow configuration saved successfully')
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Error saving flow config:', error)
      alert(`❌ Error al guardar: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cargando configuración...</p>
      </div>
    )
  }

  const sortedSteps = [...flowConfig.steps].sort((a, b) => a.order - b.order)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-2 text-gray-900">Flow Configuration</h2>
          <p className="text-sm text-gray-600">
            Configure documents and prompts for each step. This configuration will be used for all campaigns.
          </p>
        </div>
        <button
          onClick={handleAddStep}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
        >
          <Plus size={18} />
          Add Step
        </button>
      </div>

      {/* Steps list */}
      <div className="space-y-4 mb-6">
        {sortedSteps.map((step, index) => {
          const prevStep = index > 0 ? sortedSteps[index - 1] : null

          return (
            <div key={step.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-900">
                    <span className="text-blue-600">{step.order}.</span>
                    {step.name}
                  </h3>
                  {step.description && (
                    <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingStep(step)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 inline-flex items-center gap-1"
                  >
                    <Edit size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteStep(step.id, step.name)}
                    className="px-3 py-1 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100 inline-flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                {/* Documents */}
                <div className="flex items-start gap-2">
                  <FileText size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <span className="font-medium text-gray-700">Documents:</span>{' '}
                    {step.base_doc_ids.length === 0 ? (
                      <span className="text-gray-500 italic">None assigned</span>
                    ) : (
                      <span className="text-gray-900">
                        {step.base_doc_ids.length} document{step.base_doc_ids.length !== 1 ? 's' : ''} assigned
                      </span>
                    )}
                  </div>
                </div>

                {/* Auto-receives */}
                <div className="flex items-start gap-2">
                  <ArrowRight size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <span className="font-medium text-gray-700">Auto-receives:</span>{' '}
                    {step.auto_receive_from.length === 0 ? (
                      <span className="text-gray-500 italic">(none - first steps)</span>
                    ) : (
                      <span className="text-gray-900">
                        {step.auto_receive_from.map((stepId) => {
                          const sourceStep = flowConfig.steps.find((s) => s.id === stepId)
                          return sourceStep?.name || stepId
                        }).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Connection arrow to next step */}
              {index < sortedSteps.length - 1 && (
                <div className="mt-3 flex items-center justify-center text-gray-400">
                  <ArrowRight size={20} className="transform rotate-90" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Flow Configuration'}
        </button>
      </div>

      {/* Step editor modal */}
      {editingStep && (
        <StepEditor
          step={editingStep}
          documents={documents}
          allSteps={flowConfig.steps}
          projectVariables={projectVariables}
          onSave={handleStepUpdate}
          onCancel={() => setEditingStep(null)}
        />
      )}
    </div>
  )
}
