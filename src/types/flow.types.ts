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
export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'groq'

// Modelos disponibles por proveedor
export type GeminiModel = 'gemini-2.0-flash-exp' | 'gemini-2.0-pro-exp' | 'gemini-2.5-flash' | 'gemini-2.5-pro'
export type OpenAIModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'gpt-3.5-turbo'
export type AnthropicModel = 'claude-3-5-sonnet-20241022' | 'claude-3-5-haiku-20241022' | 'claude-3-opus-20240229'
export type GroqModel = 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant' | 'mixtral-8x7b-32768'

export type LLMModel = GeminiModel | OpenAIModel | AnthropicModel | GroqModel

// Configuración de fallback
export interface FallbackConfig {
  enabled: boolean
  models: LLMModel[]  // Orden de fallback
  max_retries?: number  // Reintentos por modelo (default: 2)
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
