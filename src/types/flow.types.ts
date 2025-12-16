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

// AI Provider types
export type AIProvider = 'gemini' | 'openai' | 'perplexity'

export type GeminiModel = 'gemini-2.0-flash' | 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-3-pro'
export type OpenAIModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'o1' | 'o1-mini'
export type PerplexityModel = 'sonar' | 'sonar-pro' | 'sonar-reasoning' | 'sonar-reasoning-pro'

export type AIModel = GeminiModel | OpenAIModel | PerplexityModel

export interface AIModelOption {
  provider: AIProvider
  model: AIModel
  label: string
  description?: string
}

export const AI_MODELS: AIModelOption[] = [
  // Gemini
  { provider: 'gemini', model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Rápido y económico' },
  { provider: 'gemini', model: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Alta calidad' },
  // OpenAI
  { provider: 'openai', model: 'gpt-4o', label: 'GPT-4o', description: 'Multimodal, rápido' },
  { provider: 'openai', model: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Económico' },
  { provider: 'openai', model: 'o1', label: 'o1', description: 'Razonamiento avanzado' },
  { provider: 'openai', model: 'o1-mini', label: 'o1 Mini', description: 'Razonamiento económico' },
]

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

  // Configuración opcional del modelo
  model?: AIModel
  provider?: AIProvider
  temperature?: number
  max_tokens?: number
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
