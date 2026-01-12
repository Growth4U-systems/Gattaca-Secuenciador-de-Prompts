/**
 * Apply migration using Supabase Management API
 * Run with: npx tsx scripts/apply-migration-api.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// Supabase access token from Claude Desktop config
const ACCESS_TOKEN = 'sbp_4bdb8fa9677bf9b72908ff5e2af473815c1974e9'
const PROJECT_REF = 'zgzhpnxtyidugrrmwqar'

async function runQuery(sql: string): Promise<any> {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API Error ${response.status}: ${error}`)
  }

  return response.json()
}

async function main() {
  console.log('🚀 Applying migration to Supabase...')
  console.log(`Project: ${PROJECT_REF}\n`)

  // Read migration file
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/APPLY_NOW_combined_v2.sql')
  const sql = fs.readFileSync(migrationPath, 'utf-8')

  console.log(`📄 Migration file: ${migrationPath}`)
  console.log(`📊 SQL size: ${sql.length} characters\n`)

  try {
    // Execute the migration
    console.log('Executing migration...')
    const result = await runQuery(sql)
    console.log('✅ Migration executed successfully!')
    console.log('Result:', JSON.stringify(result, null, 2))

    // Verify tables
    console.log('\n📋 Verifying tables...')
    const verifyResult = await runQuery(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'document_assignments',
        'synthesis_jobs',
        'completeness_scores',
        'foundational_schemas',
        'foundational_transformers'
      )
      ORDER BY table_name;
    `)
    console.log('Tables:', JSON.stringify(verifyResult, null, 2))

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
