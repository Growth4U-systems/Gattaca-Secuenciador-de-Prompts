import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@/lib/supabase-server-admin'
import { getUserApiKey } from '@/lib/getUserApiKey'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for video generation

/**
 * Video Viral IA - Generate Video Clips
 *
 * Uses Wavespeed AI / Seedance to generate video clips from scene prompts.
 *
 * Supports two modes:
 * 1. Generate new clips: Pass scenes array, returns task_ids immediately
 * 2. Poll existing tasks: Pass existing_task_ids array to check status
 *
 * API Docs: https://wavespeed.ai/docs/docs-api/bytedance/bytedance-seedance-v1.5-pro-text-to-video
 */

interface GenerateClipsRequest {
  projectId: string
  scenes?: string[] // Array of scene prompts (for new generation)
  existing_task_ids?: Array<{ scene_index: number; task_id: string }> // For resuming/polling
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

interface ClipResult {
  scene_index: number
  task_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'timeout'
  video_url?: string
  error?: string
}

const WAVESPEED_API_BASE = 'https://api.wavespeed.ai/api/v3'
const SEEDANCE_ENDPOINT = `${WAVESPEED_API_BASE}/bytedance/seedance-v1.5-pro/text-to-video`

/**
 * Sanitize prompt text to remove non-ASCII characters that cause ByteString errors.
 */
function sanitizePrompt(text: string): string {
  return text
    .replace(/←/g, '<-')
    .replace(/→/g, '->')
    .replace(/↑/g, '^')
    .replace(/↓/g, 'v')
    .replace(/↔/g, '<->')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•●○◦]/g, '-')
    .replace(/[™®©]/g, '')
    .replace(/[°]/g, ' degrees')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Poll a single Wavespeed task for its result
 */
async function pollTaskResult(
  taskId: string,
  apiKey: string,
  maxWaitMs: number = 60000,
  pollIntervalMs: number = 3000
): Promise<{ status: string; video_url?: string; error?: string }> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(
        `${WAVESPEED_API_BASE}/predictions/${taskId}/result`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      )

      if (!response.ok) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
        continue
      }

      const data: WavespeedResponse = await response.json()

      if (data.data?.status === 'completed') {
        return {
          status: 'completed',
          video_url: data.data.outputs?.[0],
        }
      }

      if (data.data?.status === 'failed') {
        return {
          status: 'failed',
          error: data.data.error || 'Video generation failed',
        }
      }

      // Still processing
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }
  }

  return { status: 'processing' } // Still in progress, not timed out - caller can retry
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateClipsRequest = await request.json()
    const {
      projectId,
      scenes,
      existing_task_ids,
      aspect_ratio = '9:16',
      duration: rawDuration = 5,
      resolution = '720p',
      generate_audio = false,
      _internal_user_id,
    } = body

    const duration = Math.round(Number(rawDuration) || 5)

    // Check authentication
    let userId: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabaseForApiKey: any

    if (_internal_user_id) {
      console.log('[generate-clips] Internal call with userId:', _internal_user_id)
      userId = _internal_user_id
      supabaseForApiKey = createAdminClient()
    } else {
      const supabase = await createServerClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      userId = user.id
      supabaseForApiKey = supabase
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Falta parámetro: projectId es requerido' },
        { status: 400 }
      )
    }

    // Get Wavespeed API key
    console.log('[generate-clips] Getting Wavespeed API key for user:', userId)
    const userApiKey = await getUserApiKey({
      userId,
      serviceName: 'wavespeed',
      supabase: supabaseForApiKey,
    })
    const wavespeedApiKey = userApiKey || process.env.WAVESPEED_API_KEY

    if (!wavespeedApiKey) {
      return NextResponse.json(
        {
          error: 'API key de Wavespeed no configurada',
          setup_instructions: {
            message: 'Necesitas configurar tu API key de Wavespeed para generar videos.',
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

    const apiKeyAscii = wavespeedApiKey.replace(/[^\x00-\x7F]/g, '')
    const clipResults: ClipResult[] = []

    // MODE 1: Poll existing tasks (resume mode)
    if (existing_task_ids && existing_task_ids.length > 0) {
      console.log('[generate-clips] Resume mode - polling', existing_task_ids.length, 'existing tasks')

      // Poll all tasks in parallel
      const pollPromises = existing_task_ids.map(async ({ scene_index, task_id }) => {
        const result = await pollTaskResult(task_id, apiKeyAscii, 240000, 5000) // 4 min max per task
        return {
          scene_index,
          task_id,
          status: result.status as ClipResult['status'],
          video_url: result.video_url,
          error: result.error,
        }
      })

      const results = await Promise.all(pollPromises)
      clipResults.push(...results)
    }
    // MODE 2: Generate new clips
    else if (scenes && scenes.length > 0) {
      console.log('[generate-clips] Generate mode - creating', scenes.length, 'new clips')

      // Step 1: Submit all generation requests in parallel (fast)
      const submissionPromises = scenes.map(async (scene, index) => {
        const scenePrompt = sanitizePrompt(scene)
        console.log(`[generate-clips] Submitting scene ${index + 1}`)

        try {
          const response = await fetch(SEEDANCE_ENDPOINT, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKeyAscii}`,
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

            if (response.status === 401) {
              return {
                scene_index: index,
                task_id: '',
                status: 'failed' as const,
                error: 'API key de Wavespeed inválida o expirada',
              }
            }

            return {
              scene_index: index,
              task_id: '',
              status: 'failed' as const,
              error: `Wavespeed API error: ${response.status} - ${errorText}`,
            }
          }

          const data: WavespeedResponse = await response.json()

          if (data.code !== 200 || !data.data?.id) {
            return {
              scene_index: index,
              task_id: '',
              status: 'failed' as const,
              error: data.message || 'Unknown error',
            }
          }

          return {
            scene_index: index,
            task_id: data.data.id,
            status: 'pending' as const,
          }
        } catch (error) {
          return {
            scene_index: index,
            task_id: '',
            status: 'failed' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      })

      const submissions = await Promise.all(submissionPromises)

      // Separate successful submissions from failures
      const pendingTasks = submissions.filter(s => s.task_id && s.status === 'pending')
      const failedTasks = submissions.filter(s => s.status === 'failed')

      console.log(`[generate-clips] Submitted ${pendingTasks.length} tasks, ${failedTasks.length} failed`)

      // Add failures to results
      clipResults.push(...failedTasks)

      // Step 2: Poll all pending tasks in parallel
      if (pendingTasks.length > 0) {
        const pollPromises = pendingTasks.map(async (task) => {
          // Use remaining time wisely - ~4 minutes per task max, all in parallel
          const result = await pollTaskResult(task.task_id, apiKeyAscii, 240000, 5000)
          return {
            scene_index: task.scene_index,
            task_id: task.task_id,
            status: result.status as ClipResult['status'],
            video_url: result.video_url,
            error: result.error,
          }
        })

        const pollResults = await Promise.all(pollPromises)
        clipResults.push(...pollResults)
      }
    } else {
      return NextResponse.json(
        { error: 'Debe proporcionar scenes o existing_task_ids' },
        { status: 400 }
      )
    }

    // Sort by scene_index
    clipResults.sort((a, b) => a.scene_index - b.scene_index)

    // Build response
    const completedClips = clipResults.filter((r) => r.status === 'completed')
    const pendingClips = clipResults.filter((r) => r.status === 'pending' || r.status === 'processing')
    const failedClips = clipResults.filter((r) => r.status === 'failed')

    const allDone = pendingClips.length === 0
    const totalScenes = clipResults.length

    return NextResponse.json({
      success: completedClips.length === totalScenes,
      all_done: allDone,
      message: allDone
        ? `Generados ${completedClips.length}/${totalScenes} clips`
        : `En progreso: ${completedClips.length} completados, ${pendingClips.length} procesando`,
      clips: clipResults,
      video_urls: completedClips.map((c) => c.video_url).filter(Boolean),
      // Include task_ids for persistence (so caller can save and resume later)
      task_ids: clipResults
        .filter(c => c.task_id)
        .map(c => ({ scene_index: c.scene_index, task_id: c.task_id })),
      errors: failedClips.length > 0
        ? failedClips.map((f) => ({ scene: f.scene_index, error: f.error }))
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
