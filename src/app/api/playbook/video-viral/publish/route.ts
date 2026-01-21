import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@/lib/supabase-server-admin'
import { getUserApiKey } from '@/lib/getUserApiKey'

const BLOTATO_API_BASE = 'https://backend.blotato.com/v2'

interface PublishRequest {
  projectId: string
  video_url: string
  caption: string
  platforms: string[] // ['tiktok', 'instagram', 'youtube', etc.]
  blotato_accounts: string[] // ['acc_12345', 'acc_67890', etc.]
  _internal_user_id?: string
}

interface BlottatoTarget {
  targetType: string
  // TikTok specific
  privacyLevel?: string
  allowComments?: boolean
  allowDuet?: boolean
  allowStitch?: boolean
  // YouTube specific
  title?: string
  privacyStatus?: string
  // Instagram specific
  mediaType?: string
}

function buildTargetForPlatform(platform: string, caption: string): BlottatoTarget {
  const normalizedPlatform = platform.toLowerCase().replace(/\s+/g, '')

  switch (normalizedPlatform) {
    case 'tiktok':
      return {
        targetType: 'tiktok',
        privacyLevel: 'PUBLIC_TO_EVERYONE',
        allowComments: true,
        allowDuet: true,
        allowStitch: true,
      }
    case 'instagram':
    case 'instagramreels':
      return {
        targetType: 'instagram',
        mediaType: 'reel',
      }
    case 'youtube':
    case 'youtubeshorts':
      return {
        targetType: 'youtube',
        title: caption.substring(0, 100), // YouTube title max 100 chars
        privacyStatus: 'public',
      }
    case 'facebook':
      return {
        targetType: 'facebook',
        mediaType: 'reel',
      }
    case 'linkedin':
      return {
        targetType: 'linkedin',
      }
    case 'twitter':
    case 'x':
      return {
        targetType: 'twitter',
      }
    case 'threads':
      return {
        targetType: 'threads',
      }
    case 'bluesky':
      return {
        targetType: 'bluesky',
      }
    case 'pinterest':
      return {
        targetType: 'pinterest',
      }
    default:
      return {
        targetType: normalizedPlatform,
      }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: PublishRequest = await request.json()
    const {
      projectId,
      video_url,
      caption,
      platforms,
      blotato_accounts,
      _internal_user_id,
    } = body

    // Check authentication
    let userId: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabaseForApiKey: any

    if (_internal_user_id) {
      console.log('[publish] Internal call with userId:', _internal_user_id)
      userId = _internal_user_id
      supabaseForApiKey = createAdminClient()
    } else {
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

    // Validate required fields
    if (!projectId || !video_url || !caption) {
      return NextResponse.json(
        { error: 'Faltan parámetros: projectId, video_url y caption son requeridos' },
        { status: 400 }
      )
    }

    if (!blotato_accounts || blotato_accounts.length === 0) {
      return NextResponse.json(
        {
          error: 'No hay cuentas de Blotato configuradas',
          setup_instructions: {
            message: 'Necesitas configurar tus Account IDs de Blotato.',
            steps: [
              '1. Ve a my.blotato.com y conecta tus redes sociales',
              '2. Obtén los Account IDs de cada cuenta conectada',
              '3. En las variables del proyecto, agrega los IDs separados por coma',
              '   Ejemplo: acc_12345, acc_67890',
            ],
          },
        },
        { status: 400 }
      )
    }

    // Get Blotato API key
    console.log('[publish] Getting Blotato API key for user:', userId)
    const blotatoApiKey = await getUserApiKey({
      userId,
      serviceName: 'blotato',
      supabase: supabaseForApiKey,
    })

    if (!blotatoApiKey) {
      return NextResponse.json(
        {
          error: 'API key de Blotato no configurada',
          setup_instructions: {
            message: 'Necesitas configurar tu API key de Blotato para publicar videos.',
            steps: [
              '1. Ve a my.blotato.com/settings',
              '2. Copia tu API key',
              '3. En Gattaca, ve a Settings > APIs',
              '4. Agrega la key con el nombre "blotato"',
            ],
          },
        },
        { status: 400 }
      )
    }

    console.log('[publish] Publishing to', blotato_accounts.length, 'accounts')
    console.log('[publish] Video URL:', video_url)
    console.log('[publish] Platforms:', platforms)

    // Publish to each account
    const results: Array<{
      accountId: string
      platform: string
      success: boolean
      postSubmissionId?: string
      error?: string
    }> = []

    for (const accountId of blotato_accounts) {
      // Determine platform from account or use first platform
      // In a real implementation, you'd match accountId to its platform
      // For now, we'll publish to all platforms for each account
      for (const platform of platforms) {
        try {
          const target = buildTargetForPlatform(platform, caption)

          // Truncate caption based on platform limits
          let truncatedCaption = caption
          if (platform.toLowerCase() === 'twitter' || platform.toLowerCase() === 'x') {
            truncatedCaption = caption.substring(0, 280)
          } else if (platform.toLowerCase() === 'threads' || platform.toLowerCase() === 'bluesky') {
            truncatedCaption = caption.substring(0, 500)
          }

          const requestBody = {
            post: {
              accountId: accountId.trim(),
              content: {
                text: truncatedCaption,
                mediaUrls: [video_url],
                platform: target.targetType,
              },
              target,
            },
          }

          console.log(`[publish] Posting to ${platform} (${accountId}):`, JSON.stringify(requestBody, null, 2))

          const response = await fetch(`${BLOTATO_API_BASE}/posts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'blotato-api-key': blotatoApiKey,
            },
            body: JSON.stringify(requestBody),
          })

          const data = await response.json()

          if (response.ok) {
            console.log(`[publish] Success for ${platform}:`, data)
            results.push({
              accountId,
              platform,
              success: true,
              postSubmissionId: data.postSubmissionId,
            })
          } else {
            console.error(`[publish] Error for ${platform}:`, data)
            results.push({
              accountId,
              platform,
              success: false,
              error: data.message || data.error || `HTTP ${response.status}`,
            })
          }
        } catch (error) {
          console.error(`[publish] Exception for ${platform}:`, error)
          results.push({
            accountId,
            platform,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }

    // Summarize results
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: failureCount === 0,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      },
      results,
      video_url,
    })
  } catch (error) {
    console.error('[publish] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error publicando video' },
      { status: 500 }
    )
  }
}
