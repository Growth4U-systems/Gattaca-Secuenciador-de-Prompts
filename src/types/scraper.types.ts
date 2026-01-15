/**
 * Scraper System Types
 * Types for managing scraper jobs, batches, and company profiles
 */

// ============================================
// ENUMS
// ============================================

export type ScraperStatus =
  | 'pending'     // Job created but not started
  | 'running'     // Actor is running
  | 'completed'   // Results fetched and saved
  | 'failed'      // Error occurred
  | 'processing'  // Webhook received, processing results
  | 'cancelled';  // Cancelled by user

export type ScraperProvider =
  | 'apify'       // Apify actors
  | 'firecrawl'   // Firecrawl API
  | 'mangools'    // Mangools SEO API
  | 'custom';     // Custom Edge Functions

export type BatchStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export type CompanyProfileStatus = 'pending' | 'extracting' | 'validating' | 'completed' | 'failed';

// ============================================
// SCRAPER TYPES (identifies the scraper)
// ============================================

export type ScraperType =
  // Social Media - Posts & Comments
  | 'instagram_posts_comments'
  | 'tiktok_posts'
  | 'tiktok_comments'
  | 'linkedin_company_posts'
  | 'linkedin_comments'
  | 'facebook_posts'
  | 'facebook_comments'
  | 'linkedin_company_insights'
  // YouTube
  | 'youtube_channel_videos'
  | 'youtube_comments'
  | 'youtube_transcripts'
  // Reviews
  | 'g2_reviews'
  | 'capterra_reviews'
  | 'trustpilot_reviews'
  | 'appstore_reviews'
  | 'playstore_reviews'
  | 'google_maps_reviews'
  // Web & SEO
  | 'website'
  | 'seo_keywords'
  // Custom
  | 'news_bing';

// ============================================
// SCRAPER TEMPLATES
// ============================================

export interface ScraperTemplate {
  type: ScraperType;
  name: string;
  description: string;
  provider: ScraperProvider;
  actorId: string;
  category: 'social' | 'youtube' | 'reviews' | 'web' | 'custom';
  inputSchema: ScraperInputSchema;
  outputFields: string[];  // Fields to extract from results
}

export interface ScraperInputSchema {
  required: string[];
  optional: string[];
  defaults: Record<string, unknown>;
}

// ============================================
// SCRAPER BATCH
// ============================================

export interface ScraperBatch {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  status: BatchStatus;
  created_at: string;
  completed_at?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateScraperBatchInput {
  project_id: string;
  name: string;
  description?: string;
  jobs: CreateScraperJobInput[];
}

// ============================================
// SCRAPER JOB
// ============================================

export interface ScraperJob {
  id: string;
  project_id: string;
  batch_id?: string;
  provider: ScraperProvider;
  actor_id: string;
  actor_run_id?: string;
  name: string;
  scraper_type: ScraperType;
  input_config: Record<string, unknown>;
  target_category: string;
  target_name?: string;
  status: ScraperStatus;
  progress_percent: number;
  result_count: number;
  result_preview?: unknown[];
  error_message?: string;
  error_code?: string;
  retry_count: number;
  webhook_secret?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  provider_metadata?: Record<string, unknown>;
}

export interface CreateScraperJobInput {
  scraper_type: ScraperType;
  input_config: Record<string, unknown>;
  target_category?: string;
  target_name?: string;
}

export interface ScraperJobWithBatch extends ScraperJob {
  batch?: ScraperBatch;
}

// ============================================
// COMPANY PROFILE
// ============================================

export interface SocialPresence {
  url: string;
  confidence: number;
  validated_at?: string;
  source?: string;
}

export interface CompanyProfile {
  id: string;
  project_id: string;
  input_name: string;
  target_country: string;
  company_name?: string;
  legal_name?: string;
  industry?: string;
  description?: string;

  // Social media presence
  website?: SocialPresence;
  linkedin?: SocialPresence;
  instagram?: SocialPresence;
  twitter?: SocialPresence;
  facebook?: SocialPresence;
  tiktok?: SocialPresence;
  youtube?: SocialPresence;

  // App stores
  app_store?: SocialPresence;
  play_store?: SocialPresence;

  // Review platforms
  trustpilot?: SocialPresence;
  g2?: SocialPresence;
  capterra?: SocialPresence;
  google_maps?: SocialPresence;
  glassdoor?: SocialPresence;

  // Metadata
  extraction_log?: unknown[];
  extraction_sources?: Record<string, unknown>;
  status: CompanyProfileStatus;
  created_at: string;
  updated_at: string;
  validated_at?: string;
}

export interface CreateCompanyProfileInput {
  project_id: string;
  input_name: string;
  target_country?: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface StartScraperRequest {
  project_id: string;
  // Single scraper
  scraper_type?: ScraperType;
  input_config?: Record<string, unknown>;
  // Target info for document naming/tagging
  target_name?: string;
  target_category?: string;
  tags?: string[];
  // Batch of scrapers
  batch?: {
    name?: string;
    jobs: CreateScraperJobInput[];
  };
}

export interface StartScraperResponse {
  success: boolean;
  job_id?: string;
  batch_id?: string;
  jobs?: ScraperJob[];
  completed?: boolean;  // True for sync scrapers (firecrawl) that complete immediately
  error?: string;
}

export interface ScraperStatusResponse {
  job?: ScraperJob;
  batch?: ScraperBatch & { jobs: ScraperJob[] };
}

export interface ScraperPollResponse {
  status: ScraperStatus;
  progress_percent: number;
  result_count?: number;
  completed: boolean;
  error?: string;
}

// ============================================
// WEBHOOK TYPES
// ============================================

export interface ApifyWebhookPayload {
  eventType: 'ACTOR.RUN.SUCCEEDED' | 'ACTOR.RUN.FAILED' | 'ACTOR.RUN.ABORTED';
  eventData: {
    actorId: string;
    actorRunId: string;
    status: string;
  };
  resource: {
    id: string;
    actId: string;
    status: string;
    defaultDatasetId: string;
    defaultKeyValueStoreId: string;
  };
}

export interface ScraperWebhookRequest {
  provider: ScraperProvider;
  job_id: string;
  webhook_secret: string;
  payload: ApifyWebhookPayload | Record<string, unknown>;
}

// ============================================
// APIFY SPECIFIC TYPES
// ============================================

export interface ApifyRunResponse {
  data: {
    id: string;
    actId: string;
    status: string;
    defaultDatasetId: string;
    defaultKeyValueStoreId: string;
  };
}

export interface ApifyRunStatus {
  data: {
    id: string;
    status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTING' | 'ABORTED' | 'TIMING-OUT' | 'TIMED-OUT';
    defaultDatasetId: string;
  };
}

export interface ApifyDatasetItem {
  [key: string]: unknown;
}

// ============================================
// FIRECRAWL SPECIFIC TYPES
// ============================================

export interface FirecrawlScrapeRequest {
  url: string;
  formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot')[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  waitFor?: number;
}

export interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    rawHtml?: string;
    links?: string[];
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      sourceURL?: string;
    };
  };
  error?: string;
}

// ============================================
// DOCUMENT SOURCE TYPES
// ============================================

export type DocumentSourceType = 'upload' | 'scraper' | 'api' | 'manual';

export interface ScrapedDocumentMetadata {
  source_type: 'scraper';
  source_job_id: string;
  source_url?: string;
  scraper_type: ScraperType;
  scraped_at: string;
  item_index?: number;
  total_items?: number;
}
