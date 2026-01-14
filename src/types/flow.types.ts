/**
 * Flow Builder Types
 *
 * Tipos para el sistema de flow builder dinámico.
 * Permite configurar procesos de análisis customizables con:
 * - Steps ordenables
 * - Documentos base asignables
 * - Auto-conexión de outputs entre steps
 * - Prompts editables con variables
 */

export type OutputFormat = 'text' | 'markdown' | 'json' | 'csv' | 'html' | 'xml'

// Proveedores LLM soportados
export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'deep-research'

// Modelos disponibles por proveedor (IDs reales de API)
export type GeminiModel = 'gemini-3.0-pro-preview' | 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.5-flash-lite'
export type OpenAIModel = 'gpt-5.2' | 'gpt-5' | 'gpt-5-mini' | 'gpt-4.1' | 'gpt-4.1-mini' | 'gpt-4o' | 'gpt-4o-mini' | 'o1' | 'o1-mini' | 'o3' | 'o3-mini' | 'o3-pro' | 'o4-mini'
export type AnthropicModel = 'claude-4.5-opus' | 'claude-4.5-sonnet' | 'claude-4.5-haiku'
export type GroqModel = 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant' | 'mixtral-8x7b-32768'

// Google Deep Research - Agente autónomo de investigación (usa Interactions API, no generateContent)
export type DeepResearchModel = 'deep-research-pro-preview-12-2025'

// LLMModel ahora acepta strings genéricos para soportar IDs de OpenRouter (ej: "google/gemini-2.5-flash-preview")
export type LLMModel = GeminiModel | OpenAIModel | AnthropicModel | GroqModel | DeepResearchModel | string

// Configuración de fallback
export interface FallbackConfig {
  enabled: boolean
  models: LLMModel[]  // Orden de fallback
  max_retries?: number  // Reintentos por modelo (default: 2)
}

// Modo de recuperación de documentos
export type RetrievalMode = 'full' | 'rag'

// Configuración de RAG
export interface RAGConfig {
  top_k: number       // Número de chunks a recuperar (default: 10)
  min_score: number   // Score mínimo de similitud (default: 0.7)
}

// Precios de modelos para estimación de costos (USD por millón de tokens)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-3.0-pro-preview': { input: 2.00, output: 12.00 },
  'google/gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'google/gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'google/gemini-3-pro-preview': { input: 2.00, output: 12.00 },
  'gpt-4o': { input: 2.50, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'claude-4.5-sonnet': { input: 3.00, output: 15.0 },
  'claude-4.5-opus': { input: 15.00, output: 75.0 },
  // Default para modelos desconocidos
  'default': { input: 1.00, output: 5.00 },
}

// Documento requerido por un paso (para matching inteligente)
export interface RequiredDocument {
  id: string                    // UUID generado
  name: string                  // Nombre/descripción del documento requerido
  required: boolean             // true = obligatorio, false = opcional
  matchedDocId?: string         // ID del documento asignado (si hay match)
  matchConfidence?: number      // 0-1, confianza del match
}

export interface FlowStep {
  id: string
  name: string
  description?: string
  order: number

  // Prompt con variables: {{ecp_name}}, {{country}}, etc.
  prompt: string

  // Documentos base (ya subidos) que se usan en este step
  base_doc_ids: string[]

  // Documentos requeridos por el paso (para matching inteligente)
  required_documents?: RequiredDocument[]

  // IDs de steps previos cuyos outputs se incluyen automáticamente
  auto_receive_from: string[]

  // Formato de salida deseado
  output_format?: OutputFormat

  // Configuración del modelo LLM
  provider?: LLMProvider  // Default: 'gemini'
  model?: LLMModel
  temperature?: number
  max_tokens?: number

  // Configuración de fallback (opcional)
  fallback?: FallbackConfig

  // Modo de recuperación de documentos
  retrieval_mode?: RetrievalMode  // Default: 'full'
  rag_config?: RAGConfig
}

export interface FlowConfig {
  steps: FlowStep[]
  version?: string
  description?: string
}

export interface StepOutput {
  step_id: string
  step_name: string
  output: string
  tokens: number
  status: 'pending' | 'running' | 'completed' | 'error'
  started_at?: string
  completed_at?: string
  error_message?: string
}

export interface CampaignExecutionState {
  status: 'draft' | 'running' | 'paused' | 'completed' | 'error'
  current_step_id: string | null
  step_outputs: Record<string, StepOutput>
  started_at: string | null
  completed_at: string | null
  error_message?: string
}

// Variables disponibles en prompts
export interface PromptVariables {
  ecp_name: string
  problem_core: string
  country: string
  industry: string
  client_name: string
}

// Request para ejecutar un step individual
export interface ExecuteStepRequest {
  campaign_id: string
  step_config: FlowStep
  variables: PromptVariables
  documents: Array<{
    id: string
    filename: string
    content: string
    category: string
  }>
  previous_outputs: StepOutput[]
}

// Request para ejecutar campaña completa
export interface ExecuteCampaignRequest {
  campaign_id: string
}

// Response de ejecución
export interface ExecutionResponse {
  success: boolean
  output?: string
  tokens?: {
    input: number
    output: number
    total: number
  }
  duration_ms?: number
  error?: string
}
