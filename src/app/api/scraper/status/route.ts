import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createAdminClient } from '@/lib/supabase-server-admin';
import { ApifyDatasetItem, ScraperJob, ScraperOutputConfig } from '@/types/scraper.types';
import { getApiKeyForService } from '@/lib/getUserApiKey';
import { formatScraperOutput } from '@/lib/scraperOutputFormatter';
import { triggerEmbeddingGeneration } from '@/lib/embeddings';

export const runtime = 'nodejs';
export const maxDuration = 120;

// How long to wait before attempting recovery (3 minutes)
const RECOVERY_THRESHOLD_MS = 3 * 60 * 1000;

// ============================================
// SOURCE NAMES (shared with webhook)
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
// MAIN HANDLER - GET STATUS
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Support both job_id (from frontend) and jobId for backwards compatibility
    const jobId = request.nextUrl.searchParams.get('job_id') || request.nextUrl.searchParams.get('jobId');
    const batchId = request.nextUrl.searchParams.get('batch_id') || request.nextUrl.searchParams.get('batchId');

    if (!jobId && !batchId) {
      return NextResponse.json({ error: 'Must provide jobId or batchId' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get single job status
    if (jobId) {
      const { data: job, error } = await supabase
        .from('scraper_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      // Auto-recover stuck Apify jobs
      if (shouldAttemptRecovery(job)) {
        console.log(`[scraper/status] Job ${jobId} appears stuck, attempting recovery...`);
        const recoveredJob = await attemptApifyRecovery(job, session.user.id);
        if (recoveredJob) {
          return NextResponse.json({ success: true, job: recoveredJob });
        }
      }

      return NextResponse.json({ success: true, job });
    }

    // Get batch status with all jobs
    if (batchId) {
      const { data: batch, error: batchError } = await supabase
        .from('scraper_batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (batchError || !batch) {
        return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
      }

      const { data: jobs, error: jobsError } = await supabase
        .from('scraper_jobs')
        .select('*')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true });

      if (jobsError) {
        return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
      }

      // Auto-recover stuck Apify jobs in batch
      const recoveredJobs = await Promise.all(
        (jobs || []).map(async (job) => {
          if (shouldAttemptRecovery(job)) {
            console.log(`[scraper/status] Batch job ${job.id} appears stuck, attempting recovery...`);
            const recovered = await attemptApifyRecovery(job, session.user.id);
            return recovered || job;
          }
          return job;
        })
      );

      return NextResponse.json({
        success: true,
        batch: {
          ...batch,
          jobs: recoveredJobs,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('[scraper/status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// LIST JOBS FOR PROJECT
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, limit = 50, offset = 0, status: filterStatus } = body;

    if (!project_id) {
      return NextResponse.json({ error: 'Missing project_id' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build query
    let query = supabase
      .from('scraper_jobs')
      .select('*, scraper_batches(*)', { count: 'exact' })
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filterStatus) {
      query = query.eq('status', filterStatus);
    }

    const { data: jobs, error, count } = await query;

    if (error) {
      console.error('[scraper/status] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }

    return NextResponse.json({
      jobs: jobs || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[scraper/status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// APIFY RECOVERY - Detect and recover stuck jobs
// ============================================

function shouldAttemptRecovery(job: Record<string, unknown>): boolean {
  // Only recover Apify jobs that are stuck in 'running' status
  if (job.provider !== 'apify' || job.status !== 'running') return false;

  // Must have started_at to calculate how long it's been running
  if (!job.started_at) return false;

  const startedAt = new Date(job.started_at as string).getTime();
  const elapsed = Date.now() - startedAt;

  // Only attempt after threshold
  if (elapsed < RECOVERY_THRESHOLD_MS) return false;

  // Don't retry if we already attempted recovery
  const meta = job.provider_metadata as Record<string, unknown> | null;
  if (meta?.recovery_attempted) return false;

  return true;
}

async function attemptApifyRecovery(
  job: Record<string, unknown>,
  userId: string
): Promise<Record<string, unknown> | null> {
  const adminClient = createAdminClient();

  try {
    const meta = (job.provider_metadata as Record<string, unknown>) || {};
    const actorRunId = job.actor_run_id as string;

    if (!actorRunId) {
      console.error(`[recovery] No actor_run_id for job ${job.id}`);
      return null;
    }

    // Get Apify token
    const apifyToken = await getApiKeyForService('apify', userId, adminClient);
    if (!apifyToken) {
      console.error('[recovery] No Apify token available');
      return null;
    }

    // Mark recovery as attempted to prevent repeated tries
    await adminClient
      .from('scraper_jobs')
      .update({
        provider_metadata: {
          ...meta,
          recovery_attempted: true,
          recovery_attempted_at: new Date().toISOString(),
        },
      })
      .eq('id', job.id);

    // Check run status on Apify
    console.log(`[recovery] Checking Apify run ${actorRunId} for job ${job.id}...`);
    const runResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${actorRunId}?token=${apifyToken}`
    );

    if (!runResponse.ok) {
      console.error(`[recovery] Failed to check run status: ${runResponse.status}`);
      return null;
    }

    const runData = await runResponse.json();
    const runStatus = runData.data?.status;
    const datasetId = runData.data?.defaultDatasetId;

    console.log(`[recovery] Apify run status: ${runStatus}, datasetId: ${datasetId}`);

    if (runStatus === 'SUCCEEDED' && datasetId) {
      // Run completed on Apify but webhook didn't fire - fetch results now
      console.log(`[recovery] Run succeeded! Fetching dataset ${datasetId}...`);
      await recoverAndSaveResults(adminClient, job as unknown as ScraperJob, datasetId, apifyToken, userId);

      // Re-fetch the updated job
      const { data: updatedJob } = await adminClient
        .from('scraper_jobs')
        .select('*')
        .eq('id', job.id)
        .single();

      return updatedJob;
    } else if (runStatus === 'FAILED' || runStatus === 'ABORTED' || runStatus === 'TIMED-OUT') {
      // Run failed on Apify - update job status
      await adminClient
        .from('scraper_jobs')
        .update({
          status: 'failed',
          error_message: `Apify run ${runStatus.toLowerCase()} (recovered from stuck state)`,
          completed_at: new Date().toISOString(),
          provider_metadata: {
            ...meta,
            recovery_attempted: true,
            apify_final_status: runStatus,
          },
        })
        .eq('id', job.id);

      const { data: updatedJob } = await adminClient
        .from('scraper_jobs')
        .select('*')
        .eq('id', job.id)
        .single();

      return updatedJob;
    } else if (runStatus === 'RUNNING' || runStatus === 'READY') {
      // Still running on Apify - nothing to recover yet
      console.log(`[recovery] Run still ${runStatus} on Apify, will retry later`);
      // Reset recovery_attempted so it can be tried again
      await adminClient
        .from('scraper_jobs')
        .update({
          provider_metadata: {
            ...meta,
            recovery_attempted: false,
            last_apify_check: new Date().toISOString(),
            apify_status: runStatus,
          },
        })
        .eq('id', job.id);
      return null;
    }

    return null;
  } catch (error) {
    console.error(`[recovery] Error recovering job ${job.id}:`, error);
    return null;
  }
}

// ============================================
// FETCH AND SAVE RESULTS (Recovery version)
// ============================================

async function recoverAndSaveResults(
  supabase: ReturnType<typeof createAdminClient>,
  job: ScraperJob,
  datasetId: string,
  apifyToken: string,
  userId: string
): Promise<void> {
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

    if (allItems.length >= 10000) {
      break;
    }
  }

  console.log(`[recovery] Fetched ${allItems.length} items for job ${job.id}`);

  if (allItems.length === 0) {
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'completed',
        result_count: 0,
        completed_at: new Date().toISOString(),
        provider_metadata: {
          ...((job.provider_metadata as Record<string, unknown>) || {}),
          recovery_attempted: true,
          recovered_at: new Date().toISOString(),
        },
      })
      .eq('id', job.id);
    return;
  }

  // Get output config from job metadata
  const providerMeta = job.provider_metadata as Record<string, unknown> | null;
  const outputConfig: ScraperOutputConfig = (providerMeta?.output_config as ScraperOutputConfig) || {
    format: 'json',
  };

  const consolidatedContent = formatScraperOutput(allItems, outputConfig);

  const targetName = job.target_name ||
    (allItems[0]?.author as string) ||
    (allItems[0]?.profileUrl as string)?.split('/').pop() ||
    'Unknown';

  const sourceName = SOURCE_NAMES[job.scraper_type] || job.scraper_type.replace(/_/g, ' ');
  const documentName = `${sourceName} - ${targetName}`;

  const pendingTags = (providerMeta?.pending_tags as string[]) || [];
  const tags = pendingTags.length > 0 ? pendingTags : generateAutoTags(job.scraper_type, targetName);

  const description = `${allItems.length} ${sourceName.toLowerCase()} de ${targetName}, extraídos el ${new Date().toLocaleDateString('es-ES')}. Incluye información como ratings, fechas, y contenido textual.`;

  const customMeta = (providerMeta?.custom_metadata as Record<string, unknown>) || {};

  if (!job.project_id) {
    console.error('[recovery] Missing project_id');
    await supabase.from('scraper_jobs').update({
      status: 'failed',
      error_message: 'Recovery failed: Missing project_id',
      completed_at: new Date().toISOString(),
    }).eq('id', job.id);
    return;
  }

  if (!consolidatedContent || consolidatedContent.trim().length === 0) {
    console.error('[recovery] Empty content');
    await supabase.from('scraper_jobs').update({
      status: 'failed',
      error_message: 'Recovery failed: No content extracted',
      completed_at: new Date().toISOString(),
    }).eq('id', job.id);
    return;
  }

  // Check if document already exists (webhook might have saved it)
  const { data: existingDoc } = await supabase
    .from('knowledge_base_docs')
    .select('id')
    .eq('source_job_id', job.id)
    .maybeSingle();

  if (existingDoc) {
    console.log(`[recovery] Document already exists for job ${job.id}, skipping insert`);
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'completed',
        result_count: allItems.length,
        completed_at: new Date().toISOString(),
        provider_metadata: {
          ...((job.provider_metadata as Record<string, unknown>) || {}),
          recovery_attempted: true,
          recovered_at: new Date().toISOString(),
          document_already_existed: true,
        },
      })
      .eq('id', job.id);
    return;
  }

  // Insert document
  console.log(`[recovery] Saving document "${documentName}" (${consolidatedContent.length} chars, ${allItems.length} items)`);

  const { data: insertedDoc, error: insertError } = await supabase
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
        competitor: customMeta.competitor || null,
        source_type: customMeta.source_type || job.scraper_type,
        campaign_id: customMeta.campaign_id || null,
        raw_preview: allItems.slice(0, 10),
        recovered: true,
      },
    })
    .select('id')
    .single();

  if (insertError) {
    console.error(`[recovery] Insert error:`, insertError);
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'failed',
        error_message: `Recovery insert failed: ${insertError.message}`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return;
  }

  console.log(`[recovery] SUCCESS! Created document "${documentName}" (id: ${insertedDoc?.id}) with ${allItems.length} items`);

  // Trigger embedding generation
  if (insertedDoc?.id) {
    triggerEmbeddingGeneration(insertedDoc.id).catch(err => {
      console.error('[recovery] Embedding generation failed:', err);
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
      provider_metadata: {
        ...((job.provider_metadata as Record<string, unknown>) || {}),
        recovery_attempted: true,
        recovered_at: new Date().toISOString(),
        document_id: insertedDoc?.id,
      },
    })
    .eq('id', job.id);
}

// ============================================
// HELPER FUNCTIONS
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

function extractUrl(item: ApifyDatasetItem): string | undefined {
  const urlFields = ['url', 'link', 'href', 'postUrl', 'profileUrl', 'pageUrl'];
  for (const field of urlFields) {
    if (item[field] && typeof item[field] === 'string') {
      return item[field] as string;
    }
  }
  return undefined;
}
