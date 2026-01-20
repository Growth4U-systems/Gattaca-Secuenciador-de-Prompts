import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 180 // 3 minutes for video composition

/**
 * Video Viral IA - Compose Final Video
 *
 * Uses Fal AI FFmpeg API to merge video clips and optionally add audio.
 *
 * API Docs:
 * - Merge videos: https://fal.ai/models/fal-ai/ffmpeg-api/merge-videos/api
 * - Merge audio-video: https://fal.ai/models/fal-ai/ffmpeg-api/merge-audio-video/api
 */

interface ComposeVideoRequest {
  projectId: string
  video_urls: string[] // Array of video clip URLs to merge
  audio_url?: string // Optional audio track URL
  target_fps?: number // Output frame rate (1-60)
  resolution?: {
    width: number
    height: number
  }
}

interface FalMergeResponse {
  video: {
    url: string
    content_type: string
    file_name: string
    file_size: number
  }
  metadata?: Record<string, unknown>
}

const FAL_MERGE_VIDEOS = 'https://fal.run/fal-ai/ffmpeg-api/merge-videos'
const FAL_MERGE_AUDIO_VIDEO = 'https://fal.run/fal-ai/ffmpeg-api/merge-audio-video'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body: ComposeVideoRequest = await request.json()
    const { projectId, video_urls, audio_url, target_fps = 30, resolution } = body

    if (!projectId || !video_urls || video_urls.length < 1) {
      return NextResponse.json(
        { error: 'Faltan parámetros: projectId y al menos 1 video_url requerido' },
        { status: 400 }
      )
    }

    // Get Fal AI API key
    const falApiKey =
      (await getUserApiKey({
        userId: user.id,
        serviceName: 'fal',
        supabase,
      })) || process.env.FAL_API_KEY

    if (!falApiKey) {
      return NextResponse.json(
        {
          error: 'API key de Fal AI no configurada',
          setup_instructions: {
            message:
              'Necesitas configurar tu API key de Fal AI para componer videos.',
            steps: [
              '1. Ve a https://fal.ai y crea una cuenta',
              '2. Obtén tu API key desde el dashboard',
              '3. En Gattaca, ve a Settings > APIs',
              '4. Agrega la key con el nombre "fal"',
            ],
          },
        },
        { status: 400 }
      )
    }

    let finalVideoUrl: string | null = null

    // Step 1: Merge video clips if more than one
    if (video_urls.length > 1) {
      const mergeRequestBody: Record<string, unknown> = {
        video_urls,
        target_fps,
      }

      if (resolution) {
        mergeRequestBody.resolution = resolution
      }

      const mergeResponse = await fetch(FAL_MERGE_VIDEOS, {
        method: 'POST',
        headers: {
          Authorization: `Key ${falApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mergeRequestBody),
      })

      if (!mergeResponse.ok) {
        const errorText = await mergeResponse.text()
        return NextResponse.json(
          {
            error: `Error al unir videos: ${mergeResponse.status}`,
            details: errorText,
          },
          { status: 500 }
        )
      }

      const mergeData: FalMergeResponse = await mergeResponse.json()
      finalVideoUrl = mergeData.video.url
    } else {
      // Single video, no merge needed
      finalVideoUrl = video_urls[0]
    }

    // Step 2: Add audio if provided
    if (audio_url && finalVideoUrl) {
      const audioMergeResponse = await fetch(FAL_MERGE_AUDIO_VIDEO, {
        method: 'POST',
        headers: {
          Authorization: `Key ${falApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_url: finalVideoUrl,
          audio_url: audio_url,
        }),
      })

      if (!audioMergeResponse.ok) {
        const errorText = await audioMergeResponse.text()
        // Return video without audio rather than failing completely
        console.error('Failed to merge audio:', errorText)
        return NextResponse.json({
          success: true,
          warning: 'Video creado pero sin audio (error al agregar audio)',
          video_url: finalVideoUrl,
          audio_error: errorText,
        })
      }

      const audioMergeData: FalMergeResponse = await audioMergeResponse.json()
      finalVideoUrl = audioMergeData.video.url
    }

    return NextResponse.json({
      success: true,
      video_url: finalVideoUrl,
      has_audio: !!audio_url,
      clips_merged: video_urls.length,
    })
  } catch (error) {
    console.error('Error in compose-video:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}
