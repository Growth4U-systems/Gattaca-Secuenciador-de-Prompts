/**
 * n8n Workflow Type Definitions
 *
 * These types represent the structure of n8n workflow JSON exports.
 * Based on analysis of actual n8n workflow templates.
 *
 * @see https://docs.n8n.io/workflows/
 */

// ============================================
// Core Workflow Types
// ============================================

/**
 * Complete n8n workflow structure as exported from n8n
 */
export interface N8nWorkflow {
  /** Unique workflow identifier */
  id?: string

  /** Workflow display name */
  name: string

  /** Array of all nodes in the workflow */
  nodes: N8nNode[]

  /** Connections between nodes (keyed by source node name) */
  connections: N8nConnections

  /** Workflow-level settings */
  settings?: N8nWorkflowSettings

  /** Static data stored in workflow */
  staticData?: Record<string, unknown>

  /** Pinned data for testing */
  pinData?: Record<string, unknown[]>

  /** Workflow tags */
  tags?: N8nTag[]

  /** Workflow metadata */
  meta?: N8nWorkflowMeta

  /** Whether workflow is active */
  active?: boolean

  /** Workflow version info */
  versionId?: string
}

/**
 * Workflow metadata
 */
export interface N8nWorkflowMeta {
  templateId?: string
  templateCredsSetupCompleted?: boolean
  instanceId?: string
}

/**
 * Workflow tag
 */
export interface N8nTag {
  id?: string
  name: string
}

/**
 * Workflow-level settings
 */
export interface N8nWorkflowSettings {
  /** Execution order (v0 = legacy, v1 = current) */
  executionOrder?: 'v0' | 'v1'

  /** Save execution data on error */
  saveDataErrorExecution?: 'all' | 'none'

  /** Save execution data on success */
  saveDataSuccessExecution?: 'all' | 'none'

  /** Save manual executions */
  saveManualExecutions?: boolean

  /** Caller policy */
  callerPolicy?: 'workflowsFromSameOwner' | 'any' | 'none'

  /** Error workflow ID */
  errorWorkflow?: string

  /** Timezone */
  timezone?: string

  /** Execution timeout in seconds */
  executionTimeout?: number
}

// ============================================
// Node Types
// ============================================

/**
 * n8n Node structure
 */
export interface N8nNode {
  /** Unique node ID within workflow */
  id: string

  /** Display name (used in connections) */
  name: string

  /** Node type identifier (e.g., 'n8n-nodes-base.httpRequest') */
  type: string

  /** Node type version */
  typeVersion: number | number[]

  /** Position on canvas [x, y] */
  position: [number, number]

  /** Node-specific parameters */
  parameters: N8nNodeParameters

  /** Credentials used by this node */
  credentials?: N8nNodeCredentials

  /** Whether node is disabled */
  disabled?: boolean

  /** Notes attached to node */
  notes?: string

  /** Continue workflow on fail */
  continueOnFail?: boolean

  /** Execute once (for triggers) */
  executeOnce?: boolean

  /** Retry on fail settings */
  retryOnFail?: boolean
  maxTries?: number
  waitBetweenTries?: number

  /** Always output data */
  alwaysOutputData?: boolean

  /** Webhook ID (for webhook nodes) */
  webhookId?: string
}

/**
 * Node parameters - highly variable based on node type
 */
export type N8nNodeParameters = Record<string, N8nParameterValue>

/**
 * Possible parameter value types
 */
export type N8nParameterValue =
  | string
  | number
  | boolean
  | null
  | N8nParameterValue[]
  | { [key: string]: N8nParameterValue }
  | N8nExpression

/**
 * n8n Expression (dynamic value)
 * Can be in format "={{ expression }}" or just the expression string
 */
export type N8nExpression = string

/**
 * Node credentials reference
 */
export interface N8nNodeCredentials {
  [credentialType: string]: {
    id: string
    name: string
  }
}

// ============================================
// Connection Types
// ============================================

/**
 * Connections object - maps source node names to their outputs
 */
export interface N8nConnections {
  [sourceNodeName: string]: N8nNodeConnections
}

/**
 * Connections from a single node
 */
export interface N8nNodeConnections {
  /** Main output connections */
  main?: N8nConnectionInfo[][]

  /** AI model connections (for langchain nodes) */
  ai_languageModel?: N8nConnectionInfo[][]

  /** AI tool connections */
  ai_tool?: N8nConnectionInfo[][]

  /** AI memory connections */
  ai_memory?: N8nConnectionInfo[][]

  /** AI output parser connections */
  ai_outputParser?: N8nConnectionInfo[][]

  /** AI retriever connections */
  ai_retriever?: N8nConnectionInfo[][]

  /** AI document connections */
  ai_document?: N8nConnectionInfo[][]

  /** AI embedding connections */
  ai_embedding?: N8nConnectionInfo[][]

  /** AI vector store connections */
  ai_vectorStore?: N8nConnectionInfo[][]

  /** AI text splitter connections */
  ai_textSplitter?: N8nConnectionInfo[][]
}

/**
 * Connection type names
 */
export type N8nConnectionType = keyof N8nNodeConnections

/**
 * Single connection info
 */
export interface N8nConnectionInfo {
  /** Target node name */
  node: string

  /** Target node type (usually same as connection type) */
  type: string

  /** Input index on target node */
  index: number
}

// ============================================
// Common Node Type Categories
// ============================================

/**
 * Known trigger node types
 */
export const TRIGGER_NODE_TYPES = [
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.manualTrigger',
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.cronTrigger',
  'n8n-nodes-base.emailTrigger',
  'n8n-nodes-base.formTrigger',
  '@n8n/n8n-nodes-langchain.chatTrigger',
] as const

/**
 * Known AI/LLM node types
 */
export const AI_NODE_TYPES = [
  '@n8n/n8n-nodes-langchain.openAi',
  '@n8n/n8n-nodes-langchain.anthropic',
  '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  '@n8n/n8n-nodes-langchain.agent',
  '@n8n/n8n-nodes-langchain.chainLlm',
] as const

/**
 * Known control flow node types
 */
export const CONTROL_FLOW_NODE_TYPES = [
  'n8n-nodes-base.if',
  'n8n-nodes-base.switch',
  'n8n-nodes-base.splitInBatches',
  'n8n-nodes-base.merge',
  'n8n-nodes-base.wait',
  'n8n-nodes-base.noOp',
] as const

/**
 * Known data transformation node types
 */
export const TRANSFORM_NODE_TYPES = [
  'n8n-nodes-base.set',
  'n8n-nodes-base.code',
  'n8n-nodes-base.function',
  'n8n-nodes-base.functionItem',
  'n8n-nodes-base.itemLists',
  'n8n-nodes-base.spreadsheetFile',
  'n8n-nodes-base.html',
  'n8n-nodes-base.markdown',
  'n8n-nodes-base.xml',
] as const

// ============================================
// Utility Types
// ============================================

/**
 * Check if a node type is a trigger
 */
export function isTriggerNode(nodeType: string): boolean {
  return (TRIGGER_NODE_TYPES as readonly string[]).includes(nodeType)
}

/**
 * Check if a node type is an AI/LLM node
 */
export function isAINode(nodeType: string): boolean {
  return (
    (AI_NODE_TYPES as readonly string[]).includes(nodeType) ||
    nodeType.startsWith('@n8n/n8n-nodes-langchain.')
  )
}

/**
 * Check if a node type is a control flow node
 */
export function isControlFlowNode(nodeType: string): boolean {
  return (CONTROL_FLOW_NODE_TYPES as readonly string[]).includes(nodeType)
}

/**
 * Check if a node type is a data transformation node
 */
export function isTransformNode(nodeType: string): boolean {
  return (TRANSFORM_NODE_TYPES as readonly string[]).includes(nodeType)
}

/**
 * Extract the base node type from a full type string
 * e.g., 'n8n-nodes-base.httpRequest' -> 'httpRequest'
 */
export function getBaseNodeType(fullType: string): string {
  const parts = fullType.split('.')
  return parts[parts.length - 1]
}

/**
 * Get the package name from a node type
 * e.g., 'n8n-nodes-base.httpRequest' -> 'n8n-nodes-base'
 */
export function getNodePackage(fullType: string): string {
  const lastDot = fullType.lastIndexOf('.')
  return lastDot > 0 ? fullType.substring(0, lastDot) : fullType
}
