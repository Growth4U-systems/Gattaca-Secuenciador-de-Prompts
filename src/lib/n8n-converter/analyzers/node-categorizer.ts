/**
 * n8n Node Categorizer
 *
 * Categorizes n8n nodes by their role to determine conversion strategy.
 * Each category maps to different Gattaca step types and executors.
 */

import { N8nNode } from '../types'

// ============================================
// Types
// ============================================

/**
 * Node category determines conversion strategy
 */
export type NodeCategory =
  | 'trigger'    // Entry points: webhooks, manual, schedule
  | 'action'     // External API calls: HTTP, Gmail, Slack
  | 'transform'  // Data manipulation: Set, Code, Function
  | 'logic'      // Control flow: IF, Switch, Filter
  | 'ai'         // AI/LLM: OpenAI, Anthropic, Agents
  | 'utility'    // Helpers: Wait, NoOp, StickyNote
  | 'unknown'    // Unrecognized node types

/**
 * Categorized node with metadata
 */
export interface CategorizedNode {
  /** Original node */
  node: N8nNode

  /** Assigned category */
  category: NodeCategory

  /** Confidence score 0-1 */
  confidence: number

  /** Reason for categorization */
  reason: string

  /** Whether this needs manual review */
  needsReview: boolean

  /** Suggested Gattaca step type */
  suggestedStepType: string

  /** Suggested executor */
  suggestedExecutor: string
}

/**
 * Result of categorizing all nodes
 */
export interface CategorizationResult {
  /** All categorized nodes */
  nodes: CategorizedNode[]

  /** Summary counts by category */
  summary: Record<NodeCategory, number>

  /** Nodes flagged for review */
  needsReview: CategorizedNode[]

  /** Overall conversion confidence */
  overallConfidence: number
}

// ============================================
// Category Mappings
// ============================================

/**
 * Node type patterns mapped to categories
 * More specific patterns should come first
 */
const NODE_CATEGORY_PATTERNS: Array<{
  pattern: RegExp | string[]
  category: NodeCategory
  confidence: number
  reason: string
  stepType: string
  executor: string
}> = [
  // Triggers (entry points)
  {
    pattern: [
      'n8n-nodes-base.manualTrigger',
      'n8n-nodes-base.webhook',
      'n8n-nodes-base.scheduleTrigger',
      'n8n-nodes-base.cronTrigger',
      'n8n-nodes-base.emailTrigger',
      'n8n-nodes-base.formTrigger',
      '@n8n/n8n-nodes-langchain.chatTrigger',
    ],
    category: 'trigger',
    confidence: 1.0,
    reason: 'Known trigger node type',
    stepType: 'input',
    executor: 'none',
  },
  {
    pattern: /trigger$/i,
    category: 'trigger',
    confidence: 0.9,
    reason: 'Node type ends with "trigger"',
    stepType: 'input',
    executor: 'none',
  },

  // AI/LLM nodes
  {
    pattern: [
      '@n8n/n8n-nodes-langchain.openAi',
      '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      '@n8n/n8n-nodes-langchain.lmChatAnthropic',
      '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
      '@n8n/n8n-nodes-langchain.anthropic',
      '@n8n/n8n-nodes-langchain.agent',
      '@n8n/n8n-nodes-langchain.chainLlm',
      '@n8n/n8n-nodes-langchain.chainSummarization',
    ],
    category: 'ai',
    confidence: 1.0,
    reason: 'Known AI/LLM node type',
    stepType: 'auto_with_review',
    executor: 'llm',
  },
  {
    pattern: /@n8n\/n8n-nodes-langchain\./,
    category: 'ai',
    confidence: 0.95,
    reason: 'LangChain package node',
    stepType: 'auto_with_review',
    executor: 'llm',
  },
  {
    pattern: /openai|anthropic|gemini|llm|gpt|claude/i,
    category: 'ai',
    confidence: 0.8,
    reason: 'AI-related keyword in node type',
    stepType: 'auto_with_review',
    executor: 'llm',
  },

  // Logic/Control flow nodes
  {
    pattern: [
      'n8n-nodes-base.if',
      'n8n-nodes-base.switch',
      'n8n-nodes-base.filter',
      'n8n-nodes-base.splitInBatches',
      'n8n-nodes-base.merge',
      'n8n-nodes-base.compareDatasets',
    ],
    category: 'logic',
    confidence: 1.0,
    reason: 'Known control flow node',
    stepType: 'decision',
    executor: 'none',
  },

  // Transform/Data manipulation nodes
  {
    pattern: [
      'n8n-nodes-base.set',
      'n8n-nodes-base.code',
      'n8n-nodes-base.function',
      'n8n-nodes-base.functionItem',
      'n8n-nodes-base.itemLists',
      'n8n-nodes-base.splitOut',
      'n8n-nodes-base.aggregate',
      'n8n-nodes-base.summarize',
      'n8n-nodes-base.sort',
      'n8n-nodes-base.limit',
      'n8n-nodes-base.removeDuplicates',
      'n8n-nodes-base.renameKeys',
    ],
    category: 'transform',
    confidence: 1.0,
    reason: 'Known data transformation node',
    stepType: 'auto',
    executor: 'custom',
  },

  // Utility nodes
  {
    pattern: [
      'n8n-nodes-base.wait',
      'n8n-nodes-base.noOp',
      'n8n-nodes-base.stickyNote',
      'n8n-nodes-base.executeWorkflow',
      'n8n-nodes-base.respondToWebhook',
    ],
    category: 'utility',
    confidence: 1.0,
    reason: 'Known utility node',
    stepType: 'auto',
    executor: 'none',
  },

  // Action nodes (API integrations)
  {
    pattern: [
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.gmail',
      'n8n-nodes-base.googleSheets',
      'n8n-nodes-base.slack',
      'n8n-nodes-base.notion',
      'n8n-nodes-base.airtable',
      'n8n-nodes-base.discord',
      'n8n-nodes-base.telegram',
      'n8n-nodes-base.twitter',
      'n8n-nodes-base.ftp',
      'n8n-nodes-base.ssh',
      'n8n-nodes-base.postgres',
      'n8n-nodes-base.mysql',
      'n8n-nodes-base.mongodb',
      'n8n-nodes-base.redis',
      'n8n-nodes-base.s3',
      'n8n-nodes-base.googleDrive',
      'n8n-nodes-base.dropbox',
    ],
    category: 'action',
    confidence: 1.0,
    reason: 'Known action/integration node',
    stepType: 'auto',
    executor: 'api',
  },
  {
    pattern: /^n8n-nodes-base\./,
    category: 'action',
    confidence: 0.7,
    reason: 'n8n base package node (likely integration)',
    stepType: 'auto',
    executor: 'api',
  },
]

// ============================================
// Categorization Functions
// ============================================

/**
 * Categorize a single node
 */
export function categorizeNode(node: N8nNode): CategorizedNode {
  const nodeType = node.type

  // Try each pattern in order
  for (const mapping of NODE_CATEGORY_PATTERNS) {
    let matches = false

    if (Array.isArray(mapping.pattern)) {
      // Exact match against list
      matches = mapping.pattern.includes(nodeType)
    } else {
      // Regex match
      matches = mapping.pattern.test(nodeType)
    }

    if (matches) {
      return {
        node,
        category: mapping.category,
        confidence: mapping.confidence,
        reason: mapping.reason,
        needsReview: mapping.confidence < 0.9,
        suggestedStepType: mapping.stepType,
        suggestedExecutor: mapping.executor,
      }
    }
  }

  // Unknown node type
  return {
    node,
    category: 'unknown',
    confidence: 0,
    reason: `Unrecognized node type: ${nodeType}`,
    needsReview: true,
    suggestedStepType: 'auto',
    suggestedExecutor: 'custom',
  }
}

/**
 * Categorize all nodes in a list
 */
export function categorizeNodes(nodes: N8nNode[]): CategorizationResult {
  const categorized = nodes.map(categorizeNode)

  // Build summary
  const summary: Record<NodeCategory, number> = {
    trigger: 0,
    action: 0,
    transform: 0,
    logic: 0,
    ai: 0,
    utility: 0,
    unknown: 0,
  }

  for (const cn of categorized) {
    summary[cn.category]++
  }

  // Find nodes needing review
  const needsReview = categorized.filter((cn) => cn.needsReview)

  // Calculate overall confidence
  const totalConfidence = categorized.reduce((sum, cn) => sum + cn.confidence, 0)
  const overallConfidence = categorized.length > 0 ? totalConfidence / categorized.length : 1

  return {
    nodes: categorized,
    summary,
    needsReview,
    overallConfidence,
  }
}

/**
 * Get category for a node type string
 */
export function getCategoryForNodeType(nodeType: string): NodeCategory {
  // Create a minimal node object for categorization
  const mockNode: N8nNode = {
    id: 'temp',
    name: 'temp',
    type: nodeType,
    typeVersion: 1,
    position: [0, 0],
    parameters: {},
  }

  return categorizeNode(mockNode).category
}

/**
 * Check if a node type is supported (not unknown)
 */
export function isNodeTypeSupported(nodeType: string): boolean {
  return getCategoryForNodeType(nodeType) !== 'unknown'
}

/**
 * Get conversion hints for a category
 */
export function getConversionHints(category: NodeCategory): {
  description: string
  gattacaPattern: string
  warnings: string[]
} {
  const hints: Record<NodeCategory, ReturnType<typeof getConversionHints>> = {
    trigger: {
      description: 'Entry point for playbook execution',
      gattacaPattern: 'First step in Phase 1, type: input or auto',
      warnings: ['Multiple triggers require manual decision on entry point'],
    },
    action: {
      description: 'External API call or integration',
      gattacaPattern: 'Generate API route, step type: auto, executor: api',
      warnings: ['Credentials need manual configuration', 'Rate limits may differ'],
    },
    transform: {
      description: 'Data manipulation and transformation',
      gattacaPattern: 'Inline code or utility function, step type: auto',
      warnings: ['n8n-specific helpers need conversion', 'Binary data not supported'],
    },
    logic: {
      description: 'Conditional branching or control flow',
      gattacaPattern: 'Step with conditions or decision type',
      warnings: ['Complex branches may need restructuring', 'Parallel paths become sequential'],
    },
    ai: {
      description: 'AI/LLM model invocation',
      gattacaPattern: 'Use existing /api/llm/generate, step type: auto_with_review',
      warnings: ['Model names may need mapping', 'Streaming not supported same way'],
    },
    utility: {
      description: 'Helper or meta node',
      gattacaPattern: 'May be omitted or converted to comments',
      warnings: ['Wait nodes need different handling', 'ExecuteWorkflow not supported'],
    },
    unknown: {
      description: 'Unrecognized node type',
      gattacaPattern: 'Placeholder step requiring manual implementation',
      warnings: ['Full manual implementation required', 'Check n8n docs for node behavior'],
    },
  }

  return hints[category]
}
