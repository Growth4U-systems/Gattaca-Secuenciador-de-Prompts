import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import type {
  FoundationalType,
  SynthesisRequest,
  SynthesisResult,
  PreSynthesisCheck,
  DocumentTier,
} from '@/types/v2.types'
import { getOpenRouterKey, invalidateOpenRouterKey } from '@/lib/openrouter'

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

/**
 * Calculate a hash of source documents for change detection
 */
function calculateSourceHash(sources: { id: string; content: string | null; updated_at: string }[]): string {
  const sorted = [...sources].sort((a, b) => a.id.localeCompare(b.id))
  const data = sorted.map(s => `${s.id}:${s.updated_at}:${(s.content || '').slice(0, 100)}`).join('|')
  return createHash('sha256').update(data).digest('hex').slice(0, 16)
}

/**
 * Get synthesis prompt for a foundational type
 */
async function getSynthesisPrompt(
  supabase: ReturnType<typeof getSupabaseClient>,
  foundationalType: FoundationalType
): Promise<string | null> {
  const { data } = await supabase
    .from('foundational_schemas')
    .select('synthesis_prompt')
    .eq('foundational_type', foundationalType)
    .single()

  return data?.synthesis_prompt || null
}

/**
 * Get validation prompt for completeness check
 */
async function getValidationPrompt(
  supabase: ReturnType<typeof getSupabaseClient>,
  foundationalType: FoundationalType
): Promise<string | null> {
  const { data } = await supabase
    .from('foundational_schemas')
    .select('validation_prompt')
    .eq('foundational_type', foundationalType)
    .single()

  return data?.validation_prompt || null
}

/**
 * Call OpenRouter API
 * Uses user's API key if available, falls back to server key
 */
async function callAI(
  systemPrompt: string,
  userPrompt: string,
  model: string = 'anthropic/claude-sonnet-4',
  userId?: string
): Promise<{ content: string; tokens: { input: number; output: number }; keySource: 'user' | 'agency' | 'server' }> {
  // Get API key (user's key first, then agency, then server)
  const { key, source } = await getOpenRouterKey(userId)

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://gattaca.app',
      'X-Title': 'Gattaca Document Synthesis',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 8000,
    }),
  })

  if (!response.ok) {
    const error = await response.text()

    // If auth error and using user's key, mark it as invalid
    if (response.status === 401 || response.status === 402 || response.status === 403) {
      if (source === 'user' && userId) {
        await invalidateOpenRouterKey(userId)
      }
    }

    throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokens: {
      input: data.usage?.prompt_tokens || 0,
      output: data.usage?.completion_tokens || 0,
    },
    keySource: source,
  }
}

/**
 * POST /api/v2/synthesis
 * Trigger synthesis for a foundational type
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json() as SynthesisRequest
    const { clientId, foundationalType, force = false, userId } = body

    if (!clientId || !foundationalType) {
      return NextResponse.json(
        { error: 'clientId and foundationalType are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // 1. Get all assigned source documents
    const { data: assignments, error: assignError } = await supabase
      .from('document_assignments')
      .select(`
        source_document_id,
        weight,
        display_order,
        source_document:documents(
          id, title, content, content_format, updated_at
        )
      `)
      .eq('client_id', clientId)
      .eq('target_foundational_type', foundationalType)
      .order('display_order', { ascending: true })

    if (assignError) {
      console.error('Error fetching assignments:', assignError)
      return NextResponse.json(
        { error: 'Failed to fetch assignments', details: assignError.message },
        { status: 500 }
      )
    }

    if (!assignments || assignments.length === 0) {
      return NextResponse.json(
        { error: 'No documents assigned to this foundational type' },
        { status: 400 }
      )
    }

    // Extract source documents
    // Note: Supabase returns relations as objects (single) or arrays (multiple)
    const sources = assignments
      .filter(a => a.source_document)
      .map(a => {
        // Handle both array and object forms of the relation
        const doc = Array.isArray(a.source_document)
          ? a.source_document[0]
          : a.source_document
        return {
          id: doc.id,
          title: doc.title,
          content: doc.content || '',
          updated_at: doc.updated_at,
          weight: a.weight,
        }
      })
      .filter(s => s.id) // Filter out any nulls

    if (sources.length === 0) {
      return NextResponse.json(
        { error: 'No valid source documents found' },
        { status: 400 }
      )
    }

    // 2. Calculate content hash
    const sourceHash = calculateSourceHash(sources)

    // 3. Check if synthesis needed (unless forced)
    if (!force) {
      const { data: existingJob } = await supabase
        .from('synthesis_jobs')
        .select('id, synthesized_document_id, status')
        .eq('client_id', clientId)
        .eq('foundational_type', foundationalType)
        .eq('source_hash', sourceHash)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()

      if (existingJob?.synthesized_document_id) {
        return NextResponse.json({
          success: true,
          documentId: existingJob.synthesized_document_id,
          jobId: existingJob.id,
          cached: true,
          message: 'Using existing synthesis (sources unchanged)',
        } as SynthesisResult)
      }
    }

    // 4. Get synthesis prompt
    const synthesisPrompt = await getSynthesisPrompt(supabase, foundationalType)
    if (!synthesisPrompt) {
      return NextResponse.json(
        { error: `No synthesis prompt configured for ${foundationalType}` },
        { status: 500 }
      )
    }

    // 5. Create synthesis job
    const sourceDocIds = sources.map(s => s.id)
    const { data: job, error: jobError } = await supabase
      .from('synthesis_jobs')
      .insert({
        client_id: clientId,
        foundational_type: foundationalType,
        source_document_ids: sourceDocIds,
        source_hash: sourceHash,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (jobError) {
      console.error('Error creating synthesis job:', jobError)
      return NextResponse.json(
        { error: 'Failed to create synthesis job', details: jobError.message },
        { status: 500 }
      )
    }

    // 6. Build prompt with sources
    const sourcesText = sources
      .map((s, i) => `### Fuente ${i + 1}: ${s.title} (Peso: ${s.weight})\n${s.content}\n`)
      .join('\n---\n\n')

    const userPrompt = synthesisPrompt.replace('{{sources}}', sourcesText)

    // 7. Call AI for synthesis
    let synthesizedContent: string
    let tokens: { input: number; output: number }

    let keySource: 'user' | 'agency' | 'server' = 'server'
    try {
      const result = await callAI(
        'Eres un experto en síntesis de documentos empresariales. Tu tarea es crear documentos unificados y coherentes a partir de múltiples fuentes.',
        userPrompt,
        'anthropic/claude-sonnet-4',
        userId
      )
      synthesizedContent = result.content
      tokens = result.tokens
      keySource = result.keySource
    } catch (aiError) {
      // Update job with error
      await supabase
        .from('synthesis_jobs')
        .update({
          status: 'failed',
          error_message: aiError instanceof Error ? aiError.message : 'AI call failed',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
        })
        .eq('id', job.id)

      throw aiError
    }

    // 8. Get tier for this foundational type
    const { data: schema } = await supabase
      .from('foundational_schemas')
      .select('tier')
      .eq('foundational_type', foundationalType)
      .single()

    const tier = (schema?.tier || 1) as DocumentTier

    // 9. Create or update synthesized document
    const docTitle = `${foundationalType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} (Sintetizado)`

    // Check if synthesized doc already exists
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('client_id', clientId)
      .eq('document_type', foundationalType)
      .eq('is_compiled_foundational', true)
      .limit(1)
      .single()

    let documentId: string

    if (existingDoc) {
      // Update existing
      const { data: updated, error: updateError } = await supabase
        .from('documents')
        .update({
          content: synthesizedContent,
          source_type: 'synthesized',
          synthesis_job_id: job.id,
          requires_review: true, // Requires HITL approval
          approval_status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDoc.id)
        .select('id')
        .single()

      if (updateError) {
        throw new Error(`Failed to update document: ${updateError.message}`)
      }
      documentId = updated!.id
    } else {
      // Create new
      const slug = `${foundationalType}-synthesized-${Date.now()}`
      const { data: created, error: createError } = await supabase
        .from('documents')
        .insert({
          client_id: clientId,
          title: docTitle,
          slug,
          tier,
          document_type: foundationalType,
          content: synthesizedContent,
          content_format: 'markdown',
          source_type: 'synthesized',
          synthesis_job_id: job.id,
          is_compiled_foundational: true,
          requires_review: true, // Requires HITL approval
          approval_status: 'draft',
        })
        .select('id')
        .single()

      if (createError) {
        throw new Error(`Failed to create document: ${createError.message}`)
      }
      documentId = created!.id
    }

    // 10. Update job with success
    const durationMs = Date.now() - startTime
    await supabase
      .from('synthesis_jobs')
      .update({
        status: 'completed',
        synthesized_document_id: documentId,
        model_used: 'anthropic/claude-sonnet-4',
        tokens_used: { ...tokens, total: tokens.input + tokens.output },
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
      })
      .eq('id', job.id)

    // 11. Trigger completeness evaluation (async, don't wait)
    fetch(`${request.nextUrl.origin}/api/v2/synthesis/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, foundationalType }),
    }).catch(err => console.error('Failed to trigger validation:', err))

    return NextResponse.json({
      success: true,
      documentId,
      jobId: job.id,
      tokensUsed: { ...tokens, total: tokens.input + tokens.output },
      durationMs,
      requiresReview: true,
      keySource,
      message: `Synthesis completed using ${keySource === 'user' ? 'your API key' : keySource === 'agency' ? 'agency API key' : 'server API key'}. Document requires review before approval.`,
    } as SynthesisResult)
  } catch (err) {
    console.error('Unexpected error in POST /api/v2/synthesis:', err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      } as SynthesisResult,
      { status: 500 }
    )
  }
}

/**
 * GET /api/v2/synthesis
 * Get synthesis status for a foundational type
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const foundationalType = searchParams.get('foundationalType') as FoundationalType | null

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Base query - use explicit relationship name due to multiple FK relationships
    let query = supabase
      .from('synthesis_jobs')
      .select(`
        *,
        synthesized_document:documents!synthesis_jobs_synthesized_document_id_fkey(
          id, title, content, approval_status, completeness_score,
          requires_review, reviewed_at, token_count, updated_at
        )
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (foundationalType) {
      query = query.eq('foundational_type', foundationalType).limit(1)
    } else {
      query = query.limit(10)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching synthesis status:', error)
      return NextResponse.json(
        { error: 'Failed to fetch synthesis status', details: error.message },
        { status: 500 }
      )
    }

    // If checking a specific type, also check if resynthesis is needed
    if (foundationalType && data && data.length > 0) {
      const latestJob = data[0]

      // Get current source hash
      const { data: assignments } = await supabase
        .from('document_assignments')
        .select('source_document:documents(id, updated_at)')
        .eq('client_id', clientId)
        .eq('target_foundational_type', foundationalType)

      if (assignments && assignments.length > 0) {
        const sources = assignments
          .filter(a => a.source_document)
          .map(a => {
            const doc = Array.isArray(a.source_document)
              ? a.source_document[0]
              : a.source_document
            return {
              id: doc?.id,
              content: null as string | null,
              updated_at: doc?.updated_at,
            }
          })
          .filter(s => s.id)

        const currentHash = calculateSourceHash(sources)
        const needsResynthesis = currentHash !== latestJob.source_hash

        return NextResponse.json({
          latestJob: data[0],
          needsResynthesis,
          sourceCount: sources.length,
        })
      }
    }

    return NextResponse.json({
      jobs: data || [],
    })
  } catch (err) {
    console.error('Unexpected error in GET /api/v2/synthesis:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
