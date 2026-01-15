import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server-admin';
import { ApifyWebhookPayload, ApifyDatasetItem, ScraperJob } from '@/types/scraper.types';
import { getScraperTemplate } from '@/lib/scraperTemplates';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes to process large datasets

const APIFY_TOKEN = process.env.APIFY_TOKEN;

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

    // Handle based on event type
    switch (payload.eventType) {
      case 'ACTOR.RUN.SUCCEEDED':
        await handleRunSucceeded(supabase, job as ScraperJob, payload);
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
  payload: ApifyWebhookPayload
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
  await fetchAndSaveResults(supabase, job, datasetId);
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
// FETCH AND SAVE RESULTS
// ============================================

async function fetchAndSaveResults(
  supabase: ReturnType<typeof createClient>,
  job: ScraperJob,
  datasetId: string
): Promise<void> {
  if (!APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN not configured');
  }

  // Fetch all items from dataset (paginated)
  let allItems: ApifyDatasetItem[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const response = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit}&offset=${offset}`
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

  // Get template for field extraction
  const template = getScraperTemplate(job.scraper_type as Parameters<typeof getScraperTemplate>[0]);

  // Convert items to documents
  const documents = allItems.map((item, index) => {
    const textContent = extractTextContent(item, template?.outputFields || []);

    return {
      project_id: job.project_id,
      name: generateDocumentName(job.scraper_type, item, index),
      content: textContent,
      category: job.target_category || 'research',
      source_type: 'scraper',
      source_job_id: job.id,
      source_url: extractUrl(item),
      source_metadata: {
        scraper_type: job.scraper_type,
        scraped_at: new Date().toISOString(),
        item_index: index,
        total_items: allItems.length,
        raw_data: item,
      },
    };
  });

  // Insert documents in batches
  const batchSize = 100;
  let insertedCount = 0;

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const { error } = await supabase.from('knowledge_base_docs').insert(batch);

    if (error) {
      console.error(`[webhook] Error inserting batch ${i / batchSize}:`, error);
    } else {
      insertedCount += batch.length;
    }
  }

  console.log(`[webhook] Inserted ${insertedCount} documents for job ${job.id}`);

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
// HELPER FUNCTIONS
// ============================================

function extractTextContent(item: ApifyDatasetItem, outputFields: string[]): string {
  const parts: string[] = [];
  const textFields = [
    'text',
    'content',
    'caption',
    'description',
    'title',
    'body',
    'transcript',
    'review',
    'comment',
    ...outputFields,
  ];

  for (const field of textFields) {
    const value = item[field];
    if (value && typeof value === 'string' && value.trim()) {
      parts.push(`**${field}**: ${value}`);
    }
  }

  // Add rating if present
  if (item.rating !== undefined) {
    parts.push(`**rating**: ${item.rating}`);
  }

  // Add date if present
  const dateFields = ['date', 'timestamp', 'createdAt', 'publishedAt', 'postedAt'];
  for (const field of dateFields) {
    if (item[field]) {
      parts.push(`**${field}**: ${item[field]}`);
      break;
    }
  }

  // Add author if present
  if (item.author) {
    const author = typeof item.author === 'object' ? JSON.stringify(item.author) : item.author;
    parts.push(`**author**: ${author}`);
  }

  if (parts.length === 0) {
    return JSON.stringify(item, null, 2);
  }

  return parts.join('\n\n');
}

function generateDocumentName(scraperType: string, item: ApifyDatasetItem, index: number): string {
  // Try to create meaningful name
  if (item.title && typeof item.title === 'string') {
    return item.title.substring(0, 100);
  }
  if (item.shortCode) {
    return `Post ${item.shortCode}`;
  }
  if (item.id) {
    return `${scraperType.replace(/_/g, ' ')} - ${item.id}`;
  }

  const scraperName = scraperType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return `${scraperName} - Item ${index + 1}`;
}

function extractUrl(item: ApifyDatasetItem): string | undefined {
  const urlFields = ['url', 'link', 'href', 'postUrl', 'profileUrl', 'pageUrl'];
  for (const field of urlFields) {
    if (item[field] && typeof item[field] === 'string') {
      return item[field] as string;
    }
  }
  return undefined;
}
