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

export const SCRAPER_INPUT_MAPPINGS: Record<string, ScraperInputMapping> = {
  // Website & SEO
  'web-scraping': {
    inputKey: 'url',
    label: 'Website URL',
    placeholder: 'https://competitor.com',
    type: 'url',
    required: true,
  },
  'seo-serp': {
    inputKey: 'domain',
    label: 'Domain',
    placeholder: 'competitor.com',
    type: 'text',
    required: true,
  },
  'news-corpus': {
    inputKey: 'query',
    label: 'Search Query',
    placeholder: '{{competitor_name}}',
    type: 'text',
    required: true,
  },

  // Social Posts
  'ig-posts': {
    inputKey: 'username',
    label: 'Instagram Username',
    placeholder: 'competitor',
    type: 'text',
    required: true,
  },
  'fb-posts': {
    inputKey: 'url',
    label: 'Facebook Page URL',
    placeholder: 'https://facebook.com/competitor',
    type: 'url',
    required: true,
  },
  'li-posts': {
    inputKey: 'companyUrl',
    label: 'LinkedIn Company URL',
    placeholder: 'https://linkedin.com/company/competitor',
    type: 'url',
    required: true,
  },
  'li-insights': {
    inputKey: 'companyUrl',
    label: 'LinkedIn Company URL',
    placeholder: 'https://linkedin.com/company/competitor',
    type: 'url',
    required: true,
  },
  'tiktok-posts': {
    inputKey: 'username',
    label: 'TikTok Username',
    placeholder: '@competitor',
    type: 'text',
    required: true,
  },
  'yt-videos': {
    inputKey: 'channelUrl',
    label: 'YouTube Channel URL',
    placeholder: 'https://youtube.com/@competitor',
    type: 'url',
    required: true,
  },

  // Social Comments
  'ig-comments': {
    inputKey: 'username',
    label: 'Instagram Username',
    placeholder: 'competitor',
    type: 'text',
    required: true,
  },
  'fb-comments': {
    inputKey: 'url',
    label: 'Facebook Page URL',
    placeholder: 'https://facebook.com/competitor',
    type: 'url',
    required: true,
  },
  'li-comments': {
    inputKey: 'postUrls',
    label: 'LinkedIn Post URLs (uno por línea)',
    placeholder: 'https://linkedin.com/posts/...',
    type: 'textarea',
    required: true,
  },
  'tiktok-comments': {
    inputKey: 'username',
    label: 'TikTok Username',
    placeholder: '@competitor',
    type: 'text',
    required: true,
  },
  'yt-comments': {
    inputKey: 'videoUrls',
    label: 'YouTube Video URLs (uno por línea)',
    placeholder: 'https://youtube.com/watch?v=...',
    type: 'textarea',
    required: true,
  },

  // Reviews
  'trustpilot-reviews': {
    inputKey: 'url',
    label: 'Trustpilot URL',
    placeholder: 'https://trustpilot.com/review/competitor.com',
    type: 'url',
    required: true,
  },
  'g2-reviews': {
    inputKey: 'url',
    label: 'G2 Product URL',
    placeholder: 'https://g2.com/products/competitor',
    type: 'url',
    required: true,
  },
  'capterra-reviews': {
    inputKey: 'url',
    label: 'Capterra URL',
    placeholder: 'https://capterra.com/p/...',
    type: 'url',
    required: true,
  },
  'play-store-reviews': {
    inputKey: 'appId',
    label: 'Play Store App ID',
    placeholder: 'com.competitor.app',
    type: 'text',
    required: true,
  },
  'app-store-reviews': {
    inputKey: 'appId',
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
  news_corpus: 'google_news',

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

  const inputConfig: Record<string, unknown> = {
    [inputMapping.inputKey]: userInput,
  }

  // Add specific defaults based on source type
  // Note: These are SourceType values (playbook types), not scraper_type values
  const scraperDefaults: Record<string, Record<string, unknown>> = {
    // Instagram uses same actor for posts and comments
    instagram_posts: { resultsLimit: 200, resultsType: 'posts' },
    instagram_comments: { resultsLimit: 200, resultsType: 'posts' },
    // TikTok
    tiktok_posts: { resultsPerPage: 50, profileSorting: 'latest' },
    tiktok_comments: { commentsPerPost: 100 },
    // LinkedIn
    linkedin_posts: { limit: 50, sort: 'recent' },
    linkedin_comments: { limit: 100 },
    linkedin_insights: {},
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
    news_corpus: { maxItems: 50, language: 'es', country: 'ES' },
    seo_serp: {},
    website: {},
  }

  const defaults = scraperDefaults[sourceType]
  if (defaults) {
    Object.assign(inputConfig, defaults)
  }

  return inputConfig
}
