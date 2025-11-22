import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Update campaign
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params
    const body = await request.json()
    const { ecp_name, problem_core, country, industry, custom_variables } = body

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Missing campaignId' },
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

    // Update campaign
    const updateData: any = {}
    if (ecp_name !== undefined) updateData.ecp_name = ecp_name
    if (problem_core !== undefined) updateData.problem_core = problem_core
    if (country !== undefined) updateData.country = country
    if (industry !== undefined) updateData.industry = industry
    if (custom_variables !== undefined) updateData.custom_variables = custom_variables

    const { data, error } = await supabase
      .from('ecp_campaigns')
      .update(updateData)
      .eq('id', campaignId)
      .select()
      .single()

    if (error) {
      console.error('Database error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      return NextResponse.json(
        {
          error: 'Failed to update campaign',
          details: error.message,
          hint: error.hint || 'Check if campaign exists',
          code: error.code
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      campaign: data,
      message: 'Campaign updated successfully',
    })
  } catch (error) {
    console.error('Update campaign error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

/**
 * Delete campaign
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Missing campaignId' },
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

    const { error } = await supabase
      .from('ecp_campaigns')
      .delete()
      .eq('id', campaignId)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete campaign', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully',
    })
  } catch (error) {
    console.error('Delete campaign error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
