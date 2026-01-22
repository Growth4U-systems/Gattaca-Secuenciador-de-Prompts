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
import { WorkArea } from './WorkArea'
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
  // Ref to store polling interval for cancellation
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

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

          // Special case: Extract serpJobId from serp_search or search_and_preview step output
          // This is needed for review_urls/review_and_scrape step to display SERP results
          // Note: We check this inside the completed block, but also outside below
          if ((stepState.id === 'serp_search' || stepState.id === 'search_and_preview') && stepState.output) {
            const output = stepState.output as { jobId?: string }
            if (output.jobId) {
              context.serpJobId = output.jobId
            }
          }

          // Also extract serpJobId from review_and_scrape step (the scrape step)
          // This ensures scrape_results step can find the jobId after scraping completes
          if (stepState.id === 'review_and_scrape' && stepState.output) {
            const output = stepState.output as { jobId?: string }
            if (output.jobId && !context.serpJobId) {
              context.serpJobId = output.jobId
            }
          }

          // Special case: Parse sources step output for QueryPreviewPanel
          // The LLM returns a JSON string that needs to be parsed
          if (stepState.id === 'sources' && stepState.output) {
            try {
              let parsedSources = stepState.output
              if (typeof stepState.output === 'string') {
                // Try to extract JSON from the LLM response
                const jsonMatch = stepState.output.match(/\{[\s\S]*\}/)
                if (jsonMatch) {
                  parsedSources = JSON.parse(jsonMatch[0])
                }
              }
              // Only set if it's a valid sources config object
              if (parsedSources && typeof parsedSources === 'object' &&
                  ('reddit' in parsedSources || 'thematic_forums' in parsedSources || 'general_forums' in parsedSources)) {
                context.sources = parsedSources
              }
            } catch (e) {
              console.error('[buildPlaybookContext] Error parsing sources output:', e)
              // Don't set context.sources - let it use default values
            }
          }
        }

        // IMPORTANT: Extract serpJobId even from non-completed steps (e.g., after cancel)
        // This allows review_and_scrape to show URLs from a cancelled SERP job
        if ((stepState.id === 'serp_search' || stepState.id === 'search_and_preview') && stepState.output && !context.serpJobId) {
          const output = stepState.output as { jobId?: string }
          if (output.jobId) {
            context.serpJobId = output.jobId
          }
        }

        // Also check review_and_scrape for non-completed steps (e.g., in progress or cancelled)
        if (stepState.id === 'review_and_scrape' && stepState.output && !context.serpJobId) {
          const output = stepState.output as { jobId?: string }
          if (output.jobId) {
            context.serpJobId = output.jobId
          }
        }

        // Also extract serpJobId from scrape_results step (for extraction step)
        if (stepState.id === 'scrape_results' && stepState.output && !context.serpJobId) {
          const output = stepState.output as { jobId?: string }
          if (output.jobId) {
            context.serpJobId = output.jobId
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

  // Re-run the previous step (go back and reset its state to pending)
  const rerunPreviousStep = useCallback(() => {
    setState(prev => {
      let newPhaseIndex = prev.currentPhaseIndex
      let newStepIndex = prev.currentStepIndex

      // Find previous step
      if (prev.currentStepIndex > 0) {
        newStepIndex = prev.currentStepIndex - 1
      } else if (prev.currentPhaseIndex > 0) {
        const prevPhase = playbookConfig.phases[prev.currentPhaseIndex - 1]
        newPhaseIndex = prev.currentPhaseIndex - 1
        newStepIndex = prevPhase.steps.length - 1
      } else {
        // Already at the beginning, nothing to rerun
        return prev
      }

      // Get the previous step ID
      const prevStepId = playbookConfig.phases[newPhaseIndex].steps[newStepIndex].id

      // Reset the previous step state to pending and navigate to it
      const newPhases = prev.phases.map((phase, pi) => ({
        ...phase,
        steps: phase.steps.map((step, si) => {
          if (pi === newPhaseIndex && si === newStepIndex) {
            return {
              ...step,
              status: 'pending' as const,
              output: undefined,
              error: undefined,
            }
          }
          return step
        }),
      }))

      return {
        ...prev,
        phases: newPhases,
        currentPhaseIndex: newPhaseIndex,
        currentStepIndex: newStepIndex,
      }
    })
    // Trigger auto-execute after navigating
    setShouldAutoExecute(true)
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
      console.log('[executeStep] Starting execution for step:', stepId, 'with input:', input)

      const step = playbookConfig.phases
        .flatMap(p => p.steps)
        .find(s => s.id === stepId)

      if (!step) {
        console.error('[executeStep] Step not found:', stepId)
        return
      }

      console.log('[executeStep] Found step:', step.id, 'type:', step.type, 'executor:', step.executor, 'jobType:', step.jobType)

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
              // Build payload with previous step outputs and campaign variables
              const campaignVarsForApi = selectedCampaign?.customVariables || {}

              // Get outputs from previous steps (dependsOn)
              const previousOutputs: Record<string, unknown> = {}
              if (step.dependsOn?.length) {
                for (const depId of step.dependsOn) {
                  for (const phase of state.phases) {
                    const depStep = phase.steps.find(s => s.id === depId)
                    if (depStep?.output) {
                      previousOutputs[depId] = depStep.output
                    }
                  }
                }
              }

              // Build scenes array from generate_scenes output (for video-viral generate-clips)
              let scenes: string[] | undefined
              if (previousOutputs.generate_scenes) {
                let scenesOutput = previousOutputs.generate_scenes

                // Parse JSON if output is a string (LLM outputs often come as strings)
                if (typeof scenesOutput === 'string') {
                  try {
                    // Try to extract JSON from the string (might be wrapped in markdown code blocks)
                    const jsonMatch = scenesOutput.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
                                     scenesOutput.match(/(\{[\s\S]*\})/)
                    if (jsonMatch) {
                      scenesOutput = JSON.parse(jsonMatch[1])
                    }
                  } catch (e) {
                    console.error('[executeStep] Failed to parse generate_scenes output:', e)
                  }
                }

                // Extract scene_1, scene_2, scene_3, etc. from the output
                if (typeof scenesOutput === 'object' && scenesOutput !== null) {
                  const scenesRecord = scenesOutput as Record<string, string>
                  scenes = Object.entries(scenesRecord)
                    .filter(([key]) => key.startsWith('scene_'))
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([, value]) => value)
                  console.log('[executeStep] Extracted scenes:', scenes)
                }
              }

              const apiResponse = await fetch(step.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  projectId,
                  stepId,
                  input,
                  ...campaignVarsForApi,
                  previousOutputs,
                  scenes, // For generate-clips endpoint
                }),
              })
              const apiData = await apiResponse.json()
              if (!apiData.success && apiData.error) throw new Error(apiData.error)
              result = apiData
            }
            break

          case 'job':
            // Job-based execution: create job, execute, poll for status
            console.log('[executeStep] Executor is JOB, jobType:', step.jobType)

            if (step.jobType === 'niche_finder_serp') {
              // Check if we have an existing job to resume (from cancelled execution)
              const currentStepForJob = state.phases.flatMap(p => p.steps).find(s => s.id === stepId)
              const existingJobId = (currentStepForJob?.output as { jobId?: string })?.jobId

              let jobId: string

              if (existingJobId) {
                // Resume existing job
                console.log('[SERP] Resuming existing job:', existingJobId)
                jobId = existingJobId
                updateStepState(stepId, { progress: { current: 0, total: 0, label: 'Retomando búsqueda SERP...' } })
              } else {
                // Build job config from completed steps OR from input (for search_with_preview)
                let jobConfig: {
                  life_contexts: string[]
                  product_words: string[]
                  indicators: string[]
                  sources: { reddit: boolean | { enabled?: boolean; subreddits?: string[] }; thematic_forums: boolean | { enabled?: boolean; forums?: string[] }; general_forums: string[] | { enabled?: boolean; forums?: string[] } }
                  serp_pages: number
                }

                // If input is provided (from SearchWithPreviewPanel), use it directly
                if (input && input.life_contexts && input.product_words) {
                  jobConfig = {
                    life_contexts: input.life_contexts,
                    product_words: input.product_words,
                    indicators: input.indicators || [],
                    sources: input.sources || { reddit: true, thematic_forums: false, general_forums: [] },
                    serp_pages: input.serp_pages || 5,
                  }
                } else {
                  // Fall back to building from completed steps (legacy flow)
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
                  let sourcesConfig: { reddit: { enabled: boolean; subreddits: string[] }; thematic_forums: { enabled: boolean; forums: string[] }; general_forums: { enabled: boolean; forums: string[] } } = { reddit: { enabled: true, subreddits: [] }, thematic_forums: { enabled: false, forums: [] }, general_forums: { enabled: false, forums: [] } }
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

                  jobConfig = {
                    life_contexts: selectedContexts,
                    product_words: selectedNeedWords,
                    indicators: selectedIndicators,
                    sources: sourcesConfig,
                    serp_pages: (selectedCampaign?.customVariables?.serp_pages as number) || 5,
                  }
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

                jobId = createData.job_id
                console.log('[SERP] Job created with ID:', jobId)
                updateStepState(stepId, { output: { jobId }, progress: { current: 0, total: 0, label: 'Iniciando búsqueda SERP...' } })
              }

              // 2. Execute SERP job (this will resume from where it left off if job was interrupted)
              console.log('[SERP] Executing SERP search...')
              const serpResponse = await fetch(`/api/niche-finder/jobs/${jobId}/serp`, {
                method: 'POST',
              })

              // Handle non-JSON responses (e.g., Vercel timeout HTML pages)
              const contentType = serpResponse.headers.get('content-type')
              if (!contentType || !contentType.includes('application/json')) {
                const text = await serpResponse.text()
                console.error('[SERP] Non-JSON response:', text.slice(0, 500))
                // If we got a non-JSON response, the job might still be running in the background
                // Continue to polling to check status
                console.log('[SERP] Continuing to poll for job status despite non-JSON response...')
              } else {
                const serpData = await serpResponse.json()
                console.log('[SERP] SERP response:', serpData)

                if (serpData.error) {
                  // Check if it's a missing API key error
                  if (serpData.code === 'MISSING_API_KEY') {
                    throw new Error(`API Key faltante: ${serpData.service}. Configura tu API key en Ajustes > APIs.`)
                  }
                  throw new Error(serpData.error)
                }
              }

              // 3. Poll for status and auto-resume if needed
              let isResuming = false
              let lastCompletedCount = -1 // Track previous poll value
              let stallCount = 0 // Count consecutive stalls
              let initialCompleted = -1 // Track initial value when polling started

              // Clear any existing poll interval
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
              }

              pollIntervalRef.current = setInterval(async () => {
                try {
                  const statusResponse = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
                  const statusData = await statusResponse.json()

                  const completed = statusData.progress?.serp?.completed || 0
                  const total = statusData.progress?.serp?.total || 0
                  const remaining = total - completed
                  const label = total > 0
                    ? `Búsquedas: ${completed}/${total} (faltan ${remaining})`
                    : 'Iniciando búsqueda SERP...'
                  updateStepState(stepId, {
                    progress: {
                      current: completed,
                      total: total,
                      label,
                    },
                  })

                  // Track initial value on first poll
                  if (initialCompleted === -1) {
                    initialCompleted = completed
                  }

                  // Auto-resume if job was interrupted (still serp_running but not progressing)
                  // This handles Vercel timeout scenarios
                  if (statusData.status === 'serp_running' && completed < total && !isResuming) {
                    // Check if progress has stalled (same value as PREVIOUS poll)
                    if (lastCompletedCount === completed && remaining > 0) {
                      stallCount++
                      // After 2 consecutive stalls (4+ seconds), OR if no progress since we started polling
                      const noProgressSinceStart = completed === initialCompleted && stallCount >= 1
                      if (stallCount >= 2 || noProgressSinceStart) {
                        console.log(`[SERP] Job stalled at ${completed}/${total} (stallCount=${stallCount}, initialCompleted=${initialCompleted}), auto-resuming...`)
                        isResuming = true
                        stallCount = 0
                        // Resume the job by calling SERP endpoint again
                        fetch(`/api/niche-finder/jobs/${jobId}/serp`, { method: 'POST' })
                          .then(res => res.json())
                          .then(data => {
                            console.log('[SERP] Resume response:', data)
                            isResuming = false
                          })
                          .catch(err => {
                            console.error('[SERP] Resume error:', err)
                            isResuming = false
                          })
                      }
                    } else {
                      stallCount = 0 // Reset stall count if progress is being made
                    }
                  }

                  // Update last completed for next poll comparison
                  lastCompletedCount = completed

                  if (statusData.status === 'serp_done' || statusData.status === 'serp_completed') {
                    if (pollIntervalRef.current) {
                      clearInterval(pollIntervalRef.current)
                      pollIntervalRef.current = null
                    }
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
                    if (pollIntervalRef.current) {
                      clearInterval(pollIntervalRef.current)
                      pollIntervalRef.current = null
                    }
                    throw new Error(statusData.job?.error_message || 'Job failed')
                  }
                } catch (pollError) {
                  if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current)
                    pollIntervalRef.current = null
                  }
                  updateStepState(stepId, {
                    status: 'error',
                    error: pollError instanceof Error ? pollError.message : 'Error checking job status',
                  })
                }
              }, 2000) // Poll every 2 seconds

              // Don't fall through to the completion logic below
              return
            }

            // SCRAPE JOB: Scrape URLs from the SERP results
            if (step.jobType === 'niche_finder_scrape') {
              // Get the jobId from the previous step (search_and_preview)
              const searchStep = state.phases.flatMap(p => p.steps).find(s => s.id === 'search_and_preview')
              console.log('[SCRAPE] Looking for search_and_preview step:', searchStep)
              console.log('[SCRAPE] search_and_preview output:', searchStep?.output)

              // Also check for serp_search (legacy step name)
              const serpStep = state.phases.flatMap(p => p.steps).find(s => s.id === 'serp_search')
              console.log('[SCRAPE] Looking for serp_search step:', serpStep)
              console.log('[SCRAPE] serp_search output:', serpStep?.output)

              // Try to get jobId from either step
              let jobId = (searchStep?.output as { jobId?: string })?.jobId ||
                          (serpStep?.output as { jobId?: string })?.jobId

              // If still no jobId, try from input (might be passed from ReviewAndScrapePanel)
              if (!jobId && input?.jobId) {
                jobId = input.jobId
                console.log('[SCRAPE] Got jobId from input:', jobId)
              }

              if (!jobId) {
                console.error('[SCRAPE] No jobId found. All steps:', state.phases.flatMap(p => p.steps).map(s => ({ id: s.id, output: s.output })))
                throw new Error('No se encontró el Job ID del paso de búsqueda')
              }

              console.log('[SCRAPE] Starting scrape for job:', jobId)
              updateStepState(stepId, {
                output: { jobId },
                progress: { current: 0, total: 0, label: 'Iniciando scraping...' }
              })

              // Get total URLs to scrape
              const statusResponse = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
              const statusData = await statusResponse.json()
              const totalUrls = statusData.job?.urls_found || 0

              updateStepState(stepId, {
                progress: { current: 0, total: totalUrls, label: `Scrapeando 0/${totalUrls} URLs...` }
              })

              // Start scraping - this will scrape in batches
              let scrapedCount = 0
              let failedCount = 0
              let hasMore = true

              while (hasMore) {
                try {
                  const scrapeResponse = await fetch(`/api/niche-finder/jobs/${jobId}/scrape`, {
                    method: 'POST',
                  })

                  // Handle non-JSON responses (e.g., Vercel timeout)
                  const contentType = scrapeResponse.headers.get('content-type')
                  if (!contentType || !contentType.includes('application/json')) {
                    console.error('[SCRAPE] Non-JSON response, continuing...')
                    // Wait a bit and continue polling
                    await new Promise(resolve => setTimeout(resolve, 2000))

                    // Check current status
                    const checkResponse = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
                    const checkData = await checkResponse.json()

                    if (checkData.status === 'scrape_done') {
                      hasMore = false
                      scrapedCount = checkData.job?.scrape_success_count || 0
                      failedCount = checkData.job?.scrape_failed_count || 0
                    }
                    continue
                  }

                  const scrapeData = await scrapeResponse.json()
                  console.log('[SCRAPE] Batch response:', scrapeData)

                  if (scrapeData.error) {
                    throw new Error(scrapeData.error)
                  }

                  scrapedCount += scrapeData.scraped || 0
                  failedCount += scrapeData.failed || 0
                  hasMore = scrapeData.has_more || false

                  // Update progress with real-time feedback
                  updateStepState(stepId, {
                    progress: {
                      current: scrapedCount + failedCount,
                      total: totalUrls,
                      label: `Scrapeando ${scrapedCount + failedCount}/${totalUrls} URLs...`,
                    },
                    partialResults: {
                      successCount: scrapedCount,
                      failedCount: failedCount,
                      lastUrl: scrapeData.last_scraped_url,
                      lastSnippet: scrapeData.last_scraped_snippet,
                    },
                  })

                } catch (scrapeError) {
                  console.error('[SCRAPE] Batch error:', scrapeError)
                  // Don't throw - try to continue with next batch
                  // The endpoint will mark failed URLs and continue
                  await new Promise(resolve => setTimeout(resolve, 2000))

                  // Check if we should stop
                  const checkResponse = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
                  const checkData = await checkResponse.json()
                  if (checkData.status === 'scrape_done' || checkData.status === 'failed') {
                    hasMore = false
                    if (checkData.status === 'failed') {
                      throw new Error(checkData.job?.error_message || 'Scraping failed')
                    }
                  }
                }
              }

              // Mark as completed
              updateStepState(stepId, {
                status: 'completed',
                completedAt: new Date(),
                output: {
                  jobId,
                  scrapedCount,
                  failedCount,
                },
              })
              setTimeout(goToNextStep, 500)
              return
            }

            if (step.jobType === 'niche_finder_extract') {
              // Get jobId from previous steps (review_and_scrape or scrape_results)
              const scrapeResultsStep = state.phases.flatMap(p => p.steps).find(s => s.id === 'scrape_results')
              const reviewAndScrapeStep = state.phases.flatMap(p => p.steps).find(s => s.id === 'review_and_scrape')
              const searchStep = state.phases.flatMap(p => p.steps).find(s => s.id === 'search_and_preview')

              console.log('[EXTRACT] Looking for jobId from steps:', {
                scrape_results: scrapeResultsStep?.output,
                review_and_scrape: reviewAndScrapeStep?.output,
                search_and_preview: searchStep?.output,
              })

              let jobId = (scrapeResultsStep?.output as { jobId?: string })?.jobId ||
                          (reviewAndScrapeStep?.output as { jobId?: string })?.jobId ||
                          (searchStep?.output as { jobId?: string })?.jobId

              // Also try from input
              if (!jobId && input?.jobId) {
                jobId = input.jobId
              }

              if (!jobId) {
                console.error('[EXTRACT] No jobId found')
                throw new Error('No se encontró el Job ID. Por favor ejecuta los pasos anteriores primero.')
              }

              console.log('[EXTRACT] Starting extraction for job:', jobId)
              updateStepState(stepId, {
                output: { jobId },
                progress: { current: 0, total: 0, label: 'Iniciando extracción de problemas...' }
              })

              // Get total URLs to extract from job status
              const statusResponse = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
              const statusData = await statusResponse.json()
              const totalUrls = statusData.job?.scrape_success_count || 0

              console.log('[EXTRACT] Total URLs to process:', totalUrls)
              updateStepState(stepId, {
                progress: { current: 0, total: totalUrls, label: `Extrayendo problemas de 0/${totalUrls} URLs...` }
              })

              // Call extract endpoint in batches until has_more=false
              let hasMore = true
              let extractedTotal = 0
              let filteredTotal = 0
              let processedTotal = 0

              while (hasMore) {
                try {
                  const extractResponse = await fetch(`/api/niche-finder/jobs/${jobId}/extract`, {
                    method: 'POST',
                  })

                  // Handle non-JSON responses (e.g., Vercel timeout)
                  const contentType = extractResponse.headers.get('content-type')
                  if (!contentType || !contentType.includes('application/json')) {
                    console.error('[EXTRACT] Non-JSON response, polling status...')
                    await new Promise(resolve => setTimeout(resolve, 2000))

                    // Check current status
                    const checkResponse = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
                    const checkData = await checkResponse.json()

                    if (checkData.status === 'completed') {
                      hasMore = false
                      extractedTotal = checkData.job?.niches_extracted || 0
                    }
                    continue
                  }

                  const extractData = await extractResponse.json()
                  console.log('[EXTRACT] Batch response:', extractData)

                  if (extractData.error) {
                    throw new Error(extractData.error)
                  }

                  extractedTotal += extractData.extracted || 0
                  filteredTotal += extractData.filtered || 0
                  processedTotal = extractedTotal + filteredTotal
                  hasMore = extractData.has_more || false

                  updateStepState(stepId, {
                    progress: {
                      current: processedTotal,
                      total: totalUrls,
                      label: `Extrayendo problemas... ${extractedTotal} encontrados de ${processedTotal}/${totalUrls} URLs`,
                    },
                    partialResults: {
                      successCount: extractedTotal,
                      failedCount: filteredTotal,
                    },
                  })
                } catch (extractError) {
                  console.error('[EXTRACT] Batch error:', extractError)
                  await new Promise(resolve => setTimeout(resolve, 2000))

                  // Check if we should stop
                  const checkResponse = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
                  const checkData = await checkResponse.json()
                  if (checkData.status === 'completed' || checkData.status === 'failed') {
                    hasMore = false
                    if (checkData.status === 'failed') {
                      throw new Error(checkData.job?.error_message || 'Extraction failed')
                    }
                  }
                }
              }

              // Get extracted problems and format as CSV
              console.log('[EXTRACT] Getting results from /api/niche-finder/results/', jobId)
              const resultsResponse = await fetch(`/api/niche-finder/results/${jobId}`)

              if (!resultsResponse.ok) {
                console.error('[EXTRACT] Failed to get results:', resultsResponse.status, resultsResponse.statusText)
                throw new Error(`Error obteniendo resultados: ${resultsResponse.status}`)
              }

              const resultsData = await resultsResponse.json()
              console.log('[EXTRACT] Results data:', {
                hasNiches: !!resultsData.niches,
                nichesCount: resultsData.niches?.length || 0,
                status: resultsData.status,
                urls: resultsData.urls,
              })

              // Format niches as CSV string with all relevant columns
              const niches = resultsData.niches || []
              let csvOutput = 'problema,persona,causa_funcional,carga_emocional,evidencia,alternativas,url_fuente\n'
              for (const niche of niches) {
                const problem = (niche.problem || '').replace(/"/g, '""')
                const persona = (niche.persona || '').replace(/"/g, '""')
                const functionalCause = (niche.functional_cause || '').replace(/"/g, '""')
                const emotionalLoad = (niche.emotional_load || '').replace(/"/g, '""')
                const evidence = (niche.evidence || '').replace(/"/g, '""')
                const alternatives = (niche.alternatives || '').replace(/"/g, '""')
                const url = niche.source_url || ''
                csvOutput += `"${problem}","${persona}","${functionalCause}","${emotionalLoad}","${evidence}","${alternatives}","${url}"\n`
              }

              console.log('[EXTRACT] Completed. Total problems:', niches.length, 'CSV preview:', csvOutput.substring(0, 200))

              // Mark as completed with CSV output
              updateStepState(stepId, {
                status: 'completed',
                completedAt: new Date(),
                output: csvOutput,
              })
              setTimeout(goToNextStep, 500)
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
  // IMPORTANTE: Mantiene el output (jobId) para poder retomar el job
  const handleCancel = useCallback(() => {
    if (!currentStep) return

    // Clear polling interval if running
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
      console.log('[Cancel] Cleared polling interval')
    }

    // Volver a pending y limpiar progreso, pero MANTENER output (contiene jobId)
    updateStepState(currentStep.id, {
      status: 'pending',
      progress: undefined,
      error: undefined,
      // NO limpiamos output para mantener el jobId y poder retomar
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

  // Resume polling for in_progress steps on page reload
  // This handles the case where user refreshes the page while a SERP job is running
  useEffect(() => {
    // Only for search_with_preview steps that are in_progress with a jobId
    if (
      currentStep?.type === 'search_with_preview' &&
      (currentStepState?.status === 'in_progress' || currentStepState?.status === 'pending') &&
      currentStepState?.output &&
      !pollIntervalRef.current
    ) {
      const output = currentStepState.output as { jobId?: string }
      const jobId = output.jobId

      if (jobId) {
        console.log('[Resume] Resuming polling for job:', jobId)

        // First, check if job is already done (immediate check, not polling)
        fetch(`/api/niche-finder/jobs/${jobId}/status`)
          .then(res => res.json())
          .then(statusData => {
            if (statusData.status === 'serp_done' || statusData.status === 'serp_completed') {
              console.log('[Resume] Job already completed, marking step as done')
              updateStepState(currentStep.id, {
                status: 'completed',
                completedAt: new Date(),
                output: {
                  jobId,
                  urlsFound: statusData.job?.urls_found || 0,
                  costs: statusData.costs,
                },
              })
              setTimeout(goToNextStep, 500)
              return // Don't start polling
            }
            // If not done, continue with normal polling setup below
            startPolling()
          })
          .catch(err => {
            console.error('[Resume] Error checking initial status:', err)
            startPolling() // Start polling anyway
          })

        function startPolling() {
          if (pollIntervalRef.current) return // Already polling

          // Set up polling - same logic as in executeStep
          let isResuming = false
          let lastCompletedCount = -1
          let stallCount = 0
          let initialCompleted = -1

          pollIntervalRef.current = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
            const statusData = await statusResponse.json()

            const completed = statusData.progress?.serp?.completed || 0
            const total = statusData.progress?.serp?.total || 0
            const remaining = total - completed
            const label = total > 0
              ? `Búsquedas: ${completed}/${total} (faltan ${remaining})`
              : 'Reconectando...'

            updateStepState(currentStep.id, {
              progress: {
                current: completed,
                total: total,
                label,
              },
            })

            // Track initial value on first poll
            if (initialCompleted === -1) {
              initialCompleted = completed
              console.log('[Resume] Initial completed:', initialCompleted)
            }

            // Auto-resume if job was interrupted
            if (statusData.status === 'serp_running' && completed < total && !isResuming) {
              if (lastCompletedCount === completed && remaining > 0) {
                stallCount++
                const noProgressSinceStart = completed === initialCompleted && stallCount >= 1
                if (stallCount >= 2 || noProgressSinceStart) {
                  console.log(`[Resume] Job stalled at ${completed}/${total}, auto-resuming...`)
                  isResuming = true
                  stallCount = 0
                  fetch(`/api/niche-finder/jobs/${jobId}/serp`, { method: 'POST' })
                    .then(res => res.json())
                    .then(data => {
                      console.log('[Resume] Resume response:', data)
                      isResuming = false
                    })
                    .catch(err => {
                      console.error('[Resume] Resume error:', err)
                      isResuming = false
                    })
                }
              } else {
                stallCount = 0
              }
            }
            lastCompletedCount = completed

            if (statusData.status === 'serp_done' || statusData.status === 'serp_completed') {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
              }
              updateStepState(currentStep.id, {
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
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
              }
              updateStepState(currentStep.id, {
                status: 'error',
                error: statusData.job?.error_message || 'Job failed',
              })
            }
          } catch (pollError) {
            console.error('[Resume] Poll error:', pollError)
            // Don't stop polling on transient errors
          }
        }, 2000)
        } // End startPolling function

        // Cleanup on unmount
        return () => {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
        }
      }
    }
  }, [currentStep?.id, currentStep?.type, currentStepState?.status, currentStepState?.output, updateStepState, goToNextStep])

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
          <div className="flex-1 overflow-y-auto">
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
                onRerunPrevious={rerunPreviousStep}
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
