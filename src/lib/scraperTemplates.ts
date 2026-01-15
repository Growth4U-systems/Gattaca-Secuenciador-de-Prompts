/**
 * Scraper Templates
 * Configuration for all available scrapers with their Actor IDs and input schemas
 */

import { ScraperTemplate, ScraperType, ScraperProvider } from '@/types/scraper.types';

// ============================================
// APIFY ACTOR IDS
// ============================================

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

  // YouTube
  YOUTUBE_CHANNEL_VIDEOS: '6MHGJwYGoF8Cvtkg0',
  YOUTUBE_COMMENTS: 'mExYO4A2k9976zMfA',
  YOUTUBE_TRANSCRIPTS: 'L57jETyu9qT6J7bs5',

  // Reviews
  G2_REVIEWS: 'kT2dx4xoOebKw6uQB',
  CAPTERRA_REVIEWS: '50GSYJYYfRB0xCNRc',
  TRUSTPILOT_REVIEWS: 'fLXimoyuhE1UQgDbM',
  APPSTORE_REVIEWS: '4qRgh5vXXsv0bKa1l',
  PLAYSTORE_REVIEWS: 'Bs72sDKr8fGe3d5Ti',
  GOOGLE_MAPS_REVIEWS: 'thEbk6nzmhRsChwBS',
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
      required: ['directUrls'],
      optional: ['resultsLimit', 'resultsType'],
      defaults: {
        resultsLimit: 50,
        resultsType: 'posts',
      },
    },
    outputFields: ['shortCode', 'caption', 'likesCount', 'commentsCount', 'timestamp', 'comments'],
  },

  tiktok_posts: {
    type: 'tiktok_posts',
    name: 'TikTok Posts',
    description: 'Scrape posts from TikTok profiles',
    provider: 'apify',
    actorId: APIFY_ACTORS.TIKTOK_POSTS,
    category: 'social',
    inputSchema: {
      required: ['profiles'],
      optional: ['resultsPerPage', 'proxyCountryCode'],
      defaults: {
        resultsPerPage: 50,
        proxyCountryCode: 'ES',
      },
    },
    outputFields: ['id', 'text', 'createTime', 'stats', 'author'],
  },

  tiktok_comments: {
    type: 'tiktok_comments',
    name: 'TikTok Comments',
    description: 'Scrape comments from TikTok posts',
    provider: 'apify',
    actorId: APIFY_ACTORS.TIKTOK_COMMENTS,
    category: 'social',
    inputSchema: {
      required: ['postURLs'],
      optional: ['commentsPerPost'],
      defaults: {
        commentsPerPost: 100,
      },
    },
    outputFields: ['text', 'createTime', 'likesCount', 'user'],
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
    description: 'Get company information and insights from LinkedIn',
    provider: 'apify',
    actorId: APIFY_ACTORS.LINKEDIN_COMPANY_INSIGHTS,
    category: 'social',
    inputSchema: {
      required: ['companyUrls'],
      optional: [],
      defaults: {},
    },
    outputFields: ['name', 'description', 'industry', 'employeeCount', 'headquarters', 'website'],
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
      required: ['youtube_channels'],
      optional: ['End_date'],
      defaults: {},
    },
    outputFields: ['title', 'description', 'viewCount', 'likeCount', 'publishedAt', 'url'],
  },

  youtube_comments: {
    type: 'youtube_comments',
    name: 'YouTube Comments',
    description: 'Scrape comments from YouTube videos',
    provider: 'apify',
    actorId: APIFY_ACTORS.YOUTUBE_COMMENTS,
    category: 'youtube',
    inputSchema: {
      required: ['videoUrls'],
      optional: ['maxComments'],
      defaults: {
        maxComments: 100,
      },
    },
    outputFields: ['text', 'author', 'likesCount', 'publishedAt'],
  },

  youtube_transcripts: {
    type: 'youtube_transcripts',
    name: 'YouTube Transcripts',
    description: 'Extract transcripts from YouTube videos',
    provider: 'apify',
    actorId: APIFY_ACTORS.YOUTUBE_TRANSCRIPTS,
    category: 'youtube',
    inputSchema: {
      required: ['videoUrls'],
      optional: ['language'],
      defaults: {
        language: 'es',
      },
    },
    outputFields: ['transcript', 'language', 'isGenerated'],
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
    description: 'Scrape reviews from Capterra',
    provider: 'apify',
    actorId: APIFY_ACTORS.CAPTERRA_REVIEWS,
    category: 'reviews',
    inputSchema: {
      required: ['productUrls'],
      optional: ['maxReviews'],
      defaults: {
        maxReviews: 100,
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
      optional: ['maxItems', 'language', 'country'],
      defaults: {
        maxItems: 100,
        language: 'es',
        country: 'es',
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
      required: ['placeUrls'],
      optional: ['maxReviews', 'language'],
      defaults: {
        maxReviews: 100,
        language: 'es',
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
    description: 'Scrape website content as markdown using Firecrawl',
    provider: 'firecrawl',
    actorId: 'firecrawl',
    category: 'web',
    inputSchema: {
      required: ['url'],
      optional: ['formats', 'onlyMainContent', 'waitFor'],
      defaults: {
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 0,
      },
    },
    outputFields: ['markdown', 'metadata'],
  },

  seo_keywords: {
    type: 'seo_keywords',
    name: 'SEO Keywords',
    description: 'Get SEO keyword data from Mangools',
    provider: 'mangools',
    actorId: 'mangools',
    category: 'web',
    inputSchema: {
      required: ['keyword'],
      optional: ['location', 'language'],
      defaults: {
        location: 'Spain',
        language: 'es',
      },
    },
    outputFields: ['keyword', 'searchVolume', 'cpc', 'competition', 'trend'],
  },

  // ==========================================
  // CUSTOM
  // ==========================================

  news_bing: {
    type: 'news_bing',
    name: 'News (Bing)',
    description: 'Search and scrape news articles from Bing News',
    provider: 'custom',
    actorId: 'news-bing',
    category: 'custom',
    inputSchema: {
      required: ['queries'],
      optional: ['country', 'maxPages', 'maxArticles'],
      defaults: {
        country: 'es-ES',
        maxPages: 10,
        maxArticles: 50,
      },
    },
    outputFields: ['title', 'url', 'content', 'date', 'source'],
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
  const arrayFields = ['directUrls', 'profiles', 'postURLs', 'postIds', 'startUrls',
    'youtube_channels', 'languages', 'stars', 'videoUrls', 'channelUrls', 'companyUrls'];

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
    'resultsPerPage', 'commentsPerPost'];

  for (const field of numberFields) {
    if (merged[field] !== undefined && typeof merged[field] === 'string') {
      merged[field] = parseInt(merged[field] as string, 10) || 0;
    }
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
    name: 'Web & SEO',
    description: 'Contenido web y keywords',
    icon: 'globe',
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Scrapers personalizados',
    icon: 'code',
  },
] as const;
