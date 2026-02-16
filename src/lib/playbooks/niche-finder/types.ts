// Phase IDs - ordered progression
// Analysis and results are now handled by CampaignRunner (Campaigns tab)
export type PhaseId =
  | 'setup'
  | 'strategy-review'
  | 'search'

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
]

export const DEFAULT_PHASES: NicheFinderPhase[] = [
  { id: 'setup', name: 'Configuraci\u00f3n', description: 'Datos b\u00e1sicos y generaci\u00f3n de estrategia', status: 'pending', isCheckpoint: false },
  { id: 'strategy-review', name: 'Revisi\u00f3n de Estrategia', description: 'Revisar y ajustar palabras y fuentes', status: 'pending', isCheckpoint: true },
  { id: 'search', name: 'B\u00fasqueda', description: 'SERP + Scraping + Guardar docs', status: 'pending', isCheckpoint: false },
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
  status: 'pending' | 'running' | 'completed' | 'failed' | 'reviewing'
  progress?: { completed: number; total: number }
}
