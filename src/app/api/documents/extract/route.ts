import { NextRequest, NextResponse } from 'next/server'

// Configure API route to accept large files
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * API Route: Extract text content from uploaded files WITHOUT saving to database
 * Used for bulk upload preview - extract content first, categorize later
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Validate total size (100MB max for all files combined)
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    const MAX_TOTAL_SIZE = 100 * 1024 * 1024
    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        { error: `Total file size exceeds 100MB (${(totalSize / 1024 / 1024).toFixed(2)}MB)` },
        { status: 400 }
      )
    }

    // Extract content from all files
    const extractedFiles = await Promise.all(
      files.map(async (file) => {
        try {
          // Validate file type
          const validTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'text/plain',
          ]

          if (!validTypes.includes(file.type)) {
            return {
              filename: file.name,
              success: false,
              error: 'Tipo de archivo no soportado',
              fileSize: file.size,
              mimeType: file.type,
            }
          }

          // Validate individual file size (50MB max)
          const MAX_SIZE = 50 * 1024 * 1024
          if (file.size > MAX_SIZE) {
            return {
              filename: file.name,
              success: false,
              error: 'Archivo muy grande (máx 50MB)',
              fileSize: file.size,
              mimeType: file.type,
            }
          }

          // Extract content
          const buffer = await file.arrayBuffer()
          let extractedContent = ''

          if (file.type === 'application/pdf') {
            extractedContent = await extractPDF(buffer)
          } else if (
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.type === 'application/msword'
          ) {
            extractedContent = await extractDOCX(buffer)
          } else if (file.type === 'text/plain') {
            const decoder = new TextDecoder()
            extractedContent = decoder.decode(buffer)
          }

          if (!extractedContent || extractedContent.trim().length === 0) {
            return {
              filename: file.name,
              success: false,
              error: 'No se pudo extraer contenido del archivo',
              fileSize: file.size,
              mimeType: file.type,
            }
          }

          // Calculate tokens
          const tokenCount = Math.ceil(extractedContent.length / 4)

          return {
            filename: file.name,
            success: true,
            extractedContent,
            tokenCount,
            fileSize: file.size,
            mimeType: file.type,
          }
        } catch (error) {
          console.error(`Error extracting ${file.name}:`, error)
          return {
            filename: file.name,
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido',
            fileSize: file.size,
            mimeType: file.type,
          }
        }
      })
    )

    const successCount = extractedFiles.filter((f) => f.success).length
    const failCount = extractedFiles.length - successCount

    return NextResponse.json({
      success: true,
      files: extractedFiles,
      summary: {
        total: extractedFiles.length,
        success: successCount,
        failed: failCount,
      },
    })
  } catch (error) {
    console.error('Extract error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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
