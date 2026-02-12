import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { triggerEmbeddingGeneration } from '@/lib/embeddings'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large files

/**
 * Process a file that was already uploaded to Vercel Blob
 * This endpoint receives the blob URL, downloads it, extracts content, and saves to Supabase
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { blobUrl, filename, projectId, category, description, fileSize, mimeType } = body

    console.log('Processing blob:', { blobUrl, filename, fileSize, projectId, category, description: description?.substring(0, 50) })

    if (!blobUrl || !filename || !projectId || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Download file from blob
    console.log('Downloading from blob...')
    const response = await fetch(blobUrl)
    if (!response.ok) {
      throw new Error(`Failed to download from blob: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    console.log('Downloaded, size:', arrayBuffer.byteLength)

    // Extract content based on mime type
    let extractedContent = ''

    try {
      if (mimeType === 'application/pdf') {
        console.log('Extracting PDF...')
        extractedContent = await extractPDF(arrayBuffer)
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword'
      ) {
        console.log('Extracting DOCX...')
        extractedContent = await extractDOCX(arrayBuffer)
      } else if (mimeType === 'text/plain' || mimeType === 'text/csv' || mimeType === 'application/vnd.ms-excel' || filename?.endsWith('.csv')) {
        console.log('Extracting TXT/CSV...')
        const decoder = new TextDecoder()
        extractedContent = decoder.decode(arrayBuffer)
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`)
      }

      console.log('Extraction successful, length:', extractedContent.length)
    } catch (extractError) {
      console.error('Content extraction error:', extractError)
      return NextResponse.json(
        {
          error: 'Failed to extract content from file',
          details: extractError instanceof Error ? extractError.message : 'Unknown error',
        },
        { status: 500 }
      )
    }

    if (!extractedContent || extractedContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text content could be extracted' },
        { status: 400 }
      )
    }

    // Save to Supabase
    console.log('Saving to Supabase...')
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('knowledge_base_docs')
      .insert({
        project_id: projectId,
        filename: filename,
        category: category,
        description: description?.trim() || '',
        extracted_content: extractedContent,
        file_size_bytes: fileSize,
        mime_type: mimeType,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        {
          error: 'Failed to save document',
          details: error.message,
          hint: error.hint,
        },
        { status: 500 }
      )
    }

    console.log('Save successful!')

    // Trigger embedding generation asynchronously
    triggerEmbeddingGeneration(data.id).catch(err => {
      console.error('Background embedding generation failed:', err)
    })

    return NextResponse.json({
      success: true,
      document: {
        ...data,
        embedding_status: 'processing'
      },
      message: 'Document processed successfully from Blob. Indexing in progress...',
    })
  } catch (error) {
    console.error('Process blob error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// PDF extraction
async function extractPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    // @ts-expect-error - pdf-parse doesn't have TypeScript types
    const pdfParse = (await import('pdf-parse')).default
    const data = await pdfParse(Buffer.from(buffer))
    return data.text
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error('Failed to extract PDF content')
  }
}

// DOCX extraction
async function extractDOCX(buffer: ArrayBuffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
    return result.value
  } catch (error) {
    console.error('DOCX extraction error:', error)
    throw new Error('Failed to extract DOCX content')
  }
}
