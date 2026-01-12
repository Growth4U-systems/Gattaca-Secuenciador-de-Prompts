import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type {
  FoundationalType,
  TransformerExecuteRequest,
  TransformerExecuteResult,
} from '@/types/v2.types'

export const runtime = 'nodejs'
export const maxDuration = 120 // 2 minutes for AI calls

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
 * Call OpenRouter API
 */
async function callAI(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number,
  maxTokens: number
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
      'X-Title': 'Gattaca Transformer',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
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
 * Calculate hash of source documents for change detection
 */
function calculateSourceHash(documents: { id: string; updated_at: string }[]): string {
  const sortedIds = documents
    .map(d => `${d.id}|${d.updated_at}`)
    .sort()
    .join('||')

  // Simple hash for browser compatibility
  let hash = 0
  for (let i = 0; i < sortedIds.length; i++) {
    const char = sortedIds.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

/**
 * POST /api/v2/transformers/execute
 * Execute a transformer to generate a foundational document
 *
 * Body:
 * - clientId: Client UUID
 * - foundationalType: Type of foundational document to generate
 * - sourceDocumentIds (optional): Specific document IDs to use (defaults to all assigned)
 * - force (optional): Regenerate even if no changes detected
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TransformerExecuteRequest
    const { clientId, foundationalType, sourceDocumentIds, force = false } = body

    if (!clientId || !foundationalType) {
      return NextResponse.json(
        { error: 'clientId and foundationalType are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // 1. Get client and agency
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, agency_id, name')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    // 2. Get assigned source documents
    let sourceDocsQuery = supabase
      .from('document_assignments')
      .select(`
        source_document_id,
        weight,
        display_order,
        source_document:documents(
          id, title, content, updated_at
        )
      `)
      .eq('client_id', clientId)
      .eq('target_foundational_type', foundationalType)
      .order('display_order')

    const { data: assignments, error: assignmentError } = await sourceDocsQuery

    if (assignmentError) {
      console.error('Error fetching assignments:', assignmentError)
      return NextResponse.json(
        { error: 'Failed to fetch assignments' },
        { status: 500 }
      )
    }

    if (!assignments || assignments.length === 0) {
      return NextResponse.json(
        { error: 'No documents assigned to this foundational type' },
        { status: 400 }
      )
    }

    // Filter to specific document IDs if provided
    let effectiveAssignments = assignments
    if (sourceDocumentIds && sourceDocumentIds.length > 0) {
      effectiveAssignments = assignments.filter(a =>
        sourceDocumentIds.includes(a.source_document_id)
      )
    }

    // Extract documents
    const sourceDocs = effectiveAssignments
      .map(a => a.source_document as any)
      .filter(d => d && d.content)

    if (sourceDocs.length === 0) {
      return NextResponse.json(
        { error: 'No documents with content found' },
        { status: 400 }
      )
    }

    // 3. Calculate source hash for change detection
    const sourceHash = calculateSourceHash(sourceDocs)

    // 4. Check if we need to regenerate
    if (!force) {
      const { data: existingDoc } = await supabase
        .from('documents')
        .select('id, sources_hash, approval_status')
        .eq('client_id', clientId)
        .eq('document_type', foundationalType)
        .eq('is_compiled_foundational', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existingDoc && existingDoc.sources_hash === sourceHash) {
        return NextResponse.json({
          success: true,
          documentId: existingDoc.id,
          status: existingDoc.approval_status === 'approved' ? 'approved' : 'pending_review',
          message: 'No changes detected, returning existing document',
          skipped: true,
        } as TransformerExecuteResult & { message: string; skipped: boolean })
      }
    }

    // 5. Get transformer config (custom or default)
    let transformer: {
      prompt: string
      model: string
      temperature: number
      max_tokens: number
    }

    // Try custom transformer first
    const { data: customTransformer } = await supabase
      .from('foundational_transformers')
      .select('prompt, model, temperature, max_tokens')
      .eq('agency_id', client.agency_id)
      .eq('foundational_type', foundationalType)
      .single()

    if (customTransformer) {
      transformer = customTransformer
    } else {
      // Fall back to default schema
      const { data: schema } = await supabase
        .from('foundational_schemas')
        .select('synthesis_prompt')
        .eq('foundational_type', foundationalType)
        .single()

      if (!schema?.synthesis_prompt) {
        return NextResponse.json(
          { error: `No transformer or schema found for ${foundationalType}` },
          { status: 500 }
        )
      }

      transformer = {
        prompt: schema.synthesis_prompt,
        model: 'anthropic/claude-sonnet-4',
        temperature: 0.3,
        max_tokens: 8000,
      }
    }

    // 6. Build the prompt with source documents
    const sourcesText = sourceDocs
      .map((d, i) => `### Documento ${i + 1}: ${d.title}\n${d.content}`)
      .join('\n\n---\n\n')

    const userPrompt = transformer.prompt.replace('{{sources}}', sourcesText)

    // 7. Create synthesis job record
    const { data: job, error: jobError } = await supabase
      .from('synthesis_jobs')
      .insert({
        client_id: clientId,
        foundational_type: foundationalType,
        status: 'running',
        source_document_ids: sourceDocs.map(d => d.id),
        source_hash: sourceHash,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (jobError) {
      // If duplicate hash, find existing job
      if (jobError.code === '23505') {
        const { data: existingJob } = await supabase
          .from('synthesis_jobs')
          .select('id, synthesized_document_id, status')
          .eq('client_id', clientId)
          .eq('foundational_type', foundationalType)
          .eq('source_hash', sourceHash)
          .single()

        if (existingJob?.synthesized_document_id) {
          return NextResponse.json({
            success: true,
            documentId: existingJob.synthesized_document_id,
            status: 'pending_review',
            message: 'Document already exists for this source configuration',
          })
        }
      }

      console.error('Error creating synthesis job:', jobError)
      return NextResponse.json(
        { error: 'Failed to create synthesis job' },
        { status: 500 }
      )
    }

    // 8. Call the AI
    const startTime = Date.now()
    let result: { content: string; tokens: { input: number; output: number } }

    try {
      result = await callAI(
        'Eres un experto en análisis y síntesis de documentos de marketing y branding. Tu tarea es crear documentos fundacionales de alta calidad basados en los documentos fuente proporcionados.',
        userPrompt,
        transformer.model,
        transformer.temperature,
        transformer.max_tokens
      )
    } catch (aiError: any) {
      // Update job with error
      await supabase
        .from('synthesis_jobs')
        .update({
          status: 'failed',
          error_message: aiError.message,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
        })
        .eq('id', job.id)

      throw aiError
    }

    const durationMs = Date.now() - startTime

    // 9. Get previous version if exists
    const { data: previousDoc } = await supabase
      .from('documents')
      .select('id, version')
      .eq('client_id', clientId)
      .eq('document_type', foundationalType)
      .eq('is_compiled_foundational', true)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const newVersion = (previousDoc?.version || 0) + 1

    // 10. Create the synthesized document
    const documentTitle = `${foundationalType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - ${client.name}`

    const { data: newDoc, error: docError } = await supabase
      .from('documents')
      .insert({
        client_id: clientId,
        title: documentTitle,
        slug: `${foundationalType}-v${newVersion}-${Date.now()}`,
        tier: foundationalType === 'competitor_analysis' ? 2 : 1,
        document_type: foundationalType,
        content: result.content,
        content_format: 'markdown',
        source_type: 'synthesized',
        approval_status: 'draft',
        is_compiled_foundational: true,
        synthesis_job_id: job.id,
        version: newVersion,
        previous_version_id: previousDoc?.id || null,
        sources_hash: sourceHash,
        requires_review: true,
        token_count: result.tokens.input + result.tokens.output,
      })
      .select()
      .single()

    if (docError) {
      console.error('Error creating document:', docError)
      await supabase
        .from('synthesis_jobs')
        .update({
          status: 'failed',
          error_message: docError.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id)

      return NextResponse.json(
        { error: 'Failed to create document' },
        { status: 500 }
      )
    }

    // 11. Update synthesis job with success
    await supabase
      .from('synthesis_jobs')
      .update({
        status: 'completed',
        synthesized_document_id: newDoc.id,
        model_used: transformer.model,
        tokens_used: result.tokens,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
      })
      .eq('id', job.id)

    return NextResponse.json({
      success: true,
      documentId: newDoc.id,
      version: newVersion,
      previousVersionId: previousDoc?.id || null,
      status: 'pending_review',
      tokensUsed: result.tokens,
    } as TransformerExecuteResult)

  } catch (err) {
    console.error('Unexpected error in POST /api/v2/transformers/execute:', err)
    return NextResponse.json(
      {
        success: false,
        status: 'error',
        error: err instanceof Error ? err.message : 'Internal server error',
      } as TransformerExecuteResult,
      { status: 500 }
    )
  }
}
