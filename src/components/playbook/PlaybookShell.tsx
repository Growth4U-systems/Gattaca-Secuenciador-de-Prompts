'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  PlaybookShellProps,
  PlaybookState,
  PhaseState,
  StepState,
  StepDefinition,
  PhaseDefinition,
} from './types'
import NavigationPanel from './NavigationPanel'
import WorkArea from './WorkArea'
import ConfigurationMode from './ConfigurationMode'
import CampaignWizard from './CampaignWizard'
import CampaignSettings from './CampaignSettings'
import { Settings, ChevronDown, Plus, Folder, Pencil, Trash2 } from 'lucide-react'

// Mode types for the unified view
type PlaybookMode = 'config' | 'campaign'

interface Campaign {
  id: string
  name: string
  status: 'draft' | 'in_progress' | 'completed'
  completedSteps: number
  totalSteps: number
  customVariables?: Record<string, unknown> // Includes context_type, product, target, etc.
  playbookState?: PlaybookState // Saved playbook state for persistence
}

function initializeState(
  projectId: string,
  playbookConfig: PlaybookShellProps['playbookConfig'],
  initialState?: Partial<PlaybookState>
): PlaybookState {
  const phases: PhaseState[] = playbookConfig.phases.map(phase => ({
    id: phase.id,
    status: 'pending',
    steps: phase.steps.map(step => ({
      id: step.id,
      status: 'pending',
    })),
  }))

  // Apply initial state if provided
  if (initialState?.phases) {
    initialState.phases.forEach((phaseState, phaseIndex) => {
      if (phases[phaseIndex]) {
        phases[phaseIndex].status = phaseState.status
        phaseState.steps.forEach((stepState, stepIndex) => {
          if (phases[phaseIndex].steps[stepIndex]) {
            phases[phaseIndex].steps[stepIndex] = {
              ...phases[phaseIndex].steps[stepIndex],
              ...stepState,
            }
          }
        })
      }
    })
  }

  const totalSteps = playbookConfig.phases.reduce((sum, phase) => sum + phase.steps.length, 0)
  const completedSteps = phases.reduce(
    (sum, phase) => sum + phase.steps.filter(s => s.status === 'completed').length,
    0
  )

  return {
    projectId,
    playbookType: playbookConfig.type,
    phases,
    currentPhaseIndex: initialState?.currentPhaseIndex ?? 0,
    currentStepIndex: initialState?.currentStepIndex ?? 0,
    config: initialState?.config ?? {},
    completedSteps,
    totalSteps,
    startedAt: initialState?.startedAt,
    completedAt: initialState?.completedAt,
  }
}

export default function PlaybookShell({
  projectId,
  playbookConfig,
  initialState,
}: PlaybookShellProps) {
  const [state, setState] = useState<PlaybookState>(() =>
    initializeState(projectId, playbookConfig, initialState)
  )

  // Flag to distinguish between intentional navigation (Continue button)
  // vs manual navigation (clicking on a step)
  const [shouldAutoExecute, setShouldAutoExecute] = useState(false)

  // Mode: 'config' for editing base prompts, 'campaign' for execution
  const [mode, setMode] = useState<PlaybookMode>('campaign')
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [showCampaignSettings, setShowCampaignSettings] = useState(false)

  // Load campaigns from database
  const loadCampaigns = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaign/create?projectId=${projectId}`)
      if (!response.ok) {
        console.error('Failed to load campaigns')
        return
      }
      const data = await response.json()
      if (data.campaigns) {
        const totalSteps = playbookConfig.phases.reduce((sum, phase) => sum + phase.steps.length, 0)
        const mappedCampaigns: Campaign[] = data.campaigns.map((c: any) => ({
          id: c.id,
          name: c.ecp_name,
          status: c.status || 'draft',
          // Calculate completed steps from playbook_state if available
          completedSteps: c.playbook_state?.completedSteps ?? 0,
          totalSteps,
          customVariables: c.custom_variables || {}, // Load campaign variables including context_type
          playbookState: c.playbook_state || null, // Load saved playbook state
        }))
        setCampaigns(mappedCampaigns)
      }
    } catch (error) {
      console.error('Error loading campaigns:', error)
    }
  }, [projectId, playbookConfig.phases])

  useEffect(() => {
    loadCampaigns()
  }, [loadCampaigns])

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId)

  // Ref to track if we should save (avoid saving on initial load)
  const shouldSaveRef = useRef(false)
  // Ref to prevent duplicate saves
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Save playbook state to database (debounced)
  const savePlaybookState = useCallback(async (stateToSave: PlaybookState) => {
    if (!selectedCampaignId) return

    try {
      await fetch(`/api/campaign/${selectedCampaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playbook_state: stateToSave }),
      })
    } catch (error) {
      console.error('Error saving playbook state:', error)
    }
  }, [selectedCampaignId])

  // Auto-save state when it changes (debounced)
  useEffect(() => {
    if (!shouldSaveRef.current || !selectedCampaignId) return

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce saves by 500ms to avoid too many API calls
    saveTimeoutRef.current = setTimeout(() => {
      savePlaybookState(state)
    }, 500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [state, selectedCampaignId, savePlaybookState])

  // Load saved state when selecting a campaign
  useEffect(() => {
    if (!selectedCampaignId) {
      shouldSaveRef.current = false
      return
    }

    const campaign = campaigns.find(c => c.id === selectedCampaignId)
    if (campaign?.playbookState) {
      // Load saved state
      shouldSaveRef.current = false // Don't save while loading
      setState(initializeState(projectId, playbookConfig, campaign.playbookState))
      // Enable saving after a short delay
      setTimeout(() => {
        shouldSaveRef.current = true
      }, 100)
    } else {
      // Fresh state for new campaign
      shouldSaveRef.current = false
      setState(initializeState(projectId, playbookConfig))
      setTimeout(() => {
        shouldSaveRef.current = true
      }, 100)
    }
  }, [selectedCampaignId, campaigns, projectId, playbookConfig])

  // Delete a campaign
  const deleteCampaign = useCallback(async (campaignId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta campaña? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      const response = await fetch(`/api/campaign/${campaignId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Error al eliminar campaña')
      }

      // If we deleted the selected campaign, clear selection
      if (selectedCampaignId === campaignId) {
        setSelectedCampaignId(null)
      }

      // Reload campaigns
      loadCampaigns()
    } catch (error) {
      console.error('Error deleting campaign:', error)
      alert('Error al eliminar la campaña')
    }
  }, [selectedCampaignId, loadCampaigns])

  // Helper function to get the output from the previous step
  const getPreviousStepOutput = (): string | undefined => {
    // Find the current step's dependencies
    if (!currentStep?.dependsOn?.length) return undefined

    // Get the first dependency's output
    const dependencyId = currentStep.dependsOn[0]

    // Search for this step across all phases
    for (const phase of state.phases) {
      const stepState = phase.steps.find(s => s.id === dependencyId)
      if (stepState?.output) {
        return typeof stepState.output === 'string'
          ? stepState.output
          : JSON.stringify(stepState.output, null, 2)
      }
    }

    return undefined
  }

  // Build context for LLM-based suggestion generation
  const buildPlaybookContext = (): Record<string, unknown> => {
    // Start with campaign's custom_variables (includes context_type, product, target, etc.)
    const campaignVars = selectedCampaign?.customVariables || {}

    const context: Record<string, unknown> = {
      ...campaignVars, // Include all campaign variables
      product: campaignVars.product || state.config?.product || '',
      target: campaignVars.target || state.config?.target || '',
      context_type: campaignVars.context_type || 'both', // Explicitly include context_type
    }

    // Collect values from completed steps
    for (const phase of state.phases) {
      for (const stepState of phase.steps) {
        if (stepState.status === 'completed' || stepState.decision || stepState.suggestions) {
          // Get decision value
          if (stepState.decision) {
            context[stepState.id] = stepState.decision
          }

          // Get selected suggestions as array of labels
          if (stepState.suggestions?.length) {
            const selectedLabels = stepState.suggestions
              .filter(s => s.selected)
              .map(s => s.label)
            if (selectedLabels.length > 0) {
              context[stepState.id] = selectedLabels
            }
          }

          // Get output if available
          if (stepState.output) {
            context[`${stepState.id}_output`] = stepState.output
          }
        }
      }
    }

    return context
  }

  // Get current phase and step definitions
  const currentPhase = playbookConfig.phases[state.currentPhaseIndex]
  const currentStep = currentPhase?.steps[state.currentStepIndex]
  const currentStepState = state.phases[state.currentPhaseIndex]?.steps[state.currentStepIndex]

  // Calculate navigation bounds
  const isFirstStep = state.currentPhaseIndex === 0 && state.currentStepIndex === 0
  const isLastStep =
    state.currentPhaseIndex === playbookConfig.phases.length - 1 &&
    state.currentStepIndex === currentPhase.steps.length - 1

  // Navigate to a specific step
  const goToStep = useCallback((phaseIndex: number, stepIndex: number) => {
    setState(prev => ({
      ...prev,
      currentPhaseIndex: phaseIndex,
      currentStepIndex: stepIndex,
    }))
  }, [])

  // Go to next step
  const goToNextStep = useCallback(() => {
    setState(prev => {
      const currentPhase = playbookConfig.phases[prev.currentPhaseIndex]

      // Check if there's a next step in current phase
      if (prev.currentStepIndex < currentPhase.steps.length - 1) {
        return {
          ...prev,
          currentStepIndex: prev.currentStepIndex + 1,
        }
      }

      // Check if there's a next phase
      if (prev.currentPhaseIndex < playbookConfig.phases.length - 1) {
        return {
          ...prev,
          currentPhaseIndex: prev.currentPhaseIndex + 1,
          currentStepIndex: 0,
        }
      }

      // Already at the end
      return prev
    })
  }, [playbookConfig.phases])

  // Go to previous step
  const goToPreviousStep = useCallback(() => {
    setState(prev => {
      // Check if there's a previous step in current phase
      if (prev.currentStepIndex > 0) {
        return {
          ...prev,
          currentStepIndex: prev.currentStepIndex - 1,
        }
      }

      // Check if there's a previous phase
      if (prev.currentPhaseIndex > 0) {
        const prevPhase = playbookConfig.phases[prev.currentPhaseIndex - 1]
        return {
          ...prev,
          currentPhaseIndex: prev.currentPhaseIndex - 1,
          currentStepIndex: prevPhase.steps.length - 1,
        }
      }

      // Already at the beginning
      return prev
    })
  }, [playbookConfig.phases])

  // Update step state
  const updateStepState = useCallback(
    (stepId: string, update: Partial<StepState>) => {
      setState(prev => {
        const newPhases = prev.phases.map(phase => ({
          ...phase,
          steps: phase.steps.map(step =>
            step.id === stepId ? { ...step, ...update } : step
          ),
        }))

        // Recalculate phase status
        newPhases.forEach(phase => {
          const hasError = phase.steps.some(s => s.status === 'error')
          const allCompleted = phase.steps.every(s => s.status === 'completed' || s.status === 'skipped')
          const hasInProgress = phase.steps.some(s => s.status === 'in_progress')

          if (hasError) {
            phase.status = 'error'
          } else if (allCompleted) {
            phase.status = 'completed'
          } else if (hasInProgress) {
            phase.status = 'in_progress'
          } else {
            phase.status = 'pending'
          }
        })

        // Recalculate completed steps
        const completedSteps = newPhases.reduce(
          (sum, phase) => sum + phase.steps.filter(s => s.status === 'completed').length,
          0
        )

        return {
          ...prev,
          phases: newPhases,
          completedSteps,
        }
      })
    },
    []
  )

  // Execute a step
  const executeStep = useCallback(
    async (stepId: string, input?: any) => {
      const step = playbookConfig.phases
        .flatMap(p => p.steps)
        .find(s => s.id === stepId)

      if (!step) return

      // Mark as in progress
      updateStepState(stepId, {
        status: 'in_progress',
        startedAt: new Date(),
        input,
      })

      try {
        let result: any

        switch (step.executor) {
          case 'llm':
            // Build variables including campaign custom_variables (product, target, industry, etc.)
            const campaignVars = selectedCampaign?.customVariables || {}
            const stepVariables = {
              ...Object.fromEntries(
                Object.entries(campaignVars).map(([k, v]) => [k, String(v ?? '')])
              ),
              ...(input || {}),
            }
            // Call LLM API
            const response = await fetch('/api/playbook/execute-step', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId,
                stepId,
                playbookType: playbookConfig.type,
                promptKey: step.promptKey,
                variables: stepVariables,
              }),
            })
            const data = await response.json()
            if (!data.success) throw new Error(data.error || 'Error ejecutando paso')
            result = data.output
            break

          case 'api':
            // Call custom API endpoint
            if (step.apiEndpoint) {
              const apiResponse = await fetch(step.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, stepId, input }),
              })
              const apiData = await apiResponse.json()
              if (!apiData.success) throw new Error(apiData.error || 'Error en API')
              result = apiData.result
            }
            break

          case 'job':
            // Job-based execution: create job, execute, poll for status
            if (step.jobType === 'niche_finder_serp') {
              // Build job config from completed steps
              const lifeContextsStep = state.phases
                .flatMap(p => p.steps)
                .find(s => s.id === 'life_contexts')
              const needWordsStep = state.phases
                .flatMap(p => p.steps)
                .find(s => s.id === 'need_words')
              const indicatorsStep = state.phases
                .flatMap(p => p.steps)
                .find(s => s.id === 'indicators')
              const sourcesStep = state.phases
                .flatMap(p => p.steps)
                .find(s => s.id === 'sources')

              const selectedContexts = lifeContextsStep?.suggestions?.filter(s => s.selected).map(s => s.label) || []
              const selectedNeedWords = needWordsStep?.suggestions?.filter(s => s.selected).map(s => s.label) || []
              const selectedIndicators = indicatorsStep?.suggestions?.filter(s => s.selected).map(s => s.label) || []

              // Parse sources output (can be JSON string from LLM or already parsed object)
              let sourcesConfig = { reddit: { enabled: true, subreddits: [] }, thematic_forums: { enabled: false, forums: [] }, general_forums: { enabled: false, forums: [] } }
              try {
                if (sourcesStep?.output) {
                  // Check if output is already an object (parsed)
                  if (typeof sourcesStep.output === 'object' && sourcesStep.output !== null) {
                    sourcesConfig = sourcesStep.output as typeof sourcesConfig
                  } else if (typeof sourcesStep.output === 'string') {
                    // Try to extract JSON from string
                    const jsonMatch = sourcesStep.output.match(/\{[\s\S]*\}/)
                    if (jsonMatch) {
                      sourcesConfig = JSON.parse(jsonMatch[0])
                    }
                  }
                }
              } catch (e) {
                console.error('Error parsing sources config:', e)
              }

              const jobConfig = {
                life_contexts: selectedContexts,
                product_words: selectedNeedWords,
                indicators: selectedIndicators,
                sources: sourcesConfig,
                serp_pages: (selectedCampaign?.customVariables?.serp_pages as number) || 3,
              }

              console.log('[SERP] Starting job with config:', JSON.stringify(jobConfig, null, 2))

              // 1. Create job
              const createResponse = await fetch('/api/niche-finder/jobs/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  project_id: projectId,
                  config: jobConfig,
                }),
              })
              const createData = await createResponse.json()
              console.log('[SERP] Create job response:', createData)

              if (!createData.success) {
                throw new Error(createData.error || 'Error creando job')
              }

              const jobId = createData.job_id
              console.log('[SERP] Job created with ID:', jobId)
              updateStepState(stepId, { output: { jobId }, progress: { current: 0, total: 0, label: 'Iniciando búsqueda SERP...' } })

              // 2. Execute SERP job
              console.log('[SERP] Executing SERP search...')
              const serpResponse = await fetch(`/api/niche-finder/jobs/${jobId}/serp`, {
                method: 'POST',
              })
              const serpData = await serpResponse.json()
              console.log('[SERP] SERP response:', serpData)

              if (serpData.error) {
                // Check if it's a missing API key error
                if (serpData.code === 'MISSING_API_KEY') {
                  throw new Error(`API Key faltante: ${serpData.service}. Configura tu API key en Ajustes > APIs.`)
                }
                throw new Error(serpData.error)
              }

              // 3. Poll for status
              const pollInterval = setInterval(async () => {
                try {
                  const statusResponse = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
                  const statusData = await statusResponse.json()

                  const completed = statusData.progress?.serp?.completed || 0
                  const total = statusData.progress?.serp?.total || 0
                  updateStepState(stepId, {
                    progress: {
                      current: completed,
                      total: total,
                      label: `Buscando URLs: ${completed}/${total}`,
                    },
                  })

                  if (statusData.status === 'serp_done' || statusData.status === 'serp_completed') {
                    clearInterval(pollInterval)
                    updateStepState(stepId, {
                      status: 'completed',
                      completedAt: new Date(),
                      output: {
                        jobId,
                        urlsFound: statusData.job?.urls_found || 0,
                        costs: statusData.costs,
                      },
                    })
                    setTimeout(goToNextStep, 500)
                  } else if (statusData.status === 'failed' || statusData.status === 'error') {
                    clearInterval(pollInterval)
                    throw new Error(statusData.job?.error_message || 'Job failed')
                  }
                } catch (pollError) {
                  clearInterval(pollInterval)
                  updateStepState(stepId, {
                    status: 'error',
                    error: pollError instanceof Error ? pollError.message : 'Error checking job status',
                  })
                }
              }, 2000) // Poll every 2 seconds

              // Don't fall through to the completion logic below
              return
            }
            // For other job types, just mark as pending
            result = input
            break

          case 'none':
          default:
            // No execution needed, just proceed
            result = input
            break
        }

        // Mark as completed
        updateStepState(stepId, {
          status: 'completed',
          completedAt: new Date(),
          output: result,
        })

        // Auto-advance for auto steps
        if (['auto', 'auto_with_review'].includes(step.type)) {
          setTimeout(goToNextStep, 500)
        }
      } catch (error) {
        updateStepState(stepId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido',
        })
      }
    },
    [projectId, playbookConfig.type, playbookConfig.phases, updateStepState, goToNextStep, selectedCampaign, state.phases]
  )

  // Handle continue from current step
  const handleContinue = useCallback(() => {
    if (currentStepState?.status !== 'completed') {
      // Mark as completed if not already
      updateStepState(currentStep.id, { status: 'completed', completedAt: new Date() })
    }
    // Enable auto-execution for the next step (if it's an auto step)
    setShouldAutoExecute(true)
    goToNextStep()
  }, [currentStep?.id, currentStepState?.status, updateStepState, goToNextStep])

  // Handle edit - volver a editar un paso completado
  const handleEdit = useCallback(() => {
    if (!currentStep) return
    // Cambiar status a pending sin perder los datos (suggestions, output, etc.)
    updateStepState(currentStep.id, {
      status: 'pending',
      completedAt: undefined,
      error: undefined,
    })
  }, [currentStep?.id, updateStepState])

  // Handle cancel - cancelar ejecución en curso
  const handleCancel = useCallback(() => {
    if (!currentStep) return
    // Volver a pending y limpiar progreso
    updateStepState(currentStep.id, {
      status: 'pending',
      progress: undefined,
      error: undefined,
    })
  }, [currentStep?.id, updateStepState])

  // Auto-start current step if it's an auto step, pending, AND user clicked Continue
  useEffect(() => {
    console.log('[AutoExecute] Check:', {
      shouldAutoExecute,
      currentStepId: currentStep?.id,
      currentStepType: currentStep?.type,
      currentStepStatus: currentStepState?.status,
    })
    if (
      shouldAutoExecute &&
      currentStep &&
      currentStepState?.status === 'pending' &&
      ['auto'].includes(currentStep.type)
    ) {
      console.log('[AutoExecute] Starting auto execution for:', currentStep.id)
      // Reset the flag
      setShouldAutoExecute(false)
      // Small delay to allow UI to render first
      const timer = setTimeout(() => {
        executeStep(currentStep.id)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [shouldAutoExecute, currentStep, currentStepState?.status, executeStep])

  if (!currentPhase || !currentStep || !currentStepState) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Error: Configuración de playbook inválida
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[600px] bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
      {/* Header with mode selector */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-xl">{playbookConfig.icon}</span>
          <h2 className="text-lg font-semibold text-gray-900">{playbookConfig.name}</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Config Base button */}
          <button
            onClick={() => setMode('config')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'config'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings size={16} />
            Configuración Base
          </button>

          {/* Campaign selector */}
          <div className="relative flex items-center gap-1">
            <button
              onClick={() => {
                setMode('campaign')
                setShowCampaignDropdown(!showCampaignDropdown)
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'campaign'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Folder size={16} />
              {selectedCampaign ? selectedCampaign.name : 'Seleccionar Campaña'}
              <ChevronDown size={16} />
            </button>

            {/* Edit campaign settings button */}
            {selectedCampaignId && (
              <button
                onClick={() => setShowCampaignSettings(true)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Editar configuración de campaña"
              >
                <Pencil size={14} />
              </button>
            )}

            {/* Dropdown */}
            {showCampaignDropdown && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                {campaigns.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">No hay campañas</div>
                ) : (
                  campaigns.map(campaign => (
                    <div
                      key={campaign.id}
                      className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${
                        selectedCampaignId === campaign.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedCampaignId(campaign.id)
                          setShowCampaignDropdown(false)
                        }}
                        className="flex-1 flex items-center justify-between text-left"
                      >
                        <span className="font-medium text-gray-900">{campaign.name}</span>
                        <span className="text-gray-500 mr-2">
                          {campaign.completedSteps}/{campaign.totalSteps}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteCampaign(campaign.id)
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Eliminar campaña"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setShowWizard(true)
                      setShowCampaignDropdown(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
                  >
                    <Plus size={16} />
                    Nueva Campaña
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      {mode === 'config' ? (
        /* Configuration Mode - Full width */
        <div className="flex-1 overflow-hidden">
          <ConfigurationMode
            projectId={projectId}
            playbookConfig={playbookConfig}
            onSave={() => {
              // Optionally refresh something after save
            }}
          />
        </div>
      ) : (
        /* Campaign Mode - Dual panel */
        <div className="flex flex-1 overflow-hidden">
          {/* Navigation Panel - Left side */}
          <div className="w-80 flex-shrink-0">
            <NavigationPanel
              phases={playbookConfig.phases}
              phaseStates={state.phases}
              currentPhaseIndex={state.currentPhaseIndex}
              currentStepIndex={state.currentStepIndex}
              onStepClick={goToStep}
            />
          </div>

          {/* Work Area - Right side */}
          <div className="flex-1 overflow-hidden">
            {!selectedCampaignId ? (
              /* No campaign selected - prompt to select or create */
              <div className="flex flex-col items-center justify-center h-full bg-white p-8 text-center">
                <Folder className="text-gray-300 mb-4" size={64} />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Selecciona o crea una campaña
                </h3>
                <p className="text-gray-500 mb-6 max-w-md">
                  Para ejecutar el playbook, primero debes seleccionar una campaña existente o crear una nueva.
                </p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={16} />
                  Nueva Campaña
                </button>
              </div>
            ) : (
              <WorkArea
                step={currentStep}
                stepState={currentStepState}
                onContinue={handleContinue}
                onBack={goToPreviousStep}
                onExecute={(input) => executeStep(currentStep.id, input)}
                onUpdateState={(update) => updateStepState(currentStep.id, update)}
                onEdit={handleEdit}
                onCancel={handleCancel}
                isFirst={isFirstStep}
                isLast={isLastStep}
                previousStepOutput={getPreviousStepOutput()}
                projectId={projectId}
                playbookContext={buildPlaybookContext()}
              />
            )}
          </div>
        </div>
      )}

      {/* Campaign Wizard Modal */}
      {showWizard && (
        <CampaignWizard
          projectId={projectId}
          playbookConfig={playbookConfig}
          onClose={() => setShowWizard(false)}
          onCreated={(campaignId) => {
            setSelectedCampaignId(campaignId)
            setShowWizard(false)
            // Reload campaigns
            loadCampaigns()
          }}
        />
      )}

      {/* Campaign Settings Modal */}
      {showCampaignSettings && selectedCampaignId && (
        <CampaignSettings
          campaignId={selectedCampaignId}
          playbookConfig={playbookConfig}
          onClose={() => setShowCampaignSettings(false)}
          onSaved={() => {
            loadCampaigns()
          }}
        />
      )}
    </div>
  )
}
