import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server-admin';
import { ApifyWebhookPayload, ApifyDatasetItem, ScraperJob, ScraperOutputConfig } from '@/types/scraper.types';
import { getApiKeyForService } from '@/lib/getUserApiKey';
import { formatScraperOutput } from '@/lib/scraperOutputFormatter';
import { triggerEmbeddingGeneration } from '@/lib/embeddings';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes to process large datasets

// ============================================
// RETRY HELPER WITH EXPONENTIAL BACKOFF
// ============================================

/**
 * Retries an async function with exponential backoff
 * @param fn - The async function to retry
 * @param maxAttempts - Maximum number of attempts (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @returns Object with success status, result, error, and attempt count
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<{ success: boolean; result?: T; error?: Error; attempts: number }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { success: true, result, attempts: attempt };
    } catch (error) {
      lastError = error as Error;

      // Don't retry on validation errors or constraint violations
      const errorMessage = lastError.message?.toLowerCase() || '';
      if (
        errorMessage.includes('violates') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('required') ||
        errorMessage.includes('constraint')
      ) {
        console.error(`[webhook] Non-retryable error on attempt ${attempt}:`, errorMessage);
        return { success: false, error: lastError, attempts: attempt };
      }

      // If not the last attempt, wait before retrying
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // 1s, 2s, 4s, 8s, etc.
        console.log(`[webhook] Attempt ${attempt} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, error: lastError!, attempts: maxAttempts };
}

// ============================================
// MAIN HANDLER - WEBHOOK RECEIVER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('job_id');
    const secret = request.nextUrl.searchParams.get('secret');

    if (!jobId || !secret) {
      console.error('[webhook] Missing job_id or secret');
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Use admin client (webhook doesn't have user session)
    const supabase = createClient();

    // Verify job exists and secret matches
    const { data: job, error: jobError } = await supabase
      .from('scraper_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('[webhook] Job not found:', jobId);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.webhook_secret !== secret) {
      console.error('[webhook] Invalid secret for job:', jobId);
      return NextResponse.json({ error: 'Invalid secret' }, { status: 403 });
    }

    // Parse webhook payload
    const payload = (await request.json()) as ApifyWebhookPayload;
    console.log('[webhook] Received event:', payload.eventType, 'for job:', jobId);

    // Get the user_id from the project to fetch their API keys
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', job.project_id)
      .single();

    if (projectError || !project?.user_id) {
      console.error('[webhook] Could not get project owner:', projectError);
      return NextResponse.json({ error: 'Could not determine project owner' }, { status: 500 });
    }

    const userId = project.user_id;

    // Handle based on event type
    switch (payload.eventType) {
      case 'ACTOR.RUN.SUCCEEDED':
        await handleRunSucceeded(supabase, job as ScraperJob, payload, userId);
        break;

      case 'ACTOR.RUN.FAILED':
      case 'ACTOR.RUN.ABORTED':
        await handleRunFailed(supabase, job as ScraperJob, payload);
        break;

      default:
        console.log('[webhook] Unhandled event type:', payload.eventType);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[webhook] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// HANDLE SUCCESSFUL RUN
// ============================================

async function handleRunSucceeded(
  supabase: ReturnType<typeof createClient>,
  job: ScraperJob,
  payload: ApifyWebhookPayload,
  userId: string
): Promise<void> {
  // Update status to processing
  await supabase.from('scraper_jobs').update({ status: 'processing' }).eq('id', job.id);

  const datasetId = payload.resource.defaultDatasetId;

  if (!datasetId) {
    console.error('[webhook] No datasetId in payload');
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'failed',
        error_message: 'No dataset returned from Apify',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return;
  }

  // Fetch and save results
  await fetchAndSaveResults(supabase, job, datasetId, userId);
}

// ============================================
// HANDLE FAILED RUN
// ============================================

async function handleRunFailed(
  supabase: ReturnType<typeof createClient>,
  job: ScraperJob,
  payload: ApifyWebhookPayload
): Promise<void> {
  const errorMessage =
    payload.eventType === 'ACTOR.RUN.ABORTED' ? 'Run was aborted' : 'Run failed';

  await supabase
    .from('scraper_jobs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
      provider_metadata: {
        ...((job.provider_metadata as Record<string, unknown>) || {}),
        final_status: payload.resource.status,
      },
    })
    .eq('id', job.id);
}

// ============================================
// SOURCE NAMES FOR DOCUMENT NAMING
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

// ============================================
// FETCH AND SAVE RESULTS
// ============================================

async function fetchAndSaveResults(
  supabase: ReturnType<typeof createClient>,
  job: ScraperJob,
  datasetId: string,
  userId: string
): Promise<void> {
  // Get Apify token from user's settings or fallback to env
  const apifyToken = await getApiKeyForService('apify', userId, supabase);

  if (!apifyToken) {
    throw new Error('Apify API key not configured. Please add your API key in Settings > API Keys.');
  }

  // Fetch all items from dataset (paginated)
  let allItems: ApifyDatasetItem[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const response = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&limit=${limit}&offset=${offset}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch dataset: ${response.status}`);
    }

    const items = (await response.json()) as ApifyDatasetItem[];

    if (!items || items.length === 0) {
      break;
    }

    allItems = allItems.concat(items);
    offset += items.length;

    // Safety limit
    if (allItems.length >= 10000) {
      console.warn('[webhook] Reached 10000 items limit');
      break;
    }
  }

  console.log(`[webhook] Fetched ${allItems.length} items for job ${job.id}`);

  if (allItems.length === 0) {
    // No results, mark as completed
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'completed',
        result_count: 0,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return;
  }

  // ============================================
  // CREATE ONE CONSOLIDATED DOCUMENT
  // ============================================

  // Get output config from job metadata (default to JSON)
  const providerMeta = job.provider_metadata as Record<string, unknown> | null;
  console.log('[webhook] provider_metadata:', JSON.stringify(providerMeta, null, 2));

  const outputConfig: ScraperOutputConfig = (providerMeta?.output_config as ScraperOutputConfig) || {
    format: 'json',
  };
  console.log('[webhook] Using output format:', outputConfig.format);

  // Format content based on user selection
  const consolidatedContent = formatScraperOutput(allItems, outputConfig);
  console.log('[webhook] Content length:', consolidatedContent.length, 'first 200 chars:', consolidatedContent.substring(0, 200));

  // Get target name from job or generate from first item
  const targetName = job.target_name ||
    (allItems[0]?.author as string) ||
    (allItems[0]?.profileUrl as string)?.split('/').pop() ||
    'Unknown';

  // Generate document name: "Trustpilot Reviews - Revolut - 2026-02-13"
  const sourceName = SOURCE_NAMES[job.scraper_type] || job.scraper_type.replace(/_/g, ' ');
  const today = new Date().toISOString().split('T')[0];
  const documentName = `${sourceName} - ${targetName} - ${today}`;

  // Generate tags from job metadata or auto-generate
  const pendingTags = (providerMeta?.pending_tags as string[]) || [];
  const tags = pendingTags.length > 0 ? pendingTags : generateAutoTags(job.scraper_type, targetName);

  // Generate description/brief
  const description = `${allItems.length} ${sourceName.toLowerCase()} de ${targetName}, extraídos el ${new Date().toLocaleDateString('es-ES')}. Incluye información como ratings, fechas, y contenido textual.`;

  // Extract custom metadata from job (competitor, source_type, campaign_id)
  // This is critical for document matching in the KnowledgeBaseGenerator
  const customMeta = (providerMeta?.custom_metadata as Record<string, unknown>) || {};
  console.log('[webhook] custom_metadata from job:', JSON.stringify(customMeta, null, 2));

  // Validate required fields before insert
  console.log(`[webhook] Validating data for job ${job.id}...`);
  if (!job.project_id) {
    console.error('[webhook] ERROR: Missing project_id');
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'failed',
        error_message: 'Validation failed: Missing project_id',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return;
  }

  if (!consolidatedContent || consolidatedContent.trim().length === 0) {
    console.error('[webhook] ERROR: Empty extracted_content');
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'failed',
        error_message: 'Validation failed: No content extracted',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return;
  }

  // Insert ONE consolidated document with retry logic
  console.log(`[webhook] Starting document insert for job ${job.id}: "${documentName}" (${consolidatedContent.length} chars, ${allItems.length} items)`);

  const insertResult = await retryWithBackoff(async () => {
    const { data, error } = await supabase
      .from('knowledge_base_docs')
      .insert({
        project_id: job.project_id,
        filename: documentName,
        extracted_content: consolidatedContent,
        description: description,
        category: job.target_category || 'research',
        tags: tags,
        source_type: 'scraper',
        source_job_id: job.id,
        source_url: extractUrl(allItems[0]),
        source_metadata: {
          scraper_type: job.scraper_type,
          scraped_at: new Date().toISOString(),
          total_items: allItems.length,
          target_name: targetName,
          output_format: outputConfig.format,
          // Include custom metadata for document matching
          competitor: customMeta.competitor || null,
          source_type: customMeta.source_type || job.scraper_type,
          campaign_id: customMeta.campaign_id || null,
          raw_preview: allItems.slice(0, 10),
        },
      })
      .select('id')
      .single();

    if (error) {
      console.error(`[webhook] Insert error:`, error);
      throw error;
    }

    return data;
  }, 3, 1000);

  if (!insertResult.success) {
    console.error(`[webhook] FAILED to insert document after ${insertResult.attempts} attempts. Error:`, insertResult.error);
    console.error(`[webhook] Error details: ${JSON.stringify(insertResult.error, null, 2)}`);

    // Mark job as failed with detailed error
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'failed',
        error_message: `Error al guardar documento (${insertResult.attempts} intentos): ${insertResult.error?.message || 'Unknown error'}`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return;
  }

  const insertedDoc = insertResult.result;
  console.log(`[webhook] SUCCESS! Created document "${documentName}" (id: ${insertedDoc?.id}) with ${allItems.length} items for job ${job.id} (${insertResult.attempts} attempt${insertResult.attempts > 1 ? 's' : ''})`);

  // Trigger embedding generation asynchronously
  if (insertedDoc?.id) {
    triggerEmbeddingGeneration(insertedDoc.id).catch(err => {
      console.error('[webhook] Background embedding generation failed:', err);
    });
  }

  // Update job as completed
  await supabase
    .from('scraper_jobs')
    .update({
      status: 'completed',
      result_count: allItems.length,
      result_preview: allItems.slice(0, 5),
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id);
}

// ============================================
// GENERATE AUTO TAGS
// ============================================

function generateAutoTags(scraperType: string, targetName: string): string[] {
  const today = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');

  const sourceTag = SOURCE_NAMES[scraperType]?.split(' ')[0] || scraperType;

  return [targetName, sourceTag, today].filter(Boolean);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractUrl(item: ApifyDatasetItem): string | undefined {
  const urlFields = ['url', 'link', 'href', 'postUrl', 'profileUrl', 'pageUrl'];
  for (const field of urlFields) {
    if (item[field] && typeof item[field] === 'string') {
      return item[field] as string;
    }
  }
  return undefined;
}
