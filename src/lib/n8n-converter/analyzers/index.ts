/**
 * n8n Flow Analyzers
 */

export {
  analyzeFlow,
  getDependentNodes,
  getUpstreamNodes,
  type AnalyzedNode,
  type FlowPattern,
  type BranchInfo,
  type FlowAnalysis,
  type PhaseGrouping,
} from './flow-analyzer'

export {
  categorizeNode,
  categorizeNodes,
  getCategoryForNodeType,
  isNodeTypeSupported,
  getConversionHints,
  type NodeCategory,
  type CategorizedNode,
  type CategorizationResult,
} from './node-categorizer'
