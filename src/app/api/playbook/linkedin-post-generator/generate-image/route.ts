/**
 * Generate Post Image API
 *
 * Converted from n8n node: "Generate Image with Dumpling AI"
 * Uses Dumpling AI with FLUX.1-pro model to generate images
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getUserApiKey } from '@/lib/getUserApiKey'

const DUMPLING_IMAGE_API_URL = 'https://app.dumplingai.com/api/v1/generate-ai-image'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { input, previousOutputs, sessionId, stepId } = body

    // Get image prompt from generate_post step output
    const postStepOutput = previousOutputs?.generate_post as Record<string, unknown> | undefined
    const imagePrompt = postStepOutput?.imagePrompt || input?.imagePrompt
    const postText = postStepOutput?.postText || input?.postText
    const topic = postStepOutput?.topic || input?.topic
    const sources = (postStepOutput?.sources || input?.sources || []) as Array<{title: string; url: string}>

    if (!imagePrompt) {
      return NextResponse.json(
        { error: 'Image prompt is required. Run the generate post step first.' },
        { status: 400 }
      )
    }

    // Get Dumpling AI API key (user's key or env fallback)
    const dumplingApiKey = await getUserApiKey({
      userId: user.id,
      serviceName: 'dumpling',
      supabase,
    })

    if (!dumplingApiKey) {
      return NextResponse.json(
        { error: 'Dumpling AI API key not configured. Please add it in settings.' },
        { status: 400 }
      )
    }

    // Enhance the prompt for LinkedIn visuals
    const enhancedPrompt = `Professional LinkedIn post image: ${imagePrompt}. Style: Clean, modern, professional business aesthetic with subtle gradients. High quality, suitable for social media.`

    // Call Dumpling AI Image Generation API
    const response = await fetch(DUMPLING_IMAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dumplingApiKey}`
      },
      body: JSON.stringify({
        model: 'FLUX.1-pro',
        input: {
          prompt: enhancedPrompt
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Dumpling AI image error:', errorData)

      // Return success with placeholder if image generation fails
      // This allows the workflow to continue
      return NextResponse.json({
        success: true,
        data: {
          postText,
          imagePrompt,
          imageUrl: null,
          imageError: 'Image generation failed. You can add an image manually.',
          topic,
          sources
        },
        metadata: {
          model: 'FLUX.1-pro',
          generatedAt: new Date().toISOString(),
          imageGenerated: false
        }
      })
    }

    const imageResult = await response.json()
    const imageUrl = imageResult.images?.[0]?.url || imageResult.output?.[0] || null

    const resultData = {
      postText,
      imagePrompt,
      imageUrl,
      topic,
      sources,
      ready: true
    }

    // Store final result in session
    if (sessionId) {
      await supabase
        .from('playbook_sessions')
        .update({
          state: supabase.rpc('jsonb_set_nested', {
            target: 'state',
            path: `{steps,${stepId || 'generate_image'}}`,
            value: JSON.stringify({
              status: 'completed',
              output: resultData,
              completedAt: new Date().toISOString()
            })
          }),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
    }

    return NextResponse.json({
      success: true,
      data: resultData,
      metadata: {
        model: 'FLUX.1-pro',
        generatedAt: new Date().toISOString(),
        imageGenerated: !!imageUrl
      }
    })

  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
