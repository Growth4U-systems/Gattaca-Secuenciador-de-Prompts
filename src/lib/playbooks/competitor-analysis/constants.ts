/**
 * Competitor Analysis Playbook - Constants
 *
 * Variables, mappings y requirements para el playbook.
 * Exportable y reutilizable.
 */

import type {
  VariableDefinition,
  ScraperInputMapping,
  StepDocumentRequirements,
  DocumentRequirement,
  SourceType,
} from './types'

// ============================================
// VARIABLE DEFINITIONS
// ============================================

export const COMPETITOR_VARIABLE_DEFINITIONS: VariableDefinition[] = [
  // === REQUERIDAS ===
  {
    name: 'competitor_name',
    required: true,
    description: 'Nombre del competidor a analizar',
    placeholder: 'Revolut',
  },
  {
    name: 'company_name',
    required: true,
    description: 'Nombre de tu empresa (para el battle card final)',
    placeholder: 'Mi Empresa',
  },
  {
    name: 'industry',
    required: true,
    description: 'Industria o sector del mercado',
    placeholder: 'Fintech',
  },

  // === OPCIONALES ===
  {
    name: 'competitor_description',
    required: false,
    description: 'Breve descripción del competidor',
    type: 'textarea',
    placeholder: 'Banco digital europeo líder en pagos móviles',
  },
  {
    name: 'company_description',
    required: false,
    description: 'Breve descripción de tu empresa',
    type: 'textarea',
    placeholder: 'Fintech de pagos para LATAM',
  },
  {
    name: 'country',
    default_value: 'España',
    required: false,
    description: 'País o región objetivo del análisis',
    placeholder: 'España',
  },
  {
    name: 'target_audience',
    required: false,
    description: 'Audiencia objetivo principal',
    type: 'textarea',
    placeholder: 'Jóvenes 25-35 años, digitales, buscan alternativas a bancos tradicionales',
  },
  {
    name: 'analysis_focus',
    required: false,
    description: 'Enfoque específico del análisis (opcional)',
    type: 'textarea',
    placeholder: 'Estrategia de contenido en redes sociales',
  },
  {
    name: 'key_questions',
    required: false,
    description: 'Preguntas específicas a responder',
    type: 'textarea',
    placeholder: '¿Cómo están capturando el segmento joven? ¿Qué diferenciadores destacan?',
  },
]

// ============================================
// SCRAPER INPUT MAPPINGS
// ============================================

// Keys must match ScraperConfigModal.tsx field keys
export const SCRAPER_INPUT_MAPPINGS: Record<string, ScraperInputMapping> = {
  // Website & SEO
  'web-scraping': {
    inputKey: 'competitor_website',
    label: 'Website URL',
    placeholder: 'https://competitor.com',
    type: 'url',
    required: true,
  },
  'seo-serp': {
    inputKey: 'competitor_website',
    label: 'Domain',
    placeholder: 'competitor.com',
    type: 'text',
    required: true,
  },
  'news-corpus': {
    inputKey: 'competitor_name',
    label: 'Search Query',
    placeholder: '{{competitor_name}}',
    type: 'text',
    required: true,
  },

  // Social Posts - keys match ScraperConfigModal.tsx
  'ig-posts': {
    inputKey: 'instagram_username',
    label: 'Instagram Username',
    placeholder: 'competitor',
    type: 'text',
    required: true,
  },
  'fb-posts': {
    inputKey: 'facebook_url',
    label: 'Facebook Page URL',
    placeholder: 'https://facebook.com/competitor',
    type: 'url',
    required: true,
  },
  'li-posts': {
    inputKey: 'linkedin_url',
    label: 'LinkedIn Company URL',
    placeholder: 'https://linkedin.com/company/competitor',
    type: 'url',
    required: true,
  },
  'li-insights': {
    inputKey: 'linkedin_url',
    label: 'LinkedIn Company URL',
    placeholder: 'https://linkedin.com/company/competitor',
    type: 'url',
    required: true,
  },
  'tiktok-posts': {
    inputKey: 'tiktok_username',
    label: 'TikTok Username',
    placeholder: '@competitor',
    type: 'text',
    required: true,
  },
  'yt-videos': {
    inputKey: 'youtube_url',
    label: 'YouTube Channel URL',
    placeholder: 'https://youtube.com/@competitor',
    type: 'url',
    required: true,
  },

  // Social Comments - use same keys as posts
  'ig-comments': {
    inputKey: 'instagram_username',
    label: 'Instagram Username',
    placeholder: 'competitor',
    type: 'text',
    required: true,
  },
  'fb-comments': {
    inputKey: 'facebook_url',
    label: 'Facebook Page URL',
    placeholder: 'https://facebook.com/competitor',
    type: 'url',
    required: true,
  },
  'li-comments': {
    inputKey: 'linkedin_url',
    label: 'LinkedIn Post URLs (uno por línea)',
    placeholder: 'https://linkedin.com/posts/...',
    type: 'textarea',
    required: true,
  },
  'tiktok-comments': {
    inputKey: 'tiktok_username',
    label: 'TikTok Username',
    placeholder: '@competitor',
    type: 'text',
    required: true,
  },
  'yt-comments': {
    inputKey: 'youtube_url',
    label: 'YouTube Video URLs (uno por línea)',
    placeholder: 'https://youtube.com/watch?v=...',
    type: 'textarea',
    required: true,
  },

  // Reviews
  'trustpilot-reviews': {
    inputKey: 'trustpilot_url',
    label: 'Trustpilot URL',
    placeholder: 'https://trustpilot.com/review/competitor.com',
    type: 'url',
    required: true,
  },
  'g2-reviews': {
    inputKey: 'g2_url',
    label: 'G2 Product URL',
    placeholder: 'https://g2.com/products/competitor',
    type: 'url',
    required: true,
  },
  'capterra-reviews': {
    inputKey: 'capterra_url',
    label: 'Capterra URL',
    placeholder: 'https://capterra.com/p/...',
    type: 'url',
    required: true,
  },
  'play-store-reviews': {
    inputKey: 'play_store_app_id',
    label: 'Play Store App ID',
    placeholder: 'com.competitor.app',
    type: 'text',
    required: true,
  },
  'app-store-reviews': {
    inputKey: 'app_store_app_id',
    label: 'App Store App ID',
    placeholder: '123456789',
    type: 'text',
    required: true,
  },
}

// ============================================
// STEP DOCUMENT REQUIREMENTS
// ============================================

/**
 * Define qué source_types necesita cada paso del playbook.
 * Usado para auto-matching de documentos.
 */
export const STEP_DOCUMENT_REQUIREMENTS: StepDocumentRequirements[] = [
  {
    stepId: 'autopercepcion',
    source_types: [
      'deep_research',
      'website',
      'instagram_posts',
      'facebook_posts',
      'youtube_videos',
      'tiktok_posts',
      'linkedin_posts',
      'linkedin_insights',
    ],
  },
  {
    stepId: 'percepcion-terceros',
    source_types: ['seo_serp', 'news_corpus'],
  },
  {
    stepId: 'percepcion-rrss',
    source_types: [
      'instagram_comments',
      'facebook_comments',
      'youtube_comments',
      'tiktok_comments',
      'linkedin_comments',
    ],
  },
  {
    stepId: 'percepcion-reviews',
    source_types: [
      'trustpilot_reviews',
      'g2_reviews',
      'capterra_reviews',
      'playstore_reviews',
      'appstore_reviews',
    ],
  },
  {
    stepId: 'resumen',
    source_types: [], // Usa outputs de pasos anteriores
  },
]

// ============================================
// ALL DOCUMENT REQUIREMENTS
// ============================================

/**
 * Lista completa de todos los documentos que el playbook puede usar.
 * Incluye Deep Research y los 19 scrapers.
 */
export const ALL_DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  // Deep Research
  {
    id: 'deep-research',
    name: 'Deep Research',
    description: 'Investigación profunda del competidor usando Gemini con búsqueda web',
    source: 'deep_research',
    source_type: 'deep_research',
    icon: 'research',
    category: 'research',
  },

  // Website & SEO
  {
    id: 'web-scraping',
    name: 'Website Content',
    description: 'Contenido completo del sitio web del competidor',
    source: 'scraping',
    source_type: 'website',
    icon: 'globe',
    apifyActor: 'apify/website-content-crawler',
    category: 'website',
  },
  {
    id: 'seo-serp',
    name: 'SEO/SERP Data',
    description: 'Posicionamiento en buscadores, keywords orgánicas',
    source: 'scraping',
    source_type: 'seo_serp',
    icon: 'search',
    apifyActor: 'apify/google-search-scraper',
    category: 'seo',
  },
  {
    id: 'news-corpus',
    name: 'News Corpus',
    description: 'Menciones en prensa y medios de comunicación',
    source: 'scraping',
    source_type: 'news_corpus',
    icon: 'news',
    apifyActor: 'apify/google-news-scraper',
    category: 'seo',
  },

  // Social Posts
  {
    id: 'ig-posts',
    name: 'Instagram Posts',
    description: 'Publicaciones recientes del perfil de Instagram',
    source: 'scraping',
    source_type: 'instagram_posts',
    icon: 'social',
    apifyActor: 'apify/instagram-scraper',
    category: 'social_posts',
  },
  {
    id: 'fb-posts',
    name: 'Facebook Posts',
    description: 'Publicaciones recientes de la página de Facebook',
    source: 'scraping',
    source_type: 'facebook_posts',
    icon: 'social',
    apifyActor: 'apify/facebook-posts-scraper',
    category: 'social_posts',
  },
  {
    id: 'li-posts',
    name: 'LinkedIn Posts',
    description: 'Publicaciones del perfil de empresa en LinkedIn',
    source: 'scraping',
    source_type: 'linkedin_posts',
    icon: 'social',
    apifyActor: 'curious_coder/linkedin-post-search-scraper',
    category: 'social_posts',
  },
  {
    id: 'li-insights',
    name: 'LinkedIn Insights',
    description: 'Datos del perfil de empresa (tamaño, industria, etc.)',
    source: 'scraping',
    source_type: 'linkedin_insights',
    icon: 'social',
    apifyActor: 'anchor/linkedin-company-scraper',
    category: 'social_posts',
  },
  {
    id: 'yt-videos',
    name: 'YouTube Videos',
    description: 'Videos y transcripciones del canal de YouTube',
    source: 'scraping',
    source_type: 'youtube_videos',
    icon: 'social',
    apifyActor: 'bernardo/youtube-scraper',
    category: 'social_posts',
  },
  {
    id: 'tiktok-posts',
    name: 'TikTok Posts',
    description: 'Videos y contenido del perfil de TikTok',
    source: 'scraping',
    source_type: 'tiktok_posts',
    icon: 'social',
    apifyActor: 'clockworks/free-tiktok-scraper',
    category: 'social_posts',
  },

  // Social Comments
  {
    id: 'ig-comments',
    name: 'Instagram Comments',
    description: 'Comentarios en publicaciones de Instagram',
    source: 'scraping',
    source_type: 'instagram_comments',
    icon: 'social',
    apifyActor: 'apify/instagram-comment-scraper',
    category: 'social_comments',
  },
  {
    id: 'fb-comments',
    name: 'Facebook Comments',
    description: 'Comentarios en publicaciones de Facebook',
    source: 'scraping',
    source_type: 'facebook_comments',
    icon: 'social',
    apifyActor: 'apify/facebook-comments-scraper',
    category: 'social_comments',
  },
  {
    id: 'li-comments',
    name: 'LinkedIn Comments',
    description: 'Comentarios en publicaciones de LinkedIn',
    source: 'scraping',
    source_type: 'linkedin_comments',
    icon: 'social',
    apifyActor: 'curious_coder/linkedin-comment-scraper',
    category: 'social_comments',
  },
  {
    id: 'yt-comments',
    name: 'YouTube Comments',
    description: 'Comentarios en videos de YouTube',
    source: 'scraping',
    source_type: 'youtube_comments',
    icon: 'social',
    apifyActor: 'bernardo/youtube-comment-scraper',
    category: 'social_comments',
  },
  {
    id: 'tiktok-comments',
    name: 'TikTok Comments',
    description: 'Comentarios en videos de TikTok',
    source: 'scraping',
    source_type: 'tiktok_comments',
    icon: 'social',
    apifyActor: 'clockworks/tiktok-comments-scraper',
    category: 'social_comments',
  },

  // Reviews
  {
    id: 'trustpilot-reviews',
    name: 'Trustpilot Reviews',
    description: 'Reseñas de clientes en Trustpilot',
    source: 'scraping',
    source_type: 'trustpilot_reviews',
    icon: 'review',
    apifyActor: 'apify/trustpilot-scraper',
    category: 'reviews',
  },
  {
    id: 'g2-reviews',
    name: 'G2 Reviews',
    description: 'Reseñas de software en G2 Crowd',
    source: 'scraping',
    source_type: 'g2_reviews',
    icon: 'review',
    apifyActor: 'curious_coder/g2-scraper',
    category: 'reviews',
  },
  {
    id: 'capterra-reviews',
    name: 'Capterra Reviews',
    description: 'Reseñas de software en Capterra',
    source: 'scraping',
    source_type: 'capterra_reviews',
    icon: 'review',
    apifyActor: 'curious_coder/capterra-scraper',
    category: 'reviews',
  },
  {
    id: 'play-store-reviews',
    name: 'Play Store Reviews',
    description: 'Reseñas de la app en Google Play Store',
    source: 'scraping',
    source_type: 'playstore_reviews',
    icon: 'review',
    apifyActor: 'apify/google-play-scraper',
    category: 'reviews',
  },
  {
    id: 'app-store-reviews',
    name: 'App Store Reviews',
    description: 'Reseñas de la app en Apple App Store',
    source: 'scraping',
    source_type: 'appstore_reviews',
    icon: 'review',
    apifyActor: 'apify/app-store-scraper',
    category: 'reviews',
  },
]

// ============================================
// DOCUMENT CATEGORIES
// ============================================

export const DOCUMENT_CATEGORIES = {
  research: {
    label: 'Deep Research',
    description: 'Investigación profunda con IA',
    icon: 'research',
  },
  website: {
    label: 'Website & SEO',
    description: 'Contenido web y posicionamiento',
    icon: 'globe',
  },
  social_posts: {
    label: 'Redes Sociales (Posts)',
    description: 'Publicaciones del competidor',
    icon: 'social',
  },
  social_comments: {
    label: 'Redes Sociales (Comments)',
    description: 'Comentarios de usuarios',
    icon: 'social',
  },
  reviews: {
    label: 'Reviews',
    description: 'Reseñas de clientes',
    icon: 'review',
  },
  seo: {
    label: 'SEO & Medios',
    description: 'SEO y menciones en prensa',
    icon: 'search',
  },
} as const

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get all required variables (for form validation)
 */
export function getRequiredVariables(): VariableDefinition[] {
  return COMPETITOR_VARIABLE_DEFINITIONS.filter((v) => v.required)
}

/**
 * Get all document requirements for a specific step
 */
export function getDocumentsForStep(stepId: string): DocumentRequirement[] {
  const stepReq = STEP_DOCUMENT_REQUIREMENTS.find((s) => s.stepId === stepId)
  if (!stepReq) return []

  return ALL_DOCUMENT_REQUIREMENTS.filter((doc) =>
    stepReq.source_types.includes(doc.source_type)
  )
}

/**
 * Get documents grouped by category
 */
export function getDocumentsByCategory(): Record<string, DocumentRequirement[]> {
  return ALL_DOCUMENT_REQUIREMENTS.reduce(
    (acc, doc) => {
      if (!acc[doc.category]) acc[doc.category] = []
      acc[doc.category].push(doc)
      return acc
    },
    {} as Record<string, DocumentRequirement[]>
  )
}

/**
 * Get the scraper input mapping for a document
 */
export function getScraperInputForDocument(docId: string): ScraperInputMapping | null {
  return SCRAPER_INPUT_MAPPINGS[docId] || null
}

/**
 * Get total number of documents (excluding Deep Research)
 */
export function getTotalScrapingDocuments(): number {
  return ALL_DOCUMENT_REQUIREMENTS.filter((d) => d.source === 'scraping').length
}

/**
 * Get total number of all documents (including Deep Research)
 */
export function getTotalDocuments(): number {
  return ALL_DOCUMENT_REQUIREMENTS.length
}

// ============================================
// SOURCE TYPE TO SCRAPER TYPE MAPPING
// ============================================

/**
 * Maps playbook source_type to the actual scraper_type used by the API.
 * deep_research is not a scraper - it uses Gemini.
 */
export const SOURCE_TYPE_TO_SCRAPER_TYPE: Record<SourceType, string | null> = {
  // Deep Research - not a scraper
  deep_research: null,

  // Website & SEO
  website: 'website',
  seo_serp: 'seo_competitor_keywords',
  news_corpus: 'news_bing',

  // Social Posts
  instagram_posts: 'instagram_posts_comments',
  facebook_posts: 'facebook_posts',
  linkedin_posts: 'linkedin_company_posts',
  linkedin_insights: 'linkedin_company_insights',
  youtube_videos: 'youtube_channel_videos',
  tiktok_posts: 'tiktok_posts',

  // Social Comments
  instagram_comments: 'instagram_posts_comments',
  facebook_comments: 'facebook_comments',
  linkedin_comments: 'linkedin_comments',
  youtube_comments: 'youtube_comments',
  tiktok_comments: 'tiktok_comments',

  // Reviews
  trustpilot_reviews: 'trustpilot_reviews',
  g2_reviews: 'g2_reviews',
  capterra_reviews: 'capterra_reviews',
  playstore_reviews: 'playstore_reviews',
  appstore_reviews: 'appstore_reviews',
}

/**
 * Get the scraper type for a given source type
 */
export function getScraperTypeForSource(sourceType: SourceType): string | null {
  return SOURCE_TYPE_TO_SCRAPER_TYPE[sourceType]
}

/**
 * Maps storage keys (from ScraperConfigModal) to Apify-expected input keys.
 * Storage uses descriptive keys like 'instagram_username', but Apify actors
 * expect specific keys like 'username', 'startUrls', 'profiles', etc.
 */
const STORAGE_TO_APIFY_KEY_MAP: Record<string, string> = {
  // Instagram
  instagram_username: 'username',
  // Facebook - needs startUrls array
  facebook_url: 'startUrls',
  // LinkedIn
  linkedin_url: 'company_name', // for posts: uses company name extracted from URL
  // YouTube - needs startUrls array
  youtube_url: 'startUrls',
  // TikTok - needs profiles array
  tiktok_username: 'profiles',
  // Trustpilot - needs companyDomain
  trustpilot_url: 'companyDomain',
  // G2 - needs product URL
  g2_url: 'product',
  // Capterra - needs startUrls array
  capterra_url: 'startUrls',
  // App stores - need startUrls array
  play_store_app_id: 'startUrls',
  app_store_app_id: 'startUrls',
  // Website
  competitor_website: 'url',
  // News uses queries (array for news_bing)
  competitor_name: 'queries',
}

/**
 * Transform user input value to the format Apify expects.
 * Some scrapers need arrays, some need extracted domains, etc.
 */
function transformInputValue(
  storageKey: string,
  value: string,
  sourceType: SourceType
): unknown {
  // Handle news_corpus: competitor_name → queries array for news_bing
  if (storageKey === 'competitor_name' && sourceType === 'news_corpus') {
    return [value]
  }

  // Handle URL-to-array transformations
  if (['facebook_url', 'youtube_url', 'capterra_url'].includes(storageKey)) {
    return [value] // Apify expects array of URLs
  }

  // Handle app store URLs - need to build full URL from app ID
  if (storageKey === 'play_store_app_id') {
    return [`https://play.google.com/store/apps/details?id=${value}`]
  }
  if (storageKey === 'app_store_app_id') {
    return [`https://apps.apple.com/app/id${value}`]
  }

  // Handle TikTok username - needs to be in profiles array format
  if (storageKey === 'tiktok_username') {
    const username = value.startsWith('@') ? value.slice(1) : value
    return [`https://www.tiktok.com/@${username}`]
  }

  // Handle Trustpilot URL - extract domain
  if (storageKey === 'trustpilot_url') {
    try {
      // If it's a full URL, extract the domain from it
      if (value.includes('trustpilot.com/review/')) {
        const match = value.match(/trustpilot\.com\/review\/([^/?]+)/)
        return match ? match[1] : value
      }
      // If it's already a domain, use it directly
      return value.replace(/^https?:\/\//, '').replace(/\/$/, '')
    } catch {
      return value
    }
  }

  // Handle G2 URL - use full URL
  if (storageKey === 'g2_url') {
    return value
  }

  // Handle LinkedIn URL - extract company name for posts scraper
  if (storageKey === 'linkedin_url') {
    try {
      const match = value.match(/linkedin\.com\/company\/([^/?]+)/)
      if (match) {
        return match[1] // Return company slug
      }
      // For insights, we need the full URLs array
      if (sourceType === 'linkedin_insights') {
        return [value]
      }
    } catch {
      // Fall through
    }
    return value
  }

  // Handle website URL
  if (storageKey === 'competitor_website') {
    // For SEO, extract just the domain
    if (sourceType === 'seo_serp') {
      try {
        const url = new URL(value.startsWith('http') ? value : `https://${value}`)
        return url.hostname.replace(/^www\./, '')
      } catch {
        return value
      }
    }
    return value
  }

  // Default: return as-is
  return value
}

/**
 * Build input config for a scraper based on source type and user input
 */
export function buildScraperInputConfig(
  sourceType: SourceType,
  userInput: string,
  docId: string
): Record<string, unknown> {
  const inputMapping = SCRAPER_INPUT_MAPPINGS[docId]
  if (!inputMapping) {
    return {}
  }

  // Get the Apify-expected key for this storage key
  const storageKey = inputMapping.inputKey
  const apifyKey = STORAGE_TO_APIFY_KEY_MAP[storageKey] || storageKey

  // Transform the value to the format Apify expects
  const transformedValue = transformInputValue(storageKey, userInput, sourceType)

  const inputConfig: Record<string, unknown> = {
    [apifyKey]: transformedValue,
  }

  // Add specific defaults based on source type
  // Note: These are SourceType values (playbook types), not scraper_type values
  const scraperDefaults: Record<string, Record<string, unknown>> = {
    // Instagram uses same actor for posts and comments
    instagram_posts: { resultsLimit: 200, resultsType: 'posts' },
    instagram_comments: { resultsLimit: 200, resultsType: 'comments' },
    // TikTok
    tiktok_posts: { resultsPerPage: 50, profileSorting: 'latest' },
    tiktok_comments: { commentsPerPost: 100 },
    // LinkedIn
    linkedin_posts: { limit: 50, sort: 'recent' },
    linkedin_comments: { limit: 100 },
    linkedin_insights: { get_alumni: true, get_new_hires: true },
    // YouTube
    youtube_videos: { maxResults: 50, sortVideosBy: 'NEWEST' },
    youtube_comments: { maxComments: 100 },
    // Facebook
    facebook_posts: { resultsLimit: 50 },
    facebook_comments: { resultsLimit: 100 },
    // Reviews
    trustpilot_reviews: { count: 100, languages: ['es'] },
    g2_reviews: { max_reviews: 200 },
    capterra_reviews: { maxReviews: 100 },
    playstore_reviews: { maxItems: 100, language: 'es', country: 'ES', sort: 'NEWEST' },
    appstore_reviews: { maxItems: 100, country: 'us' },
    // SEO & News
    news_corpus: { country: 'es-ES', maxPages: 10, maxArticles: 50, extractContent: true },
    seo_serp: {},
    website: {},
  }

  const defaults = scraperDefaults[sourceType]
  if (defaults) {
    Object.assign(inputConfig, defaults)
  }

  return inputConfig
}
