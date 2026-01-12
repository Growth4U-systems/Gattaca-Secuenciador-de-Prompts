import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 120

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
 * POST /api/admin/apply-migration
 * Apply a SQL migration to the database
 *
 * WARNING: This endpoint is for development only!
 * Should be removed or protected in production.
 */
export async function POST(request: NextRequest) {
  try {
    const { sql, checkOnly } = await request.json()

    if (!sql && !checkOnly) {
      return NextResponse.json({ error: 'sql is required' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // Check which tables exist
    if (checkOnly) {
      const tables = [
        'document_assignments',
        'synthesis_jobs',
        'completeness_scores',
        'foundational_schemas',
        'foundational_transformers',
      ]

      const results: Record<string, boolean> = {}

      for (const table of tables) {
        try {
          const { error } = await supabase.from(table).select('id').limit(1)
          results[table] = !error || !error.message.includes('does not exist')
        } catch {
          results[table] = false
        }
      }

      return NextResponse.json({ tables: results })
    }

    // Execute SQL using pg protocol
    // Note: This requires a direct database connection
    // For now, we'll return instructions
    return NextResponse.json({
      message: 'Direct SQL execution not available via REST API',
      instructions: 'Please use Supabase SQL Editor to apply migrations',
      url: 'https://supabase.com/dashboard/project/zgzhpnxtyidugrrmwqar/sql',
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/apply-migration
 * Check table existence
 */
export async function GET() {
  const supabase = getSupabaseClient()

  const tables = [
    'agencies',
    'clients',
    'documents',
    'document_assignments',
    'synthesis_jobs',
    'completeness_scores',
    'foundational_schemas',
    'foundational_transformers',
    'playbooks',
    'playbook_executions',
  ]

  const results: Record<string, { exists: boolean; error?: string }> = {}

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1)

      if (error) {
        if (error.message.includes('does not exist') || error.code === 'PGRST205') {
          results[table] = { exists: false, error: 'Table not found' }
        } else {
          results[table] = { exists: true } // Table exists but may have other errors (like RLS)
        }
      } else {
        results[table] = { exists: true }
      }
    } catch (e) {
      results[table] = { exists: false, error: String(e) }
    }
  }

  const missing = Object.entries(results)
    .filter(([_, v]) => !v.exists)
    .map(([k]) => k)

  return NextResponse.json({
    tables: results,
    missing,
    allExist: missing.length === 0,
  })
}
