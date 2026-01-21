import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@/lib/supabase-server-admin'
import { getUserApiKey } from '@/lib/getUserApiKey'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120 // 2 minutes for audio generation

/**
 * Video Viral IA - Generate Audio
 *
 * Uses Fal AI MMAudio V2 to generate synchronized audio for video.
 *
 * API Docs: https://fal.ai/models/fal-ai/mmaudio-v2
 */

interface GenerateAudioRequest {
  projectId: string
  video_url?: string // Optional - for video-to-audio sync
  prompt: string // Audio description
  duration?: number // Audio length in seconds (1-30)
  num_steps?: number // Quality iterations (4-50, default 25)
  cfg_strength?: number // Text adherence (0-20, default 4.5)
  // For internal server-to-server calls
  _internal_user_id?: string
}

interface FalAudioResponse {
  video?: {
    url: string
    file_name: string
    content_type: string
    file_size: number
  }
  audio?: {
    url: string
    file_name: string
    content_type: string
    file_size: number
  }
}

const FAL_API_BASE = 'https://fal.run/fal-ai/mmaudio-v2'

export async function POST(request: NextRequest) {
  try {
    const body: GenerateAudioRequest = await request.json()
    const {
      projectId,
      video_url,
      prompt,
      duration = 8,
      num_steps = 25,
      cfg_strength = 4.5,
      _internal_user_id,
    } = body

    // Check authentication - support internal server-to-server calls
    let userId: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabaseForApiKey: any

    if (_internal_user_id) {
      // Internal call from execute-step - trust the userId passed
      // Use admin client to read user_api_keys (bypasses RLS)
      console.log('[generate-audio] Internal call with userId:', _internal_user_id)
      userId = _internal_user_id
      supabaseForApiKey = createAdminClient()
    } else {
      // External call - verify via Supabase auth
      const supabase = await createServerClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      userId = user.id
      supabaseForApiKey = supabase
    }

    if (!projectId || !prompt) {
      return NextResponse.json(
        { error: 'Faltan parámetros: projectId y prompt son requeridos' },
        { status: 400 }
      )
    }

    // Get Fal AI API key
    const falApiKey =
      (await getUserApiKey({
        userId,
        serviceName: 'fal',
        supabase: supabaseForApiKey,
      })) || process.env.FAL_API_KEY

    if (!falApiKey) {
      return NextResponse.json(
        {
          error: 'API key de Fal AI no configurada',
          setup_instructions: {
            message:
              'Necesitas configurar tu API key de Fal AI para generar audio.',
            steps: [
              '1. Ve a https://fal.ai y crea una cuenta',
              '2. Obtén tu API key desde el dashboard',
              '3. En Gattaca, ve a Settings > APIs',
              '4. Agrega la key con el nombre "fal"',
            ],
            cost_info: '$0.001 por segundo de audio (~$0.03 por 30 segundos)',
          },
        },
        { status: 400 }
      )
    }

    // Choose endpoint based on whether we have a video
    const endpoint = video_url ? FAL_API_BASE : `${FAL_API_BASE}/text-to-audio`

    // Build request body
    const requestBody: Record<string, unknown> = {
      prompt,
      num_steps,
      duration,
      cfg_strength,
      seed: 0,
    }

    if (video_url) {
      requestBody.video_url = video_url
    }

    // Call Fal AI
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        {
          error: `Fal AI error: ${response.status}`,
          details: errorText,
        },
        { status: 500 }
      )
    }

    const data: FalAudioResponse = await response.json()

    // Return the appropriate URL based on mode
    if (video_url && data.video) {
      // Video-to-audio mode returns video with audio added
      return NextResponse.json({
        success: true,
        mode: 'video_with_audio',
        video_url: data.video.url,
        file_name: data.video.file_name,
        file_size: data.video.file_size,
      })
    } else if (data.audio) {
      // Text-to-audio mode returns just audio
      return NextResponse.json({
        success: true,
        mode: 'audio_only',
        audio_url: data.audio.url,
        file_name: data.audio.file_name,
        file_size: data.audio.file_size,
      })
    }

    return NextResponse.json(
      {
        error: 'No se generó audio',
        response: data,
      },
      { status: 500 }
    )
  } catch (error) {
    console.error('Error in generate-audio:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}
