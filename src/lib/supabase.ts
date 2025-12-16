import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client - automatically uses the correct environment:
 * - Development: Uses .env.local (local Supabase instance at http://localhost:54321)
 * - Production: Uses .env or Vercel environment variables (cloud Supabase)
 *
 * To start local Supabase: npx supabase start
 * To stop local Supabase: npx supabase stop
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Check if we're using local Supabase instance
 */
export const isLocalSupabase = () => {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost')
}

// Token limit constants
export const TOKEN_LIMITS = {
  WARNING_THRESHOLD: 1_500_000, // 1.5M tokens
  MAX_LIMIT: 2_000_000, // 2M tokens
  GEMINI_2_5_PRO_LIMIT: 2_097_152, // Official limit for Gemini 2.5 Pro
} as const

// Estimate tokens (simple approximation: chars / 4)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Check if context exceeds limits
export function checkTokenLimits(totalTokens: number): {
  isOverLimit: boolean
  shouldWarn: boolean
  percentage: number
} {
  const percentage = (totalTokens / TOKEN_LIMITS.MAX_LIMIT) * 100

  return {
    isOverLimit: totalTokens > TOKEN_LIMITS.MAX_LIMIT,
    shouldWarn: totalTokens > TOKEN_LIMITS.WARNING_THRESHOLD,
    percentage: Math.round(percentage),
  }
}

// Format token count for display
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(2)}M`
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`
  }
  return count.toString()
}
