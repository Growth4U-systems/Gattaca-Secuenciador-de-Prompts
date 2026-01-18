import { NextRequest, NextResponse } from 'next/server'
import { NEED_WORDS, getAllNeedWords } from '@/lib/templates/niche-finder-playbook'

export const dynamic = 'force-dynamic'

type NeedCategory = 'financial' | 'operational' | 'compliance' | 'growth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as NeedCategory | 'all' | null
    const selectedCategory = category || 'all'

    // Get words based on category
    let words: string[]
    if (selectedCategory === 'all') {
      words = getAllNeedWords()
    } else if (selectedCategory in NEED_WORDS) {
      words = NEED_WORDS[selectedCategory as NeedCategory]
    } else {
      words = getAllNeedWords()
    }

    // Format as suggestion options for the UI
    const options = words.map((word, index) => ({
      id: `need-${index}`,
      label: word,
      selected: true, // Pre-select all by default
    }))

    return NextResponse.json({
      category: selectedCategory,
      needWords: NEED_WORDS,
      flat: words,
      options,
    })
  } catch (error) {
    console.error('Error getting need words:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
