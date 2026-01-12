import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type {
  ValidateCompletenessRequest,
  ValidateCompletenessResult,
  SectionScore,
} from '@/types/v2.types'

export const runtime = 'nodejs'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

/**
 * Call OpenRouter API for validation
 */
async function callAI(
  systemPrompt: string,
  userPrompt: string,
  model: string = 'anthropic/claude-haiku-4'
): Promise<{ content: string; tokens: { input: number; output: number } }> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://gattaca.app',
      'X-Title': 'Gattaca Document Validation',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokens: {
      input: data.usage?.prompt_tokens || 0,
      output: data.usage?.completion_tokens || 0,
    },
  }
}

/**
 * POST /api/v2/synthesis/validate
 * Validate completeness of a synthesized document
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ValidateCompletenessRequest
    const { documentId, foundationalType } = body

    if (!documentId || !foundationalType) {
      return NextResponse.json(
        { error: 'documentId and foundationalType are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // 1. Get document content
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, content, client_id')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    if (!document.content) {
      return NextResponse.json(
        { error: 'Document has no content' },
        { status: 400 }
      )
    }

    // 2. Get validation prompt from schema
    const { data: schema, error: schemaError } = await supabase
      .from('foundational_schemas')
      .select('validation_prompt, required_sections')
      .eq('foundational_type', foundationalType)
      .single()

    if (schemaError || !schema?.validation_prompt) {
      return NextResponse.json(
        { error: `No validation schema for ${foundationalType}` },
        { status: 500 }
      )
    }

    // 3. Build validation prompt
    const userPrompt = schema.validation_prompt.replace('{{content}}', document.content)

    // 4. Call AI for validation
    const result = await callAI(
      'Eres un experto evaluador de documentos empresariales. Evalúa la completitud y calidad de documentos estratégicos. Responde SOLO con JSON válido.',
      userPrompt,
      'anthropic/claude-haiku-4' // Use cheaper model for validation
    )

    // 5. Parse AI response
    let evaluation: {
      overall_score: number
      sections: Record<string, SectionScore>
      missing: string[]
      suggestions: string[]
    }

    try {
      evaluation = JSON.parse(result.content)
    } catch {
      console.error('Failed to parse validation response:', result.content)
      return NextResponse.json(
        { error: 'Failed to parse validation response' },
        { status: 500 }
      )
    }

    // 6. Save completeness score
    const { error: scoreError } = await supabase
      .from('completeness_scores')
      .upsert({
        document_id: documentId,
        overall_score: evaluation.overall_score,
        section_scores: evaluation.sections,
        missing_sections: evaluation.missing || [],
        suggestions: evaluation.suggestions || [],
        evaluated_at: new Date().toISOString(),
        model_used: 'anthropic/claude-haiku-4',
        evaluation_version: '1.0',
      }, {
        onConflict: 'document_id',
      })

    if (scoreError) {
      console.error('Error saving completeness score:', scoreError)
      // Don't fail - the document was still validated
    }

    // 7. Update document with score (trigger will also do this, but be explicit)
    await supabase
      .from('documents')
      .update({ completeness_score: evaluation.overall_score })
      .eq('id', documentId)

    return NextResponse.json({
      overallScore: evaluation.overall_score,
      sections: evaluation.sections,
      missingSections: evaluation.missing || [],
      suggestions: evaluation.suggestions || [],
      tokensUsed: result.tokens,
    } as ValidateCompletenessResult)
  } catch (err) {
    console.error('Unexpected error in POST /api/v2/synthesis/validate:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v2/synthesis/validate
 * Get completeness score for a document
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('completeness_scores')
      .select('*')
      .eq('document_id', documentId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'No completeness score found for this document' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      overallScore: data.overall_score,
      sections: data.section_scores,
      missingSections: data.missing_sections,
      suggestions: data.suggestions,
      evaluatedAt: data.evaluated_at,
    })
  } catch (err) {
    console.error('Unexpected error in GET /api/v2/synthesis/validate:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
