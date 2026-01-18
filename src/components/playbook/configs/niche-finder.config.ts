import { PlaybookConfig } from '../types'

/**
 * Niche Finder Playbook Configuration
 *
 * This playbook helps users find market niches by analyzing real conversations
 * in forums and social networks. It combines life contexts with product words
 * to discover pain points and opportunities.
 *
 * The flow is designed for maximum automation with minimal user decisions:
 * - System generates suggestions, user selects/edits
 * - Auto-execute steps where possible
 * - Only pause for critical decisions (final niche selection)
 */
export const nicheFinderConfig: PlaybookConfig = {
  id: 'niche_finder',
  type: 'niche_finder',
  name: 'Buscador de Nichos 100x',
  description: 'Encuentra nichos de mercado analizando conversaciones reales en foros y redes sociales',
  icon: '🔍',

  phases: [
    // Phase 1: Configuration
    {
      id: 'configuration',
      name: 'Configuración',
      description: 'Define el producto y contexto de búsqueda',
      steps: [
        {
          id: 'context_type',
          name: 'Tipo de Cliente',
          description: 'Define si buscas nichos B2C (personal), B2B (empresas) o ambos',
          type: 'decision',
          executor: 'none',
          decisionConfig: {
            question: '¿Qué tipo de clientes quieres encontrar?',
            optionsFrom: 'fixed',
            fixedOptions: [
              { id: 'personal', label: '🏠 B2C (Personal)', description: 'Situaciones de vida personal: pareja, hijos, jubilación...' },
              { id: 'business', label: '🏢 B2B (Empresas)', description: 'Situaciones de negocio: startup, freelance, pyme...' },
              { id: 'both', label: '🔄 Ambos', description: 'Buscar situaciones de vida personal Y de negocio' },
            ],
            defaultSelection: 'both',
          },
        },
        {
          id: 'life_contexts',
          name: 'Contextos de Vida',
          description: 'Situaciones donde está tu cliente potencial',
          type: 'suggestion',
          executor: 'llm',
          promptKey: 'suggest_life_contexts',
          suggestionConfig: {
            generateFrom: 'project',
            allowAdd: true,
            allowEdit: true,
            minSelections: 1,
          },
        },
        {
          id: 'product_words',
          name: 'Palabras de Producto',
          description: 'Necesidades que cubre tu producto/servicio',
          type: 'suggestion',
          executor: 'llm',
          promptKey: 'suggest_product_words',
          dependsOn: ['life_contexts'],
          suggestionConfig: {
            generateFrom: 'project',
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
          dependsOn: ['life_contexts', 'product_words'],
        },
      ],
    },

    // Phase 2: Search
    {
      id: 'search',
      name: 'Búsqueda',
      description: 'Busca y recopila contenido relevante',
      steps: [
        {
          id: 'serp_search',
          name: 'Buscar URLs (SERP)',
          description: 'Ejecuta búsquedas en Google para encontrar URLs relevantes',
          type: 'auto',
          executor: 'job',
          jobType: 'niche_finder_serp',
          dependsOn: ['sources'],
        },
        {
          id: 'validate_urls',
          name: 'Validar URLs',
          description: 'Revisa y filtra las URLs encontradas',
          type: 'auto_with_review',
          executor: 'none',
          dependsOn: ['serp_search'],
        },
      ],
    },

    // Phase 3: Extraction
    {
      id: 'extraction',
      name: 'Extracción',
      description: 'Scrapea y extrae nichos del contenido',
      steps: [
        {
          id: 'scrape_content',
          name: 'Scrapear Contenido',
          description: 'Descarga el contenido de las URLs validadas',
          type: 'auto',
          executor: 'job',
          jobType: 'niche_finder_scrape',
          dependsOn: ['validate_urls'],
        },
        {
          id: 'extract_niches',
          name: 'Extraer Nichos',
          description: 'Identifica nichos potenciales en el contenido',
          type: 'auto',
          executor: 'job',
          jobType: 'niche_finder_extract',
          dependsOn: ['scrape_content'],
        },
      ],
    },

    // Phase 4: Analysis
    {
      id: 'analysis',
      name: 'Análisis',
      description: 'Evalúa y prioriza los nichos encontrados',
      steps: [
        {
          id: 'clean_filter',
          name: 'Limpieza y Filtrado',
          description: 'Step 1: Limpia duplicados y filtra nichos de baja calidad',
          type: 'auto',
          executor: 'llm',
          promptKey: 'niche_finder_step1',
          dependsOn: ['extract_niches'],
        },
        {
          id: 'deep_scoring',
          name: 'Scoring (Deep Research)',
          description: 'Step 2: Evalúa viabilidad con investigación profunda',
          type: 'auto',
          executor: 'llm',
          promptKey: 'niche_finder_step2',
          dependsOn: ['clean_filter'],
        },
        {
          id: 'final_ranking',
          name: 'Ranking Final',
          description: 'Step 3: Consolida y genera tabla final de nichos',
          type: 'auto_with_review',
          executor: 'llm',
          promptKey: 'niche_finder_step3',
          dependsOn: ['deep_scoring'],
        },
      ],
    },

    // Phase 5: Results
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
          dependsOn: ['final_ranking'],
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
      key: 'serp_pages',
      label: 'Páginas SERP por query',
      type: 'number',
      required: false,
      defaultValue: 5,
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
