import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

/**
 * Check if there's an ongoing Deep Research for a campaign
 * Used to restore polling state after browser refresh
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Missing campaign_id parameter' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Look for execution_logs with status 'polling' for this campaign
    // The interaction_id is stored in error_details as JSON
    const { data: pollingLogs, error } = await supabase
      .from('execution_logs')
      .select('id, step_name, error_details, created_at')
      .eq('campaign_id', campaignId)
      .eq('status', 'polling')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('[Check Deep Research] Error querying logs:', error)
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      )
    }

    if (!pollingLogs || pollingLogs.length === 0) {
      return NextResponse.json({
        has_ongoing: false
      })
    }

    const log = pollingLogs[0]

    // Parse the error_details to get interaction_id
    let interactionId: string | null = null
    let stepName: string = ''

    try {
      if (log.error_details) {
        const details = typeof log.error_details === 'string'
          ? JSON.parse(log.error_details)
          : log.error_details

        interactionId = details.interaction_id || details.interactionId || null
        stepName = details.step_name || details.stepName || ''
      }
    } catch (parseError) {
      console.error('[Check Deep Research] Error parsing error_details:', parseError)
    }

    if (!interactionId) {
      // No valid interaction_id found, mark as not ongoing
      return NextResponse.json({
        has_ongoing: false
      })
    }

    // Use step_name from the log directly (it's stored there)
    // Fall back to error_details.step_name if needed
    if (!stepName && log.step_name) {
      stepName = log.step_name
    }

    return NextResponse.json({
      has_ongoing: true,
      interaction_id: interactionId,
      step_id: null, // execution_logs doesn't have step_id, only step_name
      step_name: stepName || log.step_name || 'Deep Research',
      log_id: log.id,
      started_at: log.created_at
    })

  } catch (error) {
    console.error('[Check Deep Research] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
