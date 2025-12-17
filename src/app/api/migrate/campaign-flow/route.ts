import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Run migration to add flow_config to campaigns
 * This is a one-time migration endpoint
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Step 1: Add flow_config column
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE ecp_campaigns ADD COLUMN IF NOT EXISTS flow_config JSONB DEFAULT NULL'
    })

    if (alterError) {
      console.error('Error adding column:', alterError)
      // Try alternative approach using raw query
      const { error: directError } = await supabase
        .from('ecp_campaigns')
        .select('flow_config')
        .limit(1)

      if (directError && directError.message.includes('column "flow_config" does not exist')) {
        return NextResponse.json({
          error: 'Migration needs to be run manually',
          instructions: [
            'Go to your Supabase Dashboard',
            'Navigate to SQL Editor',
            'Run the following SQL:',
            'ALTER TABLE ecp_campaigns ADD COLUMN IF NOT EXISTS flow_config JSONB DEFAULT NULL;',
            'CREATE INDEX IF NOT EXISTS idx_campaigns_flow_config ON ecp_campaigns USING GIN (flow_config);'
          ],
          sql: `
-- Add flow_config column to campaigns
ALTER TABLE ecp_campaigns ADD COLUMN IF NOT EXISTS flow_config JSONB DEFAULT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_flow_config ON ecp_campaigns USING GIN (flow_config);

-- Add comment
COMMENT ON COLUMN ecp_campaigns.flow_config IS 'Campaign-specific flow configuration. When set, overrides the project''s default flow_config.';
          `.trim()
        }, { status: 500 })
      }
    }

    // Step 2: Create index (if column already exists or was just added)
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_campaigns_flow_config ON ecp_campaigns USING GIN (flow_config)'
    })

    // Index creation might fail if RPC doesn't exist, but that's okay

    // Verify the column exists
    const { data, error: verifyError } = await supabase
      .from('ecp_campaigns')
      .select('id, flow_config')
      .limit(1)

    if (verifyError) {
      return NextResponse.json({
        error: 'Migration verification failed',
        details: verifyError.message,
        hint: 'The column might not have been created. Please run the migration manually in Supabase Dashboard SQL Editor.',
        sql: `
ALTER TABLE ecp_campaigns ADD COLUMN IF NOT EXISTS flow_config JSONB DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_flow_config ON ecp_campaigns USING GIN (flow_config);
        `.trim()
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully! The flow_config column has been added to campaigns.',
      verified: true
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      instructions: [
        'Please run this SQL manually in your Supabase Dashboard > SQL Editor:',
        '',
        'ALTER TABLE ecp_campaigns ADD COLUMN IF NOT EXISTS flow_config JSONB DEFAULT NULL;',
        'CREATE INDEX IF NOT EXISTS idx_campaigns_flow_config ON ecp_campaigns USING GIN (flow_config);'
      ]
    }, { status: 500 })
  }
}
