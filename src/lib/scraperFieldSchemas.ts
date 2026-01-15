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

const DATE_FILTER_OPTIONS: SelectOption[] = [
  { value: 'today', label: 'Hoy', description: '\u00daltimas 24 horas' },
  { value: 'week', label: 'Esta semana', description: '\u00daltimos 7 d\u00edas' },
  { value: 'month', label: 'Este mes', description: '\u00daltimos 30 d\u00edas' },
  { value: 'year', label: 'Este a\u00f1o', description: '\u00daltimos 12 meses' },
];

const SORT_ORDER_OPTIONS: SelectOption[] = [
  { value: 'most recent', label: 'M\u00e1s recientes', description: 'Ordenar por fecha descendente' },
  { value: 'RELEVANCE', label: 'Relevancia', description: 'Ordenar por relevancia' },
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
        description: 'La URL completa de la p\u00e1gina web que quieres extraer',
        placeholder: 'https://ejemplo.com/pagina',
        helpText: 'Incluye https:// al inicio',
        required: true,
        validation: {
          pattern: /^https?:\/\/.+/,
          patternMessage: 'Debe ser una URL v\u00e1lida (https://...)',
        },
        examples: [
          'https://www.revolut.com/es-ES/',
          'https://n26.com/es-es',
          'https://wise.com/es/',
        ],
      },
      formats: {
        key: 'formats',
        type: 'multi-select',
        label: 'Formatos de salida',
        description: 'En qu\u00e9 formato quieres el contenido extra\u00eddo',
        options: [
          { value: 'markdown', label: 'Markdown', description: 'Texto formateado (recomendado)' },
          { value: 'html', label: 'HTML', description: 'C\u00f3digo HTML completo' },
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
        helpText: 'Usa 0 para p\u00e1ginas est\u00e1ticas, 2000-5000 para SPAs',
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
        options: DATE_FILTER_OPTIONS,
      },
    },
  },

  // ==========================================
  // INSTAGRAM POSTS & COMMENTS
  // ==========================================
  instagram_posts_comments: {
    type: 'instagram_posts_comments',
    fields: {
      directUrls: {
        key: 'directUrls',
        type: 'url-array',
        label: 'URLs de perfiles de Instagram',
        description: 'URLs de los perfiles de Instagram que quieres analizar',
        placeholder: 'https://www.instagram.com/usuario/',
        helpText: 'Una URL por l\u00ednea. Usa la URL completa del perfil.',
        required: true,
        validation: {
          pattern: /^https:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?$/,
          patternMessage: 'Formato: https://www.instagram.com/usuario/',
        },
        examples: [
          'https://www.instagram.com/revolut/',
          'https://www.instagram.com/n26/',
          'https://www.instagram.com/wikiexpert/',
        ],
      },
      resultsLimit: {
        key: 'resultsLimit',
        type: 'number',
        label: 'L\u00edmite de resultados',
        description: 'N\u00famero m\u00e1ximo de posts a extraer por perfil',
        helpText: 'Entre 10 y 200',
        defaultValue: 50,
        validation: {
          min: 10,
          max: 200,
        },
      },
      resultsType: {
        key: 'resultsType',
        type: 'select',
        label: 'Tipo de contenido',
        description: 'Qu\u00e9 tipo de publicaciones extraer',
        options: [
          { value: 'posts', label: 'Posts', description: 'Im\u00e1genes y carruseles' },
          { value: 'reels', label: 'Reels', description: 'Videos cortos' },
          { value: 'stories', label: 'Stories', description: 'Historias activas' },
        ],
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
        helpText: 'Un perfil por l\u00ednea. Puedes usar @usuario o solo el nombre.',
        required: true,
        examples: [
          '@revolut',
          'n26bank',
          '@wiseaccount',
        ],
      },
      resultsPerPage: {
        key: 'resultsPerPage',
        type: 'number',
        label: 'Videos por perfil',
        description: 'N\u00famero de videos a extraer por cada perfil',
        helpText: 'Entre 10 y 100',
        defaultValue: 50,
        validation: {
          min: 10,
          max: 100,
        },
      },
      proxyCountryCode: {
        key: 'proxyCountryCode',
        type: 'select',
        label: 'Pa\u00eds del proxy',
        description: 'Desde qu\u00e9 pa\u00eds se har\u00e1 la consulta',
        helpText: 'Afecta qu\u00e9 contenido se ve (algunos videos est\u00e1n geo-restringidos)',
        options: [
          { value: 'ES', label: 'Espa\u00f1a' },
          { value: 'US', label: 'Estados Unidos' },
          { value: 'GB', label: 'Reino Unido' },
          { value: 'MX', label: 'M\u00e9xico' },
          { value: 'AR', label: 'Argentina' },
          { value: 'CO', label: 'Colombia' },
        ],
        defaultValue: 'ES',
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
        description: 'C\u00f3mo ordenar los resultados',
        options: [
          { value: 'recent', label: 'M\u00e1s recientes', description: 'Posts m\u00e1s nuevos primero' },
          { value: 'top', label: 'M\u00e1s populares', description: 'Posts con m\u00e1s interacci\u00f3n' },
        ],
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
        helpText: 'Una URL por l\u00ednea',
        required: true,
        validation: {
          pattern: /^https:\/\/(www\.)?tiktok\.com\/@[^/]+\/video\/\d+/,
          patternMessage: 'Formato: https://www.tiktok.com/@usuario/video/ID',
        },
        examples: [
          'https://www.tiktok.com/@revolut/video/7234567890123456789',
        ],
      },
      commentsPerPost: {
        key: 'commentsPerPost',
        type: 'number',
        label: 'Comentarios por video',
        description: 'N\u00famero m\u00e1ximo de comentarios por video',
        defaultValue: 100,
        validation: {
          min: 10,
          max: 500,
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
        description: 'C\u00f3mo ordenar los comentarios',
        options: SORT_ORDER_OPTIONS,
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
      youtube_channels: {
        key: 'youtube_channels',
        type: 'text-array',
        label: 'Canales de YouTube',
        description: 'Handles de canales de YouTube (formato @usuario)',
        placeholder: '@MrBeast\n@PewDiePie\n@Revolut',
        helpText: 'Un canal por l\u00ednea, usa el formato @NombreCanal',
        required: true,
        validation: {
          pattern: /^@[a-zA-Z0-9_-]+$/,
          patternMessage: 'Formato: @NombreCanal',
        },
        examples: [
          '@Revolut',
          '@N26',
          '@MrBeast',
        ],
      },
      End_date: {
        key: 'End_date',
        type: 'date',
        label: 'Fecha l\u00edmite',
        description: 'Solo extraer videos publicados hasta esta fecha',
        helpText: 'Deja vac\u00edo para todos los videos',
      },
    },
  },

  // ==========================================
  // YOUTUBE COMMENTS
  // ==========================================
  youtube_comments: {
    type: 'youtube_comments',
    fields: {
      videoUrls: {
        key: 'videoUrls',
        type: 'url-array',
        label: 'URLs de videos de YouTube',
        description: 'URLs de los videos de los que quieres extraer comentarios',
        placeholder: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        helpText: 'Una URL por l\u00ednea',
        required: true,
        validation: {
          pattern: /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+/,
          patternMessage: 'Formato: https://www.youtube.com/watch?v=ID',
        },
      },
      maxComments: {
        key: 'maxComments',
        type: 'number',
        label: 'M\u00e1ximo de comentarios',
        description: 'N\u00famero m\u00e1ximo de comentarios por video',
        defaultValue: 100,
        validation: {
          min: 10,
          max: 1000,
        },
      },
    },
  },

  // ==========================================
  // YOUTUBE TRANSCRIPTS
  // ==========================================
  youtube_transcripts: {
    type: 'youtube_transcripts',
    fields: {
      videoUrls: {
        key: 'videoUrls',
        type: 'url-array',
        label: 'URLs de videos de YouTube',
        description: 'URLs de los videos de los que quieres extraer transcripciones',
        placeholder: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        helpText: 'Una URL por l\u00ednea. El video debe tener subt\u00edtulos disponibles.',
        required: true,
      },
      language: {
        key: 'language',
        type: 'select',
        label: 'Idioma preferido',
        description: 'Idioma de la transcripci\u00f3n',
        helpText: 'Si no est\u00e1 disponible, se usar\u00e1 otro idioma',
        options: LANGUAGE_OPTIONS,
        defaultValue: 'es',
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
        label: 'M\u00e1ximo de reviews',
        description: 'N\u00famero m\u00e1ximo de reviews a extraer',
        defaultValue: 200,
        validation: {
          min: 10,
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
      productUrls: {
        key: 'productUrls',
        type: 'url-array',
        label: 'URLs de productos en Capterra',
        description: 'URLs completas de las p\u00e1ginas de reviews en Capterra',
        placeholder: 'https://www.capterra.com/p/123456/ProductName/reviews/',
        helpText: 'Una URL por l\u00ednea',
        required: true,
        examples: [
          'https://www.capterra.com/p/143776/Slack/reviews/',
        ],
      },
      maxReviews: {
        key: 'maxReviews',
        type: 'number',
        label: 'M\u00e1ximo de reviews',
        description: 'N\u00famero m\u00e1ximo de reviews a extraer',
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
        label: 'Pa\u00eds de la tienda',
        description: 'De qu\u00e9 tienda extraer las reviews',
        options: [
          { value: 'es', label: 'Espa\u00f1a' },
          { value: 'us', label: 'Estados Unidos' },
          { value: 'gb', label: 'Reino Unido' },
          { value: 'mx', label: 'M\u00e9xico' },
          { value: 'ar', label: 'Argentina' },
        ],
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
        label: 'Pa\u00eds',
        description: 'Pa\u00eds de origen de las reviews',
        options: [
          { value: 'es', label: 'Espa\u00f1a' },
          { value: 'us', label: 'Estados Unidos' },
          { value: 'gb', label: 'Reino Unido' },
          { value: 'mx', label: 'M\u00e9xico' },
          { value: 'ar', label: 'Argentina' },
        ],
        defaultValue: 'es',
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
  // NEWS BING
  // ==========================================
  news_bing: {
    type: 'news_bing',
    fields: {
      queries: {
        key: 'queries',
        type: 'text-array',
        label: 'T\u00e9rminos de b\u00fasqueda',
        description: 'Palabras clave para buscar noticias',
        placeholder: 'Revolut Espa\u00f1a\nbancos digitales 2024',
        helpText: 'Una b\u00fasqueda por l\u00ednea',
        required: true,
        examples: [
          'Revolut Espa\u00f1a',
          'fintech noticias',
          'N26 cierre cuentas',
        ],
      },
      country: {
        key: 'country',
        type: 'select',
        label: 'Pa\u00eds/Idioma',
        description: 'Configura el pa\u00eds y el idioma de las noticias',
        options: [
          { value: 'es-ES', label: 'Espa\u00f1a (Espa\u00f1ol)' },
          { value: 'es-MX', label: 'M\u00e9xico (Espa\u00f1ol)' },
          { value: 'en-US', label: 'Estados Unidos (Ingl\u00e9s)' },
          { value: 'en-GB', label: 'Reino Unido (Ingl\u00e9s)' },
        ],
        defaultValue: 'es-ES',
      },
      maxPages: {
        key: 'maxPages',
        type: 'number',
        label: 'P\u00e1ginas de resultados',
        description: 'N\u00famero de p\u00e1ginas de resultados a procesar',
        helpText: 'Cada p\u00e1gina tiene ~10 resultados',
        defaultValue: 10,
        validation: {
          min: 1,
          max: 50,
        },
      },
      maxArticles: {
        key: 'maxArticles',
        type: 'number',
        label: 'M\u00e1ximo de art\u00edculos',
        description: 'N\u00famero m\u00e1ximo total de art\u00edculos a extraer',
        defaultValue: 50,
        validation: {
          min: 10,
          max: 200,
        },
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
