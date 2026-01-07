import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  // Use the configured site URL to avoid issues with 0.0.0.0 binding
  // Falls back to localhost:3000 if not set
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (code) {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Auth callback error:', error)
        return NextResponse.redirect(`${baseUrl}/auth/login?error=${encodeURIComponent(error.message)}`)
      }

      if (data.session) {
        // Session successfully created, redirect to home
        return NextResponse.redirect(`${baseUrl}/`)
      }
    } catch (error) {
      console.error('Auth callback exception:', error)
      return NextResponse.redirect(`${baseUrl}/auth/login?error=auth_failed`)
    }
  }

  // No code provided, redirect to login
  return NextResponse.redirect(`${baseUrl}/auth/login`)
}
