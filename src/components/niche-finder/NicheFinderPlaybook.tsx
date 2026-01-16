'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search,
  Play,
  Loader2,
  Plus,
  X,
  Lightbulb,
  Globe,
  RefreshCw,
  Settings,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react'
import { useToast } from '@/components/ui'
import NicheResultsDashboard from './NicheResultsDashboard'

// Mapeo de contextos de vida a foros temáticos sugeridos
const THEMATIC_FORUMS_MAP: Record<string, string[]> = {
  familia: ['enfemenino.com', 'bebesymas.com'],
  hijos: ['bebesymas.com', 'serpadres.es'],
  niños: ['bebesymas.com', 'serpadres.es'],
  bebés: ['bebesymas.com', 'serpadres.es'],
  bebé: ['bebesymas.com', 'serpadres.es'],
  universidad: ['forocoches.com/foro/estudiantes', 'mediavida.com'],
  estudiante: ['forocoches.com/foro/estudiantes', 'mediavida.com'],
  boda: ['bodas.net', 'zankyou.es'],
  casamiento: ['bodas.net', 'zankyou.es'],
  matrimonio: ['bodas.net', 'zankyou.es'],
  trabajo: ['forocoches.com', 'linkedin.com'],
  empleo: ['forocoches.com', 'infojobs.net'],
  autónomo: ['infoautonomos.com', 'forocoches.com'],
  freelancer: ['domestika.org', 'forocoches.com'],
  empresa: ['forocoches.com', 'rankia.com'],
  negocio: ['forocoches.com', 'rankia.com'],
  inversión: ['rankia.com', 'finect.com'],
  ahorro: ['rankia.com', 'finect.com'],
  finanzas: ['rankia.com', 'finect.com'],
  dinero: ['rankia.com', 'forocoches.com'],
  vivienda: ['idealista.com/foro', 'fotocasa.es/foro'],
  piso: ['idealista.com/foro', 'fotocasa.es/foro'],
  alquiler: ['idealista.com/foro', 'fotocasa.es/foro'],
  hipoteca: ['rankia.com', 'idealista.com/foro'],
  vacaciones: ['tripadvisor.es', 'losviajeros.com'],
  viaje: ['tripadvisor.es', 'losviajeros.com'],
  coche: ['forocoches.com', 'km77.com'],
  salud: ['enfemenino.com', 'doctoralia.es'],
  deporte: ['foroatletismo.com', 'burbuja.info'],
  jubilación: ['rankia.com', 'jubilaciondefuturo.es'],
}

interface NicheFinderPlaybookProps {
  projectId: string
}

interface JobStatus {
  status: string
  urls_found: number
  urls_scraped: number
  urls_failed: number
  urls_filtered: number
  niches_extracted: number
  started_at: string | null
  completed_at: string | null
  error_message: string | null
}

interface CostEstimate {
  serp: number
  firecrawl: number
  llm: number
  total: number
  queries: number
  estimated_urls: number
}

type ExecutionPhase = 'idle' | 'serp_running' | 'serp_done' | 'scraping' | 'scrape_done' | 'extracting' | 'extract_done' | 'analyzing_1' | 'analyzing_2' | 'analyzing_3' | 'completed' | 'failed'

// Indicadores predefinidos
const INDICATOR_PRESETS = {
  frustration: ['me frustra', 'estoy harto', 'no aguanto más', 'es una pesadilla', 'me tiene loco'],
  help: ['¿alguien sabe', 'necesito ayuda', '¿qué hago?', 'consejos para', '¿cómo puedo'],
  problem: ['problema con', 'no puedo', 'me cuesta', 'dificultad para', 'es horrible'],
  need: ['busco alternativa', '¿hay algo mejor?', 'ojalá existiera', 'me gustaría poder', 'necesito encontrar'],
}

export default function NicheFinderPlaybook({ projectId }: NicheFinderPlaybookProps) {
  const toast = useToast()

  // Configuration state
  const [lifeContexts, setLifeContexts] = useState<string[]>([])
  const [productWords, setProductWords] = useState<string[]>([])
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([])
  const [newContext, setNewContext] = useState('')
  const [newProductWord, setNewProductWord] = useState('')

  // Sources config
  const [sources, setSources] = useState({
    reddit: true,
    thematic_forums: true,
    general_forums: ['forocoches.com', 'mediavida.com'],
  })
  const [newForum, setNewForum] = useState('')

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [serpPages, setSerpPages] = useState(5)
  const [batchSize, setBatchSize] = useState(10)

  // Execution state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [executionPhase, setExecutionPhase] = useState<ExecutionPhase>('idle')
  const [isExecuting, setIsExecuting] = useState(false)

  // Cost estimation
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null)
  const [estimatingCost, setEstimatingCost] = useState(false)

  // AI suggestions
  const [suggestingContexts, setSuggestingContexts] = useState(false)
  const [suggestingWords, setSuggestingWords] = useState(false)
  const [suggestingForums, setSuggestingForums] = useState(false)
  const [suggestingGeneralForums, setSuggestingGeneralForums] = useState(false)

  // AI-suggested thematic forums (user can approve/remove)
  const [aiSuggestedForums, setAiSuggestedForums] = useState<Array<{domain: string, context: string, reason: string}>>([])
  const [approvedForums, setApprovedForums] = useState<string[]>([])

  // Manual thematic forums (user can add/remove)
  const [manualThematicForums, setManualThematicForums] = useState<string[]>([])
  const [newThematicForum, setNewThematicForum] = useState('')

  // Excluded thematic forums (from auto-suggested)
  const [excludedThematicForums, setExcludedThematicForums] = useState<string[]>([])

  // Results
  const [showResults, setShowResults] = useState(false)

  // Preview
  const [showPreview, setShowPreview] = useState(false)

  // Calculate suggested thematic forums based on selected contexts + AI approved forums + manual
  const suggestedThematicForums = useMemo(() => {
    const forums = new Map<string, string[]>() // forum -> contexts that suggest it

    // Add forums from the hardcoded map
    lifeContexts.forEach(ctx => {
      const ctxLower = ctx.toLowerCase()
      Object.entries(THEMATIC_FORUMS_MAP).forEach(([keyword, forumList]) => {
        if (ctxLower.includes(keyword) || keyword.includes(ctxLower)) {
          forumList.forEach(forum => {
            if (!excludedThematicForums.includes(forum)) {
              const existing = forums.get(forum) || []
              if (!existing.includes(ctx)) {
                forums.set(forum, [...existing, ctx])
              }
            }
          })
        }
      })
    })

    // Add AI-approved forums
    approvedForums.forEach(forum => {
      if (!excludedThematicForums.includes(forum)) {
        const aiSuggestion = aiSuggestedForums.find(f => f.domain === forum)
        if (aiSuggestion && !forums.has(forum)) {
          forums.set(forum, [aiSuggestion.context || 'IA'])
        }
      }
    })

    // Add manual thematic forums
    manualThematicForums.forEach(forum => {
      if (!forums.has(forum)) {
        forums.set(forum, ['manual'])
      }
    })

    return forums
  }, [lifeContexts, approvedForums, aiSuggestedForums, manualThematicForums, excludedThematicForums])

  // Generate sample queries for preview
  const sampleQueries = useMemo(() => {
    const queries: string[] = []
    const ctx = lifeContexts[0] || 'contexto'
    const word = productWords[0] || 'palabra'
    const indicator = selectedIndicators[0]

    if (sources.reddit) {
      queries.push(`site:reddit.com "${ctx}" "${word}"${indicator ? ` "${indicator}"` : ''}`)
    }
    if (sources.thematic_forums && suggestedThematicForums.size > 0) {
      const firstForum = Array.from(suggestedThematicForums.keys())[0]
      queries.push(`site:${firstForum} "${ctx}" "${word}"`)
    }
    if (sources.general_forums.length > 0) {
      queries.push(`site:${sources.general_forums[0]} "${ctx}" "${word}"`)
    }

    return queries
  }, [lifeContexts, productWords, selectedIndicators, sources, suggestedThematicForums])

  // Calculate combinations
  const totalCombinations = lifeContexts.length * productWords.length
  const thematicForumsCount = sources.thematic_forums ? suggestedThematicForums.size : 0
  const sourcesCount = (sources.reddit ? 1 : 0) + thematicForumsCount + sources.general_forums.length
  const baseQueries = totalCombinations * sourcesCount
  const indicatorQueries = selectedIndicators.length * totalCombinations * sourcesCount
  const totalQueries = baseQueries + indicatorQueries

  // Poll job status
  useEffect(() => {
    if (!currentJobId || executionPhase === 'idle' || executionPhase === 'completed' || executionPhase === 'failed') {
      return
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/niche-finder/jobs/${currentJobId}/status`)
        const data = await response.json()

        if (data.success && data.job) {
          setJobStatus(data.job)

          // Update phase based on status
          const status = data.job.status
          if (status === 'completed') {
            setExecutionPhase('completed')
            setIsExecuting(false)
            setShowResults(true)
            toast.success('Completado', `Se extrajeron ${data.job.niches_extracted} nichos`)
          } else if (status === 'failed') {
            setExecutionPhase('failed')
            setIsExecuting(false)
            toast.error('Error', data.job.error_message || 'Error durante la ejecución')
          } else {
            setExecutionPhase(status as ExecutionPhase)
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [currentJobId, executionPhase, toast])

  // Estimate cost when config changes
  const estimateCost = useCallback(async () => {
    if (lifeContexts.length === 0 || productWords.length === 0) {
      setCostEstimate(null)
      return
    }

    setEstimatingCost(true)
    try {
      const response = await fetch('/api/niche-finder/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          life_contexts: lifeContexts,
          product_words: productWords,
          indicators: selectedIndicators,
          sources,
          serp_pages: serpPages,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setCostEstimate(data.estimate)
      }
    } catch (error) {
      console.error('Error estimating cost:', error)
    } finally {
      setEstimatingCost(false)
    }
  }, [lifeContexts, productWords, selectedIndicators, sources, serpPages])

  useEffect(() => {
    const debounce = setTimeout(estimateCost, 500)
    return () => clearTimeout(debounce)
  }, [estimateCost])

  // Add context - supports multiple words separated by comma
  const handleAddContext = () => {
    if (newContext.trim()) {
      // Parse multiple words separated by comma
      const newContexts = newContext
        .split(',')
        .map(c => c.trim())
        .filter(c => c && !lifeContexts.includes(c))

      if (newContexts.length > 0) {
        setLifeContexts([...lifeContexts, ...newContexts])
      }
      setNewContext('')
    }
  }

  // Add product word - supports multiple words separated by comma
  const handleAddProductWord = () => {
    if (newProductWord.trim()) {
      // Parse multiple words separated by comma
      const newWords = newProductWord
        .split(',')
        .map(w => w.trim())
        .filter(w => w && !productWords.includes(w))

      if (newWords.length > 0) {
        setProductWords([...productWords, ...newWords])
      }
      setNewProductWord('')
    }
  }

  // Add forum
  const handleAddForum = () => {
    if (newForum.trim() && !sources.general_forums.includes(newForum.trim())) {
      setSources({
        ...sources,
        general_forums: [...sources.general_forums, newForum.trim()],
      })
      setNewForum('')
    }
  }

  // Handle add thematic forum manually
  const handleAddThematicForum = () => {
    const forum = newThematicForum.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (forum && !manualThematicForums.includes(forum) && !suggestedThematicForums.has(forum)) {
      setManualThematicForums([...manualThematicForums, forum])
      setNewThematicForum('')
    }
  }

  // Remove thematic forum (either manual or exclude auto-suggested)
  const removeThematicForum = (forum: string) => {
    if (manualThematicForums.includes(forum)) {
      setManualThematicForums(manualThematicForums.filter(f => f !== forum))
    } else {
      // It's an auto-suggested forum, exclude it
      setExcludedThematicForums([...excludedThematicForums, forum])
    }
    // Also remove from approved if it was AI-approved
    setApprovedForums(approvedForums.filter(f => f !== forum))
  }

  // Toggle indicator
  const toggleIndicator = (indicator: string) => {
    if (selectedIndicators.includes(indicator)) {
      setSelectedIndicators(selectedIndicators.filter((i) => i !== indicator))
    } else {
      setSelectedIndicators([...selectedIndicators, indicator])
    }
  }

  // AI suggest contexts
  const suggestContexts = async () => {
    setSuggestingContexts(true)
    try {
      const response = await fetch('/api/niche-finder/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'life_contexts',
          existing: lifeContexts,
          product_words: productWords,
          project_id: projectId,
        }),
      })

      const data = await response.json()
      if (data.success && data.suggestions) {
        const newContexts = data.suggestions.filter(
          (s: string) => !lifeContexts.includes(s)
        )
        if (newContexts.length > 0) {
          setLifeContexts([...lifeContexts, ...newContexts.slice(0, 5)])
          toast.success('Sugerencias añadidas', `Se añadieron ${Math.min(newContexts.length, 5)} contextos`)
        } else {
          toast.warning('Sin sugerencias', 'No se encontraron nuevos contextos')
        }
      } else {
        toast.error('Error', data.error || 'No se pudieron obtener sugerencias')
      }
    } catch (error) {
      console.error('Suggest contexts error:', error)
      toast.error('Error', 'No se pudieron obtener sugerencias')
    } finally {
      setSuggestingContexts(false)
    }
  }

  // AI suggest product words
  const suggestProductWords = async () => {
    setSuggestingWords(true)
    try {
      const response = await fetch('/api/niche-finder/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'product_words',
          existing: productWords,
          life_contexts: lifeContexts,
          project_id: projectId,
        }),
      })

      const data = await response.json()
      if (data.success && data.suggestions) {
        const newWords = data.suggestions.filter(
          (s: string) => !productWords.includes(s)
        )
        if (newWords.length > 0) {
          setProductWords([...productWords, ...newWords.slice(0, 5)])
          toast.success('Sugerencias añadidas', `Se añadieron ${Math.min(newWords.length, 5)} palabras`)
        } else {
          toast.warning('Sin sugerencias', 'No se encontraron nuevas palabras')
        }
      } else {
        toast.error('Error', data.error || 'No se pudieron obtener sugerencias')
      }
    } catch (error) {
      console.error('Suggest product words error:', error)
      toast.error('Error', 'No se pudieron obtener sugerencias')
    } finally {
      setSuggestingWords(false)
    }
  }

  // AI suggest thematic forums
  const suggestThematicForums = async () => {
    if (lifeContexts.length === 0 && productWords.length === 0) {
      toast.warning('Añade contextos', 'Primero añade contextos de vida o palabras del producto')
      return
    }

    setSuggestingForums(true)
    try {
      const response = await fetch('/api/niche-finder/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'thematic_forums',
          existing: [...Array.from(suggestedThematicForums.keys()), ...approvedForums],
          life_contexts: lifeContexts,
          product_words: productWords,
          project_id: projectId,
        }),
      })

      const data = await response.json()
      if (data.success && data.suggestions) {
        const newForums = data.suggestions.filter(
          (f: {domain: string}) => !approvedForums.includes(f.domain) && !suggestedThematicForums.has(f.domain)
        )
        if (newForums.length > 0) {
          setAiSuggestedForums(prev => [...prev, ...newForums])
          toast.success('Foros sugeridos', `Se encontraron ${newForums.length} foros. Aprueba los que quieras usar.`)
        } else {
          toast.warning('Sin sugerencias', 'No se encontraron nuevos foros temáticos')
        }
      } else {
        toast.error('Error', data.error || 'No se pudieron obtener sugerencias')
      }
    } catch (error) {
      console.error('Suggest forums error:', error)
      toast.error('Error', 'No se pudieron obtener sugerencias de foros')
    } finally {
      setSuggestingForums(false)
    }
  }

  // AI suggest general forums
  const suggestGeneralForums = async () => {
    setSuggestingGeneralForums(true)
    try {
      const response = await fetch('/api/niche-finder/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'general_forums',
          existing: sources.general_forums,
          life_contexts: lifeContexts,
          product_words: productWords,
          project_id: projectId,
        }),
      })

      const data = await response.json()
      if (data.success && data.suggestions) {
        // Filter to only include verified active forums
        const VERIFIED_FORUMS = [
          'forocoches.com', 'mediavida.com', 'burbuja.info', 'rankia.com',
          'elotrolado.net', 'htcmania.com', 'meneame.net', '3djuegos.com',
          'vandal.elespanol.com/foro', 'portalcoches.net'
        ]
        const newForums = data.suggestions
          .map((f: string | {domain: string}) => typeof f === 'string' ? f : f.domain)
          .filter((f: string) =>
            !sources.general_forums.includes(f) &&
            VERIFIED_FORUMS.some(vf => f.includes(vf))
          )

        if (newForums.length > 0) {
          setSources(prev => ({
            ...prev,
            general_forums: [...prev.general_forums, ...newForums.slice(0, 3)]
          }))
          toast.success('Foros añadidos', `Se añadieron ${Math.min(newForums.length, 3)} foros activos`)
        } else {
          // Add default suggestions if AI didn't find verified ones
          const defaultSuggestions = VERIFIED_FORUMS.filter(f => !sources.general_forums.includes(f)).slice(0, 2)
          if (defaultSuggestions.length > 0) {
            setSources(prev => ({
              ...prev,
              general_forums: [...prev.general_forums, ...defaultSuggestions]
            }))
            toast.success('Foros añadidos', `Se añadieron ${defaultSuggestions.length} foros populares`)
          } else {
            toast.warning('Sin sugerencias', 'Ya tienes los foros principales')
          }
        }
      } else {
        toast.error('Error', data.error || 'No se pudieron obtener sugerencias')
      }
    } catch (error) {
      console.error('Suggest general forums error:', error)
      // Fallback: add popular forums directly
      const fallbackForums = ['burbuja.info', 'rankia.com'].filter(f => !sources.general_forums.includes(f))
      if (fallbackForums.length > 0) {
        setSources(prev => ({
          ...prev,
          general_forums: [...prev.general_forums, ...fallbackForums]
        }))
        toast.success('Foros añadidos', `Se añadieron ${fallbackForums.length} foros populares`)
      }
    } finally {
      setSuggestingGeneralForums(false)
    }
  }

  // Approve an AI-suggested forum
  const approveForum = (domain: string) => {
    if (!approvedForums.includes(domain)) {
      setApprovedForums([...approvedForums, domain])
    }
    // Remove from pending suggestions
    setAiSuggestedForums(prev => prev.filter(f => f.domain !== domain))
  }

  // Reject an AI-suggested forum
  const rejectForum = (domain: string) => {
    setAiSuggestedForums(prev => prev.filter(f => f.domain !== domain))
  }

  // Remove an approved forum
  const removeApprovedForum = (domain: string) => {
    setApprovedForums(prev => prev.filter(f => f !== domain))
  }

  // Start execution
  const startExecution = async () => {
    if (lifeContexts.length === 0 || productWords.length === 0) {
      toast.warning('Configuración incompleta', 'Añade al menos un contexto de vida y una palabra del producto')
      return
    }

    setIsExecuting(true)
    setExecutionPhase('serp_running')
    setShowResults(false)

    try {
      // Start job - wrap config data in config object as expected by API
      const startResponse = await fetch('/api/niche-finder/jobs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          config: {
            life_contexts: lifeContexts,
            product_words: productWords,
            indicators: selectedIndicators,
            sources,
            serp_pages: serpPages,
            batch_size: batchSize,
          },
        }),
      })

      const startData = await startResponse.json()
      if (!startData.success) {
        throw new Error(startData.error || 'Error al iniciar job')
      }

      // Handle both job_id and jobId for compatibility
      setCurrentJobId(startData.job_id || startData.jobId)

      // Run SERP phase
      const serpResponse = await fetch(`/api/niche-finder/jobs/${startData.jobId}/serp`, {
        method: 'POST',
      })

      const serpData = await serpResponse.json()
      if (!serpData.success) {
        throw new Error(serpData.error || 'Error en búsqueda SERP')
      }

      setExecutionPhase('scraping')

      // Run scraping phase
      const scrapeResponse = await fetch(`/api/niche-finder/jobs/${startData.jobId}/scrape`, {
        method: 'POST',
      })

      const scrapeData = await scrapeResponse.json()
      if (!scrapeData.success) {
        throw new Error(scrapeData.error || 'Error en scraping')
      }

      setExecutionPhase('extracting')

      // Run extraction phase
      const extractResponse = await fetch(`/api/niche-finder/jobs/${startData.jobId}/extract`, {
        method: 'POST',
      })

      const extractData = await extractResponse.json()
      if (!extractData.success) {
        throw new Error(extractData.error || 'Error en extracción')
      }

      setExecutionPhase('analyzing_1')

      // Run LLM analysis phases (Steps 1-3) using default prompts
      // Note: Custom prompts can be configured in the "Flujo" tab
      const analyzeResponse = await fetch(`/api/niche-finder/jobs/${startData.jobId}/analyze`, {
        method: 'POST',
      })

      const analyzeData = await analyzeResponse.json()
      if (!analyzeData.success) {
        throw new Error(analyzeData.error || 'Error en análisis LLM')
      }

      // Polling will handle the completion

    } catch (error) {
      console.error('Execution error:', error)
      setExecutionPhase('failed')
      setIsExecuting(false)
      toast.error('Error', error instanceof Error ? error.message : 'Error durante la ejecución')
    }
  }

  // Get phase progress info
  const getPhaseInfo = () => {
    switch (executionPhase) {
      case 'serp_running':
        return { label: 'Buscando URLs...', progress: 10 }
      case 'serp_done':
        return { label: 'URLs encontradas', progress: 15 }
      case 'scraping':
        return { label: 'Scrapeando contenido...', progress: 25 }
      case 'scrape_done':
        return { label: 'Contenido obtenido', progress: 35 }
      case 'extracting':
        return { label: 'Extrayendo nichos...', progress: 45 }
      case 'extract_done':
        return { label: 'Nichos extraídos', progress: 50 }
      case 'analyzing_1':
        return { label: 'Step 1: Limpiando y filtrando...', progress: 60 }
      case 'analyzing_2':
        return { label: 'Step 2: Scoring (Deep Research)...', progress: 75 }
      case 'analyzing_3':
        return { label: 'Step 3: Consolidando tabla final...', progress: 90 }
      case 'completed':
        return { label: 'Completado', progress: 100 }
      case 'failed':
        return { label: 'Error', progress: 0 }
      default:
        return { label: 'Listo para iniciar', progress: 0 }
    }
  }

  const phaseInfo = getPhaseInfo()

  // If showing results, render results dashboard
  if (showResults && currentJobId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowResults(false)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1"
          >
            ← Volver a configuración
          </button>
          <button
            onClick={() => {
              setShowResults(false)
              setCurrentJobId(null)
              setExecutionPhase('idle')
              setJobStatus(null)
            }}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 inline-flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Nueva búsqueda
          </button>
        </div>
        <NicheResultsDashboard jobId={currentJobId} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Buscador de Nichos 100x</h2>
        <p className="text-sm text-gray-500 mt-1">
          Encuentra nichos de mercado analizando conversaciones reales en foros y redes sociales
        </p>
      </div>

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column A: Life Contexts */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Contextos de Vida</h3>
              <p className="text-xs text-gray-500">Dónde está la persona, qué situación vive</p>
            </div>
            <button
              onClick={suggestContexts}
              disabled={suggestingContexts}
              className="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {suggestingContexts ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
              Sugerir con IA
            </button>
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddContext()}
              placeholder="familia, hijos, universidad..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              onClick={handleAddContext}
              className="p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[80px]">
            {lifeContexts.map((context) => (
              <span
                key={context}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm"
              >
                {context}
                <button
                  onClick={() => setLifeContexts(lifeContexts.filter((c) => c !== context))}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
            {lifeContexts.length === 0 && (
              <p className="text-gray-400 text-sm italic">Añade contextos de vida para comenzar</p>
            )}
          </div>
        </div>

        {/* Column B: Product Words */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Palabras del Producto</h3>
              <p className="text-xs text-gray-500">Necesidades que cubre tu producto/servicio</p>
            </div>
            <button
              onClick={suggestProductWords}
              disabled={suggestingWords}
              className="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {suggestingWords ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
              Sugerir con IA
            </button>
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newProductWord}
              onChange={(e) => setNewProductWord(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddProductWord()}
              placeholder="pagos, ahorro, gastos..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              onClick={handleAddProductWord}
              className="p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[80px]">
            {productWords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm"
              >
                {word}
                <button
                  onClick={() => setProductWords(productWords.filter((w) => w !== word))}
                  className="text-green-500 hover:text-green-700"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
            {productWords.length === 0 && (
              <p className="text-gray-400 text-sm italic">Añade palabras relacionadas a tu producto</p>
            )}
          </div>
        </div>
      </div>

      {/* Combinations Preview */}
      {(lifeContexts.length > 0 || productWords.length > 0) && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Search size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-orange-900">
                  {lifeContexts.length} contextos × {productWords.length} palabras = {totalCombinations} combinaciones
                </p>
                <p className="text-sm text-orange-700">
                  × {sourcesCount} fuentes = <strong>{totalQueries} queries</strong> de búsqueda
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  Fuentes: {sources.reddit ? 'Reddit' : ''}{sources.reddit && (thematicForumsCount > 0 || sources.general_forums.length > 0) ? ', ' : ''}
                  {thematicForumsCount > 0 ? `${thematicForumsCount} foros temáticos` : ''}{thematicForumsCount > 0 && sources.general_forums.length > 0 ? ', ' : ''}
                  {sources.general_forums.length > 0 ? `${sources.general_forums.length} foros generales` : ''}
                </p>
              </div>
            </div>
            {costEstimate && (
              <div className="text-right">
                <p className="text-sm text-orange-700">Coste estimado</p>
                <p className="text-lg font-bold text-orange-900">${costEstimate.total.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sources Configuration */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Globe size={18} />
          Fuentes de Datos
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Row 1: Reddit + General Forums */}
          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={sources.reddit}
              onChange={(e) => setSources({ ...sources, reddit: e.target.checked })}
              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
            />
            <div>
              <p className="font-medium text-gray-900">Reddit</p>
              <p className="text-xs text-gray-500">Búsqueda general</p>
            </div>
          </label>

          {/* General Forums */}
          <div className="p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-gray-900">Foros Generales</p>
              <button
                onClick={suggestGeneralForums}
                disabled={suggestingGeneralForums}
                className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100 disabled:opacity-50 inline-flex items-center gap-1"
              >
                {suggestingGeneralForums ? <Loader2 size={10} className="animate-spin" /> : <Lightbulb size={10} />}
                Sugerir
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {sources.general_forums.map((forum) => (
                <span
                  key={forum}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                >
                  {forum}
                  <button
                    onClick={() =>
                      setSources({
                        ...sources,
                        general_forums: sources.general_forums.filter((f) => f !== forum),
                      })
                    }
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                value={newForum}
                onChange={(e) => setNewForum(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddForum()}
                placeholder="dominio.com"
                className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs text-gray-900"
              />
              <button
                onClick={handleAddForum}
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
              >
                +
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">💡 Solo foros activos con discusiones reales (no blogs)</p>
          </div>

          {/* Row 2: Thematic Forums (full width) */}
          <div className="p-3 border border-gray-200 rounded-lg md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sources.thematic_forums}
                  onChange={(e) => setSources({ ...sources, thematic_forums: e.target.checked })}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <div>
                  <p className="font-medium text-gray-900">Foros Temáticos</p>
                  <p className="text-xs text-gray-500">Según contexto de vida ({suggestedThematicForums.size} foros)</p>
                </div>
              </label>
              <button
                onClick={suggestThematicForums}
                disabled={suggestingForums || (lifeContexts.length === 0 && productWords.length === 0)}
                className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {suggestingForums ? <Loader2 size={12} className="animate-spin" /> : <Lightbulb size={12} />}
                Sugerir con IA
              </button>
            </div>

            {/* AI Suggestions pending approval */}
            {aiSuggestedForums.length > 0 && (
              <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-xs font-medium text-purple-800 mb-2">Sugerencias de IA (aprobar o rechazar):</p>
                <div className="space-y-2">
                  {aiSuggestedForums.map((forum) => (
                    <div key={forum.domain} className="flex items-center justify-between p-2 bg-white rounded border border-purple-100">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{forum.domain}</p>
                        <p className="text-xs text-gray-500">{forum.reason}</p>
                        {forum.context && (
                          <p className="text-xs text-purple-600">Contexto: {forum.context}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => approveForum(forum.domain)}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          ✓ Aprobar
                        </button>
                        <button
                          onClick={() => rejectForum(forum.domain)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* List of all thematic forums that will be searched - EDITABLE */}
            {sources.thematic_forums && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Foros que se buscarán:</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Array.from(suggestedThematicForums.entries()).map(([forum, contexts]) => (
                    <span
                      key={forum}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        manualThematicForums.includes(forum)
                          ? 'bg-green-100 text-green-700'
                          : approvedForums.includes(forum)
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                      title={`${manualThematicForums.includes(forum) ? 'Manual' : contexts.join(', ')}`}
                    >
                      {forum}
                      <button
                        onClick={() => removeThematicForum(forum)}
                        className="opacity-60 hover:opacity-100 ml-0.5"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                {/* Input para agregar foro temático manualmente */}
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newThematicForum}
                    onChange={(e) => setNewThematicForum(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddThematicForum()}
                    placeholder="Agregar foro temático (ej: bodas.net)"
                    className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs text-gray-900"
                  />
                  <button
                    onClick={handleAddThematicForum}
                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {sources.thematic_forums && suggestedThematicForums.size === 0 && lifeContexts.length > 0 && (
              <p className="mt-2 text-xs text-amber-600">
                No se encontraron foros temáticos para estos contextos. Usa &quot;Sugerir con IA&quot; para buscar foros relevantes.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Indicators - Compact design */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">
              🔍 Indicadores de Problema
            </h3>
            <p className="text-xs text-gray-500">Palabras que indican frustración o necesidad de ayuda</p>
          </div>
          {selectedIndicators.length > 0 && (
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
              {selectedIndicators.length} seleccionados → +{indicatorQueries} queries
            </span>
          )}
        </div>

        {/* Compact indicator grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {Object.entries(INDICATOR_PRESETS).map(([category, indicators]) => (
            <div key={category} className="p-2 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-600 mb-1.5">
                {category === 'frustration' && '😤 Frustración'}
                {category === 'help' && '🙋 Ayuda'}
                {category === 'problem' && '⚠️ Problema'}
                {category === 'need' && '🔎 Búsqueda'}
              </p>
              <div className="flex flex-wrap gap-1">
                {indicators.map((indicator) => (
                  <button
                    key={indicator}
                    onClick={() => toggleIndicator(indicator)}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      selectedIndicators.includes(indicator)
                        ? 'bg-orange-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {indicator}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Live preview of how indicators affect queries */}
        {selectedIndicators.length > 0 && (
          <div className="p-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg">
            <p className="text-xs font-medium text-orange-800 mb-2">
              ✅ Queries con indicadores buscarán: {selectedIndicators.map(i => `"${i}"`).join(', ')}
            </p>
            <div className="text-xs font-mono bg-white/60 p-2 rounded text-gray-600">
              <span className="text-gray-400">Ejemplo:</span> site:reddit.com &quot;{lifeContexts[0] || 'contexto'}&quot; &quot;{productWords[0] || 'palabra'}&quot; <span className="text-orange-600 font-semibold">&quot;{selectedIndicators[0]}&quot;</span>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Settings */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-gray-500" />
            <span className="font-medium text-gray-900">Configuración Avanzada</span>
          </div>
          {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showAdvanced && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Páginas SERP por query
                </label>
                <select
                  value={serpPages}
                  onChange={(e) => setSerpPages(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                >
                  <option value={3}>3 páginas (30 resultados)</option>
                  <option value={5}>5 páginas (50 resultados)</option>
                  <option value={10}>10 páginas (100 resultados)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URLs en paralelo
                </label>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                >
                  <option value={5}>5 (más lento, menos errores)</option>
                  <option value={10}>10 (balanceado)</option>
                  <option value={20}>20 (más rápido)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search Preview */}
      {totalCombinations > 0 && !isExecuting && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-blue-900 flex items-center gap-2">
              <Eye size={18} />
              Preview de Búsqueda
            </h3>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {showPreview ? 'Ocultar detalles' : 'Ver detalles'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-700">Combinaciones A×B</p>
              <p className="text-blue-900 text-lg font-semibold">
                {totalCombinations}
                <span className="text-xs font-normal text-gray-500 ml-1">
                  ({lifeContexts.length} × {productWords.length})
                </span>
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-700">Total queries</p>
              <p className="text-blue-900 text-lg font-semibold">{totalQueries}</p>
              <p className="text-xs text-gray-500">
                {baseQueries} base{indicatorQueries > 0 && ` + ${indicatorQueries} indicadores`}
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-700">Fuentes ({sourcesCount})</p>
              <ul className="text-blue-900 text-xs">
                {sources.reddit && <li>• Reddit</li>}
                {sources.thematic_forums && suggestedThematicForums.size > 0 && (
                  <li>• {suggestedThematicForums.size} foros temáticos</li>
                )}
                {sources.general_forums.length > 0 && (
                  <li>• {sources.general_forums.length} foros generales</li>
                )}
              </ul>
            </div>
            <div>
              <p className="font-medium text-gray-700">Coste estimado</p>
              <p className="text-blue-900 text-xl font-bold">
                ${costEstimate?.total.toFixed(2) || '---'}
              </p>
            </div>
          </div>

          {/* Desglose visual de queries */}
          <div className="mt-4 p-3 bg-white/70 rounded-lg border border-blue-100">
            <p className="text-xs font-medium text-gray-600 mb-2">📊 Desglose de queries:</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                {totalCombinations} combinaciones × {sourcesCount} fuentes = {baseQueries} queries base
              </span>
              {indicatorQueries > 0 && (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">
                  + {selectedIndicators.length} indicadores × {baseQueries} = {indicatorQueries} queries extra
                </span>
              )}
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-semibold">
                = {totalQueries} queries totales
              </span>
            </div>
          </div>

          {/* Query examples */}
          {showPreview && (
            <div className="mt-4 p-4 bg-white/60 rounded-lg">
              <p className="text-xs font-medium text-gray-600 mb-2">Ejemplo de queries que se ejecutarán:</p>
              <div className="space-y-2">
                {sampleQueries.map((query, idx) => (
                  <code key={idx} className="block text-xs text-gray-700 bg-white/80 p-2 rounded">
                    {query}
                  </code>
                ))}
              </div>
              {selectedIndicators.length > 0 && (
                <p className="mt-3 text-xs text-gray-500">
                  <strong>Indicadores seleccionados:</strong> {selectedIndicators.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Execution Status */}
      {isExecuting && (
        <div className="bg-white border border-blue-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Loader2 size={24} className="animate-spin text-blue-600" />
              <div>
                <p className="font-semibold text-gray-900">{phaseInfo.label}</p>
                {jobStatus && (
                  <p className="text-sm text-gray-500">
                    URLs: {jobStatus.urls_scraped}/{jobStatus.urls_found} scrapeadas |
                    Nichos: {jobStatus.niches_extracted}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${phaseInfo.progress}%` }}
            />
          </div>

          {/* Phase indicators */}
          <div className="grid grid-cols-7 gap-1 mt-4 text-xs text-gray-500">
            <span className={`text-center ${['serp_running', 'serp_done'].includes(executionPhase) ? 'text-blue-600 font-medium' : ''}`}>
              SERP
            </span>
            <span className={`text-center ${['scraping', 'scrape_done'].includes(executionPhase) ? 'text-blue-600 font-medium' : ''}`}>
              Scraping
            </span>
            <span className={`text-center ${['extracting', 'extract_done'].includes(executionPhase) ? 'text-blue-600 font-medium' : ''}`}>
              Extracción
            </span>
            <span className={`text-center ${executionPhase === 'analyzing_1' ? 'text-blue-600 font-medium' : ''}`}>
              Step 1
            </span>
            <span className={`text-center ${executionPhase === 'analyzing_2' ? 'text-blue-600 font-medium' : ''}`}>
              Step 2
            </span>
            <span className={`text-center ${executionPhase === 'analyzing_3' ? 'text-blue-600 font-medium' : ''}`}>
              Step 3
            </span>
            <span className={`text-center ${executionPhase === 'completed' ? 'text-green-600 font-medium' : ''}`}>
              ✓
            </span>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-5">
        <div>
          {costEstimate ? (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">
                <strong className="text-gray-900">${costEstimate.serp.toFixed(3)}</strong> SERP
              </span>
              <span className="text-gray-600">
                <strong className="text-gray-900">${costEstimate.firecrawl.toFixed(3)}</strong> Scraping
              </span>
              <span className="text-gray-600">
                <strong className="text-gray-900">${costEstimate.llm.toFixed(3)}</strong> LLM
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Configura las combinaciones para ver el coste estimado
            </p>
          )}
        </div>

        <button
          onClick={startExecution}
          disabled={isExecuting || lifeContexts.length === 0 || productWords.length === 0}
          className="px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-700 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 font-semibold shadow-lg shadow-orange-200"
        >
          {isExecuting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Ejecutando...
            </>
          ) : (
            <>
              <Play size={20} />
              Iniciar Búsqueda
            </>
          )}
        </button>
      </div>
    </div>
  )
}
