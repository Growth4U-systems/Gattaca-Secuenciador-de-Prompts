// Phase IDs - ordered progression
export type PhaseId =
  | 'setup'
  | 'strategy-review'
  | 'search'
  | 'url-review'
  | 'analysis'
  | 'results'

export interface NicheFinderPhase {
  id: PhaseId
  name: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'error'
  isCheckpoint: boolean
}

export const PHASE_ORDER: PhaseId[] = [
  'setup',
  'strategy-review',
  'search',
  'url-review',
  'analysis',
  'results',
]

export const DEFAULT_PHASES: NicheFinderPhase[] = [
  { id: 'setup', name: 'Configuraci\u00f3n', description: 'Datos b\u00e1sicos y generaci\u00f3n de estrategia', status: 'pending', isCheckpoint: false },
  { id: 'strategy-review', name: 'Revisi\u00f3n de Estrategia', description: 'Revisar y ajustar palabras y fuentes', status: 'pending', isCheckpoint: true },
  { id: 'search', name: 'B\u00fasqueda', description: 'SERP + Scraping de foros', status: 'pending', isCheckpoint: false },
  { id: 'url-review', name: 'Selecci\u00f3n de URLs', description: 'Elegir URLs relevantes para an\u00e1lisis', status: 'pending', isCheckpoint: true },
  { id: 'analysis', name: 'An\u00e1lisis', description: 'Extracci\u00f3n y scoring de nichos', status: 'pending', isCheckpoint: false },
  { id: 'results', name: 'Resultados', description: 'Tabla final de nichos', status: 'pending', isCheckpoint: true },
]

// Strategy types (auto-generated from LLM)
export interface StrategyWord {
  value: string
  category: string
  reason: string
}

export interface StrategySources {
  reddit: { enabled: boolean; subreddits: string[] }
  thematic_forums: Array<{ domain: string; reason: string }>
  general_forums: string[]
}

export interface GeneratedStrategy {
  company_info: {
    industry: string
    product_description: string
    target_audience: string
  }
  life_contexts: StrategyWord[]
  benefit_words: StrategyWord[]
  sources: StrategySources
  estimated_combinations: number
  estimated_cost: number
}

// Step progress within search/analysis phases
export interface StepProgress {
  stepId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress?: { completed: number; total: number }
}
