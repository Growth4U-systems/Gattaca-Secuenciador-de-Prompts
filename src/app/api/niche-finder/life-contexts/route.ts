import { NextRequest, NextResponse } from 'next/server'
import { LIFE_CONTEXTS, getLifeContexts } from '@/lib/templates/niche-finder-playbook'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'personal' | 'business' | 'both' | null
    const contextType = type || 'both'

    // Get contexts based on type
    const contexts = getLifeContexts(contextType)

    // Format as suggestion options for the UI
    const options = contexts.map((context, index) => ({
      id: `context-${index}`,
      label: context,
      selected: true, // Pre-select all by default
    }))

    return NextResponse.json({
      type: contextType,
      contexts: LIFE_CONTEXTS,
      flat: contexts,
      options,
    })
  } catch (error) {
    console.error('Error getting life contexts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
