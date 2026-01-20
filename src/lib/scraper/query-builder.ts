/**
 * Query Builder for Niche Finder
 * Generates search queries from A×B combinations
 * Supports thematic searches (specific queries per forum topic)
 */

import type { ScraperStepConfig } from '@/types/scraper.types'

export interface SearchQuery {
  lifeContext: string
  productWord: string
  indicator?: string
  sourceType: 'reddit' | 'thematic_forum' | 'general_forum'
  sourceDomain?: string
  query: string
  isThematic?: boolean // True if query is specifically tailored for this forum's topic
}

/**
 * Thematic forum configuration
 * Maps forums to their relevant topics and keywords
 */
export interface ThematicForum {
  domain: string
  name: string
  topics: string[] // Topics this forum covers
  relatedContexts: string[] // Life contexts that match this forum
  searchKeywords?: string[] // Additional keywords to use when searching this forum
}

/**
 * Predefined thematic forums with their topics
 */
export const THEMATIC_FORUMS: ThematicForum[] = [
  {
    domain: 'bodas.net',
    name: 'Bodas.net',
    topics: ['bodas', 'matrimonio', 'boda'],
    relatedContexts: ['boda', 'casamiento', 'matrimonio', 'novios', 'novia', 'novio', 'wedding'],
    searchKeywords: ['organizar boda', 'presupuesto boda', 'proveedores boda', 'vestido novia'],
  },
  {
    domain: 'zankyou.es',
    name: 'Zankyou',
    topics: ['bodas', 'lista de bodas'],
    relatedContexts: ['boda', 'casamiento', 'matrimonio', 'novios'],
    searchKeywords: ['lista de bodas', 'regalos boda', 'viaje novios'],
  },
  {
    domain: 'bebesymas.com',
    name: 'Bebés y más',
    topics: ['bebés', 'embarazo', 'maternidad', 'crianza'],
    relatedContexts: ['bebé', 'bebés', 'hijos', 'niños', 'embarazo', 'maternidad', 'paternidad', 'familia'],
    searchKeywords: ['cuidado bebé', 'lactancia', 'pediatra', 'guardería'],
  },
  {
    domain: 'serpadres.es',
    name: 'Ser Padres',
    topics: ['crianza', 'educación', 'hijos'],
    relatedContexts: ['hijos', 'niños', 'adolescentes', 'familia', 'padres'],
    searchKeywords: ['educación hijos', 'adolescentes', 'colegio'],
  },
  {
    domain: 'enfemenino.com',
    name: 'Enfemenino',
    topics: ['familia', 'salud', 'maternidad', 'pareja'],
    relatedContexts: ['familia', 'pareja', 'maternidad', 'salud', 'divorcio', 'matrimonio'],
    searchKeywords: ['relación pareja', 'problemas familia'],
  },
  {
    domain: 'rankia.com',
    name: 'Rankia',
    topics: ['finanzas', 'inversión', 'hipotecas', 'fondos'],
    relatedContexts: ['inversión', 'ahorro', 'finanzas', 'dinero', 'hipoteca', 'jubilación', 'autónomo', 'empresa'],
    searchKeywords: ['invertir', 'ahorrar', 'hipoteca', 'impuestos autónomo', 'declaración renta'],
  },
  {
    domain: 'finect.com',
    name: 'Finect',
    topics: ['fondos', 'inversión'],
    relatedContexts: ['inversión', 'ahorro', 'finanzas', 'jubilación'],
    searchKeywords: ['fondos inversión', 'plan pensiones'],
  },
  {
    domain: 'idealista.com/foro',
    name: 'Foro Idealista',
    topics: ['inmobiliaria', 'alquiler', 'compra vivienda'],
    relatedContexts: ['vivienda', 'piso', 'alquiler', 'hipoteca', 'mudanza', 'comprar casa'],
    searchKeywords: ['alquilar piso', 'comprar casa', 'hipoteca', 'casero inquilino'],
  },
  {
    domain: 'fotocasa.es/foro',
    name: 'Foro Fotocasa',
    topics: ['inmobiliaria', 'alquiler'],
    relatedContexts: ['vivienda', 'piso', 'alquiler', 'hipoteca'],
    searchKeywords: ['buscar piso', 'alquiler'],
  },
  {
    domain: 'tripadvisor.es',
    name: 'TripAdvisor',
    topics: ['viajes', 'hoteles', 'restaurantes'],
    relatedContexts: ['vacaciones', 'viaje', 'turismo', 'hotel'],
    searchKeywords: ['opiniones hotel', 'recomendaciones viaje'],
  },
  {
    domain: 'losviajeros.com',
    name: 'Los Viajeros',
    topics: ['viajes', 'destinos'],
    relatedContexts: ['vacaciones', 'viaje', 'turismo'],
    searchKeywords: ['viajar a', 'consejos viaje'],
  },
  {
    domain: 'forocoches.com',
    name: 'Forocoches',
    topics: ['general', 'coches', 'tecnología', 'economía'],
    relatedContexts: ['coche', 'trabajo', 'empresa', 'autónomo', 'universidad', 'estudiante'],
    searchKeywords: [], // General forum, uses A×B directly
  },
  {
    domain: 'mediavida.com',
    name: 'Mediavida',
    topics: ['gaming', 'tecnología', 'general'],
    relatedContexts: ['universidad', 'estudiante', 'tecnología'],
    searchKeywords: [],
  },
  {
    domain: 'burbuja.info',
    name: 'Burbuja.info',
    topics: ['economía', 'inmobiliaria', 'política'],
    relatedContexts: ['vivienda', 'inversión', 'ahorro', 'hipoteca', 'trabajo', 'autónomo'],
    searchKeywords: ['crisis', 'burbuja', 'precios'],
  },
  {
    domain: 'domestika.org',
    name: 'Domestika',
    topics: ['diseño', 'creatividad', 'freelance'],
    relatedContexts: ['freelancer', 'autónomo', 'diseñador', 'creativo'],
    searchKeywords: ['freelance', 'cliente', 'presupuesto proyecto'],
  },
  {
    domain: 'infoautonomos.com',
    name: 'Infoautónomos',
    topics: ['autónomos', 'impuestos', 'facturación'],
    relatedContexts: ['autónomo', 'freelancer', 'empresa', 'negocio'],
    searchKeywords: ['cuota autónomo', 'factura', 'IVA', 'IRPF', 'alta autónomo'],
  },
]

/**
 * Find matching thematic forums for a life context
 */
export function findThematicForums(lifeContext: string): ThematicForum[] {
  const contextLower = lifeContext.toLowerCase()
  return THEMATIC_FORUMS.filter((forum) =>
    forum.relatedContexts.some(
      (ctx) => contextLower.includes(ctx.toLowerCase()) || ctx.toLowerCase().includes(contextLower)
    )
  )
}

/**
 * Generate all search queries from scraper config
 * Creates A × B × Sources combinations
 * For thematic forums, uses context-specific keywords
 */
export function generateSearchQueries(config: ScraperStepConfig): SearchQuery[] {
  const queries: SearchQuery[] = []

  const { life_contexts, product_words, indicators, sources } = config

  // Normalize sources to handle both formats:
  // - Old format: { reddit: boolean, thematic_forums: boolean, general_forums: string[] }
  // - LLM format: { reddit: { enabled, subreddits }, thematic_forums: { enabled, forums }, general_forums: { enabled, forums } }
  const isRedditEnabled = typeof sources.reddit === 'boolean'
    ? sources.reddit
    : (sources.reddit as unknown as { enabled?: boolean })?.enabled ?? false

  const isThematicEnabled = typeof sources.thematic_forums === 'boolean'
    ? sources.thematic_forums
    : (sources.thematic_forums as unknown as { enabled?: boolean })?.enabled ?? false

  // Generate all A × B combinations
  for (const lifeContext of life_contexts) {
    for (const productWord of product_words) {
      // Reddit searches (general)
      if (isRedditEnabled) {
        // Base query without indicator
        queries.push(createQuery(lifeContext, productWord, undefined, 'reddit', 'reddit.com'))

        // With indicators (optional enhancement)
        if (indicators && indicators.length > 0) {
          for (const indicator of indicators) {
            queries.push(createQuery(lifeContext, productWord, indicator, 'reddit', 'reddit.com'))
          }
        }
      }

      // Thematic forums - use context-matched forums
      if (isThematicEnabled) {
        const matchedForums = findThematicForums(lifeContext)
        for (const forum of matchedForums) {
          // For thematic forums, we might want to add forum-specific keywords
          queries.push(
            createThematicQuery(lifeContext, productWord, undefined, forum)
          )

          // With indicators
          if (indicators && indicators.length > 0) {
            for (const indicator of indicators) {
              queries.push(
                createThematicQuery(lifeContext, productWord, indicator, forum)
              )
            }
          }
        }
      }

      // General forum searches
      // Support both array format (string[]) and object format ({ enabled, forums })
      const generalForums = Array.isArray(sources.general_forums)
        ? sources.general_forums
        : (sources.general_forums as unknown as { enabled?: boolean; forums?: string[] })?.forums || []

      for (const forum of generalForums) {
        queries.push(createQuery(lifeContext, productWord, undefined, 'general_forum', forum))

        // With indicators
        if (indicators && indicators.length > 0) {
          for (const indicator of indicators) {
            queries.push(createQuery(lifeContext, productWord, indicator, 'general_forum', forum))
          }
        }
      }
    }
  }

  return queries
}

/**
 * Create a standard search query
 */
function createQuery(
  lifeContext: string,
  productWord: string,
  indicator: string | undefined,
  sourceType: 'reddit' | 'thematic_forum' | 'general_forum',
  sourceDomain: string
): SearchQuery {
  const parts: string[] = []

  // Site filter
  parts.push(`site:${sourceDomain}`)

  // Main search terms
  parts.push(`"${lifeContext}"`)
  parts.push(`"${productWord}"`)

  // Indicator if present
  if (indicator) {
    parts.push(`"${indicator}"`)
  }

  return {
    lifeContext,
    productWord,
    indicator,
    sourceType,
    sourceDomain,
    query: parts.join(' '),
    isThematic: false,
  }
}

/**
 * Create a thematic search query
 * Uses forum-specific keywords when available
 */
function createThematicQuery(
  lifeContext: string,
  productWord: string,
  indicator: string | undefined,
  forum: ThematicForum
): SearchQuery {
  const parts: string[] = []

  // Site filter
  parts.push(`site:${forum.domain}`)

  // For thematic forums, use the life context and product word
  // but the query is more targeted to the forum's topic
  parts.push(`"${lifeContext}"`)
  parts.push(`"${productWord}"`)

  // Indicator if present
  if (indicator) {
    parts.push(`"${indicator}"`)
  }

  return {
    lifeContext,
    productWord,
    indicator,
    sourceType: 'thematic_forum',
    sourceDomain: forum.domain,
    query: parts.join(' '),
    isThematic: true,
  }
}

/**
 * Generate a preview of queries for display
 * Shows how indicators affect the search
 */
export function generateQueryPreview(
  lifeContext: string,
  productWord: string,
  indicators: string[],
  sources: { reddit: boolean; thematic_forums: boolean; general_forums: string[] }
): { base: string[]; withIndicators: string[] } {
  const base: string[] = []
  const withIndicators: string[] = []

  // Reddit base
  if (sources.reddit) {
    base.push(`site:reddit.com "${lifeContext}" "${productWord}"`)
    if (indicators.length > 0) {
      withIndicators.push(
        `site:reddit.com "${lifeContext}" "${productWord}" "${indicators[0]}"`
      )
    }
  }

  // Thematic forums
  if (sources.thematic_forums) {
    const forums = findThematicForums(lifeContext)
    if (forums.length > 0) {
      base.push(`site:${forums[0].domain} "${lifeContext}" "${productWord}"`)
      if (indicators.length > 0) {
        withIndicators.push(
          `site:${forums[0].domain} "${lifeContext}" "${productWord}" "${indicators[0]}"`
        )
      }
    }
  }

  // General forums
  if (sources.general_forums.length > 0) {
    base.push(`site:${sources.general_forums[0]} "${lifeContext}" "${productWord}"`)
    if (indicators.length > 0) {
      withIndicators.push(
        `site:${sources.general_forums[0]} "${lifeContext}" "${productWord}" "${indicators[0]}"`
      )
    }
  }

  return { base, withIndicators }
}

/**
 * Calculate total number of queries that will be generated
 */
export function calculateTotalQueries(config: ScraperStepConfig): number {
  const { life_contexts, product_words, indicators, sources } = config

  const baseCombinations = life_contexts.length * product_words.length

  // Count sources
  let numSources = sources.reddit ? 1 : 0
  numSources += sources.general_forums.length

  // Count thematic forums (based on context matches)
  if (sources.thematic_forums) {
    const thematicCount = life_contexts.reduce((count, ctx) => {
      return count + findThematicForums(ctx).length
    }, 0)
    // Average thematic forums per context
    numSources += Math.ceil(thematicCount / Math.max(life_contexts.length, 1))
  }

  // Base queries: A × B × Sources
  let total = baseCombinations * numSources

  // With indicators: queries are DUPLICATED (base + with indicator)
  // Not multiplied, but added
  if (indicators && indicators.length > 0) {
    total += baseCombinations * indicators.length * numSources
  }

  return total
}

/**
 * Calculate how many queries use indicators
 */
export function calculateIndicatorQueries(config: ScraperStepConfig): number {
  if (!config.indicators || config.indicators.length === 0) return 0

  const { life_contexts, product_words, indicators, sources } = config
  const baseCombinations = life_contexts.length * product_words.length

  let numSources = sources.reddit ? 1 : 0
  numSources += sources.general_forums.length
  if (sources.thematic_forums) {
    numSources += 2 // Approximate
  }

  return baseCombinations * indicators.length * numSources
}

/**
 * Estimate number of URLs that will be found
 * Based on typical SERP results (10 per page)
 */
export function estimateUrlCount(config: ScraperStepConfig): number {
  const totalQueries = calculateTotalQueries(config)
  const resultsPerPage = 10
  const pages = config.serp_pages || 5

  // Not all queries return full results, estimate 70% fill rate
  const fillRate = 0.7

  // Deduplication typically removes ~30% of URLs
  const uniqueRate = 0.7

  return Math.round(totalQueries * resultsPerPage * pages * fillRate * uniqueRate)
}

/**
 * Get explanation of how queries are built
 */
export function getQueryExplanation(): string {
  return `
## Cómo se construyen las búsquedas

### Búsqueda base (sin indicadores):
\`site:foro.com "contexto de vida" "palabra producto"\`

Ejemplo: \`site:reddit.com "familia" "gastos"\`

### Búsqueda con indicadores (queries adicionales):
\`site:foro.com "contexto de vida" "palabra producto" "indicador"\`

Ejemplo: \`site:reddit.com "familia" "gastos" "me frustra"\`

### ¿Por qué son queries adicionales?
Los indicadores NO reemplazan las búsquedas base, sino que **añaden** búsquedas más específicas:
- Sin indicadores: encuentras conversaciones generales sobre el tema
- Con indicadores: encuentras específicamente gente frustrada/buscando ayuda

### Foros temáticos:
Los foros temáticos se seleccionan automáticamente según el contexto de vida:
- "boda" → bodas.net, zankyou.es
- "bebé" → bebesymas.com, serpadres.es
- "inversión" → rankia.com, finect.com
`.trim()
}
