'use client'

import { useState, useEffect } from 'react'
import { Play, CheckCircle, Clock, AlertCircle, Download, Plus, X, Edit2, ChevronDown, ChevronRight, Settings } from 'lucide-react'
import CampaignFlowEditor from './CampaignFlowEditor'
import { FlowConfig } from '@/types/flow.types'

interface CampaignRunnerProps {
  projectId: string
}

interface Campaign {
  id: string
  ecp_name: string
  problem_core: string
  country: string
  industry: string
  status: string
  current_step_id: string | null
  step_outputs: Record<string, any>
  started_at: string | null
  completed_at: string | null
  created_at: string
  custom_variables?: Record<string, string> | any
  flow_config?: FlowConfig | null
}

interface FlowStep {
  id: string
  name: string
  description?: string
  order: number
  prompt: string
  base_doc_ids: string[]
  auto_receive_from: string[]
  model?: string
  temperature?: number
  max_tokens?: number
}

interface Project {
  id: string
  name: string
  variable_definitions: Array<{
    name: string
    default_value: string
    required: boolean
    description?: string
  }>
  flow_config?: {
    steps: FlowStep[]
    version?: string
    description?: string
  }
}

export default function CampaignRunner({ projectId }: CampaignRunnerProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  const [runningStep, setRunningStep] = useState<{ campaignId: string; stepId: string } | null>(null)
  const [editingFlowCampaignId, setEditingFlowCampaignId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<any[]>([])

  // Form state
  const [ecpName, setEcpName] = useState('')
  const [problemCore, setProblemCore] = useState('')
  const [country, setCountry] = useState('')
  const [industry, setIndustry] = useState('')
  const [customVariables, setCustomVariables] = useState<Array<{ key: string; value: string }>>([])

  const addCustomVariable = () => {
    setCustomVariables([...customVariables, { key: '', value: '' }])
  }

  const updateCustomVariable = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customVariables]
    updated[index][field] = value
    setCustomVariables(updated)
  }

  const removeCustomVariable = (index: number) => {
    setCustomVariables(customVariables.filter((_, i) => i !== index))
  }

  useEffect(() => {
    loadProject()
    loadCampaigns()
    loadDocuments()
  }, [projectId])

  const loadProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      const data = await response.json()

      if (data.success && data.project) {
        setProject(data.project)
      }
    } catch (error) {
      console.error('Error loading project:', error)
    }
  }

  const loadDocuments = async () => {
    try {
      const response = await fetch(`/api/documents?projectId=${projectId}`)
      const data = await response.json()

      if (data.success) {
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Error loading documents:', error)
    }
  }

  const loadCampaigns = async () => {
    try {
      const response = await fetch(`/api/campaign/create?projectId=${projectId}`)
      const data = await response.json()

      if (data.success) {
        setCampaigns(data.campaigns || [])
      }
    } catch (error) {
      console.error('Error loading campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const openNewCampaignForm = () => {
    // Auto-fill custom variables with project definitions
    if (project?.variable_definitions) {
      const varsFromProject = project.variable_definitions.map((varDef) => ({
        key: varDef.name,
        value: varDef.default_value || '',
      }))
      setCustomVariables(varsFromProject)
    }
    setEditingCampaignId(null)
    setShowNewForm(true)
  }

  const handleEditCampaign = (campaign: Campaign) => {
    // Load campaign data into form
    setEcpName(campaign.ecp_name)
    setProblemCore(campaign.problem_core)
    setCountry(campaign.country)
    setIndustry(campaign.industry)

    // Load custom variables
    const customVars = campaign.custom_variables as Record<string, string> || {}
    const varsArray = Object.entries(customVars).map(([key, value]) => ({ key, value }))
    setCustomVariables(varsArray)

    setEditingCampaignId(campaign.id)
    setShowNewForm(true)
  }

  const handleCreateCampaign = async () => {
    if (!ecpName || !problemCore || !country || !industry) {
      alert('Por favor completa todos los campos')
      return
    }

    // Convert custom variables array to object
    const customVarsObject: Record<string, string> = {}
    customVariables.forEach((v) => {
      if (v.key.trim()) {
        customVarsObject[v.key.trim()] = v.value
      }
    })

    setCreating(true)
    try {
      const isEditing = !!editingCampaignId
      const url = isEditing
        ? `/api/campaign/${editingCampaignId}`
        : '/api/campaign/create'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          ecp_name: ecpName,
          problem_core: problemCore,
          country,
          industry,
          custom_variables: customVarsObject,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(isEditing ? '✅ Campaign updated successfully' : '✅ Campaign created successfully')
        setShowNewForm(false)
        setEcpName('')
        setProblemCore('')
        setCountry('')
        setIndustry('')
        setCustomVariables([])
        setEditingCampaignId(null)
        loadCampaigns()
      } else {
        // Show detailed error message
        let errorMsg = data.error || 'Failed to create campaign'
        if (data.details) {
          errorMsg += `\n\nDetails: ${data.details}`
        }
        if (data.hint) {
          errorMsg += `\n\nHint: ${data.hint}`
        }
        if (data.code) {
          errorMsg += `\n\nError code: ${data.code}`
        }
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('Error creating campaign:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setCreating(false)
    }
  }

  const handleRunCampaign = async (campaignId: string) => {
    if (!confirm('¿Ejecutar esta campaña? Esto puede tomar varios minutos.')) {
      return
    }

    setRunning(campaignId)
    try {
      const response = await fetch('/api/campaign/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaignId }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ Campaign completed! ${data.steps_completed} steps executed in ${(data.duration_ms / 1000).toFixed(1)}s`)
        loadCampaigns()
      } else {
        // Show detailed error message
        let errorMsg = data.error || 'Execution failed'
        if (data.details) {
          errorMsg += `\n\nDetalles: ${data.details}`
        }
        if (data.completed_steps && data.completed_steps.length > 0) {
          errorMsg += `\n\nPasos completados: ${data.completed_steps.length}`
        }
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('Error running campaign:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setRunning(null)
    }
  }

  const handleRunStep = async (campaignId: string, stepId: string, stepName: string) => {
    if (!confirm(`¿Ejecutar paso "${stepName}"? Esto puede tomar algunos minutos.`)) {
      return
    }

    setRunningStep({ campaignId, stepId })
    try {
      const response = await fetch('/api/campaign/run-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaignId, stepId }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ Step "${stepName}" completed in ${(data.duration_ms / 1000).toFixed(1)}s`)
        loadCampaigns()
      } else {
        // Show detailed error message
        let errorMsg = data.error || 'Execution failed'
        if (data.details) {
          errorMsg += `\n\nDetalles: ${data.details}`
        }
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('Error running step:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setRunningStep(null)
    }
  }

  const toggleCampaignExpanded = (campaignId: string) => {
    const newExpanded = new Set(expandedCampaigns)
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId)
    } else {
      newExpanded.add(campaignId)
    }
    setExpandedCampaigns(newExpanded)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={20} className="text-green-600" />
      case 'running':
        return <Clock size={20} className="text-blue-600 animate-spin" />
      case 'error':
        return <AlertCircle size={20} className="text-red-600" />
      default:
        return <Clock size={20} className="text-gray-400" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed'
      case 'running':
        return 'Running...'
      case 'error':
        return 'Error'
      case 'draft':
        return 'Ready to run'
      default:
        return status
    }
  }

  const getStepStatus = (campaign: Campaign, stepId: string) => {
    if (campaign.step_outputs && campaign.step_outputs[stepId]) {
      const output = campaign.step_outputs[stepId]
      return output.status || 'completed'
    }
    return 'pending'
  }

  const isStepRunning = (campaignId: string, stepId: string) => {
    return runningStep?.campaignId === campaignId && runningStep?.stepId === stepId
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cargando campañas...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Campañas</h2>
        <button
          onClick={() => {
            if (showNewForm) {
              setShowNewForm(false)
            } else {
              openNewCampaignForm()
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showNewForm ? 'Cancelar' : '+ Nueva Campaña'}
        </button>
      </div>

      {/* New Campaign Form */}
      {showNewForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold mb-4">
            {editingCampaignId ? 'Edit Campaign' : 'Create New Campaign'}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                <span>ECP Name *</span>
                <code className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {'{{'} ecp_name {'}}'}
                </code>
              </label>
              <input
                type="text"
                value={ecpName}
                onChange={(e) => setEcpName(e.target.value)}
                placeholder="e.g., Fintech for SMEs"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                <span>Problem Core *</span>
                <code className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {'{{'} problem_core {'}}'}
                </code>
              </label>
              <input
                type="text"
                value={problemCore}
                onChange={(e) => setProblemCore(e.target.value)}
                placeholder="e.g., Access to credit"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                  <span>Country *</span>
                  <code className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {'{{'} country {'}}'}
                  </code>
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g., Mexico"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                  <span>Industry *</span>
                  <code className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {'{{'} industry {'}}'}
                  </code>
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g., Financial Services"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
            </div>

            {/* Custom Variables Section */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Variables Personalizadas
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Define variables que se reemplazarán en los prompts con formato {'{{'} {'{variable}'} {'}}'}
                  </p>
                </div>
                <button
                  onClick={addCustomVariable}
                  className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 inline-flex items-center gap-1"
                >
                  <Plus size={16} />
                  Agregar Variable
                </button>
              </div>

              {customVariables.length > 0 && (
                <div className="space-y-2">
                  {customVariables.map((variable, index) => {
                    const isProjectVariable = project?.variable_definitions?.some(
                      (v) => v.name === variable.key
                    )
                    const varDef = project?.variable_definitions?.find(
                      (v) => v.name === variable.key
                    )

                    return (
                      <div key={index} className="flex items-center gap-2">
                        {isProjectVariable ? (
                          <>
                            <div className="w-1/3 px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm font-mono text-gray-700 flex items-center gap-2">
                              {'{{'}{variable.key}{'}}'}
                              {varDef?.required && (
                                <span className="text-red-500 text-xs">*</span>
                              )}
                            </div>
                            <span className="text-gray-400">=</span>
                            <input
                              type="text"
                              value={variable.value}
                              onChange={(e) => updateCustomVariable(index, 'value', e.target.value)}
                              placeholder={varDef?.description || 'Valor de la variable'}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder:text-gray-400"
                              required={varDef?.required}
                            />
                            <div className="w-10"></div> {/* Spacing for alignment */}
                          </>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={variable.key}
                              onChange={(e) => updateCustomVariable(index, 'key', e.target.value)}
                              placeholder="nombre_variable"
                              className="w-1/3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder:text-gray-400"
                            />
                            <span className="text-gray-400">=</span>
                            <input
                              type="text"
                              value={variable.value}
                              onChange={(e) => updateCustomVariable(index, 'value', e.target.value)}
                              placeholder="Valor de la variable"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder:text-gray-400"
                            />
                            <button
                              onClick={() => removeCustomVariable(index)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <X size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {customVariables.length === 0 && (
                <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <p className="text-sm text-gray-500">
                    No hay variables personalizadas. Click en "Agregar Variable" para crear una.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCreateCampaign}
                disabled={creating}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {creating
                  ? (editingCampaignId ? 'Updating...' : 'Creating...')
                  : (editingCampaignId ? 'Update Campaign' : 'Create Campaign')
                }
              </button>
              <button
                onClick={() => setShowNewForm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns List */}
      {campaigns.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No hay campañas todavía</p>
          <p className="text-sm mt-2">Crea una campaña para empezar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{campaign.ecp_name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {campaign.problem_core} • {campaign.country} • {campaign.industry}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(campaign.status)}
                  <span className="text-sm font-medium">
                    {getStatusLabel(campaign.status)}
                  </span>
                </div>
              </div>

              {/* Step outputs summary */}
              {campaign.step_outputs && Object.keys(campaign.step_outputs).length > 0 && (
                <div className="mb-3 text-sm text-gray-600">
                  <p>
                    Steps completed: {Object.keys(campaign.step_outputs).length}
                  </p>
                </div>
              )}

              {/* Individual Steps Section */}
              {(campaign.flow_config?.steps || project?.flow_config?.steps) && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => toggleCampaignExpanded(campaign.id)}
                      className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                    >
                      {expandedCampaigns.has(campaign.id) ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                      Individual Steps ({(campaign.flow_config?.steps || project?.flow_config?.steps)?.length})
                    </button>
                    {campaign.status === 'draft' && (
                      <button
                        onClick={() => setEditingFlowCampaignId(campaign.id)}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 inline-flex items-center gap-1"
                      >
                        <Settings size={12} />
                        Edit Flow
                      </button>
                    )}
                  </div>

                  {expandedCampaigns.has(campaign.id) && (
                    <div className="ml-6 space-y-2 border-l-2 border-gray-200 pl-4">
                      {(campaign.flow_config?.steps || project?.flow_config?.steps || [])
                        .sort((a, b) => a.order - b.order)
                        .map((step) => {
                          const stepStatus = getStepStatus(campaign, step.id)
                          const stepRunning = isStepRunning(campaign.id, step.id)
                          const stepOutput = campaign.step_outputs?.[step.id]

                          return (
                            <div
                              key={step.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-500">
                                    Step {step.order}
                                  </span>
                                  <h4 className="font-medium text-sm">{step.name}</h4>
                                  {stepStatus === 'completed' && (
                                    <CheckCircle size={16} className="text-green-600" />
                                  )}
                                  {stepRunning && (
                                    <Clock size={16} className="text-blue-600 animate-spin" />
                                  )}
                                </div>
                                {step.description && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {step.description}
                                  </p>
                                )}
                                {stepOutput && (
                                  <div className="text-xs text-gray-600 mt-1">
                                    <span className="font-medium">Tokens:</span> {stepOutput.tokens || 'N/A'}
                                    {stepOutput.completed_at && (
                                      <span className="ml-3">
                                        <span className="font-medium">Completed:</span>{' '}
                                        {new Date(stepOutput.completed_at).toLocaleTimeString()}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="ml-4 flex gap-2">
                                <button
                                  onClick={() => handleRunStep(campaign.id, step.id, step.name)}
                                  disabled={stepRunning || running === campaign.id}
                                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                >
                                  <Play size={14} />
                                  {stepRunning ? 'Running...' : 'Run'}
                                </button>
                                {stepOutput && stepOutput.output && (
                                  <button
                                    onClick={() => {
                                      const text = `=== ${step.name} ===\n\n${stepOutput.output}\n\nTokens: ${stepOutput.tokens || 'N/A'}\nCompleted: ${stepOutput.completed_at || 'N/A'}`
                                      const blob = new Blob([text], { type: 'text/plain' })
                                      const url = URL.createObjectURL(blob)
                                      const a = document.createElement('a')
                                      a.href = url
                                      a.download = `${campaign.ecp_name.replace(/\s+/g, '_')}_${step.name.replace(/\s+/g, '_')}.txt`
                                      a.click()
                                    }}
                                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 inline-flex items-center gap-1"
                                  >
                                    <Download size={14} />
                                    Download
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                {campaign.status === 'draft' && (
                  <>
                    <button
                      onClick={() => handleEditCampaign(campaign)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2"
                    >
                      <Edit2 size={16} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleRunCampaign(campaign.id)}
                      disabled={running === campaign.id}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                      <Play size={16} />
                      {running === campaign.id ? 'Running...' : 'Run Campaign'}
                    </button>
                  </>
                )}

                {campaign.status === 'completed' && (
                  <button
                    onClick={() => {
                      const outputs = campaign.step_outputs
                      const text = Object.entries(outputs)
                        .map(([stepId, data]: [string, any]) => {
                          return `=== ${data.step_name} ===\n\n${data.output}\n\n`
                        })
                        .join('\n')

                      const blob = new Blob([text], { type: 'text/plain' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${campaign.ecp_name.replace(/\s+/g, '_')}_outputs.txt`
                      a.click()
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2"
                  >
                    <Download size={16} />
                    Download Outputs
                  </button>
                )}

                {campaign.status === 'completed' && (
                  <button
                    onClick={() => {
                      const outputs = campaign.step_outputs
                      const message = Object.entries(outputs)
                        .map(([stepId, data]: [string, any]) => {
                          return `${data.step_name}:\n${data.output.substring(0, 200)}...`
                        })
                        .join('\n\n')
                      alert(message)
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    View Summary
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-500 mt-3">
                Created: {new Date(campaign.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Campaign Flow Editor */}
      {editingFlowCampaignId && (
        <CampaignFlowEditor
          campaignId={editingFlowCampaignId}
          initialFlowConfig={campaigns.find(c => c.id === editingFlowCampaignId)?.flow_config || project?.flow_config || null}
          documents={documents}
          projectVariables={project?.variable_definitions || []}
          onClose={() => setEditingFlowCampaignId(null)}
          onSave={(flowConfig) => {
            // Update local campaign state
            setCampaigns(prev => prev.map(c =>
              c.id === editingFlowCampaignId ? { ...c, flow_config: flowConfig } : c
            ))
            setEditingFlowCampaignId(null)
          }}
        />
      )}
    </div>
  )
}
