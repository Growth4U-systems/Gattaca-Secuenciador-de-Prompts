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
    const userJobs = (staleJobs || []).filter(
      (job: any) => job.projects?.user_id === session.user.id
    );

    if (userJobs.length === 0) {
      return NextResponse.json({
        message: 'No stale jobs found',
        recovered: 0,
        failed: 0,
      });
    }

    console.log(`[recover-stale] Found ${userJobs.length} stale jobs to check`);

    // Get Apify token
    const apifyToken = await getUserApiKey({
      userId: session.user.id,
      serviceName: 'apify',
      supabase,
    });

    if (!apifyToken) {
      return NextResponse.json({
        message: 'Apify API key not configured',
        recovered: 0,
        failed: 0,
        skipped: userJobs.length,
      });
    }

    const adminSupabase = createAdminClient();
    let recovered = 0;
    let failed = 0;
    const results: Array<{ jobId: string; status: string; message: string }> = [];

    // Process each stale job
    for (const job of userJobs as ScraperJob[]) {
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
      message: `Procesados ${userJobs.length} jobs`,
      recovered,
      failed,
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
  // Update status to processing
  await supabase.from('scraper_jobs').update({ status: 'processing' }).eq('id', job.id);

  // Fetch dataset items
  console.log(`[recover-stale] Fetching dataset ${datasetId}...`);
  const datasetResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&limit=5000`
  );

  if (!datasetResponse.ok) {
    throw new Error(`Failed to fetch dataset: ${datasetResponse.status}`);
  }

  const items = (await datasetResponse.json()) as ApifyDatasetItem[];
  console.log(`[recover-stale] Fetched ${items?.length || 0} items`);

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

  // Generate document name
  const sourceName = SOURCE_NAMES[job.scraper_type] || job.scraper_type.replace(/_/g, ' ');
  const documentName = `${sourceName} - ${targetName}`;

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

  return items.length;
}
