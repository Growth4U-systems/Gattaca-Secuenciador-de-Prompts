/**
 * Parallel Execution Pattern Detector
 *
 * Detects patterns where multiple nodes execute in parallel:
 * - Fan-out: One node triggers multiple parallel paths
 * - Merge/Join: Multiple parallel paths converge into one node
 * - SplitInBatches: Items processed in parallel batches
 */

import { N8nWorkflow, N8nNode } from '../types'
import { analyzeFlow, FlowAnalysis, AnalyzedNode } from '../analyzers'

// ============================================
// Types
// ============================================

/**
 * A detected parallel execution pattern
 */
export interface ParallelPattern {
  /** Unique ID for this pattern */
  id: string

  /** Type of parallel pattern */
  type: 'fan-out' | 'fan-in' | 'split-batch' | 'parallel-group'

  /** The node that starts the parallel execution */
  sourceNode: N8nNode

  /** The node where parallel paths merge (if any) */
  mergeNode?: N8nNode

  /** Parallel branches/paths */
  branches: ParallelBranch[]

  /** Total nodes involved in this pattern */
  nodeCount: number

  /** Estimated parallelism level */
  parallelism: number
}

/**
 * A single parallel branch
 */
export interface ParallelBranch {
  /** Branch identifier */
  id: string

  /** Starting node of this branch */
  startNode: N8nNode

  /** All nodes in this branch (in order) */
  nodes: N8nNode[]

  /** Node names for quick lookup */
  nodeNames: string[]

  /** Ending node (before merge) */
  endNode?: N8nNode

  /** Output index from source */
  sourceOutputIndex: number
}

/**
 * Result of parallel pattern detection
 */
export interface ParallelDetectionResult {
  /** All detected parallel patterns */
  patterns: ParallelPattern[]

  /** Fan-out patterns (one-to-many) */
  fanOutPatterns: ParallelPattern[]

  /** Fan-in patterns (many-to-one) */
  fanInPatterns: ParallelPattern[]

  /** Split batch patterns */
  splitBatchPatterns: ParallelPattern[]

  /** Nodes that are part of parallel patterns */
  parallelNodes: Set<string>

  /** Statistics */
  stats: {
    totalPatterns: number
    maxParallelism: number
    avgParallelism: number
  }
}

// ============================================
// Detection Functions
// ============================================

/**
 * Detect all parallel execution patterns in a workflow
 */
export function detectParallelPatterns(
  workflow: N8nWorkflow,
  flowAnalysis?: FlowAnalysis
): ParallelDetectionResult {
  const analysis = flowAnalysis || analyzeFlow(workflow)

  const nodeMap = new Map<string, N8nNode>()
  const analyzedMap = new Map<string, AnalyzedNode>()

  for (const node of workflow.nodes) {
    nodeMap.set(node.name, node)
  }

  for (const an of Array.from(analysis.nodes.values())) {
    analyzedMap.set(an.node.name, an)
  }

  const patterns: ParallelPattern[] = []
  const fanOutPatterns: ParallelPattern[] = []
  const fanInPatterns: ParallelPattern[] = []
  const splitBatchPatterns: ParallelPattern[] = []
  const parallelNodes = new Set<string>()

  // Detect fan-out patterns (nodes with multiple outputs going to different nodes)
  for (const analyzed of Array.from(analysis.nodes.values())) {
    // Skip IF/Switch nodes (those are branch patterns, not parallel)
    const nodeType = analyzed.node.type.toLowerCase()
    if (nodeType.includes('if') || nodeType.includes('switch')) continue

    if (analyzed.dependents.length > 1 && analyzed.pattern === 'parallel') {
      const pattern = detectFanOutPattern(
        analyzed.node,
        workflow,
        analyzedMap,
        nodeMap,
        parallelNodes
      )
      if (pattern) {
        pattern.id = `fanout_${fanOutPatterns.length + 1}`
        fanOutPatterns.push(pattern)
        patterns.push(pattern)
      }
    }
  }

  // Detect fan-in patterns (Merge nodes or nodes with multiple inputs)
  const mergeNodes = workflow.nodes.filter(
    (n) =>
      n.type === 'n8n-nodes-base.merge' ||
      n.type.endsWith('.merge') ||
      n.type === 'n8n-nodes-base.noOp'
  )

  for (const mergeNode of mergeNodes) {
    const analyzed = analyzedMap.get(mergeNode.name)
    if (analyzed && analyzed.dependencies.length > 1) {
      const pattern = detectFanInPattern(mergeNode, workflow, analyzedMap, nodeMap, parallelNodes)
      if (pattern) {
        pattern.id = `fanin_${fanInPatterns.length + 1}`
        fanInPatterns.push(pattern)
        patterns.push(pattern)
      }
    }
  }

  // Detect SplitInBatches patterns
  const splitNodes = workflow.nodes.filter(
    (n) =>
      n.type === 'n8n-nodes-base.splitInBatches' ||
      n.type.endsWith('.splitInBatches')
  )

  for (const splitNode of splitNodes) {
    const pattern = detectSplitBatchPattern(
      splitNode,
      workflow,
      analyzedMap,
      nodeMap,
      parallelNodes
    )
    if (pattern) {
      pattern.id = `split_${splitBatchPatterns.length + 1}`
      splitBatchPatterns.push(pattern)
      patterns.push(pattern)
    }
  }

  // Calculate stats
  const parallelismValues = patterns.map((p) => p.parallelism)
  const maxParallelism = parallelismValues.length > 0 ? Math.max(...parallelismValues) : 0
  const avgParallelism =
    parallelismValues.length > 0
      ? parallelismValues.reduce((a, b) => a + b, 0) / parallelismValues.length
      : 0

  return {
    patterns,
    fanOutPatterns,
    fanInPatterns,
    splitBatchPatterns,
    parallelNodes,
    stats: {
      totalPatterns: patterns.length,
      maxParallelism,
      avgParallelism,
    },
  }
}

/**
 * Detect a fan-out pattern (one node spawning multiple parallel paths)
 */
export function detectFanOutPattern(
  sourceNode: N8nNode,
  workflow: N8nWorkflow,
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>,
  parallelNodes: Set<string>
): ParallelPattern | null {
  const analyzed = analyzedMap.get(sourceNode.name)
  if (!analyzed || analyzed.dependents.length < 2) return null

  parallelNodes.add(sourceNode.name)

  const branches: ParallelBranch[] = []

  // Follow each downstream path
  for (let i = 0; i < analyzed.dependents.length; i++) {
    const downstreamName = analyzed.dependents[i]
    const downstreamNode = nodeMap.get(downstreamName)

    if (!downstreamNode) continue

    parallelNodes.add(downstreamName)

    // Follow the path until merge or terminal
    const branchNodes = followParallelBranch(
      downstreamNode,
      workflow,
      analyzedMap,
      nodeMap,
      parallelNodes
    )

    branches.push({
      id: `branch_${i}`,
      startNode: downstreamNode,
      nodes: [downstreamNode, ...branchNodes],
      nodeNames: [downstreamName, ...branchNodes.map((n) => n.name)],
      endNode: branchNodes.length > 0 ? branchNodes[branchNodes.length - 1] : downstreamNode,
      sourceOutputIndex: i,
    })
  }

  // Find merge point
  const mergeNode = findParallelMergePoint(branches, analyzedMap, nodeMap)

  const totalNodes =
    1 +
    branches.reduce((sum, b) => sum + b.nodes.length, 0) +
    (mergeNode ? 1 : 0)

  return {
    id: '',
    type: 'fan-out',
    sourceNode,
    mergeNode,
    branches,
    nodeCount: totalNodes,
    parallelism: branches.length,
  }
}

/**
 * Detect a fan-in pattern (multiple paths merging into one)
 */
export function detectFanInPattern(
  mergeNode: N8nNode,
  workflow: N8nWorkflow,
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>,
  parallelNodes: Set<string>
): ParallelPattern | null {
  const analyzed = analyzedMap.get(mergeNode.name)
  if (!analyzed || analyzed.dependencies.length < 2) return null

  parallelNodes.add(mergeNode.name)

  const branches: ParallelBranch[] = []

  // Trace back each upstream path
  for (let i = 0; i < analyzed.dependencies.length; i++) {
    const upstreamName = analyzed.dependencies[i]
    const upstreamNode = nodeMap.get(upstreamName)

    if (!upstreamNode) continue

    parallelNodes.add(upstreamName)

    // Trace back to find the source
    const branchNodes = traceBackParallelBranch(
      upstreamNode,
      analyzedMap,
      nodeMap,
      parallelNodes
    )

    branches.push({
      id: `input_${i}`,
      startNode: branchNodes.length > 0 ? branchNodes[branchNodes.length - 1] : upstreamNode,
      nodes: [...branchNodes.reverse(), upstreamNode],
      nodeNames: [...branchNodes.map((n) => n.name).reverse(), upstreamName],
      endNode: upstreamNode,
      sourceOutputIndex: i,
    })
  }

  // Find common source (if any)
  const sourceNode = findCommonSource(branches, analyzedMap, nodeMap)

  const totalNodes =
    1 +
    branches.reduce((sum, b) => sum + b.nodes.length, 0)

  return {
    id: '',
    type: 'fan-in',
    sourceNode: sourceNode || branches[0]?.startNode || mergeNode,
    mergeNode,
    branches,
    nodeCount: totalNodes,
    parallelism: branches.length,
  }
}

/**
 * Detect a SplitInBatches pattern
 */
export function detectSplitBatchPattern(
  splitNode: N8nNode,
  workflow: N8nWorkflow,
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>,
  parallelNodes: Set<string>
): ParallelPattern | null {
  const analyzed = analyzedMap.get(splitNode.name)
  if (!analyzed) return null

  parallelNodes.add(splitNode.name)

  // SplitInBatches typically has "loop" output (index 0) and "done" output (index 1)
  const loopOutput = analyzed.dependents[0]
  const doneOutput = analyzed.dependents[1]

  const branches: ParallelBranch[] = []

  // Follow loop path
  if (loopOutput) {
    const loopNode = nodeMap.get(loopOutput)
    if (loopNode) {
      parallelNodes.add(loopOutput)
      const loopBranchNodes = followParallelBranch(
        loopNode,
        workflow,
        analyzedMap,
        nodeMap,
        parallelNodes
      )

      branches.push({
        id: 'loop',
        startNode: loopNode,
        nodes: [loopNode, ...loopBranchNodes],
        nodeNames: [loopOutput, ...loopBranchNodes.map((n) => n.name)],
        endNode: loopBranchNodes.length > 0 ? loopBranchNodes[loopBranchNodes.length - 1] : loopNode,
        sourceOutputIndex: 0,
      })
    }
  }

  // Follow done path
  if (doneOutput) {
    const doneNode = nodeMap.get(doneOutput)
    if (doneNode) {
      parallelNodes.add(doneOutput)
      const doneBranchNodes = followParallelBranch(
        doneNode,
        workflow,
        analyzedMap,
        nodeMap,
        parallelNodes
      )

      branches.push({
        id: 'done',
        startNode: doneNode,
        nodes: [doneNode, ...doneBranchNodes],
        nodeNames: [doneOutput, ...doneBranchNodes.map((n) => n.name)],
        endNode: doneBranchNodes.length > 0 ? doneBranchNodes[doneBranchNodes.length - 1] : doneNode,
        sourceOutputIndex: 1,
      })
    }
  }

  // Get batch size from parameters
  const batchSize = (splitNode.parameters.batchSize as number) || 10

  return {
    id: '',
    type: 'split-batch',
    sourceNode: splitNode,
    branches,
    nodeCount: 1 + branches.reduce((sum, b) => sum + b.nodes.length, 0),
    parallelism: batchSize, // Parallelism is based on batch size
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Follow a parallel branch until it merges or ends
 */
function followParallelBranch(
  startNode: N8nNode,
  workflow: N8nWorkflow,
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>,
  parallelNodes: Set<string>
): N8nNode[] {
  const nodes: N8nNode[] = []
  let currentName = startNode.name

  // Get first downstream
  const startAnalyzed = analyzedMap.get(currentName)
  if (!startAnalyzed || startAnalyzed.dependents.length !== 1) {
    return nodes
  }

  currentName = startAnalyzed.dependents[0]

  while (currentName) {
    // Skip if already visited
    if (parallelNodes.has(currentName)) break

    const node = nodeMap.get(currentName)
    const analyzed = analyzedMap.get(currentName)

    if (!node || !analyzed) break

    // Stop at merge points (multiple inputs)
    if (analyzed.dependencies.length > 1) break

    parallelNodes.add(currentName)
    nodes.push(node)

    // Continue if single output
    if (analyzed.dependents.length === 1) {
      currentName = analyzed.dependents[0]
    } else {
      break
    }
  }

  return nodes
}

/**
 * Trace back from a node to find parallel source
 */
function traceBackParallelBranch(
  startNode: N8nNode,
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>,
  parallelNodes: Set<string>
): N8nNode[] {
  const nodes: N8nNode[] = []
  let currentName = startNode.name

  const startAnalyzed = analyzedMap.get(currentName)
  if (!startAnalyzed || startAnalyzed.dependencies.length !== 1) {
    return nodes
  }

  currentName = startAnalyzed.dependencies[0]

  while (currentName) {
    if (parallelNodes.has(currentName)) break

    const node = nodeMap.get(currentName)
    const analyzed = analyzedMap.get(currentName)

    if (!node || !analyzed) break

    // Stop at fan-out points (multiple outputs) - found the source
    if (analyzed.dependents.length > 1) break

    parallelNodes.add(currentName)
    nodes.push(node)

    // Continue tracing back if single input
    if (analyzed.dependencies.length === 1) {
      currentName = analyzed.dependencies[0]
    } else {
      break
    }
  }

  return nodes
}

/**
 * Find merge point for parallel branches
 */
function findParallelMergePoint(
  branches: ParallelBranch[],
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>
): N8nNode | undefined {
  // Get downstream of each branch end
  const downstreamSets: Set<string>[] = branches.map((branch) => {
    const endNode = branch.endNode || branch.nodes[branch.nodes.length - 1]
    if (!endNode) return new Set<string>()

    const analyzed = analyzedMap.get(endNode.name)
    return new Set(analyzed?.dependents || [])
  })

  // Find intersection
  if (downstreamSets.length === 0) return undefined

  let common = downstreamSets[0]
  for (let i = 1; i < downstreamSets.length; i++) {
    const next = new Set<string>()
    for (const name of common) {
      if (downstreamSets[i].has(name)) {
        next.add(name)
      }
    }
    common = next
  }

  // Return first common downstream
  for (const name of common) {
    return nodeMap.get(name)
  }

  return undefined
}

/**
 * Find common source for fan-in branches
 */
function findCommonSource(
  branches: ParallelBranch[],
  analyzedMap: Map<string, AnalyzedNode>,
  nodeMap: Map<string, N8nNode>
): N8nNode | undefined {
  // Get upstream of each branch start
  const upstreamSets: Set<string>[] = branches.map((branch) => {
    const startNode = branch.startNode
    if (!startNode) return new Set<string>()

    const analyzed = analyzedMap.get(startNode.name)
    return new Set(analyzed?.dependencies || [])
  })

  if (upstreamSets.length === 0) return undefined

  let common = upstreamSets[0]
  for (let i = 1; i < upstreamSets.length; i++) {
    const next = new Set<string>()
    for (const name of common) {
      if (upstreamSets[i].has(name)) {
        next.add(name)
      }
    }
    common = next
  }

  for (const name of common) {
    return nodeMap.get(name)
  }

  return undefined
}
