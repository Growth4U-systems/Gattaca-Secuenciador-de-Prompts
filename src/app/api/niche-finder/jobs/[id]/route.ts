import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Get a specific job
export async function GET(request: NextRequest, { params }: Params) {
  const { id: jobId } = await params

  try {
    const { data: job, error } = await supabase
      .from('niche_finder_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ job })
  } catch (error) {
    console.error('[Job API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Update a job (mainly for updating config like extraction_prompt)
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: jobId } = await params

  try {
    const body = await request.json()
    const { extraction_prompt } = body

    // Get current job to merge config
    const { data: currentJob, error: fetchError } = await supabase
      .from('niche_finder_jobs')
      .select('config')
      .eq('id', jobId)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 404 })
    }

    // Merge the extraction_prompt into the existing config
    const updatedConfig = {
      ...(currentJob.config || {}),
      ...(extraction_prompt !== undefined && { extraction_prompt }),
    }

    const { data: job, error: updateError } = await supabase
      .from('niche_finder_jobs')
      .update({ config: updatedConfig })
      .eq('id', jobId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log(`[Job API] Updated job ${jobId} config with extraction_prompt`)
    return NextResponse.json({ job })
  } catch (error) {
    console.error('[Job API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
