import { PlaybookConfig, StepGuidance } from '../types'

/**
 * Niche Finder Playbook Configuration
 *
 * This playbook helps users find market niches by analyzing real conversations
 * in forums and social networks. It combines life contexts with product words
 * to discover pain points and opportunities.
 *
 * Flow:
 * 1. CONFIGURACIÓN: Define cliente, contextos, palabras de producto, fuentes
 * 2. BÚSQUEDA: SERP search + scraping de URLs
 * 3. EXTRACCIÓN: Step 1 - Extraer problemas de cada URL (LLM)
 * 4. ANÁLISIS:
 *    - Step 2: Clean & Filter - Consolida a 30-50 nichos
 *    - Deep Research MANUAL - Usuario hace research con ChatGPT/Perplexity
 *    - Step 4: Consolidate - Combina tabla con scores
 * 5. RESULTADOS: Selección, dashboard, exportación
 *
 * Architecture Notes (US-013):
 * - Uses session-based persistence via useStepPersistence hook
 * - Integrates PlaybookWizardNav for horizontal step navigation
 * - Each step uses PlaybookStepContainer with guidance configuration
 * - Context Lake integration available at each step
 * - Historical data from niche_finder_jobs remains accessible
 */

/**
 * Step Guidance Configurations
 * These provide clear instructions to users at each step
 */
const STEP_GUIDANCE: Record<string, StepGuidance> = {
  keyword_config: {
    description: 'Configure los parámetros de búsqueda: contextos de vida, palabras de necesidad, indicadores de urgencia y fuentes de datos.',
    userActions: [
      'Seleccione al menos un contexto de vida (B2C/B2B)',
      'Agregue palabras de necesidad relacionadas con su producto',
      'Configure indicadores de urgencia opcionales',
      'Seleccione las fuentes de datos (Reddit, foros)',
    ],
    completionCriteria: {
      description: 'Seleccione al menos un contexto y una palabra de necesidad',
      type: 'custom',
      customValidator: 'hasKeywordConfig',
    },
  },
  search_scrape_extract: {
    description: 'Este paso automatizado busca conversaciones relevantes, descarga su contenido y extrae problemas usando IA.',
    userActions: [
      'Revise la configuración de búsqueda y el costo estimado',
      'Inicie la búsqueda cuando esté listo',
      'Seleccione las fuentes a analizar después del SERP',
      'Configure el prompt de extracción si desea personalizarlo',
    ],
    completionCriteria: {
      description: 'La extracción debe completarse con resultados',
      type: 'auto_complete',
    },
  },
  clean_filter: {
    description: 'La IA consolida duplicados, valida problemas y genera una tabla de 30-50 nichos únicos.',
    userActions: [
      'Revise los resultados de la extracción anterior',
      'Ejecute el análisis de limpieza y filtrado',
      'Revise la tabla consolidada de nichos',
    ],
    completionCriteria: {
      description: 'El análisis debe completarse exitosamente',
      type: 'auto_complete',
    },
  },
  deep_research_manual: {
    description: 'Realice investigación profunda de cada nicho usando ChatGPT o Perplexity y pegue los resultados.',
    userActions: [
      'Copie el prompt de investigación proporcionado',
      'Ejecute el prompt en ChatGPT o Perplexity',
      'Pegue los resultados de su investigación',
      'Repita para cada nicho importante',
    ],
    completionCriteria: {
      description: 'Pegue los resultados de su deep research',
      type: 'input_required',
      minCount: 50,
    },
  },
  consolidate: {
    description: 'La IA combina la tabla filtrada con su Deep Research para generar scores de oportunidad.',
    userActions: [
      'Revise que el deep research esté completo',
      'Ejecute la consolidación final',
      'Revise los scores y métricas de cada nicho',
    ],
    completionCriteria: {
      description: 'La consolidación debe completarse exitosamente',
      type: 'auto_complete',
    },
  },
  select_niches: {
    description: 'Seleccione los nichos que desea explorar en detalle.',
    userActions: [
      'Revise los scores de oportunidad de cada nicho',
      'Seleccione al menos un nicho para explorar',
      'Puede seleccionar múltiples nichos',
    ],
    completionCriteria: {
      description: 'Seleccione al menos un nicho',
      type: 'selection_required',
      minCount: 1,
    },
  },
  dashboard: {
    description: 'Visualice los resultados de su análisis en el dashboard interactivo.',
    userActions: [
      'Explore los nichos seleccionados',
      'Analice las métricas y evidencias',
      'Identifique oportunidades de mercado',
    ],
    completionCriteria: {
      description: 'Continue cuando haya revisado el dashboard',
      type: 'manual',
    },
  },
  export: {
    description: 'Descargue los resultados en el formato que prefiera.',
    userActions: [
      'Seleccione el formato de exportación (CSV, JSON, PDF)',
      'Descargue los resultados',
      'Guarde en Context Lake si desea',
    ],
    completionCriteria: {
      description: 'Exporte o guarde sus resultados',
      type: 'manual',
    },
  },
}

/**
 * Predefined life contexts for B2C (personal situations)
 * Short keywords for search queries - combined with need words
 */
export const B2C_CONTEXTS = [
  // Familia
  { id: 'padres', label: 'padres', category: 'Familia', contextType: 'b2c' as const },
  { id: 'hijo', label: 'hijo', category: 'Familia', contextType: 'b2c' as const },
  { id: 'pareja', label: 'pareja', category: 'Familia', contextType: 'b2c' as const },
  { id: 'divorciado', label: 'divorciado', category: 'Familia', contextType: 'b2c' as const },
  { id: 'viudo', label: 'viudo', category: 'Familia', contextType: 'b2c' as const },
  { id: 'abuelos', label: 'abuelos', category: 'Familia', contextType: 'b2c' as const },

  // Social
  { id: 'amigos', label: 'amigos', category: 'Social', contextType: 'b2c' as const },
  { id: 'companeros', label: 'compañeros', category: 'Social', contextType: 'b2c' as const },
  { id: 'roommates', label: 'roommates', category: 'Social', contextType: 'b2c' as const },

  // Etapa vital
  { id: 'estudiante', label: 'estudiante', category: 'Etapa vital', contextType: 'b2c' as const },
  { id: 'jubilado', label: 'jubilado', category: 'Etapa vital', contextType: 'b2c' as const },
  { id: 'recien_casado', label: 'recién casado', category: 'Etapa vital', contextType: 'b2c' as const },

  // Situaciones
  { id: 'viaje', label: 'viaje', category: 'Situaciones', contextType: 'b2c' as const },
  { id: 'intercambio', label: 'intercambio', category: 'Situaciones', contextType: 'b2c' as const },
  { id: 'mudanza', label: 'mudanza', category: 'Situaciones', contextType: 'b2c' as const },
  { id: 'expatriado', label: 'expatriado', category: 'Situaciones', contextType: 'b2c' as const },

  // Empleo
  { id: 'primer_empleo', label: 'primer empleo', category: 'Empleo', contextType: 'b2c' as const },
  { id: 'gerente', label: 'gerente', category: 'Empleo', contextType: 'b2c' as const },
  { id: 'director', label: 'director', category: 'Empleo', contextType: 'b2c' as const },
  { id: 'equipo', label: 'equipo', category: 'Empleo', contextType: 'b2c' as const },
  { id: 'dueno', label: 'dueño', category: 'Empleo', contextType: 'b2c' as const },
  { id: 'jefe', label: 'jefe', category: 'Empleo', contextType: 'b2c' as const },
  { id: 'empleado', label: 'empleado', category: 'Empleo', contextType: 'b2c' as const },
  { id: 'ascenso', label: 'ascenso', category: 'Empleo', contextType: 'b2c' as const },
]

/**
 * Predefined business contexts for B2B
 * Short keywords for search queries - combined with need words
 */
export const B2B_CONTEXTS = [
  // Tipo de negocio
  { id: 'freelancer', label: 'freelancer', category: 'Tipo', contextType: 'b2b' as const },
  { id: 'autonomo', label: 'autónomo', category: 'Tipo', contextType: 'b2b' as const },
  { id: 'pyme', label: 'PYME', category: 'Tipo', contextType: 'b2b' as const },
  { id: 'startup', label: 'startup', category: 'Tipo', contextType: 'b2b' as const },
  { id: 'empresa_familiar', label: 'empresa familiar', category: 'Tipo', contextType: 'b2b' as const },
  { id: 'agencia', label: 'agencia', category: 'Tipo', contextType: 'b2b' as const },

  // Mercado
  { id: 'exportador', label: 'exportador', category: 'Mercado', contextType: 'b2b' as const },
  { id: 'importador', label: 'importador', category: 'Mercado', contextType: 'b2b' as const },
  { id: 'ecommerce', label: 'e-commerce', category: 'Mercado', contextType: 'b2b' as const },
  { id: 'saas', label: 'SaaS', category: 'Mercado', contextType: 'b2b' as const },

  // Etapa
  { id: 'expansion', label: 'expansión', category: 'Etapa', contextType: 'b2b' as const },
  { id: 'inversion', label: 'inversión', category: 'Etapa', contextType: 'b2b' as const },
  { id: 'internacionalizacion', label: 'internacionalización', category: 'Etapa', contextType: 'b2b' as const },

  // Equipo
  { id: 'socio', label: 'socio', category: 'Equipo', contextType: 'b2b' as const },
  { id: 'empleados', label: 'empleados', category: 'Equipo', contextType: 'b2b' as const },
  { id: 'remoto', label: 'remoto', category: 'Equipo', contextType: 'b2b' as const },
]
export const nicheFinderConfig: PlaybookConfig = {
  id: 'niche_finder',
  type: 'niche_finder',
  name: 'Buscador de Nichos 100x',
  description: 'Encuentra nichos de mercado analizando conversaciones reales en foros y redes sociales',
  icon: '🔍',

  phases: [
    // =========================================
    // FASE 1: CONFIGURACIÓN
    // Panel unificado con palabras clave y fuentes
    // =========================================
    {
      id: 'configuration',
      name: 'Configuración',
      description: 'Define palabras clave y fuentes de búsqueda',
      steps: [
        {
          id: 'keyword_config',
          name: 'Configurar Búsqueda',
          description: 'Configura contextos, palabras de necesidad, indicadores y fuentes de datos en un solo lugar.',
          type: 'unified_keyword_config',
          executor: 'llm',
          promptKey: 'suggest_need_words',
          guidance: STEP_GUIDANCE.keyword_config,
        },
      ],
    },

    // =========================================
    // FASE 2: BÚSQUEDA & SCRAPING
    // Simplificado a 2 pasos claros y accionables
    // =========================================
    {
      id: 'search',
      name: 'Búsqueda y Extracción',
      description: 'Busca conversaciones, descarga contenido y extrae problemas',
      steps: [
        {
          id: 'search_scrape_extract',
          name: 'Buscar y Analizar',
          description: 'Busca conversaciones, descarga su contenido y extrae problemas automáticamente',
          type: 'unified_search_extract',
          executor: 'job',
          jobType: 'niche_finder_unified',
          dependsOn: ['keyword_config'],
          guidance: STEP_GUIDANCE.search_scrape_extract,
          executionExplanation: {
            title: 'Búsqueda y Extracción Unificada',
            steps: [
              'Busca conversaciones relevantes en foros y Reddit',
              'Descarga el contenido de cada URL encontrada',
              'Analiza el contenido con IA para extraer problemas',
              'Genera tabla con todos los pain points identificados',
            ],
            estimatedCost: 'Variable según URLs',
            costService: 'SERP API + Firecrawl + OpenAI',
          },
        },
      ],
    },

    // =========================================
    // FASE 4: ANÁLISIS
    // =========================================
    {
      id: 'analysis',
      name: 'Análisis',
      description: 'Limpia, evalúa y prioriza los nichos',
      steps: [
        {
          id: 'clean_filter',
          name: 'Limpiar y Filtrar (Step 2)',
          description: 'Consolida duplicados, valida y genera tabla de 30-50 nichos',
          type: 'auto_with_review',
          executor: 'llm',
          promptKey: 'step_2_clean_filter',
          dependsOn: ['search_scrape_extract'],
          guidance: STEP_GUIDANCE.clean_filter,
          executionExplanation: {
            title: 'Limpieza y Filtrado',
            steps: [
              'Agrupa problemas similares o duplicados',
              'Valida que cada problema sea real y específico',
              'Filtra problemas genéricos o irrelevantes',
              'Genera tabla consolidada de 30-50 nichos únicos',
            ],
            estimatedCost: 'Fijo por ejecución',
            costService: 'OpenAI API',
          },
        },
        {
          id: 'deep_research_manual',
          name: 'Deep Research (Manual)',
          description: 'Haz Deep Research de cada nicho con ChatGPT/Perplexity y pega los resultados',
          type: 'manual_research',
          executor: 'none',
          promptKey: 'step_3_scoring',
          dependsOn: ['clean_filter'],
          guidance: STEP_GUIDANCE.deep_research_manual,
        },
        {
          id: 'consolidate',
          name: 'Consolidar Tabla Final (Step 4)',
          description: 'Combina tabla filtrada con resultados del Deep Research',
          type: 'auto_with_review',
          executor: 'llm',
          promptKey: 'step_4_consolidate',
          dependsOn: ['deep_research_manual'],
          guidance: STEP_GUIDANCE.consolidate,
          executionExplanation: {
            title: 'Consolidación Final',
            steps: [
              'Combina tabla filtrada con tu Deep Research',
              'Calcula scores de oportunidad por nicho',
              'Ordena nichos por potencial de mercado',
              'Genera tabla final con métricas comparativas',
            ],
            estimatedCost: 'Fijo por ejecución',
            costService: 'OpenAI API',
          },
        },
      ],
    },

    // =========================================
    // FASE 5: RESULTADOS
    // =========================================
    {
      id: 'results',
      name: 'Resultados',
      description: 'Visualiza y exporta los resultados',
      steps: [
        {
          id: 'select_niches',
          name: 'Seleccionar Nichos',
          description: 'Elige los nichos que quieres explorar',
          type: 'decision',
          executor: 'none',
          dependsOn: ['consolidate'],
          guidance: STEP_GUIDANCE.select_niches,
          decisionConfig: {
            question: '¿Qué nichos quieres seleccionar para explorar?',
            optionsFrom: 'previous_step',
            multiSelect: true,
            minSelections: 1,
          },
        },
        {
          id: 'dashboard',
          name: 'Dashboard',
          description: 'Visualiza los resultados en el dashboard interactivo',
          type: 'display',
          executor: 'none',
          dependsOn: ['select_niches'],
          guidance: STEP_GUIDANCE.dashboard,
        },
        {
          id: 'export',
          name: 'Exportar',
          description: 'Descarga los resultados en diferentes formatos',
          type: 'action',
          executor: 'none',
          dependsOn: ['dashboard'],
          guidance: STEP_GUIDANCE.export,
          actionConfig: {
            label: 'Exportar Resultados',
            actionType: 'export',
          },
        },
      ],
    },
  ],

  // Variables needed for this playbook
  variables: [
    {
      key: 'context_type',
      label: 'Tipo de Cliente',
      type: 'select',
      required: true,
      defaultValue: 'both',
      options: [
        { value: 'personal', label: 'B2C (Personal)' },
        { value: 'business', label: 'B2B (Empresas)' },
        { value: 'both', label: 'Ambos' },
      ],
    },
    {
      key: 'max_combinations',
      label: 'Máximo de combinaciones (queries)',
      type: 'number',
      required: false,
      defaultValue: 50,
      min: 10,
      max: 100,
    },
    {
      key: 'serp_pages',
      label: 'Páginas SERP por query',
      type: 'number',
      required: false,
      defaultValue: 3,
      min: 1,
      max: 5,
    },
    {
      key: 'batch_size',
      label: 'URLs en paralelo',
      type: 'number',
      required: false,
      defaultValue: 10,
    },
  ],
}

export default nicheFinderConfig
