/**
 * Scraper Constants - Shared across ScraperLauncher and Campaign views
 *
 * Contains icons, colors, descriptions and configurations for all scrapers.
 */

import { ScraperType } from '@/types/scraper.types'

// ============================================
// SCRAPER STATUS & CONFIG
// ============================================

export type ScraperStatus = 'enabled' | 'pending'

export interface ScraperConfig {
  type: ScraperType
  status: ScraperStatus
  category: 'social' | 'reviews' | 'web' | 'seo' | 'other'
}

// All scrapers with their status
export const ALL_SCRAPERS: ScraperConfig[] = [
  // Social Media
  { type: 'instagram_posts_comments', status: 'enabled', category: 'social' },
  { type: 'tiktok_posts', status: 'enabled', category: 'social' },
  { type: 'tiktok_comments', status: 'enabled', category: 'social' },
  { type: 'linkedin_company_posts', status: 'enabled', category: 'social' },
  { type: 'linkedin_comments', status: 'enabled', category: 'social' },
  { type: 'linkedin_company_profile', status: 'enabled', category: 'social' },
  { type: 'reddit_posts', status: 'enabled', category: 'social' },
  // linkedin_company_insights: disabled - requires paid Apify subscription
  { type: 'facebook_posts', status: 'enabled', category: 'social' },
  { type: 'facebook_comments', status: 'enabled', category: 'social' },
  { type: 'youtube_channel_videos', status: 'enabled', category: 'social' },
  { type: 'youtube_comments', status: 'enabled', category: 'social' },
  { type: 'youtube_transcripts', status: 'enabled', category: 'social' },

  // Reviews
  { type: 'trustpilot_reviews', status: 'enabled', category: 'reviews' },
  { type: 'g2_reviews', status: 'enabled', category: 'reviews' },
  { type: 'capterra_reviews', status: 'enabled', category: 'reviews' },
  { type: 'appstore_reviews', status: 'enabled', category: 'reviews' },
  { type: 'playstore_reviews', status: 'enabled', category: 'reviews' },
  { type: 'google_maps_reviews', status: 'enabled', category: 'reviews' },

  // Web & News
  { type: 'website', status: 'enabled', category: 'web' },
  { type: 'google_news', status: 'enabled', category: 'web' },
  { type: 'news_bing', status: 'enabled', category: 'web' },

  // SEO & Keywords (Mangools)
  { type: 'seo_keywords', status: 'enabled', category: 'seo' },
  { type: 'seo_serp_checker', status: 'enabled', category: 'seo' },
  { type: 'seo_site_profiler', status: 'enabled', category: 'seo' },
  { type: 'seo_link_miner', status: 'enabled', category: 'seo' },
  { type: 'seo_competitor_keywords', status: 'enabled', category: 'seo' },
]

// ============================================
// CATEGORY LABELS
// ============================================

export const CATEGORY_LABELS: Record<string, string> = {
  social: 'Redes Sociales',
  reviews: 'Reviews',
  web: 'Web & Noticias',
  seo: 'SEO & Keywords',
  other: 'Otros',
}

// ============================================
// SCRAPER ICON TYPES (for dynamic rendering)
// ============================================

export type ScraperIconType =
  | 'globe'
  | 'star'
  | 'message'
  | 'play'
  | 'briefcase'
  | 'facebook'
  | 'youtube'
  | 'smartphone'
  | 'map-pin'
  | 'newspaper'
  | 'search'

export const SCRAPER_ICON_TYPES: Record<string, ScraperIconType> = {
  website: 'globe',
  trustpilot_reviews: 'star',
  instagram_posts_comments: 'message',
  tiktok_posts: 'play',
  tiktok_comments: 'message',
  linkedin_company_posts: 'briefcase',
  linkedin_comments: 'message',
  linkedin_company_insights: 'briefcase',
  linkedin_company_profile: 'briefcase',
  facebook_posts: 'facebook',
  facebook_comments: 'message',
  reddit_posts: 'message',
  youtube_channel_videos: 'youtube',
  youtube_comments: 'message',
  youtube_transcripts: 'youtube',
  g2_reviews: 'star',
  capterra_reviews: 'star',
  appstore_reviews: 'smartphone',
  playstore_reviews: 'smartphone',
  google_maps_reviews: 'map-pin',
  google_news: 'newspaper',
  news_bing: 'newspaper',
  seo_keywords: 'search',
  seo_serp_checker: 'search',
  seo_site_profiler: 'globe',
  seo_link_miner: 'globe',
  seo_competitor_keywords: 'search',
}

// ============================================
// SCRAPER DESCRIPTIONS
// ============================================

export const SCRAPER_DESCRIPTIONS: Record<string, string> = {
  // Social Media
  instagram_posts_comments:
    'Extrae posts y comentarios de perfiles de Instagram. Obtiene imagenes, likes, texto y engagement.',
  tiktok_posts:
    'Obtiene videos de perfiles de TikTok con metricas de views, likes, shares y descripcion.',
  tiktok_comments:
    'Extrae comentarios de videos especificos de TikTok con autor, likes y respuestas.',
  linkedin_company_posts:
    'Scrape publicaciones de paginas de empresa en LinkedIn con contenido, reacciones y comentarios.',
  linkedin_comments:
    'Extrae comentarios de posts especificos de LinkedIn con autor y engagement.',
  linkedin_company_insights:
    'Obtiene insights y metricas de paginas de empresa en LinkedIn.',
  linkedin_company_profile:
    'Perfil completo de empresa: empleados, followers, headquarters, especialidades. $8/1000 resultados.',
  facebook_posts:
    'Extrae publicaciones de paginas de Facebook con texto, imagenes y reacciones.',
  facebook_comments:
    'Obtiene comentarios de posts de Facebook con autor y respuestas.',
  reddit_posts:
    'Busca posts y comentarios en subreddits o busquedas. Pay-per-use: $0.002/item (1000 gratis/mes).',

  // YouTube
  youtube_channel_videos:
    'Lista de videos de canales de YouTube con titulo, descripcion, views y likes.',
  youtube_comments:
    'Extrae comentarios de videos de YouTube ordenados por relevancia o fecha.',
  youtube_transcripts:
    'Obtiene transcripciones/subtitulos de videos de YouTube con timestamps.',

  // Reviews
  trustpilot_reviews:
    'Reviews de empresas en Trustpilot con rating, titulo, texto completo y fecha.',
  g2_reviews:
    'Reviews de software B2B en G2 con pros, contras y ratings detallados. Minimo 200 reviews.',
  capterra_reviews:
    'Reviews de software en Capterra con calificaciones por categoria y recomendaciones.',
  appstore_reviews:
    'Reviews de apps en Apple App Store con rating, version de la app y pais.',
  playstore_reviews:
    'Reviews de apps en Google Play Store con rating, version y tipo de dispositivo.',
  google_maps_reviews:
    'Reviews de negocios locales en Google Maps con rating, texto y fotos del reviewer.',

  // Web & News
  website:
    'Extrae contenido de paginas web. Modo scrape (1 pagina) o crawl (multiples paginas del sitio).',
  google_news:
    'Busca noticias recientes en Google News por keywords, empresa o tema especifico.',
  news_bing:
    'Busca noticias en Bing News con filtros avanzados de fecha, idioma y relevancia.',
  seo_keywords:
    'Analisis de keywords SEO con volumen de busqueda, dificultad y competencia (KWFinder).',
  seo_serp_checker:
    'Analisis de SERPs con metricas SEO: DA, PA, CF, TF, backlinks y posiciones.',
  seo_site_profiler:
    'Perfil completo de dominio: autoridad, backlinks, trafico estimado y competidores.',
  seo_link_miner:
    'Analisis de backlinks: encuentra enlaces entrantes con metricas de calidad.',
  seo_competitor_keywords:
    'Descubre keywords organicas de competidores con volumenes y posiciones.',
}

// ============================================
// SCRAPER COLORS
// ============================================

export interface ScraperColorConfig {
  bg: string
  text: string
  border: string
}

export const SCRAPER_COLORS: Record<string, ScraperColorConfig> = {
  // Social
  instagram_posts_comments: {
    bg: 'bg-pink-50',
    text: 'text-pink-600',
    border: 'border-pink-200',
  },
  tiktok_posts: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200',
  },
  tiktok_comments: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200',
  },
  linkedin_company_posts: {
    bg: 'bg-sky-50',
    text: 'text-sky-600',
    border: 'border-sky-200',
  },
  linkedin_comments: {
    bg: 'bg-sky-50',
    text: 'text-sky-600',
    border: 'border-sky-200',
  },
  linkedin_company_insights: {
    bg: 'bg-sky-50',
    text: 'text-sky-600',
    border: 'border-sky-200',
  },
  linkedin_company_profile: {
    bg: 'bg-sky-50',
    text: 'text-sky-600',
    border: 'border-sky-200',
  },
  facebook_posts: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
  },
  facebook_comments: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
  },
  reddit_posts: {
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    border: 'border-orange-200',
  },
  youtube_channel_videos: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
  },
  youtube_comments: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
  },
  youtube_transcripts: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
  },
  // Reviews
  trustpilot_reviews: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-200',
  },
  g2_reviews: {
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    border: 'border-orange-200',
  },
  capterra_reviews: {
    bg: 'bg-teal-50',
    text: 'text-teal-600',
    border: 'border-teal-200',
  },
  appstore_reviews: {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-200',
  },
  playstore_reviews: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
  },
  google_maps_reviews: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200',
  },
  // Web & News
  website: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
    border: 'border-indigo-200',
  },
  google_news: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
  },
  news_bing: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-600',
    border: 'border-cyan-200',
  },
  // SEO & Keywords
  seo_keywords: {
    bg: 'bg-violet-50',
    text: 'text-violet-600',
    border: 'border-violet-200',
  },
  seo_serp_checker: {
    bg: 'bg-violet-50',
    text: 'text-violet-600',
    border: 'border-violet-200',
  },
  seo_site_profiler: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200',
  },
  seo_link_miner: {
    bg: 'bg-fuchsia-50',
    text: 'text-fuchsia-600',
    border: 'border-fuchsia-200',
  },
  seo_competitor_keywords: {
    bg: 'bg-violet-50',
    text: 'text-violet-600',
    border: 'border-violet-200',
  },
}

// Default colors for unknown scrapers
export const DEFAULT_SCRAPER_COLORS: ScraperColorConfig = {
  bg: 'bg-gray-50',
  text: 'text-gray-600',
  border: 'border-gray-200',
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get colors for a scraper type, with fallback to defaults
 */
export function getScraperColors(scraperType: string): ScraperColorConfig {
  return SCRAPER_COLORS[scraperType] || DEFAULT_SCRAPER_COLORS
}

/**
 * Get description for a scraper type
 */
export function getScraperDescription(scraperType: string): string {
  return SCRAPER_DESCRIPTIONS[scraperType] || ''
}

/**
 * Get icon type for a scraper
 */
export function getScraperIconType(scraperType: string): ScraperIconType {
  return SCRAPER_ICON_TYPES[scraperType] || 'globe'
}

/**
 * Get scraper config by type
 */
export function getScraperConfig(scraperType: ScraperType): ScraperConfig | undefined {
  return ALL_SCRAPERS.find((s) => s.type === scraperType)
}

/**
 * Get all scrapers for a category
 */
export function getScrapersByCategory(
  category: ScraperConfig['category']
): ScraperConfig[] {
  return ALL_SCRAPERS.filter((s) => s.category === category)
}

/**
 * Check if a scraper is enabled
 */
export function isScraperEnabled(scraperType: ScraperType): boolean {
  const config = getScraperConfig(scraperType)
  return config?.status === 'enabled'
}

// ============================================
// ERROR MESSAGES
// ============================================

/**
 * Map technical error codes/messages to user-friendly Spanish messages
 */
export const SCRAPER_ERROR_MESSAGES: Record<string, string> = {
  // Common errors
  TIMEOUT: 'El scraping tardó demasiado. Intenta de nuevo más tarde.',
  timeout: 'El scraping tardó demasiado. Intenta de nuevo más tarde.',
  RATE_LIMIT: 'Demasiadas solicitudes. Espera unos minutos antes de reintentar.',
  'rate limit': 'Demasiadas solicitudes. Espera unos minutos antes de reintentar.',
  INVALID_URL: 'La URL proporcionada no es válida.',
  'invalid url': 'La URL proporcionada no es válida.',
  NO_RESULTS: 'No se encontraron resultados para esta búsqueda.',
  'no results': 'No se encontraron resultados para esta búsqueda.',
  NOT_FOUND: 'No se encontró el recurso solicitado.',
  'not found': 'No se encontró el recurso solicitado.',
  '404': 'No se encontró el recurso solicitado.',

  // Authentication errors
  UNAUTHORIZED: 'Error de autenticación. Verifica tus credenciales.',
  unauthorized: 'Error de autenticación. Verifica tus credenciales.',
  '401': 'Error de autenticación. Verifica tus credenciales.',
  FORBIDDEN: 'No tienes permiso para acceder a este recurso.',
  forbidden: 'No tienes permiso para acceder a este recurso.',
  '403': 'No tienes permiso para acceder a este recurso.',

  // Network errors
  NETWORK_ERROR: 'Error de conexión. Verifica tu conexión a internet.',
  'network error': 'Error de conexión. Verifica tu conexión a internet.',
  'fetch failed': 'Error de conexión. Verifica tu conexión a internet.',

  // Service errors
  SERVICE_UNAVAILABLE: 'El servicio no está disponible. Intenta más tarde.',
  '503': 'El servicio no está disponible. Intenta más tarde.',
  '500': 'Error interno del servidor. Intenta más tarde.',
  INTERNAL_ERROR: 'Error interno. Por favor intenta de nuevo.',

  // Specific platform errors
  instagram: 'Error al acceder a Instagram. El perfil puede ser privado.',
  tiktok: 'Error al acceder a TikTok. Verifica que el perfil sea público.',
  linkedin: 'Error al acceder a LinkedIn. Verifica que la URL sea correcta.',
  facebook: 'Error al acceder a Facebook. La página puede ser privada.',
  youtube: 'Error al acceder a YouTube. El canal puede no existir.',

  // Default
  DEFAULT: 'Ocurrió un error. Por favor intenta de nuevo.',
}

/**
 * Get user-friendly error message from technical error
 */
export function getScraperErrorMessage(error: string): string {
  // Check for exact match
  if (SCRAPER_ERROR_MESSAGES[error]) {
    return SCRAPER_ERROR_MESSAGES[error]
  }

  // Check for partial match (case-insensitive)
  const lowerError = error.toLowerCase()
  for (const [key, message] of Object.entries(SCRAPER_ERROR_MESSAGES)) {
    if (lowerError.includes(key.toLowerCase())) {
      return message
    }
  }

  // Return the original error if no match, or default
  if (error.length > 100) {
    return SCRAPER_ERROR_MESSAGES['DEFAULT']
  }

  return error || SCRAPER_ERROR_MESSAGES['DEFAULT']
}
