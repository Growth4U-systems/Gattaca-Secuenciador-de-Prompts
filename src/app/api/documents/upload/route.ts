import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// PDF and DOCX parsing libraries
// Note: These need to be installed and may require additional config
// npm install pdf-parse mammoth

// Configure API route to accept large files (App Router)
export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds timeout
export const dynamic = 'force-dynamic'

/**
 * Upload document
 * SECURITY FIX: Now uses user session for authentication
 */
export async function POST(request: NextRequest) {
  try {
    console.log('=== Upload Started ===')

    // SECURITY FIX: Check authentication first
    const supabaseAuth = await createClient()
    const { data: { session } } = await supabaseAuth.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string
    const category = formData.get('category') as string
    const description = formData.get('description') as string || ''

    console.log('File info:', {
      name: file?.name,
      size: file?.size,
      type: file?.type,
      projectId,
      category,
      description: description.substring(0, 50) + (description.length > 50 ? '...' : '')
    })

    if (!file || !projectId || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate file size (4MB max - Vercel has strict 4.5MB payload limit)
    // For larger files, use /api/documents/upload-blob (requires Vercel Blob setup)
    const MAX_SIZE = 4 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          error: 'File too large (max 4MB for direct upload)',
          hint: 'For larger files, configure Vercel Blob Storage. See VERCEL_BLOB_SETUP.md',
          fileSize: file.size,
          maxSize: MAX_SIZE,
          fileSizeMB: (file.size / 1024 / 1024).toFixed(2)
        },
        { status: 400 }
      )
    }

    // Extract text content based on file type
    console.log('Starting extraction for type:', file.type)
    let extractedContent = ''
    const buffer = await file.arrayBuffer()

    try {
      if (file.type === 'application/pdf') {
        console.log('Extracting PDF...')
        extractedContent = await extractPDF(buffer)
      } else if (
        file.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword'
      ) {
        console.log('Extracting DOCX...')
        extractedContent = await extractDOCX(buffer)
      } else if (file.type === 'text/plain') {
        console.log('Extracting TXT...')
        const decoder = new TextDecoder()
        extractedContent = decoder.decode(buffer)
      } else {
        console.error('Unsupported file type:', file.type)
        return NextResponse.json(
          { error: 'Unsupported file type', fileType: file.type },
          { status: 400 }
        )
      }
      console.log('Extraction successful, length:', extractedContent.length)
    } catch (extractError) {
      console.error('Content extraction error:', extractError)
      return NextResponse.json(
        {
          error: 'Failed to extract content from file',
          details: extractError instanceof Error ? extractError.message : 'Unknown error',
          fileType: file.type
        },
        { status: 500 }
      )
    }

    if (!extractedContent || extractedContent.trim().length === 0) {
      console.error('No content extracted')
      return NextResponse.json(
        { error: 'No text content could be extracted' },
        { status: 400 }
      )
    }

    // Use the authenticated client (supabaseAuth already has session)
    // RLS policies will enforce that user can only upload to their projects
    const supabase = supabaseAuth

    // Insert document into database
    console.log('Saving to database...')
    const { data, error } = await supabase
      .from('knowledge_base_docs')
      .insert({
        project_id: projectId,
        filename: file.name,
        category: category,
        description: description.trim(),
        extracted_content: extractedContent,
        file_size_bytes: file.size,
        mime_type: file.type,
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
          code: error.code
        },
        { status: 500 }
      )
    }

    console.log('Upload successful!')

    return NextResponse.json({
      success: true,
      document: data,
      message: 'Document uploaded successfully',
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// PDF extraction using pdf-parse
async function extractPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    // Dynamically import pdf-parse (Node.js module)
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
    // Dynamically import mammoth (Node.js module)
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
    return result.value
  } catch (error) {
    console.error('DOCX extraction error:', error)
    throw new Error('Failed to extract DOCX content')
  }
}
