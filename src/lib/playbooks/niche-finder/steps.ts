export interface PlaybookStep {
  id: string
  name: string
  type: 'prompt' | 'search' | 'scrape' | 'human_approval'
  config: Record<string, unknown>
  requiresApproval?: boolean
}

// -- Steps --

const generateStrategyStep: PlaybookStep = {
  id: 'generate-strategy',
  name: 'Generar Estrategia de B\u00fasqueda',
  type: 'prompt',
  config: {
    endpoint: '/api/niche-finder/generate-strategy',
    model: 'openai/gpt-4o',
    description: 'Auto-genera palabras de contexto, palabras de necesidad y fuentes de b\u00fasqueda',
  },
}

const reviewStrategyStep: PlaybookStep = {
  id: 'review-strategy',
  name: 'Revisar Estrategia',
  type: 'human_approval',
  config: {
    approvalPrompt: 'Revisa las palabras generadas y las fuentes. Puedes a\u00f1adir/quitar chips antes de aprobar.',
    showPreviousOutput: true,
  },
  requiresApproval: true,
}

const serpSearchStep: PlaybookStep = {
  id: 'serp-search',
  name: 'Buscar en SERP',
  type: 'search',
  config: {
    endpoint: '/api/niche-finder/jobs/{jobId}/serp',
    description: 'Ejecuta combinaciones A\u00d7B en Google via Serper',
  },
}

const scrapeUrlsStep: PlaybookStep = {
  id: 'scrape-urls',
  name: 'Scrapear Contenido',
  type: 'scrape',
  config: {
    endpoint: '/api/niche-finder/jobs/{jobId}/scrape',
    description: 'Extrae contenido de URLs encontradas via Firecrawl',
  },
}

const reviewUrlsStep: PlaybookStep = {
  id: 'review-urls',
  name: 'Seleccionar URLs',
  type: 'human_approval',
  config: {
    approvalPrompt: 'Selecciona las URLs relevantes para analizar. Descarta las irrelevantes.',
    endpoint: '/api/niche-finder/jobs/{jobId}/urls/selection',
  },
  requiresApproval: true,
}

const extractProblemsStep: PlaybookStep = {
  id: 'extract-problems',
  name: 'Extraer Problemas',
  type: 'prompt',
  config: {
    endpoint: '/api/niche-finder/jobs/{jobId}/extract',
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    description: 'Extrae pain points y nichos de cada URL usando JTBD framework',
  },
}

const cleanFilterStep: PlaybookStep = {
  id: 'clean-filter',
  name: 'Limpiar y Filtrar',
  type: 'prompt',
  config: {
    model: 'openai/gpt-4o-mini',
    temperature: 0.5,
    description: 'Deduplica y filtra a 30-50 nichos v\u00e1lidos',
  },
}

const scoringStep: PlaybookStep = {
  id: 'scoring',
  name: 'Scoring de Nichos',
  type: 'prompt',
  config: {
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.8,
    useWebSearch: true,
    description: 'Punt\u00faa Pain Score, Market Size, Reachability con Deep Research',
  },
}

const consolidateStep: PlaybookStep = {
  id: 'consolidate',
  name: 'Tabla Final',
  type: 'prompt',
  config: {
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    description: 'Consolida en tabla final con todas las m\u00e9tricas',
  },
}

const viewResultsStep: PlaybookStep = {
  id: 'view-results',
  name: 'Ver Resultados',
  type: 'human_approval',
  config: {
    approvalPrompt: 'Revisa la tabla final de nichos con scoring.',
    showPreviousOutput: true,
  },
  requiresApproval: true,
}

// -- Exports (mirror Sancho pattern) --

export const ALL_STEPS: PlaybookStep[] = [
  generateStrategyStep,
  reviewStrategyStep,
  serpSearchStep,
  scrapeUrlsStep,
  extractProblemsStep,
  cleanFilterStep,
  scoringStep,
  consolidateStep,
  viewResultsStep,
]

export const STEP_PHASES: Record<string, string[]> = {
  'setup': ['generate-strategy'],
  'strategy-review': ['review-strategy'],
  'search': ['serp-search', 'scrape-urls'],
}

export const STEP_DEPENDENCIES: Record<string, string[]> = {
  'review-strategy': ['generate-strategy'],
  'serp-search': ['review-strategy'],
  'scrape-urls': ['serp-search'],
  'extract-problems': ['scrape-urls'],
  'clean-filter': ['extract-problems'],
  'scoring': ['clean-filter'],
  'consolidate': ['clean-filter', 'scoring'],
  'view-results': ['consolidate'],
}

export function getTotalStepCount(): number {
  return ALL_STEPS.length
}
