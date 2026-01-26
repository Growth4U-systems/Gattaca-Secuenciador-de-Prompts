/**
 * Loop Pattern Detector
 *
 * Detects loop/iteration patterns in n8n workflows:
 * - SplitInBatches loops (batch processing with back-connection)
 * - Explicit loops (nodes that connect back to earlier nodes)
 * - ItemLists iteration patterns
 */

import { N8nWorkflow, N8nNode } from '../types'
import { analyzeFlow, FlowAnalysis, AnalyzedNode } from '../analyzers'

// ============================================
// Types
// ============================================

/**
 * A detected loop pattern
 */
export interface LoopPattern {
  /** Unique ID for this pattern */
  id: string

  /** Type of loop */
  type: 'split-batch-loop' | 'back-edge-loop' | 'item-iteration'

  /** Node that controls/starts the loop */
  controlNode: N8nNode

  /** Nodes inside the loop body (executed per iteration) */
  bodyNodes: N8nNode[]

  /** Node names in the loop body */
  bodyNodeNames: string[]

  /** Node that marks the end of loop body (connects back) */
  tailNode?: N8nNode

  /** Node executed after loop completes */
  exitNode?: N8nNode

  /** Whether loop has a defined exit condition */
  hasExitCondition: boolean

  /** Estimated max iterations (if determinable) */
  maxIterations?: number

  /** Loop configuration details */
  config: LoopConfig
}

/**
 * Loop configuration extracted from node parameters
 */
export interface LoopConfig {
  /** Batch size (for SplitInBatches) */
  batchSize?: number

  /** Whether to reset loop state */
  reset?: boolean

  /** Field being iterated */
  iterateField?: string

  /** Loop options */
  options?: Record<string, unknown>
}

/**
 * Result of loop detection
 */
export interface LoopDetectionResult {
  /** All detected loop patterns */
  patterns: LoopPattern[]

  /** SplitInBatches loops */
  splitBatchLoops: LoopPattern[]

  /** Back-edge loops (explicit cycles) */
  backEdgeLoops: LoopPattern[]

  /** Item iteration patterns */
  itemIterations: LoopPattern[]

  /** Nodes that are part of loops */
  loopNodes: Set<string>

  /** Whether workflow has cycles */
  hasCycles: boolean

  /** Statistics */
  stats: {
    totalLoops: number
    totalNodesInLoops: number
    deepestNesting: number
  }
}

// ============================================
// Detection Functions
// ============================================

/**
 * Detect all loop patterns in a workflow
 */
export function detectLoopPatterns(
  workflow: N8nWorkflow,
  flowAnalysis?: FlowAnalysis
): LoopDetectionResult {
  const analysis = flowAnalysis || analyzeFlow(workflow)

  const nodeMap = new Map<string, N8nNode>()
  const analyzedMap = new Map<string, AnalyzedNode>()

  for (const node of workflow.nodes) {
    nodeMap.set(node.name, node)
  }

  for (const an of Array.from(analysis.nodes.values())) {
    analyzedMap.set(an.node.name, an)
  }

  const patterns: LoopPattern[] = []
  const splitBatchLoops: LoopPattern[] = []
  const backEdgeLoops: LoopPattern[] = []
  const itemIterations: LoopPattern[] = []
  const loopNodes = new Set<string>()

  // Detect SplitInBatches loop patterns
  const splitNodes = workflow.nodes.filter(
    (n) =>
      n.type === 'n8n-nodes-base.splitInBatches' ||
      n.type.endsWith('.splitInBatches')
  )

  for (const splitNode of splitNodes) {
    const pattern = detectSplitBatchLoop(
      splitNode,
      workflow,
      analyzedMap,
      nodeMap,
      loopNodes
    )
    if (pattern) {
      pattern.id = `split_loop_${splitBatchLoops.length + 1}`
      splitBatchLoops.push(pattern)
      patterns.push(pattern)
    }
  }

  // Detect back-edge loops (cycles in the graph)
  const backEdges = findBackEdges(workflow, analysis)
  for (const backEdge of backEdges) {
    const pattern = detectBackEdgeLoop(
      backEdge,
      workflow,
      analyzedMap,
      nodeMap,
      loopNodes
    )
    if (pattern) {
      pattern.id = `cycle_${backEdgeLoops.length + 1}`
      backEdgeLoops.push(pattern)
      patterns.push(pattern)
    }
  }

  // Detect ItemLists iteration patterns
  const itemListNodes = workflow.nodes.filter(
    (n) =>
      n.type === 'n8n-nodes-base.itemLists' ||
      n.type.endsWith('.itemLists') ||
      n.type === 'n8n-nodes-base.spreadsheetFile' ||
      n.type.endsWith('.spreadsheetFile')
  )

  for (const itemNode of itemListNodes) {
    const pattern = detectItemIterationPattern(
      itemNode,
      workflow,
      analyzedMap,
      nodeMap,
      loopNodes
    )
    if (pattern) {
      pattern.id = `item_iter_${itemIterations.length + 1}`
      itemIterations.push(pattern)
      patterns.push(pattern)
    }
  }

  // Calculate nesting depth
  const deepestNesting = calculateNestingDepth(patterns, loopNodes)

  return {
    patterns,
    splitBatchLoops,
    backEdgeLoops,
    itemIterations,
    loopNodes,
    hasCycles: backEdgeLoops.length > 0,
    stats: {
      totalLoops: patterns.length,
      totalNodesInLoops: loopNodes.size,
      deepestNesting,
    },
  }
}

/**
 * Detect SplitInBatches loop pattern
 */
function detectSplitBatchLoop(
  splitNode: N8nNode,
  workflow: N8nWorkflow,
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>,
  loopNodes: Set<string>
): LoopPattern | null {
  const analyzed = analyzedMap.get(splitNode.name)
  if (!analyzed) return null

  loopNodes.add(splitNode.name)

  // SplitInBatches has:
  // - Output 0: "loop" - for each batch
  // - Output 1: "done" - when all batches processed

  const loopOutput = analyzed.dependents[0]
  const doneOutput = analyzed.dependents[1]

  // Find the loop body nodes
  const bodyNodes: N8nNode[] = []
  const bodyNodeNames: string[] = []
  let tailNode: N8nNode | undefined
  let exitNode: N8nNode | undefined

  if (loopOutput) {
    // Follow loop path and find where it connects back to SplitInBatches
    let currentName = loopOutput
    const visited = new Set<string>()

    while (currentName && !visited.has(currentName)) {
      visited.add(currentName)

      const node = nodeMap.get(currentName)
      const nodeAnalyzed = analyzedMap.get(currentName)

      if (!node || !nodeAnalyzed) break

      // Check if this connects back to the split node
      if (nodeAnalyzed.dependents.includes(splitNode.name)) {
        tailNode = node
        loopNodes.add(currentName)
        bodyNodes.push(node)
        bodyNodeNames.push(currentName)
        break
      }

      loopNodes.add(currentName)
      bodyNodes.push(node)
      bodyNodeNames.push(currentName)

      // Continue to next node (single path)
      if (nodeAnalyzed.dependents.length === 1) {
        currentName = nodeAnalyzed.dependents[0]
      } else {
        break
      }
    }
  }

  if (doneOutput) {
    exitNode = nodeMap.get(doneOutput)
  }

  // Extract configuration
  const params = splitNode.parameters
  const config: LoopConfig = {
    batchSize: (params.batchSize as number) || 10,
    reset: params.options && typeof params.options === 'object'
      ? Boolean((params.options as Record<string, unknown>).reset)
      : false,
    options: params.options as Record<string, unknown> | undefined,
  }

  return {
    id: '',
    type: 'split-batch-loop',
    controlNode: splitNode,
    bodyNodes,
    bodyNodeNames,
    tailNode,
    exitNode,
    hasExitCondition: true, // SplitInBatches always has exit condition
    maxIterations: undefined, // Depends on input data size
    config,
  }
}

/**
 * Find back edges (cycles) in the workflow graph
 */
function findBackEdges(
  workflow: N8nWorkflow,
  analysis: FlowAnalysis
): Array<{ from: string; to: string }> {
  const backEdges: Array<{ from: string; to: string }> = []

  // Use topological order - any edge going "backward" is a back edge
  const order = analysis.executionOrder
  const orderIndex = new Map<string, number>()

  order.forEach((name, idx) => orderIndex.set(name, idx))

  // Check all connections
  for (const [sourceName, nodeConns] of Object.entries(workflow.connections)) {
    const sourceIdx = orderIndex.get(sourceName)
    if (sourceIdx === undefined) continue

    const mainOutputs = nodeConns.main || []
    for (const outputs of mainOutputs) {
      for (const conn of outputs) {
        const targetIdx = orderIndex.get(conn.node)
        if (targetIdx !== undefined && targetIdx <= sourceIdx) {
          // This is a back edge (goes to same or earlier node)
          backEdges.push({ from: sourceName, to: conn.node })
        }
      }
    }
  }

  return backEdges
}

/**
 * Detect loop pattern from a back edge
 */
function detectBackEdgeLoop(
  backEdge: { from: string; to: string },
  workflow: N8nWorkflow,
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>,
  loopNodes: Set<string>
): LoopPattern | null {
  const controlNode = nodeMap.get(backEdge.to)
  const tailNode = nodeMap.get(backEdge.from)

  if (!controlNode || !tailNode) return null

  loopNodes.add(backEdge.to)
  loopNodes.add(backEdge.from)

  // Find all nodes in the loop body (between control and tail)
  const bodyNodes: N8nNode[] = []
  const bodyNodeNames: string[] = []
  const visited = new Set<string>()

  function collectLoopBody(nodeName: string): void {
    if (visited.has(nodeName) || nodeName === backEdge.from) return

    visited.add(nodeName)
    const node = nodeMap.get(nodeName)
    const analyzed = analyzedMap.get(nodeName)

    if (!node || !analyzed) return

    if (nodeName !== backEdge.to) {
      bodyNodes.push(node)
      bodyNodeNames.push(nodeName)
      loopNodes.add(nodeName)
    }

    // Follow downstream paths
    for (const downstream of analyzed.dependents) {
      if (downstream !== backEdge.to) {
        collectLoopBody(downstream)
      }
    }
  }

  // Start from control node's downstream
  const controlAnalyzed = analyzedMap.get(backEdge.to)
  if (controlAnalyzed) {
    for (const downstream of controlAnalyzed.dependents) {
      collectLoopBody(downstream)
    }
  }

  // Find exit node (downstream of control that's not in the loop)
  let exitNode: N8nNode | undefined
  if (controlAnalyzed) {
    for (const downstream of controlAnalyzed.dependents) {
      if (!loopNodes.has(downstream)) {
        exitNode = nodeMap.get(downstream)
        break
      }
    }
  }

  return {
    id: '',
    type: 'back-edge-loop',
    controlNode,
    bodyNodes,
    bodyNodeNames,
    tailNode,
    exitNode,
    hasExitCondition: exitNode !== undefined,
    config: {},
  }
}

/**
 * Detect item iteration pattern
 */
function detectItemIterationPattern(
  itemNode: N8nNode,
  workflow: N8nWorkflow,
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>,
  loopNodes: Set<string>
): LoopPattern | null {
  const analyzed = analyzedMap.get(itemNode.name)
  if (!analyzed) return null

  // ItemLists with "Split Out Items" operation creates implicit iteration
  const params = itemNode.parameters
  const operation = params.operation as string

  if (operation !== 'splitOutItems' && operation !== 'aggregateItems') {
    return null
  }

  loopNodes.add(itemNode.name)

  // Find downstream nodes that process the split items
  const bodyNodes: N8nNode[] = []
  const bodyNodeNames: string[] = []

  let currentName = analyzed.dependents[0]
  while (currentName) {
    const node = nodeMap.get(currentName)
    const nodeAnalyzed = analyzedMap.get(currentName)

    if (!node || !nodeAnalyzed) break

    // Stop at aggregation points or merge nodes
    if (
      node.type.includes('merge') ||
      node.type.includes('aggregate') ||
      nodeAnalyzed.dependencies.length > 1
    ) {
      break
    }

    loopNodes.add(currentName)
    bodyNodes.push(node)
    bodyNodeNames.push(currentName)

    if (nodeAnalyzed.dependents.length === 1) {
      currentName = nodeAnalyzed.dependents[0]
    } else {
      break
    }
  }

  const config: LoopConfig = {
    iterateField: params.fieldToSplitOut as string || params.aggregate as string,
    options: params.options as Record<string, unknown> | undefined,
  }

  return {
    id: '',
    type: 'item-iteration',
    controlNode: itemNode,
    bodyNodes,
    bodyNodeNames,
    hasExitCondition: true, // Processes all items
    config,
  }
}

/**
 * Calculate the deepest nesting level of loops
 */
function calculateNestingDepth(
  patterns: LoopPattern[],
  loopNodes: Set<string>
): number {
  if (patterns.length === 0) return 0

  let maxDepth = 1

  // Check if any loop's body contains another loop's control node
  for (const outer of patterns) {
    for (const inner of patterns) {
      if (outer === inner) continue

      if (outer.bodyNodeNames.includes(inner.controlNode.name)) {
        maxDepth = Math.max(maxDepth, 2)
        // Could recursively check for deeper nesting, but 2 levels is typical
      }
    }
  }

  return maxDepth
}
