import { NextRequest, NextResponse } from 'next/server'
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
 * Get all clients
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, slug, status, agency_id')
      .order('name', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch clients', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      clients,
    })
  } catch (error) {
    console.error('Get clients error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Create a new client
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Client name is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Get the default agency (first one, or create if none exists)
    let { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id')
      .limit(1)
      .single()

    if (agencyError || !agency) {
      // Create default agency if none exists
      const { data: newAgency, error: createAgencyError } = await supabase
        .from('agencies')
        .insert({
          name: 'Default Agency',
          slug: 'default-agency',
        })
        .select('id')
        .single()

      if (createAgencyError) {
        console.error('Failed to create default agency:', createAgencyError)
        return NextResponse.json(
          { error: 'Failed to create default agency', details: createAgencyError.message },
          { status: 500 }
        )
      }

      agency = newAgency
    }

    // Generate slug from name
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Date.now().toString(36)

    // Create the client
    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        name: name.trim(),
        slug,
        agency_id: agency.id,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create client', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      client,
    })
  } catch (error) {
    console.error('Create client error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
