/**
 * URL Filter for Niche Finder
 * Filters out blogs, articles, and non-forum URLs
 * Prioritizes sites where people discuss and leave opinions
 */

// Patterns that indicate a URL is likely a blog/article (NOT a forum)
const BLOG_PATTERNS = [
  '/blog/',
  '/article/',
  '/articulo/',
  '/post/',
  '/news/',
  '/noticias/',
  '/noticia/',
  '/magazine/',
  '/revista/',
  '/story/',
  '/stories/',
  '/guide/',
  '/guia/',
  '/tutorial/',
  '/how-to/',
  '/como-',
  '/tips/',
  '/consejos/',
  '/review/', // singular review = article, not forum
  '/reseña/',
  '/autor/',
  '/author/',
  '/category/',
  '/categoria/',
  '/tag/',
  '/etiqueta/',
  '/wp-content/',
  '/wp-json/',
  '.wordpress.',
  '/press/',
  '/prensa/',
  '/comunicado/',
]

// Patterns that indicate a URL is likely a forum/discussion
const FORUM_PATTERNS = [
  '/foro/',
  '/forum/',
  '/forums/',
  '/thread/',
  '/topic/',
  '/discussion/',
  '/discusion/',
  '/comunidad/',
  '/community/',
  '/comments/',
  '/comentarios/',
  '/pregunta/',
  '/question/',
  '/respuesta/',
  '/answer/',
  '/hilo/',
  '/debate/',
  '/showthread',
  '/viewtopic',
  '/t/', // Common forum thread pattern
  '/r/', // Reddit pattern
]

// Domains that are known discussion platforms
export const KNOWN_FORUM_DOMAINS = [
  'reddit.com',
  'forocoches.com',
  'mediavida.com',
  'burbuja.info',
  'rankia.com',
  'htcmania.com',
  'mundodeportivo.com/foro',
  'enfemenino.com',
  'bebesymas.com',
  'bodas.net',
  'tripadvisor.es',
  'tripadvisor.com',
  'quora.com',
  'stackoverflow.com',
  'stackexchange.com',
  'groups.google.com',
  'discord.com',
  'domestika.org/comunidad',
  'idealista.com/foro',
  'fotocasa.es/foro',
  'elotrolado.net',
  'meristation.com/foro',
  '3djuegos.com/foros',
  'lawebdelcafe.com/foro',
  'foromotos.com',
  'clubaudi.com',
  'audisport-iberica.com',
  'bmwfaq.com',
  'clubgolf.net',
  'todoexpertos.com',
]

// Domains that are known blogs/news sites (NOT forums)
const KNOWN_BLOG_DOMAINS = [
  'elpais.com',
  'elmundo.es',
  'abc.es',
  'lavanguardia.com',
  'elconfidencial.com',
  'xataka.com',
  'genbeta.com',
  'applesfera.com',
  'vidaextra.com',
  'trendencias.com',
  'directoalpaladar.com',
  'motorpasion.com',
  'espinof.com',
  'economipedia.com',
  'entrepreneur.com',
  'forbes.es',
  'forbes.com',
  'businessinsider.es',
  'emprendedores.es',
  'blog.',
  'medium.com',
  'substack.com',
  'hubspot.com',
  'mailchimp.com',
  'wikipedia.org',
  'wikihow.com',
]

/**
 * Check if a URL is likely a blog/article rather than a forum
 */
export function isLikelyBlog(url: string): boolean {
  const urlLower = url.toLowerCase()

  // Check known blog domains
  for (const domain of KNOWN_BLOG_DOMAINS) {
    if (urlLower.includes(domain)) {
      return true
    }
  }

  // Check blog patterns in URL
  for (const pattern of BLOG_PATTERNS) {
    if (urlLower.includes(pattern)) {
      return true
    }
  }

  return false
}

/**
 * Check if a URL is likely a forum/discussion
 */
export function isLikelyForum(url: string): boolean {
  const urlLower = url.toLowerCase()

  // Check known forum domains
  for (const domain of KNOWN_FORUM_DOMAINS) {
    if (urlLower.includes(domain)) {
      return true
    }
  }

  // Check forum patterns in URL
  for (const pattern of FORUM_PATTERNS) {
    if (urlLower.includes(pattern)) {
      return true
    }
  }

  return false
}

/**
 * Score a URL based on how likely it is to be a forum with real opinions
 * Higher score = more likely to be a good forum
 * Returns: number between 0-100
 */
export function scoreUrlQuality(url: string): number {
  const urlLower = url.toLowerCase()
  let score = 50 // Start neutral

  // Boost for known forum domains
  for (const domain of KNOWN_FORUM_DOMAINS) {
    if (urlLower.includes(domain)) {
      score += 30
      break
    }
  }

  // Boost for forum patterns
  for (const pattern of FORUM_PATTERNS) {
    if (urlLower.includes(pattern)) {
      score += 15
      break
    }
  }

  // Penalty for known blog domains
  for (const domain of KNOWN_BLOG_DOMAINS) {
    if (urlLower.includes(domain)) {
      score -= 40
      break
    }
  }

  // Penalty for blog patterns
  for (const pattern of BLOG_PATTERNS) {
    if (urlLower.includes(pattern)) {
      score -= 20
      break
    }
  }

  // Clamp between 0-100
  return Math.max(0, Math.min(100, score))
}

/**
 * Filter a list of URLs, keeping only those likely to be forums
 * Returns URLs sorted by quality score (best first)
 */
export function filterForumUrls(
  urls: Array<{ url: string; [key: string]: unknown }>
): Array<{ url: string; quality_score: number; [key: string]: unknown }> {
  return urls
    .map((item) => ({
      ...item,
      quality_score: scoreUrlQuality(item.url),
    }))
    .filter((item) => item.quality_score >= 40) // Minimum threshold
    .sort((a, b) => b.quality_score - a.quality_score)
}

/**
 * Categorize a URL
 */
export function categorizeUrl(url: string): 'forum' | 'blog' | 'unknown' {
  if (isLikelyForum(url)) return 'forum'
  if (isLikelyBlog(url)) return 'blog'
  return 'unknown'
}

/**
 * Get filter reason for a URL
 */
export function getFilterReason(url: string): string | null {
  const urlLower = url.toLowerCase()

  for (const domain of KNOWN_BLOG_DOMAINS) {
    if (urlLower.includes(domain)) {
      return `Dominio de blog/noticias conocido: ${domain}`
    }
  }

  for (const pattern of BLOG_PATTERNS) {
    if (urlLower.includes(pattern)) {
      return `Patrón de blog/artículo detectado: ${pattern}`
    }
  }

  return null
}

/**
 * Known active forums with minimum traffic (curated list)
 * These are verified to have active discussions
 */
export const VERIFIED_ACTIVE_FORUMS: Record<
  string,
  {
    domain: string
    name: string
    topics: string[]
    language: string
    estimatedMonthlyVisits: string
  }
> = {
  forocoches: {
    domain: 'forocoches.com',
    name: 'Forocoches',
    topics: ['general', 'coches', 'tecnología', 'economía', 'trabajo'],
    language: 'es',
    estimatedMonthlyVisits: '10M+',
  },
  mediavida: {
    domain: 'mediavida.com',
    name: 'Mediavida',
    topics: ['gaming', 'tecnología', 'general'],
    language: 'es',
    estimatedMonthlyVisits: '5M+',
  },
  burbuja: {
    domain: 'burbuja.info',
    name: 'Burbuja.info',
    topics: ['economía', 'inmobiliaria', 'inversión', 'política'],
    language: 'es',
    estimatedMonthlyVisits: '2M+',
  },
  rankia: {
    domain: 'rankia.com',
    name: 'Rankia',
    topics: ['finanzas', 'inversión', 'fondos', 'bolsa', 'hipotecas'],
    language: 'es',
    estimatedMonthlyVisits: '3M+',
  },
  enfemenino: {
    domain: 'enfemenino.com',
    name: 'Enfemenino',
    topics: ['maternidad', 'salud', 'belleza', 'familia', 'pareja'],
    language: 'es',
    estimatedMonthlyVisits: '2M+',
  },
  bodas_net: {
    domain: 'bodas.net',
    name: 'Bodas.net',
    topics: ['bodas', 'organización', 'proveedores', 'presupuesto'],
    language: 'es',
    estimatedMonthlyVisits: '1M+',
  },
  bebesymas: {
    domain: 'bebesymas.com',
    name: 'Bebés y más',
    topics: ['embarazo', 'bebés', 'crianza', 'maternidad'],
    language: 'es',
    estimatedMonthlyVisits: '1M+',
  },
  tripadvisor_es: {
    domain: 'tripadvisor.es',
    name: 'TripAdvisor España',
    topics: ['viajes', 'hoteles', 'restaurantes', 'turismo'],
    language: 'es',
    estimatedMonthlyVisits: '5M+',
  },
  idealista_foro: {
    domain: 'idealista.com/foro',
    name: 'Foro Idealista',
    topics: ['inmobiliaria', 'alquiler', 'compra', 'hipotecas'],
    language: 'es',
    estimatedMonthlyVisits: '500K+',
  },
  elotrolado: {
    domain: 'elotrolado.net',
    name: 'ElOtroLado',
    topics: ['gaming', 'videojuegos', 'consolas', 'PC'],
    language: 'es',
    estimatedMonthlyVisits: '1M+',
  },
  htcmania: {
    domain: 'htcmania.com',
    name: 'HTCmania',
    topics: ['móviles', 'Android', 'tecnología', 'tablets'],
    language: 'es',
    estimatedMonthlyVisits: '500K+',
  },
  motorpasion_foro: {
    domain: 'forocoches.com/foro',
    name: 'Forocoches - Subforos',
    topics: ['coches', 'motos', 'mecánica'],
    language: 'es',
    estimatedMonthlyVisits: '1M+',
  },
}

/**
 * Check if a domain is a verified active forum
 */
export function isVerifiedActiveForum(domain: string): boolean {
  const domainLower = domain.toLowerCase()
  return Object.values(VERIFIED_ACTIVE_FORUMS).some((forum) =>
    domainLower.includes(forum.domain)
  )
}

/**
 * Get forum info if it's a verified active forum
 */
export function getForumInfo(domain: string) {
  const domainLower = domain.toLowerCase()
  return Object.values(VERIFIED_ACTIVE_FORUMS).find((forum) =>
    domainLower.includes(forum.domain)
  )
}
