/**
 * n8n Pattern Detectors
 *
 * Detect workflow patterns (linear chains, branches, loops, etc.)
 * to map to appropriate Gattaca structures.
 */

export {
  detectLinearChains,
  isLinearSequence,
  groupTransformNodes,
  type LinearChain,
  type LinearChainDetectionResult,
} from './linear-chain.detector'

export {
  detectBranchPatterns,
  detectIfPattern,
  detectSwitchPattern,
  type BranchPattern,
  type IfBranchPattern,
  type SwitchBranchPattern,
  type BranchDetectionResult,
} from './branch.detector'

export {
  detectParallelPatterns,
  detectFanOutPattern,
  detectFanInPattern,
  detectSplitBatchPattern,
  type ParallelPattern,
  type ParallelBranch,
  type ParallelDetectionResult,
} from './parallel.detector'

export {
  detectLoopPatterns,
  type LoopPattern,
  type LoopDetectionResult,
} from './loop.detector'
