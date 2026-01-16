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
  | 'reddit_posts'
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
  // News
  | 'google_news'
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
// OUTPUT FORMAT TYPES
// ============================================

export type ScraperOutputFormat = 'json' | 'jsonl' | 'csv' | 'markdown' | 'xml';

export interface ScraperOutputConfig {
  format: ScraperOutputFormat;
  fields?: string[];  // Specific fields to include (empty = all)
  flatten?: boolean;  // Flatten nested objects for CSV
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
  // Output configuration
  output_config?: ScraperOutputConfig;
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

// ============================================
// NICHE FINDER SCRAPER STEP TYPES
// Sistema de combinaciones A × B para buscar nichos
// ============================================

/**
 * Estado del job de scraping del Niche Finder
 */
export type NicheFinderJobStatus =
  | 'pending'        // Creado, esperando inicio
  | 'serp_running'   // Buscando URLs en SERP
  | 'serp_done'      // URLs encontradas, listo para scrapear
  | 'scraping'       // Scrapeando contenido con Firecrawl
  | 'extracting'     // Extrayendo nichos con LLM
  | 'completed'      // Completado exitosamente
  | 'failed';        // Error

/**
 * Estado de una URL individual en el proceso
 */
export type NicheFinderUrlStatus =
  | 'pending'    // Esperando scraping
  | 'scraped'    // Contenido obtenido
  | 'filtered'   // Descartado por LLM (no relevante)
  | 'extracted'  // Nichos extraídos exitosamente
  | 'failed';    // Error en scraping

/**
 * Tipo de fuente de datos
 */
export type NicheFinderSourceType =
  | 'reddit'           // Búsqueda en Reddit
  | 'thematic_forum'   // Foro temático (según contexto de vida)
  | 'general_forum';   // Foro general (forocoches, mediavida, etc.)

/**
 * Categoría de indicador de problema
 */
export type IndicatorCategory =
  | 'frustration'  // me frustra, estoy harto
  | 'help'         // ¿alguien sabe?, necesito ayuda
  | 'complaint'    // problema con, no puedo
  | 'need';        // busco alternativa, ojalá existiera

// ============================================
// COLUMNA A: CONTEXTOS DE VIDA
// ============================================

/**
 * Categorías de contextos de vida
 */
export type LifeContextCategory =
  | 'personal'      // familia, matrimonio, divorcio
  | 'family'        // hijos, bebés, adolescentes
  | 'work'          // empleados, autónomo, empresa
  | 'events'        // vacaciones, mudanza, jubilación
  | 'relationships';// roommates, compañeros de piso

/**
 * Un contexto de vida configurado para un proyecto
 */
export interface LifeContext {
  id: string;
  project_id: string;
  value: string;           // familia, hijos, universidad, casamiento...
  category?: LifeContextCategory;
  enabled: boolean;
  suggested_by_ai: boolean;
  created_at: string;
}

// ============================================
// COLUMNA B: PALABRAS DEL PRODUCTO
// ============================================

/**
 * Categorías de palabras del producto (ejemplo para fintech)
 */
export type ProductWordCategory =
  | 'money'       // dinero, pagos
  | 'savings'     // ahorro, ahorrar
  | 'expenses'    // gastos, presupuesto
  | 'investment'  // inversión, rendimiento
  | 'debt';       // deuda, préstamo

/**
 * Una palabra del producto configurada para un proyecto
 */
export interface ProductWord {
  id: string;
  project_id: string;
  value: string;           // pagos, ahorro, gastos, cuenta...
  category?: ProductWordCategory | string;  // Flexible para otras industrias
  enabled: boolean;
  suggested_by_ai: boolean;
  created_at: string;
}

// ============================================
// FUENTES DE DATOS
// ============================================

/**
 * Una fuente de datos configurada para un proyecto
 */
export interface NicheFinderSource {
  id: string;
  project_id: string;
  source_type: NicheFinderSourceType;
  value: string;           // reddit.com, forocoches.com, r/SpainFIRE...
  life_context?: string;   // A qué contexto de vida aplica (bodas → foros de novias)
  enabled: boolean;
  suggested_by_ai: boolean;
  created_at: string;
}

/**
 * Preset de indicador de problema (por idioma)
 */
export interface IndicatorPreset {
  id: string;
  language: string;        // es, en
  category: IndicatorCategory;
  indicator: string;       // me frustra, estoy harto, etc.
  created_at: string;
}

// ============================================
// CONFIGURACIÓN DEL SCRAPER STEP
// ============================================

/**
 * Configuración de fuentes para el scraper
 */
export interface ScraperSourcesConfig {
  reddit: boolean;              // Búsqueda general en Reddit
  thematic_forums: boolean;     // Foros temáticos según contexto
  general_forums: string[];     // Dominios de foros generales
}

/**
 * Configuración completa del Scraper Step (Step 0)
 * Sistema de combinaciones: life_contexts × product_words
 */
export interface ScraperStepConfig {
  // 🆕 SISTEMA DE COMBINACIONES A × B
  life_contexts: string[];      // Columna A: familia, hijos, universidad...
  product_words: string[];      // Columna B: pagos, ahorro, gastos...
  // Las combinaciones se generan automáticamente: A × B

  // Opcional: indicadores de problema para refinar búsqueda
  indicators: string[];         // me frustra, necesito ayuda... (opcional)

  // Fuentes donde buscar (por contexto de vida, no solo industria específica)
  sources: ScraperSourcesConfig;

  // Configuración de SERP
  serp_pages: number;           // Páginas de resultados (default: 5 = 50 resultados)

  // Configuración de scraping
  batch_size: number;           // URLs en paralelo (default: 10)

  // Configuración de extracción LLM
  extraction_prompt: string;    // Prompt para extraer nichos
  extraction_model: string;     // Modelo LLM (default: gpt-4o-mini)

  // Configuración opcional de filtro pre-scraping
  filter_by_domain?: boolean;   // Filtrar dominios no deseados
  excluded_domains?: string[];  // Dominios a excluir
}

// ============================================
// NICHE FINDER JOB
// ============================================

/**
 * Un job de Niche Finder (ejecución del scraping)
 */
export interface NicheFinderJob {
  id: string;
  project_id: string;
  status: NicheFinderJobStatus;
  config: ScraperStepConfig;

  // Estadísticas
  urls_found: number;
  urls_scraped: number;
  urls_filtered: number;
  urls_failed: number;
  niches_extracted: number;

  // Timestamps
  started_at?: string;
  completed_at?: string;
  created_at: string;

  // Error handling
  error_message?: string;
}

/**
 * Una URL encontrada por SERP en un job de Niche Finder
 */
export interface NicheFinderUrl {
  id: string;
  job_id: string;

  // Datos de la búsqueda
  life_context: string;         // Contexto de vida usado
  product_word: string;         // Palabra del producto usada
  indicator?: string;           // Indicador usado (si aplica)
  source_type: NicheFinderSourceType;

  // Resultado SERP
  url: string;
  title?: string;
  snippet?: string;
  position: number;

  // Estado y contenido
  status: NicheFinderUrlStatus;
  content_markdown?: string;    // Contenido scrapeado
  filtered_reason?: string;     // Si filtered: razón del LLM

  // Referencias
  doc_id?: string;              // Documento creado (si relevante)

  // Metadata
  error_message?: string;
  created_at: string;
}

/**
 * Un nicho extraído por el LLM
 */
export interface ExtractedNiche {
  id: string;
  job_id: string;
  url_id: string;

  // Campos extraídos (formato CSV del prompt)
  problem: string;
  persona: string;
  functional_cause: string;
  emotional_load: string;
  evidence: string;             // 2-3 citas separadas por |
  alternatives: string;
  source_url: string;

  // Metadata
  created_at: string;
}

// ============================================
// TRACKING DE COSTES
// ============================================

/**
 * Tipo de coste del Niche Finder
 */
export type NicheFinderCostType =
  | 'serp'            // Búsquedas SERP (Serper.dev)
  | 'firecrawl'       // Scraping de URLs
  | 'llm_extraction'; // Extracción con LLM

/**
 * Registro de coste de una operación
 */
export interface NicheFinderCost {
  id: string;
  job_id: string;
  cost_type: NicheFinderCostType;
  service: string;              // serper, firecrawl, openrouter
  units: number;                // calls, pages, o tokens
  cost_usd: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ============================================
// API TYPES
// ============================================

/**
 * Request para estimar costes antes de ejecutar
 */
export interface EstimateScraperCostRequest {
  project_id: string;
  config: ScraperStepConfig;
}

/**
 * Response con estimación de costes
 */
export interface EstimateScraperCostResponse {
  total_combinations: number;   // A × B
  total_queries: number;        // combinaciones × fuentes
  estimated_urls: number;
  costs: {
    serp: number;
    firecrawl: number;
    llm_extraction: number;
    total: number;
  };
}

/**
 * Request para sugerir fuentes/contextos con AI
 */
export interface SuggestSourcesRequest {
  project_id: string;
  industry: string;
  product_description: string;
  country: string;
  existing_life_contexts?: string[];
  existing_product_words?: string[];
}

/**
 * Response con sugerencias de AI
 */
export interface SuggestSourcesResponse {
  life_contexts: Array<{
    value: string;
    category: LifeContextCategory;
    reason: string;
  }>;
  product_words: Array<{
    value: string;
    category: string;
    reason: string;
  }>;
  sources: Array<{
    source_type: NicheFinderSourceType;
    value: string;
    life_context?: string;
    reason: string;
  }>;
}

/**
 * Request para iniciar job de scraping
 */
export interface StartNicheFinderRequest {
  project_id: string;
  config: ScraperStepConfig;
}

/**
 * Response al iniciar job
 */
export interface StartNicheFinderResponse {
  success: boolean;
  job_id?: string;
  error?: string;
}

/**
 * Estado del progreso de un job
 */
export interface NicheFinderProgress {
  job_id: string;
  status: NicheFinderJobStatus;
  phase: 'serp' | 'scraping' | 'extracting' | 'done';
  progress: {
    serp: {
      total: number;
      completed: number;
    };
    scraping: {
      total: number;
      completed: number;
      failed: number;
    };
    extraction: {
      total: number;
      completed: number;
      filtered: number;
    };
  };
  estimated_time_remaining_ms?: number;
}

/**
 * Output de un step de análisis LLM
 */
export interface AnalysisStepOutput {
  step_number: number;
  step_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  model?: string;
  tokens_input?: number;
  tokens_output?: number;
  cost_usd?: number;
  output_content?: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

/**
 * Resultados de un job completado
 */
export interface NicheFinderResults {
  job_id: string;
  status: string;
  niches: ExtractedNiche[];
  urls: {
    found: number;
    scraped: number;
    filtered: number;
    failed: number;
  };
  costs: {
    serp: number;
    firecrawl: number;
    llm: number;
    llm_analysis: number;
    total: number;
  };
  duration_ms: number;
  // LLM Analysis step outputs (Steps 1-3)
  analysis_steps?: AnalysisStepOutput[];
}
