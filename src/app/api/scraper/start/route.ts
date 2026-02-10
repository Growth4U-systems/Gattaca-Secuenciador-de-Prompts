import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createAdminClient } from '@/lib/supabase-server-admin';
import { randomUUID } from 'crypto';
import {
  StartScraperRequest,
  StartScraperResponse,
  ScraperJob,
  ScraperProvider,
  FirecrawlScrapeResponse,
  ApifyRunResponse,
} from '@/types/scraper.types';
import { getScraperTemplate, buildScraperInput, SCRAPER_TEMPLATES } from '@/lib/scraperTemplates';
import { getUserApiKey } from '@/lib/getUserApiKey';
import { triggerEmbeddingGeneration } from '@/lib/embeddings';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes for sync scrapers like Firecrawl

// ============================================
// ENVIRONMENT VARIABLES (fallbacks)
// ============================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ============================================
// DOCUMENT NAMING AND TAGGING HELPERS
// ============================================

const SOURCE_NAMES: Record<string, string> = {
  website: 'Website Content',
  trustpilot_reviews: 'Trustpilot Reviews',
  instagram_posts_comments: 'Instagram Posts & Comments',
  tiktok_posts: 'TikTok Posts',
  tiktok_comments: 'TikTok Comments',
  linkedin_company_posts: 'LinkedIn Posts',
  linkedin_comments: 'LinkedIn Comments',
  linkedin_company_insights: 'LinkedIn Company Info',
  facebook_posts: 'Facebook Posts',
  facebook_comments: 'Facebook Comments',
  youtube_channel_videos: 'YouTube Videos',
  youtube_comments: 'YouTube Comments',
  youtube_transcripts: 'YouTube Transcripts',
  g2_reviews: 'G2 Reviews',
  capterra_reviews: 'Capterra Reviews',
  appstore_reviews: 'App Store Reviews',
  playstore_reviews: 'Play Store Reviews',
  google_maps_reviews: 'Google Maps Reviews',
  seo_keywords: 'SEO Keywords',
  seo_serp_checker: 'SERP Analysis',
  seo_site_profiler: 'Site Profile',
  seo_link_miner: 'Backlink Analysis',
  seo_competitor_keywords: 'Competitor Keywords',
  news_bing: 'News Articles',
};

function generateDocumentName(scraperType: string, targetName: string): string {
  const sourceName = SOURCE_NAMES[scraperType] || scraperType;
  return `${sourceName} - ${targetName}`;
}

function generateAutoTags(scraperType: string, targetName: string): string[] {
  const today = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');

  const sourceTag = SOURCE_NAMES[scraperType]?.split(' ')[0] || scraperType;

  const tags = [
    targetName,
    sourceTag,
    today,
  ].filter(Boolean);

  return [...new Set(tags)]; // Remove duplicates
}

async function generateDocumentBrief(
  content: string,
  scraperType: string,
  targetName: string
): Promise<string> {
  // If no OpenAI key, return a default description
  if (!OPENAI_API_KEY) {
    const sourceName = SOURCE_NAMES[scraperType] || scraperType;
    return `Datos de ${sourceName} para ${targetName}, extraídos el ${new Date().toLocaleDateString('es-ES')}.`;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente que genera descripciones breves de documentos para facilitar su búsqueda y asignación. Responde SOLO con la descripción, sin explicaciones adicionales. La descripción debe ser en español, 2-3 líneas máximo.'
          },
          {
            role: 'user',
            content: `Genera una descripción breve de este documento:

Tipo de datos: ${SOURCE_NAMES[scraperType] || scraperType}
Empresa/Marca: ${targetName}
Contenido (primeros 2000 caracteres): ${content.slice(0, 2000)}`
          }
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() ||
        `Datos de ${SOURCE_NAMES[scraperType] || scraperType} para ${targetName}.`;
    }
  } catch (error) {
    console.error('[scraper/start] Error generating brief:', error);
  }

  // Fallback
  return `Datos de ${SOURCE_NAMES[scraperType] || scraperType} para ${targetName}, extraídos el ${new Date().toLocaleDateString('es-ES')}.`;
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StartScraperRequest;
    const { project_id, scraper_type, input_config, batch, target_name, target_category, tags, output_config, metadata } = body;

    if (!project_id) {
      return NextResponse.json({ success: false, error: 'Missing project_id' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // Handle batch or single scraper
    const userId = session.user.id;
    if (batch) {
      return await handleBatch(supabase, project_id, batch, userId);
    } else if (scraper_type && input_config) {
      return await handleSingleScraper(
        supabase,
        project_id,
        scraper_type,
        input_config,
        target_name,
        target_category,
        tags,
        output_config,
        userId,
        metadata
      );
    } else {
      return NextResponse.json(
        { success: false, error: 'Must provide either scraper_type+input_config or batch' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[scraper/start] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// SINGLE SCRAPER HANDLER
// ============================================

async function handleSingleScraper(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  scraperType: string,
  inputConfig: Record<string, unknown>,
  targetName?: string,
  targetCategory?: string,
  tags?: string[],
  outputConfig?: StartScraperRequest['output_config'],
  userId?: string,
  customMetadata?: Record<string, unknown>
): Promise<NextResponse<StartScraperResponse>> {
  const template = getScraperTemplate(scraperType as Parameters<typeof getScraperTemplate>[0]);
  if (!template) {
    return NextResponse.json({ success: false, error: `Unknown scraper type: ${scraperType}` }, { status: 400 });
  }

  const webhookSecret = randomUUID();
  const finalInput = buildScraperInput(template.type, inputConfig);

  // Create job record with target info, output config, and custom metadata
  const providerMetadata: Record<string, unknown> = {};
  if (outputConfig) {
    providerMetadata.output_config = outputConfig;
  }
  if (customMetadata) {
    providerMetadata.custom_metadata = customMetadata;
  }

  const { data: job, error: jobError } = await supabase
    .from('scraper_jobs')
    .insert({
      project_id: projectId,
      provider: template.provider,
      actor_id: template.actorId,
      name: template.name,
      scraper_type: template.type,
      input_config: finalInput,
      target_name: targetName,
      target_category: targetCategory || 'research',
      webhook_secret: webhookSecret,
      status: 'pending',
      provider_metadata: Object.keys(providerMetadata).length > 0 ? providerMetadata : undefined,
    })
    .select()
    .single();

  if (jobError || !job) {
    console.error('[scraper/start] Failed to create job:', jobError);
    return NextResponse.json({ success: false, error: 'Failed to create job record' }, { status: 500 });
  }

  // Execute based on provider
  try {
    switch (template.provider) {
      case 'firecrawl':
        return await executeFirecrawl(supabase, job as ScraperJob, finalInput, targetName, targetCategory, tags, userId);
      case 'apify':
        return await launchApifyActor(supabase, job as ScraperJob, finalInput, webhookSecret, targetName, targetCategory, tags, userId);
      case 'mangools':
        return await executeMangools(supabase, job as ScraperJob, finalInput, targetName, targetCategory, tags, userId);
      case 'phantombuster':
        return await executePhantombuster(supabase, job as ScraperJob, finalInput, targetName, targetCategory, tags, userId);
      case 'custom':
        return await executeCustomScraper(supabase, job as ScraperJob, finalInput, targetName, targetCategory, tags, userId);
      default:
        return NextResponse.json({ success: false, error: `Unsupported provider: ${template.provider}` }, { status: 400 });
    }
  } catch (error) {
    // Update job with error
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    throw error;
  }
}

// ============================================
// BATCH HANDLER
// ============================================

async function handleBatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  batch: NonNullable<StartScraperRequest['batch']>,
  userId?: string
): Promise<NextResponse<StartScraperResponse>> {
  const { name, jobs: jobConfigs } = batch;

  if (!jobConfigs || jobConfigs.length === 0) {
    return NextResponse.json({ success: false, error: 'Batch must have at least one job' }, { status: 400 });
  }

  // Create batch record
  const { data: batchRecord, error: batchError } = await supabase
    .from('scraper_batches')
    .insert({
      project_id: projectId,
      name: name || `Batch ${new Date().toISOString()}`,
      total_jobs: jobConfigs.length,
      status: 'running',
    })
    .select()
    .single();

  if (batchError || !batchRecord) {
    console.error('[scraper/start] Failed to create batch:', batchError);
    return NextResponse.json({ success: false, error: 'Failed to create batch record' }, { status: 500 });
  }

  // Create all job records
  const jobsToInsert = jobConfigs.map((config) => {
    const template = getScraperTemplate(config.scraper_type as Parameters<typeof getScraperTemplate>[0]);
    if (!template) {
      throw new Error(`Unknown scraper type: ${config.scraper_type}`);
    }

    const finalInput = buildScraperInput(template.type, config.input_config);

    return {
      project_id: projectId,
      batch_id: batchRecord.id,
      provider: template.provider,
      actor_id: template.actorId,
      name: template.name,
      scraper_type: template.type,
      input_config: finalInput,
      target_category: config.target_category || 'research',
      target_name: config.target_name,
      webhook_secret: randomUUID(),
      status: 'pending' as const,
    };
  });

  const { data: jobs, error: jobsError } = await supabase.from('scraper_jobs').insert(jobsToInsert).select();

  if (jobsError || !jobs) {
    console.error('[scraper/start] Failed to create jobs:', jobsError);
    return NextResponse.json({ success: false, error: 'Failed to create job records' }, { status: 500 });
  }

  // Launch all jobs asynchronously (don't wait)
  launchBatchJobs(supabase, jobs as ScraperJob[], userId).catch((err) => {
    console.error('[scraper/start] Error launching batch jobs:', err);
  });

  return NextResponse.json({
    success: true,
    batch_id: batchRecord.id,
    jobs: jobs as ScraperJob[],
  });
}

// ============================================
// LAUNCH BATCH JOBS (async, doesn't block response)
// ============================================

async function launchBatchJobs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobs: ScraperJob[],
  userId?: string
): Promise<void> {
  for (const job of jobs) {
    try {
      const template = getScraperTemplate(job.scraper_type as Parameters<typeof getScraperTemplate>[0]);
      if (!template) continue;

      switch (template.provider) {
        case 'firecrawl':
          await executeFirecrawl(
            supabase,
            job,
            job.input_config,
            job.target_name,
            job.target_category,
            undefined, // Tags will be auto-generated
            userId
          );
          break;
        case 'apify':
          await launchApifyActor(
            supabase,
            job,
            job.input_config,
            job.webhook_secret || '',
            job.target_name,
            job.target_category,
            undefined, // Tags will be auto-generated
            userId
          );
          break;
        // Add other providers as needed
      }
    } catch (error) {
      console.error(`[scraper/start] Error launching job ${job.id}:`, error);
      await supabase
        .from('scraper_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }
  }
}

// ============================================
// FIRECRAWL EXECUTOR (Supports scrape, crawl, and map modes)
// ============================================

// Types for Firecrawl responses
interface FirecrawlCrawlResponse {
  success: boolean;
  id?: string;
  status?: string;
  completed?: number;
  total?: number;
  data?: Array<{
    markdown?: string;
    html?: string;
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
      [key: string]: unknown;
    };
  }>;
  error?: string;
}

interface FirecrawlMapResponse {
  success: boolean;
  links?: string[];
  error?: string;
}

async function executeFirecrawl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  input: Record<string, unknown>,
  targetName?: string,
  targetCategory?: string,
  providedTags?: string[],
  userId?: string
): Promise<NextResponse<StartScraperResponse>> {
  // Get Firecrawl API key (user's personal key or fallback to env)
  const firecrawlApiKey = userId
    ? await getUserApiKey({ userId, serviceName: 'firecrawl', supabase })
    : process.env.FIRECRAWL_API_KEY;

  if (!firecrawlApiKey) {
    throw new Error('Firecrawl API key not configured. Please add your API key in Settings > API Keys.');
  }

  // Update job to running
  await supabase
    .from('scraper_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', job.id);

  const url = input.url as string;
  if (!url) {
    throw new Error('Missing url in input');
  }

  const mode = (input.mode as string) || 'scrape';

  // Route to appropriate handler based on mode
  switch (mode) {
    case 'crawl':
      return await executeFirecrawlCrawl(supabase, job, input, url, firecrawlApiKey, targetName, targetCategory, providedTags);
    case 'map':
      return await executeFirecrawlMap(supabase, job, input, url, firecrawlApiKey, targetName, targetCategory, providedTags);
    case 'scrape':
    default:
      return await executeFirecrawlScrape(supabase, job, input, url, firecrawlApiKey, targetName, targetCategory, providedTags);
  }
}

// Single page scrape (original behavior)
async function executeFirecrawlScrape(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  input: Record<string, unknown>,
  url: string,
  firecrawlApiKey: string,
  targetName?: string,
  targetCategory?: string,
  providedTags?: string[]
): Promise<NextResponse<StartScraperResponse>> {
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${firecrawlApiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: input.formats || ['markdown'],
      onlyMainContent: input.onlyMainContent ?? true,
      waitFor: input.waitFor || 0,
    }),
  });

  const result = (await response.json()) as FirecrawlScrapeResponse;

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Firecrawl scrape failed');
  }

  const effectiveTargetName = targetName || result.data.metadata?.title || new URL(url).hostname;
  const documentName = generateDocumentName(job.scraper_type, effectiveTargetName);
  const documentTags = providedTags?.length ? providedTags : generateAutoTags(job.scraper_type, effectiveTargetName);
  const documentContent = result.data.markdown || '';

  const documentBrief = await generateDocumentBrief(documentContent, job.scraper_type, effectiveTargetName);

  const adminClient = createAdminClient();

  // Extract custom metadata from job (e.g., campaign_id, source_type for playbooks)
  const jobProviderMeta = job.provider_metadata as Record<string, unknown> | undefined;
  const customMeta = jobProviderMeta?.custom_metadata as Record<string, unknown> | undefined;

  const { data: doc, error: docError } = await adminClient
    .from('knowledge_base_docs')
    .insert({
      project_id: job.project_id,
      filename: documentName,
      extracted_content: documentContent,
      description: documentBrief,
      category: targetCategory || job.target_category || 'research',
      tags: documentTags,
      source_type: 'scraper',
      source_job_id: job.id,
      source_url: url,
      source_metadata: {
        scraper_type: job.scraper_type,
        scraped_at: new Date().toISOString(),
        metadata: result.data.metadata,
        target_name: effectiveTargetName,
        mode: 'scrape',
        // Include custom metadata for playbook document matching
        ...(customMeta || {}),
      },
    })
    .select()
    .single();

  if (docError) {
    console.error('[scraper/start] Failed to save document:', docError);
    throw new Error(`Failed to save document: ${docError.message}`);
  }

  // Trigger embedding generation
  if (doc?.id) {
    triggerEmbeddingGeneration(doc.id).catch(err => {
      console.error('[scraper/start] Embedding generation failed:', err);
    });
  }

  await supabase
    .from('scraper_jobs')
    .update({
      status: 'completed',
      result_count: 1,
      result_preview: [{ title: documentName, url }],
      completed_at: new Date().toISOString(),
      provider_metadata: {
        ...((job.provider_metadata as Record<string, unknown>) || {}),
        firecrawl_metadata: result.data.metadata,
        document_id: doc?.id,
        mode: 'scrape',
      },
    })
    .eq('id', job.id);

  return NextResponse.json({
    success: true,
    job_id: job.id,
    completed: true,
  });
}

// Crawl multiple pages
async function executeFirecrawlCrawl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  input: Record<string, unknown>,
  url: string,
  firecrawlApiKey: string,
  targetName?: string,
  targetCategory?: string,
  providedTags?: string[]
): Promise<NextResponse<StartScraperResponse>> {
  // Parse includePaths and excludePaths from text arrays
  const includePaths = input.includePaths
    ? (Array.isArray(input.includePaths) ? input.includePaths : [input.includePaths])
        .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    : undefined;

  const excludePaths = input.excludePaths
    ? (Array.isArray(input.excludePaths) ? input.excludePaths : [input.excludePaths])
        .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    : undefined;

  const crawlBody: Record<string, unknown> = {
    url,
    limit: Math.min(Number(input.limit) || 10, 100),
    maxDepth: Math.min(Number(input.maxDepth) || 2, 5),
    scrapeOptions: {
      formats: input.formats || ['markdown'],
      onlyMainContent: input.onlyMainContent ?? true,
    },
  };

  if (includePaths && includePaths.length > 0) {
    crawlBody.includePaths = includePaths;
  }
  if (excludePaths && excludePaths.length > 0) {
    crawlBody.excludePaths = excludePaths;
  }

  console.log('[scraper/start] Starting crawl:', JSON.stringify(crawlBody, null, 2));

  // Start the crawl (async operation)
  const startResponse = await fetch('https://api.firecrawl.dev/v1/crawl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${firecrawlApiKey}`,
    },
    body: JSON.stringify(crawlBody),
  });

  const startResult = (await startResponse.json()) as FirecrawlCrawlResponse;

  if (!startResult.success || !startResult.id) {
    throw new Error(startResult.error || 'Failed to start crawl');
  }

  const crawlId = startResult.id;
  console.log('[scraper/start] Crawl started with ID:', crawlId);

  // Poll for completion (with timeout)
  const maxWaitTime = 90000; // 90 seconds
  const pollInterval = 3000;
  const startTime = Date.now();

  let crawlResult: FirecrawlCrawlResponse | null = null;

  while (Date.now() - startTime < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const statusResponse = await fetch(`https://api.firecrawl.dev/v1/crawl/${crawlId}`, {
      headers: { Authorization: `Bearer ${firecrawlApiKey}` },
    });

    const statusResult = (await statusResponse.json()) as FirecrawlCrawlResponse;

    console.log('[scraper/start] Crawl status:', statusResult.status, `${statusResult.completed || 0}/${statusResult.total || '?'} pages`);

    if (statusResult.status === 'completed') {
      crawlResult = statusResult;
      break;
    } else if (statusResult.status === 'failed') {
      throw new Error(statusResult.error || 'Crawl failed');
    }

    // Update job progress (merge with existing metadata to preserve custom_metadata)
    await supabase
      .from('scraper_jobs')
      .update({
        provider_metadata: {
          ...((job.provider_metadata as Record<string, unknown>) || {}),
          crawl_id: crawlId,
          status: statusResult.status,
          completed: statusResult.completed,
          total: statusResult.total,
        },
      })
      .eq('id', job.id);
  }

  if (!crawlResult || !crawlResult.data) {
    throw new Error('Crawl timed out or returned no data');
  }

  const pages = crawlResult.data;
  const effectiveTargetName = targetName || new URL(url).hostname;

  // Build combined content with clear page separators
  let combinedContent = `# Crawl de ${effectiveTargetName}\n\n`;
  combinedContent += `**URL base:** ${url}\n`;
  combinedContent += `**Páginas extraídas:** ${pages.length}\n`;
  if (includePaths && includePaths.length > 0) {
    combinedContent += `**Filtro de inclusión:** ${includePaths.join(', ')}\n`;
  }
  if (excludePaths && excludePaths.length > 0) {
    combinedContent += `**Filtro de exclusión:** ${excludePaths.join(', ')}\n`;
  }
  combinedContent += `**Fecha:** ${new Date().toLocaleDateString('es-ES')}\n\n---\n\n`;

  for (const page of pages) {
    const pageUrl = page.metadata?.sourceURL || 'URL desconocida';
    const pageTitle = page.metadata?.title || 'Sin título';
    combinedContent += `## ${pageTitle}\n`;
    combinedContent += `**URL:** ${pageUrl}\n\n`;
    combinedContent += page.markdown || '_Sin contenido_';
    combinedContent += `\n\n---\n\n`;
  }

  const documentName = `Website Crawl - ${effectiveTargetName}`;
  const documentTags = providedTags?.length
    ? providedTags
    : [...generateAutoTags(job.scraper_type, effectiveTargetName), 'crawl', `${pages.length} páginas`];

  const documentBrief = await generateDocumentBrief(
    combinedContent.slice(0, 3000),
    job.scraper_type,
    effectiveTargetName
  );

  const adminClient = createAdminClient();

  // Extract custom metadata from job (e.g., campaign_id, source_type for playbooks)
  const crawlJobProviderMeta = job.provider_metadata as Record<string, unknown> | undefined;
  const crawlCustomMeta = crawlJobProviderMeta?.custom_metadata as Record<string, unknown> | undefined;

  const { data: doc, error: docError } = await adminClient
    .from('knowledge_base_docs')
    .insert({
      project_id: job.project_id,
      filename: documentName,
      extracted_content: combinedContent,
      description: documentBrief,
      category: targetCategory || job.target_category || 'research',
      tags: documentTags,
      source_type: 'scraper',
      source_job_id: job.id,
      source_url: url,
      source_metadata: {
        scraper_type: job.scraper_type,
        scraped_at: new Date().toISOString(),
        target_name: effectiveTargetName,
        mode: 'crawl',
        pages_count: pages.length,
        crawl_config: { includePaths, excludePaths, limit: input.limit, maxDepth: input.maxDepth },
        pages_urls: pages.map(p => p.metadata?.sourceURL).filter(Boolean),
        // Include custom metadata for playbook document matching
        ...(crawlCustomMeta || {}),
      },
    })
    .select()
    .single();

  if (docError) {
    console.error('[scraper/start] Failed to save crawl document:', docError);
    throw new Error(`Failed to save document: ${docError.message}`);
  }

  // Trigger embedding generation
  if (doc?.id) {
    triggerEmbeddingGeneration(doc.id).catch(err => {
      console.error('[scraper/start] Embedding generation failed:', err);
    });
  }

  await supabase
    .from('scraper_jobs')
    .update({
      status: 'completed',
      result_count: pages.length,
      result_preview: pages.slice(0, 5).map(p => ({
        title: p.metadata?.title || 'Sin título',
        url: p.metadata?.sourceURL || url,
      })),
      completed_at: new Date().toISOString(),
      provider_metadata: {
        ...((job.provider_metadata as Record<string, unknown>) || {}),
        crawl_id: crawlId,
        mode: 'crawl',
        document_id: doc?.id,
        pages_count: pages.length,
      },
    })
    .eq('id', job.id);

  return NextResponse.json({
    success: true,
    job_id: job.id,
    completed: true,
  });
}

// Map URLs (discover without scraping)
async function executeFirecrawlMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  input: Record<string, unknown>,
  url: string,
  firecrawlApiKey: string,
  targetName?: string,
  targetCategory?: string,
  providedTags?: string[]
): Promise<NextResponse<StartScraperResponse>> {
  const response = await fetch('https://api.firecrawl.dev/v1/map', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${firecrawlApiKey}`,
    },
    body: JSON.stringify({
      url,
      limit: Math.min(Number(input.limit) || 100, 500),
    }),
  });

  const result = (await response.json()) as FirecrawlMapResponse;

  if (!result.success || !result.links) {
    throw new Error(result.error || 'Map failed');
  }

  const links = result.links;
  const effectiveTargetName = targetName || new URL(url).hostname;

  // Group links by path pattern
  const linksBySection: Record<string, string[]> = {};
  for (const link of links) {
    try {
      const linkUrl = new URL(link);
      const pathParts = linkUrl.pathname.split('/').filter(Boolean);
      const section = pathParts[0] || 'root';
      if (!linksBySection[section]) linksBySection[section] = [];
      linksBySection[section].push(link);
    } catch {
      if (!linksBySection['other']) linksBySection['other'] = [];
      linksBySection['other'].push(link);
    }
  }

  const mapData = {
    url,
    target: effectiveTargetName,
    total_urls: links.length,
    scraped_at: new Date().toISOString(),
    sections: Object.entries(linksBySection).map(([section, urls]) => ({
      section,
      count: urls.length,
      urls,
    })),
    all_urls: links,
  };

  const documentContent = JSON.stringify(mapData, null, 2);
  const documentName = `URL Map - ${effectiveTargetName}`;
  const documentTags = providedTags?.length
    ? providedTags
    : [...generateAutoTags(job.scraper_type, effectiveTargetName), 'sitemap', `${links.length} URLs`];

  const documentBrief = `Mapa de ${links.length} URLs del sitio ${effectiveTargetName}. Secciones: ${Object.keys(linksBySection).join(', ')}.`;

  const adminClient = createAdminClient();

  const { data: doc, error: docError } = await adminClient
    .from('knowledge_base_docs')
    .insert({
      project_id: job.project_id,
      filename: documentName,
      extracted_content: documentContent,
      description: documentBrief,
      category: targetCategory || job.target_category || 'research',
      tags: documentTags,
      source_type: 'scraper',
      source_job_id: job.id,
      source_url: url,
      source_metadata: {
        scraper_type: job.scraper_type,
        scraped_at: new Date().toISOString(),
        target_name: effectiveTargetName,
        mode: 'map',
        urls_count: links.length,
        sections: Object.keys(linksBySection),
      },
    })
    .select()
    .single();

  if (docError) {
    console.error('[scraper/start] Failed to save map document:', docError);
    throw new Error(`Failed to save document: ${docError.message}`);
  }

  // Trigger embedding generation
  if (doc?.id) {
    triggerEmbeddingGeneration(doc.id).catch(err => {
      console.error('[scraper/start] Embedding generation failed:', err);
    });
  }

  await supabase
    .from('scraper_jobs')
    .update({
      status: 'completed',
      result_count: links.length,
      result_preview: links.slice(0, 10).map(link => ({ title: link, url: link })),
      completed_at: new Date().toISOString(),
      provider_metadata: {
        ...((job.provider_metadata as Record<string, unknown>) || {}),
        mode: 'map',
        document_id: doc?.id,
        urls_count: links.length,
        sections: Object.keys(linksBySection),
      },
    })
    .eq('id', job.id);

  return NextResponse.json({
    success: true,
    job_id: job.id,
    completed: true,
  });
}

// ============================================
// APIFY LAUNCHER (Async - starts run and returns)
// ============================================

async function launchApifyActor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  input: Record<string, unknown>,
  webhookSecret: string,
  targetName?: string,
  targetCategory?: string,
  providedTags?: string[],
  userId?: string
): Promise<NextResponse<StartScraperResponse>> {
  // Get Apify API key (user's personal key or fallback to env)
  const apifyToken = userId
    ? await getUserApiKey({ userId, serviceName: 'apify', supabase })
    : process.env.APIFY_TOKEN;

  if (!apifyToken) {
    throw new Error('Apify API key not configured. Please add your API key in Settings > API Keys.');
  }

  // Update job to running with target info for later processing
  await supabase
    .from('scraper_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      target_name: targetName,
      target_category: targetCategory || 'research',
    })
    .eq('id', job.id);

  // Build webhook URL
  const webhookUrl = `${APP_URL}/api/scraper/webhook?job_id=${job.id}&secret=${webhookSecret}`;

  // Launch Apify actor
  const response = await fetch(`https://api.apify.com/v2/acts/${job.actor_id}/runs?token=${apifyToken}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...input,
      // Configure webhook to be called when run finishes
      webhooks: [
        {
          eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.ABORTED'],
          requestUrl: webhookUrl,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apify API error: ${response.status} - ${errorText}`);
  }

  const result = (await response.json()) as ApifyRunResponse;

  // Update job with actor_run_id and store tags for webhook processing
  // Preserve any existing provider_metadata (like output_config)
  const existingMetadata = (job.provider_metadata as Record<string, unknown>) || {};
  await supabase
    .from('scraper_jobs')
    .update({
      actor_run_id: result.data.id,
      provider_metadata: {
        ...existingMetadata,
        actId: result.data.actId,
        defaultDatasetId: result.data.defaultDatasetId,
        defaultKeyValueStoreId: result.data.defaultKeyValueStoreId,
        // Store tags for use when webhook processes results
        pending_tags: providedTags || generateAutoTags(job.scraper_type, targetName || ''),
      },
    })
    .eq('id', job.id);

  return NextResponse.json({
    success: true,
    job_id: job.id,
    completed: false, // Apify is async, not completed yet
  });
}

// ============================================
// CUSTOM SCRAPER EXECUTOR (Edge Functions)
// ============================================

async function executeCustomScraper(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  input: Record<string, unknown>,
  targetName?: string,
  targetCategory?: string,
  providedTags?: string[],
  userId?: string
): Promise<NextResponse<StartScraperResponse>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }

  // Update job to running
  await supabase
    .from('scraper_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', job.id);

  try {
    // Call the Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/${job.actor_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge Function error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Format results based on scraper type
    let documentContent: string;
    let resultCount: number;

    if (job.scraper_type === 'news_bing') {
      documentContent = formatBingNewsResults(result, input);
      resultCount = Array.isArray(result.articles) ? result.articles.length : 0;
    } else {
      documentContent = JSON.stringify(result, null, 2);
      resultCount = 1;
    }

    const effectiveTargetName = targetName || (input.queries as string[])?.[0] || 'Custom Scraper';
    const documentName = generateDocumentName(job.scraper_type, effectiveTargetName);
    const documentTags = providedTags?.length
      ? providedTags
      : generateAutoTags(job.scraper_type, effectiveTargetName);
    const documentBrief = await generateDocumentBrief(documentContent, job.scraper_type, effectiveTargetName);

    // Extract custom metadata from job (e.g., campaign_id, source_type for playbooks)
    const customJobProviderMeta = job.provider_metadata as Record<string, unknown> | undefined;
    const customJobCustomMeta = customJobProviderMeta?.custom_metadata as Record<string, unknown> | undefined;

    // Save document
    const adminClient = createAdminClient();
    const { data: doc, error: docError } = await adminClient
      .from('knowledge_base_docs')
      .insert({
        project_id: job.project_id,
        filename: documentName,
        extracted_content: documentContent,
        description: documentBrief,
        category: targetCategory || job.target_category || 'research',
        tags: documentTags,
        source_type: 'scraper',
        source_job_id: job.id,
        source_metadata: {
          scraper_type: job.scraper_type,
          scraped_at: new Date().toISOString(),
          target_name: effectiveTargetName,
          provider: 'custom',
          edge_function: job.actor_id,
          // Include custom metadata for playbook document matching
          ...(customJobCustomMeta || {}),
        },
      })
      .select()
      .single();

    if (docError) {
      throw new Error(`Failed to save document: ${docError.message}`);
    }

    // Trigger embedding generation
    if (doc?.id) {
      triggerEmbeddingGeneration(doc.id).catch(err => {
        console.error('[scraper/start] Embedding generation failed:', err);
      });
    }

    // Update job as completed
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'completed',
        result_count: resultCount,
        completed_at: new Date().toISOString(),
        provider_metadata: {
          ...((job.provider_metadata as Record<string, unknown>) || {}),
          document_id: doc?.id,
          edge_function: job.actor_id,
        },
      })
      .eq('id', job.id);

    return NextResponse.json({
      success: true,
      job_id: job.id,
      completed: true,
    });

  } catch (error) {
    // Update job as failed
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    throw error;
  }
}

// Format Bing News results as markdown document
function formatBingNewsResults(result: Record<string, unknown>, input: Record<string, unknown>): string {
  const articles = (result.articles || []) as Array<{
    title?: string;
    url?: string;
    source?: string;
    snippet?: string;
    publishedAt?: string;
    content?: string;
    imageUrl?: string;
    query?: string;
  }>;

  const queries = (input.queries as string[]) || [];
  const country = (input.country as string) || 'unknown';
  const today = new Date().toLocaleDateString('es-ES');

  let markdown = `# Noticias de Bing News\n\n`;
  markdown += `**Búsquedas:** ${queries.join(', ')}\n`;
  markdown += `**País/Idioma:** ${country}\n`;
  markdown += `**Fecha de extracción:** ${today}\n`;
  markdown += `**Total de artículos:** ${articles.length}\n\n`;
  markdown += `---\n\n`;

  for (const article of articles) {
    markdown += `## ${article.title || 'Sin título'}\n\n`;
    markdown += `**Fuente:** ${article.source || 'Desconocida'}\n`;
    markdown += `**Fecha:** ${article.publishedAt || 'N/A'}\n`;
    markdown += `**URL:** ${article.url || 'N/A'}\n`;
    if (article.query) {
      markdown += `**Búsqueda:** ${article.query}\n`;
    }
    markdown += `\n`;

    if (article.snippet) {
      markdown += `> ${article.snippet}\n\n`;
    }

    if (article.content) {
      markdown += `${article.content}\n\n`;
    }

    markdown += `---\n\n`;
  }

  return markdown;
}

// ============================================
// MANGOOLS SCRAPER EXECUTOR (Routes to specific APIs)
// ============================================

// Type interfaces for Mangools API responses
interface SerpCheckerResult {
  serp?: Array<{
    position?: number;
    url?: string;
    title?: string;
    da?: number;
    pa?: number;
    cf?: number;
    tf?: number;
    links?: number;
    ctr?: number;
  }>;
}

interface SiteProfilerResult {
  overview?: {
    da?: number;
    pa?: number;
    cf?: number;
    tf?: number;
    backlinks?: number;
    ref_domains?: number;
    organic_traffic?: number;
    organic_keywords?: number;
    domain?: string;
  };
}

interface LinkMinerResult {
  links?: Array<{
    source_url?: string;
    anchor?: string;
    cf?: number;
    tf?: number;
    dofollow?: boolean;
    target_url?: string;
  }>;
  total?: number;
}

interface CompetitorKeywordsResult {
  keywords?: Array<{
    kw?: string;
    position?: number;
    sv?: number;
    cpc?: number;
    url?: string;
  }>;
  total?: number;
}

async function executeMangools(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  input: Record<string, unknown>,
  targetName?: string,
  targetCategory?: string,
  providedTags?: string[],
  userId?: string
): Promise<NextResponse<StartScraperResponse>> {
  const mangoolsApiKey = process.env.MANGOOLS_API_KEY;

  if (!mangoolsApiKey) {
    throw new Error('Mangools API key not configured. Please add MANGOOLS_API_KEY to environment variables.');
  }

  // Update job to running
  await supabase
    .from('scraper_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', job.id);

  try {
    // Route to the correct API based on scraper_type
    switch (job.scraper_type) {
      case 'seo_keywords':
        return await executeMangoolsKWFinder(supabase, job, input, mangoolsApiKey, targetName, targetCategory, providedTags);
      case 'seo_serp_checker':
        return await executeMangoolsSerpChecker(supabase, job, input, mangoolsApiKey, targetName, targetCategory, providedTags);
      case 'seo_site_profiler':
        return await executeMangoolsSiteProfiler(supabase, job, input, mangoolsApiKey, targetName, targetCategory, providedTags);
      case 'seo_link_miner':
        return await executeMangoolsLinkMiner(supabase, job, input, mangoolsApiKey, targetName, targetCategory, providedTags);
      case 'seo_competitor_keywords':
        return await executeMangoolsCompetitorKeywords(supabase, job, input, mangoolsApiKey, targetName, targetCategory, providedTags);
      default:
        throw new Error(`Unknown Mangools scraper type: ${job.scraper_type}`);
    }
  } catch (error) {
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    throw error;
  }
}

// ============================================
// MANGOOLS KWFINDER (Keyword Research)
// ============================================

async function executeMangoolsKWFinder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  input: Record<string, unknown>,
  apiKey: string,
  targetName?: string,
  targetCategory?: string,
  providedTags?: string[]
): Promise<NextResponse<StartScraperResponse>> {
  const keyword = input.keyword as string;
  const location = (input.location as string) || 'Spain';
  const language = (input.language as string) || 'es';
  const includeSerpOverview = input.includeSerpOverview as boolean || false;

  // KWFinder API endpoint
  const apiUrl = new URL('https://api.mangools.com/v4/kwfinder/search');
  apiUrl.searchParams.set('kw', keyword);
  apiUrl.searchParams.set('location_id', getLocationId(location));
  apiUrl.searchParams.set('language_id', getLanguageId(language));

  const response = await fetch(apiUrl.toString(), {
    method: 'GET',
    headers: {
      'X-Access-Token': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mangools KWFinder API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  // If includeSerpOverview is true, also fetch SERP data
  let serpData: SerpCheckerResult | null = null;
  if (includeSerpOverview) {
    const serpUrl = new URL('https://api.mangools.com/v4/serpchecker/serp');
    serpUrl.searchParams.set('kw', keyword);
    serpUrl.searchParams.set('location_id', getLocationId(location));
    serpUrl.searchParams.set('language_id', getLanguageId(language));

    const serpResponse = await fetch(serpUrl.toString(), {
      method: 'GET',
      headers: { 'X-Access-Token': apiKey, 'Content-Type': 'application/json' },
    });

    if (serpResponse.ok) {
      serpData = await serpResponse.json();
    }
  }

  const documentContent = formatKWFinderResults(result, keyword, location, language, serpData);
  const resultCount = result.keywords?.length || 1;

  return await saveMangoolsDocument(supabase, job, documentContent, resultCount, targetName || keyword, targetCategory, providedTags, {
    keyword, location, language, includeSerpOverview,
  });
}

// ============================================
// MANGOOLS SERP CHECKER
// ============================================

async function executeMangoolsSerpChecker(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  input: Record<string, unknown>,
  apiKey: string,
  targetName?: string,
  targetCategory?: string,
  providedTags?: string[]
): Promise<NextResponse<StartScraperResponse>> {
  const keyword = input.keyword as string;
  const location = (input.location as string) || 'Spain';
  const language = (input.language as string) || 'es';

  const apiUrl = new URL('https://api.mangools.com/v4/serpchecker/serp');
  apiUrl.searchParams.set('kw', keyword);
  apiUrl.searchParams.set('location_id', getLocationId(location));
  apiUrl.searchParams.set('language_id', getLanguageId(language));

  const response = await fetch(apiUrl.toString(), {
    method: 'GET',
    headers: { 'X-Access-Token': apiKey, 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mangools SERPChecker API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as SerpCheckerResult;
  const documentContent = formatSerpCheckerResults(result, keyword, location, language);
  const resultCount = result.serp?.length || 0;

  return await saveMangoolsDocument(supabase, job, documentContent, resultCount, targetName || keyword, targetCategory, providedTags, {
    keyword, location, language,
  });
}

// ============================================
// MANGOOLS SITE PROFILER
// ============================================

async function executeMangoolsSiteProfiler(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  input: Record<string, unknown>,
  apiKey: string,
  targetName?: string,
  targetCategory?: string,
  providedTags?: string[]
): Promise<NextResponse<StartScraperResponse>> {
  const url = input.url as string;
  const domain = new URL(url).hostname.replace(/^www\./, '');

  const apiUrl = new URL('https://api.mangools.com/v3/siteprofiler/overview');
  apiUrl.searchParams.set('domain', domain);

  const response = await fetch(apiUrl.toString(), {
    method: 'GET',
    headers: { 'X-Access-Token': apiKey, 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mangools SiteProfiler API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as SiteProfilerResult;
  const documentContent = formatSiteProfilerResults(result, domain);

  return await saveMangoolsDocument(supabase, job, documentContent, 1, targetName || domain, targetCategory, providedTags, {
    url, domain,
  });
}

// ============================================
// MANGOOLS LINK MINER
// ============================================

async function executeMangoolsLinkMiner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  input: Record<string, unknown>,
  apiKey: string,
  targetName?: string,
  targetCategory?: string,
  providedTags?: string[]
): Promise<NextResponse<StartScraperResponse>> {
  const url = input.url as string;
  const linksPerDomain = (input.linksPerDomain as number) || 5;
  const domain = new URL(url).hostname.replace(/^www\./, '');

  const apiUrl = new URL('https://api.mangools.com/v3/linkminer/links');
  apiUrl.searchParams.set('target', domain);
  apiUrl.searchParams.set('links_per_domain', String(linksPerDomain));

  const response = await fetch(apiUrl.toString(), {
    method: 'GET',
    headers: { 'X-Access-Token': apiKey, 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mangools LinkMiner API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as LinkMinerResult;
  const documentContent = formatLinkMinerResults(result, domain);
  const resultCount = result.links?.length || 0;

  return await saveMangoolsDocument(supabase, job, documentContent, resultCount, targetName || domain, targetCategory, providedTags, {
    url, domain, linksPerDomain,
  });
}

// ============================================
// MANGOOLS COMPETITOR KEYWORDS
// ============================================

async function executeMangoolsCompetitorKeywords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  input: Record<string, unknown>,
  apiKey: string,
  targetName?: string,
  targetCategory?: string,
  providedTags?: string[]
): Promise<NextResponse<StartScraperResponse>> {
  const url = input.url as string;
  const location = (input.location as string) || 'Spain';
  const language = (input.language as string) || 'es';
  const domain = new URL(url).hostname.replace(/^www\./, '');

  const apiUrl = new URL('https://api.mangools.com/v4/kwfinder/competitor-keywords');
  apiUrl.searchParams.set('url', domain);
  apiUrl.searchParams.set('location_id', getLocationId(location));
  apiUrl.searchParams.set('language_id', getLanguageId(language));

  const response = await fetch(apiUrl.toString(), {
    method: 'GET',
    headers: { 'X-Access-Token': apiKey, 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mangools Competitor Keywords API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as CompetitorKeywordsResult;
  const documentContent = formatCompetitorKeywordsResults(result, domain, location, language);
  const resultCount = result.keywords?.length || 0;

  return await saveMangoolsDocument(supabase, job, documentContent, resultCount, targetName || domain, targetCategory, providedTags, {
    url, domain, location, language,
  });
}

// ============================================
// MANGOOLS DOCUMENT SAVER (Common for all APIs)
// ============================================

async function saveMangoolsDocument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  documentContent: string,
  resultCount: number,
  effectiveTargetName: string,
  targetCategory?: string,
  providedTags?: string[],
  metadata?: Record<string, unknown>
): Promise<NextResponse<StartScraperResponse>> {
  const documentName = generateDocumentName(job.scraper_type, effectiveTargetName);
  const documentTags = providedTags?.length
    ? providedTags
    : generateAutoTags(job.scraper_type, effectiveTargetName);
  const documentBrief = await generateDocumentBrief(documentContent, job.scraper_type, effectiveTargetName);

  // Extract custom metadata from job (e.g., campaign_id, source_type for playbooks)
  const mangoolsJobProviderMeta = job.provider_metadata as Record<string, unknown> | undefined;
  const mangoolsCustomMeta = mangoolsJobProviderMeta?.custom_metadata as Record<string, unknown> | undefined;

  const adminClient = createAdminClient();
  const { data: doc, error: docError } = await adminClient
    .from('knowledge_base_docs')
    .insert({
      project_id: job.project_id,
      filename: documentName,
      extracted_content: documentContent,
      description: documentBrief,
      category: targetCategory || job.target_category || 'research',
      tags: documentTags,
      source_type: 'scraper',
      source_job_id: job.id,
      source_metadata: {
        scraper_type: job.scraper_type,
        scraped_at: new Date().toISOString(),
        target_name: effectiveTargetName,
        provider: 'mangools',
        ...metadata,
        // Include custom metadata for playbook document matching
        ...(mangoolsCustomMeta || {}),
      },
    })
    .select()
    .single();

  if (docError) {
    throw new Error(`Failed to save document: ${docError.message}`);
  }

  // Trigger embedding generation
  if (doc?.id) {
    triggerEmbeddingGeneration(doc.id).catch(err => {
      console.error('[scraper/start] Embedding generation failed:', err);
    });
  }

  await supabase
    .from('scraper_jobs')
    .update({
      status: 'completed',
      result_count: resultCount,
      completed_at: new Date().toISOString(),
      provider_metadata: {
        ...((job.provider_metadata as Record<string, unknown>) || {}),
        document_id: doc?.id,
        ...metadata,
      },
    })
    .eq('id', job.id);

  return NextResponse.json({
    success: true,
    job_id: job.id,
    completed: true,
  });
}

// ============================================
// MANGOOLS FORMATTERS
// ============================================

// Format KWFinder results as markdown
function formatKWFinderResults(
  result: Record<string, unknown>,
  keyword: string,
  location: string,
  language: string,
  serpData: SerpCheckerResult | null
): string {
  const keywords = (result.keywords || []) as Array<{
    kw?: string;
    sv?: number;
    cpc?: number;
    ppc?: number;
    kd?: number;
    m?: number[];
  }>;

  const mainKeyword = result.mainKeyword as {
    kw?: string;
    sv?: number;
    cpc?: number;
    ppc?: number;
    kd?: number;
    m?: number[];
  } | undefined;

  const today = new Date().toLocaleDateString('es-ES');

  let markdown = `# An\u00e1lisis SEO: ${keyword}\n\n`;
  markdown += `**Ubicaci\u00f3n:** ${location}\n`;
  markdown += `**Idioma:** ${language}\n`;
  markdown += `**Fecha de an\u00e1lisis:** ${today}\n\n`;

  // Main keyword stats
  if (mainKeyword) {
    markdown += `## Keyword Principal\n\n`;
    markdown += `| M\u00e9trica | Valor |\n`;
    markdown += `|---------|-------|\n`;
    markdown += `| Volumen de b\u00fasqueda | ${mainKeyword.sv?.toLocaleString() || 'N/A'} /mes |\n`;
    markdown += `| Dificultad (KD) | ${mainKeyword.kd || 'N/A'} |\n`;
    markdown += `| CPC | $${mainKeyword.cpc?.toFixed(2) || 'N/A'} |\n`;
    markdown += `| Competencia PPC | ${mainKeyword.ppc || 'N/A'} |\n\n`;

    if (mainKeyword.m && mainKeyword.m.length > 0) {
      markdown += `**Tendencia mensual:** ${mainKeyword.m.join(' \u2192 ')}\n\n`;
    }
  }

  // SERP Overview if available
  if (serpData?.serp && serpData.serp.length > 0) {
    markdown += `## SERP Overview (Top 10)\n\n`;
    markdown += `| Pos | URL | DA | PA | CF | TF |\n`;
    markdown += `|-----|-----|----|----|----|----|n`;

    for (const item of serpData.serp.slice(0, 10)) {
      const shortUrl = item.url ? new URL(item.url).hostname : '-';
      markdown += `| ${item.position || '-'} | ${shortUrl} | ${item.da || '-'} | ${item.pa || '-'} | ${item.cf || '-'} | ${item.tf || '-'} |\n`;
    }
    markdown += `\n`;
  }

  // Related keywords table
  if (keywords.length > 0) {
    markdown += `## Keywords Relacionadas (${keywords.length})\n\n`;
    markdown += `| Keyword | Volumen | KD | CPC |\n`;
    markdown += `|---------|---------|-------|-----|\n`;

    for (const kw of keywords.slice(0, 50)) {
      markdown += `| ${kw.kw || '-'} | ${kw.sv?.toLocaleString() || '-'} | ${kw.kd || '-'} | $${kw.cpc?.toFixed(2) || '-'} |\n`;
    }

    if (keywords.length > 50) {
      markdown += `\n*... y ${keywords.length - 50} keywords m\u00e1s*\n`;
    }
  }

  markdown += `\n---\n\n*Datos obtenidos de Mangools KWFinder*\n`;

  return markdown;
}

// Format SERP Checker results as markdown
function formatSerpCheckerResults(
  result: SerpCheckerResult,
  keyword: string,
  location: string,
  language: string
): string {
  const serp = result.serp || [];
  const today = new Date().toLocaleDateString('es-ES');

  let markdown = `# An\u00e1lisis SERP: ${keyword}\n\n`;
  markdown += `**Ubicaci\u00f3n:** ${location}\n`;
  markdown += `**Idioma:** ${language}\n`;
  markdown += `**Fecha de an\u00e1lisis:** ${today}\n`;
  markdown += `**Resultados analizados:** ${serp.length}\n\n`;

  if (serp.length > 0) {
    markdown += `## Resultados del SERP\n\n`;
    markdown += `| Pos | Dominio | DA | PA | CF | TF | Links | CTR |\n`;
    markdown += `|-----|---------|----|----|----|----|-------|-----|\n`;

    for (const item of serp) {
      const domain = item.url ? new URL(item.url).hostname : '-';
      markdown += `| ${item.position || '-'} | ${domain} | ${item.da || '-'} | ${item.pa || '-'} | ${item.cf || '-'} | ${item.tf || '-'} | ${item.links || '-'} | ${item.ctr ? (item.ctr * 100).toFixed(1) + '%' : '-'} |\n`;
    }

    markdown += `\n### URLs Completas\n\n`;
    for (const item of serp) {
      markdown += `${item.position}. [${item.title || 'Sin t\u00edtulo'}](${item.url})\n`;
    }
  }

  markdown += `\n---\n\n*Datos obtenidos de Mangools SERPChecker*\n`;

  return markdown;
}

// Format Site Profiler results as markdown
function formatSiteProfilerResults(
  result: SiteProfilerResult,
  domain: string
): string {
  const overview = result.overview || {};
  const today = new Date().toLocaleDateString('es-ES');

  let markdown = `# Perfil del Sitio: ${domain}\n\n`;
  markdown += `**Fecha de an\u00e1lisis:** ${today}\n\n`;

  markdown += `## M\u00e9tricas de Autoridad\n\n`;
  markdown += `| M\u00e9trica | Valor |\n`;
  markdown += `|---------|-------|\n`;
  markdown += `| Domain Authority (DA) | ${overview.da || 'N/A'} |\n`;
  markdown += `| Page Authority (PA) | ${overview.pa || 'N/A'} |\n`;
  markdown += `| Citation Flow (CF) | ${overview.cf || 'N/A'} |\n`;
  markdown += `| Trust Flow (TF) | ${overview.tf || 'N/A'} |\n\n`;

  markdown += `## Perfil de Backlinks\n\n`;
  markdown += `| M\u00e9trica | Valor |\n`;
  markdown += `|---------|-------|\n`;
  markdown += `| Total Backlinks | ${overview.backlinks?.toLocaleString() || 'N/A'} |\n`;
  markdown += `| Dominios Referentes | ${overview.ref_domains?.toLocaleString() || 'N/A'} |\n\n`;

  markdown += `## Tr\u00e1fico Org\u00e1nico\n\n`;
  markdown += `| M\u00e9trica | Valor |\n`;
  markdown += `|---------|-------|\n`;
  markdown += `| Tr\u00e1fico Org\u00e1nico Est. | ${overview.organic_traffic?.toLocaleString() || 'N/A'} /mes |\n`;
  markdown += `| Keywords Org\u00e1nicas | ${overview.organic_keywords?.toLocaleString() || 'N/A'} |\n`;

  markdown += `\n---\n\n*Datos obtenidos de Mangools SiteProfiler*\n`;

  return markdown;
}

// Format Link Miner results as markdown
function formatLinkMinerResults(
  result: LinkMinerResult,
  domain: string
): string {
  const links = result.links || [];
  const today = new Date().toLocaleDateString('es-ES');

  let markdown = `# An\u00e1lisis de Backlinks: ${domain}\n\n`;
  markdown += `**Fecha de an\u00e1lisis:** ${today}\n`;
  markdown += `**Total de backlinks encontrados:** ${result.total || links.length}\n`;
  markdown += `**Backlinks mostrados:** ${links.length}\n\n`;

  if (links.length > 0) {
    markdown += `## Backlinks\n\n`;
    markdown += `| Fuente | Anchor | CF | TF | DoFollow |\n`;
    markdown += `|--------|--------|----|----|----------|\n`;

    for (const link of links.slice(0, 100)) {
      const sourceDomain = link.source_url ? new URL(link.source_url).hostname : '-';
      const anchor = (link.anchor || '(sin anchor)').slice(0, 40);
      const dofollow = link.dofollow ? '\u2705' : '\u274c';
      markdown += `| ${sourceDomain} | ${anchor} | ${link.cf || '-'} | ${link.tf || '-'} | ${dofollow} |\n`;
    }

    if (links.length > 100) {
      markdown += `\n*... y ${links.length - 100} backlinks m\u00e1s*\n`;
    }

    // Group by dofollow
    const dofollow = links.filter(l => l.dofollow).length;
    const nofollow = links.length - dofollow;
    markdown += `\n### Resumen\n`;
    markdown += `- **DoFollow:** ${dofollow} (${((dofollow / links.length) * 100).toFixed(1)}%)\n`;
    markdown += `- **NoFollow:** ${nofollow} (${((nofollow / links.length) * 100).toFixed(1)}%)\n`;
  }

  markdown += `\n---\n\n*Datos obtenidos de Mangools LinkMiner*\n`;

  return markdown;
}

// Format Competitor Keywords results as markdown
function formatCompetitorKeywordsResults(
  result: CompetitorKeywordsResult,
  domain: string,
  location: string,
  language: string
): string {
  const keywords = result.keywords || [];
  const today = new Date().toLocaleDateString('es-ES');

  let markdown = `# Keywords del Competidor: ${domain}\n\n`;
  markdown += `**Ubicaci\u00f3n:** ${location}\n`;
  markdown += `**Idioma:** ${language}\n`;
  markdown += `**Fecha de an\u00e1lisis:** ${today}\n`;
  markdown += `**Total de keywords:** ${result.total || keywords.length}\n\n`;

  if (keywords.length > 0) {
    markdown += `## Keywords Posicionadas\n\n`;
    markdown += `| Keyword | Pos | Volumen | CPC | URL |\n`;
    markdown += `|---------|-----|---------|-----|-----|\n`;

    for (const kw of keywords.slice(0, 100)) {
      const shortUrl = kw.url ? new URL(kw.url).pathname.slice(0, 30) : '-';
      markdown += `| ${kw.kw || '-'} | ${kw.position || '-'} | ${kw.sv?.toLocaleString() || '-'} | $${kw.cpc?.toFixed(2) || '-'} | ${shortUrl} |\n`;
    }

    if (keywords.length > 100) {
      markdown += `\n*... y ${keywords.length - 100} keywords m\u00e1s*\n`;
    }

    // Summary stats
    const top3 = keywords.filter(k => k.position && k.position <= 3).length;
    const top10 = keywords.filter(k => k.position && k.position <= 10).length;
    const top20 = keywords.filter(k => k.position && k.position <= 20).length;

    markdown += `\n### Distribuci\u00f3n de Posiciones\n`;
    markdown += `- **Top 3:** ${top3} keywords\n`;
    markdown += `- **Top 10:** ${top10} keywords\n`;
    markdown += `- **Top 20:** ${top20} keywords\n`;
  }

  markdown += `\n---\n\n*Datos obtenidos de Mangools KWFinder (Competitor Keywords)*\n`;

  return markdown;
}

// Mangools location IDs (most common)
function getLocationId(location: string): string {
  const locations: Record<string, string> = {
    'Spain': '2724',
    'United States': '2840',
    'United Kingdom': '2826',
    'Mexico': '2484',
    'Argentina': '2032',
    'Colombia': '2170',
    'Chile': '2152',
    'Peru': '2604',
    'Germany': '2276',
    'France': '2250',
    'Brazil': '2076',
  };
  return locations[location] || '2724'; // Default to Spain
}

// Mangools language IDs
function getLanguageId(language: string): string {
  const languages: Record<string, string> = {
    'es': '1003',
    'en': '1000',
    'pt': '1015',
    'fr': '1002',
    'de': '1001',
    'it': '1004',
  };
  return languages[language] || '1003'; // Default to Spanish
}

// ============================================
// PHANTOMBUSTER EXECUTOR
// ============================================

interface PhantombusterLaunchResponse {
  status: string;
  containerId?: string;
  message?: string;
}

interface PhantombusterOutputResponse {
  status: string;
  containerStatus?: string;
  output?: string;
  resultObject?: string;
  exitCode?: number;
}

interface PhantombusterEngager {
  profileUrl?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  location?: string;
  connectionDegree?: string;
  interactionType?: string;
  postUrl?: string;
  imgUrl?: string;
  timestamp?: string;
  error?: string;
  [key: string]: unknown;
}

async function executePhantombuster(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  input: Record<string, unknown>,
  targetName?: string,
  targetCategory?: string,
  providedTags?: string[],
  userId?: string
): Promise<NextResponse<StartScraperResponse>> {
  // Get Phantombuster API key
  const phantombusterApiKey = userId
    ? await getUserApiKey({ userId, serviceName: 'phantombuster', supabase })
    : process.env.PHANTOMBUSTER_API_KEY;

  if (!phantombusterApiKey) {
    throw new Error('Phantombuster API key not configured. Please add your API key in Settings > API Keys.');
  }

  // Get LinkedIn session cookie (required for LinkedIn scrapers)
  let sessionCookie = input.sessionCookie as string | undefined;
  if (!sessionCookie && userId) {
    sessionCookie = await getUserApiKey({ userId, serviceName: 'linkedin_cookie', supabase }) || undefined;
  }
  if (!sessionCookie) {
    sessionCookie = process.env.PHANTOMBUSTER_LINKEDIN_COOKIE || undefined;
  }

  if (!sessionCookie) {
    throw new Error('LinkedIn session cookie not configured. Please add your li_at cookie in Settings > API Keys as "linkedin_cookie".');
  }

  // Update job to running
  await supabase
    .from('scraper_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', job.id);

  try {
    // Build agent argument based on scraper type
    const agentArgument = buildPhantombusterArgument(job.scraper_type, input, sessionCookie);

    // Launch the agent
    const launchResponse = await fetch('https://api.phantombuster.com/api/v2/agents/launch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Phantombuster-Key': phantombusterApiKey,
      },
      body: JSON.stringify({
        id: job.actor_id,
        argument: agentArgument,
      }),
    });

    if (!launchResponse.ok) {
      const errorText = await launchResponse.text();
      throw new Error(`Phantombuster launch error: ${launchResponse.status} - ${errorText}`);
    }

    const launchResult = await launchResponse.json() as PhantombusterLaunchResponse;

    if (launchResult.status !== 'success') {
      throw new Error(`Phantombuster launch failed: ${launchResult.message || 'Unknown error'}`);
    }

    const containerId = launchResult.containerId;
    console.log('[scraper/start] Phantombuster agent launched, containerId:', containerId);

    // Poll for completion (max 5 minutes)
    const maxWaitTime = 300000; // 5 minutes
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();

    let outputResult: PhantombusterOutputResponse | null = null;

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const outputResponse = await fetch(`https://api.phantombuster.com/api/v2/agents/fetch-output?id=${job.actor_id}`, {
        headers: {
          'X-Phantombuster-Key': phantombusterApiKey,
        },
      });

      if (!outputResponse.ok) {
        continue; // Retry on error
      }

      const outputData = await outputResponse.json() as PhantombusterOutputResponse;

      console.log('[scraper/start] Phantombuster status:', outputData.containerStatus);

      // Update job progress (merge with existing metadata to preserve custom_metadata)
      await supabase
        .from('scraper_jobs')
        .update({
          provider_metadata: {
            ...((job.provider_metadata as Record<string, unknown>) || {}),
            containerId,
            status: outputData.containerStatus,
          },
        })
        .eq('id', job.id);

      if (outputData.containerStatus === 'finished') {
        outputResult = outputData;
        break;
      } else if (outputData.containerStatus === 'error' || outputData.exitCode !== undefined && outputData.exitCode !== 0) {
        throw new Error(`Phantombuster agent failed: ${outputData.output || 'Unknown error'}`);
      }
    }

    if (!outputResult) {
      throw new Error('Phantombuster agent timed out');
    }

    // Parse results
    let results: PhantombusterEngager[] = [];
    if (outputResult.resultObject) {
      try {
        results = JSON.parse(outputResult.resultObject);
        if (!Array.isArray(results)) {
          results = [results];
        }
      } catch {
        console.error('[scraper/start] Failed to parse Phantombuster results');
      }
    }

    // Filter out error entries
    results = results.filter(r => !r.error && r.profileUrl);

    const effectiveTargetName = targetName || `LinkedIn Engagers (${results.length})`;
    const documentName = generateDocumentName(job.scraper_type, effectiveTargetName);
    const documentTags = providedTags?.length
      ? providedTags
      : generateAutoTags(job.scraper_type, effectiveTargetName);

    // Format results as markdown
    const documentContent = formatPhantombusterResults(results, job.scraper_type, input);
    const documentBrief = await generateDocumentBrief(documentContent, job.scraper_type, effectiveTargetName);

    // Extract custom metadata from job (e.g., campaign_id, source_type for playbooks)
    const phantomJobProviderMeta = job.provider_metadata as Record<string, unknown> | undefined;
    const phantomCustomMeta = phantomJobProviderMeta?.custom_metadata as Record<string, unknown> | undefined;

    // Save to knowledge_base_docs
    const adminClient = createAdminClient();
    const { data: doc, error: docError } = await adminClient
      .from('knowledge_base_docs')
      .insert({
        project_id: job.project_id,
        filename: documentName,
        extracted_content: documentContent,
        description: documentBrief,
        category: targetCategory || job.target_category || 'research',
        tags: documentTags,
        source_type: 'scraper',
        source_job_id: job.id,
        source_metadata: {
          scraper_type: job.scraper_type,
          scraped_at: new Date().toISOString(),
          target_name: effectiveTargetName,
          provider: 'phantombuster',
          containerId,
          profiles_count: results.length,
          raw_data: results, // Store raw data for later use
          // Include custom metadata for playbook document matching
          ...(phantomCustomMeta || {}),
        },
      })
      .select()
      .single();

    if (docError) {
      throw new Error(`Failed to save document: ${docError.message}`);
    }

    // Trigger embedding generation
    if (doc?.id) {
      triggerEmbeddingGeneration(doc.id).catch(err => {
        console.error('[scraper/start] Embedding generation failed:', err);
      });
    }

    // Update job as completed
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'completed',
        result_count: results.length,
        result_preview: results.slice(0, 5).map(r => ({
          name: r.fullName,
          headline: r.headline,
          url: r.profileUrl,
        })),
        completed_at: new Date().toISOString(),
        provider_metadata: {
          ...((job.provider_metadata as Record<string, unknown>) || {}),
          containerId,
          document_id: doc?.id,
          profiles_count: results.length,
        },
      })
      .eq('id', job.id);

    return NextResponse.json({
      success: true,
      job_id: job.id,
      completed: true,
    });

  } catch (error) {
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    throw error;
  }
}

function buildPhantombusterArgument(
  scraperType: string,
  input: Record<string, unknown>,
  sessionCookie: string
): Record<string, unknown> {
  switch (scraperType) {
    case 'linkedin_post_engagers':
      return {
        sessionCookie,
        spreadsheetUrl: '', // We pass URLs directly
        postUrls: input.postUrls,
        numberOfLikersPerPost: input.numberOfLikersPerPost || 100,
        numberOfCommentersPerPost: input.numberOfCommentersPerPost || 100,
      };

    case 'linkedin_profile_scraper':
      return {
        sessionCookie,
        spreadsheetUrl: '', // We pass URLs directly
        profileUrls: input.profileUrls,
      };

    default:
      return {
        sessionCookie,
        ...input,
      };
  }
}

function formatPhantombusterResults(
  results: PhantombusterEngager[],
  scraperType: string,
  input: Record<string, unknown>
): string {
  const today = new Date().toLocaleDateString('es-ES');

  let markdown = `# LinkedIn Engagers\n\n`;
  markdown += `**Tipo de scraper:** ${scraperType}\n`;
  markdown += `**Fecha de extracción:** ${today}\n`;
  markdown += `**Total de perfiles:** ${results.length}\n`;

  if (input.postUrls) {
    const postUrls = Array.isArray(input.postUrls) ? input.postUrls : [input.postUrls];
    markdown += `**Posts analizados:** ${postUrls.length}\n`;
  }

  markdown += `\n---\n\n`;

  if (results.length > 0) {
    markdown += `## Perfiles Encontrados\n\n`;
    markdown += `| Nombre | Headline | Ubicación | Tipo | URL |\n`;
    markdown += `|--------|----------|-----------|------|-----|\n`;

    for (const profile of results) {
      const name = profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'N/A';
      const headline = (profile.headline || 'N/A').slice(0, 50);
      const location = profile.location || 'N/A';
      const interactionType = profile.interactionType || 'N/A';
      const url = profile.profileUrl || 'N/A';

      markdown += `| ${name} | ${headline} | ${location} | ${interactionType} | [Perfil](${url}) |\n`;
    }

    // Summary by interaction type
    const likers = results.filter(r => r.interactionType === 'liker').length;
    const commenters = results.filter(r => r.interactionType === 'commenter').length;

    if (likers > 0 || commenters > 0) {
      markdown += `\n### Resumen de Interacciones\n`;
      markdown += `- **Likes:** ${likers}\n`;
      markdown += `- **Comentarios:** ${commenters}\n`;
    }
  }

  markdown += `\n---\n\n*Datos obtenidos de Phantombuster*\n`;

  // Also include JSON data for programmatic use
  markdown += `\n\n## Datos JSON\n\n`;
  markdown += '```json\n';
  markdown += JSON.stringify(results, null, 2);
  markdown += '\n```\n';

  return markdown;
}
