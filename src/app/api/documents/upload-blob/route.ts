import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { createClient } from '@/lib/supabase-server'
import { triggerEmbeddingGeneration } from '@/lib/embeddings'

export const runtime = 'nodejs' // Nodejs for PDF/DOCX parsing
export const maxDuration = 300 // 5 minutes for large files

/**
 * Upload document using Vercel Blob (no size limits)
 * Flow:
 * 1. Upload file to Vercel Blob storage
 * 2. Download and extract content
 * 3. Save metadata + content to Supabase
 * 4. Delete blob (or keep for backup)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string
    const category = formData.get('category') as string

    if (!file || !projectId || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ]

    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      )
    }

    // Step 1: Upload to Vercel Blob
    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true,
    })

    // Step 2: Download from blob and extract content
    const response = await fetch(blob.url)
    const arrayBuffer = await response.arrayBuffer()

    let extractedContent = ''

    try {
      if (file.type === 'application/pdf') {
        extractedContent = await extractPDF(arrayBuffer)
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword'
      ) {
        extractedContent = await extractDOCX(arrayBuffer)
      } else if (file.type === 'text/plain') {
        const decoder = new TextDecoder()
        extractedContent = decoder.decode(arrayBuffer)
      }
    } catch (extractError) {
      console.error('Content extraction error:', extractError)
      return NextResponse.json(
        {
          error: 'Failed to extract content from file',
          details: extractError instanceof Error ? extractError.message : 'Unknown error'
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

    // Step 3: Save to Supabase
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('knowledge_base_docs')
      .insert({
        project_id: projectId,
        filename: file.name,
        category: category,
        extracted_content: extractedContent,
        file_size_bytes: file.size,
        mime_type: file.type,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to save document', details: error.message },
        { status: 500 }
      )
    }

    // Optional: Delete blob after successful save to Supabase
    // Uncomment if you don't want to keep files in Blob storage
    // await del(blob.url)

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
      message: 'Document uploaded successfully (via Blob). Indexing in progress...',
      blobUrl: blob.url, // Keep URL in case needed
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PDF extraction using pdf-parse
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

// DOCX extraction using mammoth
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
