import { NextRequest, NextResponse } from 'next/server'
import { SPANISH_INDICATORS } from '@/lib/templates/niche-finder-playbook'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const language = searchParams.get('language') || 'es'

    // For now, only Spanish is supported
    if (language !== 'es') {
      return NextResponse.json({
        language,
        indicators: {},
        message: 'Only Spanish (es) indicators are currently available',
      })
    }

    return NextResponse.json({
      language: 'es',
      indicators: SPANISH_INDICATORS,
      flat: Object.values(SPANISH_INDICATORS).flat(),
    })
  } catch (error) {
    console.error('Error getting indicators:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
