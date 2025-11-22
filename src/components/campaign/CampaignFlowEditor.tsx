'use client'

import { useState, useEffect } from 'react'
import { Save, Edit, FileText, ArrowRight, X, Trash2, Plus } from 'lucide-react'
import { FlowStep, FlowConfig } from '@/types/flow.types'
import { DEFAULT_FLOW_CONFIG } from '@/lib/defaultFlowConfig'
import StepEditor from '../flow/StepEditor'

interface CampaignFlowEditorProps {
  campaignId: string
  initialFlowConfig: FlowConfig | null
  documents: any[]
  projectVariables: any[]
  onClose: () => void
  onSave: (flowConfig: FlowConfig) => void
}

export default function CampaignFlowEditor({
  campaignId,
  initialFlowConfig,
  documents,
  projectVariables,
  onClose,
  onSave,
}: CampaignFlowEditorProps) {
  // If no flow config provided, use default
  const [flowConfig, setFlowConfig] = useState<FlowConfig>(initialFlowConfig || DEFAULT_FLOW_CONFIG)
  const [saving, setSaving] = useState(false)
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null)

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
        alert('✅ Campaign flow configuration saved successfully')
        onSave(flowConfig)
        onClose()
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Error saving campaign flow config:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Edit Campaign Flow</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Customize documents and prompts for this specific campaign
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <button
              onClick={handleAddStep}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              Add Step
            </button>
          </div>

          {/* Steps list - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {sortedSteps.map((step, index) => (
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
                        <span className="text-gray-500 italic">(none)</span>
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
            ))}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Campaign Flow'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
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
          onSave={handleStepUpdate}
          onCancel={() => setEditingStep(null)}
        />
      )}
    </>
  )
}
