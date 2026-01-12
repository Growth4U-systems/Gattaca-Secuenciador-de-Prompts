import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * GET /api/v2/config/status
 * Returns the status of configured APIs
 */
export async function GET() {
  try {
    // Check which APIs are configured
    const status = {
      openrouter: !!process.env.OPENROUTER_API_KEY,
      supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      blob: !!process.env.BLOB_READ_WRITE_TOKEN,
      // Legacy direct API keys (optional, OpenRouter covers all LLMs)
      anthropic_direct: !!process.env.ANTHROPIC_API_KEY,
      openai_direct: !!process.env.OPENAI_API_KEY,
      google_direct: !!process.env.GOOGLE_API_KEY,
    }

    // Get available models based on configuration
    const availableProviders = status.openrouter
      ? ['anthropic', 'openai', 'google', 'meta', 'deepseek', 'xai']
      : []

    return NextResponse.json({
      success: true,
      status,
      availableProviders,
      primaryLLMProvider: status.openrouter ? 'openrouter' : null,
      message: status.openrouter
        ? 'OpenRouter configurado - todos los modelos disponibles'
        : 'OpenRouter no configurado - agregar OPENROUTER_API_KEY',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error checking API status', details: error.message },
      { status: 500 }
    )
  }
}
