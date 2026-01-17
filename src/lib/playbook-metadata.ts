/**
 * Playbook Metadata
 * Información enriquecida sobre cada playbook para mostrar en la UI
 */

export interface PlaybookMeta {
  purpose: string
  whenToUse: string[]
  outcome: string
  relatedPlaybooks: string[]
  targetAudience?: string
  steps: Record<string, string>
}

export const playbookMetadata: Record<string, PlaybookMeta> = {
  niche_finder: {
    purpose: 'Descubre nichos de mercado rentables analizando foros, Reddit y búsquedas de Google.',
    whenToUse: [
      'Lanzar un nuevo producto y no sabes a quién venderle',
      'Encontrar audiencias no saturadas',
      'Validar si hay demanda real antes de invertir',
    ],
    outcome: 'Lista priorizada de nichos con pain points, tamaño de mercado y facilidad de alcance.',
    relatedPlaybooks: ['ecp', 'competitor_analysis'],
    targetAudience: 'Fundadores, product managers, growth marketers',
    steps: {
      suggest_niches: 'IA genera combinaciones de contextos × producto',
      serp_analysis: 'Busca URLs relevantes en Google y Reddit',
      scrape_sources: 'Extrae el contenido de cada URL encontrada',
      extract_insights: 'Identifica nichos y pain points con IA',
      analyze_results: 'Puntúa y prioriza los nichos encontrados',
    },
  },
  ecp: {
    purpose: 'Define el posicionamiento único de tu producto usando el framework ECP (Earned, Credibility, Proof).',
    whenToUse: [
      'Lanzar un nuevo producto al mercado',
      'Reposicionar un producto existente',
      'Crear messaging diferenciado de la competencia',
    ],
    outcome: 'Assets de marketing con posicionamiento claro y diferenciado.',
    relatedPlaybooks: ['niche_finder', 'competitor_analysis'],
    targetAudience: 'Marketers, brand managers, fundadores',
    steps: {
      deep_research: 'Investiga mercado, competencia y audiencia',
      find_place: 'Encuentra tu posicionamiento único',
      select_assets: 'Selecciona qué assets crear',
      proof_legit: 'Recopila pruebas y testimonios',
      final_output: 'Genera los assets finales',
    },
  },
  competitor_analysis: {
    purpose: 'Analiza a fondo a tus competidores para encontrar oportunidades de diferenciación.',
    whenToUse: [
      'Entrar a un mercado con competidores establecidos',
      'Entender por qué los clientes eligen a otros',
      'Encontrar gaps en el mercado',
    ],
    outcome: 'Matriz comparativa y recomendaciones estratégicas de posicionamiento.',
    relatedPlaybooks: ['ecp', 'niche_finder'],
    targetAudience: 'Estrategas, product managers, fundadores',
    steps: {
      identify_competitors: 'Lista los competidores principales',
      analyze_positioning: 'Analiza cómo se posiciona cada uno',
      compare_features: 'Compara precios, features y propuestas',
      find_gaps: 'Identifica oportunidades no cubiertas',
      recommendations: 'Genera estrategia de diferenciación',
    },
  },
}

/**
 * Obtiene el nombre legible de un playbook
 */
export const getPlaybookName = (type: string): string => {
  const names: Record<string, string> = {
    niche_finder: 'Niche Finder',
    ecp: 'ECP Positioning',
    competitor_analysis: 'Competitor Analysis',
  }
  return names[type] || type
}

/**
 * Formatea el nombre de un paso de snake_case a Title Case
 */
export const formatStepName = (step: string): string => {
  return step
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}
