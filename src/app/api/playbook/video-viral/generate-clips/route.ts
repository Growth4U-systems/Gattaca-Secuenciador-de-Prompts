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
  // For internal server-to-server calls
  _internal_user_id?: string
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

/**
 * Sanitize prompt text to remove non-ASCII characters that cause ByteString errors.
 * Replaces common Unicode symbols with ASCII equivalents or removes them.
 */
function sanitizePrompt(text: string): string {
  return text
    // Replace arrows with text equivalents
    .replace(/←/g, '<-')
    .replace(/→/g, '->')
    .replace(/↑/g, '^')
    .replace(/↓/g, 'v')
    .replace(/↔/g, '<->')
    // Replace quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Replace dashes
    .replace(/[–—]/g, '-')
    // Replace ellipsis
    .replace(/…/g, '...')
    // Replace bullet points
    .replace(/[•●○◦]/g, '-')
    // Replace other common symbols
    .replace(/[™®©]/g, '')
    .replace(/[°]/g, ' degrees')
    // Remove emojis and other non-ASCII characters
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Emojis
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    // Remove any remaining non-ASCII characters
    .replace(/[^\x00-\x7F]/g, '')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const body: GenerateClipsRequest = await request.json()
    const {
      projectId,
      scenes,
      aspect_ratio = '9:16',
      duration = 5,
      resolution = '720p',
      generate_audio = false,
      _internal_user_id,
    } = body

    // Check authentication - support internal server-to-server calls
    let userId: string

    if (_internal_user_id) {
      // Internal call from execute-step - trust the userId passed
      console.log('[generate-clips] Internal call with userId:', _internal_user_id)
      userId = _internal_user_id
    } else {
      // External call - verify via Supabase auth
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      userId = user.id
    }

    if (!projectId || !scenes || scenes.length === 0) {
      return NextResponse.json(
        { error: 'Faltan parámetros: projectId y scenes son requeridos' },
        { status: 400 }
      )
    }

    // Get Wavespeed API key
    console.log('[generate-clips] Getting Wavespeed API key for user:', userId)
    const userApiKey = await getUserApiKey({
      userId,
      serviceName: 'wavespeed',
      supabase,
    })
    const wavespeedApiKey = userApiKey || process.env.WAVESPEED_API_KEY

    console.log('[generate-clips] API key source:', userApiKey ? 'user_api_keys table' : 'env WAVESPEED_API_KEY')
    console.log('[generate-clips] API key found:', !!wavespeedApiKey)
    if (wavespeedApiKey) {
      console.log('[generate-clips] API key prefix:', wavespeedApiKey.substring(0, 10) + '...')
      console.log('[generate-clips] API key length:', wavespeedApiKey.length)
    }

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

    // Validate API key is ASCII-only (required for HTTP headers)
    const apiKeyAscii = wavespeedApiKey.replace(/[^\x00-\x7F]/g, '')
    if (apiKeyAscii !== wavespeedApiKey) {
      console.warn('[generate-clips] API key contains non-ASCII characters, using sanitized version')
    }

    for (let i = 0; i < scenes.length; i++) {
      const scenePrompt = sanitizePrompt(scenes[i])
      console.log(`[generate-clips] Scene ${i + 1} prompt (sanitized, ${scenePrompt.length} chars):`, scenePrompt.substring(0, 100) + '...')

      try {
        // Build request body as string first to catch encoding issues
        const requestBody = JSON.stringify({
          prompt: scenePrompt,
          aspect_ratio,
          duration,
          resolution,
          generate_audio,
          seed: -1,
        })

        // Submit video generation request
        const response = await fetch(SEEDANCE_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKeyAscii}`,
            'Content-Type': 'application/json',
          },
          body: requestBody,
        })

        if (!response.ok) {
          const errorText = await response.text()

          // Handle 401 specifically - API key is invalid
          if (response.status === 401) {
            console.error('[generate-clips] 401 Unauthorized - API key invalid')
            console.error('[generate-clips] API key prefix:', apiKeyAscii.substring(0, 10) + '...')
            return NextResponse.json(
              {
                error: 'API key de Wavespeed inválida o expirada',
                details: 'El servidor de Wavespeed rechazó la autenticación (401 Unauthorized).',
                help: [
                  '1. Ve a https://wavespeed.ai/dashboard/api y verifica tu API key',
                  '2. Asegúrate de copiar la key completa (empieza con "wsk_")',
                  '3. En Gattaca, ve a Settings > APIs y actualiza la key de Wavespeed',
                  '4. Si la key es nueva, espera unos segundos antes de reintentar',
                ],
                api_key_prefix: apiKeyAscii.substring(0, 8) + '...',
              },
              { status: 401 }
            )
          }

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
