import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 10

// Create admin client that bypasses auth
function getSupabaseAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * Get all playbooks
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    const { data: playbooks, error } = await supabase
      .from('playbooks')
      .select('id, name, description, playbook_type, is_public, version')
      .order('name')

    if (error) {
      console.error('Error fetching playbooks:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      playbooks: playbooks || [],
    })
  } catch (error) {
    console.error('Error in playbooks API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
