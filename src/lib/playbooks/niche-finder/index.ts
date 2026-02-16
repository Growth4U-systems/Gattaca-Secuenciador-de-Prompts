import { ALL_STEPS } from './steps'
import { INPUT_VARIABLES } from './variables'

export const nicheFinderPlaybook = {
  name: 'Buscador de Nichos',
  slug: 'niche-finder',
  description: `Encuentra nichos de mercado analizando conversaciones reales en foros.
Auto-genera estrategia de b\u00fasqueda desde el nombre de empresa.
3 checkpoints: estrategia, URLs, resultados.`,
  category: 'research' as const,
  steps: ALL_STEPS,
  inputVariables: INPUT_VARIABLES,
  isActive: true,
  isSystem: true,
}

export const PRESENTATION_CONFIG = {
  tagline: 'Descubre nichos ocultos analizando conversaciones reales en foros',
  valueProposition: [
    'Solo necesitas el nombre de la empresa',
    'Estrategia auto-generada con IA (palabras de contexto \u00d7 necesidad)',
    'B\u00fasqueda en Reddit y foros tem\u00e1ticos/generales',
    'Scoring multidimensional: Pain, Market Size, Reachability',
  ],
  estimatedTime: '15-30 minutos',
  estimatedCost: '~$1-5 USD (SERP + scraping + LLM)',
  stepStats: {
    total: 4, // Shell steps: generate-strategy, review-strategy, serp-search, scrape-urls
    setup: 1,
    checkpoints: 1,
    search: 2,
    // Analysis steps are now handled in Campaigns tab via CampaignRunner
  },
}

export { ALL_STEPS, STEP_PHASES, STEP_DEPENDENCIES } from './steps'
export { INPUT_VARIABLES, VARIABLE_GROUPS } from './variables'
export { DEFAULT_PHASES, PHASE_ORDER } from './types'
export type { PhaseId, NicheFinderPhase, GeneratedStrategy, StrategyWord, StrategySources, StepProgress } from './types'
