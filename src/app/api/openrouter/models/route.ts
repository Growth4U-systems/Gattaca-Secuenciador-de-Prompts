import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { decryptToken } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

interface OpenRouterModel {
  id: string
  name: string
  description?: string
  context_length: number
  pricing: {
    prompt: string
    completion: string
  }
  top_provider?: {
    max_completion_tokens?: number
  }
  architecture?: {
    modality?: string
    tokenizer?: string
    instruct_type?: string
  }
}

interface FormattedModel {
  id: string
  name: string
  provider: string
  contextLength: number
  maxOutputTokens: number
  pricing: {
    input: number  // per 1M tokens
    output: number // per 1M tokens
  }
  description?: string
}

// Extract provider from model ID (e.g., "openai/gpt-4o" -> "OpenAI")
function getProviderName(modelId: string): string {
  const providerMap: Record<string, string> = {
    'openai': 'OpenAI',
    'anthropic': 'Anthropic',
    'google': 'Google',
    'meta-llama': 'Meta',
    'mistralai': 'Mistral',
    'cohere': 'Cohere',
    'perplexity': 'Perplexity',
    'deepseek': 'DeepSeek',
    'qwen': 'Qwen',
    'x-ai': 'xAI',
  }

  const provider = modelId.split('/')[0]
  return providerMap[provider] || provider.charAt(0).toUpperCase() + provider.slice(1)
}

// Filter for text-generation models only (exclude image generators, embeddings, etc.)
function isTextModel(model: OpenRouterModel): boolean {
  const modality = model.architecture?.modality || ''

  // Must output text only (not images/audio)
  // Valid: "text->text", "text+image->text" (multimodal input, text output)
  // Invalid: "text->image", "text+image->text+image", etc.
  if (modality && !modality.endsWith('->text')) {
    return false
  }

  // Skip embedding models
  if (model.id.includes('embed') || model.id.includes('embedding')) {
    return false
  }

  // Skip audio/speech models
  if (model.id.includes('audio') || model.id.includes('speech') || model.id.includes('tts') || model.id.includes('whisper')) {
    return false
  }

  // Skip image generation models
  if (model.id.includes('dall-e') || model.id.includes('stable-diffusion') || model.id.includes('midjourney')) {
    return false
  }

  // Skip deprecated/preview models that don't work well
  if (model.id.includes('gemini-2.0') || model.id.includes('preview') && !model.id.includes('gemini-3')) {
    return false
  }

  return true
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    let apiKey: string | null = null
    let keySource: 'user' | 'agency' = 'user'

    // 1. Try user's personal token first
    const { data: tokenRecord } = await supabase
      .from('user_openrouter_tokens')
      .select('encrypted_api_key')
      .eq('user_id', userId)
      .single()

    if (tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
      try {
        apiKey = decryptToken(tokenRecord.encrypted_api_key)
        keySource = 'user'
      } catch {
        console.warn('Failed to decrypt user OpenRouter key')
      }
    }

    // 2. If no user key, try agency key
    if (!apiKey) {
      const { data: membership } = await supabase
        .from('agency_members')
        .select('agency_id, agencies(id, openrouter_api_key)')
        .eq('user_id', userId)
        .single()

      const agencyData = membership?.agencies as unknown as {
        id: string
        openrouter_api_key: string | null
      } | null

      if (agencyData?.openrouter_api_key) {
        try {
          apiKey = decryptToken(agencyData.openrouter_api_key)
          keySource = 'agency'
        } catch {
          console.warn('Failed to decrypt agency OpenRouter key')
        }
      }
    }

    // 3. No key available
    if (!apiKey) {
      return NextResponse.json({
        connected: false,
        models: [],
        message: 'OpenRouter not connected',
      })
    }

    // Fetch models from OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenRouter models API error:', errorText)
      return NextResponse.json({
        connected: true,
        models: [],
        error: 'Failed to fetch models from OpenRouter',
      })
    }

    const data = await response.json()
    const models: OpenRouterModel[] = data.data || []

    // Filter and format models
    const formattedModels: FormattedModel[] = models
      .filter(isTextModel)
      .map((model) => ({
        id: model.id,
        name: model.name || model.id.split('/').pop() || model.id,
        provider: getProviderName(model.id),
        contextLength: model.context_length || 0,
        maxOutputTokens: model.top_provider?.max_completion_tokens || 4096,
        pricing: {
          input: parseFloat(model.pricing?.prompt || '0') * 1_000_000,
          output: parseFloat(model.pricing?.completion || '0') * 1_000_000,
        },
        description: model.description,
      }))
      .sort((a, b) => {
        // Sort by provider first, then by name
        if (a.provider !== b.provider) {
          const providerOrder = ['OpenAI', 'Anthropic', 'Google', 'Meta', 'Mistral']
          const aIndex = providerOrder.indexOf(a.provider)
          const bIndex = providerOrder.indexOf(b.provider)
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
          if (aIndex !== -1) return -1
          if (bIndex !== -1) return 1
          return a.provider.localeCompare(b.provider)
        }
        return a.name.localeCompare(b.name)
      })

    // Group by provider
    const groupedModels: Record<string, FormattedModel[]> = {}
    for (const model of formattedModels) {
      if (!groupedModels[model.provider]) {
        groupedModels[model.provider] = []
      }
      groupedModels[model.provider].push(model)
    }

    return NextResponse.json({
      connected: true,
      source: keySource,
      models: formattedModels,
      grouped: groupedModels,
      count: formattedModels.length,
    })
  } catch (error) {
    console.error('OpenRouter models error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
