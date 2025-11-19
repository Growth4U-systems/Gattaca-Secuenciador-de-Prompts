import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export const runtime = 'nodejs'

/**
 * Generate a client upload URL for Vercel Blob
 * This allows the client to upload directly to Blob without exposing the token
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // You can add validation here if needed
        return {
          allowedContentTypes: [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'text/plain',
          ],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB max
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This runs after upload completes
        console.log('Blob upload completed:', blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error('Generate upload URL error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate upload URL',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
