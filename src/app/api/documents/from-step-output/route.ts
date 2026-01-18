import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PlaybookStepSourceMetadata } from '@/hooks/useDocuments'
import { triggerEmbeddingGeneration } from '@/lib/embeddings'

// ============================================
// POST: Create document from step output
// ============================================

interface CreateFromStepOutputRequest {
  projectId?: string | null
  clientId: string
  filename: string
  category: string
  content: string
  description?: string | null
  tags?: string[] | null
  userId: string
  sourceMetadata: PlaybookStepSourceMetadata
  sourceCampaignId: string
  sourceStepId: string
  sourceStepName: string
  sourcePlaybookId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateFromStepOutputRequest = await request.json()

    // Validate required fields
    if (!body.clientId) {
      return NextResponse.json(
        { success: false, error: 'clientId is required' },
        { status: 400 }
      )
    }
    if (!body.filename?.trim()) {
      return NextResponse.json(
        { success: false, error: 'filename is required' },
        { status: 400 }
      )
    }
    if (!body.content) {
      return NextResponse.json(
        { success: false, error: 'content is required' },
        { status: 400 }
      )
    }
    if (!body.userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // Create Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculate file size and token count estimate
    const contentBytes = new TextEncoder().encode(body.content).length
    const tokenCountEstimate = Math.ceil(body.content.length / 4)

    // Insert the document
    const { data: document, error: insertError } = await supabase
      .from('knowledge_base_docs')
      .insert({
        project_id: body.projectId || null,
        client_id: body.clientId,
        filename: body.filename.trim(),
        category: body.category || 'content',
        extracted_content: body.content,
        file_size_bytes: contentBytes,
        mime_type: 'text/plain',
        source_type: 'playbook',
        source_playbook_id: body.sourcePlaybookId || null,
        source_metadata: body.sourceMetadata,
        description: body.description || null,
        tags: body.tags || null,
        token_count: tokenCountEstimate,
        // Traceability fields
        created_by: body.userId,
        updated_by: body.userId,
        source_campaign_id: body.sourceCampaignId,
        source_step_id: body.sourceStepId,
        source_step_name: body.sourceStepName,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting document:', insertError)
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      )
    }

    // The initial version is created automatically by the database trigger
    // (kb_docs_initial_version_trigger)

    // Trigger embedding generation asynchronously
    triggerEmbeddingGeneration(document.id).catch(err => {
      console.error('Background embedding generation failed:', err)
    })

    return NextResponse.json({
      success: true,
      document: {
        ...document,
        embedding_status: 'processing'
      },
    })

  } catch (error) {
    console.error('Error in from-step-output API:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
