/**
 * Script to apply database migrations to Supabase Cloud
 * Run with: npx tsx scripts/apply-migrations.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '')
      process.env[key.trim()] = value.trim()
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// List of migrations to apply in order
const MIGRATIONS = [
  '20250128000001_document_assignments.sql',
  '20250113000001_transformers.sql',
]

async function checkTableExists(tableName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(tableName)
    .select('id')
    .limit(1)

  // If we get a "relation does not exist" error, table doesn't exist
  if (error && error.message.includes('does not exist')) {
    return false
  }

  return true
}

async function executeSqlStatement(sql: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Use rpc to execute raw SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

async function applyMigration(filename: string): Promise<void> {
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', filename)

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`)
    return
  }

  console.log(`\n📜 Applying migration: ${filename}`)

  const sql = fs.readFileSync(migrationPath, 'utf-8')

  // Split into statements (basic split, may need refinement for complex SQL)
  // For now, we'll try to execute the whole migration
  console.log(`   SQL length: ${sql.length} characters`)

  // Since we can't execute raw SQL directly via the client,
  // we need to check if tables exist and provide manual instructions
  console.log(`\n⚠️  Supabase client API doesn't support raw SQL execution.`)
  console.log(`   Please apply this migration manually:\n`)
  console.log(`   1. Go to https://supabase.com/dashboard/project/zgzhpnxtyidugrrmwqar/sql`)
  console.log(`   2. Paste the contents of: ${migrationPath}`)
  console.log(`   3. Click "Run"\n`)
}

async function checkCurrentState(): Promise<void> {
  console.log('\n🔍 Checking current database state...\n')

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

  for (const table of tables) {
    const exists = await checkTableExists(table)
    const status = exists ? '✅' : '❌'
    console.log(`  ${status} ${table}`)
  }
}

async function main() {
  console.log('🚀 Gattaca Database Migration Tool')
  console.log('===================================')
  console.log(`Supabase URL: ${SUPABASE_URL}`)

  // Check current state
  await checkCurrentState()

  console.log('\n📋 Migrations to apply:')
  for (const migration of MIGRATIONS) {
    console.log(`   - ${migration}`)
  }

  // Instructions for manual application
  console.log('\n' + '='.repeat(60))
  console.log('MANUAL MIGRATION INSTRUCTIONS')
  console.log('='.repeat(60))
  console.log(`
Since Supabase client doesn't support direct SQL execution,
please apply the migrations manually:

1. Go to your Supabase Dashboard:
   https://supabase.com/dashboard/project/zgzhpnxtyidugrrmwqar/sql

2. For each migration file, copy the contents and execute:
`)

  for (const migration of MIGRATIONS) {
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migration)
    console.log(`   📄 ${migration}`)
    console.log(`      Path: ${migrationPath}\n`)
  }

  console.log(`
3. After applying all migrations, run this script again
   to verify the tables were created successfully.

Tip: You can also use the Supabase CLI with:
   supabase db push --linked
`)
}

main().catch(console.error)
