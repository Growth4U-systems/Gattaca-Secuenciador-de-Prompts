'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, CheckCircle, Clock, AlertCircle, Download, Plus, X, Edit2, ChevronDown, ChevronRight, Settings, Trash2, Check, Eye, FileSpreadsheet, Search, Filter, Variable, FileText, Info, Copy, BookOpen, Rocket, RefreshCw, ArrowLeftRight, Sparkles, Zap, Cpu, Pause, Star, ClipboardList } from 'lucide-react'
import CampaignFlowEditor from './CampaignFlowEditor'
import StepOutputEditor from './StepOutputEditor'
import CampaignBulkUpload from './CampaignBulkUpload'
import CampaignComparison from './CampaignComparison'
import { ReportGenerator } from '@/components/reports'
import DeepResearchProgress from './DeepResearchProgress'
import StatusManager, { CustomStatus, DEFAULT_STATUSES, getStatusIcon, getStatusColors } from './StatusManager'
import { FlowConfig, FlowStep, LLMModel } from '@/types/flow.types'
import { useToast, useModal } from '@/components/ui'
import { useOpenRouter } from '@/lib/openrouter-context'
import { useAuth } from '@/lib/auth-context'
import { OpenRouterAuthModal } from '@/components/openrouter'
import OpenRouterModelSelector from '@/components/openrouter/OpenRouterModelSelector'

// Modelos LLM disponibles para retry
const LLM_MODELS = [
  // Gemini
  { value: 'gemini-3.0-pro-preview', label: 'Gemini 3.0 Pro', provider: 'Google' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'Google' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', provider: 'Google' },
  // Deep Research (Google) - Agente autónomo de investigación
  { value: 'deep-research-pro-preview-12-2025', label: 'Deep Research Pro', provider: 'Deep Research' },
  // OpenAI GPT-5 Series
  { value: 'gpt-5.2', label: 'GPT-5.2', provider: 'OpenAI' },
  { value: 'gpt-5', label: 'GPT-5', provider: 'OpenAI' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini', provider: 'OpenAI' },
  // OpenAI GPT-4 Series
  { value: 'gpt-4.1', label: 'GPT-4.1', provider: 'OpenAI' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'OpenAI' },
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
  // OpenAI o-series
  { value: 'o4-mini', label: 'o4 Mini', provider: 'OpenAI' },
  { value: 'o3-pro', label: 'o3 Pro', provider: 'OpenAI' },
  { value: 'o3', label: 'o3', provider: 'OpenAI' },
  { value: 'o3-mini', label: 'o3 Mini', provider: 'OpenAI' },
  { value: 'o1', label: 'o1', provider: 'OpenAI' },
  { value: 'o1-mini', label: 'o1 Mini', provider: 'OpenAI' },
  // Anthropic Claude 4.5
  { value: 'claude-4.5-opus', label: 'Claude 4.5 Opus', provider: 'Anthropic' },
  { value: 'claude-4.5-sonnet', label: 'Claude 4.5 Sonnet', provider: 'Anthropic' },
  { value: 'claude-4.5-haiku', label: 'Claude 4.5 Haiku', provider: 'Anthropic' },
]

// Token equivalence helper: 1 token ≈ 0.75 words, 500 words = 1 page
const getTokenEquivalence = (tokens: number) => {
  const words = Math.round(tokens * 0.75)
  const pages = (words / 500).toFixed(1)
  return { words, pages }
}

interface CampaignRunnerProps {
  projectId: string
  project?: Project | null
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
  research_prompt?: string | null
}

interface ProjectDocument {
  id: string
  filename: string
  category: string
  campaign_id?: string | null
}

interface ResearchPrompt {
  id: string
  name: string
  content: string
}

interface Project {
  id: string
  name: string
  client_id?: string
  client?: {
    id: string
    name: string
  }
  variable_definitions: Array<{
    name: string
    default_value: string
    required: boolean
    description?: string
  }>
  flow_config?: FlowConfig
  campaign_docs_guide?: string
  deep_research_prompts?: ResearchPrompt[]
  custom_statuses?: CustomStatus[]
}

interface CampaignDocument {
  id: string
  filename: string
  category: string
  token_count: number | null
  created_at: string
}

export default function CampaignRunner({ projectId, project: projectProp }: CampaignRunnerProps) {
  const toast = useToast()
  const modal = useModal()
  const { isConnected: hasOpenRouter } = useOpenRouter()
  const { user } = useAuth()
  const [showOpenRouterModal, setShowOpenRouterModal] = useState(false)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [project, setProject] = useState<Project | null>(projectProp || null)
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  const [runningStep, setRunningStep] = useState<{ campaignId: string; stepId: string } | null>(null)
  const [editingFlowCampaignId, setEditingFlowCampaignId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [editingCampaignName, setEditingCampaignName] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [editingStepOutput, setEditingStepOutput] = useState<{
    campaignId: string
    campaignName: string
    stepId: string
    stepName: string
    stepOrder: number
    baseDocIds: string[]
  } | null>(null)
  const [downloadFormatMenu, setDownloadFormatMenu] = useState<string | null>(null)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [showReportGenerator, setShowReportGenerator] = useState(false)

  // Status management state
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<{
    campaignId: string
    position: { top: number; left: number }
  } | null>(null)
  const [showStatusManager, setShowStatusManager] = useState(false)

  // Retry dialog state
  const [retryDialog, setRetryDialog] = useState<{
    show: boolean
    campaignId: string
    stepId: string
    stepName: string
    error: string
    failedModel: string
    selectedModel: string
    errorSource?: string  // 'openrouter', 'api', or 'unknown'
    originalError?: string  // Original error message for debugging
  } | null>(null)

  // Deep Research async polling state
  const [deepResearchPolling, setDeepResearchPolling] = useState<{
    campaignId: string
    stepId: string
    stepName: string
    interactionId: string
    logId: string
  } | null>(null)

  // Step execution config dialog
  const [stepExecutionConfig, setStepExecutionConfig] = useState<{
    campaignId: string
    stepId: string
    stepName: string
    currentModel: string
    selectedModel: string
    currentTemperature: number
    selectedTemperature: number
    currentMaxTokens: number
    selectedMaxTokens: number
  } | null>(null)

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedVariables, setExpandedVariables] = useState<Set<string>>(new Set())
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())
  const [expandedResearchPrompts, setExpandedResearchPrompts] = useState<Set<string>>(new Set())
  const [campaignDocs, setCampaignDocs] = useState<Record<string, CampaignDocument[]>>({})
  const [showDocsGuide, setShowDocsGuide] = useState<string | null>(null)
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)

  // Inline variable editing
  const [editingVariablesCampaignId, setEditingVariablesCampaignId] = useState<string | null>(null)
  const [editingVariablesData, setEditingVariablesData] = useState<Record<string, string>>({})
  const [savingVariables, setSavingVariables] = useState(false)

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

  // Get merged variables (project definitions + campaign values)
  const getMergedVariables = (campaign: Campaign): Record<string, string> => {
    const merged: Record<string, string> = {}

    // First, add all project-defined variables with their default values
    if (project?.variable_definitions) {
      project.variable_definitions.forEach(varDef => {
        merged[varDef.name] = varDef.default_value || ''
      })
    }

    // Then, override with campaign's actual custom_variables values
    const customVars = campaign.custom_variables as Record<string, string> || {}
    Object.entries(customVars).forEach(([key, value]) => {
      merged[key] = value
    })

    return merged
  }

  // Start inline editing for a campaign's variables
  const startEditingVariables = (campaign: Campaign) => {
    setEditingVariablesCampaignId(campaign.id)
    // Use merged variables to include project-defined vars not yet in campaign
    setEditingVariablesData(getMergedVariables(campaign))
  }

  // Cancel inline editing
  const cancelEditingVariables = () => {
    setEditingVariablesCampaignId(null)
    setEditingVariablesData({})
  }

  // Save inline edited variables
  const saveEditingVariables = async (campaignId: string) => {
    setSavingVariables(true)
    try {
      const response = await fetch(`/api/campaign/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_variables: editingVariablesData }),
      })

      const data = await response.json()

      if (data.success) {
        // Update local state
        setCampaigns(prev => prev.map(c =>
          c.id === campaignId ? { ...c, custom_variables: editingVariablesData } : c
        ))
        setEditingVariablesCampaignId(null)
        setEditingVariablesData({})
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Error saving variables:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setSavingVariables(false)
    }
  }

  // Export all prompts as JSON or Markdown
  const handleExportPrompts = (format: 'json' | 'markdown') => {
    const flowConfig = project?.flow_config
    if (!flowConfig?.steps?.length) {
      toast.warning('Sin pasos', 'No hay pasos configurados para exportar')
      return
    }

    let content: string
    let filename: string

    if (format === 'json') {
      const exportData = {
        project: project?.name,
        exportedAt: new Date().toISOString(),
        steps: flowConfig.steps.map(step => ({
          order: step.order,
          name: step.name,
          description: step.description,
          prompt: step.prompt,
          output_format: step.output_format,
        })),
        variables: project?.variable_definitions || [],
      }
      content = JSON.stringify(exportData, null, 2)
      filename = `prompts-${project?.name || 'export'}.json`
    } else {
      // Markdown format
      const lines = [
        `# Prompts - ${project?.name || 'Proyecto'}`,
        '',
        `Exportado: ${new Date().toLocaleString()}`,
        '',
        '---',
        '',
      ]

      // Add variables section
      if (project?.variable_definitions?.length) {
        lines.push('## Variables disponibles', '')
        project.variable_definitions.forEach(v => {
          lines.push(`- **${v.name}**: ${v.description || 'Sin descripción'} (default: "${v.default_value || ''}")`)
        })
        lines.push('', '---', '')
      }

      // Add steps
      flowConfig.steps.sort((a, b) => a.order - b.order).forEach(step => {
        lines.push(`## ${step.order}. ${step.name}`, '')
        if (step.description) {
          lines.push(`*${step.description}*`, '')
        }
        lines.push('### Prompt:', '', '```')
        lines.push(step.prompt)
        lines.push('```', '')
        lines.push(`**Formato de salida:** ${step.output_format || 'text'}`, '')
        lines.push('---', '')
      })

      content = lines.join('\n')
      filename = `prompts-${project?.name || 'export'}.md`
    }

    // Download file
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Sync with project prop if provided
  useEffect(() => {
    if (projectProp) {
      setProject(projectProp)
    }
  }, [projectProp])

  useEffect(() => {
    // Only load project if not provided as prop
    if (!projectProp) {
      loadProject()
    }
    loadCampaigns()
    loadDocuments()
  }, [projectId, projectProp])

  // Check for ongoing Deep Research on page load and restore polling state
  const checkOngoingDeepResearch = async (campaignId: string, flowConfig: FlowConfig | null | undefined) => {
    try {
      const response = await fetch(`/api/campaign/check-deep-research?campaign_id=${campaignId}`)
      if (!response.ok) return null

      const data = await response.json()
      if (data.has_ongoing && data.interaction_id) {
        // Find step_id from flow_config using step_name
        let stepId = data.step_id
        if (!stepId && flowConfig?.steps && data.step_name) {
          const step = flowConfig.steps.find(s => s.name === data.step_name)
          stepId = step?.id || null
        }

        return {
          campaignId: campaignId,
          stepId: stepId,
          stepName: data.step_name,
          interactionId: data.interaction_id,
          logId: data.log_id
        }
      }
      return null
    } catch (error) {
      console.error('Error checking ongoing Deep Research:', error)
      return null
    }
  }

  // Restore Deep Research polling state for all campaigns
  useEffect(() => {
    const restoreDeepResearchState = async () => {
      // Wait until campaigns are loaded
      if (loading || campaigns.length === 0) return

      // Check each campaign for ongoing Deep Research
      for (const campaign of campaigns) {
        // Get flow_config from campaign or project
        const flowConfig = campaign.flow_config || project?.flow_config
        const ongoingResearch = await checkOngoingDeepResearch(campaign.id, flowConfig)
        if (ongoingResearch && ongoingResearch.stepId) {
          console.log('[Deep Research] Restoring polling state for campaign:', campaign.ecp_name)
          setDeepResearchPolling(ongoingResearch)
          setRunningStep({ campaignId: campaign.id, stepId: ongoingResearch.stepId })
          // Expand the campaign to show progress
          setExpandedCampaigns(prev => new Set([...prev, campaign.id]))
          break // Only restore one at a time
        }
      }
    }

    restoreDeepResearchState()
  }, [campaigns, loading, project])

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
        toast.warning('Campos requeridos', `Por favor completa: ${missingRequired.join(', ')}`)
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
        toast.success('Éxito', isEditing ? 'Campaña actualizada exitosamente' : 'Campaña creada exitosamente')
        setShowNewForm(false)
        setCustomVariables([])
        setEditingCampaignId(null)
        loadCampaigns()
      } else {
        let errorMsg = data.error || 'Failed to create campaign'
        if (data.details) {
          errorMsg += ` - ${data.details}`
        }
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('Error creating campaign:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error desconocido')
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
      toast.warning('Nombre requerido', 'El nombre no puede estar vacío')
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
        setEditingCampaignName(null)
        setEditingNameValue('')
        loadCampaigns()
      } else {
        throw new Error(data.error || 'Failed to update')
      }
    } catch (error) {
      console.error('Error updating campaign name:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error desconocido')
    }
  }

  const handleCancelEditCampaignName = () => {
    setEditingCampaignName(null)
    setEditingNameValue('')
  }

  const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
    const confirmed = await modal.confirm({
      title: 'Eliminar campaña',
      message: `¿Eliminar "${campaignName}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      const response = await fetch(`/api/campaign/${campaignId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Eliminada', 'Campaña eliminada exitosamente')
        loadCampaigns()
      } else {
        throw new Error(data.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Error deleting campaign:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error desconocido')
    }
  }

  const handleDuplicateCampaign = async (campaign: Campaign) => {
    try {
      const newName = `${campaign.ecp_name} (Copia)`

      const updatedFlowConfig = campaign.flow_config

      const duplicateData = {
        projectId,
        ecp_name: newName,
        problem_core: campaign.problem_core,
        country: campaign.country,
        industry: campaign.industry,
        custom_variables: campaign.custom_variables,
        flow_config: updatedFlowConfig,
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
        toast.success('Duplicada', `Campaña duplicada como "${newName}"`)
        loadCampaigns()
      } else {
        throw new Error(data.error || 'Failed to duplicate campaign')
      }
    } catch (error) {
      console.error('Error duplicating campaign:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error desconocido')
    }
  }

  // Get custom statuses from project or use defaults
  const getCustomStatuses = (): CustomStatus[] => {
    if (project?.custom_statuses && project.custom_statuses.length > 0) {
      return project.custom_statuses
    }
    return DEFAULT_STATUSES
  }

  // Update campaign status
  const handleUpdateCampaignStatus = async (campaignId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/campaign/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()

      if (data.success) {
        setCampaigns(prev => prev.map(c =>
          c.id === campaignId ? { ...c, status: newStatus } : c
        ))
        toast.success('Status actualizado', `Campaña marcada como "${getCustomStatuses().find(s => s.id === newStatus)?.name || newStatus}"`)
      } else {
        throw new Error(data.error || 'Failed to update status')
      }
    } catch (error) {
      console.error('Error updating campaign status:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setStatusDropdownOpen(null)
    }
  }

  // Save custom statuses to project
  const handleSaveCustomStatuses = async (statuses: CustomStatus[]) => {
    if (!project) return

    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_statuses: statuses }),
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Failed to save statuses')
    }

    // Update local project state
    setProject({ ...project, custom_statuses: statuses })
  }

  const handleRunCampaign = async (campaignId: string) => {
    const confirmed = await modal.confirm({
      title: 'Ejecutar campaña',
      message: '¿Ejecutar esta campaña? Esto puede tomar varios minutos.',
      confirmText: 'Ejecutar',
      cancelText: 'Cancelar',
      variant: 'info',
    })
    if (!confirmed) return

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
        toast.success('Campaña completada', `${data.steps_completed} pasos en ${(data.duration_ms / 1000).toFixed(1)}s`)
      } else {
        let errorMsg = data.error || 'Execution failed'
        if (data.details) {
          errorMsg += ` - ${data.details}`
        }
        toast.error('Error de ejecución', errorMsg)
      }
    } catch (error) {
      console.error('Error running campaign:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setRunning(null)
      loadCampaigns()
    }
  }

  const handleResetCampaignStatus = async (campaignId: string) => {
    const confirmed = await modal.confirm({
      title: 'Resetear campaña',
      message: '¿Resetear el estado a "draft"? No se borrarán los resultados.',
      confirmText: 'Resetear',
      cancelText: 'Cancelar',
      variant: 'warning',
    })
    if (!confirmed) return

    try {
      const response = await fetch(`/api/campaign/${campaignId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'draft',
          current_step_id: null,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Reseteada', 'Campaña reseteada a estado draft')
        loadCampaigns()
      } else {
        throw new Error(data.error || 'Failed to reset')
      }
    } catch (error) {
      console.error('Error resetting campaign status:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error desconocido')
    }
  }

  const handleRunStep = async (
    campaignId: string,
    stepId: string,
    stepName: string,
    overrideModel?: string,
    overrideTemperature?: number,
    overrideMaxTokens?: number
  ) => {
    // Verificar conexión con OpenRouter antes de ejecutar
    if (!hasOpenRouter) {
      setShowOpenRouterModal(true)
      return
    }

    // Ya no necesitamos confirmación porque viene del dialog de configuración
    setRunningStep({ campaignId, stepId })
    setRetryDialog(null) // Cerrar diálogo de retry si estaba abierto

    try {
      const response = await fetch('/api/campaign/run-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId,
          stepId,
          overrideModel,
          overrideTemperature,
          overrideMaxTokens,
        }),
      })

      const data = await response.json()

      // Debug: log full error response
      if (!response.ok || !data.success) {
        console.log('[runStep] Error response:', {
          status: response.status,
          data,
          error_source: data.error_source,
          original_error: data.original_error,
        })
      }

      // Check for HTTP errors or explicit success: false
      if (!response.ok || !data.success) {
        // Si el error permite retry, mostrar diálogo
        if (data.can_retry !== false) {
          const failedModel = data.failed_model || overrideModel || 'unknown'
          // Determine error source for user clarity
          const errorSource = data.error_source || (response.status >= 500 ? 'api' : 'unknown')

          setRetryDialog({
            show: true,
            campaignId,
            stepId,
            stepName,
            error: data.error || 'Error desconocido',
            failedModel,
            selectedModel: '', // Usuario selecciona desde OpenRouter
            errorSource,
            originalError: data.original_error,
          })
        } else {
          let errorMsg = data.error || 'Execution failed'
          if (data.details) {
            errorMsg += ` - ${data.details}`
          }
          toast.error('Error de ejecución', errorMsg)
        }
        return
      }

      if (data.success) {
        // Check if Deep Research requires async polling
        if (data.async_polling_required) {
          console.log('[Deep Research] Starting async polling for:', data.interaction_id)
          setDeepResearchPolling({
            campaignId,
            stepId,
            stepName,
            interactionId: data.interaction_id,
            logId: data.log_id,
          })
          toast.info('Deep Research iniciado', 'El proceso de investigación puede tardar 5-10 minutos')
          return // Don't clear runningStep yet - polling will handle it
        }

        const durationSec = (data.duration_ms / 1000).toFixed(1)
        const modelName = data.model_used?.split('/').pop() || 'N/A'
        toast.success(
          `✓ "${stepName}" ejecutado`,
          `Completado en ${durationSec}s con ${modelName}`
        )
      }
    } catch (error) {
      console.error('Error running step:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setRunningStep(null)
      loadCampaigns()
    }
  }

  // Handler para reintentar con modelo diferente
  const handleRetryWithModel = () => {
    if (retryDialog) {
      handleRunStep(retryDialog.campaignId, retryDialog.stepId, retryDialog.stepName, retryDialog.selectedModel)
    }
  }

  // Handlers para Deep Research async polling
  const handleDeepResearchComplete = (result: string) => {
    console.log('[Deep Research] Completed with result length:', result.length)
    toast.success('Deep Research completado', 'La investigación ha finalizado exitosamente')
    setDeepResearchPolling(null)
    setRunningStep(null)
    loadCampaigns() // Refresh to show the result
  }

  const handleDeepResearchError = (error: string) => {
    console.error('[Deep Research] Failed:', error)
    toast.error('Deep Research falló', error)
    setDeepResearchPolling(null)
    setRunningStep(null)
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

  const getStatusConfig = (status: string) => {
    // Try to find custom status from project
    const customStatuses = getCustomStatuses()
    const customStatus = customStatuses.find(s => s.id === status)

    if (customStatus) {
      const colorConfig = getStatusColors(customStatus.color)
      const IconComponent = getStatusIcon(customStatus.icon)
      return {
        icon: IconComponent,
        bg: colorConfig.bg,
        border: `border ${colorConfig.border}`,
        text: colorConfig.text,
        iconColor: colorConfig.text,
        label: customStatus.name,
      }
    }

    // Fallback for legacy statuses
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          bg: 'bg-gradient-to-r from-green-50 to-emerald-50',
          border: 'border-green-200',
          text: 'text-green-700',
          iconColor: 'text-green-500',
          label: 'Completada',
        }
      case 'error':
        return {
          icon: AlertCircle,
          bg: 'bg-gradient-to-r from-red-50 to-orange-50',
          border: 'border-red-200',
          text: 'text-red-700',
          iconColor: 'text-red-500',
          label: 'Error',
        }
      case 'running':
        return {
          icon: Play,
          bg: 'bg-gradient-to-r from-blue-50 to-indigo-50',
          border: 'border-blue-200',
          text: 'text-blue-700',
          iconColor: 'text-blue-500',
          label: 'En ejecucion',
        }
      default:
        return {
          icon: Clock,
          bg: 'bg-gradient-to-r from-gray-50 to-slate-50',
          border: 'border-gray-200',
          text: 'text-gray-600',
          iconColor: 'text-gray-400',
          label: 'Borrador',
        }
    }
  }

  const getStepStatus = (campaign: Campaign, stepId: string) => {
    if (campaign.step_outputs && campaign.step_outputs[stepId]) {
      const output = campaign.step_outputs[stepId]
      return output.status || 'completed'
    }
    return 'pending'
  }

  // Check if a step's output is stale (a previous step was re-executed after this step)
  const isStepStale = (campaign: Campaign, step: FlowStep, steps: FlowStep[]) => {
    if (!campaign.step_outputs || !campaign.step_outputs[step.id]) {
      return false // No output yet, can't be stale
    }

    const currentStepOutput = campaign.step_outputs[step.id]
    const currentCompletedAt = currentStepOutput.completed_at
      ? new Date(currentStepOutput.completed_at).getTime()
      : null

    if (!currentCompletedAt) return false

    // Check all previous steps (lower order numbers)
    for (const prevStep of steps) {
      if (prevStep.order >= step.order) continue // Only check previous steps

      const prevStepOutput = campaign.step_outputs[prevStep.id]
      if (!prevStepOutput?.completed_at) continue

      const prevCompletedAt = new Date(prevStepOutput.completed_at).getTime()

      // If any previous step was completed AFTER this step, this step is stale
      if (prevCompletedAt > currentCompletedAt) {
        return true
      }
    }

    return false
  }

  const isStepRunning = (campaignId: string, stepId: string) => {
    return runningStep?.campaignId === campaignId && runningStep?.stepId === stepId
  }

  const toggleVariablesExpanded = (campaignId: string) => {
    setExpandedVariables(prev => {
      const newSet = new Set(prev)
      if (newSet.has(campaignId)) {
        newSet.delete(campaignId)
      } else {
        newSet.add(campaignId)
      }
      return newSet
    })
  }

  const toggleDocsExpanded = async (campaignId: string) => {
    const isExpanding = !expandedDocs.has(campaignId)

    setExpandedDocs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(campaignId)) {
        newSet.delete(campaignId)
      } else {
        newSet.add(campaignId)
      }
      return newSet
    })

    if (isExpanding && !campaignDocs[campaignId]) {
      try {
        const response = await fetch(`/api/documents?projectId=${projectId}&campaignId=${campaignId}`)
        const data = await response.json()
        if (data.success) {
          setCampaignDocs(prev => ({
            ...prev,
            [campaignId]: data.documents || []
          }))
        }
      } catch (error) {
        console.error('Error loading campaign documents:', error)
      }
    }
  }

  const toggleResearchPromptsExpanded = (campaignId: string) => {
    setExpandedResearchPrompts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(campaignId)) {
        newSet.delete(campaignId)
      } else {
        newSet.add(campaignId)
      }
      return newSet
    })
  }

  // Replace {{variables}} in a prompt with actual campaign values
  const getPromptWithRealValues = (prompt: string, campaignVariables: Record<string, string>): string => {
    let result = prompt
    Object.entries(campaignVariables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
      result = result.replace(regex, value || `[${key}: sin valor]`)
    })
    return result
  }

  // Copy prompt with variables replaced to clipboard
  const copyPromptToClipboard = async (promptId: string, promptContent: string, campaignVariables: Record<string, string>) => {
    const processedPrompt = getPromptWithRealValues(promptContent, campaignVariables)
    try {
      await navigator.clipboard.writeText(processedPrompt)
      setCopiedPromptId(promptId)
      setTimeout(() => setCopiedPromptId(null), 2000)
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      toast.error('Error', 'No se pudo copiar al portapapeles')
    }
  }

  // Copy all prompts from a campaign in markdown format for Notion
  const copyAllPromptsAsMarkdown = async (campaign: Campaign) => {
    const flowConfig = campaign.flow_config || project?.flow_config
    if (!flowConfig?.steps) {
      toast.warning('Sin pasos', 'No hay pasos configurados en esta campaña')
      return
    }

    const campaignVars = campaign.custom_variables as Record<string, string> || {}
    const sortedSteps = [...flowConfig.steps].sort((a, b) => a.order - b.order)

    let markdown = `# ${campaign.ecp_name}\n\n`
    markdown += `**Problema:** ${campaign.problem_core}\n`
    markdown += `**País:** ${campaign.country}\n`
    markdown += `**Industria:** ${campaign.industry}\n\n`
    markdown += `---\n\n`

    sortedSteps.forEach((step, index) => {
      const processedPrompt = getPromptWithRealValues(step.prompt, campaignVars)
      markdown += `## ${step.order}. ${step.name}\n\n`
      if (step.description) {
        markdown += `> ${step.description}\n\n`
      }
      markdown += `\`\`\`\n${processedPrompt}\n\`\`\`\n\n`
    })

    if ((project?.deep_research_prompts?.length ?? 0) > 0) {
      markdown += `---\n\n## Prompts de Investigación\n\n`
      project!.deep_research_prompts!.forEach((prompt: { name: string; content: string }) => {
        const processedPrompt = getPromptWithRealValues(prompt.content, campaignVars)
        markdown += `### ${prompt.name}\n\n`
        markdown += `\`\`\`\n${processedPrompt}\n\`\`\`\n\n`
      })
    }

    try {
      await navigator.clipboard.writeText(markdown)
      setCopiedPromptId(`all-${campaign.id}`)
      setTimeout(() => setCopiedPromptId(null), 2000)
      toast.success('Copiado', 'Prompts copiados al portapapeles')
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      toast.error('Error', 'No se pudo copiar al portapapeles')
    }
  }

  // Filter campaigns based on search and status
  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = searchQuery === '' ||
      campaign.ecp_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.problem_core?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.country?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.industry?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter

    return matchesSearch && matchesStatus
  })

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

  const downloadAllOutputs = (campaign: Campaign, format: string) => {
    const outputs = campaign.step_outputs
    const steps = campaign.flow_config?.steps || project?.flow_config?.steps || []

    const sortedOutputs = steps
      .sort((a, b) => a.order - b.order)
      .map(step => ({
        stepId: step.id,
        stepName: step.name,
        stepOrder: step.order,
        data: outputs[step.id]
      }))
      .filter(item => item.data && item.data.output)

    let content = ''
    let extension = 'txt'
    let mimeType = 'text/plain'

    switch (format) {
      case 'markdown':
        content = sortedOutputs
          .map(item => `# Step ${item.stepOrder}: ${item.stepName}\n\n${item.data.output}\n\n---\n`)
          .join('\n')
        extension = 'md'
        mimeType = 'text/markdown'
        break

      case 'json':
        const jsonData = sortedOutputs.map(item => ({
          step_order: item.stepOrder,
          step_name: item.stepName,
          step_id: item.stepId,
          output: item.data.output,
          tokens: item.data.tokens,
          completed_at: item.data.completed_at,
          edited_at: item.data.edited_at || null
        }))
        content = JSON.stringify(jsonData, null, 2)
        extension = 'json'
        mimeType = 'application/json'
        break

      case 'html':
        content = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${campaign.ecp_name} - Outputs</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; }
    h1 { color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem; }
    h2 { color: #374151; margin-top: 2rem; }
    .step { background: #f9fafb; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid #e5e7eb; }
    .step-header { color: #3b82f6; font-size: 0.875rem; margin-bottom: 0.5rem; }
    .content { white-space: pre-wrap; line-height: 1.6; }
    .meta { font-size: 0.75rem; color: #6b7280; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>${campaign.ecp_name}</h1>
  ${sortedOutputs.map(item => `
  <div class="step">
    <div class="step-header">Step ${item.stepOrder}</div>
    <h2>${item.stepName}</h2>
    <div class="content">${item.data.output.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <div class="meta">Tokens: ${item.data.tokens || 'N/A'} | Generated: ${item.data.completed_at || 'N/A'}</div>
  </div>`).join('\n')}
</body>
</html>`
        extension = 'html'
        mimeType = 'text/html'
        break

      case 'text':
      default:
        content = sortedOutputs
          .map(item => `=== Step ${item.stepOrder}: ${item.stepName} ===\n\n${item.data.output}\n\n`)
          .join('\n')
        extension = 'txt'
        mimeType = 'text/plain'
        break
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${campaign.ecp_name.replace(/\s+/g, '_')}_outputs.${extension}`
    a.click()
    URL.revokeObjectURL(url)
    setDownloadFormatMenu(null)
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-500">Cargando campañas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <Rocket className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Campañas</h2>
              <p className="text-sm text-gray-600 mt-1">
                {campaigns.length} campaña{campaigns.length !== 1 ? 's' : ''} en este proyecto
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {campaigns.length >= 1 && (
              <button
                onClick={() => setShowReportGenerator(true)}
                className="px-4 py-2.5 border border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-50 inline-flex items-center gap-2 font-medium transition-colors"
                title="Generar reporte consolidado"
              >
                <ClipboardList size={18} />
                Reporte
              </button>
            )}
            {campaigns.length >= 2 && (
              <button
                onClick={() => setShowComparison(true)}
                className="px-4 py-2.5 border border-purple-200 text-purple-600 rounded-xl hover:bg-purple-50 inline-flex items-center gap-2 font-medium transition-colors"
                title="Comparar campañas"
              >
                <ArrowLeftRight size={18} />
                Comparar
              </button>
            )}
            <button
              onClick={() => setShowBulkUpload(true)}
              className="px-4 py-2.5 border border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 inline-flex items-center gap-2 font-medium transition-colors"
            >
              <FileSpreadsheet size={18} />
              Importar CSV
            </button>
            {/* Export Prompts Dropdown */}
            <div className="relative group">
              <button
                className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 inline-flex items-center gap-2 font-medium transition-colors"
              >
                <Download size={18} />
                Exportar
              </button>
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 overflow-hidden">
                <button
                  onClick={() => handleExportPrompts('json')}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
                >
                  <FileText size={16} className="text-gray-400" />
                  Exportar como JSON
                </button>
                <button
                  onClick={() => handleExportPrompts('markdown')}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
                >
                  <FileText size={16} className="text-gray-400" />
                  Exportar como Markdown
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                if (showNewForm) {
                  setShowNewForm(false)
                } else {
                  openNewCampaignForm()
                }
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-700 hover:to-amber-700 inline-flex items-center gap-2 font-medium shadow-md hover:shadow-lg transition-all"
            >
              {showNewForm ? <X size={18} /> : <Plus size={18} />}
              {showNewForm ? 'Cancelar' : 'Nueva Campaña'}
            </button>
          </div>
        </div>
      </div>

      {/* New Campaign Form */}
      {showNewForm && (
        <div className="p-6 border-b border-gray-100 bg-gradient-to-br from-orange-50/50 to-white">
          <div className="max-w-3xl">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-orange-500" />
              {editingCampaignId ? 'Editar Campaña' : 'Crear Nueva Campaña'}
            </h3>

            <div className="space-y-4">
              {/* Variables Section */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900">
                      Variables de la Campaña
                    </label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Define valores que se reemplazarán en los prompts
                    </p>
                  </div>
                  <button
                    onClick={addCustomVariable}
                    className="px-3 py-1.5 text-sm bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 inline-flex items-center gap-1.5 font-medium transition-colors"
                  >
                    <Plus size={16} />
                    Agregar
                  </button>
                </div>

                {customVariables.length > 0 ? (
                  <div className="space-y-3">
                    {customVariables.map((variable, index) => {
                      const isProjectVariable = project?.variable_definitions?.some(
                        (v) => v.name === variable.key
                      )
                      const varDef = project?.variable_definitions?.find(
                        (v) => v.name === variable.key
                      )

                      return (
                        <div key={index} className="flex items-center gap-3">
                          {isProjectVariable ? (
                            <>
                              <div className="w-1/3 px-4 py-2.5 border border-orange-200 bg-orange-50 rounded-xl text-sm font-mono text-orange-700 flex items-center gap-2">
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
                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400 transition-all"
                                required={varDef?.required}
                              />
                              <div className="w-10"></div>
                            </>
                          ) : (
                            <>
                              <input
                                type="text"
                                value={variable.key}
                                onChange={(e) => updateCustomVariable(index, 'key', e.target.value)}
                                placeholder="nombre_variable"
                                className="w-1/3 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm font-mono text-gray-900 placeholder:text-gray-400 transition-all"
                              />
                              <span className="text-gray-400">=</span>
                              <input
                                type="text"
                                value={variable.value}
                                onChange={(e) => updateCustomVariable(index, 'value', e.target.value)}
                                placeholder="Valor de la variable"
                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400 transition-all"
                              />
                              <button
                                onClick={() => removeCustomVariable(index)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <X size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <Variable size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">
                      No hay variables. Click en "Agregar" para crear una.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCreateCampaign}
                  disabled={creating}
                  className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-2 font-medium shadow-md transition-all"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {editingCampaignId ? 'Actualizando...' : 'Creando...'}
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      {editingCampaignId ? 'Actualizar' : 'Crear Campaña'}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowNewForm(false)}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {campaigns.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar campañas..."
                className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 transition-all"
              />
            </div>
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
              >
                <option value="all">Todos los estados</option>
                <option value="draft">Lista para ejecutar</option>
                <option value="completed">Completada</option>
                <option value="error">Error</option>
              </select>
            </div>
            {/* Results count */}
            <div className="text-sm text-gray-500 self-center px-3">
              {filteredCampaigns.length} de {campaigns.length}
            </div>
          </div>
        </div>
      )}

      {/* Campaigns List */}
      <div className="p-6">
        {campaigns.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl mb-4">
              <Rocket className="w-8 h-8 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay campañas todavía</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
              Crea tu primera campaña para empezar a generar contenido
            </p>
            <button
              onClick={openNewCampaignForm}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-700 hover:to-amber-700 inline-flex items-center gap-2 font-medium shadow-md"
            >
              <Plus size={18} />
              Crear Primera Campaña
            </button>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-12">
            <Search size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No se encontraron campañas</p>
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('all') }}
              className="mt-3 text-orange-600 hover:text-orange-700 text-sm font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCampaigns.map((campaign) => {
              const varsCount = Object.keys(getMergedVariables(campaign)).length
              const stepsCount = campaign.step_outputs ? Object.keys(campaign.step_outputs).length : 0
              const totalSteps = (campaign.flow_config?.steps || project?.flow_config?.steps || []).length
              const isExpanded = expandedCampaigns.has(campaign.id)
              const progress = totalSteps > 0 ? Math.round((stepsCount / totalSteps) * 100) : 0
              const statusConfig = getStatusConfig(campaign.status)
              const StatusIcon = statusConfig.icon

              return (
                <div
                  key={campaign.id}
                  className={`group bg-white border rounded-2xl overflow-hidden transition-all hover:shadow-md ${statusConfig.border}`}
                >
                  {/* Campaign Header */}
                  <div
                    className="p-5 cursor-pointer"
                    onClick={() => toggleCampaignExpanded(campaign.id)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Expand Icon */}
                      <button className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors">
                        <ChevronRight
                          size={20}
                          className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </button>

                      {/* Campaign Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          {editingCampaignName === campaign.id ? (
                            <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editingNameValue}
                                onChange={(e) => setEditingNameValue(e.target.value)}
                                className="flex-1 font-semibold text-gray-900 border-2 border-orange-500 rounded-lg px-3 py-1 focus:outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCampaignName(campaign.id)
                                  if (e.key === 'Escape') handleCancelEditCampaignName()
                                }}
                              />
                              <button
                                onClick={() => handleSaveCampaignName(campaign.id)}
                                className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={handleCancelEditCampaignName}
                                className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <h3 className="font-semibold text-gray-900 truncate text-lg group-hover:text-orange-600 transition-colors">
                                {campaign.ecp_name}
                              </h3>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditCampaignName(campaign.id, campaign.ecp_name)
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Edit2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                        {/* Quick Info */}
                        <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500">
                          {campaign.country && <span>{campaign.country}</span>}
                          {campaign.industry && <span>• {campaign.industry}</span>}
                          <span>• {stepsCount}/{totalSteps} pasos</span>
                          {varsCount > 0 && <span>• {varsCount} variables</span>}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-28 hidden sm:block" onClick={e => e.stopPropagation()}>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all rounded-full ${
                              progress === 100 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-orange-500 to-amber-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 text-center mt-1.5 font-medium">{progress}%</p>
                      </div>

                      {/* Status Badge - Clickable Dropdown */}
                      {(() => {
                        const statusColors = getStatusColors(campaign.status)
                        const isDropdownOpen = statusDropdownOpen?.campaignId === campaign.id
                        return (
                          <div className="relative" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                if (isDropdownOpen) {
                                  setStatusDropdownOpen(null)
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  setStatusDropdownOpen({
                                    campaignId: campaign.id,
                                    position: {
                                      top: rect.bottom + 4,
                                      left: rect.right - 200, // Align right edge
                                    }
                                  })
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer border"
                              style={{
                                backgroundColor: statusColors.bg,
                                color: statusColors.text,
                                borderColor: statusColors.border,
                              }}
                              title="Click para cambiar status"
                            >
                              <StatusIcon size={14} style={{ color: statusColors.text }} />
                              {statusConfig.label}
                              <ChevronDown size={12} style={{ color: statusColors.text }} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        )
                      })()}

                      {/* Quick Actions */}
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleRunCampaign(campaign.id)}
                          disabled={running === campaign.id}
                          className="p-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                          title="Ejecutar campaña"
                        >
                          {running === campaign.id ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Play size={16} />
                          )}
                        </button>
                        <div className="relative">
                          <button
                            onClick={() => setDownloadFormatMenu(downloadFormatMenu === campaign.id ? null : campaign.id)}
                            disabled={stepsCount === 0}
                            className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl disabled:opacity-30 transition-colors"
                            title="Descargar"
                          >
                            <Download size={16} />
                          </button>
                          {downloadFormatMenu === campaign.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 min-w-[140px] py-1 overflow-hidden">
                              <button onClick={() => downloadAllOutputs(campaign, 'text')} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Texto</button>
                              <button onClick={() => downloadAllOutputs(campaign, 'markdown')} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Markdown</button>
                              <button onClick={() => downloadAllOutputs(campaign, 'html')} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">HTML</button>
                              <button onClick={() => downloadAllOutputs(campaign, 'json')} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">JSON</button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => copyAllPromptsAsMarkdown(campaign)}
                          className={`p-2.5 rounded-xl transition-colors ${
                            copiedPromptId === `all-${campaign.id}`
                              ? 'bg-green-100 text-green-600'
                              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                          }`}
                          title="Copiar prompts"
                        >
                          {copiedPromptId === `all-${campaign.id}` ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                        <button
                          onClick={() => handleDuplicateCampaign(campaign)}
                          className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                          title="Duplicar"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCampaign(campaign.id, campaign.ecp_name)}
                          className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gradient-to-br from-gray-50/50 to-white">
                      {/* Tab Navigation */}
                      <div className="flex border-b border-gray-200 px-4 bg-white overflow-x-auto">
                        <button
                          onClick={() => setExpandedVariables(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(campaign.id)
                            setExpandedDocs(p => { const s = new Set(p); s.delete(campaign.id); return s })
                            setExpandedResearchPrompts(p => { const s = new Set(p); s.delete(campaign.id); return s })
                            return newSet
                          })}
                          className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                            !expandedVariables.has(campaign.id) && !expandedDocs.has(campaign.id) && !expandedResearchPrompts.has(campaign.id)
                              ? 'border-orange-600 text-orange-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <Zap size={14} className="inline mr-1.5" />
                          Flujo
                        </button>
                        {varsCount > 0 && (
                          <button
                            onClick={() => {
                              setExpandedVariables(prev => {
                                const newSet = new Set(prev)
                                if (newSet.has(campaign.id)) {
                                  newSet.delete(campaign.id)
                                } else {
                                  newSet.add(campaign.id)
                                  setExpandedDocs(p => { const s = new Set(p); s.delete(campaign.id); return s })
                                  setExpandedResearchPrompts(p => { const s = new Set(p); s.delete(campaign.id); return s })
                                }
                                return newSet
                              })
                            }}
                            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                              expandedVariables.has(campaign.id)
                                ? 'border-orange-600 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <Variable size={14} className="inline mr-1.5" />
                            Variables
                          </button>
                        )}
                        {(campaign.research_prompt || (project?.deep_research_prompts && project.deep_research_prompts.length > 0)) && (
                          <button
                            onClick={() => {
                              setExpandedResearchPrompts(prev => {
                                const newSet = new Set(prev)
                                if (newSet.has(campaign.id)) {
                                  newSet.delete(campaign.id)
                                } else {
                                  newSet.add(campaign.id)
                                  setExpandedVariables(p => { const s = new Set(p); s.delete(campaign.id); return s })
                                  setExpandedDocs(p => { const s = new Set(p); s.delete(campaign.id); return s })
                                }
                                return newSet
                              })
                            }}
                            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                              expandedResearchPrompts.has(campaign.id)
                                ? 'border-orange-600 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <BookOpen size={14} className="inline mr-1.5" />
                            Research
                          </button>
                        )}
                        <button
                          onClick={() => {
                            toggleDocsExpanded(campaign.id)
                            if (!expandedDocs.has(campaign.id)) {
                              setExpandedVariables(p => { const s = new Set(p); s.delete(campaign.id); return s })
                              setExpandedResearchPrompts(p => { const s = new Set(p); s.delete(campaign.id); return s })
                            }
                          }}
                          className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                            expandedDocs.has(campaign.id)
                              ? 'border-orange-600 text-orange-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <FileText size={14} className="inline mr-1.5" />
                          Docs
                          {campaignDocs[campaign.id]?.length > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full">
                              {campaignDocs[campaign.id].length}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Tab Content */}
                      <div className="p-5">
                        {/* Flow/Steps Tab (default) */}
                        {!expandedVariables.has(campaign.id) && !expandedDocs.has(campaign.id) && !expandedResearchPrompts.has(campaign.id) && (
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-sm text-gray-600">
                                {stepsCount === totalSteps && totalSteps > 0 ? (
                                  <span className="text-green-600 font-medium">Todos los pasos completados</span>
                                ) : (
                                  <span>{stepsCount} de {totalSteps} pasos completados</span>
                                )}
                              </p>
                              <button
                                onClick={() => setEditingFlowCampaignId(campaign.id)}
                                className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                              >
                                Editar flujo
                              </button>
                            </div>
                            <div className="space-y-2">
                              {(campaign.flow_config?.steps || project?.flow_config?.steps || [])
                                .sort((a, b) => a.order - b.order)
                                .map((step) => {
                                  const stepStatus = getStepStatus(campaign, step.id)
                                  const stepRunning = isStepRunning(campaign.id, step.id)
                                  const stepOutput = campaign.step_outputs?.[step.id]
                                  const allSteps = campaign.flow_config?.steps || project?.flow_config?.steps || []
                                  const isStale = stepStatus === 'completed' && isStepStale(campaign, step, allSteps)

                                  const isDeepResearchStep = step.model?.includes('deep-research')

                                  return (
                                    <div key={step.id} className="space-y-2">
                                      <div
                                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                                          isStale
                                            ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300'
                                            : stepStatus === 'completed'
                                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                                            : stepRunning
                                            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                                            : 'bg-white border-gray-200 hover:border-gray-300'
                                        }`}
                                      >
                                        <div className="flex items-center gap-4">
                                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                                            isStale
                                              ? 'bg-amber-500 text-white'
                                              : stepStatus === 'completed'
                                              ? 'bg-green-600 text-white'
                                              : stepRunning
                                              ? 'bg-blue-600 text-white'
                                              : 'bg-gray-200 text-gray-600'
                                          }`}>
                                            {isStale ? (
                                              <RefreshCw size={16} />
                                            ) : stepStatus === 'completed' ? (
                                              <Check size={16} />
                                            ) : stepRunning ? (
                                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                              step.order
                                            )}
                                          </div>
                                          <div className="flex flex-col">
                                            <span className={`text-sm font-medium ${isStale ? 'text-amber-800' : stepStatus === 'completed' ? 'text-green-800' : 'text-gray-700'}`}>
                                              {step.name}
                                            </span>
                                            {isStale && (
                                              <span className="text-xs text-amber-600 flex items-center gap-1">
                                                <AlertCircle size={10} />
                                                Desactualizado - un paso anterior fue re-ejecutado
                                              </span>
                                            )}
                                            {isDeepResearchStep && !isStale && (
                                              <span className="text-xs text-purple-600">Deep Research</span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {stepOutput?.output && (
                                            <>
                                              <button
                                                onClick={() => {
                                                  const { extension, mimeType } = getFileExtensionAndMimeType(step.output_format)
                                                  const blob = new Blob([stepOutput.output], { type: mimeType })
                                                  const url = URL.createObjectURL(blob)
                                                  const a = document.createElement('a')
                                                  a.href = url
                                                  a.download = `${campaign.ecp_name.replace(/\s+/g, '_')}_${step.name.replace(/\s+/g, '_')}.${extension}`
                                                  a.click()
                                                  URL.revokeObjectURL(url)
                                                }}
                                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="Descargar resultado"
                                              >
                                                <Download size={14} />
                                              </button>
                                              <button
                                                onClick={() => setEditingStepOutput({
                                                  campaignId: campaign.id,
                                                  campaignName: campaign.ecp_name,
                                                  stepId: step.id,
                                                  stepName: step.name,
                                                  stepOrder: step.order,
                                                  baseDocIds: step.base_doc_ids || [],
                                                })}
                                                className="px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                                              >
                                                Ver resultado
                                              </button>
                                            </>
                                          )}
                                          <button
                                            onClick={() => setStepExecutionConfig({
                                              campaignId: campaign.id,
                                              stepId: step.id,
                                              stepName: step.name,
                                              currentModel: step.model || 'google/gemini-3-pro-preview',
                                              selectedModel: step.model || 'google/gemini-3-pro-preview',
                                              currentTemperature: step.temperature ?? 0.7,
                                              selectedTemperature: step.temperature ?? 0.7,
                                              currentMaxTokens: step.max_tokens ?? 8192,
                                              selectedMaxTokens: step.max_tokens ?? 8192,
                                            })}
                                            disabled={stepRunning || running === campaign.id}
                                            className="px-3 py-1.5 text-xs bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg hover:from-orange-700 hover:to-amber-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed font-medium transition-all"
                                          >
                                            {stepRunning ? 'Ejecutando...' : 'Ejecutar'}
                                          </button>
                                        </div>
                                      </div>

                                      {/* Deep Research Progress Visualizer */}
                                      {deepResearchPolling &&
                                       deepResearchPolling.campaignId === campaign.id &&
                                       deepResearchPolling.stepId === step.id && (
                                        <DeepResearchProgress
                                          campaignId={campaign.id}
                                          stepId={step.id}
                                          stepName={step.name}
                                          interactionId={deepResearchPolling.interactionId}
                                          logId={deepResearchPolling.logId}
                                          onComplete={handleDeepResearchComplete}
                                          onError={handleDeepResearchError}
                                        />
                                      )}
                                    </div>
                                  )
                                })}
                            </div>
                          </div>
                        )}

                        {/* Variables Tab */}
                        {expandedVariables.has(campaign.id) && (
                          <div>
                            {editingVariablesCampaignId === campaign.id ? (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                  {Object.entries(editingVariablesData).map(([key, value]) => {
                                    const isProjectVar = project?.variable_definitions?.some(v => v.name === key)
                                    const varDef = project?.variable_definitions?.find(v => v.name === key)
                                    return (
                                      <div key={key} className={`bg-white rounded-xl p-4 border ${isProjectVar ? 'border-orange-200' : 'border-gray-200'}`}>
                                        <label className="text-xs font-mono text-orange-600 block mb-2 flex items-center gap-1">
                                          {key}
                                          {varDef?.required && <span className="text-red-500">*</span>}
                                          {isProjectVar && <span className="text-gray-400 text-xs ml-1">(proyecto)</span>}
                                        </label>
                                        <input
                                          type="text"
                                          value={value}
                                          onChange={(e) => setEditingVariablesData(prev => ({
                                            ...prev,
                                            [key]: e.target.value
                                          }))}
                                          placeholder={varDef?.description || ''}
                                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
                                        />
                                      </div>
                                    )
                                  })}
                                </div>
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => saveEditingVariables(campaign.id)}
                                    disabled={savingVariables}
                                    className="px-4 py-2 text-sm bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 inline-flex items-center gap-2 font-medium"
                                  >
                                    {savingVariables ? 'Guardando...' : (
                                      <>
                                        <Check size={16} />
                                        Guardar
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={cancelEditingVariables}
                                    disabled={savingVariables}
                                    className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                  {Object.entries(getMergedVariables(campaign)).map(([key, value]) => {
                                    const isProjectVar = project?.variable_definitions?.some(v => v.name === key)
                                    const varDef = project?.variable_definitions?.find(v => v.name === key)
                                    const hasValue = value && value.trim() !== ''
                                    return (
                                      <div key={key} className={`bg-white rounded-xl p-4 border ${isProjectVar ? 'border-orange-200' : 'border-gray-200'}`}>
                                        <code className="text-xs font-mono text-orange-600 block mb-1.5 flex items-center gap-1">
                                          {key}
                                          {varDef?.required && <span className="text-red-500">*</span>}
                                        </code>
                                        <span className="text-sm text-gray-800 block truncate" title={value}>
                                          {hasValue ? value : <span className="italic text-gray-400">vacío</span>}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                                <button
                                  onClick={() => startEditingVariables(campaign)}
                                  className="mt-4 px-4 py-2 text-sm bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg hover:from-orange-700 hover:to-amber-700 font-medium"
                                >
                                  Editar variables
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Research Tab */}
                        {expandedResearchPrompts.has(campaign.id) && (
                          <div className="space-y-4">
                            {campaign.research_prompt && (
                              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-200">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <h5 className="font-medium text-indigo-800">Prompt de esta campaña</h5>
                                  <button
                                    onClick={() => copyPromptToClipboard(`research-${campaign.id}`, campaign.research_prompt || '', {})}
                                    className={`px-3 py-1.5 text-xs rounded-lg inline-flex items-center gap-1.5 ${
                                      copiedPromptId === `research-${campaign.id}`
                                        ? 'bg-green-600 text-white'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    }`}
                                  >
                                    {copiedPromptId === `research-${campaign.id}` ? <Check size={14} /> : <Copy size={14} />}
                                    {copiedPromptId === `research-${campaign.id}` ? 'Copiado' : 'Copiar'}
                                  </button>
                                </div>
                                <p className="text-sm text-indigo-700 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono bg-white/50 rounded-lg p-3">
                                  {campaign.research_prompt}
                                </p>
                              </div>
                            )}

                            {project?.deep_research_prompts && project.deep_research_prompts.map((prompt) => {
                              const campaignVars = campaign.custom_variables as Record<string, string> || {}
                              const processedPrompt = getPromptWithRealValues(prompt.content, campaignVars)
                              const isCopied = copiedPromptId === `${campaign.id}-${prompt.id}`

                              return (
                                <div key={prompt.id} className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-200">
                                  <div className="flex items-start justify-between gap-3 mb-3">
                                    <h5 className="font-medium text-purple-800">{prompt.name}</h5>
                                    <button
                                      onClick={() => copyPromptToClipboard(`${campaign.id}-${prompt.id}`, prompt.content, campaignVars)}
                                      className={`px-3 py-1.5 text-xs rounded-lg inline-flex items-center gap-1.5 ${
                                        isCopied
                                          ? 'bg-green-600 text-white'
                                          : 'bg-purple-600 text-white hover:bg-purple-700'
                                      }`}
                                    >
                                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                      {isCopied ? 'Copiado' : 'Copiar'}
                                    </button>
                                  </div>
                                  <p className="text-sm text-purple-700 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono bg-white/50 rounded-lg p-3">
                                    {processedPrompt}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Documents Tab */}
                        {expandedDocs.has(campaign.id) && (
                          <div>
                            {campaignDocs[campaign.id]?.length > 0 ? (
                              <div className="space-y-2">
                                {campaignDocs[campaign.id].map(doc => (
                                  <div key={doc.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                                    <div className="p-2 bg-gray-100 rounded-lg">
                                      <FileText size={16} className="text-gray-500" />
                                    </div>
                                    <span className="text-sm text-gray-700 flex-1 font-medium">{doc.filename}</span>
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">{doc.category}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-12">
                                <FileText size={32} className="mx-auto mb-3 text-gray-300" />
                                <p className="text-gray-500 text-sm">No hay documentos asignados</p>
                                <p className="text-gray-400 text-xs mt-1">Asigna documentos desde la pestaña Documentos</p>
                              </div>
                            )}
                            <button
                              onClick={() => setShowDocsGuide(campaign.id)}
                              className="mt-4 text-sm text-orange-600 hover:text-orange-700 font-medium"
                            >
                              Ver guía de documentación
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Campaign Flow Editor */}
      {editingFlowCampaignId && (() => {
        const editingCampaign = campaigns.find(c => c.id === editingFlowCampaignId)
        const filteredDocuments = documents.filter(doc =>
          !doc.campaign_id || doc.campaign_id === editingFlowCampaignId
        )
        const allCampaignVariables: Record<string, string> = editingCampaign
          ? {
              ...(editingCampaign.ecp_name && { ecp_name: editingCampaign.ecp_name }),
              ...(editingCampaign.problem_core && { problem_core: editingCampaign.problem_core }),
              ...(editingCampaign.country && { country: editingCampaign.country }),
              ...(editingCampaign.industry && { industry: editingCampaign.industry }),
              ...getMergedVariables(editingCampaign),
            }
          : {}
        return (
          <CampaignFlowEditor
            campaignId={editingFlowCampaignId}
            projectId={projectId}
            clientId={project?.client?.id || ''}
            initialFlowConfig={editingCampaign?.flow_config || project?.flow_config || null}
            documents={filteredDocuments}
            projectVariables={project?.variable_definitions || []}
            campaignVariables={allCampaignVariables}
            onClose={() => setEditingFlowCampaignId(null)}
            onSave={(flowConfig) => {
              setCampaigns(prev => prev.map(c =>
                c.id === editingFlowCampaignId ? { ...c, flow_config: flowConfig } : c
              ))
              setEditingFlowCampaignId(null)
            }}
          />
        )
      })()}

      {/* Step Output Editor */}
      {editingStepOutput && (() => {
        const campaign = campaigns.find(c => c.id === editingStepOutput.campaignId)
        const stepOutput = campaign?.step_outputs?.[editingStepOutput.stepId]

        if (!campaign || !stepOutput) return null

        // Filter documents that belong to this step
        const stepDocuments = documents.filter(doc =>
          editingStepOutput.baseDocIds.includes(doc.id)
        )

        return (
          <StepOutputEditor
            campaignId={editingStepOutput.campaignId}
            campaignName={editingStepOutput.campaignName}
            stepId={editingStepOutput.stepId}
            stepName={editingStepOutput.stepName}
            stepOrder={editingStepOutput.stepOrder}
            currentOutput={stepOutput}
            allStepOutputs={campaign.step_outputs || {}}
            stepDocuments={stepDocuments}
            onSave={(updatedStepOutputs) => {
              setCampaigns(prev => prev.map(c =>
                c.id === editingStepOutput.campaignId
                  ? { ...c, step_outputs: updatedStepOutputs }
                  : c
              ))
            }}
            onClose={() => setEditingStepOutput(null)}
            // Context Lake integration
            projectId={projectId}
            clientId={project?.client_id}
            userId={user?.id}
            playbookId={projectId}
            playbookName={project?.name}
            campaignVariables={campaign.custom_variables}
            onSaveToContextLake={(docId) => {
              toast.success('Guardado', `Documento guardado en Context Lake (ID: ${docId.substring(0, 8)}...)`)
            }}
          />
        )
      })()}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <CampaignBulkUpload
          projectId={projectId}
          projectVariables={project?.variable_definitions || []}
          onClose={() => setShowBulkUpload(false)}
          onSuccess={() => {
            loadCampaigns()
          }}
        />
      )}

      {/* Campaign Comparison Modal */}
      {showComparison && campaigns.length >= 2 && (
        <CampaignComparison
          campaigns={campaigns}
          projectFlowConfig={project?.flow_config || null}
          onClose={() => setShowComparison(false)}
        />
      )}

      {/* Report Generator Modal */}
      {showReportGenerator && project && (
        <ReportGenerator
          projectId={projectId}
          projectName={project.name}
          campaigns={campaigns}
          steps={project.flow_config?.steps || []}
          customStatuses={project.custom_statuses}
          onClose={() => setShowReportGenerator(false)}
        />
      )}

      {/* Documentation Guide Modal */}
      {showDocsGuide && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Guía de Documentación</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Documentos adicionales recomendados
                </p>
              </div>
              <button
                onClick={() => setShowDocsGuide(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="prose prose-sm max-w-none text-gray-700">
                {project?.campaign_docs_guide ? (
                  <div className="whitespace-pre-wrap">{project.campaign_docs_guide}</div>
                ) : (
                  <div className="space-y-4">
                    <p>Para cada campaña, considera subir los siguientes documentos:</p>
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                      <h4 className="font-semibold text-blue-800 mb-2">1. Análisis de competidores</h4>
                      <p className="text-blue-700 text-sm">Investiga cómo los competidores abordan este problema específico.</p>
                    </div>
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                      <h4 className="font-semibold text-green-800 mb-2">2. Research de mercado</h4>
                      <p className="text-green-700 text-sm">Datos y estadísticas del segmento objetivo.</p>
                    </div>
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                      <h4 className="font-semibold text-purple-800 mb-2">3. Casos de uso</h4>
                      <p className="text-purple-700 text-sm">Ejemplos o testimonios relevantes.</p>
                    </div>
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
                      <h4 className="font-semibold text-orange-800 mb-2">4. Materiales de producto</h4>
                      <p className="text-orange-700 text-sm">Características relevantes para este ECP.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500">
                Sube documentos desde la pestaña "Documentos" y asígnalos a esta campaña.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step Execution Config Dialog */}
      {stepExecutionConfig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Rocket className="text-orange-600" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Ejecutar paso</h2>
                  <p className="text-sm text-gray-600">{stepExecutionConfig.stepName}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Current model info */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Cpu size={16} />
                  <span>Modelo configurado:</span>
                </div>
                <p className="font-medium text-gray-900">
                  {LLM_MODELS.find(m => m.value === stepExecutionConfig.currentModel)?.label || stepExecutionConfig.currentModel}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {LLM_MODELS.find(m => m.value === stepExecutionConfig.currentModel)?.provider || 'Desconocido'}
                </p>
              </div>

              {/* Model selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar modelo:
                </label>
                <OpenRouterModelSelector
                  value={stepExecutionConfig.selectedModel}
                  onChange={(modelId) => setStepExecutionConfig({ ...stepExecutionConfig, selectedModel: modelId })}
                />
              </div>

              {/* Temperature and Max Tokens */}
              <div className="grid grid-cols-2 gap-4">
                {/* Temperature */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Temperature: {stepExecutionConfig.selectedTemperature}
                    {stepExecutionConfig.selectedTemperature !== stepExecutionConfig.currentTemperature && (
                      <span className="text-orange-600 ml-1">(modificado)</span>
                    )}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={stepExecutionConfig.selectedTemperature}
                    onChange={(e) => setStepExecutionConfig({
                      ...stepExecutionConfig,
                      selectedTemperature: parseFloat(e.target.value)
                    })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Preciso</span>
                    <span>Creativo</span>
                  </div>
                </div>

                {/* Max Tokens */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Tokens
                    {stepExecutionConfig.selectedMaxTokens !== stepExecutionConfig.currentMaxTokens && (
                      <span className="text-orange-600 ml-1">(modificado)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="1000"
                    max="128000"
                    step="1000"
                    value={stepExecutionConfig.selectedMaxTokens}
                    onChange={(e) => setStepExecutionConfig({
                      ...stepExecutionConfig,
                      selectedMaxTokens: parseInt(e.target.value) || 8192
                    })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {(() => {
                      const equiv = getTokenEquivalence(stepExecutionConfig.selectedMaxTokens)
                      return `≈ ${equiv.words.toLocaleString()} palabras (${equiv.pages} páginas)`
                    })()}
                  </div>
                </div>
              </div>

              {/* Deep Research warning */}
              {stepExecutionConfig.selectedModel.includes('deep-research') && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
                  <Info className="text-purple-600 flex-shrink-0 mt-0.5" size={18} />
                  <div className="text-sm text-purple-700">
                    <p className="font-medium">Deep Research</p>
                    <p className="mt-1">Este modelo es un agente autónomo de investigación. Puede tardar entre 5-10 minutos en completar.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={() => {
                  const overrideModel = stepExecutionConfig.selectedModel !== stepExecutionConfig.currentModel
                    ? stepExecutionConfig.selectedModel
                    : undefined
                  const overrideTemperature = stepExecutionConfig.selectedTemperature !== stepExecutionConfig.currentTemperature
                    ? stepExecutionConfig.selectedTemperature
                    : undefined
                  const overrideMaxTokens = stepExecutionConfig.selectedMaxTokens !== stepExecutionConfig.currentMaxTokens
                    ? stepExecutionConfig.selectedMaxTokens
                    : undefined
                  setStepExecutionConfig(null)
                  handleRunStep(
                    stepExecutionConfig.campaignId,
                    stepExecutionConfig.stepId,
                    stepExecutionConfig.stepName,
                    overrideModel,
                    overrideTemperature,
                    overrideMaxTokens
                  )
                }}
                disabled={runningStep !== null}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-700 hover:to-amber-700 font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {runningStep ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Ejecutando...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Ejecutar
                  </>
                )}
              </button>
              <button
                onClick={() => setStepExecutionConfig(null)}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-white font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retry Model Dialog */}
      {retryDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-red-50 to-orange-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <AlertCircle className="text-red-500" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Error en ejecución</h2>
                  <p className="text-sm text-gray-600">Paso: {retryDialog.stepName}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Error source badge */}
              {retryDialog.errorSource && (
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    retryDialog.errorSource === 'openrouter'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {retryDialog.errorSource === 'openrouter' && '🔌 Error de OpenRouter'}
                    {retryDialog.errorSource === 'api' && '⚙️ Error de API'}
                    {!['openrouter', 'api'].includes(retryDialog.errorSource) && '❓ Error desconocido'}
                  </span>
                </div>
              )}

              {/* Error message */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                {retryDialog.error.includes('<!DOCTYPE') || retryDialog.error.includes('<html') ? (
                  <p className="text-sm text-red-700">
                    OpenRouter devolvió una respuesta inválida (HTML en lugar de JSON).
                    Esto suele ser un error temporal del servidor.
                    <strong className="block mt-2">Verifica si el paso se completó antes de reintentar.</strong>
                  </p>
                ) : (
                  <p className="text-sm text-red-700 break-words">
                    {retryDialog.error.substring(0, 300)}
                    {retryDialog.error.length > 300 && '...'}
                  </p>
                )}
              </div>

              {/* Original error (collapsible for debugging) */}
              {retryDialog.originalError && retryDialog.originalError !== retryDialog.error && (
                <details className="text-xs">
                  <summary className="text-gray-500 cursor-pointer hover:text-gray-700">
                    Ver error original (técnico)
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-gray-600 overflow-x-auto">
                    {retryDialog.originalError}
                  </pre>
                </details>
              )}

              {/* Failed model info */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Cpu size={16} />
                <span>Modelo que falló: <strong className="text-gray-900">{retryDialog.failedModel}</strong></span>
              </div>

              {/* Model selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecciona otro modelo para reintentar:
                </label>
                <OpenRouterModelSelector
                  value={retryDialog.selectedModel}
                  onChange={(modelId) => setRetryDialog({ ...retryDialog, selectedModel: modelId })}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={handleRetryWithModel}
                disabled={runningStep !== null || !retryDialog.selectedModel}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {runningStep ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Ejecutando...
                  </>
                ) : !retryDialog.selectedModel ? (
                  <>
                    <RefreshCw size={16} />
                    Selecciona un modelo
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Reintentar
                  </>
                )}
              </button>
              <button
                onClick={() => setRetryDialog(null)}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-white font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Dropdown Portal - Renders on top of everything */}
      {statusDropdownOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
            onClick={() => setStatusDropdownOpen(null)}
          />
          {/* Dropdown menu */}
          <div
            className="fixed bg-white border border-gray-200 rounded-xl shadow-2xl w-[220px] py-1 overflow-hidden"
            style={{
              zIndex: 9999,
              top: statusDropdownOpen.position.top,
              left: Math.max(10, statusDropdownOpen.position.left),
            }}
          >
            {getCustomStatuses().map(status => {
              const colors = getStatusColors(status.color)
              const Icon = getStatusIcon(status.icon)
              const currentCampaign = campaigns.find(c => c.id === statusDropdownOpen.campaignId)
              const isSelected = currentCampaign?.status === status.id
              return (
                <button
                  key={status.id}
                  onClick={() => handleUpdateCampaignStatus(statusDropdownOpen.campaignId, status.id)}
                  className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                >
                  <div
                    className="p-1.5 rounded-lg"
                    style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
                  >
                    <Icon size={14} style={{ color: colors.text }} />
                  </div>
                  <span className="flex-1 font-medium" style={{ color: colors.text }}>
                    {status.name}
                  </span>
                  {isSelected && <Check size={14} className="text-blue-600" />}
                </button>
              )
            })}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={() => {
                  setStatusDropdownOpen(null)
                  setShowStatusManager(true)
                }}
                className="w-full px-3 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-3"
              >
                <div className="p-1.5 rounded-lg bg-gray-100">
                  <Settings size={14} className="text-gray-600" />
                </div>
                Gestionar status...
              </button>
            </div>
          </div>
        </>
      )}

      {/* Status Manager Modal */}
      {showStatusManager && (
        <StatusManager
          statuses={getCustomStatuses()}
          onSave={handleSaveCustomStatuses}
          onClose={() => setShowStatusManager(false)}
        />
      )}

      {/* OpenRouter Auth Modal */}
      <OpenRouterAuthModal
        isOpen={showOpenRouterModal}
        onClose={() => setShowOpenRouterModal(false)}
        trigger="action"
      />
    </div>
  )
}
