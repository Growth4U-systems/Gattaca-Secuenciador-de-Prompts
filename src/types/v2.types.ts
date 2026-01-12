/**
 * Gattaca v2 Types
 *
 * Sistema v2 con:
 * - Multi-tenancy: Agencies > Clients > Documents
 * - Context Lake: Sistema de documentos con 3 tiers de autoridad
 * - Playbooks: Templates de procesos reutilizables
 */

// ============================================================================
// ENUMS
// ============================================================================

export type DocumentTier = 1 | 2 | 3
export type ApprovalStatus = 'draft' | 'approved' | 'archived'
export type PlaybookType = 'playbook' | 'enricher'
export type PlaybookStatus = 'draft' | 'active' | 'archived'
export type ExecutionStatus = 'pending' | 'running' | 'waiting_human' | 'completed' | 'failed' | 'cancelled'
export type ContentFormat = 'markdown' | 'json' | 'text' | 'html'
export type SourceType = 'manual' | 'enricher' | 'ingestion' | 'import' | 'playbook_output'
export type BlockType = 'prompt' | 'conditional' | 'human_review' | 'loop'
export type HitlInterfaceType = 'approve_reject' | 'edit' | 'select_option'
export type OutputDestination = 'asset_library' | 'context_lake' | 'export'

// ============================================================================
// AGENCY
// ============================================================================

export interface Agency {
  id: string
  name: string
  slug: string
  owner_id: string | null
  settings: AgencySettings
  created_at: string
  updated_at: string
}

export interface AgencySettings {
  timezone?: string
  default_model?: string
  branding?: {
    logo_url?: string
    primary_color?: string
  }
  [key: string]: unknown
}

export type AgencyInsert = Omit<Agency, 'id' | 'created_at' | 'updated_at'>
export type AgencyUpdate = Partial<AgencyInsert>

// ============================================================================
// CLIENT (replaces Project)
// ============================================================================

export interface Client {
  id: string
  agency_id: string
  name: string
  slug: string
  industry: string | null
  website_url: string | null
  description: string | null
  status: 'active' | 'paused' | 'archived'
  competitors: Competitor[]
  social_channels: SocialChannels
  settings: ClientSettings
  created_at: string
  updated_at: string
}

export interface Competitor {
  name: string
  url?: string
  notes?: string
}

export interface SocialChannels {
  linkedin?: string
  twitter?: string
  instagram?: string
  facebook?: string
  youtube?: string
  tiktok?: string
  [key: string]: string | undefined
}

export interface ClientSettings {
  legacy_flow_config?: unknown
  legacy_variable_definitions?: unknown
  legacy_context_config?: unknown
  legacy_prompts?: unknown
  [key: string]: unknown
}

export type ClientInsert = Omit<Client, 'id' | 'created_at' | 'updated_at' | 'slug'> & {
  slug?: string
}
export type ClientUpdate = Partial<ClientInsert>

// ============================================================================
// PROJECT (within Client)
// ============================================================================

export interface Project {
  id: string
  client_id: string
  name: string
  slug: string
  description: string | null
  status: 'active' | 'paused' | 'archived' | 'completed'
  project_type: string | null
  start_date: string | null
  end_date: string | null
  goals: ProjectGoal[]
  settings: ProjectSettings
  legacy_flow_config: unknown | null
  legacy_variable_definitions: unknown | null
  legacy_prompts: unknown | null
  created_at: string
  updated_at: string
}

export interface ProjectGoal {
  name: string
  target: number
  current: number
  unit: string
}

export interface ProjectSettings {
  default_playbook_id?: string
  notification_emails?: string[]
  [key: string]: unknown
}

export type ProjectInsert = Omit<Project, 'id' | 'created_at' | 'updated_at' | 'slug'> & {
  slug?: string
}
export type ProjectUpdate = Partial<ProjectInsert>

export const PROJECT_TYPES = [
  { value: 'campaign', label: 'Campaña', description: 'Campaña de marketing con fecha de inicio y fin' },
  { value: 'evergreen', label: 'Evergreen', description: 'Contenido perenne sin fecha de expiración' },
  { value: 'research', label: 'Research', description: 'Proyecto de investigación o análisis' },
  { value: 'content_series', label: 'Serie de Contenido', description: 'Serie de contenidos relacionados' },
  { value: 'product_launch', label: 'Lanzamiento', description: 'Lanzamiento de producto o servicio' },
  { value: 'rebranding', label: 'Rebranding', description: 'Proyecto de cambio de marca' },
] as const

// ============================================================================
// DOCUMENT (Context Lake)
// ============================================================================

export interface Document {
  id: string
  client_id: string
  title: string
  slug: string
  tier: DocumentTier
  document_type: string
  content: string | null
  content_format: ContentFormat
  authority_score: number
  author_id: string | null
  approval_status: ApprovalStatus
  validity_start: string
  validity_end: string | null
  source_type: SourceType
  source_id: string | null
  source_file_url: string | null
  source_file_name: string | null
  token_count: number
  created_at: string
  updated_at: string
  // Synthesis-related fields
  is_compiled_foundational?: boolean
  synthesis_job_id?: string | null
  completeness_score?: number | null
  requires_review?: boolean
  reviewed_at?: string | null
  reviewed_by?: string | null
  // Version control fields
  version?: number
  previous_version_id?: string | null
  is_stale?: boolean
  sources_hash?: string | null
}

export type DocumentInsert = Omit<Document, 'id' | 'created_at' | 'updated_at' | 'authority_score' | 'token_count' | 'slug'> & {
  slug?: string
}
export type DocumentUpdate = Partial<DocumentInsert>

// ============================================================================
// PLAYBOOK
// ============================================================================

export interface Playbook {
  id: string
  agency_id: string
  name: string
  slug: string
  description: string | null
  type: PlaybookType
  tags: string[]
  config: PlaybookConfig
  version: string
  status: PlaybookStatus
  schedule_enabled: boolean
  schedule_cron: string | null
  schedule_timezone: string
  author_id: string | null
  created_at: string
  updated_at: string
}

export interface PlaybookConfig {
  blocks: PlaybookBlock[]
  context_requirements: ContextRequirements
  input_schema: InputSchema
  output_config: OutputConfig
}

export interface ContextRequirements {
  required_documents: string[]  // document IDs or types
  required_tiers?: DocumentTier[]
  dynamic_queries?: string[]
}

export interface InputSchema {
  [key: string]: InputField
}

export interface InputField {
  type: 'string' | 'number' | 'boolean' | 'select' | 'textarea'
  required: boolean
  label?: string
  description?: string
  default?: string | number | boolean
  options?: string[]  // for 'select' type
}

export interface OutputConfig {
  destination: OutputDestination
  asset_type?: string
  document_tier?: DocumentTier
  document_type?: string
}

export interface PlaybookBlock {
  id: string
  name: string
  type: BlockType
  order: number
  description?: string

  // For 'prompt' type
  prompt?: string
  model?: string
  provider?: string
  temperature?: number
  max_tokens?: number
  output_format?: string

  // Context
  context_docs?: string[]  // document IDs
  context_tiers?: DocumentTier[]
  receives_from?: string[]  // block IDs

  // For 'conditional' type
  condition?: string
  if_block_id?: string
  else_block_id?: string

  // For 'loop' type
  items_source?: string
  loop_block_ids?: string[]

  // For 'human_review' type
  hitl_config?: HitlConfig
}

export interface HitlConfig {
  enabled: boolean
  interface_type: HitlInterfaceType
  prompt?: string
  options?: string[]
  timeout_hours?: number
  auto_approve_on_timeout?: boolean
}

export type PlaybookInsert = Omit<Playbook, 'id' | 'created_at' | 'updated_at' | 'slug'> & {
  slug?: string
}
export type PlaybookUpdate = Partial<PlaybookInsert>

// ============================================================================
// PLAYBOOK EXECUTION
// ============================================================================

export interface PlaybookExecution {
  id: string
  playbook_id: string | null
  client_id: string
  input_data: Record<string, unknown>
  status: ExecutionStatus
  current_block_id: string | null
  block_outputs: Record<string, BlockOutput>
  hitl_pending: HitlPending | null
  context_snapshot: ContextSnapshot
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  triggered_by: string | null
  created_at: string
  updated_at: string
}

export interface BlockOutput {
  output: string
  tokens: {
    input: number
    output: number
    total?: number
  }
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped' | 'waiting'
  started_at?: string
  completed_at?: string
  error_message?: string
  model_used?: string
  duration_ms?: number
}

export interface HitlPending {
  block_id: string
  block_name: string
  interface_type: HitlInterfaceType
  prompt?: string
  options?: string[]
  current_output?: string
  context?: Record<string, unknown>
  requested_at: string
  timeout_at?: string
}

export interface ContextSnapshot {
  documents_used: Array<{
    id: string
    title: string
    tier: DocumentTier
    authority_score: number
    token_count: number
  }>
  total_tokens: number
  captured_at: string
}

export type ExecutionInsert = Omit<PlaybookExecution, 'id' | 'created_at' | 'updated_at' | 'block_outputs' | 'context_snapshot'> & {
  block_outputs?: Record<string, BlockOutput>
  context_snapshot?: ContextSnapshot
}

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

export const TIER_CONFIG = {
  1: {
    name: 'Cimientos',
    label: 'Tier 1 - Cimientos',
    color: 'amber',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    textClass: 'text-amber-800',
    badgeClass: 'bg-amber-100 text-amber-800',
    icon: 'Crown',
    authorityBase: 1.0,
    description: 'Los fundamentos. Brand DNA, ICP, Tone of Voice, Producto.',
    usage: 'foundation',  // foundational documents
  },
  2: {
    name: 'Estrategia',
    label: 'Tier 2 - Estrategia',
    color: 'blue',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    textClass: 'text-blue-800',
    badgeClass: 'bg-blue-100 text-blue-800',
    icon: 'Target',
    authorityBase: 0.6,
    description: 'Derivados de los cimientos. Briefs, análisis, research.',
    usage: 'derived',  // derived/analyzed from tier 1
  },
  3: {
    name: 'Assets',
    label: 'Tier 3 - Assets',
    color: 'slate',
    bgClass: 'bg-slate-50',
    borderClass: 'border-slate-200',
    textClass: 'text-slate-700',
    badgeClass: 'bg-slate-100 text-slate-700',
    icon: 'Clock',
    authorityBase: 0.2,
    description: 'Contenido final. Posts, copies, creativos, entregables.',
    usage: 'output',  // final content/assets
  },
} as const

export const DOCUMENT_TYPES = [
  // Tier 1 - Fundacionales
  {
    value: 'brand_dna',
    label: 'Brand DNA',
    tier: 1 as DocumentTier,
    icon: 'Dna',
    description: 'La esencia de tu marca: misión, visión, valores, personalidad y propuesta de valor única.',
    examples: ['Manifesto de marca', 'Guía de identidad', 'Documento de posicionamiento'],
    requiredFor: ['Contenido de marca', 'Campañas', 'Copywriting'],
  },
  {
    value: 'icp',
    label: 'ICP / Buyer Persona',
    tier: 1 as DocumentTier,
    icon: 'Users',
    description: 'Perfil detallado de tu cliente ideal: demografía, psicografía, dolores, metas y comportamiento de compra.',
    examples: ['Buyer persona', 'Perfil de cliente ideal', 'Segmentación de mercado'],
    requiredFor: ['Targeting', 'Contenido personalizado', 'Estrategia de ventas'],
  },
  {
    value: 'tone_of_voice',
    label: 'Tone of Voice',
    tier: 1 as DocumentTier,
    icon: 'MessageSquare',
    description: 'Guía de cómo habla tu marca: vocabulario, estilo, personalidad en la comunicación.',
    examples: ['Guía de tono', 'Manual de estilo', 'Vocabulario de marca'],
    requiredFor: ['Copywriting', 'Social media', 'Atención al cliente'],
  },
  {
    value: 'product_docs',
    label: 'Product Documentation',
    tier: 1 as DocumentTier,
    icon: 'Package',
    description: 'Documentación técnica y comercial de tus productos o servicios.',
    examples: ['Fichas técnicas', 'Catálogos', 'Especificaciones'],
    requiredFor: ['Contenido de producto', 'Sales enablement', 'Soporte'],
  },
  {
    value: 'pricing',
    label: 'Pricing',
    tier: 1 as DocumentTier,
    icon: 'DollarSign',
    description: 'Estructura de precios, paquetes, descuentos y políticas comerciales.',
    examples: ['Lista de precios', 'Tabla de planes', 'Política de descuentos'],
    requiredFor: ['Propuestas comerciales', 'Landing pages', 'Cotizaciones'],
  },
  // Tier 2 - Operativos
  {
    value: 'competitor_analysis',
    label: 'Competitor Analysis',
    tier: 2 as DocumentTier,
    icon: 'Target',
    description: 'Análisis de competidores: fortalezas, debilidades, estrategias y diferenciadores.',
    examples: ['Matriz competitiva', 'Análisis FODA', 'Benchmark de mercado'],
    requiredFor: ['Posicionamiento', 'Estrategia de precios', 'Diferenciación'],
  },
  {
    value: 'campaign_brief',
    label: 'Campaign Brief',
    tier: 2 as DocumentTier,
    icon: 'FileText',
    description: 'Brief de campaña con objetivos, audiencia, mensaje clave y métricas de éxito.',
    examples: ['Brief creativo', 'Plan de campaña', 'Resumen ejecutivo'],
    requiredFor: ['Ejecución de campañas', 'Creativos', 'Medición'],
  },
  {
    value: 'market_research',
    label: 'Market Research',
    tier: 2 as DocumentTier,
    icon: 'TrendingUp',
    description: 'Investigación de mercado: tendencias, tamaño, oportunidades y amenazas.',
    examples: ['Estudio de mercado', 'Análisis de tendencias', 'Encuestas de clientes'],
    requiredFor: ['Estrategia', 'Desarrollo de producto', 'Expansión'],
  },
  {
    value: 'quarterly_playbook',
    label: 'Quarterly Playbook',
    tier: 2 as DocumentTier,
    icon: 'Calendar',
    description: 'Plan trimestral con objetivos, iniciativas clave y calendario de actividades.',
    examples: ['OKRs', 'Roadmap trimestral', 'Calendario editorial'],
    requiredFor: ['Planificación', 'Alineación de equipo', 'Seguimiento'],
  },
  // Tier 3 - Efímeros
  {
    value: 'output',
    label: 'Generated Output',
    tier: 3 as DocumentTier,
    icon: 'Sparkles',
    description: 'Contenido generado por IA o playbooks que puede usarse como referencia.',
    examples: ['Posts generados', 'Copies de anuncios', 'Scripts de video'],
    requiredFor: ['Iteraciones', 'Aprobación', 'Publicación'],
  },
  {
    value: 'reference',
    label: 'Reference Material',
    tier: 3 as DocumentTier,
    icon: 'BookOpen',
    description: 'Material de referencia externo: artículos, estudios, ejemplos inspiracionales.',
    examples: ['Artículos de blog', 'Casos de estudio', 'Ejemplos de competencia'],
    requiredFor: ['Inspiración', 'Benchmarking', 'Aprendizaje'],
  },
  {
    value: 'meeting_notes',
    label: 'Meeting Notes',
    tier: 3 as DocumentTier,
    icon: 'FileText',
    description: 'Notas de reuniones con clientes, equipo o stakeholders.',
    examples: ['Minutas', 'Acuerdos', 'Action items'],
    requiredFor: ['Seguimiento', 'Contexto', 'Alineación'],
  },
  {
    value: 'draft',
    label: 'Draft',
    tier: 3 as DocumentTier,
    icon: 'Edit',
    description: 'Borradores de documentos en proceso de creación o revisión.',
    examples: ['Borradores de contenido', 'Versiones preliminares', 'WIP'],
    requiredFor: ['Revisión', 'Colaboración', 'Aprobación'],
  },
] as const

export const BLOCK_TYPES = [
  { value: 'prompt' as BlockType, label: 'AI Prompt', icon: 'Sparkles', description: 'Ejecuta un prompt con IA' },
  { value: 'human_review' as BlockType, label: 'Human Review', icon: 'UserCheck', description: 'Espera aprobación humana' },
  { value: 'conditional' as BlockType, label: 'Conditional', icon: 'GitBranch', description: 'Bifurcación condicional' },
  { value: 'loop' as BlockType, label: 'Loop', icon: 'Repeat', description: 'Itera sobre elementos' },
] as const

// ============================================================================
// FOUNDATIONAL DOCUMENT PLACEHOLDERS
// ============================================================================

export interface FoundationalPlaceholder {
  id: string
  docType: string
  label: string
  tier: DocumentTier
  priority: 'critical' | 'important' | 'recommended'
  description: string
  whatItIs: string
  whyYouNeedIt: string
  howToCreate: string[]
  canGenerateWith: boolean  // Can be generated with AI playbook
  inputsNeeded: string[]    // What inputs are needed to generate
  estimatedTime: string     // Estimated time to complete
  icon: string
}

export const FOUNDATIONAL_PLACEHOLDERS: FoundationalPlaceholder[] = [
  {
    id: 'brand_dna',
    docType: 'brand_dna',
    label: 'Brand DNA',
    tier: 1,
    priority: 'critical',
    description: 'La esencia de tu marca: misión, visión, valores y propuesta de valor.',
    whatItIs: 'Un documento que define quién eres como marca, qué representas y qué te hace único. Incluye tu misión, visión, valores fundamentales, personalidad de marca y propuesta de valor diferenciada.',
    whyYouNeedIt: 'Sin Brand DNA, la IA no puede crear contenido que suene auténticamente como tu marca. Es la base de toda tu comunicación.',
    howToCreate: [
      'Sube tu documento de marca existente (PDF, Word, Notion)',
      'Responde un cuestionario guiado sobre tu marca',
      'Genera uno nuevo con IA basándose en tu sitio web y materiales',
    ],
    canGenerateWith: true,
    inputsNeeded: ['URL del sitio web', 'Materiales de marca existentes (opcional)', 'Respuestas a preguntas clave'],
    estimatedTime: '15-30 min',
    icon: 'Dna',
  },
  {
    id: 'icp',
    docType: 'icp',
    label: 'ICP / Buyer Persona',
    tier: 1,
    priority: 'critical',
    description: 'Perfil detallado de tu cliente ideal.',
    whatItIs: 'Un documento que describe a tu cliente ideal: quién es, qué problemas tiene, qué busca, cómo toma decisiones de compra, y dónde encontrarlo.',
    whyYouNeedIt: 'Para crear contenido que resuene con tu audiencia. Sin ICP, el contenido será genérico y no conectará emocionalmente.',
    howToCreate: [
      'Sube tu documento de buyer persona existente',
      'Importa datos de tu CRM o analytics',
      'Genera uno con IA analizando tu base de clientes',
    ],
    canGenerateWith: true,
    inputsNeeded: ['Industria', 'Producto/servicio', 'Clientes actuales (descripción)', 'Datos de analytics (opcional)'],
    estimatedTime: '20-40 min',
    icon: 'Users',
  },
  {
    id: 'tone_of_voice',
    docType: 'tone_of_voice',
    label: 'Tone of Voice',
    tier: 1,
    priority: 'critical',
    description: 'Guía de cómo habla y se comunica tu marca.',
    whatItIs: 'Un documento que define el estilo de comunicación de tu marca: vocabulario, tono, personalidad, lo que debes y no debes decir.',
    whyYouNeedIt: 'Para que todo el contenido generado tenga una voz consistente y reconocible. Es lo que hace que tu marca suene "como tú".',
    howToCreate: [
      'Sube tu guía de estilo o manual de marca',
      'Comparte ejemplos de contenido que te representa',
      'Genera uno con IA analizando tu contenido existente',
    ],
    canGenerateWith: true,
    inputsNeeded: ['Brand DNA (previo)', 'Ejemplos de contenido actual', 'Preferencias de tono'],
    estimatedTime: '15-25 min',
    icon: 'MessageSquare',
  },
  {
    id: 'product_docs',
    docType: 'product_docs',
    label: 'Documentación de Producto',
    tier: 1,
    priority: 'important',
    description: 'Información detallada de tus productos o servicios.',
    whatItIs: 'Documentación completa de lo que vendes: características, beneficios, casos de uso, especificaciones técnicas, FAQs.',
    whyYouNeedIt: 'Para crear contenido preciso sobre tus productos. Sin esto, la IA puede inventar características o dar información incorrecta.',
    howToCreate: [
      'Sube fichas técnicas o catálogos existentes',
      'Importa desde tu sitio web o e-commerce',
      'Crea un resumen guiado de cada producto',
    ],
    canGenerateWith: true,
    inputsNeeded: ['Lista de productos/servicios', 'Características principales', 'Beneficios clave', 'Precios'],
    estimatedTime: '30-60 min',
    icon: 'Package',
  },
  {
    id: 'competitor_analysis',
    docType: 'competitor_analysis',
    label: 'Análisis de Competencia',
    tier: 2,
    priority: 'recommended',
    description: 'Análisis de tus principales competidores.',
    whatItIs: 'Un documento que mapea a tus competidores: quiénes son, qué hacen bien, qué hacen mal, cómo te diferencias.',
    whyYouNeedIt: 'Para crear contenido que destaque tus diferenciadores y posicione tu marca frente a alternativas.',
    howToCreate: [
      'Sube tu análisis competitivo existente',
      'Lista tus competidores y deja que la IA investigue',
      'Genera un análisis completo con scraping e investigación',
    ],
    canGenerateWith: true,
    inputsNeeded: ['URLs de competidores', 'Tu posicionamiento actual', 'Diferenciadores clave'],
    estimatedTime: '20-45 min',
    icon: 'Target',
  },
]

// Helper to get completion status of foundational docs
export function getFoundationalStatus(documents: Document[]): {
  completed: string[]
  pending: FoundationalPlaceholder[]
  completionPercent: number
  criticalMissing: FoundationalPlaceholder[]
} {
  const completed: string[] = []
  const pending: FoundationalPlaceholder[] = []

  FOUNDATIONAL_PLACEHOLDERS.forEach(placeholder => {
    const hasDoc = documents.some(
      doc => doc.document_type === placeholder.docType && doc.approval_status === 'approved'
    )
    if (hasDoc) {
      completed.push(placeholder.id)
    } else {
      pending.push(placeholder)
    }
  })

  const criticalMissing = pending.filter(p => p.priority === 'critical')
  const completionPercent = Math.round((completed.length / FOUNDATIONAL_PLACEHOLDERS.length) * 100)

  return { completed, pending, completionPercent, criticalMissing }
}

export const EXECUTION_STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: 'slate', icon: 'Clock' },
  running: { label: 'Ejecutando', color: 'blue', icon: 'Loader' },
  waiting_human: { label: 'Esperando Aprobación', color: 'amber', icon: 'UserCheck' },
  completed: { label: 'Completado', color: 'green', icon: 'CheckCircle' },
  failed: { label: 'Error', color: 'red', icon: 'XCircle' },
  cancelled: { label: 'Cancelado', color: 'slate', icon: 'XCircle' },
} as const

// ============================================================================
// AI PROVIDER CONFIGURATION (Updated Jan 2026)
// ============================================================================

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'meta' | 'deepseek' | 'xai'

export interface AIModelConfig {
  id: string           // OpenRouter model ID
  name: string         // Display name
  provider: AIProvider
  description: string
  contextWindow: number
  maxOutput: number
  costPer1M: { input: number; output: number }
  capabilities: ('text' | 'vision' | 'code' | 'reasoning' | 'tools')[]
  recommended?: boolean
}

export const AI_PROVIDERS: Record<AIProvider, { name: string; color: string; icon: string; envVar: string }> = {
  anthropic: { name: 'Anthropic', color: 'bg-orange-100 text-orange-800', icon: 'Brain', envVar: 'OPENROUTER_API_KEY' },
  openai: { name: 'OpenAI', color: 'bg-green-100 text-green-800', icon: 'Sparkles', envVar: 'OPENROUTER_API_KEY' },
  google: { name: 'Google', color: 'bg-blue-100 text-blue-800', icon: 'Cloud', envVar: 'OPENROUTER_API_KEY' },
  meta: { name: 'Meta', color: 'bg-indigo-100 text-indigo-800', icon: 'Box', envVar: 'OPENROUTER_API_KEY' },
  deepseek: { name: 'DeepSeek', color: 'bg-purple-100 text-purple-800', icon: 'Search', envVar: 'OPENROUTER_API_KEY' },
  xai: { name: 'xAI', color: 'bg-slate-100 text-slate-800', icon: 'Zap', envVar: 'OPENROUTER_API_KEY' },
}

export const AI_MODELS: AIModelConfig[] = [
  // ============================================================================
  // ANTHROPIC (Claude 4.5 series)
  // ============================================================================
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    description: 'Rápido y capaz, recomendado para la mayoría de tareas',
    contextWindow: 200000,
    maxOutput: 8192,
    costPer1M: { input: 3, output: 15 },
    capabilities: ['text', 'vision', 'code', 'reasoning', 'tools'],
    recommended: true,
  },
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    description: 'Modelo frontier para razonamiento complejo',
    contextWindow: 200000,
    maxOutput: 32768,
    costPer1M: { input: 15, output: 75 },
    capabilities: ['text', 'vision', 'code', 'reasoning', 'tools'],
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    description: 'Ultra rápido y económico para tareas simples',
    contextWindow: 200000,
    maxOutput: 4096,
    costPer1M: { input: 0.25, output: 1.25 },
    capabilities: ['text', 'vision', 'code', 'tools'],
  },

  // ============================================================================
  // OPENAI (GPT-5 series)
  // ============================================================================
  {
    id: 'openai/gpt-5.1',
    name: 'GPT-5.1',
    provider: 'openai',
    description: 'Modelo principal GPT-5 - excelente balance',
    contextWindow: 128000,
    maxOutput: 16384,
    costPer1M: { input: 5, output: 15 },
    capabilities: ['text', 'vision', 'code', 'reasoning', 'tools'],
    recommended: true,
  },
  {
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2',
    provider: 'openai',
    description: 'Extended reasoning - para tareas complejas',
    contextWindow: 128000,
    maxOutput: 32768,
    costPer1M: { input: 10, output: 30 },
    capabilities: ['text', 'vision', 'code', 'reasoning', 'tools'],
  },
  {
    id: 'openai/gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'openai',
    description: 'Ultra rápido y económico',
    contextWindow: 64000,
    maxOutput: 4096,
    costPer1M: { input: 0.5, output: 1.5 },
    capabilities: ['text', 'code', 'tools'],
  },
  {
    id: 'openai/gpt-5-deep-research',
    name: 'GPT-5 Deep Research',
    provider: 'openai',
    description: 'Especializado en investigación profunda',
    contextWindow: 256000,
    maxOutput: 32768,
    costPer1M: { input: 15, output: 45 },
    capabilities: ['text', 'reasoning', 'tools'],
  },

  // ============================================================================
  // GOOGLE (Gemini 3.0 series)
  // ============================================================================
  {
    id: 'google/gemini-3.0-flash',
    name: 'Gemini 3.0 Flash',
    provider: 'google',
    description: 'Rápido para workflows agénticos',
    contextWindow: 1000000,
    maxOutput: 8192,
    costPer1M: { input: 0.075, output: 0.3 },
    capabilities: ['text', 'vision', 'code', 'reasoning', 'tools'],
    recommended: true,
  },
  {
    id: 'google/gemini-3.0-pro',
    name: 'Gemini 3.0 Pro',
    provider: 'google',
    description: 'Alta precisión multimodal',
    contextWindow: 1000000,
    maxOutput: 8192,
    costPer1M: { input: 1.25, output: 5 },
    capabilities: ['text', 'vision', 'code', 'reasoning', 'tools'],
  },
  {
    id: 'google/gemini-o4-mini',
    name: 'Gemini o4-mini',
    provider: 'google',
    description: 'Modelo compacto y eficiente',
    contextWindow: 128000,
    maxOutput: 4096,
    costPer1M: { input: 0.15, output: 0.6 },
    capabilities: ['text', 'vision', 'code', 'tools'],
  },

  // ============================================================================
  // META (Llama 4 series)
  // ============================================================================
  {
    id: 'meta-llama/llama-4-scout',
    name: 'Llama 4 Scout',
    provider: 'meta',
    description: 'Modelo open-source eficiente',
    contextWindow: 128000,
    maxOutput: 4096,
    costPer1M: { input: 0.1, output: 0.1 },
    capabilities: ['text', 'code', 'reasoning'],
  },
  {
    id: 'meta-llama/llama-4-maverick',
    name: 'Llama 4 Maverick',
    provider: 'meta',
    description: 'Modelo open-source de alto rendimiento',
    contextWindow: 256000,
    maxOutput: 8192,
    costPer1M: { input: 0.2, output: 0.3 },
    capabilities: ['text', 'code', 'reasoning', 'tools'],
  },

  // ============================================================================
  // DEEPSEEK
  // ============================================================================
  {
    id: 'deepseek/deepseek-v3.2',
    name: 'DeepSeek V3.2',
    provider: 'deepseek',
    description: 'Muy económico, excelente para coding',
    contextWindow: 64000,
    maxOutput: 8192,
    costPer1M: { input: 0.14, output: 0.28 },
    capabilities: ['text', 'code', 'reasoning'],
    recommended: true,
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'deepseek',
    description: 'Razonamiento avanzado',
    contextWindow: 128000,
    maxOutput: 16384,
    costPer1M: { input: 0.55, output: 2.19 },
    capabilities: ['text', 'code', 'reasoning'],
  },

  // ============================================================================
  // XAI (Grok series)
  // ============================================================================
  {
    id: 'x-ai/grok-3',
    name: 'Grok 3',
    provider: 'xai',
    description: 'Razonamiento rápido',
    contextWindow: 131072,
    maxOutput: 8192,
    costPer1M: { input: 3, output: 15 },
    capabilities: ['text', 'code', 'reasoning', 'tools'],
  },
]

// Helper to get required providers from a playbook
export function getPlaybookRequiredProviders(config: PlaybookConfig): Set<AIProvider> {
  const providers = new Set<AIProvider>()
  config.blocks.forEach((block) => {
    if (block.type === 'prompt' && block.provider) {
      providers.add(block.provider as AIProvider)
    }
  })
  // If no specific provider, assume it uses the default (anthropic via OpenRouter)
  if (providers.size === 0) {
    providers.add('anthropic')
  }
  return providers
}

// Helper to get required context (tiers + doc types) from a playbook
export interface PlaybookContextRequirements {
  tiers: DocumentTier[]
  docTypes: string[]
  totalRequired: number
}

export function getPlaybookContextRequirements(config: PlaybookConfig): PlaybookContextRequirements {
  const tiers = new Set<DocumentTier>()
  const docTypes = new Set<string>()

  // From blocks
  config.blocks.forEach((block) => {
    block.context_tiers?.forEach((tier) => tiers.add(tier))
    block.context_docs?.forEach((doc) => {
      // If it's not a UUID, it's a doc type
      if (!doc.includes('-')) {
        docTypes.add(doc)
      }
    })
  })

  // From context_requirements
  config.context_requirements?.required_tiers?.forEach((tier) => tiers.add(tier))
  config.context_requirements?.required_documents?.forEach((doc) => {
    if (!doc.includes('-')) {
      docTypes.add(doc)
    }
  })

  return {
    tiers: Array.from(tiers).sort(),
    docTypes: Array.from(docTypes),
    totalRequired: tiers.size + docTypes.size,
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface ContextLakeStats {
  total: number
  byTier: Record<DocumentTier, number>
  byType: Record<string, number>
  byStatus: Record<ApprovalStatus, number>
  totalTokens: number
  avgAuthority: number
  staleCount: number
  expiringCount: number
}

export interface PlaybookStats {
  total: number
  byType: Record<PlaybookType, number>
  byStatus: Record<PlaybookStatus, number>
  totalExecutions: number
  successRate: number
}

export interface ExecutionProgress {
  currentBlockIndex: number
  totalBlocks: number
  percentComplete: number
  estimatedTimeRemaining?: number
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ListDocumentsParams {
  clientId: string
  tier?: DocumentTier
  documentType?: string
  approvalStatus?: ApprovalStatus
  search?: string
  sortBy?: 'authority_score' | 'created_at' | 'updated_at' | 'title' | 'validity_end'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface ListPlaybooksParams {
  agencyId: string
  type?: PlaybookType
  status?: PlaybookStatus
  tags?: string[]
  search?: string
}

export interface ListExecutionsParams {
  clientId?: string
  playbookId?: string
  status?: ExecutionStatus
  limit?: number
  offset?: number
}

export interface StartExecutionRequest {
  playbookId: string
  clientId: string
  inputData: Record<string, unknown>
}

export interface HitlResponseRequest {
  executionId: string
  blockId: string
  action: 'approve' | 'reject' | 'edit'
  editedOutput?: string
  selectedOption?: string
  notes?: string
}

// ============================================================================
// DOCUMENT ASSIGNMENT & SYNTHESIS SYSTEM
// ============================================================================

/**
 * Valid foundational document types that can have multiple source documents
 * assigned to them for synthesis.
 */
export type FoundationalType =
  | 'brand_dna'
  | 'icp'
  | 'tone_of_voice'
  | 'product_docs'
  | 'pricing'
  | 'competitor_analysis'

/**
 * Maps a source document to a foundational type.
 * Multiple source documents can be assigned to the same foundational type.
 */
export interface DocumentAssignment {
  id: string
  client_id: string
  source_document_id: string
  target_foundational_type: FoundationalType
  display_order: number
  weight: number
  assigned_by: string | null
  assigned_at: string
  notes: string | null
  // Joined data
  source_document?: Document
}

export type DocumentAssignmentInsert = Omit<
  DocumentAssignment,
  'id' | 'assigned_at' | 'source_document'
>

export type DocumentAssignmentUpdate = Partial<
  Pick<DocumentAssignment, 'display_order' | 'weight' | 'notes'>
>

/**
 * Status of a synthesis job
 */
export type SynthesisStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * Tracks an AI synthesis attempt that combines multiple source documents
 * into a single unified foundational document.
 */
export interface SynthesisJob {
  id: string
  client_id: string
  foundational_type: FoundationalType
  status: SynthesisStatus
  source_document_ids: string[]
  source_hash: string
  synthesized_document_id: string | null
  model_used: string | null
  prompt_version: string
  tokens_used: { input: number; output: number; total: number } | null
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  error_message: string | null
  retry_count: number
  created_at: string
  // Joined data
  synthesized_document?: Document
}

export type SynthesisJobInsert = Pick<
  SynthesisJob,
  'client_id' | 'foundational_type' | 'source_document_ids' | 'source_hash'
>

/**
 * Section score within a completeness evaluation
 */
export interface SectionScore {
  present: boolean
  score: number
  feedback: string
}

/**
 * AI-evaluated completeness score for a foundational document
 */
export interface CompletenessScore {
  id: string
  document_id: string
  overall_score: number
  section_scores: Record<string, SectionScore>
  missing_sections: string[]
  suggestions: string[]
  evaluated_at: string
  model_used: string | null
  evaluation_version: string
  created_at: string
  updated_at: string
}

/**
 * Schema definition for a foundational document type
 */
export interface FoundationalSectionDef {
  key: string
  label: string
  weight: number
  description: string
}

export interface FoundationalSchema {
  id: string
  foundational_type: FoundationalType
  required_sections: FoundationalSectionDef[]
  optional_sections: FoundationalSectionDef[]
  synthesis_prompt: string
  validation_prompt: string
  tier: DocumentTier
  priority: 'critical' | 'important' | 'recommended'
  created_at: string
  updated_at: string
}

/**
 * Unified state for a foundational document slot in the UI.
 * Combines assignment info, synthesis status, and completeness.
 */
export interface FoundationalSlot {
  type: FoundationalType
  label: string
  tier: DocumentTier
  priority: 'critical' | 'important' | 'recommended'
  // Source documents assigned
  assignments: DocumentAssignment[]
  // Synthesized output
  synthesizedDocument: Document | null
  lastSynthesis: SynthesisJob | null
  // Status flags
  needsResynthesis: boolean
  hasPendingSynthesis: boolean
  // Completeness
  completenessScore: number | null
  missingSections: string[]
  suggestions: string[]
  // Schema for validation
  schema: FoundationalSchema | null
}

/**
 * Extended Document type with synthesis-related fields
 */
export interface DocumentWithSynthesis extends Document {
  is_compiled_foundational?: boolean
  synthesis_job_id?: string | null
  completeness_score?: number | null
  requires_review?: boolean
  reviewed_at?: string | null
  reviewed_by?: string | null
}

// ============================================================================
// SYNTHESIS API TYPES
// ============================================================================

export interface SynthesisRequest {
  clientId: string
  foundationalType: FoundationalType
  force?: boolean // Re-synthesize even if hash matches
  userId?: string // Optional: use user's API key instead of server key
}

export interface SynthesisResult {
  success: boolean
  documentId?: string
  jobId?: string
  error?: string
  tokensUsed?: { input: number; output: number; total: number }
  completenessScore?: number
  keySource?: 'user' | 'agency' | 'server' // Which API key was used
  cached?: boolean // Whether result was from cache
  requiresReview?: boolean
  durationMs?: number
  message?: string
}

export interface PreSynthesisCheck {
  canSynthesize: boolean
  sourceCount: number
  estimatedTokens: number
  warnings: string[]
  missingSections: string[]
  recommendations: string[]
}

export interface ValidateCompletenessRequest {
  documentId: string
  foundationalType: FoundationalType
}

export interface ValidateCompletenessResult {
  overallScore: number
  sections: Record<string, SectionScore>
  missingSections: string[]
  suggestions: string[]
}

// ============================================================================
// FOUNDATIONAL SLOT HELPERS
// ============================================================================

export const FOUNDATIONAL_TYPES: FoundationalType[] = [
  'brand_dna',
  'icp',
  'tone_of_voice',
  'product_docs',
  'pricing',
  'competitor_analysis',
]

export const FOUNDATIONAL_TYPE_CONFIG: Record<
  FoundationalType,
  { label: string; tier: DocumentTier; priority: 'critical' | 'important' | 'recommended'; icon: string }
> = {
  brand_dna: { label: 'Brand DNA', tier: 1, priority: 'critical', icon: 'Dna' },
  icp: { label: 'ICP / Buyer Persona', tier: 1, priority: 'critical', icon: 'Users' },
  tone_of_voice: { label: 'Tone of Voice', tier: 1, priority: 'critical', icon: 'MessageSquare' },
  product_docs: { label: 'Documentación de Producto', tier: 1, priority: 'important', icon: 'Package' },
  pricing: { label: 'Precios', tier: 1, priority: 'important', icon: 'DollarSign' },
  competitor_analysis: { label: 'Análisis de Competencia', tier: 2, priority: 'recommended', icon: 'Target' },
}

/**
 * Get completeness level description based on score
 */
export function getCompletenessLevel(score: number): {
  level: 'excellent' | 'good' | 'needs_work' | 'incomplete'
  label: string
  color: string
} {
  if (score >= 90) {
    return { level: 'excellent', label: 'Excelente', color: 'green' }
  } else if (score >= 70) {
    return { level: 'good', label: 'Bueno', color: 'blue' }
  } else if (score >= 40) {
    return { level: 'needs_work', label: 'Necesita mejoras', color: 'amber' }
  } else {
    return { level: 'incomplete', label: 'Incompleto', color: 'red' }
  }
}

// ============================================================================
// FOUNDATIONAL TRANSFORMERS SYSTEM
// ============================================================================

/**
 * Agency-specific transformer configuration for generating foundational documents.
 * Each transformer has its own prompt that defines how to extract and structure
 * information from source documents.
 */
export interface FoundationalTransformer {
  id: string
  agency_id: string
  foundational_type: FoundationalType
  name: string | null
  description: string | null
  prompt: string
  model: string
  temperature: number
  max_tokens: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export type FoundationalTransformerInsert = Omit<
  FoundationalTransformer,
  'id' | 'created_at' | 'updated_at'
>

export type FoundationalTransformerUpdate = Partial<
  Pick<FoundationalTransformer, 'name' | 'description' | 'prompt' | 'model' | 'temperature' | 'max_tokens'>
>

/**
 * Possible states for a foundational document in the transformer workflow
 */
export type FoundationalDocumentState =
  | 'empty'           // No source documents assigned
  | 'generating'      // Transformer is currently running
  | 'pending_review'  // Generated, waiting for user approval
  | 'approved'        // Approved and ready for use in playbooks
  | 'stale'           // Approved but source documents have changed

/**
 * Extended Document with versioning and stale detection fields
 */
export interface DocumentWithVersioning extends Document {
  version: number
  previous_version_id: string | null
  is_stale: boolean
  sources_hash: string | null
  // Existing synthesis fields
  is_compiled_foundational?: boolean
  synthesis_job_id?: string | null
  completeness_score?: number | null
  requires_review?: boolean
  reviewed_at?: string | null
  reviewed_by?: string | null
}

/**
 * Version history entry for a document
 */
export interface DocumentVersion {
  id: string
  version: number
  created_at: string
  approval_status: ApprovalStatus
  is_current: boolean
}

/**
 * Request to execute a transformer
 */
export interface TransformerExecuteRequest {
  clientId: string
  foundationalType: FoundationalType
  sourceDocumentIds?: string[]  // If not provided, uses current assignments
  force?: boolean               // Regenerate even if no changes
}

/**
 * Result of transformer execution
 */
export interface TransformerExecuteResult {
  success: boolean
  documentId?: string
  version?: number
  previousVersionId?: string | null
  status: 'pending_review' | 'error'
  tokensUsed?: { input: number; output: number }
  error?: string
}

/**
 * Request to approve a generated document
 */
export interface DocumentApproveRequest {
  documentId: string
  notes?: string
}

/**
 * Result of document approval
 */
export interface DocumentApproveResult {
  success: boolean
  documentId: string
  status: 'approved'
  approvedAt: string
}

/**
 * Stale status for a foundational document
 */
export interface StaleStatus {
  isStale: boolean
  staleSince?: string
  changedSources: {
    added: string[]
    removed: string[]
    modified: string[]
  }
}

/**
 * Helper to determine the state of a foundational document
 */
export function getFoundationalDocumentState(
  slot: FoundationalSlot
): FoundationalDocumentState {
  if (slot.hasPendingSynthesis) {
    return 'generating'
  }
  if (!slot.synthesizedDocument) {
    if (slot.assignments.length === 0) {
      return 'empty'
    }
    return 'empty' // Has assignments but no synthesized doc yet
  }
  if (slot.synthesizedDocument.approval_status !== 'approved') {
    return 'pending_review'
  }
  if (slot.needsResynthesis || (slot.synthesizedDocument as DocumentWithVersioning).is_stale) {
    return 'stale'
  }
  return 'approved'
}

/**
 * Helper to get display info for a foundational document state
 */
export function getFoundationalStateDisplay(state: FoundationalDocumentState): {
  label: string
  color: string
  icon: string
  description: string
} {
  switch (state) {
    case 'empty':
      return {
        label: 'Sin documentos',
        color: 'gray',
        icon: 'FileQuestion',
        description: 'Asigna documentos fuente para generar este documento fundacional',
      }
    case 'generating':
      return {
        label: 'Generando...',
        color: 'blue',
        icon: 'Loader',
        description: 'El transformer está procesando los documentos fuente',
      }
    case 'pending_review':
      return {
        label: 'Pendiente de revisión',
        color: 'amber',
        icon: 'AlertTriangle',
        description: 'Revisa y aprueba el documento generado antes de usarlo en playbooks',
      }
    case 'approved':
      return {
        label: 'Aprobado',
        color: 'green',
        icon: 'CheckCircle',
        description: 'Documento listo para usar en playbooks',
      }
    case 'stale':
      return {
        label: 'Desactualizado',
        color: 'orange',
        icon: 'AlertTriangle',
        description: 'Los documentos fuente han cambiado. Regenera para actualizar.',
      }
  }
}
