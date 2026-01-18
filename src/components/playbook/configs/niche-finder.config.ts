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

    // =========================================
    // FASE 2: BÚSQUEDA & SCRAPING
    // =========================================
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
          id: 'review_urls',
          name: 'Revisar URLs',
          description: 'Revisa y filtra las URLs encontradas antes de scrapear',
          type: 'auto_with_review',
          executor: 'none',
          dependsOn: ['serp_search'],
        },
        {
          id: 'scrape',
          name: 'Scrapear Contenido',
          description: 'Descarga el contenido de las URLs validadas',
          type: 'auto',
          executor: 'job',
          jobType: 'niche_finder_scrape',
          dependsOn: ['review_urls'],
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
          dependsOn: ['scrape'],
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
