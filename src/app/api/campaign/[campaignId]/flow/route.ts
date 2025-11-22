import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Update campaign's flow configuration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    const body = await request.json()
    const { flowConfig } = body

    if (!flowConfig) {
      return NextResponse.json(
        { error: 'Missing flowConfig' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data, error } = await supabase
      .from('ecp_campaigns')
      .update({ flow_config: flowConfig })
      .eq('id', campaignId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update flow configuration', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      campaign: data,
      message: 'Flow configuration updated successfully',
    })
  } catch (error) {
    console.error('Update campaign flow error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Get campaign's flow configuration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data, error } = await supabase
      .from('ecp_campaigns')
      .select('flow_config')
      .eq('id', campaignId)
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to load flow configuration', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      flowConfig: data.flow_config,
    })
  } catch (error) {
    console.error('Get campaign flow error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
