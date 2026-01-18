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
  Upload,
  Database,
  ExternalLink,
  ThumbsUp,
  MessageCircle,
  Star,
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
  importedData?: unknown[]
  allowsImport?: boolean // For scraping steps that accept CSV import
}

// ============================================
// CREATOR SUGGESTION TYPES
// ============================================
interface SuggestedCreator {
  name: string
  linkedinUrl: string
  topics: string[]
  estimatedFollowers: string
  relevanceReason: string
}

// ============================================
// POST SELECTION TYPES
// ============================================
interface EvaluatedPost {
  id: string
  url: string
  creatorName: string
  text: string
  likes: number
  comments: number
  date: string
  type: string
  topic?: string
  fitScore: number
  fitReason?: string
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
        allowsImport: true,
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
        allowsImport: true,
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
  const [isLoadingOutputs, setIsLoadingOutputs] = useState(true)

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importStepId, setImportStepId] = useState<string | null>(null)
  const [importData, setImportData] = useState('')
  const [isImporting, setIsImporting] = useState(false)

  // Creator suggestion state
  const [suggestedCreators, setSuggestedCreators] = useState<SuggestedCreator[]>([])
  const [selectedCreatorUrls, setSelectedCreatorUrls] = useState<Set<string>>(new Set())
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)

  // Post selection state
  const [foundPosts, setFoundPosts] = useState<EvaluatedPost[]>([])
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set())
  const [isScrapingEngagers, setIsScrapingEngagers] = useState(false)

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

  // Load saved step outputs from database
  useEffect(() => {
    const loadStepOutputs = async () => {
      setIsLoadingOutputs(true)
      try {
        const response = await fetch(`/api/playbook/outputs?projectId=${projectId}&playbookType=signal_based_outreach`)
        const data = await response.json()

        if (data.success && data.outputs) {
          setPhases(prev => prev.map(phase => ({
            ...phase,
            steps: phase.steps.map(step => {
              const savedOutput = data.outputs.find((o: { step_id: string }) => o.step_id === step.id)
              if (savedOutput) {
                return {
                  ...step,
                  status: savedOutput.status as StepStatus,
                  output: savedOutput.output_content || undefined,
                  importedData: savedOutput.imported_data || undefined,
                }
              }
              return step
            }),
          })))
        }
      } catch (error) {
        console.error('Error loading step outputs:', error)
      } finally {
        setIsLoadingOutputs(false)
      }
    }
    loadStepOutputs()
  }, [projectId])

  // Parse posts from scrape_posts step output
  useEffect(() => {
    const scrapePostsStep = phases.flatMap(p => p.steps).find(s => s.id === 'scrape_posts')
    if (scrapePostsStep?.status === 'completed' && scrapePostsStep.importedData) {
      // Posts are stored in imported_data as evaluated posts
      const posts = scrapePostsStep.importedData as unknown
      if (Array.isArray(posts) && posts.length > 0) {
        // Check if posts have the expected structure
        if (typeof posts[0] === 'object' && 'posts' in (posts[0] as object)) {
          setFoundPosts((posts[0] as { posts: EvaluatedPost[] }).posts)
        } else if ('url' in (posts[0] as object) || 'id' in (posts[0] as object)) {
          setFoundPosts(posts as EvaluatedPost[])
        }
      }
    }
  }, [phases])

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

  const openImportModal = (stepId: string) => {
    setImportStepId(stepId)
    setImportData('')
    setImportModalOpen(true)
  }

  const closeImportModal = () => {
    setImportModalOpen(false)
    setImportStepId(null)
    setImportData('')
  }

  const parseCSVorJSON = (text: string): unknown[] => {
    const trimmed = text.trim()

    // Try JSON first
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed)
        return Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        // Not valid JSON, try CSV
      }
    }

    // Parse CSV
    const lines = trimmed.split('\n').filter(line => line.trim())
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
    const data: Record<string, string>[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((header, idx) => {
        row[header] = values[idx] || ''
      })
      data.push(row)
    }

    return data
  }

  const handleImport = async () => {
    if (!importStepId || !importData.trim()) return

    setIsImporting(true)
    try {
      const parsedData = parseCSVorJSON(importData)

      if (parsedData.length === 0) {
        toast.error('Error', 'No se pudieron parsear los datos. Verifica el formato CSV o JSON.')
        return
      }

      const response = await fetch('/api/playbook/import-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          stepId: importStepId,
          playbookType: 'signal_based_outreach',
          data: parsedData,
          source: 'manual',
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Update local state
        setPhases(prev => prev.map(phase => ({
          ...phase,
          steps: phase.steps.map(step =>
            step.id === importStepId
              ? { ...step, status: 'completed' as StepStatus, importedData: parsedData }
              : step
          ),
        })))

        toast.success('Datos importados', `${parsedData.length} registros importados correctamente`)
        closeImportModal()
      } else {
        throw new Error(result.error || 'Error al importar datos')
      }
    } catch (error) {
      console.error('Error importing data:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error al importar datos')
    } finally {
      setIsImporting(false)
    }
  }

  const getImportedDataPreview = (stepId: string): unknown[] | undefined => {
    for (const phase of phases) {
      const step = phase.steps.find(s => s.id === stepId)
      if (step?.importedData) return step.importedData
    }
    return undefined
  }

  // ============================================
  // CREATOR SUGGESTION FUNCTIONS
  // ============================================

  const handleSuggestCreators = async () => {
    if (!industry && !icpDescription) {
      toast.warning('Configuración requerida', 'Completa la Industria o el ICP antes de buscar creadores')
      return
    }

    setIsLoadingSuggestions(true)
    setSuggestedCreators([])

    try {
      const response = await fetch('/api/playbook/suggest-creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          playbookType: 'signal_based_outreach',
          topics: [industry, valueProposition?.split(' ').slice(0, 5).join(' ')].filter(Boolean),
          icp: icpDescription,
          country,
          industry,
        }),
      })

      const data = await response.json()

      if (data.success && data.creators?.length > 0) {
        setSuggestedCreators(data.creators)
        toast.success('Creadores encontrados', `${data.creators.length} creadores sugeridos`)
      } else if (data.error) {
        throw new Error(data.error)
      } else {
        toast.warning('Sin resultados', 'No se encontraron creadores. Intenta con otros términos.')
      }
    } catch (error) {
      console.error('Error suggesting creators:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error al buscar creadores')
    } finally {
      setIsLoadingSuggestions(false)
    }
  }

  const toggleCreatorSelection = (url: string) => {
    setSelectedCreatorUrls(prev => {
      const newSet = new Set(prev)
      if (newSet.has(url)) {
        newSet.delete(url)
      } else {
        newSet.add(url)
      }
      return newSet
    })
  }

  const handleAddSelectedCreators = () => {
    if (selectedCreatorUrls.size === 0) return

    const currentCreators = knownCreators.trim()
    const newCreators = Array.from(selectedCreatorUrls).join('\n')
    const combined = currentCreators
      ? `${currentCreators}\n${newCreators}`
      : newCreators

    setKnownCreators(combined)
    setSuggestedCreators([])
    setSelectedCreatorUrls(new Set())
    toast.success('Creadores agregados', `${selectedCreatorUrls.size} URLs agregadas`)
  }

  // ============================================
  // POST SELECTION FUNCTIONS
  // ============================================

  const togglePostSelection = (postId: string) => {
    setSelectedPostIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }

  const handleSelectAllPosts = () => {
    if (selectedPostIds.size === foundPosts.length) {
      setSelectedPostIds(new Set())
    } else {
      setSelectedPostIds(new Set(foundPosts.map(p => p.id)))
    }
  }

  const handleScrapeSelectedEngagers = async () => {
    if (selectedPostIds.size === 0) {
      toast.warning('Selección requerida', 'Selecciona al menos un post')
      return
    }

    const selectedPosts = foundPosts.filter(p => selectedPostIds.has(p.id))
    const postUrls = selectedPosts.map(p => p.url)

    setIsScrapingEngagers(true)

    try {
      const response = await fetch('/api/playbook/scrape-engagers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          playbookType: 'signal_based_outreach',
          postUrls,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Scraping iniciado', `Scrapeando engagers de ${postUrls.length} posts`)
        // Refresh step outputs
        window.location.reload()
      } else {
        throw new Error(data.error || 'Error al scrapear engagers')
      }
    } catch (error) {
      console.error('Error scraping engagers:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error al scrapear engagers')
    } finally {
      setIsScrapingEngagers(false)
    }
  }

  // Get total engagement from selected posts
  const getSelectedPostsEngagement = (): number => {
    return foundPosts
      .filter(p => selectedPostIds.has(p.id))
      .reduce((sum, p) => sum + (p.likes || 0) + (p.comments || 0), 0)
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 placeholder:text-gray-400"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 placeholder:text-gray-400"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 placeholder:text-gray-400"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 placeholder:text-gray-400"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 placeholder:text-gray-400"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 placeholder:text-gray-400"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 placeholder:text-gray-400"
              placeholder="URLs de LinkedIn de creadores que ya conoces (uno por linea)"
            />

            {/* Suggest Creators Button */}
            <div className="mt-3">
              <button
                onClick={handleSuggestCreators}
                disabled={isLoadingSuggestions || (!industry && !icpDescription)}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isLoadingSuggestions || (!industry && !icpDescription)
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }
                `}
              >
                {isLoadingSuggestions ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Buscando creadores...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    🔍 Sugerir Creadores con Perplexity
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Usa IA para buscar creadores relevantes basados en tu industria e ICP
              </p>
            </div>

            {/* Suggested Creators List */}
            {suggestedCreators.length > 0 && (
              <div className="mt-4 border border-blue-200 rounded-lg overflow-hidden">
                <div className="bg-blue-50 px-4 py-3 border-b border-blue-200">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    Creadores Sugeridos ({suggestedCreators.length})
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Selecciona los creadores que quieres agregar a tu lista
                  </p>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                  {suggestedCreators.map((creator) => (
                    <div
                      key={creator.linkedinUrl}
                      onClick={() => toggleCreatorSelection(creator.linkedinUrl)}
                      className={`
                        p-4 cursor-pointer transition-colors
                        ${selectedCreatorUrls.has(creator.linkedinUrl)
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedCreatorUrls.has(creator.linkedinUrl)}
                          onChange={() => toggleCreatorSelection(creator.linkedinUrl)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{creator.name}</span>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {creator.estimatedFollowers} followers
                            </span>
                          </div>
                          <a
                            href={creator.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
                          >
                            {creator.linkedinUrl}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {creator.topics.map((topic, i) => (
                              <span key={i} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                                {topic}
                              </span>
                            ))}
                          </div>
                          {creator.relevanceReason && (
                            <p className="text-xs text-gray-600 mt-2">{creator.relevanceReason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {selectedCreatorUrls.size} seleccionados
                  </span>
                  <button
                    onClick={handleAddSelectedCreators}
                    disabled={selectedCreatorUrls.size === 0}
                    className={`
                      inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                      ${selectedCreatorUrls.size > 0
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }
                    `}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Agregar Seleccionados
                  </button>
                </div>
              </div>
            )}
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

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
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

                              {/* Import Button for scraping steps */}
                              {step.allowsImport && (
                                <button
                                  onClick={() => openImportModal(step.id)}
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
                                >
                                  <Upload className="w-4 h-4" />
                                  Importar CSV
                                </button>
                              )}
                            </div>

                            {/* Imported Data Preview */}
                            {step.importedData && step.importedData.length > 0 && (
                              <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <div className="flex items-center gap-2 text-sm text-gray-700 font-medium mb-2">
                                  <Database className="w-4 h-4 text-blue-600" />
                                  {step.importedData.length} registros importados
                                </div>
                                <div className="text-xs text-gray-700 max-h-24 overflow-y-auto">
                                  <pre className="whitespace-pre-wrap">
                                    {JSON.stringify(step.importedData.slice(0, 3), null, 2)}
                                    {step.importedData.length > 3 && `\n... y ${step.importedData.length - 3} más`}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {/* Output */}
                            {step.output && (
                              <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                                <div className="prose prose-sm prose-gray max-w-none [&_*]:text-gray-900 [&_a]:text-blue-600 [&_code]:text-gray-800 [&_strong]:text-gray-900">
                                  <ReactMarkdown>{step.output}</ReactMarkdown>
                                </div>
                              </div>
                            )}

                            {/* Post Selection UI - Only for scrape_posts step */}
                            {step.id === 'scrape_posts' && foundPosts.length > 0 && (
                              <div className="mt-4 border border-green-200 rounded-lg overflow-hidden">
                                <div className="bg-green-50 px-4 py-3 border-b border-green-200">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-green-600" />
                                      Posts Encontrados ({foundPosts.length})
                                    </h4>
                                    <button
                                      onClick={handleSelectAllPosts}
                                      className="text-sm text-blue-600 hover:underline"
                                    >
                                      {selectedPostIds.size === foundPosts.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                    </button>
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1">
                                    Selecciona los posts de los que quieres extraer engagers
                                  </p>
                                </div>

                                <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                                  {foundPosts.map((post) => (
                                    <div
                                      key={post.id}
                                      onClick={() => togglePostSelection(post.id)}
                                      className={`
                                        p-4 cursor-pointer transition-colors
                                        ${selectedPostIds.has(post.id)
                                          ? 'bg-green-50'
                                          : 'hover:bg-gray-50'
                                        }
                                      `}
                                    >
                                      <div className="flex items-start gap-3">
                                        <input
                                          type="checkbox"
                                          checked={selectedPostIds.has(post.id)}
                                          onChange={() => togglePostSelection(post.id)}
                                          className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-gray-900">{post.creatorName}</span>
                                            {post.topic && (
                                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                {post.topic}
                                              </span>
                                            )}
                                            {post.fitScore > 0 && (
                                              <span className="flex items-center gap-0.5">
                                                {[...Array(5)].map((_, i) => (
                                                  <Star
                                                    key={i}
                                                    className={`w-3 h-3 ${i < post.fitScore ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                                                  />
                                                ))}
                                              </span>
                                            )}
                                          </div>

                                          <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                                            {post.text}
                                          </p>

                                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                            <span className="flex items-center gap-1">
                                              <ThumbsUp className="w-4 h-4" />
                                              {post.likes?.toLocaleString() || 0}
                                            </span>
                                            <span className="flex items-center gap-1">
                                              <MessageCircle className="w-4 h-4" />
                                              {post.comments?.toLocaleString() || 0}
                                            </span>
                                            <span className="text-gray-500">{post.date}</span>
                                            {post.type && (
                                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                                {post.type}
                                              </span>
                                            )}
                                          </div>

                                          {post.fitReason && (
                                            <p className="text-xs text-gray-500 mt-2">{post.fitReason}</p>
                                          )}

                                          <a
                                            href={post.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
                                          >
                                            Ver en LinkedIn <ExternalLink className="w-3 h-3" />
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="text-sm text-gray-700">
                                      <span className="font-medium">{selectedPostIds.size}</span> posts seleccionados
                                      {selectedPostIds.size > 0 && (
                                        <span className="ml-2 text-gray-500">
                                          (~{getSelectedPostsEngagement().toLocaleString()} engagers potenciales)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    onClick={handleScrapeSelectedEngagers}
                                    disabled={selectedPostIds.size === 0 || isScrapingEngagers}
                                    className={`
                                      w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                                      ${selectedPostIds.size > 0 && !isScrapingEngagers
                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      }
                                    `}
                                  >
                                    {isScrapingEngagers ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Scrapeando engagers...
                                      </>
                                    ) : (
                                      <>
                                        <Download className="w-4 h-4" />
                                        Scrapear Engagers de {selectedPostIds.size} Posts
                                      </>
                                    )}
                                  </button>
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

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                Importar Datos
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Pega los datos en formato CSV o JSON
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Datos (CSV o JSON)
                </label>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm text-gray-900 placeholder:text-gray-400"
                  placeholder={`CSV:
fullName,profileUrl,headline
Juan Garcia,https://linkedin.com/in/juan,CEO at Startup
Maria Lopez,https://linkedin.com/in/maria,CTO at Tech

O JSON:
[
  {"fullName": "Juan Garcia", "profileUrl": "...", "headline": "..."},
  {"fullName": "Maria Lopez", "profileUrl": "...", "headline": "..."}
]`}
                />
              </div>

              {importData.trim() && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-1">Vista previa:</div>
                  <div className="text-xs text-gray-600">
                    {(() => {
                      try {
                        const parsed = parseCSVorJSON(importData)
                        return `${parsed.length} registros detectados`
                      } catch {
                        return 'Error al parsear datos'
                      }
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeImportModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={!importData.trim() || isImporting}
                className={`
                  px-4 py-2 text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2
                  ${importData.trim() && !isImporting
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
