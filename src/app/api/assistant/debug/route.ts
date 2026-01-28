import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@/lib/supabase-server-admin'
import { getUserApiKey } from '@/lib/getUserApiKey'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const adminClient = createAdminClient()

  // Get session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (!session || sessionError) {
    return NextResponse.json({
      authenticated: false,
      error: sessionError?.message,
    })
  }

  // Get API key info
  const apiKey = await getUserApiKey({
    userId: session.user.id,
    serviceName: 'openrouter',
    supabase: adminClient,
  })

  // Check if there's a user key in the database
  const { data: userKey, error: userKeyError } = await adminClient
    .from('user_api_keys')
    .select('id, service_name, is_active, created_at')
    .eq('user_id', session.user.id)
    .eq('service_name', 'openrouter')

  return NextResponse.json({
    authenticated: true,
    userId: session.user.id,
    userEmail: session.user.email,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyPrefix: apiKey?.substring(0, 15) || 'none',
    userKeyInDb: userKey || [],
    userKeyError: userKeyError?.message,
    envKeyAvailable: !!process.env.OPENROUTER_API_KEY,
    envKeyPrefix: process.env.OPENROUTER_API_KEY?.substring(0, 15) || 'none',
  })
}
