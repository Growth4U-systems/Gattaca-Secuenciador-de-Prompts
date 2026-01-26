/**
 * n8n to Gattaca Playbook Converter
 *
 * Main entry point for converting n8n workflows to Gattaca playbooks.
 *
 * @example
 * ```typescript
 * import { convertN8nWorkflow } from '@/lib/n8n-converter'
 *
 * const result = await convertN8nWorkflow(n8nJson, {
 *   playbookId: 'my-playbook',
 *   outputDir: './src/playbooks/my-playbook',
 * })
 *
 * if (result.success) {
 *   console.log('Generated files:', result.generatedFiles.map(f => f.path))
 * } else {
 *   console.log('Warnings:', result.warnings)
 * }
 * ```
 */

// Types
export * from './types'

// Parser
export { parseN8nWorkflow, validateN8nWorkflow, N8nParseError } from './parser'

// Analyzers
export {
  analyzeFlow,
  getDependentNodes,
  getUpstreamNodes,
  categorizeNode,
  categorizeNodes,
  getCategoryForNodeType,
  getConversionHints,
  type AnalyzedNode,
  type FlowAnalysis,
  type FlowPattern,
  type BranchInfo,
  type PhaseGrouping,
  type NodeCategory,
  type CategorizedNode,
  type CategorizationResult,
} from './analyzers'

// Pattern Detectors
export {
  detectLinearChains,
  isLinearSequence,
  groupTransformNodes,
  detectBranchPatterns,
  detectIfPattern,
  detectSwitchPattern,
  detectParallelPatterns,
  detectFanOutPattern,
  detectFanInPattern,
  detectSplitBatchPattern,
  detectLoopPatterns,
  type LinearChain,
  type LinearChainDetectionResult,
  type BranchPattern,
  type IfBranchPattern,
  type SwitchBranchPattern,
  type BranchDetectionResult,
  type ParallelPattern,
  type ParallelBranch,
  type ParallelDetectionResult,
  type LoopPattern,
  type LoopDetectionResult,
} from './patterns'

// Registry
export {
  nodeRegistry,
  registerNodeConverter,
  getNodeConverter,
  isNodeTypeSupported,
  listSupportedNodeTypes,
  type NodeConverter,
  type NodeConversionContext,
} from './registry'

// Converters (importing registers them)
export {
  convertExpression,
  containsExpression,
  type ExpressionContext,
} from './converters'

// Import converters to register them
import './converters'

// Generators
export {
  generatePlaybookConfig,
  generateApiRoutes,
  generateConversionReport,
  type PlaybookGenerationOptions,
  type PlaybookGenerationResult,
  type ApiRouteGenerationOptions,
  type ApiRouteGenerationResult,
  type ReportGenerationOptions,
  type ConversionReport,
} from './generators'

// ============================================
// Main Conversion Function
// ============================================

import { parseN8nWorkflow } from './parser'
import { analyzeFlow } from './analyzers'
import { getNodeConverter, NodeConversionContext } from './registry'
import { ExpressionContext } from './converters'
import {
  N8nWorkflow,
  ConversionResult,
  ConvertedPhase,
  ConvertedStep,
  GeneratedFile,
  ConversionWarning,
  EnvVariable,
} from './types'
import { PlaybookConfig, PhaseDefinition, StepDefinition } from '@/components/playbook/types'

/**
 * Conversion options
 */
export interface ConversionOptions {
  /** Unique ID for the generated playbook */
  playbookId: string

  /** Output directory for generated files */
  outputDir: string

  /** Project ID (optional) */
  projectId?: string

  /** Skip unsupported nodes instead of creating placeholders */
  skipUnsupported?: boolean

  /** Validate only, don't generate files */
  validateOnly?: boolean
}

/**
 * Convert n8n workflow JSON to Gattaca playbook
 */
export async function convertN8nWorkflow(
  json: string,
  options: ConversionOptions
): Promise<ConversionResult> {
  const startTime = Date.now()
  const warnings: ConversionWarning[] = []
  const generatedFiles: GeneratedFile[] = []
  const allEnvVariables: EnvVariable[] = []

  // Parse workflow
  let workflow: N8nWorkflow
  try {
    workflow = parseN8nWorkflow(json)
  } catch (error) {
    return {
      success: false,
      phases: [],
      generatedFiles: [],
      warnings: [
        {
          severity: 'error',
          message: error instanceof Error ? error.message : 'Failed to parse workflow',
        },
      ],
      stats: {
        totalNodes: 0,
        convertedNodes: 0,
        partialNodes: 0,
        unsupportedNodes: 0,
        phasesGenerated: 0,
        stepsGenerated: 0,
        apiRoutesGenerated: 0,
        conversionTimeMs: Date.now() - startTime,
      },
      envVariables: [],
      manualSteps: [],
    }
  }

  // Analyze flow
  const analysis = analyzeFlow(workflow)
  warnings.push(
    ...analysis.warnings.map(w => ({ severity: 'warning' as const, message: w }))
  )

  // Build node name to step ID map
  const nodeToStepMap = new Map<string, string>()
  for (const node of workflow.nodes) {
    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')
    nodeToStepMap.set(node.name, stepId)
  }

  // Build expression context
  const expressionContext: ExpressionContext = {
    nodeToStepMap,
    contextName: 'context',
    stateName: 'state',
  }

  // Convert each node
  const convertedSteps: ConvertedStep[] = []
  let convertedCount = 0
  let partialCount = 0
  let unsupportedCount = 0

  for (const nodeName of analysis.executionOrder) {
    const analyzedNode = analysis.nodes.get(nodeName)!
    const node = analyzedNode.node

    // Get converter
    const converter = getNodeConverter(node)

    if (!converter) {
      unsupportedCount++
      if (options.skipUnsupported) {
        warnings.push({
          severity: 'warning',
          message: `Skipped unsupported node: ${node.type}`,
          nodeId: node.id,
        })
        continue
      }
    }

    // Build conversion context
    const conversionContext: NodeConversionContext = {
      expressionContext,
      analyzedNode,
      playbookId: options.playbookId,
      projectId: options.projectId,
      outputDir: options.outputDir,
      allNodes: workflow.nodes,
      allAnalyzedNodes: analysis.nodes,
    }

    // Convert node
    const converted = converter!.convert(node, conversionContext)
    convertedSteps.push(converted)

    // Track stats
    if (converted.requiresManualImplementation) {
      partialCount++
    } else if (converted.warnings.length === 0) {
      convertedCount++
    } else {
      partialCount++
    }

    // Collect warnings
    warnings.push(...converted.warnings)

    // Generate code if not validate-only
    if (!options.validateOnly && converter!.generateCode) {
      const code = converter!.generateCode(node, conversionContext)
      if (code) {
        if (code.apiRoute) {
          generatedFiles.push({
            path: code.apiRoute.path,
            content: code.apiRoute.content,
            type: 'api-route',
            description: `API route for ${node.name}`,
          })
        }
        if (code.utilities) {
          for (const util of code.utilities) {
            generatedFiles.push({
              path: util.path,
              content: util.content,
              type: 'utility',
              description: `Utility for ${node.name}`,
            })
          }
        }
        if (code.types) {
          generatedFiles.push({
            path: code.types.path,
            content: code.types.content,
            type: 'types',
            description: `Types for ${node.name}`,
          })
        }
        if (code.envVariables) {
          allEnvVariables.push(...code.envVariables)
        }
      }
    }
  }

  // Group into phases based on analysis
  const phases: ConvertedPhase[] = []

  for (const suggestedPhase of analysis.suggestedPhases) {
    const phaseSteps = suggestedPhase.nodeNames
      .map(name => convertedSteps.find(s => s.sourceNode.name === name))
      .filter((s): s is ConvertedStep => s !== undefined)

    if (phaseSteps.length === 0) continue

    const phaseId = suggestedPhase.name.toLowerCase().replace(/\s+/g, '_')

    phases.push({
      phase: {
        id: phaseId,
        name: suggestedPhase.name,
        description: suggestedPhase.reason,
        steps: phaseSteps.map(s => s.step),
      },
      steps: phaseSteps,
    })
  }

  // Generate playbook config
  const playbookConfig: PlaybookConfig = {
    id: options.playbookId,
    type: options.playbookId,
    name: workflow.name,
    description: `Converted from n8n workflow: ${workflow.name}`,
    icon: '🔄',
    phases: phases.map(p => p.phase),
    variables: [],
  }

  // Generate config file
  if (!options.validateOnly) {
    const configContent = generatePlaybookConfigFile(playbookConfig, workflow)
    generatedFiles.push({
      path: `${options.outputDir}/config.ts`,
      content: configContent,
      type: 'config',
      description: 'Playbook configuration',
    })

    // Generate .env.example
    if (allEnvVariables.length > 0) {
      const envContent = generateEnvExample(allEnvVariables)
      generatedFiles.push({
        path: `${options.outputDir}/.env.example`,
        content: envContent,
        type: 'env-example',
        description: 'Environment variables template',
      })
    }
  }

  // Identify manual steps needed
  const manualSteps = convertedSteps
    .filter(s => s.requiresManualImplementation)
    .map(s => `${s.step.name}: ${s.warnings[0]?.message || 'Manual implementation required'}`)

  return {
    success: unsupportedCount === 0 || options.skipUnsupported === true,
    playbookConfig,
    phases,
    generatedFiles,
    warnings,
    stats: {
      totalNodes: workflow.nodes.length,
      convertedNodes: convertedCount,
      partialNodes: partialCount,
      unsupportedNodes: unsupportedCount,
      phasesGenerated: phases.length,
      stepsGenerated: convertedSteps.length,
      apiRoutesGenerated: generatedFiles.filter(f => f.type === 'api-route').length,
      conversionTimeMs: Date.now() - startTime,
    },
    envVariables: allEnvVariables,
    manualSteps,
  }
}

/**
 * Generate playbook config TypeScript file
 */
function generatePlaybookConfigFile(
  config: PlaybookConfig,
  workflow: N8nWorkflow
): string {
  return `/**
 * ${config.name}
 *
 * Auto-generated from n8n workflow: ${workflow.name}
 * Generated at: ${new Date().toISOString()}
 *
 * DO NOT EDIT - Regenerate using the n8n converter if source workflow changes.
 */

import { PlaybookConfig } from '@/components/playbook/types'

export const ${config.id.replace(/-/g, '_')}Config: PlaybookConfig = ${JSON.stringify(config, null, 2)}

export default ${config.id.replace(/-/g, '_')}Config
`
}

/**
 * Generate .env.example file
 */
function generateEnvExample(envVariables: EnvVariable[]): string {
  const lines = [
    '# Environment variables for converted n8n workflow',
    '# Copy this file to .env.local and fill in the values',
    '',
  ]

  for (const env of envVariables) {
    lines.push(`# ${env.description}`)
    if (env.sourceCredentialType) {
      lines.push(`# Source: n8n ${env.sourceCredentialType} credential`)
    }
    lines.push(`${env.name}=${env.example || ''}`)
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Validate n8n workflow for conversion
 * Quick check without full conversion
 */
export async function validateForConversion(json: string): Promise<{
  valid: boolean
  nodeCount: number
  supportedCount: number
  unsupportedNodes: string[]
  warnings: string[]
}> {
  try {
    const workflow = parseN8nWorkflow(json)
    const analysis = analyzeFlow(workflow)

    const unsupportedNodes: string[] = []

    for (const node of workflow.nodes) {
      if (!getNodeConverter(node)) {
        unsupportedNodes.push(`${node.name} (${node.type})`)
      }
    }

    return {
      valid: unsupportedNodes.length === 0,
      nodeCount: workflow.nodes.length,
      supportedCount: workflow.nodes.length - unsupportedNodes.length,
      unsupportedNodes,
      warnings: analysis.warnings,
    }
  } catch (error) {
    return {
      valid: false,
      nodeCount: 0,
      supportedCount: 0,
      unsupportedNodes: [],
      warnings: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}
