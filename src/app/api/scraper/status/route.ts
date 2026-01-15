import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { ScraperStatusResponse } from '@/types/scraper.types';

export const runtime = 'nodejs';

// ============================================
// MAIN HANDLER - GET STATUS
// ============================================

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId');
    const batchId = request.nextUrl.searchParams.get('batchId');

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

      return NextResponse.json<ScraperStatusResponse>({ job });
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

      return NextResponse.json<ScraperStatusResponse>({
        batch: {
          ...batch,
          jobs: jobs || [],
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
