'use client'

import { useState, useEffect } from 'react'
import { Play, CheckCircle, Clock, AlertCircle, Download, Plus, X, Edit2, ChevronDown, ChevronRight, Settings, Trash2, Check } from 'lucide-react'
import CampaignFlowEditor from './CampaignFlowEditor'
import { FlowConfig, FlowStep } from '@/types/flow.types'

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

interface Project {
  id: string
  name: string
  variable_definitions: Array<{
    name: string
    default_value: string
    required: boolean
    description?: string
  }>
  flow_config?: FlowConfig
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
  const [editingCampaignName, setEditingCampaignName] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')

  // Form state - only custom variables
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
    // Load all campaign variables (both custom and legacy fields)
    const allVars: Record<string, string> = {}

    // Include legacy fields as variables
    if (campaign.ecp_name) allVars.ecp_name = campaign.ecp_name
    if (campaign.problem_core) allVars.problem_core = campaign.problem_core
    if (campaign.country) allVars.country = campaign.country
    if (campaign.industry) allVars.industry = campaign.industry

    // Include custom variables
    const customVars = campaign.custom_variables as Record<string, string> || {}
    Object.entries(customVars).forEach(([key, value]) => {
      allVars[key] = value
    })

    const varsArray = Object.entries(allVars).map(([key, value]) => ({ key, value }))
    setCustomVariables(varsArray)

    setEditingCampaignId(campaign.id)
    setShowNewForm(true)
  }

  const handleCreateCampaign = async () => {
    // Convert custom variables array to object
    const customVarsObject: Record<string, string> = {}
    customVariables.forEach((v) => {
      if (v.key.trim()) {
        customVarsObject[v.key.trim()] = v.value
      }
    })

    // Extract legacy fields from variables for backwards compatibility with database
    const ecpName = customVarsObject.ecp_name || 'Unnamed Campaign'
    const problemCore = customVarsObject.problem_core || ''
    const country = customVarsObject.country || ''
    const industry = customVarsObject.industry || ''

    // Validate required fields from project variable definitions
    if (project?.variable_definitions) {
      const missingRequired = project.variable_definitions
        .filter(v => v.required && !customVarsObject[v.name])
        .map(v => v.name)

      if (missingRequired.length > 0) {
        alert(`Por favor completa los campos requeridos: ${missingRequired.join(', ')}`)
        return
      }
    }

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

  const handleEditCampaignName = (campaignId: string, currentName: string) => {
    setEditingCampaignName(campaignId)
    setEditingNameValue(currentName)
  }

  const handleSaveCampaignName = async (campaignId: string) => {
    if (!editingNameValue.trim()) {
      alert('Campaign name cannot be empty')
      return
    }

    try {
      const response = await fetch(`/api/campaign/${campaignId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ecp_name: editingNameValue }),
      })

      const data = await response.json()

      if (data.success) {
        alert('✅ Campaign name updated successfully')
        setEditingCampaignName(null)
        setEditingNameValue('')
        loadCampaigns()
      } else {
        throw new Error(data.error || 'Failed to update')
      }
    } catch (error) {
      console.error('Error updating campaign name:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleCancelEditCampaignName = () => {
    setEditingCampaignName(null)
    setEditingNameValue('')
  }

  const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la campaña "${campaignName}"? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      const response = await fetch(`/api/campaign/${campaignId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        alert('✅ Campaign deleted successfully')
        loadCampaigns()
      } else {
        throw new Error(data.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Error deleting campaign:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleDuplicateCampaign = async (campaign: Campaign) => {
    try {
      // Create a new campaign name with "(Copy)" suffix
      const newName = `${campaign.ecp_name} (Copy)`

      // Copy and update flow_config to use the latest model
      let updatedFlowConfig = campaign.flow_config
      if (updatedFlowConfig?.steps) {
        updatedFlowConfig = {
          ...updatedFlowConfig,
          steps: updatedFlowConfig.steps.map(step => ({
            ...step,
            // Update old models to the new Gemini 2.5 Pro
            model: step.model === 'gemini-2.0-flash-exp' || step.model === 'gemini-2.0-pro-exp'
              ? 'gemini-2.5-pro'
              : step.model
          }))
        }
      }

      // Prepare the campaign data to duplicate
      const duplicateData = {
        projectId,
        ecp_name: newName,
        problem_core: campaign.problem_core,
        country: campaign.country,
        industry: campaign.industry,
        custom_variables: campaign.custom_variables,
        flow_config: updatedFlowConfig, // Use updated flow configuration
      }

      const response = await fetch('/api/campaign/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(duplicateData),
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ Campaign duplicated successfully as "${newName}" with updated Gemini 2.5 Pro model`)
        loadCampaigns()
      } else {
        throw new Error(data.error || 'Failed to duplicate campaign')
      }
    } catch (error) {
      console.error('Error duplicating campaign:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

  const getFileExtensionAndMimeType = (format?: string): { extension: string; mimeType: string } => {
    switch (format) {
      case 'markdown':
        return { extension: 'md', mimeType: 'text/markdown' }
      case 'json':
        return { extension: 'json', mimeType: 'application/json' }
      case 'csv':
        return { extension: 'csv', mimeType: 'text/csv' }
      case 'html':
        return { extension: 'html', mimeType: 'text/html' }
      case 'xml':
        return { extension: 'xml', mimeType: 'application/xml' }
      case 'text':
      default:
        return { extension: 'txt', mimeType: 'text/plain' }
    }
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
        <h2 className="text-xl font-semibold text-gray-900">Campañas</h2>
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
          <h3 className="font-semibold mb-4 text-gray-900">
            {editingCampaignId ? 'Edit Campaign' : 'Create New Campaign'}
          </h3>

          <div className="space-y-4">
            {/* Variables Section */}
            <div>
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
                  {editingCampaignName === campaign.id ? (
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="text"
                        value={editingNameValue}
                        onChange={(e) => setEditingNameValue(e.target.value)}
                        className="flex-1 text-lg font-semibold text-gray-900 border-2 border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveCampaignName(campaign.id)
                          if (e.key === 'Escape') handleCancelEditCampaignName()
                        }}
                      />
                      <button
                        onClick={() => handleSaveCampaignName(campaign.id)}
                        className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={handleCancelEditCampaignName}
                        className="p-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg text-gray-900">{campaign.ecp_name}</h3>
                      {campaign.status === 'draft' && (
                        <button
                          onClick={() => handleEditCampaignName(campaign.id, campaign.ecp_name)}
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-gray-600 mt-1">
                    {campaign.problem_core} • {campaign.country} • {campaign.industry}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(campaign.status)}
                  <span className="text-sm font-medium text-gray-900">
                    {getStatusLabel(campaign.status)}
                  </span>
                </div>
              </div>

              {/* Campaign Variables */}
              {campaign.custom_variables && Object.keys(campaign.custom_variables).length > 0 && (
                <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700 uppercase">Variables</span>
                    <button
                      onClick={() => handleEditCampaign(campaign)}
                      className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 inline-flex items-center gap-1"
                      title="Edit campaign variables"
                    >
                      <Edit2 size={12} />
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(campaign.custom_variables as Record<string, string>).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-2">
                        <code className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                          {'{{'}{key}{'}}'}
                        </code>
                        <span className="text-gray-700 truncate" title={value}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                    <button
                      onClick={() => setEditingFlowCampaignId(campaign.id)}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 inline-flex items-center gap-1"
                    >
                      <Settings size={12} />
                      Edit Flow
                    </button>
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
                                  <h4 className="font-medium text-sm text-gray-900">{step.name}</h4>
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
                                      const { extension, mimeType } = getFileExtensionAndMimeType(step.output_format)
                                      const text = `=== ${step.name} ===\n\n${stepOutput.output}\n\nTokens: ${stepOutput.tokens || 'N/A'}\nCompleted: ${stepOutput.completed_at || 'N/A'}`
                                      const blob = new Blob([text], { type: mimeType })
                                      const url = URL.createObjectURL(blob)
                                      const a = document.createElement('a')
                                      a.href = url
                                      a.download = `${campaign.ecp_name.replace(/\s+/g, '_')}_${step.name.replace(/\s+/g, '_')}.${extension}`
                                      a.click()
                                    }}
                                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 inline-flex items-center gap-1"
                                    title={`Download as .${getFileExtensionAndMimeType(step.output_format).extension}`}
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

                {/* Duplicate button - available for all campaigns */}
                <button
                  onClick={() => handleDuplicateCampaign(campaign)}
                  className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 inline-flex items-center gap-2"
                  title="Duplicate this campaign with same configuration and variables"
                >
                  <Plus size={16} />
                  Duplicate
                </button>

                {/* Delete button - available for all campaigns */}
                <button
                  onClick={() => handleDeleteCampaign(campaign.id, campaign.ecp_name)}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 inline-flex items-center gap-2"
                  title="Delete this campaign"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
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
