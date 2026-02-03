'use client'

/**
 * CampaignFullScreenView Component
 *
 * Full-screen wizard view for campaign execution.
 * Replaces the accordion-style campaign runner with a
 * sidebar navigation and tabbed content areas.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ArrowLeft,
  Settings,
  Database,
  Play,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Edit3,
  Save,
  X,
  Scan,
  AlertTriangle,
  Info,
} from 'lucide-react'
import ScrapersAllInOneView from './ScrapersAllInOneView'
import StepRequirementsIndicator, { StepRequirementsBadge } from './StepRequirementsIndicator'
import {
  ALL_DOCUMENT_REQUIREMENTS,
  STEP_DOCUMENT_REQUIREMENTS,
  getDocumentsForStep,
} from '@/lib/playbooks/competitor-analysis/constants'
import { COMPETITOR_FLOW_STEPS } from '@/lib/playbooks/competitor-analysis/config'
import { ALL_PROMPTS } from '@/lib/playbooks/competitor-analysis/prompts'
import { createClient } from '@/lib/supabase-browser'
import { useToast, useModal } from '@/components/ui'

// ============================================
// TYPES
// ============================================

interface Campaign {
  id: string
  ecp_name: string
  status: string
  current_step_id: string | null
  step_outputs: Record<string, any>
  created_at: string
  started_at: string | null
  completed_at: string | null
  custom_variables?: Record<string, string>
  flow_config?: FlowConfig | null
}

interface FlowConfig {
  steps: FlowStep[]
}

interface FlowStep {
  id: string
  name: string
  prompt_template?: string
  requires_docs?: boolean
}

interface Project {
  id: string
  name: string
  playbook_type?: string
  variable_definitions?: any[]
  flow_config?: FlowConfig
}

interface Document {
  id: string
  name: string
  created_at: string
  metadata?: {
    source_type?: string
    competitor?: string
    campaign_id?: string
  }
}

type TabKey = 'flow' | 'scrapers' | 'variables' | 'documents'

export interface CampaignFullScreenViewProps {
  campaignId: string
  projectId: string
  campaign: Campaign
  project?: Project | null
  onClose: () => void
  onCampaignUpdated?: () => void
}

// ============================================
// SIDEBAR TAB CONFIG
// ============================================

const SIDEBAR_TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'flow', label: 'Flujo', icon: <Play size={18} /> },
  { key: 'scrapers', label: 'Scrapers', icon: <Database size={18} /> },
  { key: 'variables', label: 'Variables', icon: <Settings size={18} /> },
  { key: 'documents', label: 'Documentos', icon: <FileText size={18} /> },
]

// ============================================
// MAIN COMPONENT
// ============================================

export default function CampaignFullScreenView({
  campaignId,
  projectId,
  campaign: initialCampaign,
  project,
  onClose,
  onCampaignUpdated,
}: CampaignFullScreenViewProps) {
  const toast = useToast()
  const modal = useModal()
  const supabase = useMemo(() => createClient(), [])

  // State
  const [campaign, setCampaign] = useState<Campaign>(initialCampaign)
  const [activeTab, setActiveTab] = useState<TabKey>('flow')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loadingDocuments, setLoadingDocuments] = useState(true)
  const [executingStep, setExecutingStep] = useState<string | null>(null)

  // Step expansion and editing state
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [editingStep, setEditingStep] = useState<string | null>(null)
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({})

  // Variable detection state
  const [variableDetection, setVariableDetection] = useState<{
    detected: string[]
    declared: string[]
    missing: string[]
    unused: string[]
  } | null>(null)
  const [detectingVariables, setDetectingVariables] = useState(false)

  // Toggle step expansion
  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }

  // Get prompt for a step
  const getStepPrompt = (stepId: string): string => {
    // First check edited prompts
    if (editedPrompts[stepId]) return editedPrompts[stepId]
    // Then check campaign flow config
    const stepConfig = campaign.flow_config?.steps?.find(s => s.id === stepId)
    if (stepConfig?.prompt_template) return stepConfig.prompt_template
    // Finally use default prompts
    const promptKey = stepId.replace(/-/g, '_') as keyof typeof ALL_PROMPTS
    return ALL_PROMPTS[promptKey] || ''
  }

  // Save edited prompt
  const saveEditedPrompt = async (stepId: string) => {
    const prompt = editedPrompts[stepId]
    if (!prompt) return

    try {
      // Update campaign flow config with new prompt
      const currentSteps = campaign.flow_config?.steps || flowSteps
      const updatedSteps = currentSteps.map(s =>
        s.id === stepId ? { ...s, prompt_template: prompt } : s
      )

      const { error } = await supabase
        .from('campaigns')
        .update({
          flow_config: { steps: updatedSteps }
        })
        .eq('id', campaignId)

      if (error) throw error

      // Update local state
      setCampaign(prev => ({
        ...prev,
        flow_config: { steps: updatedSteps }
      }))

      setEditingStep(null)
      toast.success('Prompt guardado')
    } catch (error) {
      console.error('Error saving prompt:', error)
      toast.error('Error al guardar prompt')
    }
  }

  // Detect variables in campaign prompts
  const detectVariables = async () => {
    setDetectingVariables(true)
    try {
      const response = await fetch('/api/campaign/detect-variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId }),
      })

      if (!response.ok) {
        throw new Error('Failed to detect variables')
      }

      const data = await response.json()
      setVariableDetection(data)

      if (data.missing.length > 0) {
        toast.info(`Se detectaron ${data.missing.length} variables sin declarar`)
      } else {
        toast.success('Todas las variables están declaradas')
      }
    } catch (error) {
      console.error('Error detecting variables:', error)
      toast.error('Error al detectar variables')
    } finally {
      setDetectingVariables(false)
    }
  }

  // Auto-add missing variables to campaign
  const addMissingVariables = async () => {
    if (!variableDetection || variableDetection.missing.length === 0) return

    try {
      const response = await fetch('/api/campaign/detect-variables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaignId,
          variables: variableDetection.missing,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add variables')
      }

      const data = await response.json()

      // Refresh campaign data
      const { data: updatedCampaign, error } = await supabase
        .from('ecp_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (!error && updatedCampaign) {
        setCampaign(updatedCampaign as Campaign)
      }

      toast.success(`${data.added.length} variables agregadas`)

      // Re-detect to update the UI
      await detectVariables()
    } catch (error) {
      console.error('Error adding variables:', error)
      toast.error('Error al guardar prompt')
    }
  }

  // Get competitor name from variables
  const competitorName = campaign.custom_variables?.competitor_name || 'Competidor'

  // Get flow steps - fallback to competitor analysis steps if no flow config
  const flowSteps = useMemo(() => {
    const steps = campaign.flow_config?.steps || project?.flow_config?.steps
    if (steps && steps.length > 0) return steps
    // Fallback to competitor analysis default steps
    return COMPETITOR_FLOW_STEPS
  }, [campaign.flow_config, project?.flow_config])

  // Load documents for this campaign
  const loadDocuments = useCallback(async () => {
    try {
      setLoadingDocuments(true)
      const { data, error } = await supabase
        .from('documents')
        .select('id, name, created_at, metadata')
        .eq('project_id', projectId)
        .or(`metadata->>campaign_id.eq.${campaignId},metadata->>competitor.eq.${competitorName}`)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error) {
      console.error('Error loading documents:', error)
    } finally {
      setLoadingDocuments(false)
    }
  }, [supabase, projectId, campaignId, competitorName])

  // Load documents on mount
  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // Calculate scraper stats
  const scraperStats = useMemo(() => {
    const total = ALL_DOCUMENT_REQUIREMENTS.length
    const completed = ALL_DOCUMENT_REQUIREMENTS.filter((doc) =>
      documents.some(
        (d) =>
          d.metadata?.source_type === doc.source_type && d.metadata?.competitor === competitorName
      )
    ).length

    return { total, completed, pending: total - completed }
  }, [documents, competitorName])

  // Calculate flow stats
  const flowStats = useMemo(() => {
    const total = flowSteps.length
    const completed = flowSteps.filter((step) => campaign.step_outputs?.[step.id]).length

    return { total, completed, pending: total - completed }
  }, [flowSteps, campaign.step_outputs])

  // Handle document generated
  const handleDocumentGenerated = useCallback(
    (documentId: string, sourceType: string) => {
      loadDocuments()
      onCampaignUpdated?.()
    },
    [loadDocuments, onCampaignUpdated]
  )

  // Handle view document
  const handleViewDocument = useCallback(
    (documentId: string) => {
      window.open(`/projects/${projectId}/documents/${documentId}`, '_blank')
    },
    [projectId]
  )

  // Execute a flow step
  const executeStep = async (step: FlowStep) => {
    // Check required documents
    const requiredDocs = getDocumentsForStep(step.id)
    const missingDocs = requiredDocs.filter(
      (doc) =>
        !documents.some(
          (d) =>
            d.metadata?.source_type === doc.source_type && d.metadata?.competitor === competitorName
        )
    )

    if (missingDocs.length > 0) {
      const proceed = await modal.confirm({
        title: 'Documentos faltantes',
        message: `Faltan ${missingDocs.length} documento(s) requeridos para este paso. ¿Deseas ejecutar de todos modos con los documentos disponibles?`,
        confirmText: 'Ejecutar de todos modos',
        cancelText: 'Ir a Scrapers',
        variant: 'warning',
      })

      if (!proceed) {
        setActiveTab('scrapers')
        return
      }
    }

    setExecutingStep(step.id)

    try {
      // TODO: Implement actual step execution
      // This would call the step execution API
      toast.info('Ejecutando', `Ejecutando paso: ${step.name}`)

      // Simulate execution for now
      await new Promise((resolve) => setTimeout(resolve, 2000))

      toast.success('Completado', `Paso "${step.name}" ejecutado exitosamente`)
      onCampaignUpdated?.()
    } catch (error) {
      toast.error('Error', error instanceof Error ? error.message : 'Error al ejecutar el paso')
    } finally {
      setExecutingStep(null)
    }
  }

  // Navigate to scrapers tab
  const navigateToScrapers = () => {
    setActiveTab('scrapers')
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700'
      case 'running':
        return 'bg-blue-100 text-blue-700'
      case 'error':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-gray-200 bg-white flex items-center px-4 flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mr-4"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Volver</span>
        </button>

        <div className="flex-1 flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900 truncate">{campaign.ecp_name}</h1>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
            {campaign.status === 'completed'
              ? 'Completada'
              : campaign.status === 'running'
                ? 'En progreso'
                : campaign.status === 'error'
                  ? 'Con errores'
                  : 'Pendiente'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Competidor:</span>
          <span className="font-medium text-gray-900">{competitorName}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 border-r border-gray-200 bg-gray-50 flex flex-col flex-shrink-0">
          {/* Navigation tabs */}
          <nav className="flex-1 py-4">
            {SIDEBAR_TABS.map((tab) => {
              const isActive = activeTab === tab.key

              // Get count for each tab
              let count: string | number = ''
              let hasWarning = false

              if (tab.key === 'flow') {
                count = `${flowStats.completed}/${flowStats.total}`
                hasWarning = flowStats.pending > 0
              } else if (tab.key === 'scrapers') {
                count = `${scraperStats.completed}/${scraperStats.total}`
                hasWarning = scraperStats.pending > 0
              }

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                    isActive
                      ? 'bg-white border-l-2 border-blue-500 text-blue-700'
                      : 'border-l-2 border-transparent text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{tab.icon}</span>
                  <span className="flex-1 text-sm font-medium">{tab.label}</span>
                  {count && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        isActive
                          ? 'bg-blue-100 text-blue-700'
                          : hasWarning
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Quick stats */}
          <div className="p-4 border-t border-gray-200">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-500">
                <span>Progreso total</span>
                <span className="font-medium text-gray-900">
                  {Math.round(((flowStats.completed + scraperStats.completed) / (flowStats.total + scraperStats.total)) * 100)}%
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{
                    width: `${((flowStats.completed + scraperStats.completed) / (flowStats.total + scraperStats.total)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {/* Flow Tab */}
          {activeTab === 'flow' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Flujo de Analisis</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Ejecuta cada paso del analisis de competidor en orden
                  </p>
                </div>

                {/* Steps list */}
                <div className="space-y-4">
                  {flowSteps.map((step, index) => {
                    const stepOutput = campaign.step_outputs?.[step.id]
                    const isCompleted = !!stepOutput
                    const isExecuting = executingStep === step.id
                    const requiredDocs = getDocumentsForStep(step.id)
                    const isExpanded = expandedSteps.has(step.id)
                    const isEditing = editingStep === step.id
                    const currentPrompt = getStepPrompt(step.id)

                    return (
                      <div
                        key={step.id}
                        className={`border rounded-xl overflow-hidden transition-all ${
                          isCompleted
                            ? 'border-green-200 bg-green-50/50'
                            : isExecuting
                              ? 'border-blue-300 bg-blue-50'
                              : 'border-gray-200 bg-white'
                        }`}
                      >
                        {/* Step header - clickable to expand */}
                        <div
                          className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
                          onClick={() => toggleStepExpansion(step.id)}
                        >
                          {/* Expand icon */}
                          <div className="text-gray-400">
                            {isExpanded ? (
                              <ChevronDown size={18} />
                            ) : (
                              <ChevronRight size={18} />
                            )}
                          </div>

                          {/* Step number/status */}
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isCompleted
                                ? 'bg-green-100'
                                : isExecuting
                                  ? 'bg-blue-100'
                                  : 'bg-gray-100'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle size={18} className="text-green-600" />
                            ) : isExecuting ? (
                              <Loader2 size={18} className="text-blue-600 animate-spin" />
                            ) : (
                              <span className="text-sm font-medium text-gray-500">{index + 1}</span>
                            )}
                          </div>

                          {/* Step info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900">{step.name}</h3>
                            {isCompleted && stepOutput?.generated_at && (
                              <p className="text-xs text-green-600 mt-0.5">
                                Completado{' '}
                                {new Date(stepOutput.generated_at).toLocaleDateString('es-ES')}
                              </p>
                            )}
                            {!isExpanded && currentPrompt && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-md">
                                {currentPrompt.substring(0, 80)}...
                              </p>
                            )}
                          </div>

                          {/* Requirements badge */}
                          {requiredDocs.length > 0 && (
                            <StepRequirementsBadge
                              stepId={step.id}
                              competitorName={competitorName}
                              existingDocuments={documents}
                            />
                          )}

                          {/* Actions - stop propagation to prevent expansion toggle */}
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {isCompleted && (
                              <button
                                onClick={() => handleViewDocument(stepOutput.document_id)}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                Ver output
                              </button>
                            )}
                            <button
                              onClick={() => executeStep(step)}
                              disabled={isExecuting}
                              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                isCompleted
                                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {isExecuting ? (
                                <span className="flex items-center gap-2">
                                  <Loader2 size={14} className="animate-spin" />
                                  Ejecutando...
                                </span>
                              ) : isCompleted ? (
                                <span className="flex items-center gap-1">
                                  <RefreshCw size={14} />
                                  Re-ejecutar
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Play size={14} />
                                  Ejecutar
                                </span>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50/50">
                            {/* Requirements panel */}
                            {requiredDocs.length > 0 && !isCompleted && (
                              <div className="pt-3 pb-4">
                                <StepRequirementsIndicator
                                  stepId={step.id}
                                  competitorName={competitorName}
                                  existingDocuments={documents}
                                  onNavigateToScrapers={navigateToScrapers}
                                  onViewDocument={handleViewDocument}
                                />
                              </div>
                            )}

                            {/* Prompt section */}
                            <div className="pt-3">
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-700">
                                  Prompt del paso
                                </label>
                                {!isEditing ? (
                                  <button
                                    onClick={() => {
                                      setEditingStep(step.id)
                                      setEditedPrompts(prev => ({
                                        ...prev,
                                        [step.id]: currentPrompt
                                      }))
                                    }}
                                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                                  >
                                    <Edit3 size={14} />
                                    Editar
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => saveEditedPrompt(step.id)}
                                      className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
                                    >
                                      <Save size={14} />
                                      Guardar
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingStep(null)
                                        setEditedPrompts(prev => {
                                          const next = { ...prev }
                                          delete next[step.id]
                                          return next
                                        })
                                      }}
                                      className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                                    >
                                      <X size={14} />
                                      Cancelar
                                    </button>
                                  </div>
                                )}
                              </div>
                              {isEditing ? (
                                <textarea
                                  value={editedPrompts[step.id] || ''}
                                  onChange={(e) => setEditedPrompts(prev => ({
                                    ...prev,
                                    [step.id]: e.target.value
                                  }))}
                                  className="w-full h-64 p-3 text-sm font-mono bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                                  placeholder="Escribe el prompt para este paso..."
                                />
                              ) : (
                                <div className="w-full max-h-64 overflow-y-auto p-3 text-sm font-mono bg-white border border-gray-200 rounded-lg whitespace-pre-wrap text-gray-700">
                                  {currentPrompt || <span className="text-gray-400 italic">Sin prompt configurado</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Scrapers Tab */}
          {activeTab === 'scrapers' && (
            <ScrapersAllInOneView
              campaignId={campaignId}
              projectId={projectId}
              competitorName={competitorName}
              scraperInputs={campaign.custom_variables || {}}
              existingDocuments={documents}
              onDocumentGenerated={handleDocumentGenerated}
              onViewDocument={handleViewDocument}
            />
          )}

          {/* Variables Tab */}
          {activeTab === 'variables' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Variables de Campaña</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Gestiona las variables usadas en los prompts
                    </p>
                  </div>
                  <button
                    onClick={detectVariables}
                    disabled={detectingVariables}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {detectingVariables ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Detectando...
                      </>
                    ) : (
                      <>
                        <Scan className="w-4 h-4" />
                        Auto-detectar Variables
                      </>
                    )}
                  </button>
                </div>

                {/* Detection Results */}
                {variableDetection && (
                  <div className="space-y-4">
                    {/* Missing Variables - Need Action */}
                    {variableDetection.missing.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                            <h3 className="font-semibold text-amber-900">
                              Variables sin declarar ({variableDetection.missing.length})
                            </h3>
                          </div>
                          <button
                            onClick={addMissingVariables}
                            className="px-3 py-1 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700"
                          >
                            Agregar todas
                          </button>
                        </div>
                        <p className="text-sm text-amber-700 mb-2">
                          Estas variables se usan en los prompts pero no tienen valores asignados:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {variableDetection.missing.map(varName => (
                            <span
                              key={varName}
                              className="inline-flex items-center px-3 py-1 bg-white border border-amber-300 rounded-full text-sm font-mono text-amber-800"
                            >
                              {`{{${varName}}}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Declared and Used Variables - All Good */}
                    {variableDetection.declared.filter(v => variableDetection.detected.includes(v)).length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <h3 className="font-semibold text-green-900">
                            Variables declaradas y en uso ({variableDetection.declared.filter(v => variableDetection.detected.includes(v)).length})
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {variableDetection.declared.filter(v => variableDetection.detected.includes(v)).map(varName => (
                            <span
                              key={varName}
                              className="inline-flex items-center px-3 py-1 bg-white border border-green-300 rounded-full text-sm font-mono text-green-800"
                            >
                              {`{{${varName}}}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unused Variables - Info */}
                    {variableDetection.unused.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Info className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold text-blue-900">
                            Variables declaradas pero no usadas ({variableDetection.unused.length})
                          </h3>
                        </div>
                        <p className="text-sm text-blue-700 mb-2">
                          Estas variables tienen valores pero no se usan en ningún prompt:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {variableDetection.unused.map(varName => (
                            <span
                              key={varName}
                              className="inline-flex items-center px-3 py-1 bg-white border border-blue-300 rounded-full text-sm font-mono text-blue-800"
                            >
                              {`{{${varName}}}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* All Good Message */}
                    {variableDetection.missing.length === 0 &&
                      variableDetection.unused.length === 0 &&
                      variableDetection.detected.length > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                          <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                          <p className="text-green-900 font-semibold">¡Todas las variables están correctamente configuradas!</p>
                        </div>
                      )}

                    {/* No Variables Used */}
                    {variableDetection.detected.length === 0 && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                        <Info className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">No se detectaron variables en los prompts de esta campaña</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Current Variables Table */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">Valores Actuales</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {Object.entries(campaign.custom_variables || {}).map(([key, value]) => (
                      <div key={key} className="px-4 py-3 flex items-start gap-4">
                        <span className="text-sm font-mono text-gray-500 w-48 flex-shrink-0">
                          {`{{${key}}}`}
                        </span>
                        <span className="text-sm text-gray-900 flex-1 break-words">
                          {typeof value === 'string' ? value || <em className="text-gray-400">(vacío)</em> : JSON.stringify(value)}
                        </span>
                      </div>
                    ))}
                    {Object.keys(campaign.custom_variables || {}).length === 0 && (
                      <div className="px-4 py-8 text-center text-gray-500">
                        No hay variables configuradas. Haz clic en "Auto-detectar Variables" para comenzar.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Documentos Generados</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {documents.length} documentos para {competitorName}
                    </p>
                  </div>
                  <button
                    onClick={loadDocuments}
                    disabled={loadingDocuments}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <RefreshCw size={16} className={loadingDocuments ? 'animate-spin' : ''} />
                  </button>
                </div>

                {loadingDocuments ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No hay documentos todavia
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Ejecuta los scrapers para generar documentos
                    </p>
                    <button
                      onClick={() => setActiveTab('scrapers')}
                      className="text-blue-600 font-medium hover:text-blue-700"
                    >
                      Ir a Scrapers
                    </button>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="divide-y divide-gray-100">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50"
                        >
                          <FileText size={18} className="text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                            <p className="text-xs text-gray-500">
                              {doc.metadata?.source_type && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 mr-2">
                                  {doc.metadata.source_type}
                                </span>
                              )}
                              {new Date(doc.created_at).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                          <button
                            onClick={() => handleViewDocument(doc.id)}
                            className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <ExternalLink size={14} />
                            Ver
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
