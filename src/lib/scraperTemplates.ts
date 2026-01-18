/**
 * Scraper Templates
 * Configuration for all available scrapers with their Actor IDs and input schemas
 */

import { ScraperTemplate, ScraperType, ScraperProvider } from '@/types/scraper.types';

// ============================================
// APIFY ACTOR IDS
// ============================================

// ============================================
// PHANTOMBUSTER AGENT IDS
// ============================================

export const PHANTOMBUSTER_AGENTS = {
  LINKEDIN_POST_LIKERS_COMMENTERS: '2818596408813649', // LinkedIn Post Likers & Commenters
  LINKEDIN_PROFILE_SCRAPER: '5765069205428224', // LinkedIn Profile Scraper
} as const;

export const APIFY_ACTORS = {
  // Social Media - Posts & Comments
  INSTAGRAM_POSTS_COMMENTS: 'dIKFJ95TN8YclK2no',
  TIKTOK_POSTS: 'GdWCkxBtKWOsKjdch',
  TIKTOK_COMMENTS: 'BDec00yAmCm1QbMEI',
  LINKEDIN_COMPANY_POSTS: 'mrThmKLmkxJPehxCg',
  LINKEDIN_COMMENTS: '2XnpwxfhSW1fAWElp',
  FACEBOOK_POSTS: 'KoJrdxJCTtpon81KY',
  FACEBOOK_COMMENTS: 'us5srxAYnsrkgUv2v',
  LINKEDIN_COMPANY_INSIGHTS: '6mSoKnECRInl7QUb8',
  LINKEDIN_COMPANY_PROFILE: 'dev_fusion~linkedin-company-scraper',  // Pay-per-use: $8/1000 results
  LINKEDIN_PERSON_POSTS: 'anchor/linkedin-person-posts-scraper',  // Person posts scraper

  // YouTube
  YOUTUBE_CHANNEL_VIDEOS: '67Q6fmd8iedTVcCwY',  // streamers/youtube-channel-scraper
  YOUTUBE_COMMENTS: 'p7UMdpQnjKmmpR21D',  // streamers/youtube-comments-scraper
  YOUTUBE_TRANSCRIPTS: 'CTQcdDtqW5dvELvur',  // topaz_sharingan/youtube-transcript-scraper

  // Reviews
  G2_REVIEWS: 'kT2dx4xoOebKw6uQB',
  CAPTERRA_REVIEWS: '50GSYJYYfRB0xCNRc',
  TRUSTPILOT_REVIEWS: 'fLXimoyuhE1UQgDbM',
  APPSTORE_REVIEWS: '4qRgh5vXXsv0bKa1l',
  PLAYSTORE_REVIEWS: 'Bs72sDKr8fGe3d5Ti',
  GOOGLE_MAPS_REVIEWS: 'thEbk6nzmhRsChwBS',

  // News
  GOOGLE_NEWS: 'lhotanok~google-news-scraper',

  // Reddit
  REDDIT_POSTS: 'practicaltools~apify-reddit-api',  // Pay-per-use: $0.002/item, 1000 free/month
} as const;

// ============================================
// SCRAPER TEMPLATES
// ============================================

export const SCRAPER_TEMPLATES: Record<ScraperType, ScraperTemplate> = {
  // ==========================================
  // SOCIAL MEDIA - POSTS & COMMENTS
  // ==========================================

  instagram_posts_comments: {
    type: 'instagram_posts_comments',
    name: 'Instagram Posts & Comments',
    description: 'Scrape posts and comments from Instagram profiles',
    provider: 'apify',
    actorId: APIFY_ACTORS.INSTAGRAM_POSTS_COMMENTS,
    category: 'social',
    inputSchema: {
      required: ['username'],
      optional: ['resultsLimit', 'resultsType'],
      defaults: {
        resultsLimit: 200,
        resultsType: 'posts',
      },
    },
    outputFields: ['shortCode', 'caption', 'likesCount', 'commentsCount', 'timestamp', 'comments'],
  },

  tiktok_posts: {
    type: 'tiktok_posts',
    name: 'TikTok Posts',
    description: 'Scrape posts from TikTok profiles, hashtags or search queries',
    provider: 'apify',
    actorId: APIFY_ACTORS.TIKTOK_POSTS,
    category: 'social',
    inputSchema: {
      required: ['profiles'],
      optional: ['resultsPerPage', 'proxyCountryCode', 'profileSorting', 'hashtags', 'searchQueries', 'commentsPerPost'],
      defaults: {
        resultsPerPage: 50,
        proxyCountryCode: 'ES',
        profileSorting: 'latest',
        commentsPerPost: 0,
      },
    },
    outputFields: ['id', 'text', 'createTime', 'diggCount', 'shareCount', 'playCount', 'commentCount', 'author', 'webVideoUrl', 'comments'],
  },

  tiktok_comments: {
    type: 'tiktok_comments',
    name: 'TikTok Comments',
    description: 'Scrape comments from TikTok videos or profiles',
    provider: 'apify',
    actorId: APIFY_ACTORS.TIKTOK_COMMENTS,
    category: 'social',
    inputSchema: {
      required: ['postURLs'],
      optional: ['commentsPerPost', 'maxRepliesPerComment'],
      defaults: {
        commentsPerPost: 100,
        maxRepliesPerComment: 0,
      },
    },
    outputFields: ['text', 'createTime', 'diggCount', 'replyCommentTotal', 'user', 'videoWebUrl'],
  },

  linkedin_company_posts: {
    type: 'linkedin_company_posts',
    name: 'LinkedIn Company Posts',
    description: 'Scrape posts from LinkedIn company pages',
    provider: 'apify',
    actorId: APIFY_ACTORS.LINKEDIN_COMPANY_POSTS,
    category: 'social',
    inputSchema: {
      required: ['company_name'],
      optional: ['limit', 'sort'],
      defaults: {
        limit: 50,
        sort: 'recent',
      },
    },
    outputFields: ['text', 'likesCount', 'commentsCount', 'postedAt', 'urn'],
  },

  linkedin_comments: {
    type: 'linkedin_comments',
    name: 'LinkedIn Comments',
    description: 'Scrape comments from LinkedIn posts',
    provider: 'apify',
    actorId: APIFY_ACTORS.LINKEDIN_COMMENTS,
    category: 'social',
    inputSchema: {
      required: ['postIds'],
      optional: ['limit', 'sortOrder'],
      defaults: {
        limit: 100,
        sortOrder: 'most recent',
      },
    },
    outputFields: ['text', 'likesCount', 'author', 'createdAt'],
  },

  facebook_posts: {
    type: 'facebook_posts',
    name: 'Facebook Posts',
    description: 'Scrape posts from Facebook pages',
    provider: 'apify',
    actorId: APIFY_ACTORS.FACEBOOK_POSTS,
    category: 'social',
    inputSchema: {
      required: ['startUrls'],
      optional: ['resultsLimit'],
      defaults: {
        resultsLimit: 50,
      },
    },
    outputFields: ['text', 'likesCount', 'commentsCount', 'sharesCount', 'time'],
  },

  facebook_comments: {
    type: 'facebook_comments',
    name: 'Facebook Comments',
    description: 'Scrape comments from Facebook posts',
    provider: 'apify',
    actorId: APIFY_ACTORS.FACEBOOK_COMMENTS,
    category: 'social',
    inputSchema: {
      required: ['startUrls'],
      optional: ['resultsLimit'],
      defaults: {
        resultsLimit: 100,
      },
    },
    outputFields: ['text', 'likesCount', 'author', 'date'],
  },

  linkedin_company_insights: {
    type: 'linkedin_company_insights',
    name: 'LinkedIn Company Insights',
    description: 'Obtiene insights de empresas: alumni, nuevas contrataciones. Requiere cookies de LinkedIn Premium.',
    provider: 'apify',
    actorId: APIFY_ACTORS.LINKEDIN_COMPANY_INSIGHTS,
    category: 'social',
    inputSchema: {
      required: ['urls', 'list_cookies'],
      optional: ['get_alumni', 'get_new_hires', 'max_alumni', 'max_new_hires'],
      defaults: {
        get_alumni: true,
        get_new_hires: true,
        max_alumni: 3,
        max_new_hires: 3,
      },
    },
    outputFields: ['name', 'description', 'industry', 'employeeCount', 'headquarters', 'website', 'alumni', 'new_hires'],
  },

  reddit_posts: {
    type: 'reddit_posts',
    name: 'Reddit Posts & Comments',
    description: 'Busca posts y comentarios en Reddit por subreddit, búsqueda o URL. $0.002/item (1000 gratis/mes)',
    provider: 'apify',
    actorId: APIFY_ACTORS.REDDIT_POSTS,
    category: 'social',
    inputSchema: {
      required: ['startUrls'],
      optional: ['searches', 'maxItems', 'sort', 'time', 'includeNSFW', 'skipComments'],
      defaults: {
        maxItems: 25,
        sort: 'new',
        time: 'all',
        includeNSFW: false,
        skipComments: false,
      },
    },
    outputFields: ['title', 'selftext', 'url', 'author', 'score', 'numComments', 'createdAt', 'subreddit', 'comments'],
  },

  linkedin_company_profile: {
    type: 'linkedin_company_profile',
    name: 'LinkedIn Company Profile',
    description: 'Obtiene perfil de empresa: empleados, followers, headquarters y especialidades. $8/1000 resultados',
    provider: 'apify',
    actorId: APIFY_ACTORS.LINKEDIN_COMPANY_PROFILE,
    category: 'social',
    inputSchema: {
      required: ['profileUrls'],
      optional: [],
      defaults: {},
    },
    outputFields: ['companyName', 'websiteUrl', 'industry', 'employeeCount', 'followerCount', 'description', 'tagline', 'headquarter', 'foundedOn', 'specialities', 'logo', 'affiliatedOrganizations'],
  },

  linkedin_person_posts: {
    type: 'linkedin_person_posts',
    name: 'LinkedIn Person Posts',
    description: 'Extrae posts de un perfil de LinkedIn personal con métricas de engagement (likes, comentarios, fecha)',
    provider: 'apify',
    actorId: APIFY_ACTORS.LINKEDIN_PERSON_POSTS,
    category: 'social',
    inputSchema: {
      required: ['profileUrls'],
      optional: ['maxPosts', 'proxy'],
      defaults: {
        maxPosts: 30,
      },
    },
    outputFields: ['postUrl', 'text', 'likesCount', 'commentsCount', 'repostsCount', 'postedAt', 'postType', 'authorName', 'authorProfileUrl'],
  },

  // ==========================================
  // YOUTUBE
  // ==========================================

  youtube_channel_videos: {
    type: 'youtube_channel_videos',
    name: 'YouTube Channel Videos',
    description: 'Scrape video list from YouTube channels',
    provider: 'apify',
    actorId: APIFY_ACTORS.YOUTUBE_CHANNEL_VIDEOS,
    category: 'youtube',
    inputSchema: {
      required: ['startUrls'],
      optional: ['maxResults', 'maxResultsShorts', 'maxResultStreams', 'oldestPostDate', 'sortVideosBy'],
      defaults: {
        maxResults: 50,
        maxResultsShorts: 0,
        maxResultStreams: 0,
        sortVideosBy: 'NEWEST',
      },
    },
    outputFields: ['title', 'description', 'viewCount', 'likeCount', 'publishedAt', 'url', 'duration', 'thumbnailUrl'],
  },

  youtube_comments: {
    type: 'youtube_comments',
    name: 'YouTube Comments',
    description: 'Scrape comments from YouTube videos',
    provider: 'apify',
    actorId: APIFY_ACTORS.YOUTUBE_COMMENTS,
    category: 'youtube',
    inputSchema: {
      required: ['startUrls'],
      optional: ['maxComments', 'commentsSortBy'],
      defaults: {
        maxComments: 100,
        commentsSortBy: '0',  // Top comments
      },
    },
    outputFields: ['text', 'author', 'likesCount', 'publishedAt', 'replyCount'],
  },

  youtube_transcripts: {
    type: 'youtube_transcripts',
    name: 'YouTube Transcripts',
    description: 'Extract transcripts from YouTube videos',
    provider: 'apify',
    actorId: APIFY_ACTORS.YOUTUBE_TRANSCRIPTS,
    category: 'youtube',
    inputSchema: {
      required: ['startUrls'],
      optional: ['timestamps'],
      defaults: {
        timestamps: true,
      },
    },
    outputFields: ['transcript', 'timestamps', 'videoUrl', 'title'],
  },

  // ==========================================
  // REVIEWS
  // ==========================================

  g2_reviews: {
    type: 'g2_reviews',
    name: 'G2 Product Reviews',
    description: 'Scrape reviews from G2',
    provider: 'apify',
    actorId: APIFY_ACTORS.G2_REVIEWS,
    category: 'reviews',
    inputSchema: {
      required: ['product'],
      optional: ['max_reviews'],
      defaults: {
        max_reviews: 200,
      },
    },
    outputFields: ['title', 'text', 'rating', 'author', 'date', 'pros', 'cons'],
  },

  capterra_reviews: {
    type: 'capterra_reviews',
    name: 'Capterra Reviews',
    description: 'Scrape reviews from Capterra product pages',
    provider: 'apify',
    actorId: APIFY_ACTORS.CAPTERRA_REVIEWS,
    category: 'reviews',
    inputSchema: {
      required: ['startUrls'],
      optional: ['maxReviews', 'maxConcurrency'],
      defaults: {
        maxReviews: 100,
        maxConcurrency: 20,
      },
    },
    outputFields: ['title', 'text', 'rating', 'author', 'date', 'pros', 'cons'],
  },

  trustpilot_reviews: {
    type: 'trustpilot_reviews',
    name: 'Trustpilot Reviews',
    description: 'Scrape reviews from Trustpilot',
    provider: 'apify',
    actorId: APIFY_ACTORS.TRUSTPILOT_REVIEWS,
    category: 'reviews',
    inputSchema: {
      required: ['companyDomain'],
      optional: ['count', 'stars', 'date', 'languages'],
      defaults: {
        count: 100,
        languages: ['es'],
      },
    },
    outputFields: ['title', 'text', 'rating', 'author', 'date', 'verified', 'consumerCountryCode'],
  },

  appstore_reviews: {
    type: 'appstore_reviews',
    name: 'App Store Reviews',
    description: 'Scrape reviews from Apple App Store',
    provider: 'apify',
    actorId: APIFY_ACTORS.APPSTORE_REVIEWS,
    category: 'reviews',
    inputSchema: {
      required: ['startUrls'],
      optional: ['maxItems', 'country'],
      defaults: {
        maxItems: 100,
        country: 'us',
      },
    },
    outputFields: ['title', 'text', 'rating', 'author', 'date', 'version'],
  },

  playstore_reviews: {
    type: 'playstore_reviews',
    name: 'Google Play Store Reviews',
    description: 'Scrape reviews from Google Play Store',
    provider: 'apify',
    actorId: APIFY_ACTORS.PLAYSTORE_REVIEWS,
    category: 'reviews',
    inputSchema: {
      required: ['startUrls'],
      optional: ['maxItems', 'language', 'country', 'sort'],
      defaults: {
        maxItems: 100,
        language: 'es',
        country: 'ES',
        sort: 'NEWEST',
      },
    },
    outputFields: ['text', 'rating', 'author', 'date', 'thumbsUp'],
  },

  google_maps_reviews: {
    type: 'google_maps_reviews',
    name: 'Google Maps Reviews',
    description: 'Scrape reviews from Google Maps places',
    provider: 'apify',
    actorId: APIFY_ACTORS.GOOGLE_MAPS_REVIEWS,
    category: 'reviews',
    inputSchema: {
      required: ['startUrls'],
      optional: ['maxReviewsPerUrl', 'language', 'reviewsSort'],
      defaults: {
        maxReviewsPerUrl: 100,
        language: 'es',
        reviewsSort: 'newest',
      },
    },
    outputFields: ['text', 'rating', 'author', 'date', 'reviewerPhotoUrl'],
  },

  // ==========================================
  // WEB & SEO
  // ==========================================

  website: {
    type: 'website',
    name: 'Website Scraper',
    description: 'Extrae contenido de páginas web: una sola página, múltiples páginas (crawl), o mapa de URLs',
    provider: 'firecrawl',
    actorId: 'firecrawl',
    category: 'web',
    inputSchema: {
      required: ['url'],
      optional: ['mode', 'limit', 'maxDepth', 'includePaths', 'excludePaths', 'formats', 'onlyMainContent', 'waitFor'],
      defaults: {
        mode: 'scrape',
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 0,
        limit: 10,
        maxDepth: 2,
      },
    },
    outputFields: ['markdown', 'metadata'],
  },

  seo_keywords: {
    type: 'seo_keywords',
    name: 'SEO Keywords (KWFinder)',
    description: 'Investiga keywords: vol\u00famen, CPC, dificultad y sugerencias relacionadas',
    provider: 'mangools',
    actorId: 'kwfinder',
    category: 'seo',
    inputSchema: {
      required: ['keyword'],
      optional: ['location', 'language', 'includeSerpOverview'],
      defaults: {
        location: 'Spain',
        language: 'es',
        includeSerpOverview: false,
      },
    },
    outputFields: ['keyword', 'searchVolume', 'cpc', 'competition', 'trend', 'serpResults'],
  },

  seo_serp_checker: {
    type: 'seo_serp_checker',
    name: 'SERP Checker',
    description: 'Analiza el SERP de Google: DA, PA, CF, TF y m\u00e9tricas de cada resultado',
    provider: 'mangools',
    actorId: 'serpchecker',
    category: 'seo',
    inputSchema: {
      required: ['keyword'],
      optional: ['location', 'language'],
      defaults: {
        location: 'Spain',
        language: 'es',
      },
    },
    outputFields: ['position', 'url', 'title', 'da', 'pa', 'cf', 'tf', 'links', 'ctr'],
  },

  seo_site_profiler: {
    type: 'seo_site_profiler',
    name: 'Site Profiler',
    description: 'M\u00e9tricas de dominio: DA, PA, backlinks, dominios referentes y tr\u00e1fico org\u00e1nico',
    provider: 'mangools',
    actorId: 'siteprofiler',
    category: 'seo',
    inputSchema: {
      required: ['url'],
      optional: [],
      defaults: {},
    },
    outputFields: ['domain', 'da', 'pa', 'cf', 'tf', 'backlinks', 'refDomains', 'organicTraffic'],
  },

  seo_link_miner: {
    type: 'seo_link_miner',
    name: 'Link Miner',
    description: 'An\u00e1lisis de backlinks: enlaces entrantes, ancors, CF/TF y tipo de link',
    provider: 'mangools',
    actorId: 'linkminer',
    category: 'seo',
    inputSchema: {
      required: ['url'],
      optional: ['linksPerDomain'],
      defaults: {
        linksPerDomain: 5,
      },
    },
    outputFields: ['sourceUrl', 'anchor', 'cf', 'tf', 'dofollow', 'targetUrl'],
  },

  seo_competitor_keywords: {
    type: 'seo_competitor_keywords',
    name: 'Competitor Keywords',
    description: 'Keywords de la competencia: posiciones, vol\u00famenes y URLs que rankean',
    provider: 'mangools',
    actorId: 'kwfinder-competitor',
    category: 'seo',
    inputSchema: {
      required: ['url'],
      optional: ['location', 'language'],
      defaults: {
        location: 'Spain',
        language: 'es',
      },
    },
    outputFields: ['keyword', 'position', 'searchVolume', 'cpc', 'url'],
  },

  // ==========================================
  // NEWS
  // ==========================================

  google_news: {
    type: 'google_news',
    name: 'Google News',
    description: 'Busca y extrae artículos de noticias de Google News por palabras clave',
    provider: 'apify',
    actorId: APIFY_ACTORS.GOOGLE_NEWS,
    category: 'web',
    inputSchema: {
      required: ['query'],
      optional: ['language', 'country', 'maxItems', 'dateRange'],
      defaults: {
        language: 'es',
        country: 'ES',
        maxItems: 50,
      },
    },
    outputFields: ['title', 'link', 'source', 'publishedAt', 'description', 'image'],
  },

  // ==========================================
  // CUSTOM
  // ==========================================

  news_bing: {
    type: 'news_bing',
    name: 'Bing News (con contenido)',
    description: 'Busca noticias en Bing News con extracción completa del contenido de cada artículo',
    provider: 'custom',
    actorId: 'scrape-bing-news',
    category: 'web',
    inputSchema: {
      required: ['queries'],
      optional: ['country', 'dateRange', 'maxPages', 'maxArticles', 'extractContent'],
      defaults: {
        country: 'es-ES',
        dateRange: 'anytime',
        maxPages: 10,
        maxArticles: 50,
        extractContent: true,
      },
    },
    outputFields: ['title', 'url', 'source', 'snippet', 'publishedAt', 'content', 'imageUrl', 'query', 'country'],
  },

  // ==========================================
  // PHANTOMBUSTER
  // ==========================================

  linkedin_post_engagers: {
    type: 'linkedin_post_engagers',
    name: 'LinkedIn Post Likers & Commenters',
    description: 'Extrae perfiles de personas que dieron like o comentaron en posts de LinkedIn. Requiere cookie de LinkedIn.',
    provider: 'phantombuster',
    actorId: PHANTOMBUSTER_AGENTS.LINKEDIN_POST_LIKERS_COMMENTERS,
    category: 'social',
    inputSchema: {
      required: ['postUrls'],
      optional: ['sessionCookie', 'numberOfLikersPerPost', 'numberOfCommentersPerPost'],
      defaults: {
        numberOfLikersPerPost: 100,
        numberOfCommentersPerPost: 100,
      },
    },
    outputFields: ['profileUrl', 'fullName', 'firstName', 'lastName', 'headline', 'location', 'connectionDegree', 'interactionType', 'postUrl'],
  },

  linkedin_profile_scraper: {
    type: 'linkedin_profile_scraper',
    name: 'LinkedIn Profile Scraper',
    description: 'Extrae información detallada de perfiles de LinkedIn. Requiere cookie de LinkedIn.',
    provider: 'phantombuster',
    actorId: PHANTOMBUSTER_AGENTS.LINKEDIN_PROFILE_SCRAPER,
    category: 'social',
    inputSchema: {
      required: ['profileUrls'],
      optional: ['sessionCookie'],
      defaults: {},
    },
    outputFields: ['profileUrl', 'fullName', 'firstName', 'lastName', 'headline', 'location', 'summary', 'company', 'title', 'connectionDegree', 'mutualConnectionsCount'],
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getScraperTemplate(type: ScraperType): ScraperTemplate {
  return SCRAPER_TEMPLATES[type];
}

export function getScrapersByCategory(category: ScraperTemplate['category']): ScraperTemplate[] {
  return Object.values(SCRAPER_TEMPLATES).filter((t) => t.category === category);
}

export function getScrapersByProvider(provider: ScraperProvider): ScraperTemplate[] {
  return Object.values(SCRAPER_TEMPLATES).filter((t) => t.provider === provider);
}

export function getAllScrapers(): ScraperTemplate[] {
  return Object.values(SCRAPER_TEMPLATES);
}

export function buildScraperInput(
  type: ScraperType,
  userInput: Record<string, unknown>
): Record<string, unknown> {
  const template = SCRAPER_TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown scraper type: ${type}`);
  }

  // Merge defaults with user input
  const merged = {
    ...template.inputSchema.defaults,
    ...userInput,
  };

  // Ensure array fields are properly typed
  // Some fields need to be arrays even if user passes a string
  const arrayFields = ['username', 'profiles', 'postURLs', 'postIds', 'startUrls',
    'youtube_channels', 'languages', 'stars', 'videoUrls', 'channelUrls', 'companyUrls', 'queries',
    'hashtags', 'searchQueries', 'placeUrls', 'searches', 'urls', 'profileUrls'];

  for (const field of arrayFields) {
    if (merged[field] !== undefined) {
      // If it's a string, convert to array
      if (typeof merged[field] === 'string') {
        const value = merged[field] as string;
        merged[field] = value.includes('\n')
          ? value.split('\n').map(s => s.trim()).filter(Boolean)
          : [value.trim()].filter(Boolean);
      }
      // Ensure it's an array
      if (!Array.isArray(merged[field])) {
        merged[field] = [merged[field]];
      }
    }
  }

  // Ensure number fields are numbers
  const numberFields = ['resultsLimit', 'limit', 'count', 'max_reviews', 'maxItems',
    'resultsPerPage', 'commentsPerPost', 'maxReviews', 'maxComments', 'maxPages', 'maxArticles',
    'maxRepliesPerComment', 'maxResults', 'maxResultsShorts', 'maxResultStreams'];

  for (const field of numberFields) {
    if (merged[field] !== undefined && typeof merged[field] === 'string') {
      merged[field] = parseInt(merged[field] as string, 10) || 0;
    }
  }

  // Special handling for Play Store: add language and country params to URLs
  if (type === 'playstore_reviews' && merged.startUrls && Array.isArray(merged.startUrls)) {
    const language = (merged.language as string) || 'es';
    const country = (merged.country as string) || 'ES';

    merged.startUrls = (merged.startUrls as string[]).map(url => {
      // If URL already has hl/gl params, don't add them
      if (url.includes('hl=') || url.includes('gl=')) {
        return url;
      }
      // Add language and country to URL
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}hl=${language}&gl=${country}`;
    });

    // Remove separate language/country fields since they're now in URLs
    delete merged.language;
    delete merged.country;
  }

  // Special handling for Reddit: startUrls needs to be array of {url: string} objects
  if (type === 'reddit_posts' && merged.startUrls && Array.isArray(merged.startUrls)) {
    merged.startUrls = (merged.startUrls as (string | {url: string})[]).map(item => {
      // If already an object with url property, keep it
      if (typeof item === 'object' && item !== null && 'url' in item) {
        return item;
      }
      // Convert string to object format
      return { url: item as string };
    });
  }

  return merged;
}

// ============================================
// SCRAPER CATEGORIES FOR UI
// ============================================

export const SCRAPER_CATEGORIES = [
  {
    id: 'social',
    name: 'Redes Sociales',
    description: 'Posts y comentarios de redes sociales',
    icon: 'users',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Videos, comentarios y transcripts',
    icon: 'youtube',
  },
  {
    id: 'reviews',
    name: 'Reviews',
    description: 'Reviews de apps y plataformas',
    icon: 'star',
  },
  {
    id: 'web',
    name: 'Web & Noticias',
    description: 'Contenido web y noticias',
    icon: 'globe',
  },
  {
    id: 'seo',
    name: 'SEO & Keywords',
    description: 'Keywords, backlinks y an\u00e1lisis SEO',
    icon: 'search',
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Scrapers personalizados',
    icon: 'code',
  },
] as const;
