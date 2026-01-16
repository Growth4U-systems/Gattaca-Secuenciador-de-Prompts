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
    const { project_id, scraper_type, input_config, batch, target_name, target_category, tags, output_config } = body;

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
        userId
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
  userId?: string
): Promise<NextResponse<StartScraperResponse>> {
  const template = getScraperTemplate(scraperType as Parameters<typeof getScraperTemplate>[0]);
  if (!template) {
    return NextResponse.json({ success: false, error: `Unknown scraper type: ${scraperType}` }, { status: 400 });
  }

  const webhookSecret = randomUUID();
  const finalInput = buildScraperInput(template.type, inputConfig);

  // Create job record with target info and output config
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
      provider_metadata: outputConfig ? { output_config: outputConfig } : undefined,
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
        // TODO: Implement Mangools
        return NextResponse.json({ success: false, error: 'Mangools not yet implemented' }, { status: 501 });
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
        case 'custom':
          await executeCustomScraper(
            supabase,
            job,
            job.input_config,
            job.target_name,
            job.target_category,
            undefined, // Tags will be auto-generated
            userId
          );
          break;
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
      },
    })
    .select()
    .single();

  if (docError) {
    console.error('[scraper/start] Failed to save document:', docError);
    throw new Error(`Failed to save document: ${docError.message}`);
  }

  await supabase
    .from('scraper_jobs')
    .update({
      status: 'completed',
      result_count: 1,
      result_preview: [{ title: documentName, url }],
      completed_at: new Date().toISOString(),
      provider_metadata: {
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

    // Update job progress
    await supabase
      .from('scraper_jobs')
      .update({
        provider_metadata: {
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
      },
    })
    .select()
    .single();

  if (docError) {
    console.error('[scraper/start] Failed to save crawl document:', docError);
    throw new Error(`Failed to save document: ${docError.message}`);
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

  await supabase
    .from('scraper_jobs')
    .update({
      status: 'completed',
      result_count: links.length,
      result_preview: links.slice(0, 10).map(link => ({ title: link, url: link })),
      completed_at: new Date().toISOString(),
      provider_metadata: {
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
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase configuration missing');
  }

  // Update job to running
  await supabase
    .from('scraper_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      target_name: targetName,
      target_category: targetCategory || 'research',
    })
    .eq('id', job.id);

  // Call the Edge Function
  const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/${job.actor_id}`;

  try {
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge Function error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Check if the Edge Function returned an error
    if (!result.success) {
      throw new Error(result.error || 'Edge Function execution failed');
    }

    // Process the results based on scraper type
    const articles = result.articles || [];
    const effectiveTargetName = targetName || (input.queries as string[])?.[0] || 'News';

    // Format content for document
    let documentContent: string;
    if (job.scraper_type === 'news_bing') {
      documentContent = formatBingNewsResults(articles, effectiveTargetName, input);
    } else {
      documentContent = JSON.stringify(result, null, 2);
    }

    // Generate document metadata
    const documentName = generateDocumentName(job.scraper_type, effectiveTargetName);
    const documentTags = providedTags?.length
      ? providedTags
      : generateAutoTags(job.scraper_type, effectiveTargetName);
    const documentBrief = await generateDocumentBrief(documentContent, job.scraper_type, effectiveTargetName);

    // Save document using admin client
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
          articles_count: articles.length,
          queries: input.queries,
          country: input.country,
          date_range: input.dateRange,
          errors: result.errors || [],
        },
      })
      .select()
      .single();

    if (docError) {
      console.error('[scraper/start] Failed to save custom scraper document:', docError);
      throw new Error(`Failed to save document: ${docError.message}`);
    }

    // Update job as completed
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'completed',
        result_count: articles.length,
        result_preview: articles.slice(0, 5).map((a: Record<string, unknown>) => ({
          title: a.title || 'Sin título',
          url: a.url,
          source: a.source,
        })),
        completed_at: new Date().toISOString(),
        provider_metadata: {
          document_id: doc?.id,
          articles_count: articles.length,
          errors_count: result.errors?.length || 0,
        },
      })
      .eq('id', job.id);

    return NextResponse.json({
      success: true,
      job_id: job.id,
      completed: true,
    });

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

// Format Bing News results for document storage
function formatBingNewsResults(
  articles: Array<{
    title: string;
    url: string;
    source: string;
    snippet: string;
    publishedAt: string | null;
    content: string | null;
    imageUrl: string | null;
    query: string;
    country: string;
  }>,
  targetName: string,
  input: Record<string, unknown>
): string {
  const header = `# Noticias: ${targetName}

**Fecha de extracción:** ${new Date().toLocaleString('es-ES')}
**Búsquedas:** ${(input.queries as string[])?.join(', ') || 'N/A'}
**País:** ${input.country || 'es-ES'}
**Rango de fechas:** ${input.dateRange || 'Sin filtro'}
**Total de artículos:** ${articles.length}

---

`;

  const articlesContent = articles.map((article, index) => {
    const parts = [
      `## ${index + 1}. ${article.title}`,
      '',
      `**Fuente:** ${article.source}`,
      `**URL:** ${article.url}`,
    ];

    if (article.publishedAt) {
      parts.push(`**Fecha de publicación:** ${new Date(article.publishedAt).toLocaleDateString('es-ES')}`);
    }

    if (article.snippet) {
      parts.push(`**Resumen:** ${article.snippet}`);
    }

    parts.push('');

    if (article.content) {
      parts.push('### Contenido completo');
      parts.push('');
      parts.push(article.content);
    } else {
      parts.push('*Contenido no extraído*');
    }

    parts.push('');
    parts.push('---');
    parts.push('');

    return parts.join('\n');
  }).join('\n');

  return header + articlesContent;
}
