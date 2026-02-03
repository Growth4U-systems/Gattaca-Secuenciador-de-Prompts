'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Save,
  Loader2,
  X,
  RotateCcw,
  Pencil,
  Check,
  Workflow,
  Settings,
  Variable,
  FileText,
  Trash2,
  Plus,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { useClient } from '@/hooks/useClients'
import { useClientPlaybooks, ClientPlaybook } from '@/hooks/useClientPlaybooks'
import { useToast } from '@/components/ui'
import StepEditor from '@/components/flow/StepEditor'
import { FlowStep, FlowConfig } from '@/types/flow.types'
import { getPlaybookConfig } from '@/components/playbook/configs'

type TabType = 'flow' | 'variables' | 'settings'

export default function EditClientPlaybookPage({
  params,
}: {
  params: { clientId: string; playbookId: string }
}) {
  const router = useRouter()
  const toast = useToast()
  const { client, loading: clientLoading } = useClient(params.clientId)
  const { customPlaybooks, loading: playbooksLoading, updatePlaybook, reload } = useClientPlaybooks(params.clientId)

  const [playbook, setPlaybook] = useState<ClientPlaybook | null>(null)
  const [baseTemplate, setBaseTemplate] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<TabType>('flow')
  const [saving, setSaving] = useState(false)
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')

  // Find the playbook from the loaded list
  useEffect(() => {
    if (!playbooksLoading && customPlaybooks.length > 0) {
      const found = customPlaybooks.find(p => p.id === params.playbookId)
      if (found) {
        setPlaybook(found)
        setEditedName(found.name)

        // Load base template for comparison
        const base = getPlaybookConfig(found.base_template_type)
          || getPlaybookConfig(found.base_template_type.replace('_', '-'))
          || getPlaybookConfig(found.base_template_type.replace('-', '_'))
        setBaseTemplate(base)
      }
    }
  }, [playbooksLoading, customPlaybooks, params.playbookId])

  // Get flow config from playbook or base template
  const flowConfig: FlowConfig = playbook?.config?.flow_config || baseTemplate?.flow_config || { steps: [] }
  const variables = playbook?.config?.variables || baseTemplate?.variables || []

  const handleSaveFlowConfig = async (newFlowConfig: FlowConfig) => {
    if (!playbook) return

    setSaving(true)
    try {
      await updatePlaybook(playbook.id, {
        config: {
          ...playbook.config,
          flow_config: newFlowConfig,
        },
      })
      await reload()
      toast.success('Guardado', 'Configuración del flujo guardada')
    } catch (err: any) {
      toast.error('Error', err.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveName = async () => {
    if (!playbook || !editedName.trim()) return

    setSaving(true)
    try {
      await updatePlaybook(playbook.id, { name: editedName.trim() })
      await reload()
      setIsEditingName(false)
      toast.success('Guardado', 'Nombre actualizado')
    } catch (err: any) {
      toast.error('Error', err.message || 'No se pudo actualizar el nombre')
    } finally {
      setSaving(false)
    }
  }

  const handleStepSave = async (updatedStep: FlowStep) => {
    const newSteps = flowConfig.steps.map(s =>
      s.id === updatedStep.id ? updatedStep : s
    )
    await handleSaveFlowConfig({ ...flowConfig, steps: newSteps })
    setEditingStep(null)
  }

  const handleAddStep = async () => {
    const newStep: FlowStep = {
      id: `step_${Date.now()}`,
      name: `Nuevo Paso ${flowConfig.steps.length + 1}`,
      prompt: '',
      output_format: 'markdown',
      model: 'gemini-2.5-flash',
      order: flowConfig.steps.length,
      base_doc_ids: [],
      auto_receive_from: [],
    }
    await handleSaveFlowConfig({
      ...flowConfig,
      steps: [...flowConfig.steps, newStep],
    })
  }

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('¿Eliminar este paso?')) return
    const newSteps = flowConfig.steps
      .filter(s => s.id !== stepId)
      .map((s, i) => ({ ...s, order: i }))
    await handleSaveFlowConfig({ ...flowConfig, steps: newSteps })
  }

  const handleMoveStep = async (stepId: string, direction: 'up' | 'down') => {
    const steps = [...flowConfig.steps]
    const index = steps.findIndex(s => s.id === stepId)
    if (index < 0) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === steps.length - 1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const [moved] = steps.splice(index, 1)
    steps.splice(newIndex, 0, moved)

    // Update order
    const reordered = steps.map((s, i) => ({ ...s, order: i }))
    await handleSaveFlowConfig({ ...flowConfig, steps: reordered })
  }

  const handleResetToDefault = async () => {
    if (!playbook || !baseTemplate) return
    if (!confirm('¿Restaurar la configuración del flujo al template base? Esto sobrescribirá tus cambios.')) return

    setSaving(true)
    try {
      await updatePlaybook(playbook.id, {
        config: {
          ...playbook.config,
          flow_config: baseTemplate.flow_config,
          variables: baseTemplate.variables,
          phases: baseTemplate.phases,
        },
      })
      await reload()
      toast.success('Restaurado', 'Se restauró la configuración base')
    } catch (err: any) {
      toast.error('Error', err.message || 'No se pudo restaurar')
    } finally {
      setSaving(false)
    }
  }

  const loading = clientLoading || playbooksLoading

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-gray-500">Cargando playbook...</p>
        </div>
      </main>
    )
  }

  if (!playbook || !client) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
            <X className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-900 mb-2">Playbook no encontrado</h2>
            <p className="text-red-700 mb-6">El playbook no existe o no tienes acceso</p>
            <Link
              href={`/clients/${params.clientId}/playbooks`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <ChevronLeft size={18} />
              Volver
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // If editing a step, show the StepEditor
  if (editingStep) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <StepEditor
            step={editingStep}
            projectId="" // Not used in client context
            clientId={params.clientId}
            documents={[]} // No documents at client level
            allSteps={flowConfig.steps}
            projectVariables={variables.map((v: any) => ({
              name: v.name || v.key,
              default_value: v.default || v.defaultValue || '',
              description: v.description || '',
            }))}
            onSave={handleStepSave}
            onCancel={() => setEditingStep(null)}
          />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/clients/${params.clientId}/playbooks`}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 mb-4"
          >
            <ChevronLeft size={16} />
            Volver a Biblioteca
          </Link>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName()
                      if (e.key === 'Escape') {
                        setIsEditingName(false)
                        setEditedName(playbook.name)
                      }
                    }}
                    className="text-2xl font-bold text-gray-900 bg-white border border-indigo-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={saving}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                  >
                    {saving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingName(false)
                      setEditedName(playbook.name)
                    }}
                    className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
                  >
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">{playbook.name}</h1>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              )}
              <p className="text-gray-500 mt-1">
                Cliente: {client.name} | Base: {playbook.base_template_type}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetToDefault}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <RotateCcw size={16} />
                Restaurar Base
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
          {[
            { id: 'flow' as const, label: 'Flujo', icon: Workflow },
            { id: 'variables' as const, label: 'Variables', icon: Variable },
            { id: 'settings' as const, label: 'Configuración', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'flow' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Pasos del Flujo ({flowConfig.steps.length})
              </h2>
              <button
                onClick={handleAddStep}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
              >
                <Plus size={16} />
                Agregar Paso
              </button>
            </div>

            {flowConfig.steps.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <Workflow className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="font-medium text-gray-900 mb-2">Sin pasos definidos</h3>
                <p className="text-gray-500 text-sm mb-4">
                  Agrega pasos al flujo para definir las tareas del playbook
                </p>
                <button
                  onClick={handleAddStep}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                >
                  <Plus size={16} />
                  Agregar Primer Paso
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {flowConfig.steps
                  .sort((a, b) => a.order - b.order)
                  .map((step, index) => (
                    <div
                      key={step.id}
                      className="bg-white rounded-xl border border-gray-200 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleMoveStep(step.id, 'up')}
                            disabled={index === 0 || saving}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={() => handleMoveStep(step.id, 'down')}
                            disabled={index === flowConfig.steps.length - 1 || saving}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>

                        <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900">{step.name}</h4>
                          <p className="text-xs text-gray-500 truncate">
                            {step.model || 'gemini-2.5-flash'} | {step.output_format || 'text'}
                            {step.prompt && ` | ${step.prompt.substring(0, 50)}...`}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingStep(step)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteStep(step.id)}
                            disabled={saving}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'variables' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Variables del Playbook ({variables.length})
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Estas variables se usarán en los prompts del flujo. Los valores se definen a nivel de proyecto.
            </p>

            {variables.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay variables definidas
              </div>
            ) : (
              <div className="space-y-3">
                {variables.map((v: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <code className="text-sm font-mono text-indigo-600">
                        {`{{${v.name || v.key}}}`}
                      </code>
                      {v.description && (
                        <p className="text-xs text-gray-500 mt-1">{v.description}</p>
                      )}
                    </div>
                    {(v.default || v.defaultValue) && (
                      <span className="text-xs text-gray-400">
                        Default: {v.default || v.defaultValue}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuración</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={playbook.description || ''}
                  onChange={async (e) => {
                    try {
                      await updatePlaybook(playbook.id, { description: e.target.value })
                      await reload()
                    } catch (err) {
                      // Ignore
                    }
                  }}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-gray-900"
                  placeholder="Descripción del playbook..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Base
                </label>
                <input
                  type="text"
                  value={playbook.base_template_type}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-gray-500 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Habilitado
                </label>
                <button
                  onClick={async () => {
                    await updatePlaybook(playbook.id, { is_enabled: !playbook.is_enabled })
                    await reload()
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    playbook.is_enabled
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {playbook.is_enabled ? 'Habilitado' : 'Deshabilitado'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Saving indicator */}
        {saving && (
          <div className="fixed bottom-4 right-4 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            Guardando...
          </div>
        )}
      </div>
    </main>
  )
}
