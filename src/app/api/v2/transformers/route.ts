import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { FoundationalType, FoundationalTransformer } from '@/types/v2.types'

export const runtime = 'nodejs'

function getSupabaseClient() {
  return createClient(
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
 * GET /api/v2/transformers
 * List all transformers for an agency, or get default schemas
 *
 * Query params:
 * - agencyId (optional): Agency UUID to get custom transformers
 * If no agencyId, returns default foundational schemas
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agencyId = searchParams.get('agencyId')
    const foundationalType = searchParams.get('foundationalType') as FoundationalType | null

    const supabase = getSupabaseClient()

    if (agencyId) {
      // Get custom transformers for agency
      let query = supabase
        .from('foundational_transformers')
        .select('*')
        .eq('agency_id', agencyId)

      if (foundationalType) {
        query = query.eq('foundational_type', foundationalType)
      }

      const { data, error } = await query.order('foundational_type')

      if (error) {
        console.error('Error fetching transformers:', error)
        return NextResponse.json(
          { error: 'Failed to fetch transformers', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        transformers: data || [],
        isCustom: true,
      })
    }

    // Get default schemas (fallback when no custom transformers)
    let schemaQuery = supabase
      .from('foundational_schemas')
      .select('*')

    if (foundationalType) {
      schemaQuery = schemaQuery.eq('foundational_type', foundationalType)
    }

    const { data: schemas, error: schemaError } = await schemaQuery.order('tier').order('foundational_type')

    if (schemaError) {
      console.error('Error fetching schemas:', schemaError)
      return NextResponse.json(
        { error: 'Failed to fetch schemas', details: schemaError.message },
        { status: 500 }
      )
    }

    // Map schemas to transformer-like format
    const transformers = (schemas || []).map(schema => ({
      id: schema.id,
      foundational_type: schema.foundational_type,
      name: schema.foundational_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      description: null,
      prompt: schema.synthesis_prompt,
      validation_prompt: schema.validation_prompt,
      model: 'anthropic/claude-sonnet-4',
      temperature: 0.3,
      max_tokens: 8000,
      tier: schema.tier,
      priority: schema.priority,
      required_sections: schema.required_sections,
      optional_sections: schema.optional_sections,
      created_at: schema.created_at,
      updated_at: schema.updated_at,
    }))

    return NextResponse.json({
      transformers,
      isCustom: false,
    })
  } catch (err) {
    console.error('Unexpected error in GET /api/v2/transformers:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v2/transformers
 * Create a custom transformer for an agency
 *
 * Body:
 * - agencyId: Agency UUID
 * - foundationalType: Type of foundational document
 * - prompt: The transformer prompt
 * - model (optional): Model to use
 * - temperature (optional): Temperature setting
 * - maxTokens (optional): Max tokens
 * - name (optional): Display name
 * - description (optional): Description
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      agencyId,
      foundationalType,
      prompt,
      model = 'anthropic/claude-sonnet-4',
      temperature = 0.3,
      maxTokens = 8000,
      name = null,
      description = null,
    } = body

    if (!agencyId || !foundationalType || !prompt) {
      return NextResponse.json(
        { error: 'agencyId, foundationalType, and prompt are required' },
        { status: 400 }
      )
    }

    // Validate foundational type
    const validTypes: FoundationalType[] = [
      'brand_dna', 'icp', 'tone_of_voice',
      'product_docs', 'pricing', 'competitor_analysis'
    ]
    if (!validTypes.includes(foundationalType)) {
      return NextResponse.json(
        { error: `Invalid foundational type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    const { data: transformer, error } = await supabase
      .from('foundational_transformers')
      .upsert({
        agency_id: agencyId,
        foundational_type: foundationalType,
        prompt,
        model,
        temperature,
        max_tokens: maxTokens,
        name,
        description,
      }, {
        onConflict: 'agency_id,foundational_type',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating transformer:', error)
      return NextResponse.json(
        { error: 'Failed to create transformer', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      transformer,
      message: `Transformer for ${foundationalType} created/updated`,
    }, { status: 201 })
  } catch (err) {
    console.error('Unexpected error in POST /api/v2/transformers:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
