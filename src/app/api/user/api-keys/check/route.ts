import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'

export const dynamic = 'force-dynamic'

type ServiceName = 'apify' | 'firecrawl' | 'openrouter' | 'perplexity' | 'phantombuster' | 'linkedin_cookie' | 'serper' | 'wavespeed' | 'fal'

/**
 * Check if specific API keys are configured for the current user
 * GET /api/user/api-keys/check?services=serper,firecrawl,openrouter
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Get session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (!session || sessionError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get services from query string
  const servicesParam = request.nextUrl.searchParams.get('services')
  if (!servicesParam) {
    return NextResponse.json({ error: 'Missing services parameter' }, { status: 400 })
  }

  const services = servicesParam.split(',').map(s => s.trim()) as ServiceName[]
  const results: Record<string, { configured: boolean; source?: 'user' | 'env' }> = {}

  for (const service of services) {
    try {
      const apiKey = await getUserApiKey({
        userId: session.user.id,
        serviceName: service,
        supabase,
      })

      results[service] = {
        configured: !!apiKey,
        source: apiKey ? (apiKey.startsWith('sk-') || apiKey.includes('_') ? 'user' : 'env') : undefined,
      }
    } catch {
      results[service] = { configured: false }
    }
  }

  // Find missing services
  const missing = services.filter(s => !results[s]?.configured)

  return NextResponse.json({
    results,
    allConfigured: missing.length === 0,
    missing,
  })
}
