import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server-admin';
import { ApifyWebhookPayload, ApifyDatasetItem, ScraperJob } from '@/types/scraper.types';
import { getScraperTemplate } from '@/lib/scraperTemplates';
import { getApiKeyForService } from '@/lib/getUserApiKey';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes to process large datasets

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

  // Get template for field extraction
  const template = getScraperTemplate(job.scraper_type as Parameters<typeof getScraperTemplate>[0]);

  // ============================================
  // CREATE ONE CONSOLIDATED DOCUMENT
  // ============================================

  // Generate consolidated content from all items
  const consolidatedContent = allItems.map((item, index) => {
    const textContent = extractTextContent(item, template?.outputFields || []);
    return `## Item ${index + 1}\n\n${textContent}`;
  }).join('\n\n---\n\n');

  // Get target name from job or generate from first item
  const targetName = job.target_name ||
    (allItems[0]?.author as string) ||
    (allItems[0]?.profileUrl as string)?.split('/').pop() ||
    'Unknown';

  // Generate document name: "Trustpilot Reviews - Revolut"
  const sourceName = SOURCE_NAMES[job.scraper_type] || job.scraper_type.replace(/_/g, ' ');
  const documentName = `${sourceName} - ${targetName}`;

  // Generate tags from job metadata or auto-generate
  const providerMetadata = job.provider_metadata as Record<string, unknown> | null;
  const pendingTags = (providerMetadata?.pending_tags as string[]) || [];
  const tags = pendingTags.length > 0 ? pendingTags : generateAutoTags(job.scraper_type, targetName);

  // Generate description/brief
  const description = `${allItems.length} ${sourceName.toLowerCase()} de ${targetName}, extraídos el ${new Date().toLocaleDateString('es-ES')}. Incluye información como ratings, fechas, y contenido textual.`;

  // Insert ONE consolidated document
  const { error: docError } = await supabase.from('knowledge_base_docs').insert({
    project_id: job.project_id,
    name: documentName,
    content: consolidatedContent,
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
      // Store raw data as preview (first 10 items)
      raw_preview: allItems.slice(0, 10),
    },
  });

  if (docError) {
    console.error('[webhook] Error inserting consolidated document:', docError);
  } else {
    console.log(`[webhook] Created consolidated document "${documentName}" with ${allItems.length} items for job ${job.id}`);
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
