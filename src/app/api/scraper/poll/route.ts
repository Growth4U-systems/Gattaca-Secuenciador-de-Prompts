import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { ScraperPollResponse, ApifyRunStatus, ApifyDatasetItem, ScraperJob } from '@/types/scraper.types';
import { getUserApiKey } from '@/lib/getUserApiKey';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

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
      return await pollApifyRun(supabase, job as ScraperJob, session.user.id);
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
  job: ScraperJob,
  userId: string
): Promise<NextResponse<ScraperPollResponse>> {
  // Get Apify token from user's settings or fallback to env
  const apifyToken = await getUserApiKey({ userId, serviceName: 'apify', supabase });

  if (!apifyToken) {
    throw new Error('Apify API key not configured. Please add your API key in Settings > API Keys.');
  }

  // Check run status
  const statusResponse = await fetch(
    `https://api.apify.com/v2/actor-runs/${job.actor_run_id}?token=${apifyToken}`
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
    // Fetch and save results - pass apifyToken to avoid re-fetching
    try {
      await fetchAndSaveApifyResults(supabase, job, statusData.data.defaultDatasetId, apifyToken);
    } catch (saveError) {
      console.error('[scraper/poll] Error saving results:', saveError);
      await supabase
        .from('scraper_jobs')
        .update({
          status: 'failed',
          error_message: `Error guardando resultados: ${saveError instanceof Error ? saveError.message : 'Unknown'}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return NextResponse.json<ScraperPollResponse>({
        status: 'failed',
        progress_percent: 0,
        completed: true,
        error: 'Error al guardar los resultados del scraper',
      });
    }

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
// FETCH AND SAVE APIFY RESULTS
// ============================================

async function fetchAndSaveApifyResults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ScraperJob,
  datasetId: string,
  apifyToken: string
): Promise<void> {
  // Update status to processing
  await supabase.from('scraper_jobs').update({ status: 'processing' }).eq('id', job.id);

  // Fetch dataset items
  const datasetResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&limit=1000`
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

  // ============================================
  // CREATE ONE CONSOLIDATED DOCUMENT WITH RAW DATA
  // ============================================

  // Store the raw Apify output as JSON - no transformation
  const consolidatedContent = JSON.stringify(items, null, 2);

  // Get target name from job or generate from first item
  const targetName = job.target_name ||
    (items[0]?.author as string) ||
    (items[0]?.profileUrl as string)?.split('/').pop() ||
    'Unknown';

  // Generate document name: "Trustpilot Reviews - Revolut"
  const sourceName = SOURCE_NAMES[job.scraper_type] || job.scraper_type.replace(/_/g, ' ');
  const documentName = `${sourceName} - ${targetName}`;

  // Generate tags from job metadata or auto-generate
  const providerMetadata = job.provider_metadata as Record<string, unknown> | null;
  const pendingTags = (providerMetadata?.pending_tags as string[]) || [];
  const tags = pendingTags.length > 0 ? pendingTags : generateAutoTags(job.scraper_type, targetName);

  // Generate description/brief
  const description = `${items.length} ${sourceName.toLowerCase()} de ${targetName}, extraídos el ${new Date().toLocaleDateString('es-ES')}. Incluye información como ratings, fechas, y contenido textual.`;

  // Insert ONE consolidated document
  const { error: docError } = await supabase.from('knowledge_base_docs').insert({
    project_id: job.project_id,
    filename: documentName,
    extracted_content: consolidatedContent,
    description: description,
    category: job.target_category || 'research',
    tags: tags,
    source_type: 'scraper',
    source_job_id: job.id,
    source_url: extractUrl(items[0]),
    source_metadata: {
      scraper_type: job.scraper_type,
      scraped_at: new Date().toISOString(),
      total_items: items.length,
      target_name: targetName,
      raw_preview: items.slice(0, 10),
    },
  });

  if (docError) {
    console.error('[scraper/poll] Error inserting consolidated document:', docError);
  } else {
    console.log(`[scraper/poll] Created consolidated document "${documentName}" with ${items.length} items`);
  }

  // Update job as completed
  await supabase
    .from('scraper_jobs')
    .update({
      status: 'completed',
      result_count: items.length,
      result_preview: items.slice(0, 5),
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
  // Try common URL fields
  if (item.url) return String(item.url);
  if (item.link) return String(item.link);
  if (item.href) return String(item.href);
  if (item.postUrl) return String(item.postUrl);
  if (item.profileUrl) return String(item.profileUrl);
  return undefined;
}
