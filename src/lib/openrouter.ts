/**
 * OpenRouter utilities for API calls
 * Handles user-specific API keys with fallback to server key
 */
import { createClient } from '@supabase/supabase-js'
import { decryptAPIKey } from './encryption'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export interface OpenRouterKeyResult {
  key: string
  source: 'user' | 'agency' | 'server'
  userId?: string
}

/**
 * Get the best available OpenRouter API key
 * Priority: User's key > Agency key > Server key
 *
 * @param userId - The user ID to check for personal/agency keys
 * @returns The API key and its source
 * @throws Error if no API key is available
 */
export async function getOpenRouterKey(userId?: string): Promise<OpenRouterKeyResult> {
  // If no userId provided, use server key directly
  if (!userId) {
    const serverKey = process.env.OPENROUTER_API_KEY
    if (!serverKey) {
      throw new Error('No OpenRouter API key configured')
    }
    return { key: serverKey, source: 'server' }
  }

  const supabase = getSupabaseClient()

  try {
    // 1. Try user's personal key from user_openrouter_tokens
    const { data: userToken } = await supabase
      .from('user_openrouter_tokens')
      .select('encrypted_api_key')
      .eq('user_id', userId)
      .single()

    if (userToken?.encrypted_api_key) {
      try {
        const decrypted = decryptAPIKey(userToken.encrypted_api_key)
        // Update last_used_at
        await supabase
          .from('user_openrouter_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .eq('user_id', userId)

        return { key: decrypted, source: 'user', userId }
      } catch (decryptError) {
        console.warn('Failed to decrypt user API key:', decryptError)
        // Delete invalid token
        await supabase
          .from('user_openrouter_tokens')
          .delete()
          .eq('user_id', userId)
      }
    }

    // 2. Try agency key (via agency_members → agencies)
    const { data: membership } = await supabase
      .from('agency_members')
      .select('agency_id, agencies(id, openrouter_api_key)')
      .eq('user_id', userId)
      .single()

    // Handle the joined data - agencies comes as an object, not array
    const agencyData = membership?.agencies as { id: string; openrouter_api_key: string | null } | null

    if (agencyData?.openrouter_api_key) {
      try {
        const decrypted = decryptAPIKey(agencyData.openrouter_api_key)
        // Update last_used_at on agency
        await supabase
          .from('agencies')
          .update({ openrouter_key_last_used_at: new Date().toISOString() })
          .eq('id', agencyData.id)

        return { key: decrypted, source: 'agency', userId }
      } catch (decryptError) {
        console.warn('Failed to decrypt agency API key:', decryptError)
      }
    }

    // 3. Fall back to server key
    const serverKey = process.env.OPENROUTER_API_KEY
    if (!serverKey) {
      throw new Error('No OpenRouter API key available. Please connect your OpenRouter account or configure a server key.')
    }

    return { key: serverKey, source: 'server' }
  } catch (err) {
    // If there's an error, try server key
    const serverKey = process.env.OPENROUTER_API_KEY
    if (!serverKey) {
      throw new Error('No OpenRouter API key available')
    }
    return { key: serverKey, source: 'server' }
  }
}

/**
 * Make a chat completion request to OpenRouter
 *
 * @param options - Request options
 * @returns The API response
 */
export async function openRouterChat(options: {
  userId?: string
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
}): Promise<{
  content: string
  tokens: { input: number; output: number }
  model: string
  keySource: 'user' | 'agency' | 'server'
}> {
  const { userId, model, messages, temperature = 0.7, maxTokens = 4096 } = options

  // Get the appropriate API key
  const { key, source } = await getOpenRouterKey(userId)

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://gattaca.app',
      'X-Title': 'Gattaca',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
  }

  const data = await response.json()

  return {
    content: data.choices?.[0]?.message?.content || '',
    tokens: {
      input: data.usage?.prompt_tokens || 0,
      output: data.usage?.completion_tokens || 0,
    },
    model: data.model || model,
    keySource: source,
  }
}

/**
 * Mark a user's OpenRouter key as invalid
 * Used when the key returns auth errors
 */
export async function invalidateOpenRouterKey(userId: string): Promise<void> {
  const supabase = getSupabaseClient()

  // Delete the invalid token
  await supabase
    .from('user_openrouter_tokens')
    .delete()
    .eq('user_id', userId)
}
