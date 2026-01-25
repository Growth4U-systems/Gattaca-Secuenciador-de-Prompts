import { Polar } from '@polar-sh/sdk';

// Cliente de Polar para server-side
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
});

// Organization ID para filtrar operaciones
export const POLAR_ORGANIZATION_ID = process.env.POLAR_ORGANIZATION_ID!;

// Un solo evento para trackear créditos (1 crédito = $1)
// IMPORTANTE: El nombre debe coincidir con el meter creado en Polar Dashboard
export const POLAR_EVENTS = {
  CREDIT_USAGE: 'credits',
} as const;

export type PolarEventType = (typeof POLAR_EVENTS)[keyof typeof POLAR_EVENTS];

// ============================================
// Costos por servicio (en dólares)
// ============================================

/**
 * Costos de LLM por modelo (dólares por 1M tokens)
 * Promedio entre input y output tokens
 */
export const LLM_COSTS: Record<string, number> = {
  // OpenAI
  'gpt-4o': 5.0, // ~$2.50 input + $10 output avg
  'gpt-4o-mini': 0.3, // ~$0.15 input + $0.60 output avg
  'gpt-4-turbo': 15.0,
  'gpt-3.5-turbo': 0.75,
  // Anthropic
  'claude-3-5-sonnet': 9.0, // ~$3 input + $15 output avg
  'claude-3-opus': 45.0,
  'claude-3-haiku': 0.625,
  // Google
  'gemini-1.5-pro': 3.5,
  'gemini-1.5-flash': 0.15,
  'gemini-2.0-flash': 0.15,
  // DeepSeek
  deepseek: 0.27,
  'deepseek-chat': 0.27,
  'deepseek-coder': 0.27,
  // Llama
  'llama-3.1-70b': 0.88,
  'llama-3.1-8b': 0.18,
  // Default fallback
  default: 0.3,
};

/**
 * Costos de scraping por proveedor (dólares por página)
 */
export const SCRAPE_COSTS: Record<string, number> = {
  firecrawl: 0.001, // $1 per 1000 pages
  apify: 0.002, // $2 per 1000 pages (estimate)
  jina: 0.0005, // $0.50 per 1000 pages (estimate)
  default: 0.001,
};

/**
 * Costos de SERP por proveedor (dólares por búsqueda)
 */
export const SERP_COSTS: Record<string, number> = {
  serper: 0.001, // $1 per 1000 searches
  google: 0.005, // $5 per 1000 searches (estimate)
  default: 0.001,
};

/**
 * Costos de video por proveedor (dólares por segundo)
 */
export const VIDEO_COSTS: Record<string, number> = {
  fal: 0.01, // $0.01 per second (estimate)
  wavespeed: 0.008, // $0.008 per second (estimate)
  default: 0.01,
};

// ============================================
// Helpers para calcular costos
// ============================================

/**
 * Calcula el costo en dólares para uso de LLM
 * @param tokens - Número de tokens usados
 * @param model - Nombre del modelo
 * @returns Costo en dólares (créditos)
 */
export function calculateLLMCost(tokens: number, model: string): number {
  const modelLower = model.toLowerCase();

  // Buscar el modelo en la tabla de costos
  for (const [key, cost] of Object.entries(LLM_COSTS)) {
    if (key !== 'default' && modelLower.includes(key)) {
      return (tokens / 1_000_000) * cost;
    }
  }

  // Fallback al costo default
  return (tokens / 1_000_000) * LLM_COSTS.default;
}

/**
 * Calcula el costo en dólares para scraping
 */
export function calculateScrapeCost(
  pages: number,
  provider: string = 'firecrawl'
): number {
  const cost = SCRAPE_COSTS[provider] ?? SCRAPE_COSTS.default;
  return pages * cost;
}

/**
 * Calcula el costo en dólares para SERP
 */
export function calculateSerpCost(
  searches: number,
  provider: string = 'serper'
): number {
  const cost = SERP_COSTS[provider] ?? SERP_COSTS.default;
  return searches * cost;
}

/**
 * Calcula el costo en dólares para video
 */
export function calculateVideoCost(
  durationSec: number,
  provider: string = 'fal'
): number {
  const cost = VIDEO_COSTS[provider] ?? VIDEO_COSTS.default;
  return durationSec * cost;
}
