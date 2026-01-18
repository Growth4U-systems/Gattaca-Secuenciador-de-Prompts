import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { triggerEmbeddingGenerationBatch } from '@/lib/embeddings'

// Configure API route to handle large JSON payloads
export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'
// Note: Next.js App Router doesn't support bodyParser config
// Large JSON bodies may fail - consider using streaming or chunking

interface DocumentToSave {
  filename: string
  category: string
  extractedContent: string
  tokenCount: number
  fileSize: number
  mimeType: string
}

/**
 * API Route: Save multiple pre-extracted documents to database
 * Used after user has categorized all files in bulk upload
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, documents } = body as {
      projectId: string
      documents: DocumentToSave[]
    }

    if (!projectId || !documents || !Array.isArray(documents)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (documents.length === 0) {
      return NextResponse.json(
        { error: 'No documents to save' },
        { status: 400 }
      )
    }

    // Validate all documents have required fields
    for (const doc of documents) {
      if (
        !doc.filename ||
        !doc.category ||
        !doc.extractedContent ||
        !doc.mimeType
      ) {
        return NextResponse.json(
          { error: `Invalid document: ${doc.filename}` },
          { status: 400 }
        )
      }
    }

    // Create Supabase client with user session
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Prepare documents for insertion
    const docsToInsert = documents.map((doc) => ({
      project_id: projectId,
      filename: doc.filename,
      category: doc.category,
      extracted_content: doc.extractedContent,
      file_size_bytes: doc.fileSize,
      mime_type: doc.mimeType,
    }))

    // Insert all documents in a single query
    const { data, error } = await supabase
      .from('knowledge_base_docs')
      .insert(docsToInsert)
      .select()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to save documents', details: error.message },
        { status: 500 }
      )
    }

    // Trigger embedding generation for all documents asynchronously
    if (data && data.length > 0) {
      const documentIds = data.map(doc => doc.id)
      triggerEmbeddingGenerationBatch(documentIds).catch(err => {
        console.error('Background batch embedding generation failed:', err)
      })
    }

    return NextResponse.json({
      success: true,
      documents: data?.map(doc => ({ ...doc, embedding_status: 'processing' })),
      count: data?.length || 0,
      message: `${data?.length || 0} documentos guardados exitosamente. Indexando...`,
    })
  } catch (error) {
    console.error('Bulk save error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
