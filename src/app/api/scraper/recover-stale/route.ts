import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createAdminClient } from '@/lib/supabase-server-admin';
import { ScraperJob, ApifyRunStatus, ApifyDatasetItem, ScraperOutputConfig } from '@/types/scraper.types';
import { getUserApiKey } from '@/lib/getUserApiKey';
import { formatScraperOutput } from '@/lib/scraperOutputFormatter';
import { triggerEmbeddingGeneration } from '@/lib/embeddings';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes for recovery
export const dynamic = 'force-dynamic';

/**
 * Recover Stale Scraper Jobs
 *
 * This endpoint checks for jobs that have been stuck in "running" or "pending" status
 * for too long (> 15 minutes) and attempts to recover them by:
 * 1. Checking the actual status with Apify
 * 2. If completed, fetching and saving the results
 * 3. If failed, marking the job as failed
 *
 * Call this endpoint when:
 * - User opens the project page
 * - User opens the scrapers section
 * - Periodically via cron (if set up)
 */

const STALE_THRESHOLD_MINUTES = 15;

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const projectId = body.projectId;

    // Calculate threshold timestamp
    const thresholdDate = new Date();
    thresholdDate.setMinutes(thresholdDate.getMinutes() - STALE_THRESHOLD_MINUTES);

    // Find stale jobs for this user's projects
    let query = supabase
      .from('scraper_jobs')
      .select('*, projects!inner(user_id)')
      .in('status', ['running', 'pending', 'processing'])
      .lt('started_at', thresholdDate.toISOString())
      .eq('provider', 'apify')
      .not('actor_run_id', 'is', null);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: staleJobs, error: queryError } = await query;

    if (queryError) {
      console.error('[recover-stale] Query error:', queryError);
      return NextResponse.json({ error: 'Failed to query jobs' }, { status: 500 });
    }

    // Filter to only jobs the user owns
    const userStaleJobs = (staleJobs || []).filter(
      (job: any) => job.projects?.user_id === session.user.id
    );

    // ============================================
    // PHASE 2: Find "completed" jobs missing their document
    // ============================================

    let completedMissingQuery = supabase
      .from('scraper_jobs')
      .select('*, projects!inner(user_id)')
      .eq('status', 'completed')
      .eq('provider', 'apify')
      .not('actor_run_id', 'is', null);

    if (projectId) {
      completedMissingQuery = completedMissingQuery.eq('project_id', projectId);
    }

    const { data: completedJobs } = await completedMissingQuery;

    const userCompletedJobs = (completedJobs || []).filter(
      (job: any) => job.projects?.user_id === session.user.id
    );

    // Check which completed jobs are actually missing their document
    const orphanedJobs: typeof userCompletedJobs = [];
    const unlinkedJobs: Array<{ job: any; docId: string }> = [];

    for (const job of userCompletedJobs) {
      const meta = (job.provider_metadata as Record<string, unknown>) || {};
      // If already has document_id, check it exists
      if (meta.document_id) continue;

      // Check if document exists by source_job_id
      const { data: existingDoc } = await supabase
        .from('knowledge_base_docs')
        .select('id')
        .eq('source_job_id', job.id)
        .maybeSingle();

      if (existingDoc) {
        // Document exists but not linked in provider_metadata
        unlinkedJobs.push({ job, docId: existingDoc.id });
      } else {
        // Document truly missing - needs recovery from Apify
        orphanedJobs.push(job);
      }
    }

    // Combine all jobs that need work
    const allJobsToProcess = userStaleJobs.length + orphanedJobs.length + unlinkedJobs.length;

    if (allJobsToProcess === 0) {
      return NextResponse.json({
        message: 'No stale jobs found',
        recovered: 0,
        failed: 0,
        linked: 0,
      });
    }

    console.log(`[recover-stale] Found ${userStaleJobs.length} stale, ${orphanedJobs.length} orphaned, ${unlinkedJobs.length} unlinked jobs`);

    // Get Apify token
    const apifyToken = await getUserApiKey({
      userId: session.user.id,
      serviceName: 'apify',
      supabase,
    });

    const adminSupabase = createAdminClient();
    let recovered = 0;
    let failed = 0;
    let linked = 0;
    const results: Array<{ jobId: string; status: string; message: string }> = [];

    // ============================================
    // Fix unlinked jobs first (quick, no Apify call needed)
    // ============================================

    for (const { job, docId } of unlinkedJobs) {
      const meta = (job.provider_metadata as Record<string, unknown>) || {};
      await adminSupabase
        .from('scraper_jobs')
        .update({
          provider_metadata: { ...meta, document_id: docId },
        })
        .eq('id', job.id);
      linked++;
      results.push({
        jobId: job.id,
        status: 'linked',
        message: `Documento existente vinculado (${docId.slice(0, 8)})`,
      });
    }

    if (!apifyToken) {
      return NextResponse.json({
        message: `Linked ${linked} jobs. Apify API key not configured for recovery.`,
        recovered: 0,
        failed: 0,
        linked,
        skipped: userStaleJobs.length + orphanedJobs.length,
      });
    }

    // Merge stale + orphaned for Apify recovery
    const jobsNeedingApify = [...(userStaleJobs as ScraperJob[]), ...(orphanedJobs as ScraperJob[])];

    // Process each job needing Apify recovery
    for (const job of jobsNeedingApify) {
      try {
        console.log(`[recover-stale] Checking job ${job.id} (run: ${job.actor_run_id})`);

        // Check actual status with Apify
        const statusResponse = await fetch(
          `https://api.apify.com/v2/actor-runs/${job.actor_run_id}?token=${apifyToken}`
        );

        if (!statusResponse.ok) {
          // Run doesn't exist or API error - mark as failed
          await adminSupabase
            .from('scraper_jobs')
            .update({
              status: 'failed',
              error_message: `No se pudo verificar el estado del scraper (HTTP ${statusResponse.status})`,
              completed_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          failed++;
          results.push({
            jobId: job.id,
            status: 'failed',
            message: `Apify API error: ${statusResponse.status}`,
          });
          continue;
        }

        const statusData = (await statusResponse.json()) as ApifyRunStatus;
        const runStatus = statusData.data.status;

        console.log(`[recover-stale] Job ${job.id} Apify status: ${runStatus}`);

        if (runStatus === 'SUCCEEDED') {
          // Recover results!
          try {
            const resultCount = await fetchAndSaveResults(
              adminSupabase,
              job,
              statusData.data.defaultDatasetId,
              apifyToken
            );

            recovered++;
            results.push({
              jobId: job.id,
              status: 'recovered',
              message: `Recuperado con ${resultCount} resultados`,
            });
          } catch (saveError) {
            console.error(`[recover-stale] Error saving results for job ${job.id}:`, saveError);
            await adminSupabase
              .from('scraper_jobs')
              .update({
                status: 'failed',
                error_message: `Error al recuperar resultados: ${saveError instanceof Error ? saveError.message : 'Unknown'}`,
                completed_at: new Date().toISOString(),
              })
              .eq('id', job.id);

            failed++;
            results.push({
              jobId: job.id,
              status: 'failed',
              message: `Error guardando: ${saveError instanceof Error ? saveError.message : 'Unknown'}`,
            });
          }
        } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(runStatus)) {
          // Mark as failed
          await adminSupabase
            .from('scraper_jobs')
            .update({
              status: 'failed',
              error_message: `Scraper ${runStatus.toLowerCase()}`,
              completed_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          failed++;
          results.push({
            jobId: job.id,
            status: 'failed',
            message: `Apify run ${runStatus}`,
          });
        } else if (runStatus === 'RUNNING') {
          // Still running (unusual for stale jobs) - leave it
          results.push({
            jobId: job.id,
            status: 'still_running',
            message: 'Job aun en ejecucion en Apify',
          });
        }
      } catch (jobError) {
        console.error(`[recover-stale] Error processing job ${job.id}:`, jobError);
        results.push({
          jobId: job.id,
          status: 'error',
          message: jobError instanceof Error ? jobError.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: `Procesados ${allJobsToProcess} jobs (${linked} vinculados, ${recovered} recuperados, ${failed} fallidos)`,
      recovered,
      failed,
      linked,
      results,
    });
  } catch (error) {
    console.error('[recover-stale] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// FETCH AND SAVE RESULTS (copy from poll route)
// ============================================

async function fetchAndSaveResults(
  supabase: ReturnType<typeof createAdminClient>,
  job: ScraperJob,
  datasetId: string,
  apifyToken: string
): Promise<number> {
  // Check if document already exists (maybe webhook/poll saved it in the meantime)
  const { data: existingDoc } = await supabase
    .from('knowledge_base_docs')
    .select('id')
    .eq('source_job_id', job.id)
    .maybeSingle();

  if (existingDoc) {
    console.log(`[recover-stale] Document already exists for job ${job.id} (id: ${existingDoc.id})`);
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        provider_metadata: {
          ...((job.provider_metadata as Record<string, unknown>) || {}),
          document_id: existingDoc.id,
        },
      })
      .eq('id', job.id);
    return 0;
  }

  // Update status to processing
  await supabase.from('scraper_jobs').update({ status: 'processing' }).eq('id', job.id);

  // Fetch dataset items (paginated)
  console.log(`[recover-stale] Fetching dataset ${datasetId}...`);
  let items: ApifyDatasetItem[] = [];
  let offset = 0;
  const fetchLimit = 1000;

  while (true) {
    const datasetResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&limit=${fetchLimit}&offset=${offset}`
    );

    if (!datasetResponse.ok) {
      throw new Error(`Failed to fetch dataset: ${datasetResponse.status}`);
    }

    const batch = (await datasetResponse.json()) as ApifyDatasetItem[];

    if (!batch || batch.length === 0) {
      break;
    }

    items = items.concat(batch);
    offset += batch.length;

    if (items.length >= 10000) {
      console.warn('[recover-stale] Reached 10000 items limit');
      break;
    }
  }

  console.log(`[recover-stale] Fetched ${items.length} items`);

  if (!items || items.length === 0) {
    await supabase
      .from('scraper_jobs')
      .update({
        status: 'completed',
        result_count: 0,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return 0;
  }

  // Get output config
  const providerMeta = job.provider_metadata as Record<string, unknown> | null;
  const outputConfig: ScraperOutputConfig = (providerMeta?.output_config as ScraperOutputConfig) || {
    format: 'json',
  };

  // Format content
  const consolidatedContent = formatScraperOutput(items, outputConfig);

  // Get target name
  const targetName =
    job.target_name ||
    (items[0]?.author as string) ||
    (items[0]?.profileUrl as string)?.split('/').pop() ||
    'Unknown';

  // Generate document name: "Source - Target - 2026-02-13"
  const sourceName = SOURCE_NAMES[job.scraper_type] || job.scraper_type.replace(/_/g, ' ');
  const dateStr = new Date().toISOString().split('T')[0];
  const documentName = `${sourceName} - ${targetName} - ${dateStr}`;

  // Generate tags
  const pendingTags = (providerMeta?.pending_tags as string[]) || [];
  const today = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');
  const sourceTag = SOURCE_NAMES[job.scraper_type]?.split(' ')[0] || job.scraper_type;
  const tags = pendingTags.length > 0 ? pendingTags : [targetName, sourceTag, today];

  // Generate description
  const description = `${items.length} ${sourceName.toLowerCase()} de ${targetName}, extraídos el ${new Date().toLocaleDateString('es-ES')}. [RECUPERADO]`;

  // Custom metadata
  const customMeta = (providerMeta?.custom_metadata as Record<string, unknown>) || {};

  // Insert document
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
      source_metadata: {
        scraper_type: job.scraper_type,
        scraped_at: new Date().toISOString(),
        total_items: items.length,
        target_name: targetName,
        output_format: outputConfig.format,
        competitor: customMeta.competitor || null,
        source_type: customMeta.source_type || job.scraper_type,
        campaign_id: customMeta.campaign_id || null,
        recovered: true, // Flag that this was recovered
      },
    })
    .select('id')
    .single();

  if (insertError) {
    console.error(`[recover-stale] Insert error:`, insertError);
    throw insertError;
  }

  console.log(`[recover-stale] Created document "${documentName}" (id: ${insertedDoc?.id})`);

  // Trigger embedding generation
  if (insertedDoc?.id) {
    triggerEmbeddingGeneration(insertedDoc.id).catch((err) => {
      console.error('[recover-stale] Embedding generation failed:', err);
    });
  }

  // Update job as completed with document_id
  await supabase
    .from('scraper_jobs')
    .update({
      status: 'completed',
      result_count: items.length,
      result_preview: items.slice(0, 5),
      completed_at: new Date().toISOString(),
      provider_metadata: {
        ...((job.provider_metadata as Record<string, unknown>) || {}),
        document_id: insertedDoc?.id,
      },
    })
    .eq('id', job.id);

  return items.length;
}
