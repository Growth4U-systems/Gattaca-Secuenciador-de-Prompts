/**
 * Scraper Field Schemas
 * Complete validation and guidance for each scraper input field
 */

import { ScraperType } from '@/types/scraper.types';

// ============================================
// FIELD TYPES
// ============================================

export type FieldType =
  | 'url'           // Single URL
  | 'url-array'     // Multiple URLs (newline separated)
  | 'text'          // Free text
  | 'text-array'    // Multiple text values (newline separated)
  | 'number'        // Integer
  | 'select'        // Dropdown with fixed options
  | 'multi-select'  // Multiple selection from fixed options
  | 'boolean'       // Checkbox
  | 'date';         // Date picker

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface FieldSchema {
  key: string;
  type: FieldType;
  label: string;
  description: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;

  // Validation
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    patternMessage?: string;
  };

  // For select/multi-select
  options?: SelectOption[];

  // Default value
  defaultValue?: unknown;

  // Examples to show user
  examples?: string[];
}

export interface ScraperFieldsSchema {
  type: ScraperType;
  fields: Record<string, FieldSchema>;
}

// ============================================
// COMMON FIELD DEFINITIONS
// ============================================

const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'es', label: 'Espa\u00f1ol', description: 'Espa\u00f1a y Latinoam\u00e9rica' },
  { value: 'en', label: 'Ingl\u00e9s', description: 'Estados Unidos y Reino Unido' },
  { value: 'pt', label: 'Portugu\u00e9s', description: 'Portugal y Brasil' },
  { value: 'fr', label: 'Franc\u00e9s', description: 'Francia' },
  { value: 'de', label: 'Alem\u00e1n', description: 'Alemania y Austria' },
  { value: 'it', label: 'Italiano', description: 'Italia' },
  { value: 'nl', label: 'Neerland\u00e9s', description: 'Pa\u00edses Bajos' },
  { value: 'pl', label: 'Polaco', description: 'Polonia' },
];

const STAR_RATING_OPTIONS: SelectOption[] = [
  { value: '1', label: '1 estrella', description: 'Solo reviews muy negativas' },
  { value: '2', label: '2 estrellas', description: 'Reviews negativas' },
  { value: '3', label: '3 estrellas', description: 'Reviews neutras' },
  { value: '4', label: '4 estrellas', description: 'Reviews positivas' },
  { value: '5', label: '5 estrellas', description: 'Reviews muy positivas' },
];

// ============================================
// TRUSTPILOT-SPECIFIC OPTIONS
// ============================================
const TRUSTPILOT_DATE_OPTIONS: SelectOption[] = [
  { value: 'last30days', label: 'Últimos 30 días', description: 'Reviews del último mes' },
  { value: 'last3months', label: 'Últimos 3 meses', description: 'Reviews del último trimestre' },
  { value: 'last6months', label: 'Últimos 6 meses', description: 'Reviews del último semestre' },
  { value: 'last12months', label: 'Último año', description: 'Reviews del último año' },
];

// ============================================
// LINKEDIN-SPECIFIC OPTIONS
// ============================================
const LINKEDIN_SORT_OPTIONS: SelectOption[] = [
  { value: 'recent', label: 'Más recientes', description: 'Posts más nuevos primero' },
  { value: 'top', label: 'Más populares', description: 'Posts con más interacción' },
];

const LINKEDIN_COMMENTS_SORT_OPTIONS: SelectOption[] = [
  { value: 'most recent', label: 'Más recientes', description: 'Comentarios más nuevos primero' },
  { value: 'most relevant', label: 'Más relevantes', description: 'Comentarios con más interacción' },
];

// ============================================
// YOUTUBE-SPECIFIC OPTIONS
// ============================================
const YOUTUBE_COMMENTS_SORT_OPTIONS: SelectOption[] = [
  { value: 'top', label: 'Más populares', description: 'Comentarios con más likes' },
  { value: 'latest', label: 'Más recientes', description: 'Comentarios más nuevos primero' },
];

// ============================================
// GOOGLE MAPS-SPECIFIC OPTIONS
// ============================================
const GOOGLE_MAPS_SORT_OPTIONS: SelectOption[] = [
  { value: 'newest', label: 'Más recientes', description: 'Reviews más nuevas primero' },
  { value: 'mostRelevant', label: 'Más relevantes', description: 'Reviews más útiles' },
  { value: 'highestRanking', label: 'Mejor puntuación', description: 'Reviews de 5 estrellas primero' },
  { value: 'lowestRanking', label: 'Peor puntuación', description: 'Reviews de 1 estrella primero' },
];

// ============================================
// PLAYSTORE-SPECIFIC OPTIONS
// ============================================
const PLAYSTORE_SORT_OPTIONS: SelectOption[] = [
  { value: 'NEWEST', label: 'Más recientes', description: 'Reviews más nuevas primero' },
  { value: 'RATING', label: 'Por puntuación', description: 'Ordenar por rating' },
  { value: 'HELPFULNESS', label: 'Más útiles', description: 'Reviews marcadas como útiles' },
];

// País en MAYÚSCULAS para Play Store
const PLAYSTORE_COUNTRY_OPTIONS: SelectOption[] = [
  { value: 'ES', label: 'España' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'GB', label: 'Reino Unido' },
  { value: 'MX', label: 'México' },
  { value: 'AR', label: 'Argentina' },
  { value: 'BR', label: 'Brasil' },
  { value: 'DE', label: 'Alemania' },
  { value: 'FR', label: 'Francia' },
];

// País en minúsculas para App Store
const APPSTORE_COUNTRY_OPTIONS: SelectOption[] = [
  { value: 'es', label: 'España' },
  { value: 'us', label: 'Estados Unidos' },
  { value: 'gb', label: 'Reino Unido' },
  { value: 'mx', label: 'México' },
  { value: 'ar', label: 'Argentina' },
  { value: 'br', label: 'Brasil' },
  { value: 'de', label: 'Alemania' },
  { value: 'fr', label: 'Francia' },
];

// ============================================
// TIKTOK-SPECIFIC OPTIONS
// ============================================
const TIKTOK_PROXY_COUNTRY_OPTIONS: SelectOption[] = [
  { value: 'None', label: 'Sin proxy', description: 'Usar IP directa' },
  { value: 'ES', label: 'España' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'GB', label: 'Reino Unido' },
  { value: 'MX', label: 'México' },
  { value: 'AR', label: 'Argentina' },
  { value: 'CO', label: 'Colombia' },
  { value: 'BR', label: 'Brasil' },
  { value: 'DE', label: 'Alemania' },
  { value: 'FR', label: 'Francia' },
];

const TIKTOK_SORTING_OPTIONS: SelectOption[] = [
  { value: 'latest', label: 'Más recientes', description: 'Videos más nuevos primero' },
  { value: 'popular', label: 'Más populares', description: 'Videos con más vistas' },
  { value: 'oldest', label: 'Más antiguos', description: 'Videos más viejos primero' },
];

// ============================================
// INSTAGRAM-SPECIFIC OPTIONS
// ============================================
const INSTAGRAM_RESULTS_TYPE_OPTIONS: SelectOption[] = [
  { value: 'posts', label: 'Posts', description: 'Imágenes y carruseles' },
  { value: 'comments', label: 'Comentarios', description: 'Comentarios de posts' },
  { value: 'details', label: 'Detalles del perfil', description: 'Información del perfil' },
  { value: 'mentions', label: 'Menciones', description: 'Posts donde se menciona' },
  { value: 'reels', label: 'Reels', description: 'Videos cortos' },
  { value: 'stories', label: 'Stories', description: 'Historias activas' },
];

// ============================================
// FIRECRAWL MODE OPTIONS
// ============================================
const FIRECRAWL_MODE_OPTIONS: SelectOption[] = [
  { value: 'scrape', label: 'Página única', description: 'Extrae solo la URL indicada' },
  { value: 'crawl', label: 'Crawl (múltiples páginas)', description: 'Navega y extrae varias páginas del sitio' },
  { value: 'map', label: 'Mapa de URLs', description: 'Descubre todas las URLs del sitio sin extraer contenido' },
];

// ============================================
// SCRAPER-SPECIFIC FIELD SCHEMAS
// ============================================

export const SCRAPER_FIELD_SCHEMAS: Record<ScraperType, ScraperFieldsSchema> = {
  // ==========================================
  // WEBSITE (FIRECRAWL)
  // ==========================================
  website: {
    type: 'website',
    fields: {
      url: {
        key: 'url',
        type: 'url',
        label: 'URL del sitio web',
        description: 'La URL base del sitio que quieres extraer',
        placeholder: 'https://ejemplo.com',
        helpText: 'Incluye https:// al inicio',
        required: true,
        validation: {
          pattern: /^https?:\/\/.+/,
          patternMessage: 'Debe ser una URL válida (https://...)',
        },
        examples: [
          'https://www.revolut.com/es-ES/',
          'https://n26.com/es-es',
          'https://wise.com/es/',
        ],
      },
      mode: {
        key: 'mode',
        type: 'select',
        label: 'Modo de extracción',
        description: 'Cómo quieres extraer el contenido',
        options: FIRECRAWL_MODE_OPTIONS,
        defaultValue: 'scrape',
        helpText: 'Página única para una sola URL, Crawl para varias páginas',
      },
      // Crawl-specific fields
      includePaths: {
        key: 'includePaths',
        type: 'text-array',
        label: 'Incluir rutas (regex)',
        description: 'Solo extraer páginas que coincidan con estos patrones',
        placeholder: 'pricing.*\nproduct.*\nabout',
        helpText: 'Un patrón por línea. Ej: "pricing.*" incluye /pricing, /pricing/enterprise, etc.',
        examples: [
          'pricing.*',
          'product/.*',
          'features',
          'about|team|careers',
        ],
      },
      excludePaths: {
        key: 'excludePaths',
        type: 'text-array',
        label: 'Excluir rutas (regex)',
        description: 'No extraer páginas que coincidan con estos patrones',
        placeholder: 'blog.*\nlegal.*\nterms',
        helpText: 'Un patrón por línea. Ej: "blog.*" excluye /blog y sus subpáginas.',
        examples: [
          'blog.*',
          'legal.*',
          'help/.*',
          'privacy|terms|cookies',
        ],
      },
      limit: {
        key: 'limit',
        type: 'number',
        label: 'Límite de páginas',
        description: 'Número máximo de páginas a extraer',
        helpText: 'Recomendado: 10-50 para empezar. Máximo: 100.',
        defaultValue: 10,
        validation: {
          min: 1,
          max: 100,
        },
      },
      maxDepth: {
        key: 'maxDepth',
        type: 'number',
        label: 'Profundidad máxima',
        description: 'Cuántos niveles de links seguir desde la URL inicial',
        helpText: '1 = solo la página inicial, 2 = +links directos, 3+ = más profundidad',
        defaultValue: 2,
        validation: {
          min: 1,
          max: 5,
        },
      },
      // Common fields
      formats: {
        key: 'formats',
        type: 'multi-select',
        label: 'Formatos de salida',
        description: 'En qué formato quieres el contenido extraído',
        options: [
          { value: 'markdown', label: 'Markdown', description: 'Texto formateado (recomendado)' },
          { value: 'html', label: 'HTML', description: 'Código HTML completo' },
          { value: 'text', label: 'Texto plano', description: 'Sin formato' },
        ],
        defaultValue: ['markdown'],
      },
      onlyMainContent: {
        key: 'onlyMainContent',
        type: 'boolean',
        label: 'Solo contenido principal',
        description: 'Excluye headers, footers y sidebars',
        defaultValue: true,
      },
      waitFor: {
        key: 'waitFor',
        type: 'number',
        label: 'Esperar (ms)',
        description: 'Milisegundos a esperar para que cargue JavaScript',
        helpText: 'Usa 0 para páginas estáticas, 2000-5000 para SPAs',
        defaultValue: 0,
        validation: {
          min: 0,
          max: 30000,
        },
        examples: ['0', '2000', '5000'],
      },
    },
  },

  // ==========================================
  // TRUSTPILOT REVIEWS
  // ==========================================
  trustpilot_reviews: {
    type: 'trustpilot_reviews',
    fields: {
      companyDomain: {
        key: 'companyDomain',
        type: 'text',
        label: 'Dominio de la empresa',
        description: 'El dominio de la empresa tal como aparece en Trustpilot',
        placeholder: 'revolut.com',
        helpText: 'Solo el dominio, sin https:// ni www.',
        required: true,
        validation: {
          pattern: /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/,
          patternMessage: 'Formato: dominio.com (ej: revolut.com)',
        },
        examples: [
          'revolut.com',
          'n26.com',
          'wise.com',
          'paypal.com',
        ],
      },
      count: {
        key: 'count',
        type: 'number',
        label: 'Cantidad de reviews',
        description: 'N\u00famero m\u00e1ximo de reviews a extraer',
        helpText: 'Entre 10 y 1000. M\u00e1s reviews = m\u00e1s tiempo',
        defaultValue: 100,
        validation: {
          min: 10,
          max: 1000,
        },
      },
      languages: {
        key: 'languages',
        type: 'multi-select',
        label: 'Idiomas',
        description: 'Filtrar reviews por idioma',
        helpText: 'Selecciona uno o m\u00e1s idiomas',
        options: LANGUAGE_OPTIONS,
        defaultValue: ['es'],
      },
      stars: {
        key: 'stars',
        type: 'multi-select',
        label: 'Filtrar por estrellas',
        description: 'Solo traer reviews con estas calificaciones',
        helpText: 'Deja vac\u00edo para todas las calificaciones',
        options: STAR_RATING_OPTIONS,
      },
      date: {
        key: 'date',
        type: 'select',
        label: 'Filtrar por fecha',
        description: 'Periodo de tiempo de las reviews',
        options: TRUSTPILOT_DATE_OPTIONS,
      },
    },
  },

  // ==========================================
  // INSTAGRAM POSTS & COMMENTS
  // ==========================================
  instagram_posts_comments: {
    type: 'instagram_posts_comments',
    fields: {
      username: {
        key: 'username',
        type: 'text-array',
        label: 'Usernames de Instagram',
        description: 'Nombres de usuario de Instagram (sin @)',
        placeholder: 'revolut\nn26\nwiseaccount',
        helpText: 'Un username por línea, sin @ ni URL.',
        required: true,
        validation: {
          pattern: /^[a-zA-Z0-9_.]+$/,
          patternMessage: 'Solo letras, números, puntos y guiones bajos',
        },
        examples: [
          'revolut',
          'n26',
          'wiseaccount',
        ],
      },
      resultsLimit: {
        key: 'resultsLimit',
        type: 'number',
        label: 'Límite de resultados',
        description: 'Número máximo de posts a extraer por perfil',
        helpText: 'Entre 10 y 200',
        defaultValue: 200,
        validation: {
          min: 10,
          max: 500,
        },
      },
      resultsType: {
        key: 'resultsType',
        type: 'select',
        label: 'Tipo de contenido',
        description: 'Qué tipo de publicaciones extraer',
        options: INSTAGRAM_RESULTS_TYPE_OPTIONS,
        defaultValue: 'posts',
      },
    },
  },

  // ==========================================
  // TIKTOK POSTS
  // ==========================================
  tiktok_posts: {
    type: 'tiktok_posts',
    fields: {
      profiles: {
        key: 'profiles',
        type: 'text-array',
        label: 'Perfiles de TikTok',
        description: 'Nombres de usuario de TikTok (con o sin @)',
        placeholder: '@usuario\nrevolutapp\nn26bank',
        helpText: 'Un perfil por línea. Puedes usar @usuario o solo el nombre.',
        required: true,
        examples: [
          '@revolut',
          'n26bank',
          '@wiseaccount',
        ],
      },
      hashtags: {
        key: 'hashtags',
        type: 'text-array',
        label: 'Hashtags',
        description: 'Hashtags para buscar videos (sin #)',
        placeholder: 'fintech\ndinero\nahorro',
        helpText: 'Un hashtag por línea, sin el símbolo #',
        examples: [
          'fintech',
          'investing',
          'crypto',
        ],
      },
      searchQueries: {
        key: 'searchQueries',
        type: 'text-array',
        label: 'Búsquedas',
        description: 'Términos de búsqueda para encontrar videos',
        placeholder: 'mejor app bancaria\ncómo ahorrar dinero',
        helpText: 'Una búsqueda por línea',
        examples: [
          'mejor app bancaria',
          'fintech españa',
        ],
      },
      resultsPerPage: {
        key: 'resultsPerPage',
        type: 'number',
        label: 'Videos a extraer',
        description: 'Número de videos a extraer por cada perfil/hashtag/búsqueda',
        helpText: 'Recomendado: 20-100. Máximo: 1000',
        defaultValue: 50,
        validation: {
          min: 1,
          max: 1000,
        },
      },
      profileSorting: {
        key: 'profileSorting',
        type: 'select',
        label: 'Ordenar videos',
        description: 'Cómo ordenar los videos del perfil',
        options: TIKTOK_SORTING_OPTIONS,
        defaultValue: 'latest',
      },
      proxyCountryCode: {
        key: 'proxyCountryCode',
        type: 'select',
        label: 'País del proxy',
        description: 'Desde qué país se hará la consulta',
        helpText: 'Afecta qué contenido se ve (algunos videos están geo-restringidos)',
        options: TIKTOK_PROXY_COUNTRY_OPTIONS,
        defaultValue: 'ES',
      },
      commentsPerPost: {
        key: 'commentsPerPost',
        type: 'number',
        label: 'Comentarios por video',
        description: 'También extraer comentarios de cada video (0 = no extraer)',
        helpText: 'Deja en 0 si solo quieres los posts. Usar valor mayor a 0 incrementa el coste.',
        defaultValue: 0,
        validation: {
          min: 0,
          max: 500,
        },
      },
    },
  },

  // ==========================================
  // LINKEDIN COMPANY POSTS
  // ==========================================
  linkedin_company_posts: {
    type: 'linkedin_company_posts',
    fields: {
      company_name: {
        key: 'company_name',
        type: 'text',
        label: 'Empresa en LinkedIn',
        description: 'Nombre de la empresa o URL de su p\u00e1gina en LinkedIn',
        placeholder: 'google o linkedin.com/company/google',
        helpText: 'Puedes usar el nombre corto o la URL completa',
        required: true,
        examples: [
          'revolut',
          'n26',
          'linkedin.com/company/wise',
          'https://www.linkedin.com/company/paypal/',
        ],
      },
      limit: {
        key: 'limit',
        type: 'number',
        label: 'L\u00edmite de posts',
        description: 'N\u00famero m\u00e1ximo de publicaciones a extraer',
        helpText: 'Entre 10 y 100',
        defaultValue: 50,
        validation: {
          min: 10,
          max: 100,
        },
      },
      sort: {
        key: 'sort',
        type: 'select',
        label: 'Ordenar por',
        description: 'Cómo ordenar los resultados',
        options: LINKEDIN_SORT_OPTIONS,
        defaultValue: 'recent',
      },
    },
  },

  // ==========================================
  // TIKTOK COMMENTS
  // ==========================================
  tiktok_comments: {
    type: 'tiktok_comments',
    fields: {
      postURLs: {
        key: 'postURLs',
        type: 'url-array',
        label: 'URLs de videos de TikTok',
        description: 'URLs completas de los videos de los que quieres extraer comentarios',
        placeholder: 'https://www.tiktok.com/@user/video/1234567890',
        helpText: 'Una URL por línea. Copia la URL del video desde TikTok.',
        required: true,
        validation: {
          pattern: /^https:\/\/(www\.)?(tiktok\.com\/@[^/]+\/video\/\d+|vm\.tiktok\.com\/[a-zA-Z0-9]+)/,
          patternMessage: 'Formato: https://www.tiktok.com/@usuario/video/ID o https://vm.tiktok.com/...',
        },
        examples: [
          'https://www.tiktok.com/@revolut/video/7234567890123456789',
          'https://vm.tiktok.com/ZM6example/',
        ],
      },
      commentsPerPost: {
        key: 'commentsPerPost',
        type: 'number',
        label: 'Comentarios por video',
        description: 'Número máximo de comentarios a extraer por video',
        helpText: 'Recomendado: 50-200. Más comentarios = más tiempo y coste.',
        defaultValue: 100,
        validation: {
          min: 1,
          max: 1000,
        },
      },
      maxRepliesPerComment: {
        key: 'maxRepliesPerComment',
        type: 'number',
        label: 'Respuestas por comentario',
        description: 'También extraer respuestas a los comentarios (0 = solo comentarios principales)',
        helpText: 'Deja en 0 para solo comentarios principales. Mayor valor = más datos y coste.',
        defaultValue: 0,
        validation: {
          min: 0,
          max: 100,
        },
      },
    },
  },

  // ==========================================
  // LINKEDIN COMMENTS
  // ==========================================
  linkedin_comments: {
    type: 'linkedin_comments',
    fields: {
      postIds: {
        key: 'postIds',
        type: 'text-array',
        label: 'IDs o URLs de posts',
        description: 'IDs de posts de LinkedIn o URLs completas',
        placeholder: 'urn:li:activity:1234567890\nhttps://linkedin.com/posts/...',
        helpText: 'Una URL o ID por l\u00ednea',
        required: true,
        examples: [
          'urn:li:activity:7123456789012345678',
          'https://www.linkedin.com/posts/company_activity-123-xyz',
        ],
      },
      limit: {
        key: 'limit',
        type: 'number',
        label: 'L\u00edmite de comentarios',
        description: 'N\u00famero m\u00e1ximo de comentarios por post',
        defaultValue: 100,
        validation: {
          min: 10,
          max: 500,
        },
      },
      sortOrder: {
        key: 'sortOrder',
        type: 'select',
        label: 'Orden de comentarios',
        description: 'Cómo ordenar los comentarios',
        options: LINKEDIN_COMMENTS_SORT_OPTIONS,
        defaultValue: 'most recent',
      },
    },
  },

  // ==========================================
  // FACEBOOK POSTS
  // ==========================================
  facebook_posts: {
    type: 'facebook_posts',
    fields: {
      startUrls: {
        key: 'startUrls',
        type: 'url-array',
        label: 'URLs de p\u00e1ginas de Facebook',
        description: 'URLs de las p\u00e1ginas de Facebook que quieres analizar',
        placeholder: 'https://www.facebook.com/revolut/',
        helpText: 'Una URL por l\u00ednea',
        required: true,
        examples: [
          'https://www.facebook.com/revolut/',
          'https://www.facebook.com/N26/',
        ],
      },
      resultsLimit: {
        key: 'resultsLimit',
        type: 'number',
        label: 'L\u00edmite de posts',
        description: 'N\u00famero m\u00e1ximo de posts a extraer',
        defaultValue: 50,
        validation: {
          min: 10,
          max: 200,
        },
      },
    },
  },

  // ==========================================
  // FACEBOOK COMMENTS
  // ==========================================
  facebook_comments: {
    type: 'facebook_comments',
    fields: {
      startUrls: {
        key: 'startUrls',
        type: 'url-array',
        label: 'URLs de posts de Facebook',
        description: 'URLs de los posts de los que quieres extraer comentarios',
        placeholder: 'https://www.facebook.com/revolut/posts/123456789',
        helpText: 'Una URL por l\u00ednea',
        required: true,
      },
      resultsLimit: {
        key: 'resultsLimit',
        type: 'number',
        label: 'L\u00edmite de comentarios',
        description: 'N\u00famero m\u00e1ximo de comentarios a extraer',
        defaultValue: 100,
        validation: {
          min: 10,
          max: 500,
        },
      },
    },
  },

  // ==========================================
  // LINKEDIN COMPANY INSIGHTS
  // ==========================================
  linkedin_company_insights: {
    type: 'linkedin_company_insights',
    fields: {
      companyUrls: {
        key: 'companyUrls',
        type: 'url-array',
        label: 'URLs de empresas en LinkedIn',
        description: 'URLs completas de las p\u00e1ginas de empresa en LinkedIn',
        placeholder: 'https://www.linkedin.com/company/revolut/',
        helpText: 'Una URL por l\u00ednea',
        required: true,
        validation: {
          pattern: /^https:\/\/(www\.)?linkedin\.com\/company\/[^/]+\/?$/,
          patternMessage: 'Formato: https://www.linkedin.com/company/nombre/',
        },
        examples: [
          'https://www.linkedin.com/company/revolut/',
          'https://www.linkedin.com/company/n26/',
        ],
      },
    },
  },

  // ==========================================
  // YOUTUBE CHANNEL VIDEOS
  // ==========================================
  youtube_channel_videos: {
    type: 'youtube_channel_videos',
    fields: {
      startUrls: {
        key: 'startUrls',
        type: 'url-array',
        label: 'URLs de canales de YouTube',
        description: 'URLs de los canales de los que quieres extraer videos',
        placeholder: 'https://www.youtube.com/@Revolut\nhttps://www.youtube.com/@N26',
        helpText: 'Una URL por línea. Formato: https://www.youtube.com/@NombreCanal',
        required: true,
        validation: {
          pattern: /^https:\/\/(www\.)?youtube\.com\/(@[a-zA-Z0-9_-]+|channel\/[a-zA-Z0-9_-]+|c\/[a-zA-Z0-9_-]+)/,
          patternMessage: 'Formato: https://www.youtube.com/@NombreCanal',
        },
        examples: [
          'https://www.youtube.com/@Revolut',
          'https://www.youtube.com/@N26',
          'https://www.youtube.com/@MrBeast',
        ],
      },
      maxResults: {
        key: 'maxResults',
        type: 'number',
        label: 'Videos a extraer',
        description: 'Número de videos regulares por canal',
        helpText: 'Deja en 0 para solo extraer metadatos del canal',
        defaultValue: 50,
        validation: {
          min: 0,
          max: 1000,
        },
      },
      maxResultsShorts: {
        key: 'maxResultsShorts',
        type: 'number',
        label: 'Shorts a extraer',
        description: 'Número de shorts por canal (0 = no extraer)',
        helpText: 'Shorts son videos cortos de menos de 60 segundos',
        defaultValue: 0,
        validation: {
          min: 0,
          max: 1000,
        },
      },
      maxResultStreams: {
        key: 'maxResultStreams',
        type: 'number',
        label: 'Streams a extraer',
        description: 'Número de livestreams por canal (0 = no extraer)',
        defaultValue: 0,
        validation: {
          min: 0,
          max: 1000,
        },
      },
      oldestPostDate: {
        key: 'oldestPostDate',
        type: 'text',
        label: 'Fecha límite',
        description: 'Solo extraer videos más recientes que esta fecha',
        placeholder: '2024-01-01 o "30 days"',
        helpText: 'Formato: YYYY-MM-DD o "X days" (ej: "30 days")',
      },
      sortVideosBy: {
        key: 'sortVideosBy',
        type: 'select',
        label: 'Ordenar videos',
        description: 'Cómo ordenar los videos',
        options: [
          { value: 'NEWEST', label: 'Más recientes' },
          { value: 'POPULAR', label: 'Más populares' },
          { value: 'OLDEST', label: 'Más antiguos' },
        ],
        defaultValue: 'NEWEST',
      },
    },
  },

  // ==========================================
  // YOUTUBE COMMENTS
  // ==========================================
  youtube_comments: {
    type: 'youtube_comments',
    fields: {
      startUrls: {
        key: 'startUrls',
        type: 'url-array',
        label: 'URLs de videos de YouTube',
        description: 'URLs de los videos de los que quieres extraer comentarios',
        placeholder: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        helpText: 'Una URL por línea',
        required: true,
        validation: {
          pattern: /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+/,
          patternMessage: 'Formato: https://www.youtube.com/watch?v=ID',
        },
        examples: [
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        ],
      },
      maxComments: {
        key: 'maxComments',
        type: 'number',
        label: 'Máximo de comentarios',
        description: 'Número máximo de comentarios por video',
        helpText: 'Recomendado: 100-500. Más comentarios = más tiempo y coste.',
        defaultValue: 100,
        validation: {
          min: 1,
          max: 5000,
        },
      },
      commentsSortBy: {
        key: 'commentsSortBy',
        type: 'select',
        label: 'Ordenar por',
        description: 'Cómo ordenar los comentarios',
        options: [
          { value: '0', label: 'Más relevantes (Top)' },
          { value: '1', label: 'Más recientes (Newest)' },
        ],
        defaultValue: '0',
      },
    },
  },

  // ==========================================
  // YOUTUBE TRANSCRIPTS
  // ==========================================
  youtube_transcripts: {
    type: 'youtube_transcripts',
    fields: {
      startUrls: {
        key: 'startUrls',
        type: 'url-array',
        label: 'URLs de videos de YouTube',
        description: 'URLs de los videos de los que quieres extraer transcripciones',
        placeholder: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        helpText: 'Una URL por línea. El video debe tener subtítulos disponibles.',
        required: true,
        validation: {
          pattern: /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+/,
          patternMessage: 'Formato: https://www.youtube.com/watch?v=ID',
        },
        examples: [
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        ],
      },
      timestamps: {
        key: 'timestamps',
        type: 'boolean',
        label: 'Incluir timestamps',
        description: 'Incluir marcas de tiempo en la transcripción',
        helpText: 'Si está activo, cada línea incluirá el tiempo en que aparece',
        defaultValue: true,
      },
    },
  },

  // ==========================================
  // G2 REVIEWS
  // ==========================================
  g2_reviews: {
    type: 'g2_reviews',
    fields: {
      product: {
        key: 'product',
        type: 'text',
        label: 'Nombre del producto en G2',
        description: 'El nombre o slug del producto tal como aparece en G2',
        placeholder: 'slack',
        helpText: 'Es la parte de la URL: g2.com/products/NOMBRE/reviews',
        required: true,
        examples: [
          'slack',
          'notion',
          'asana',
          'monday-com',
        ],
      },
      max_reviews: {
        key: 'max_reviews',
        type: 'number',
        label: 'Máximo de reviews',
        description: 'Número máximo de reviews a extraer (mínimo 200)',
        helpText: 'El actor de G2 requiere un mínimo de 200 reviews',
        defaultValue: 200,
        validation: {
          min: 200,
          max: 1000,
        },
      },
    },
  },

  // ==========================================
  // CAPTERRA REVIEWS
  // ==========================================
  capterra_reviews: {
    type: 'capterra_reviews',
    fields: {
      company_name: {
        key: 'company_name',
        type: 'text',
        label: 'Nombre del producto en Capterra',
        description: 'El nombre del producto tal como aparece en Capterra',
        placeholder: 'slack',
        helpText: 'Es la parte de la URL: capterra.com/p/123456/NOMBRE/',
        required: true,
        examples: [
          'slack',
          'notion',
          'asana',
          'monday-com',
        ],
      },
      maxReviews: {
        key: 'maxReviews',
        type: 'number',
        label: 'Máximo de reviews',
        description: 'Número máximo de reviews a extraer',
        defaultValue: 100,
        validation: {
          min: 10,
          max: 500,
        },
      },
    },
  },

  // ==========================================
  // APP STORE REVIEWS
  // ==========================================
  appstore_reviews: {
    type: 'appstore_reviews',
    fields: {
      startUrls: {
        key: 'startUrls',
        type: 'url-array',
        label: 'URLs de apps en App Store',
        description: 'URLs de las apps en la App Store de Apple',
        placeholder: 'https://apps.apple.com/es/app/revolut/id932493382',
        helpText: 'Una URL por l\u00ednea. Incluye el pa\u00eds en la URL (/es/, /us/, etc.)',
        required: true,
        validation: {
          pattern: /^https:\/\/apps\.apple\.com\/[a-z]{2}\/app\/[^/]+\/id\d+/,
          patternMessage: 'Formato: https://apps.apple.com/es/app/nombre/id123456',
        },
        examples: [
          'https://apps.apple.com/es/app/revolut/id932493382',
          'https://apps.apple.com/us/app/n26-the-mobile-bank/id956857223',
        ],
      },
      maxItems: {
        key: 'maxItems',
        type: 'number',
        label: 'M\u00e1ximo de reviews',
        description: 'N\u00famero m\u00e1ximo de reviews a extraer',
        defaultValue: 100,
        validation: {
          min: 10,
          max: 500,
        },
      },
      country: {
        key: 'country',
        type: 'select',
        label: 'País de la tienda',
        description: 'De qué tienda extraer las reviews',
        options: APPSTORE_COUNTRY_OPTIONS,
        defaultValue: 'us',
      },
    },
  },

  // ==========================================
  // PLAY STORE REVIEWS
  // ==========================================
  playstore_reviews: {
    type: 'playstore_reviews',
    fields: {
      startUrls: {
        key: 'startUrls',
        type: 'url-array',
        label: 'URLs de apps en Play Store',
        description: 'URLs de las apps en Google Play Store',
        placeholder: 'https://play.google.com/store/apps/details?id=com.revolut.revolut',
        helpText: 'Una URL por l\u00ednea',
        required: true,
        validation: {
          pattern: /^https:\/\/play\.google\.com\/store\/apps\/details\?id=[a-zA-Z0-9._]+/,
          patternMessage: 'Formato: https://play.google.com/store/apps/details?id=com.app.name',
        },
        examples: [
          'https://play.google.com/store/apps/details?id=com.revolut.revolut',
          'https://play.google.com/store/apps/details?id=de.number26.android',
        ],
      },
      maxItems: {
        key: 'maxItems',
        type: 'number',
        label: 'M\u00e1ximo de reviews',
        description: 'N\u00famero m\u00e1ximo de reviews a extraer',
        defaultValue: 100,
        validation: {
          min: 10,
          max: 500,
        },
      },
      language: {
        key: 'language',
        type: 'select',
        label: 'Idioma',
        description: 'Idioma de las reviews',
        options: LANGUAGE_OPTIONS,
        defaultValue: 'es',
      },
      country: {
        key: 'country',
        type: 'select',
        label: 'País',
        description: 'País de origen de las reviews',
        options: PLAYSTORE_COUNTRY_OPTIONS,
        defaultValue: 'ES',
      },
      sort: {
        key: 'sort',
        type: 'select',
        label: 'Ordenar por',
        description: 'Cómo ordenar las reviews',
        options: PLAYSTORE_SORT_OPTIONS,
        defaultValue: 'NEWEST',
      },
    },
  },

  // ==========================================
  // GOOGLE MAPS REVIEWS
  // ==========================================
  google_maps_reviews: {
    type: 'google_maps_reviews',
    fields: {
      placeUrls: {
        key: 'placeUrls',
        type: 'url-array',
        label: 'URLs de lugares en Google Maps',
        description: 'URLs de los lugares de los que quieres extraer reviews',
        placeholder: 'https://www.google.com/maps/place/...',
        helpText: 'Una URL por l\u00ednea. Copia la URL desde Google Maps.',
        required: true,
        examples: [
          'https://www.google.com/maps/place/Revolut+London/@51.5074,-0.1278,17z',
        ],
      },
      maxReviews: {
        key: 'maxReviews',
        type: 'number',
        label: 'Máximo de reviews',
        description: 'Número máximo de reviews a extraer',
        defaultValue: 100,
        validation: {
          min: 10,
          max: 500,
        },
      },
      reviewsSort: {
        key: 'reviewsSort',
        type: 'select',
        label: 'Ordenar por',
        description: 'Cómo ordenar las reviews',
        options: GOOGLE_MAPS_SORT_OPTIONS,
        defaultValue: 'newest',
      },
      language: {
        key: 'language',
        type: 'select',
        label: 'Idioma',
        description: 'Idioma preferido de las reviews',
        options: LANGUAGE_OPTIONS,
        defaultValue: 'es',
      },
    },
  },

  // ==========================================
  // SEO KEYWORDS (MANGOOLS)
  // ==========================================
  seo_keywords: {
    type: 'seo_keywords',
    fields: {
      keyword: {
        key: 'keyword',
        type: 'text',
        label: 'Palabra clave',
        description: 'La keyword que quieres investigar',
        placeholder: 'cuenta bancaria online',
        required: true,
        examples: [
          'cuenta bancaria online',
          'mejor banco digital',
          'transferencias internacionales',
        ],
      },
      location: {
        key: 'location',
        type: 'select',
        label: 'Ubicaci\u00f3n',
        description: 'Pa\u00eds para los datos de b\u00fasqueda',
        options: [
          { value: 'Spain', label: 'Espa\u00f1a' },
          { value: 'United States', label: 'Estados Unidos' },
          { value: 'United Kingdom', label: 'Reino Unido' },
          { value: 'Mexico', label: 'M\u00e9xico' },
          { value: 'Argentina', label: 'Argentina' },
        ],
        defaultValue: 'Spain',
      },
      language: {
        key: 'language',
        type: 'select',
        label: 'Idioma',
        description: 'Idioma de las b\u00fasquedas',
        options: LANGUAGE_OPTIONS,
        defaultValue: 'es',
      },
    },
  },

  // ==========================================
  // REDDIT POSTS & COMMENTS
  // ==========================================
  reddit_posts: {
    type: 'reddit_posts',
    fields: {
      searches: {
        key: 'searches',
        type: 'text-array',
        label: 'Búsquedas en Reddit',
        description: 'Subreddits, URLs de posts o términos de búsqueda',
        placeholder: 'r/personalfinance\nr/fintech\nhttps://reddit.com/r/...',
        helpText: 'Una búsqueda por línea. Puedes usar subreddits (r/nombre), URLs de posts o términos de búsqueda.',
        required: true,
        examples: [
          'r/personalfinance',
          'r/fintech',
          'r/CreditCards',
          'best banking app',
        ],
      },
      maxItems: {
        key: 'maxItems',
        type: 'number',
        label: 'Máximo de posts',
        description: 'Número máximo de posts a extraer',
        helpText: 'Recomendado: 20-100 posts',
        defaultValue: 50,
        validation: {
          min: 1,
          max: 1000,
        },
      },
      maxComments: {
        key: 'maxComments',
        type: 'number',
        label: 'Comentarios por post',
        description: 'Número máximo de comentarios a extraer por post (0 = no extraer)',
        helpText: 'Deja en 0 para solo obtener posts sin comentarios',
        defaultValue: 20,
        validation: {
          min: 0,
          max: 500,
        },
      },
      sort: {
        key: 'sort',
        type: 'select',
        label: 'Ordenar por',
        description: 'Cómo ordenar los resultados',
        options: [
          { value: 'new', label: 'Más recientes', description: 'Posts más nuevos primero' },
          { value: 'hot', label: 'Populares (Hot)', description: 'Posts con más actividad actual' },
          { value: 'top', label: 'Mejores (Top)', description: 'Posts con más votos' },
          { value: 'relevance', label: 'Relevancia', description: 'Por relevancia de búsqueda' },
        ],
        defaultValue: 'new',
      },
      time: {
        key: 'time',
        type: 'select',
        label: 'Periodo de tiempo',
        description: 'Filtrar por antigüedad (solo aplica con sort=top)',
        options: [
          { value: 'all', label: 'Todo el tiempo' },
          { value: 'year', label: 'Último año' },
          { value: 'month', label: 'Último mes' },
          { value: 'week', label: 'Última semana' },
          { value: 'day', label: 'Últimas 24 horas' },
          { value: 'hour', label: 'Última hora' },
        ],
        defaultValue: 'all',
      },
    },
  },

  // ==========================================
  // GOOGLE NEWS
  // ==========================================
  google_news: {
    type: 'google_news',
    fields: {
      query: {
        key: 'query',
        type: 'text',
        label: 'Término de búsqueda',
        description: 'Palabra clave o frase para buscar noticias',
        placeholder: 'Revolut España',
        helpText: 'Escribe la búsqueda como en Google News',
        required: true,
        examples: [
          'Revolut España',
          'fintech noticias',
          'bancos digitales',
        ],
      },
      language: {
        key: 'language',
        type: 'select',
        label: 'Idioma',
        description: 'Idioma de las noticias',
        options: LANGUAGE_OPTIONS,
        defaultValue: 'es',
      },
      country: {
        key: 'country',
        type: 'select',
        label: 'País',
        description: 'País para los resultados',
        options: [
          { value: 'ES', label: 'España' },
          { value: 'MX', label: 'México' },
          { value: 'AR', label: 'Argentina' },
          { value: 'US', label: 'Estados Unidos' },
          { value: 'GB', label: 'Reino Unido' },
        ],
        defaultValue: 'ES',
      },
      maxItems: {
        key: 'maxItems',
        type: 'number',
        label: 'Máximo de artículos',
        description: 'Número máximo de artículos a obtener',
        helpText: 'Recomendado: 20-100 artículos',
        defaultValue: 50,
        validation: {
          min: 1,
          max: 500,
        },
      },
    },
  },

  // ==========================================
  // NEWS BING (con extracción de contenido)
  // ==========================================
  news_bing: {
    type: 'news_bing',
    fields: {
      queries: {
        key: 'queries',
        type: 'text-array',
        label: 'Términos de búsqueda',
        description: 'Palabras clave o empresas para buscar noticias',
        placeholder: 'Revolut España\nN26 noticias\nfintech 2024',
        helpText: 'Una búsqueda por línea. Puedes buscar empresas, temas o frases.',
        required: true,
        examples: [
          'Revolut España',
          'fintech noticias',
          'N26 cierre cuentas',
          '"banca digital" España',
        ],
      },
      country: {
        key: 'country',
        type: 'select',
        label: 'País/Idioma',
        description: 'Configura el mercado y el idioma de las noticias',
        options: [
          { value: 'es-ES', label: 'España (Español)' },
          { value: 'es-MX', label: 'México (Español)' },
          { value: 'es-AR', label: 'Argentina (Español)' },
          { value: 'es-CO', label: 'Colombia (Español)' },
          { value: 'en-US', label: 'Estados Unidos (Inglés)' },
          { value: 'en-GB', label: 'Reino Unido (Inglés)' },
          { value: 'pt-BR', label: 'Brasil (Portugués)' },
          { value: 'de-DE', label: 'Alemania (Alemán)' },
          { value: 'fr-FR', label: 'Francia (Francés)' },
        ],
        defaultValue: 'es-ES',
      },
      dateRange: {
        key: 'dateRange',
        type: 'select',
        label: 'Rango de fechas',
        description: 'Filtrar noticias por antigüedad',
        helpText: 'Permite buscar noticias históricas o recientes',
        options: [
          { value: 'anytime', label: 'Cualquier momento' },
          { value: 'past_day', label: 'Últimas 24 horas' },
          { value: 'past_week', label: 'Última semana' },
          { value: 'past_month', label: 'Último mes' },
          { value: 'past_year', label: 'Último año' },
        ],
        defaultValue: 'anytime',
      },
      maxPages: {
        key: 'maxPages',
        type: 'number',
        label: 'Páginas de resultados',
        description: 'Número de páginas de Bing a procesar por cada búsqueda',
        helpText: 'Cada página tiene ~10 resultados. Más páginas = más noticias históricas.',
        defaultValue: 10,
        validation: {
          min: 1,
          max: 50,
        },
      },
      maxArticles: {
        key: 'maxArticles',
        type: 'number',
        label: 'Máximo de artículos',
        description: 'Número máximo total de artículos a extraer',
        helpText: 'Límite total combinando todas las búsquedas',
        defaultValue: 50,
        validation: {
          min: 10,
          max: 200,
        },
      },
      extractContent: {
        key: 'extractContent',
        type: 'boolean',
        label: 'Extraer contenido completo',
        description: 'Visita cada artículo y extrae el texto completo',
        helpText: 'Si está activo, extrae el contenido completo de cada noticia (más lento pero más útil)',
        defaultValue: true,
      },
    },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getFieldSchema(scraperType: ScraperType, fieldKey: string): FieldSchema | undefined {
  return SCRAPER_FIELD_SCHEMAS[scraperType]?.fields[fieldKey];
}

export function getAllFieldsForScraper(scraperType: ScraperType): FieldSchema[] {
  const schema = SCRAPER_FIELD_SCHEMAS[scraperType];
  if (!schema) return [];
  return Object.values(schema.fields);
}

export function validateField(
  scraperType: ScraperType,
  fieldKey: string,
  value: unknown
): { valid: boolean; error?: string } {
  const fieldSchema = getFieldSchema(scraperType, fieldKey);
  if (!fieldSchema) {
    return { valid: true }; // Unknown field, allow it
  }

  // Check required
  if (fieldSchema.required && (value === undefined || value === null || value === '')) {
    return { valid: false, error: `${fieldSchema.label} es requerido` };
  }

  // Skip validation for empty optional fields
  if (!fieldSchema.required && (value === undefined || value === null || value === '')) {
    return { valid: true };
  }

  // Validate based on type
  const validation = fieldSchema.validation;
  if (validation) {
    // String validations
    if (typeof value === 'string') {
      if (validation.minLength && value.length < validation.minLength) {
        return { valid: false, error: `M\u00ednimo ${validation.minLength} caracteres` };
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        return { valid: false, error: `M\u00e1ximo ${validation.maxLength} caracteres` };
      }
      if (validation.pattern && !validation.pattern.test(value)) {
        return { valid: false, error: validation.patternMessage || 'Formato inv\u00e1lido' };
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        return { valid: false, error: `M\u00ednimo: ${validation.min}` };
      }
      if (validation.max !== undefined && value > validation.max) {
        return { valid: false, error: `M\u00e1ximo: ${validation.max}` };
      }
    }

    // Array validations (check each item for URL arrays)
    if (Array.isArray(value) && validation.pattern) {
      for (const item of value) {
        if (typeof item === 'string' && !validation.pattern.test(item)) {
          return { valid: false, error: `${validation.patternMessage || 'Formato inv\u00e1lido'}: ${item}` };
        }
      }
    }
  }

  return { valid: true };
}

export function validateAllFields(
  scraperType: ScraperType,
  values: Record<string, unknown>
): { valid: boolean; errors: Record<string, string> } {
  const schema = SCRAPER_FIELD_SCHEMAS[scraperType];
  if (!schema) {
    return { valid: true, errors: {} };
  }

  const errors: Record<string, string> = {};

  for (const [fieldKey, fieldSchema] of Object.entries(schema.fields)) {
    const result = validateField(scraperType, fieldKey, values[fieldKey]);
    if (!result.valid && result.error) {
      errors[fieldKey] = result.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
