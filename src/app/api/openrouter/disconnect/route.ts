import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Delete the user's OpenRouter token from our database
    const { error } = await supabase
      .from('user_openrouter_tokens')
      .delete()
      .eq('user_id', userId)

    if (error) {
      console.error('Error disconnecting OpenRouter:', error)
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'OpenRouter disconnected successfully',
    })
  } catch (error) {
    console.error('OpenRouter disconnect error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
