import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { ScraperPollResponse, ApifyRunStatus, ApifyDatasetItem, ScraperJob } from '@/types/scraper.types';
import { getScraperTemplate } from '@/lib/scraperTemplates';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const APIFY_TOKEN = process.env.APIFY_TOKEN;

// ============================================
// MAIN HANDLER
// ============================================

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get job
    const { data: job, error: jobError } = await supabase
      .from('scraper_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // If already completed or failed, return current status
    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      return NextResponse.json<ScraperPollResponse>({
        status: job.status,
        progress_percent: job.progress_percent,
        result_count: job.result_count,
        completed: true,
        error: job.error_message || undefined,
      });
    }

    // For Apify jobs, check status and fetch results if completed
    if (job.provider === 'apify' && job.actor_run_id) {
      return await pollApifyRun(supabase, job as ScraperJob);
    }

    // For other providers, just return current status
    return NextResponse.json<ScraperPollResponse>({
      status: job.status,
      progress_percent: job.progress_percent,
      completed: false,
    });
  } catch (error) {
    console.error('[scraper/poll] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// APIFY POLLING
// ============================================

async function pollApifyRun(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob
): Promise<NextResponse<ScraperPollResponse>> {
  if (!APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN not configured');
  }

  // Check run status
  const statusResponse = await fetch(
    `https://api.apify.com/v2/actor-runs/${job.actor_run_id}?token=${APIFY_TOKEN}`
  );

  if (!statusResponse.ok) {
    throw new Error(`Failed to fetch run status: ${statusResponse.status}`);
  }

  const statusData = (await statusResponse.json()) as ApifyRunStatus;
  const runStatus = statusData.data.status;

  // Map Apify status to our status
  if (runStatus === 'RUNNING' || runStatus === 'READY') {
    return NextResponse.json<ScraperPollResponse>({
      status: 'running',
      progress_percent: 50, // Apify doesn't provide progress, estimate 50%
      completed: false,
    });
  }

  if (runStatus === 'FAILED' || runStatus === 'ABORTED' || runStatus === 'TIMED-OUT') {
    // Update job status
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'failed',
        error_message: `Apify run ${runStatus.toLowerCase()}`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return NextResponse.json<ScraperPollResponse>({
      status: 'failed',
      progress_percent: 0,
      completed: true,
      error: `Apify run ${runStatus.toLowerCase()}`,
    });
  }

  if (runStatus === 'SUCCEEDED') {
    // Fetch and save results
    await fetchAndSaveApifyResults(supabase, job, statusData.data.defaultDatasetId);

    return NextResponse.json<ScraperPollResponse>({
      status: 'completed',
      progress_percent: 100,
      result_count: job.result_count,
      completed: true,
    });
  }

  // Unknown status
  return NextResponse.json<ScraperPollResponse>({
    status: job.status,
    progress_percent: job.progress_percent,
    completed: false,
  });
}

// ============================================
// FETCH AND SAVE APIFY RESULTS
// ============================================

async function fetchAndSaveApifyResults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  datasetId: string
): Promise<void> {
  if (!APIFY_TOKEN) {
    throw new Error('APIFY_TOKEN not configured');
  }

  // Update status to processing
  await supabase.from('scraper_jobs').update({ status: 'processing' }).eq('id', job.id);

  // Fetch dataset items
  const datasetResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=1000`
  );

  if (!datasetResponse.ok) {
    throw new Error(`Failed to fetch dataset: ${datasetResponse.status}`);
  }

  const items = (await datasetResponse.json()) as ApifyDatasetItem[];

  if (!items || items.length === 0) {
    // No results, mark as completed with 0 results
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

  // Get template to know which fields to extract
  const template = getScraperTemplate(job.scraper_type as Parameters<typeof getScraperTemplate>[0]);

  // Convert items to documents
  const documents = items.map((item, index) => {
    // Extract relevant text content based on scraper type
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
        total_items: items.length,
        raw_data: item, // Store original data
      },
    };
  });

  // Insert documents in batches of 50
  const batchSize = 50;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const { error } = await supabase.from('knowledge_base_docs').insert(batch);
    if (error) {
      console.error(`[scraper/poll] Error inserting documents batch ${i / batchSize}:`, error);
    }
  }

  // Update job as completed
  await supabase
    .from('scraper_jobs')
    .update({
      status: 'completed',
      result_count: items.length,
      result_preview: items.slice(0, 5), // Store first 5 items as preview
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractTextContent(item: ApifyDatasetItem, outputFields: string[]): string {
  const parts: string[] = [];

  // Try to extract text from common fields
  const textFields = ['text', 'content', 'caption', 'description', 'title', 'body', 'transcript', ...outputFields];

  for (const field of textFields) {
    if (item[field] && typeof item[field] === 'string') {
      parts.push(`${field}: ${item[field]}`);
    }
  }

  // If no text fields found, stringify the whole object
  if (parts.length === 0) {
    return JSON.stringify(item, null, 2);
  }

  return parts.join('\n\n');
}

function generateDocumentName(scraperType: string, item: ApifyDatasetItem, index: number): string {
  // Try to create a meaningful name from the item
  if (item.title) return String(item.title).substring(0, 100);
  if (item.shortCode) return `Post ${item.shortCode}`;
  if (item.id) return `Item ${item.id}`;
  if (item.url) {
    const url = String(item.url);
    return url.length > 50 ? url.substring(0, 50) + '...' : url;
  }

  return `${scraperType.replace(/_/g, ' ')} - Item ${index + 1}`;
}

function extractUrl(item: ApifyDatasetItem): string | undefined {
  // Try common URL fields
  if (item.url) return String(item.url);
  if (item.link) return String(item.link);
  if (item.href) return String(item.href);
  if (item.postUrl) return String(item.postUrl);
  if (item.profileUrl) return String(item.profileUrl);
  return undefined;
}
