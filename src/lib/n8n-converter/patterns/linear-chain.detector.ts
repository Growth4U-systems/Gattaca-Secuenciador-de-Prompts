/**
 * Linear Chain Pattern Detector
 *
 * Detects sequences of nodes with single input/output - the simplest
 * pattern to convert to sequential Gattaca steps.
 *
 * A linear chain is: A → B → C where each node has exactly one input
 * and one output (except first/last which may have 0 inputs/outputs).
 */

import { N8nWorkflow, N8nNode } from '../types'
import { analyzeFlow, FlowAnalysis, AnalyzedNode } from '../analyzers'

// ============================================
// Types
// ============================================

/**
 * A detected linear chain of nodes
 */
export interface LinearChain {
  /** Unique ID for this chain */
  id: string

  /** First node in the chain */
  startNode: N8nNode

  /** Last node in the chain */
  endNode: N8nNode

  /** All nodes in order (including start and end) */
  nodes: N8nNode[]

  /** Node names in order */
  nodeNames: string[]

  /** Chain length */
  length: number

  /** Whether this chain starts from a trigger */
  startsFromTrigger: boolean

  /** Whether this chain ends at a terminal node */
  endsAtTerminal: boolean

  /** Parent pattern (if this chain is part of a branch) */
  parentPattern?: string
}

/**
 * Result of linear chain detection
 */
export interface LinearChainDetectionResult {
  /** All detected chains */
  chains: LinearChain[]

  /** Nodes that are part of chains */
  chainedNodes: Set<string>

  /** Nodes not part of any chain */
  unchainedNodes: N8nNode[]

  /** Coverage: percentage of nodes in chains */
  coverage: number
}

// ============================================
// Detection Functions
// ============================================

/**
 * Detect all linear chains in a workflow
 */
export function detectLinearChains(
  workflow: N8nWorkflow,
  flowAnalysis?: FlowAnalysis
): LinearChainDetectionResult {
  // Get or compute flow analysis
  const analysis = flowAnalysis || analyzeFlow(workflow)

  // Build maps for quick lookup
  const nodeMap = new Map<string, N8nNode>()
  const analyzedMap = new Map<string, AnalyzedNode>()

  for (const node of workflow.nodes) {
    nodeMap.set(node.name, node)
  }

  // FlowAnalysis uses 'nodes' Map, not 'analyzedNodes' array
  for (const [name, an] of analysis.nodes) {
    analyzedMap.set(name, an)
  }

  // Track which nodes are already in chains
  const chainedNodes = new Set<string>()
  const chains: LinearChain[] = []

  // Start from entry nodes and follow chains
  const entryNodes = Array.from(analysis.nodes.values()).filter((an) => an.pattern === 'entry')

  for (const entry of entryNodes) {
    const chain = followChain(entry.node.name, analyzedMap, nodeMap, chainedNodes)
    if (chain && chain.length >= 2) {
      chain.id = `chain_${chains.length + 1}`
      chain.startsFromTrigger = true
      chains.push(chain)
    }
  }

  // Also find chains that start after branch points
  const branchNodes = Array.from(analysis.nodes.values()).filter(
    (an) => an.pattern === 'branch' || an.pattern === 'parallel'
  )

  for (const branch of branchNodes) {
    // Each output of a branch can start a new chain
    const analyzed = analyzedMap.get(branch.node.name)
    if (!analyzed) continue

    // AnalyzedNode uses 'dependents' instead of 'downstream'
    for (const downstream of analyzed.dependents) {
      if (!chainedNodes.has(downstream)) {
        const chain = followChain(downstream, analyzedMap, nodeMap, chainedNodes)
        if (chain && chain.length >= 2) {
          chain.id = `chain_${chains.length + 1}`
          chain.startsFromTrigger = false
          chain.parentPattern = branch.pattern
          chains.push(chain)
        }
      }
    }
  }

  // Find unchained nodes
  const unchainedNodes = workflow.nodes.filter((n) => !chainedNodes.has(n.name))

  // Calculate coverage
  const coverage = workflow.nodes.length > 0
    ? chainedNodes.size / workflow.nodes.length
    : 0

  return {
    chains,
    chainedNodes,
    unchainedNodes,
    coverage,
  }
}

/**
 * Follow a chain starting from a node
 */
function followChain(
  startName: string,
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>,
  chainedNodes: Set<string>
): LinearChain | null {
  const nodes: N8nNode[] = []
  const nodeNames: string[] = []
  let currentName = startName

  while (currentName) {
    // Skip if already in a chain
    if (chainedNodes.has(currentName)) break

    const analyzed = analyzedMap.get(currentName)
    const node = nodeMap.get(currentName)

    if (!analyzed || !node) break

    // Check if this is a linear node (single output, max one input)
    // AnalyzedNode uses 'dependencies' for upstream and 'dependents' for downstream
    const isMergePoint = analyzed.dependencies.length > 1
    const isBranchPoint = analyzed.dependents.length > 1
    const isTerminal = analyzed.pattern === 'terminal'

    // For the first node, we accept merge points (they can start chains)
    // For subsequent nodes, we stop at merge points
    if (nodes.length > 0 && isMergePoint) {
      break
    }

    // Add to chain
    nodes.push(node)
    nodeNames.push(currentName)
    chainedNodes.add(currentName)

    // Stop at branch points or terminals
    if (isBranchPoint || isTerminal) {
      break
    }

    // Move to next node
    currentName = analyzed.dependents[0] || ''
  }

  // Need at least 2 nodes for a chain
  if (nodes.length < 2) {
    // Remove from chained set if we didn't form a chain
    for (const name of nodeNames) {
      chainedNodes.delete(name)
    }
    return null
  }

  return {
    id: '',
    startNode: nodes[0],
    endNode: nodes[nodes.length - 1],
    nodes,
    nodeNames,
    length: nodes.length,
    startsFromTrigger: false,
    endsAtTerminal: analyzedMap.get(nodeNames[nodeNames.length - 1])?.pattern === 'terminal',
  }
}

/**
 * Check if a sequence of nodes forms a pure linear chain
 */
export function isLinearSequence(
  nodeNames: string[],
  workflow: N8nWorkflow
): boolean {
  if (nodeNames.length < 2) return false

  const analysis = analyzeFlow(workflow)
  const analyzedMap = new Map<string, AnalyzedNode>()

  for (const [name, an] of analysis.nodes) {
    analyzedMap.set(name, an)
  }

  for (let i = 0; i < nodeNames.length - 1; i++) {
    const current = analyzedMap.get(nodeNames[i])
    const next = nodeNames[i + 1]

    if (!current) return false

    // Current must have exactly one dependent that is next
    if (current.dependents.length !== 1 || current.dependents[0] !== next) {
      return false
    }

    // Next must have exactly one dependency that is current
    const nextAnalyzed = analyzedMap.get(next)
    if (!nextAnalyzed || nextAnalyzed.dependencies.length !== 1) {
      return false
    }
  }

  return true
}

/**
 * Merge consecutive transform nodes in a chain into compound steps
 */
export function groupTransformNodes(
  chain: LinearChain,
  categoryMap: Map<string, string>
): Array<{
  type: 'single' | 'compound'
  nodes: N8nNode[]
  category: string
}> {
  const groups: Array<{
    type: 'single' | 'compound'
    nodes: N8nNode[]
    category: string
  }> = []

  let currentGroup: N8nNode[] = []
  let currentCategory = ''

  for (const node of chain.nodes) {
    const category = categoryMap.get(node.name) || 'unknown'

    if (category === 'transform') {
      // Accumulate transform nodes
      currentGroup.push(node)
      currentCategory = 'transform'
    } else {
      // Flush any accumulated transform nodes
      if (currentGroup.length > 0) {
        groups.push({
          type: currentGroup.length > 1 ? 'compound' : 'single',
          nodes: [...currentGroup],
          category: 'transform',
        })
        currentGroup = []
      }

      // Add non-transform node as single
      groups.push({
        type: 'single',
        nodes: [node],
        category,
      })
    }
  }

  // Flush remaining transform nodes
  if (currentGroup.length > 0) {
    groups.push({
      type: currentGroup.length > 1 ? 'compound' : 'single',
      nodes: [...currentGroup],
      category: 'transform',
    })
  }

  return groups
}
