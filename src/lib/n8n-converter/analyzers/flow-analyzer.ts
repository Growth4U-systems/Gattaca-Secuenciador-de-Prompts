/**
 * n8n Flow Analyzer
 *
 * Analyzes n8n workflow connections to determine:
 * - Execution order (topological sort)
 * - Flow patterns (linear, branch, merge, loop)
 * - Dependencies between nodes
 * - Parallel execution opportunities
 */

import {
  N8nWorkflow,
  N8nNode,
  N8nConnections,
  isTriggerNode,
  isControlFlowNode,
} from '../types'

// ============================================
// Types
// ============================================

/**
 * Analyzed node with dependency information
 */
export interface AnalyzedNode {
  /** Original n8n node */
  node: N8nNode

  /** Nodes that must execute before this one */
  dependencies: string[]

  /** Nodes that execute after this one */
  dependents: string[]

  /** Whether this is a trigger/entry node */
  isEntryPoint: boolean

  /** Whether this is a terminal node (no dependents) */
  isTerminal: boolean

  /** Detected flow pattern at this node */
  pattern: FlowPattern

  /** Branch information (for IF/Switch nodes) */
  branches?: BranchInfo[]

  /** Execution order (0 = first) */
  executionOrder: number

  /** Parallel group ID (nodes in same group can run in parallel) */
  parallelGroupId?: string
}

/**
 * Flow pattern at a node
 */
export type FlowPattern =
  | 'entry'       // Trigger/start node
  | 'linear'      // Single input, single output
  | 'branch'      // Single input, multiple outputs (IF, Switch)
  | 'merge'       // Multiple inputs, single output (Merge node)
  | 'parallel'    // Part of parallel execution path
  | 'loop'        // Part of a loop structure
  | 'terminal'    // No outputs (end of flow)

/**
 * Branch information for IF/Switch nodes
 */
export interface BranchInfo {
  /** Branch condition name (e.g., 'true', 'false', 'case1') */
  name: string

  /** Output index (0 = first output) */
  outputIndex: number

  /** Nodes in this branch */
  nodes: string[]
}

/**
 * Complete flow analysis result
 */
export interface FlowAnalysis {
  /** All analyzed nodes */
  nodes: Map<string, AnalyzedNode>

  /** Nodes in execution order */
  executionOrder: string[]

  /** Entry point nodes (triggers) */
  entryPoints: string[]

  /** Terminal nodes (no outputs) */
  terminals: string[]

  /** Detected patterns summary */
  patterns: {
    hasLinearFlow: boolean
    hasBranches: boolean
    hasMerges: boolean
    hasParallelPaths: boolean
    hasLoops: boolean
  }

  /** Warnings about the flow */
  warnings: string[]

  /** Suggested phase groupings */
  suggestedPhases: PhaseGrouping[]
}

/**
 * Suggested phase grouping for playbook
 */
export interface PhaseGrouping {
  /** Phase name */
  name: string

  /** Nodes in this phase (in execution order) */
  nodeNames: string[]

  /** Why these nodes are grouped */
  reason: string
}

// ============================================
// Graph Building
// ============================================

/**
 * Build adjacency lists from n8n connections
 */
function buildGraph(workflow: N8nWorkflow): {
  outgoing: Map<string, Set<string>>  // node -> nodes it connects to
  incoming: Map<string, Set<string>>  // node -> nodes that connect to it
} {
  const outgoing = new Map<string, Set<string>>()
  const incoming = new Map<string, Set<string>>()

  // Initialize all nodes
  for (const node of workflow.nodes) {
    outgoing.set(node.name, new Set())
    incoming.set(node.name, new Set())
  }

  // Build from connections
  for (const [sourceName, nodeConns] of Object.entries(workflow.connections)) {
    // Process all connection types (main, ai_*, etc.)
    for (const outputs of Object.values(nodeConns)) {
      if (!outputs) continue

      for (const outputConnections of outputs) {
        for (const conn of outputConnections) {
          outgoing.get(sourceName)?.add(conn.node)
          incoming.get(conn.node)?.add(sourceName)
        }
      }
    }
  }

  return { outgoing, incoming }
}

// ============================================
// Topological Sort
// ============================================

/**
 * Perform topological sort using Kahn's algorithm
 * Returns nodes in execution order, or throws if cycle detected
 */
function topologicalSort(
  nodeNames: string[],
  outgoing: Map<string, Set<string>>,
  incoming: Map<string, Set<string>>
): { order: string[]; hasCycle: boolean; cycleNodes?: string[] } {
  // Copy incoming counts (we'll modify them)
  const inDegree = new Map<string, number>()
  for (const name of nodeNames) {
    inDegree.set(name, incoming.get(name)?.size || 0)
  }

  // Start with nodes that have no incoming edges
  const queue: string[] = []
  for (const name of nodeNames) {
    if (inDegree.get(name) === 0) {
      queue.push(name)
    }
  }

  const order: string[] = []
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    order.push(current)
    visited.add(current)

    // Reduce in-degree for all dependents
    const dependents = outgoing.get(current) || new Set()
    for (const dep of dependents) {
      const newDegree = (inDegree.get(dep) || 0) - 1
      inDegree.set(dep, newDegree)

      if (newDegree === 0 && !visited.has(dep)) {
        queue.push(dep)
      }
    }
  }

  // Check for cycle
  if (order.length !== nodeNames.length) {
    const cycleNodes = nodeNames.filter(n => !visited.has(n))
    return { order, hasCycle: true, cycleNodes }
  }

  return { order, hasCycle: false }
}

// ============================================
// Pattern Detection
// ============================================

/**
 * Detect flow pattern at a node
 */
function detectPattern(
  nodeName: string,
  node: N8nNode,
  outgoing: Map<string, Set<string>>,
  incoming: Map<string, Set<string>>
): FlowPattern {
  const inCount = incoming.get(nodeName)?.size || 0
  const outCount = outgoing.get(nodeName)?.size || 0

  // Entry point (trigger or no inputs)
  if (inCount === 0 || isTriggerNode(node.type)) {
    return 'entry'
  }

  // Terminal (no outputs)
  if (outCount === 0) {
    return 'terminal'
  }

  // Branch (IF, Switch - typically have multiple outputs)
  if (isControlFlowNode(node.type) && outCount > 1) {
    return 'branch'
  }

  // Merge (multiple inputs)
  if (inCount > 1) {
    return 'merge'
  }

  // Linear (single input, single output)
  return 'linear'
}

/**
 * Detect branch information for IF/Switch nodes
 */
function detectBranches(
  nodeName: string,
  node: N8nNode,
  connections: N8nConnections
): BranchInfo[] | undefined {
  if (!isControlFlowNode(node.type)) {
    return undefined
  }

  const nodeConns = connections[nodeName]
  if (!nodeConns?.main) {
    return undefined
  }

  const branches: BranchInfo[] = []
  const baseType = node.type.split('.').pop()

  for (let i = 0; i < nodeConns.main.length; i++) {
    const outputConns = nodeConns.main[i]
    if (outputConns.length > 0) {
      // Name based on node type
      let branchName: string
      if (baseType === 'if') {
        branchName = i === 0 ? 'true' : 'false'
      } else if (baseType === 'switch') {
        // Try to get case name from parameters
        branchName = `case_${i}`
      } else {
        branchName = `output_${i}`
      }

      branches.push({
        name: branchName,
        outputIndex: i,
        nodes: outputConns.map(c => c.node),
      })
    }
  }

  return branches.length > 0 ? branches : undefined
}

/**
 * Identify parallel groups (nodes that can execute concurrently)
 */
function identifyParallelGroups(
  executionOrder: string[],
  incoming: Map<string, Set<string>>,
  outgoing: Map<string, Set<string>>
): Map<string, string> {
  const parallelGroups = new Map<string, string>()

  // Nodes at the same "depth" with same dependencies can run in parallel
  // Simple heuristic: group by set of dependencies

  const depSignatures = new Map<string, string[]>()

  for (const name of executionOrder) {
    const deps = Array.from(incoming.get(name) || []).sort().join(',')
    if (!depSignatures.has(deps)) {
      depSignatures.set(deps, [])
    }
    depSignatures.get(deps)!.push(name)
  }

  let groupId = 0
  for (const [, nodes] of depSignatures) {
    if (nodes.length > 1) {
      // Multiple nodes with same dependencies = parallel group
      const id = `parallel_${groupId++}`
      for (const name of nodes) {
        parallelGroups.set(name, id)
      }
    }
  }

  return parallelGroups
}

// ============================================
// Phase Grouping
// ============================================

/**
 * Suggest phase groupings for the playbook
 */
function suggestPhases(
  workflow: N8nWorkflow,
  executionOrder: string[],
  analyzedNodes: Map<string, AnalyzedNode>
): PhaseGrouping[] {
  const phases: PhaseGrouping[] = []
  let currentPhase: PhaseGrouping | null = null

  const nodeMap = new Map(workflow.nodes.map(n => [n.name, n]))

  for (const name of executionOrder) {
    const node = nodeMap.get(name)!
    const analyzed = analyzedNodes.get(name)!

    // Start new phase on:
    // 1. First node
    // 2. After a branch/merge pattern
    // 3. Major node type change (trigger -> processing -> output)

    const shouldStartNewPhase =
      !currentPhase ||
      analyzed.pattern === 'entry' ||
      analyzed.pattern === 'merge' ||
      (currentPhase.nodeNames.length > 0 && analyzed.pattern === 'branch')

    if (shouldStartNewPhase) {
      // Determine phase name
      let phaseName: string
      let reason: string

      if (analyzed.pattern === 'entry') {
        phaseName = 'Trigger'
        reason = 'Entry point / trigger nodes'
      } else if (analyzed.pattern === 'merge') {
        phaseName = `Process ${phases.length + 1}`
        reason = 'After merge point'
      } else if (analyzed.pattern === 'branch') {
        phaseName = `Decision ${phases.length + 1}`
        reason = 'Branching logic'
      } else {
        phaseName = `Phase ${phases.length + 1}`
        reason = 'Sequential processing'
      }

      currentPhase = {
        name: phaseName,
        nodeNames: [name],
        reason,
      }
      phases.push(currentPhase)
    } else {
      currentPhase!.nodeNames.push(name)
    }
  }

  return phases
}

// ============================================
// Main Analysis Function
// ============================================

/**
 * Analyze n8n workflow flow structure
 *
 * @param workflow - Parsed n8n workflow
 * @returns Complete flow analysis
 *
 * @example
 * ```typescript
 * const workflow = parseN8nWorkflow(json)
 * const analysis = analyzeFlow(workflow)
 *
 * // Get execution order
 * for (const nodeName of analysis.executionOrder) {
 *   console.log(nodeName)
 * }
 *
 * // Check for branches
 * if (analysis.patterns.hasBranches) {
 *   console.log('Workflow has conditional logic')
 * }
 * ```
 */
export function analyzeFlow(workflow: N8nWorkflow): FlowAnalysis {
  const warnings: string[] = []

  // Build graph
  const { outgoing, incoming } = buildGraph(workflow)

  // Get all node names
  const nodeNames = workflow.nodes.map(n => n.name)

  // Topological sort
  const sortResult = topologicalSort(nodeNames, outgoing, incoming)

  if (sortResult.hasCycle) {
    warnings.push(
      `Cycle detected involving nodes: ${sortResult.cycleNodes?.join(', ')}. ` +
      `This may need manual handling for loop conversion.`
    )
  }

  // Analyze each node
  const analyzedNodes = new Map<string, AnalyzedNode>()
  const nodeMap = new Map(workflow.nodes.map(n => [n.name, n]))

  // Identify parallel groups
  const parallelGroups = identifyParallelGroups(sortResult.order, incoming, outgoing)

  for (let i = 0; i < sortResult.order.length; i++) {
    const name = sortResult.order[i]
    const node = nodeMap.get(name)!

    const pattern = detectPattern(name, node, outgoing, incoming)
    const branches = detectBranches(name, node, workflow.connections)

    analyzedNodes.set(name, {
      node,
      dependencies: Array.from(incoming.get(name) || []),
      dependents: Array.from(outgoing.get(name) || []),
      isEntryPoint: pattern === 'entry',
      isTerminal: pattern === 'terminal',
      pattern,
      branches,
      executionOrder: i,
      parallelGroupId: parallelGroups.get(name),
    })
  }

  // Identify entry points and terminals
  const entryPoints = Array.from(analyzedNodes.values())
    .filter(n => n.isEntryPoint)
    .map(n => n.node.name)

  const terminals = Array.from(analyzedNodes.values())
    .filter(n => n.isTerminal)
    .map(n => n.node.name)

  // Detect pattern summary
  const patterns = {
    hasLinearFlow: Array.from(analyzedNodes.values()).some(n => n.pattern === 'linear'),
    hasBranches: Array.from(analyzedNodes.values()).some(n => n.pattern === 'branch'),
    hasMerges: Array.from(analyzedNodes.values()).some(n => n.pattern === 'merge'),
    hasParallelPaths: parallelGroups.size > 0,
    hasLoops: sortResult.hasCycle,
  }

  // Suggest phases
  const suggestedPhases = suggestPhases(workflow, sortResult.order, analyzedNodes)

  // Validation warnings
  if (entryPoints.length === 0) {
    warnings.push('No entry point (trigger) detected. Workflow may not be executable.')
  }

  if (entryPoints.length > 1) {
    warnings.push(
      `Multiple entry points detected: ${entryPoints.join(', ')}. ` +
      `Only one trigger is typically supported.`
    )
  }

  return {
    nodes: analyzedNodes,
    executionOrder: sortResult.order,
    entryPoints,
    terminals,
    patterns,
    warnings,
    suggestedPhases,
  }
}

/**
 * Get nodes that depend on a specific node
 */
export function getDependentNodes(
  analysis: FlowAnalysis,
  nodeName: string
): string[] {
  const node = analysis.nodes.get(nodeName)
  if (!node) return []

  const dependents = new Set<string>()
  const queue = [...node.dependents]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (dependents.has(current)) continue
    dependents.add(current)

    const currentNode = analysis.nodes.get(current)
    if (currentNode) {
      queue.push(...currentNode.dependents)
    }
  }

  return Array.from(dependents)
}

/**
 * Get all nodes that this node depends on (transitive)
 */
export function getUpstreamNodes(
  analysis: FlowAnalysis,
  nodeName: string
): string[] {
  const node = analysis.nodes.get(nodeName)
  if (!node) return []

  const upstream = new Set<string>()
  const queue = [...node.dependencies]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (upstream.has(current)) continue
    upstream.add(current)

    const currentNode = analysis.nodes.get(current)
    if (currentNode) {
      queue.push(...currentNode.dependencies)
    }
  }

  return Array.from(upstream)
}
