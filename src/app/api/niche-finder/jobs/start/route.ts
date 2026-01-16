import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { StartNicheFinderRequest, StartNicheFinderResponse } from '@/types/scraper.types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse<StartNicheFinderResponse>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: 'Database configuration missing' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body: StartNicheFinderRequest = await request.json()
    const { project_id, config } = body

    if (!project_id || !config) {
      return NextResponse.json(
        { success: false, error: 'project_id and config are required' },
        { status: 400 }
      )
    }

    // Validate config has minimum required fields
    if (!config.life_contexts?.length || !config.product_words?.length) {
      return NextResponse.json(
        { success: false, error: 'At least one life_context and product_word are required' },
        { status: 400 }
      )
    }

    // Create job record
    const { data: job, error: insertError } = await supabase
      .from('niche_finder_jobs')
      .insert({
        project_id,
        status: 'pending',
        config,
        urls_found: 0,
        urls_scraped: 0,
        urls_filtered: 0,
        urls_failed: 0,
        niches_extracted: 0,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating job:', insertError)
      return NextResponse.json(
        { success: false, error: `Failed to create job: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      job_id: job.id,
    })
  } catch (error) {
    console.error('Error starting niche finder job:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
