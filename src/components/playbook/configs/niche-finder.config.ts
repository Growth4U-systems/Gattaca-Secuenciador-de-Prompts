import { PlaybookConfig } from '../types'

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
 */

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
    // =========================================
    {
      id: 'configuration',
      name: 'Configuración',
      description: 'Define el producto y contexto de búsqueda',
      steps: [
        // context_type is configured in Campaign Wizard (variables section below)
        // No need for a separate step - value comes from campaign's custom_variables
        {
          id: 'life_contexts',
          name: 'Contextos de Búsqueda',
          description: 'Palabras clave que describen a tu cliente potencial. Se combinan con las palabras de necesidad para formar queries de búsqueda.',
          type: 'suggestion',
          executor: 'none', // No LLM, fixed lists
          // No dependsOn - context_type comes from campaign config, not a previous step
          suggestionConfig: {
            generateFrom: 'fixed',
            fixedOptionsKey: 'life_contexts', // Will load B2C_CONTEXTS and/or B2B_CONTEXTS based on context_type
            allowAdd: true,
            allowEdit: false,
            minSelections: 1,
          },
        },
        {
          id: 'need_words',
          name: 'Palabras de Necesidad',
          description: 'Palabras que representan las necesidades que tu producto resuelve',
          type: 'suggestion',
          executor: 'llm',
          promptKey: 'suggest_need_words',
          dependsOn: ['life_contexts'],
          suggestionConfig: {
            generateFrom: 'llm',
            allowAdd: true,
            allowEdit: true,
            minSelections: 1,
          },
        },
        {
          id: 'indicators',
          name: 'Indicadores de Problema',
          description: 'Palabras que indican frustración o necesidad de ayuda',
          type: 'suggestion',
          executor: 'none',
          suggestionConfig: {
            generateFrom: 'api',
            apiEndpoint: '/api/niche-finder/indicators',
            allowAdd: true,
            allowEdit: false,
            minSelections: 0,
          },
        },
        {
          id: 'sources',
          name: 'Fuentes de Datos',
          description: 'Configura Reddit, foros temáticos y generales',
          type: 'auto_with_preview',
          executor: 'llm',
          promptKey: 'suggest_forums',
          dependsOn: ['life_contexts', 'need_words'],
        },
      ],
    },

    // =========================================
    // FASE 2: BÚSQUEDA & SCRAPING
    // Simplificado a 2 pasos claros y accionables
    // =========================================
    {
      id: 'search',
      name: 'Búsqueda',
      description: 'Busca y recopila contenido relevante',
      steps: [
        {
          id: 'search_and_preview',
          name: 'Buscar URLs',
          description: 'Ejecuta la búsqueda en Google para encontrar URLs relevantes',
          type: 'search_with_preview', // Preview queries + execute SERP + show summary
          executor: 'job',
          jobType: 'niche_finder_serp',
          dependsOn: ['sources'],
        },
        {
          id: 'review_and_scrape',
          name: 'Revisar y Scrapear',
          description: 'Revisa las URLs por fuente, selecciona cuáles incluir y descarga el contenido',
          type: 'review_with_action', // Review URLs + select sources + execute scraping
          executor: 'job',
          jobType: 'niche_finder_scrape',
          dependsOn: ['search_and_preview'],
        },
        {
          id: 'scrape_results',
          name: 'Resultados del Scraping',
          description: 'Revisa el contenido scrapeado y selecciona qué URLs analizar',
          type: 'display_scrape_results',
          executor: 'none',
          dependsOn: ['review_and_scrape'],
        },
      ],
    },

    // =========================================
    // FASE 3: EXTRACCIÓN
    // =========================================
    {
      id: 'extraction',
      name: 'Extracción',
      description: 'Analiza cada URL y extrae pain points',
      steps: [
        {
          id: 'extract_problems',
          name: 'Extraer Problemas (Step 1)',
          description: 'Analiza cada markdown del scraping y extrae pain points como CSV',
          type: 'auto',
          executor: 'job', // Procesa URL por URL
          jobType: 'niche_finder_extract',
          promptKey: 'step_1_find_problems',
          dependsOn: ['scrape_results'],
          executionExplanation: {
            title: 'Extracción de Problemas',
            steps: [
              'Lee el contenido de cada página scrapeada',
              'Identifica quejas, frustraciones y necesidades',
              'Extrae problema, contexto y evidencia textual',
              'Genera tabla CSV con todos los pain points',
            ],
            estimatedCost: 'Variable según contenido',
            costService: 'OpenAI API',
          },
        },
        {
          id: 'review_extraction',
          name: 'Revisar Extracción',
          description: 'Revisa la tabla raw de problemas extraídos de todas las URLs',
          type: 'auto_with_review',
          executor: 'none',
          dependsOn: ['extract_problems'],
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
          dependsOn: ['review_extraction'],
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
          type: 'manual_research', // Nuevo tipo de paso
          executor: 'none',
          promptKey: 'step_3_scoring', // El prompt que el usuario debe copiar
          dependsOn: ['clean_filter'],
        },
        {
          id: 'consolidate',
          name: 'Consolidar Tabla Final (Step 4)',
          description: 'Combina tabla filtrada con resultados del Deep Research',
          type: 'auto_with_review',
          executor: 'llm',
          promptKey: 'step_4_consolidate',
          dependsOn: ['deep_research_manual'],
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
        },
        {
          id: 'export',
          name: 'Exportar',
          description: 'Descarga los resultados en diferentes formatos',
          type: 'action',
          executor: 'none',
          dependsOn: ['dashboard'],
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
