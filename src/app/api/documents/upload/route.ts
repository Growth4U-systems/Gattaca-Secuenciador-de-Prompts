import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// PDF and DOCX parsing libraries
// Note: These need to be installed and may require additional config
// npm install pdf-parse mammoth

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

    // Validate file size (50MB max)
    const MAX_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large (max 50MB)' },
        { status: 400 }
      )
    }

    // Extract text content based on file type
    let extractedContent = ''
    const buffer = await file.arrayBuffer()

    try {
      if (file.type === 'application/pdf') {
        extractedContent = await extractPDF(buffer)
      } else if (
        file.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword'
      ) {
        extractedContent = await extractDOCX(buffer)
      } else if (file.type === 'text/plain') {
        const decoder = new TextDecoder()
        extractedContent = decoder.decode(buffer)
      } else {
        return NextResponse.json(
          { error: 'Unsupported file type' },
          { status: 400 }
        )
      }
    } catch (extractError) {
      console.error('Content extraction error:', extractError)
      return NextResponse.json(
        { error: 'Failed to extract content from file' },
        { status: 500 }
      )
    }

    if (!extractedContent || extractedContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text content could be extracted' },
        { status: 400 }
      )
    }

    // Create Supabase client with service role for server operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Insert document into database
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
        { error: 'Failed to save document' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      document: data,
      message: 'Document uploaded successfully',
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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
