import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{
    campaignId: string
  }>
}

/**
 * Update campaign custom_variables
 * Used by discovery to save found profiles
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { campaignId } = await params

    if (!campaignId) {
      return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { custom_variables } = body

    console.log(`[campaign/update-variables] Received update for ${campaignId}:`, JSON.stringify(custom_variables, null, 2))

    if (!custom_variables || typeof custom_variables !== 'object') {
      return NextResponse.json({ error: 'custom_variables is required' }, { status: 400 })
    }

    // Get current campaign to merge variables
    const { data: campaign, error: fetchError } = await supabase
      .from('ecp_campaigns')
      .select('custom_variables')
      .eq('id', campaignId)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Merge new variables with existing ones
    const mergedVariables = {
      ...(campaign.custom_variables || {}),
      ...custom_variables,
    }

    console.log(`[campaign/update-variables] Merged variables:`, JSON.stringify(mergedVariables, null, 2))

    // Update campaign
    const { error: updateError } = await supabase
      .from('ecp_campaigns')
      .update({ custom_variables: mergedVariables })
      .eq('id', campaignId)

    if (updateError) {
      console.error('[campaign/update-variables] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update campaign', details: updateError.message },
        { status: 500 }
      )
    }

    console.log(`[campaign/update-variables] Successfully updated campaign ${campaignId}`)

    return NextResponse.json({
      success: true,
      custom_variables: mergedVariables,
    })
  } catch (error) {
    console.error('[campaign/update-variables] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
