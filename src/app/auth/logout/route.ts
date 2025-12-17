import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Sign out the user
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Logout error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // Create response and clear all auth cookies
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    )

    // Clear Supabase auth cookies
    const cookiesToClear = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase-auth-token',
    ]

    cookiesToClear.forEach(cookieName => {
      response.cookies.set(cookieName, '', {
        path: '/',
        maxAge: 0,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
    })

    return response
  } catch (error) {
    console.error('Logout exception:', error)
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    )
  }
}
