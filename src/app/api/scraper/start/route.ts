import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
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
    const { project_id, scraper_type, input_config, batch, target_name, target_category, tags } = body;

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
  userId?: string
): Promise<NextResponse<StartScraperResponse>> {
  const template = getScraperTemplate(scraperType as Parameters<typeof getScraperTemplate>[0]);
  if (!template) {
    return NextResponse.json({ success: false, error: `Unknown scraper type: ${scraperType}` }, { status: 400 });
  }

  const webhookSecret = randomUUID();
  const finalInput = buildScraperInput(template.type, inputConfig);

  // Create job record with target info
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
        // TODO: Implement custom scrapers
        return NextResponse.json({ success: false, error: 'Custom scrapers not yet implemented' }, { status: 501 });
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
// FIRECRAWL EXECUTOR (Sync - returns immediately)
// ============================================

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

  // Call Firecrawl API
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

  // Generate document name, tags, and brief
  const effectiveTargetName = targetName || result.data.metadata?.title || new URL(url).hostname;
  const documentName = generateDocumentName(job.scraper_type, effectiveTargetName);
  const documentTags = providedTags?.length ? providedTags : generateAutoTags(job.scraper_type, effectiveTargetName);
  const documentContent = result.data.markdown || '';

  // Generate brief with LLM (async but we wait for it)
  const documentBrief = await generateDocumentBrief(documentContent, job.scraper_type, effectiveTargetName);

  // Save result to knowledge_base_docs with auto-generated name, tags, and brief
  const { data: doc, error: docError } = await supabase
    .from('knowledge_base_docs')
    .insert({
      project_id: job.project_id,
      name: documentName,
      content: documentContent,
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
      },
    })
    .select()
    .single();

  if (docError) {
    console.error('[scraper/start] Failed to save document:', docError);
  }

  // Update job as completed
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
      },
    })
    .eq('id', job.id);

  return NextResponse.json({
    success: true,
    job_id: job.id,
    completed: true, // Firecrawl is sync, so it completes immediately
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
  await supabase
    .from('scraper_jobs')
    .update({
      actor_run_id: result.data.id,
      provider_metadata: {
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
