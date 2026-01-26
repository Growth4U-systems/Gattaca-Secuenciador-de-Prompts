/**
 * Branch Pattern Detector
 *
 * Detects IF/Switch branching patterns in n8n workflows.
 * These map to Gattaca decision steps with multiple outcomes.
 *
 * IF Pattern: Single condition → true/false branches
 * Switch Pattern: Multiple conditions → multiple branches
 */

import { N8nWorkflow, N8nNode } from '../types'
import { analyzeFlow, FlowAnalysis, AnalyzedNode } from '../analyzers'

// ============================================
// Types
// ============================================

/**
 * Base interface for branch patterns
 */
export interface BranchPattern {
  /** Unique ID for this pattern */
  id: string

  /** Type of branch */
  type: 'if' | 'switch'

  /** The branching node */
  branchNode: N8nNode

  /** All branch paths (true/false for IF, case-based for Switch) */
  branches: BranchPath[]

  /** Node where branches merge (if any) */
  mergeNode?: N8nNode

  /** Total nodes in this pattern (including branch and merge) */
  nodeCount: number
}

/**
 * A single branch path
 */
export interface BranchPath {
  /** Branch identifier (e.g., 'true', 'false', 'case_0', 'default') */
  id: string

  /** Human-readable label */
  label: string

  /** Condition that triggers this branch */
  condition?: string

  /** Output index in n8n connections */
  outputIndex: number

  /** Nodes in this branch path (in execution order) */
  nodes: N8nNode[]

  /** Node names for quick lookup */
  nodeNames: string[]

  /** Whether this branch is empty (goes directly to merge or nowhere) */
  isEmpty: boolean
}

/**
 * IF-specific pattern (extends base)
 */
export interface IfBranchPattern extends BranchPattern {
  type: 'if'

  /** The condition being evaluated */
  condition: IfCondition

  /** True branch */
  trueBranch: BranchPath

  /** False branch */
  falseBranch: BranchPath
}

/**
 * IF condition details
 */
export interface IfCondition {
  /** Left operand */
  value1: string

  /** Comparison operation */
  operation: string

  /** Right operand */
  value2: string

  /** Human-readable representation */
  readable: string
}

/**
 * Switch-specific pattern (extends base)
 */
export interface SwitchBranchPattern extends BranchPattern {
  type: 'switch'

  /** Switch mode */
  mode: 'rules' | 'expression'

  /** For rules mode: the data type being compared */
  dataType?: string

  /** Case branches (by output index) */
  cases: BranchPath[]

  /** Default/fallback branch (if any) */
  defaultBranch?: BranchPath
}

/**
 * Result of branch detection
 */
export interface BranchDetectionResult {
  /** All detected branch patterns */
  patterns: BranchPattern[]

  /** IF patterns */
  ifPatterns: IfBranchPattern[]

  /** Switch patterns */
  switchPatterns: SwitchBranchPattern[]

  /** Nodes that are part of branch patterns */
  branchNodes: Set<string>

  /** Statistics */
  stats: {
    totalBranches: number
    ifCount: number
    switchCount: number
    avgBranchDepth: number
  }
}

// ============================================
// Detection Functions
// ============================================

/**
 * Detect all branch patterns in a workflow
 */
export function detectBranchPatterns(
  workflow: N8nWorkflow,
  flowAnalysis?: FlowAnalysis
): BranchDetectionResult {
  const analysis = flowAnalysis || analyzeFlow(workflow)

  const nodeMap = new Map<string, N8nNode>()
  const analyzedMap = new Map<string, AnalyzedNode>()

  for (const node of workflow.nodes) {
    nodeMap.set(node.name, node)
  }

  // FlowAnalysis uses 'nodes' Map, not 'analyzedNodes' array
  for (const [name, an] of analysis.nodes) {
    analyzedMap.set(name, an)
  }

  const patterns: BranchPattern[] = []
  const ifPatterns: IfBranchPattern[] = []
  const switchPatterns: SwitchBranchPattern[] = []
  const branchNodes = new Set<string>()

  // Find all IF nodes
  const ifNodes = workflow.nodes.filter(
    (n) => n.type === 'n8n-nodes-base.if' || n.type.endsWith('.if')
  )

  for (const ifNode of ifNodes) {
    const pattern = detectIfPattern(ifNode, workflow, analyzedMap, nodeMap, branchNodes)
    if (pattern) {
      pattern.id = `if_${ifPatterns.length + 1}`
      ifPatterns.push(pattern)
      patterns.push(pattern)
    }
  }

  // Find all Switch nodes
  const switchNodes = workflow.nodes.filter(
    (n) => n.type === 'n8n-nodes-base.switch' || n.type.endsWith('.switch')
  )

  for (const switchNode of switchNodes) {
    const pattern = detectSwitchPattern(switchNode, workflow, analyzedMap, nodeMap, branchNodes)
    if (pattern) {
      pattern.id = `switch_${switchPatterns.length + 1}`
      switchPatterns.push(pattern)
      patterns.push(pattern)
    }
  }

  // Calculate stats
  const totalBranchDepths = patterns.reduce((sum, p) => {
    const maxDepth = Math.max(...p.branches.map((b) => b.nodes.length))
    return sum + maxDepth
  }, 0)

  return {
    patterns,
    ifPatterns,
    switchPatterns,
    branchNodes,
    stats: {
      totalBranches: patterns.length,
      ifCount: ifPatterns.length,
      switchCount: switchPatterns.length,
      avgBranchDepth: patterns.length > 0 ? totalBranchDepths / patterns.length : 0,
    },
  }
}

/**
 * Detect IF pattern for a specific node
 */
export function detectIfPattern(
  ifNode: N8nNode,
  workflow: N8nWorkflow,
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>,
  branchNodes: Set<string>
): IfBranchPattern | null {
  const analyzed = analyzedMap.get(ifNode.name)
  if (!analyzed) return null

  // Mark the IF node as part of pattern
  branchNodes.add(ifNode.name)

  // Parse condition from parameters
  const condition = parseIfCondition(ifNode)

  // Get connections for true/false branches
  const connections = workflow.connections[ifNode.name]?.main || []

  // True branch is output 0, False branch is output 1
  const trueBranchNodes = followBranch(
    connections[0] || [],
    workflow,
    analyzedMap,
    nodeMap,
    branchNodes
  )

  const falseBranchNodes = followBranch(
    connections[1] || [],
    workflow,
    analyzedMap,
    nodeMap,
    branchNodes
  )

  // Find merge point (if branches converge)
  const mergeNode = findMergePoint(trueBranchNodes, falseBranchNodes, analyzedMap, nodeMap)

  const trueBranch: BranchPath = {
    id: 'true',
    label: 'True',
    condition: condition.readable,
    outputIndex: 0,
    nodes: trueBranchNodes,
    nodeNames: trueBranchNodes.map((n) => n.name),
    isEmpty: trueBranchNodes.length === 0,
  }

  const falseBranch: BranchPath = {
    id: 'false',
    label: 'False',
    condition: `NOT (${condition.readable})`,
    outputIndex: 1,
    nodes: falseBranchNodes,
    nodeNames: falseBranchNodes.map((n) => n.name),
    isEmpty: falseBranchNodes.length === 0,
  }

  return {
    id: '',
    type: 'if',
    branchNode: ifNode,
    branches: [trueBranch, falseBranch],
    mergeNode,
    nodeCount: 1 + trueBranchNodes.length + falseBranchNodes.length + (mergeNode ? 1 : 0),
    condition,
    trueBranch,
    falseBranch,
  }
}

/**
 * Detect Switch pattern for a specific node
 */
export function detectSwitchPattern(
  switchNode: N8nNode,
  workflow: N8nWorkflow,
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>,
  branchNodes: Set<string>
): SwitchBranchPattern | null {
  const analyzed = analyzedMap.get(switchNode.name)
  if (!analyzed) return null

  branchNodes.add(switchNode.name)

  const params = switchNode.parameters
  const mode = (params.mode as string) || 'rules'
  const dataType = params.dataType as string | undefined

  // Get all output connections
  const connections = workflow.connections[switchNode.name]?.main || []

  const cases: BranchPath[] = []
  let defaultBranch: BranchPath | undefined

  // Parse rules to get case labels
  const rules = (params.rules as { rules?: Array<{ value?: unknown; operation?: string }> })
    ?.rules || []

  for (let i = 0; i < connections.length; i++) {
    const branchNodes_i = followBranch(
      connections[i] || [],
      workflow,
      analyzedMap,
      nodeMap,
      branchNodes
    )

    // Check if this is the default/fallback output
    const isDefault = i >= rules.length || (params.fallbackOutput === i)

    const rule = rules[i]
    const label = isDefault
      ? 'Default'
      : rule
        ? `Case ${i}: ${rule.value || 'condition'}`
        : `Output ${i}`

    const path: BranchPath = {
      id: isDefault ? 'default' : `case_${i}`,
      label,
      condition: rule ? formatRuleCondition(rule) : undefined,
      outputIndex: i,
      nodes: branchNodes_i,
      nodeNames: branchNodes_i.map((n) => n.name),
      isEmpty: branchNodes_i.length === 0,
    }

    if (isDefault) {
      defaultBranch = path
    } else {
      cases.push(path)
    }
  }

  // Find merge point
  const allBranchNodes = [...cases.flatMap((c) => c.nodes), ...(defaultBranch?.nodes || [])]
  const mergeNode = findCommonMerge(allBranchNodes, analyzedMap, nodeMap)

  const allBranches = [...cases]
  if (defaultBranch) allBranches.push(defaultBranch)

  return {
    id: '',
    type: 'switch',
    branchNode: switchNode,
    branches: allBranches,
    mergeNode,
    nodeCount: 1 + allBranchNodes.length + (mergeNode ? 1 : 0),
    mode: mode as 'rules' | 'expression',
    dataType,
    cases,
    defaultBranch,
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Parse IF node condition into structured format
 */
function parseIfCondition(ifNode: N8nNode): IfCondition {
  const params = ifNode.parameters
  const conditions = params.conditions as {
    string?: Array<{ value1?: string; operation?: string; value2?: string }>
    number?: Array<{ value1?: string; operation?: string; value2?: string }>
    boolean?: Array<{ value1?: string; operation?: string; value2?: string }>
  } | undefined

  // Try to find the first condition
  const stringConditions = conditions?.string || []
  const numberConditions = conditions?.number || []
  const booleanConditions = conditions?.boolean || []

  const allConditions = [...stringConditions, ...numberConditions, ...booleanConditions]
  const firstCondition = allConditions[0]

  if (firstCondition) {
    const value1 = String(firstCondition.value1 || '')
    const operation = firstCondition.operation || 'equals'
    const value2 = String(firstCondition.value2 || '')

    return {
      value1,
      operation,
      value2,
      readable: formatCondition(value1, operation, value2),
    }
  }

  // Default/fallback
  return {
    value1: '',
    operation: 'unknown',
    value2: '',
    readable: 'condition',
  }
}

/**
 * Format a condition for display
 */
function formatCondition(value1: string, operation: string, value2: string): string {
  const opMap: Record<string, string> = {
    equals: '==',
    notEquals: '!=',
    contains: 'contains',
    notContains: 'not contains',
    startsWith: 'starts with',
    endsWith: 'ends with',
    larger: '>',
    smaller: '<',
    largerEqual: '>=',
    smallerEqual: '<=',
    isEmpty: 'is empty',
    isNotEmpty: 'is not empty',
    isTrue: 'is true',
    isFalse: 'is false',
  }

  const opStr = opMap[operation] || operation

  if (operation === 'isEmpty' || operation === 'isNotEmpty') {
    return `${value1} ${opStr}`
  }

  if (operation === 'isTrue' || operation === 'isFalse') {
    return `${value1} ${opStr}`
  }

  return `${value1} ${opStr} ${value2}`
}

/**
 * Format a Switch rule condition
 */
function formatRuleCondition(rule: { value?: unknown; operation?: string }): string {
  if (!rule.value && !rule.operation) return 'matches'
  return `${rule.operation || 'equals'} ${rule.value || ''}`
}

/**
 * Follow a branch path from connection outputs
 * Note: AnalyzedNode uses 'dependencies' for upstream and 'dependents' for downstream
 */
function followBranch(
  connections: Array<{ node: string; type: string; index: number }>,
  workflow: N8nWorkflow,
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>,
  branchNodes: Set<string>
): N8nNode[] {
  if (connections.length === 0) return []

  const nodes: N8nNode[] = []
  const visited = new Set<string>()

  // Process each connected node
  for (const conn of connections) {
    const nodeName = conn.node
    if (visited.has(nodeName) || branchNodes.has(nodeName)) continue

    const node = nodeMap.get(nodeName)
    const analyzed = analyzedMap.get(nodeName)

    if (!node || !analyzed) continue

    // Stop at merge points (multiple inputs)
    if (analyzed.dependencies.length > 1) continue

    visited.add(nodeName)
    branchNodes.add(nodeName)
    nodes.push(node)

    // Continue following if single output
    if (analyzed.dependents.length === 1) {
      const nextConnections = workflow.connections[nodeName]?.main?.[0] || []
      const nextNodes = followBranch(nextConnections, workflow, analyzedMap, nodeMap, branchNodes)
      nodes.push(...nextNodes)
    }
  }

  return nodes
}

/**
 * Find where two branches merge
 */
function findMergePoint(
  branch1: N8nNode[],
  branch2: N8nNode[],
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>
): N8nNode | undefined {
  // Get downstream nodes of last nodes in each branch
  const getDownstream = (nodes: N8nNode[]): string[] => {
    if (nodes.length === 0) return []
    const last = nodes[nodes.length - 1]
    const analyzed = analyzedMap.get(last.name)
    return analyzed?.dependents || []
  }

  const downstream1 = new Set(getDownstream(branch1))
  const downstream2 = new Set(getDownstream(branch2))

  // Find common downstream node
  for (const name of downstream1) {
    if (downstream2.has(name)) {
      return nodeMap.get(name)
    }
  }

  return undefined
}

/**
 * Find common merge point for multiple branches
 */
function findCommonMerge(
  allBranchNodes: N8nNode[],
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>
): N8nNode | undefined {
  // Group nodes by their downstream
  const downstreamCounts = new Map<string, number>()

  for (const node of allBranchNodes) {
    const analyzed = analyzedMap.get(node.name)
    for (const downstream of analyzed?.dependents || []) {
      downstreamCounts.set(downstream, (downstreamCounts.get(downstream) || 0) + 1)
    }
  }

  // Find node with multiple incoming connections from branches
  for (const [name, count] of downstreamCounts) {
    if (count > 1) {
      return nodeMap.get(name)
    }
  }

  return undefined
}
