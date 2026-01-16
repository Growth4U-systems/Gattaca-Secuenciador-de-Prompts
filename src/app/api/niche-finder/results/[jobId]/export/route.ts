import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ExtractedNiche } from '@/types/scraper.types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ jobId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { jobId } = await params

  try {
    const body = await request.json()
    const format = body.format || 'csv'

    // Get extracted niches
    const { data: niches, error: nichesError } = await supabase
      .from('niche_finder_extracted')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })

    if (nichesError) {
      throw new Error(`Failed to fetch niches: ${nichesError.message}`)
    }

    if (!niches || niches.length === 0) {
      return NextResponse.json({ error: 'No niches found' }, { status: 404 })
    }

    if (format === 'csv') {
      const csv = generateCSV(niches)

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="nichos-${jobId.slice(0, 8)}.csv"`,
        },
      })
    } else if (format === 'sheets') {
      // Google Sheets integration would require OAuth setup
      // For now, return a message suggesting CSV download
      return NextResponse.json({
        success: true,
        message: 'Google Sheets integration not yet available. Please download CSV and import manually.',
        sheets_url: null,
      })
    } else {
      return NextResponse.json({ error: 'Invalid format. Use csv or sheets' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error exporting results:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function generateCSV(niches: ExtractedNiche[]): string {
  const headers = [
    'ID',
    'Problem',
    'Persona',
    'Functional Cause',
    'Emotional Load',
    'Evidence',
    'Alternatives',
    'Source URL',
    'Created At',
  ]

  const rows = niches.map((niche) => [
    niche.id,
    escapeCSV(niche.problem),
    escapeCSV(niche.persona),
    escapeCSV(niche.functional_cause),
    escapeCSV(niche.emotional_load),
    escapeCSV(niche.evidence),
    escapeCSV(niche.alternatives),
    niche.source_url,
    niche.created_at,
  ])

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
}

function escapeCSV(value: string | null | undefined): string {
  if (!value) return ''

  // If contains comma, newline, or quote, wrap in quotes and escape internal quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}
