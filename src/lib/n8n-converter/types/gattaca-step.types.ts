/**
 * Gattaca Step Type Definitions
 *
 * These types represent the output structure for converted n8n nodes.
 * They map to Gattaca's playbook configuration format.
 */

import { StepDefinition, PhaseDefinition, PlaybookConfig } from '@/components/playbook/types'

// ============================================
// Conversion Output Types
// ============================================

/**
 * Result of converting a single n8n node
 */
export interface ConvertedStep {
  /** The Gattaca step definition */
  step: StepDefinition

  /** Generated code for this step (if any) */
  generatedCode?: GeneratedCode

  /** Warnings encountered during conversion */
  warnings: ConversionWarning[]

  /** Whether manual implementation is required */
  requiresManualImplementation: boolean

  /** Original n8n node for reference */
  sourceNode: {
    id: string
    name: string
    type: string
  }
}

/**
 * Generated code artifacts for a step
 */
export interface GeneratedCode {
  /** API route code (Next.js route handler) */
  apiRoute?: {
    path: string
    content: string
  }

  /** Utility functions */
  utilities?: {
    path: string
    content: string
  }[]

  /** Type definitions */
  types?: {
    path: string
    content: string
  }

  /** Environment variables needed */
  envVariables?: EnvVariable[]
}

/**
 * Environment variable requirement
 */
export interface EnvVariable {
  /** Variable name */
  name: string

  /** Description of what it's for */
  description: string

  /** Whether it's required */
  required: boolean

  /** Example value */
  example?: string

  /** Source credential type from n8n */
  sourceCredentialType?: string
}

/**
 * Conversion warning
 */
export interface ConversionWarning {
  /** Warning severity */
  severity: 'info' | 'warning' | 'error'

  /** Warning message */
  message: string

  /** Suggested action */
  suggestion?: string

  /** Related n8n node */
  nodeId?: string

  /** Related n8n parameter */
  parameter?: string
}

// ============================================
// Full Conversion Result
// ============================================

/**
 * Complete result of converting an n8n workflow
 */
export interface ConversionResult {
  /** Success status */
  success: boolean

  /** Generated playbook configuration */
  playbookConfig?: PlaybookConfig

  /** All converted steps grouped by phase */
  phases: ConvertedPhase[]

  /** All generated code artifacts */
  generatedFiles: GeneratedFile[]

  /** Global warnings and errors */
  warnings: ConversionWarning[]

  /** Conversion statistics */
  stats: ConversionStats

  /** Required environment variables */
  envVariables: EnvVariable[]

  /** Manual steps required post-conversion */
  manualSteps: string[]
}

/**
 * Converted phase with its steps
 */
export interface ConvertedPhase {
  /** Phase definition */
  phase: PhaseDefinition

  /** Converted steps in this phase */
  steps: ConvertedStep[]
}

/**
 * Generated file
 */
export interface GeneratedFile {
  /** File path relative to project root */
  path: string

  /** File content */
  content: string

  /** File type */
  type: 'config' | 'api-route' | 'utility' | 'types' | 'env-example'

  /** Description of what this file does */
  description: string
}

/**
 * Conversion statistics
 */
export interface ConversionStats {
  /** Total nodes in source workflow */
  totalNodes: number

  /** Successfully converted nodes */
  convertedNodes: number

  /** Partially converted nodes (with warnings) */
  partialNodes: number

  /** Unsupported nodes */
  unsupportedNodes: number

  /** Number of phases generated */
  phasesGenerated: number

  /** Number of steps generated */
  stepsGenerated: number

  /** Number of API routes generated */
  apiRoutesGenerated: number

  /** Conversion time in milliseconds */
  conversionTimeMs: number
}

// ============================================
// Step Type Mapping
// ============================================

/**
 * Mapping of n8n node categories to Gattaca step types
 */
export const NODE_TO_STEP_TYPE_MAP: Record<string, StepDefinition['type']> = {
  // Triggers -> config or input steps
  trigger: 'input',
  webhook: 'input',
  manualTrigger: 'input',
  scheduleTrigger: 'input',

  // HTTP/API calls -> auto execution
  httpRequest: 'auto',
  apiCall: 'auto',

  // AI/LLM -> auto with review option
  openAi: 'auto_with_review',
  anthropic: 'auto_with_review',
  lmChatOpenAi: 'auto_with_review',
  lmChatAnthropic: 'auto_with_review',
  agent: 'auto_with_review',

  // Code/Function -> auto
  code: 'auto',
  function: 'auto',
  functionItem: 'auto',

  // Control flow -> decision or auto
  if: 'decision',
  switch: 'decision',
  merge: 'auto',
  splitInBatches: 'auto',

  // Data transformation -> auto
  set: 'auto',
  itemLists: 'auto',

  // Display/Output -> display
  respondToWebhook: 'display',
}

/**
 * Get the Gattaca step type for an n8n node type
 */
export function getStepTypeForNode(n8nNodeType: string): StepDefinition['type'] {
  const baseType = n8nNodeType.split('.').pop() || n8nNodeType
  return NODE_TO_STEP_TYPE_MAP[baseType] || 'auto'
}

/**
 * Get the executor type for an n8n node
 */
export function getExecutorForNode(n8nNodeType: string): StepDefinition['executor'] {
  const baseType = n8nNodeType.split('.').pop() || n8nNodeType

  // AI nodes use LLM executor
  if (
    baseType.toLowerCase().includes('openai') ||
    baseType.toLowerCase().includes('anthropic') ||
    baseType.toLowerCase().includes('llm') ||
    baseType.toLowerCase().includes('agent')
  ) {
    return 'llm'
  }

  // Code nodes use custom executor (requires manual implementation)
  if (baseType === 'code' || baseType === 'function' || baseType === 'functionItem') {
    return 'custom'
  }

  // Triggers and control flow don't need execution
  if (
    baseType.includes('Trigger') ||
    baseType === 'if' ||
    baseType === 'switch' ||
    baseType === 'noOp'
  ) {
    return 'none'
  }

  // Default to API for HTTP-like nodes
  return 'api'
}
