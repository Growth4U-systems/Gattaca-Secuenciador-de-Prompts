import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for video generation

/**
 * Video Viral IA - Generate Video Clips
 *
 * Uses Wavespeed AI / Seedance to generate video clips from scene prompts.
 * Implements async job with polling pattern.
 *
 * API Docs: https://wavespeed.ai/docs/docs-api/bytedance/bytedance-seedance-v1.5-pro-text-to-video
 */

interface GenerateClipsRequest {
  projectId: string
  scenes: string[] // Array of scene prompts
  aspect_ratio?: string // 16:9, 9:16, 1:1, etc.
  duration?: number // seconds per clip (4-12)
  resolution?: string // 720p or 480p
  generate_audio?: boolean
}

interface WavespeedResponse {
  code: number
  message: string
  data: {
    id: string
    status: 'created' | 'processing' | 'completed' | 'failed'
    outputs?: string[]
    error?: string
  }
}

const WAVESPEED_API_BASE = 'https://api.wavespeed.ai/api/v3'
const SEEDANCE_ENDPOINT = `${WAVESPEED_API_BASE}/bytedance/seedance-v1.5-pro/text-to-video`

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

    const body: GenerateClipsRequest = await request.json()
    const {
      projectId,
      scenes,
      aspect_ratio = '9:16',
      duration = 5,
      resolution = '720p',
      generate_audio = false,
    } = body

    if (!projectId || !scenes || scenes.length === 0) {
      return NextResponse.json(
        { error: 'Faltan parámetros: projectId y scenes son requeridos' },
        { status: 400 }
      )
    }

    // Get Wavespeed API key
    const wavespeedApiKey =
      (await getUserApiKey({
        userId: user.id,
        serviceName: 'wavespeed',
        supabase,
      })) || process.env.WAVESPEED_API_KEY

    if (!wavespeedApiKey) {
      return NextResponse.json(
        {
          error: 'API key de Wavespeed no configurada',
          setup_instructions: {
            message:
              'Necesitas configurar tu API key de Wavespeed para generar videos.',
            steps: [
              '1. Ve a https://wavespeed.ai y crea una cuenta',
              '2. Obtén tu API key desde el dashboard',
              '3. En Gattaca, ve a Settings > APIs',
              '4. Agrega la key con el nombre "wavespeed"',
            ],
            cost_info: '$0.20 por video de ~5 segundos',
          },
        },
        { status: 400 }
      )
    }

    // Generate clips for each scene
    const clipResults: Array<{
      scene_index: number
      task_id: string
      status: string
      video_url?: string
      error?: string
    }> = []

    for (let i = 0; i < scenes.length; i++) {
      const scenePrompt = scenes[i]

      try {
        // Submit video generation request
        const response = await fetch(SEEDANCE_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${wavespeedApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: scenePrompt,
            aspect_ratio,
            duration,
            resolution,
            generate_audio,
            seed: -1,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          clipResults.push({
            scene_index: i,
            task_id: '',
            status: 'failed',
            error: `Wavespeed API error: ${response.status} - ${errorText}`,
          })
          continue
        }

        const data: WavespeedResponse = await response.json()

        if (data.code !== 200 || !data.data?.id) {
          clipResults.push({
            scene_index: i,
            task_id: '',
            status: 'failed',
            error: data.message || 'Unknown error',
          })
          continue
        }

        // Poll for completion
        const taskId = data.data.id
        const maxWaitMs = 180000 // 3 minutes per clip
        const pollIntervalMs = 5000
        const startTime = Date.now()

        while (Date.now() - startTime < maxWaitMs) {
          const statusResponse = await fetch(
            `${WAVESPEED_API_BASE}/predictions/${taskId}/result`,
            {
              headers: {
                Authorization: `Bearer ${wavespeedApiKey}`,
              },
            }
          )

          if (!statusResponse.ok) {
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
            continue
          }

          const statusData: WavespeedResponse = await statusResponse.json()

          if (statusData.data?.status === 'completed') {
            clipResults.push({
              scene_index: i,
              task_id: taskId,
              status: 'completed',
              video_url: statusData.data.outputs?.[0],
            })
            break
          }

          if (statusData.data?.status === 'failed') {
            clipResults.push({
              scene_index: i,
              task_id: taskId,
              status: 'failed',
              error: statusData.data.error || 'Video generation failed',
            })
            break
          }

          // Still processing, wait and poll again
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
        }

        // Check if we timed out
        if (!clipResults.find((r) => r.scene_index === i)) {
          clipResults.push({
            scene_index: i,
            task_id: taskId,
            status: 'timeout',
            error: 'Video generation timed out after 3 minutes',
          })
        }
      } catch (error) {
        clipResults.push({
          scene_index: i,
          task_id: '',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Check results
    const completedClips = clipResults.filter((r) => r.status === 'completed')
    const failedClips = clipResults.filter((r) => r.status !== 'completed')

    return NextResponse.json({
      success: completedClips.length > 0,
      message: `Generados ${completedClips.length}/${scenes.length} clips`,
      clips: clipResults,
      video_urls: completedClips.map((c) => c.video_url).filter(Boolean),
      errors:
        failedClips.length > 0
          ? failedClips.map((f) => ({
              scene: f.scene_index,
              error: f.error,
            }))
          : undefined,
    })
  } catch (error) {
    console.error('Error in generate-clips:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}
