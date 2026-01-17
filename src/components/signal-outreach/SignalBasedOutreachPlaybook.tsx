'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  Search,
  FileText,
  CheckCircle2,
  Circle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Play,
  MessageSquare,
  Target,
  Send,
  Sparkles,
  Eye,
  Filter,
  Download,
} from 'lucide-react'
import { useToast } from '@/components/ui'
import ReactMarkdown from 'react-markdown'

interface SignalBasedOutreachPlaybookProps {
  projectId: string
}

type StepStatus = 'pending' | 'running' | 'completed' | 'error'

interface Step {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  status: StepStatus
  output?: string
}

interface Phase {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  steps: Step[]
  expanded: boolean
}

const INITIAL_PHASES: Phase[] = [
  {
    id: 'phase1',
    name: 'Fase 1: Discovery de Creadores',
    description: 'Identificar creadores cuya audiencia coincide con tu ICP',
    icon: Users,
    expanded: true,
    steps: [
      {
        id: 'map_topics',
        name: 'Mapear Propuesta → Temas',
        description: 'Traduce tu propuesta de valor a temas de contenido que atraigan al ICP',
        icon: Target,
        status: 'pending',
      },
      {
        id: 'find_creators',
        name: 'Buscar Creadores',
        description: 'Genera estrategia para encontrar creadores relevantes en LinkedIn',
        icon: Search,
        status: 'pending',
      },
      {
        id: 'evaluate_creators',
        name: 'Evaluar Creadores',
        description: 'Evalua actividad, viralidad y calidad de audiencia de cada creador',
        icon: Eye,
        status: 'pending',
      },
      {
        id: 'select_creators',
        name: 'Seleccionar Creadores',
        description: 'Prioriza los mejores creadores para scrapear',
        icon: CheckCircle2,
        status: 'pending',
      },
    ],
  },
  {
    id: 'phase2',
    name: 'Fase 2: Discovery de Posts',
    description: 'Encontrar posts virales con alto engagement del ICP',
    icon: FileText,
    expanded: false,
    steps: [
      {
        id: 'scrape_posts',
        name: 'Scrapear Posts',
        description: 'Extrae los ultimos posts de cada creador con sus metricas',
        icon: Download,
        status: 'pending',
      },
      {
        id: 'evaluate_posts',
        name: 'Evaluar Posts',
        description: 'Puntua posts por engagement, recencia y alineamiento con ICP',
        icon: Eye,
        status: 'pending',
      },
      {
        id: 'select_posts',
        name: 'Seleccionar Posts',
        description: 'Elige los mejores posts para scrapear engagers',
        icon: CheckCircle2,
        status: 'pending',
      },
    ],
  },
  {
    id: 'phase3',
    name: 'Fase 3: Leads + Outreach',
    description: 'Scrapear engagers, filtrar por ICP y generar mensajes',
    icon: Send,
    expanded: false,
    steps: [
      {
        id: 'scrape_engagers',
        name: 'Scrapear Engagers',
        description: 'Extrae perfiles de quienes interactuaron con los posts',
        icon: Users,
        status: 'pending',
      },
      {
        id: 'filter_icp',
        name: 'Filtrar por ICP',
        description: 'Clasifica leads en ICP / Dudoso / Fuera',
        icon: Filter,
        status: 'pending',
      },
      {
        id: 'lead_magnet_messages',
        name: 'Lead Magnet + Mensajes',
        description: 'Crea lead magnet y mensajes personalizados',
        icon: MessageSquare,
        status: 'pending',
      },
      {
        id: 'export_launch',
        name: 'Export y Lanzamiento',
        description: 'Exporta CSV final y lanza la campana',
        icon: Send,
        status: 'pending',
      },
    ],
  },
]

export default function SignalBasedOutreachPlaybook({ projectId }: SignalBasedOutreachPlaybookProps) {
  const toast = useToast()

  // Configuration state
  const [clientName, setClientName] = useState('')
  const [valueProposition, setValueProposition] = useState('')
  const [icpDescription, setIcpDescription] = useState('')
  const [industry, setIndustry] = useState('')
  const [country, setCountry] = useState('Espana')
  const [knownCreators, setKnownCreators] = useState('')
  const [scrapingTool, setScrapingTool] = useState('Apify')
  const [targetLeadsCount, setTargetLeadsCount] = useState('500')
  const [leadMagnetUrl, setLeadMagnetUrl] = useState('')
  const [leadMagnetDescription, setLeadMagnetDescription] = useState('')
  const [senderName, setSenderName] = useState('')
  const [senderTitle, setSenderTitle] = useState('')
  const [senderCompany, setSenderCompany] = useState('')

  // Phases and steps state
  const [phases, setPhases] = useState<Phase[]>(INITIAL_PHASES)
  const [currentStepId, setCurrentStepId] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)

  // Load saved config from project
  useEffect(() => {
    const loadProjectConfig = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`)
        const data = await response.json()
        if (data.success && data.project) {
          const vars = data.project.variable_definitions || []
          vars.forEach((v: { name: string; value?: string }) => {
            switch (v.name) {
              case 'client_name': setClientName(v.value || ''); break
              case 'value_proposition': setValueProposition(v.value || ''); break
              case 'icp_description': setIcpDescription(v.value || ''); break
              case 'industry': setIndustry(v.value || ''); break
              case 'country': setCountry(v.value || 'Espana'); break
              case 'known_creators': setKnownCreators(v.value || ''); break
              case 'scraping_tool': setScrapingTool(v.value || 'Apify'); break
              case 'target_leads_count': setTargetLeadsCount(v.value || '500'); break
              case 'lead_magnet_url': setLeadMagnetUrl(v.value || ''); break
              case 'lead_magnet_description': setLeadMagnetDescription(v.value || ''); break
              case 'sender_name': setSenderName(v.value || ''); break
              case 'sender_title': setSenderTitle(v.value || ''); break
              case 'sender_company': setSenderCompany(v.value || ''); break
            }
          })
        }
      } catch (error) {
        console.error('Error loading project config:', error)
      }
    }
    loadProjectConfig()
  }, [projectId])

  const togglePhase = (phaseId: string) => {
    setPhases(prev => prev.map(p =>
      p.id === phaseId ? { ...p, expanded: !p.expanded } : p
    ))
  }

  const getStepOutput = (stepId: string): string | undefined => {
    for (const phase of phases) {
      const step = phase.steps.find(s => s.id === stepId)
      if (step?.output) return step.output
    }
    return undefined
  }

  const getPreviousStepOutput = (stepId: string): string => {
    const allSteps = phases.flatMap(p => p.steps)
    const currentIndex = allSteps.findIndex(s => s.id === stepId)
    if (currentIndex > 0) {
      return allSteps[currentIndex - 1].output || ''
    }
    return ''
  }

  const updateStepStatus = (stepId: string, status: StepStatus, output?: string) => {
    setPhases(prev => prev.map(phase => ({
      ...phase,
      steps: phase.steps.map(step =>
        step.id === stepId ? { ...step, status, output: output ?? step.output } : step
      ),
    })))
  }

  const executeStep = async (stepId: string) => {
    if (isExecuting) return

    // Validate required fields for first step
    if (stepId === 'map_topics' && (!clientName || !valueProposition || !icpDescription)) {
      toast.warning('Campos requeridos', 'Completa Cliente, Propuesta de Valor e ICP antes de ejecutar')
      return
    }

    setIsExecuting(true)
    setCurrentStepId(stepId)
    updateStepStatus(stepId, 'running')

    try {
      const previousOutput = getPreviousStepOutput(stepId)

      const response = await fetch('/api/playbook/execute-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          stepId,
          playbookType: 'signal_based_outreach',
          variables: {
            client_name: clientName,
            value_proposition: valueProposition,
            icp_description: icpDescription,
            industry,
            country,
            known_creators: knownCreators,
            scraping_tool: scrapingTool,
            target_leads_count: targetLeadsCount,
            lead_magnet_url: leadMagnetUrl,
            lead_magnet_description: leadMagnetDescription,
            sender_name: senderName,
            sender_title: senderTitle,
            sender_company: senderCompany,
            previous_step_output: previousOutput,
          },
        }),
      })

      const data = await response.json()

      if (data.success) {
        updateStepStatus(stepId, 'completed', data.output)
        toast.success('Paso completado', `${stepId} ejecutado correctamente`)

        // Auto-expand next phase if current phase is done
        const allSteps = phases.flatMap(p => p.steps)
        const currentIndex = allSteps.findIndex(s => s.id === stepId)
        if (currentIndex < allSteps.length - 1) {
          const nextStep = allSteps[currentIndex + 1]
          const nextPhase = phases.find(p => p.steps.some(s => s.id === nextStep.id))
          if (nextPhase && !nextPhase.expanded) {
            setPhases(prev => prev.map(p =>
              p.id === nextPhase.id ? { ...p, expanded: true } : p
            ))
          }
        }
      } else {
        throw new Error(data.error || 'Error ejecutando paso')
      }
    } catch (error) {
      console.error('Error executing step:', error)
      updateStepStatus(stepId, 'error')
      toast.error('Error', error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setIsExecuting(false)
      setCurrentStepId(null)
    }
  }

  const canExecuteStep = (stepId: string): boolean => {
    const allSteps = phases.flatMap(p => p.steps)
    const currentIndex = allSteps.findIndex(s => s.id === stepId)

    // First step can always be executed
    if (currentIndex === 0) return true

    // Other steps require previous step to be completed
    const previousStep = allSteps[currentIndex - 1]
    return previousStep.status === 'completed'
  }

  const getCompletedStepsCount = (): number => {
    return phases.flatMap(p => p.steps).filter(s => s.status === 'completed').length
  }

  const getTotalStepsCount = (): number => {
    return phases.flatMap(p => p.steps).length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Send className="w-5 h-5 text-orange-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Signal-Based Outreach</h2>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">Beta</span>
        </div>
        <p className="text-gray-600">
          LinkedIn outreach usando senales de intencion + lead magnet. Encuentra creadores cuya audiencia
          coincide con tu ICP, scrapea engagers y genera mensajes personalizados.
        </p>
        <div className="mt-4 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-gray-600">{getCompletedStepsCount()} / {getTotalStepsCount()} pasos completados</span>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          Configuracion del Playbook
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Cliente *
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Ej: Growth4U"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industria
            </label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Ej: SaaS, Marketing, Fintech"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Propuesta de Valor *
            </label>
            <textarea
              value={valueProposition}
              onChange={(e) => setValueProposition(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Que problema resuelve tu producto y para quien"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ICP (Ideal Customer Profile) *
            </label>
            <textarea
              value={icpDescription}
              onChange={(e) => setIcpDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Cargo, industria, tamano de empresa, pain points..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pais
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Ej: Espana, Mexico, LATAM"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Objetivo de Leads
            </label>
            <input
              type="number"
              value={targetLeadsCount}
              onChange={(e) => setTargetLeadsCount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Creadores Conocidos (opcional)
            </label>
            <textarea
              value={knownCreators}
              onChange={(e) => setKnownCreators(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="URLs de LinkedIn de creadores que ya conoces (uno por linea)"
            />
          </div>
        </div>
      </div>

      {/* Phases and Steps */}
      <div className="space-y-4">
        {phases.map((phase) => {
          const PhaseIcon = phase.icon
          const completedSteps = phase.steps.filter(s => s.status === 'completed').length
          const totalSteps = phase.steps.length

          return (
            <div key={phase.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Phase Header */}
              <button
                onClick={() => togglePhase(phase.id)}
                className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${completedSteps === totalSteps ? 'bg-green-100' : 'bg-gray-200'}`}>
                    <PhaseIcon className={`w-5 h-5 ${completedSteps === totalSteps ? 'text-green-600' : 'text-gray-600'}`} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900">{phase.name}</h3>
                    <p className="text-sm text-gray-500">{phase.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{completedSteps}/{totalSteps}</span>
                  {phase.expanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Steps */}
              {phase.expanded && (
                <div className="divide-y divide-gray-100">
                  {phase.steps.map((step, index) => {
                    const StepIcon = step.icon
                    const canExecute = canExecuteStep(step.id)
                    const isRunning = currentStepId === step.id

                    return (
                      <div key={step.id} className="p-6">
                        <div className="flex items-start gap-4">
                          {/* Step Number & Status */}
                          <div className="flex-shrink-0">
                            {step.status === 'completed' ? (
                              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                              </div>
                            ) : step.status === 'running' ? (
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                              </div>
                            ) : step.status === 'error' ? (
                              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                <Circle className="w-5 h-5 text-red-600" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-600">
                                  {phases.slice(0, phases.indexOf(phase)).flatMap(p => p.steps).length + index + 1}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Step Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <StepIcon className="w-4 h-4 text-gray-500" />
                              <h4 className="font-medium text-gray-900">{step.name}</h4>
                            </div>
                            <p className="text-sm text-gray-500 mb-3">{step.description}</p>

                            {/* Execute Button */}
                            {step.status !== 'completed' && (
                              <button
                                onClick={() => executeStep(step.id)}
                                disabled={!canExecute || isExecuting}
                                className={`
                                  inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                  ${canExecute && !isExecuting
                                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  }
                                `}
                              >
                                {isRunning ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Ejecutando...
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-4 h-4" />
                                    Ejecutar Paso
                                  </>
                                )}
                              </button>
                            )}

                            {/* Output */}
                            {step.output && (
                              <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                                <div className="prose prose-sm max-w-none">
                                  <ReactMarkdown>{step.output}</ReactMarkdown>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
