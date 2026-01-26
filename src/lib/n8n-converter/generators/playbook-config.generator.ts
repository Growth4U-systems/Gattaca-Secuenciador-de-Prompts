/**
 * Playbook Config Generator
 *
 * Combines pattern detection and node conversion to produce
 * a complete Gattaca PlaybookConfig from an n8n workflow.
 */

import {
  PlaybookConfig,
  PhaseDefinition,
  StepDefinition,
  StepGuidance,
} from '@/components/playbook/types'
import { N8nWorkflow, N8nNode } from '../types'
import { analyzeFlow, FlowAnalysis, categorizeNodes, CategorizedNode } from '../analyzers'
import { detectLinearChains, detectBranchPatterns, detectLoopPatterns } from '../patterns'
import { getNodeConverter, NodeConversionContext } from '../registry/node-registry'
import { ConvertedStep, ConversionWarning, EnvVariable } from '../types'
import {
  generateStepGuidance,
  generateExecutionExplanation,
  enhanceVariable,
  enhancePhaseInfo,
  generatePlaybookPresentation,
  GuidanceContext,
  PresentationContext,
} from './ux-enhancer'

// ============================================
// Types
// ============================================

export interface PlaybookGenerationOptions {
  /** Generated playbook ID (default: derived from workflow name) */
  playbookId?: string

  /** Playbook type identifier */
  playbookType?: string

  /** Whether to include disabled nodes */
  includeDisabled?: boolean

  /** Whether to generate phases based on workflow structure */
  autoPhases?: boolean

  /** Custom phase grouping strategy */
  phaseStrategy?: 'by-pattern' | 'by-category' | 'linear' | 'custom'

  /** Custom phase definitions (for 'custom' strategy) */
  customPhases?: Array<{
    id: string
    name: string
    nodeNames: string[]
  }>
}

export interface PlaybookGenerationResult {
  /** Success status */
  success: boolean

  /** Generated playbook config */
  config?: PlaybookConfig

  /** All converted steps */
  steps: ConvertedStep[]

  /** Environment variables needed */
  envVariables: EnvVariable[]

  /** Conversion warnings */
  warnings: ConversionWarning[]

  /** Statistics */
  stats: {
    totalNodes: number
    convertedNodes: number
    unsupportedNodes: number
    phasesCreated: number
    stepsCreated: number
  }

  /** Nodes that couldn't be converted */
  unsupportedNodes: Array<{
    name: string
    type: string
    reason: string
  }>
}

// ============================================
// Main Generator
// ============================================

/**
 * Generate a Gattaca PlaybookConfig from an n8n workflow
 */
export function generatePlaybookConfig(
  workflow: N8nWorkflow,
  options: PlaybookGenerationOptions = {}
): PlaybookGenerationResult {
  const startTime = Date.now()

  const {
    playbookId = generatePlaybookId(workflow.name),
    playbookType = 'imported',
    includeDisabled = false,
    autoPhases = true,
    phaseStrategy = 'by-pattern',
  } = options

  // Filter nodes
  const nodes = includeDisabled
    ? workflow.nodes
    : workflow.nodes.filter(n => !n.disabled)

  // Analyze workflow structure
  const flowAnalysis = analyzeFlow(workflow)
  const categorization = categorizeNodes(workflow.nodes)

  // Detect patterns
  const linearChains = detectLinearChains(workflow, flowAnalysis)
  const branchPatterns = detectBranchPatterns(workflow, flowAnalysis)
  const loopPatterns = detectLoopPatterns(workflow, flowAnalysis)

  // Convert all nodes
  const convertedSteps: ConvertedStep[] = []
  const allWarnings: ConversionWarning[] = []
  const allEnvVariables: EnvVariable[] = []
  const unsupportedNodes: PlaybookGenerationResult['unsupportedNodes'] = []

  for (const node of nodes) {
    const analyzed = flowAnalysis.nodes.get(node.name)
    if (!analyzed) {
      unsupportedNodes.push({
        name: node.name,
        type: node.type,
        reason: 'Node not found in flow analysis',
      })
      continue
    }

    const converter = getNodeConverter(node)
    if (!converter) {
      // Create a placeholder step for unsupported nodes
      const placeholderStep = createPlaceholderStep(node, analyzed.dependencies)
      convertedSteps.push(placeholderStep)
      unsupportedNodes.push({
        name: node.name,
        type: node.type,
        reason: 'No converter available for this node type',
      })
      allWarnings.push({
        severity: 'warning',
        message: `No converter for node type: ${node.type}`,
        suggestion: 'Manual implementation required',
        nodeId: node.id,
      })
      continue
    }

    // Convert the node
    const conversionContext: NodeConversionContext = {
      analyzedNode: analyzed,
      playbookId,
      outputDir: '',
      allNodes: nodes,
      allAnalyzedNodes: flowAnalysis.nodes,
      expressionContext: {
        nodeToStepMap: new Map(nodes.map(n => [
          n.name,
          n.name.toLowerCase().replace(/\s+/g, '_'),
        ])),
      },
    }

    const converted = converter.convert(node, conversionContext)

    if (converted) {
      // Enhance step with UX metadata (guidance, execution explanation)
      const enhancedStep = enhanceConvertedStep(
        converted,
        node,
        analyzed.dependencies,
        nodes,
        convertedSteps.length === 0 // isFirstStep
      )
      convertedSteps.push(enhancedStep)
      allWarnings.push(...enhancedStep.warnings)

      // Collect env variables
      if (converted.generatedCode?.envVariables) {
        for (const env of converted.generatedCode.envVariables) {
          if (!allEnvVariables.find(e => e.name === env.name)) {
            allEnvVariables.push(env)
          }
        }
      }
    }
  }

  // Generate phases based on strategy
  const phases = generatePhases(
    convertedSteps,
    flowAnalysis,
    linearChains,
    branchPatterns,
    phaseStrategy,
    options.customPhases
  )

  // Analyze workflow characteristics for presentation
  const workflowCharacteristics = analyzeWorkflowCharacteristics(nodes, convertedSteps)

  // Generate presentation metadata
  const presentationContext: PresentationContext = {
    workflowName: workflow.name || 'Imported Workflow',
    workflowDescription: workflow.meta?.instanceId
      ? `Converted from n8n workflow (${workflow.meta.instanceId})`
      : undefined,
    nodes: nodes.map(n => ({
      type: n.type,
      name: n.name,
      parameters: n.parameters,
    })),
    stepCount: convertedSteps.length,
    ...workflowCharacteristics,
  }

  const presentation = generatePlaybookPresentation(presentationContext)

  // Create the playbook config
  const config: PlaybookConfig = {
    id: playbookId,
    type: playbookType,
    name: workflow.name || 'Imported Workflow',
    description: `Converted from n8n workflow${workflow.meta?.instanceId ? ` (${workflow.meta.instanceId})` : ''}`,
    presentation,
    phases,
    variables: extractPlaybookVariables(workflow, convertedSteps),
  }

  return {
    success: unsupportedNodes.length === 0 || convertedSteps.length > 0,
    config,
    steps: convertedSteps,
    envVariables: allEnvVariables,
    warnings: allWarnings,
    stats: {
      totalNodes: nodes.length,
      convertedNodes: convertedSteps.length - unsupportedNodes.length,
      unsupportedNodes: unsupportedNodes.length,
      phasesCreated: phases.length,
      stepsCreated: convertedSteps.length,
    },
    unsupportedNodes,
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a playbook ID from workflow name
 */
function generatePlaybookId(name?: string): string {
  if (!name) return `playbook_${Date.now()}`
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
}

/**
 * Create a placeholder step for unsupported nodes
 */
function createPlaceholderStep(
  node: N8nNode,
  dependencies: string[]
): ConvertedStep {
  const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

  return {
    step: {
      id: stepId,
      name: node.name,
      description: `[UNSUPPORTED] ${node.type}`,
      type: 'auto',
      executor: 'custom',
      dependsOn: dependencies.map(d => d.toLowerCase().replace(/\s+/g, '_')),
      executionExplanation: {
        title: 'Manual Implementation Required',
        steps: [
          `Original n8n node type: ${node.type}`,
          'This node type is not supported for automatic conversion',
          'Manual implementation required',
        ],
      },
    },
    warnings: [{
      severity: 'warning',
      message: `Unsupported node type: ${node.type}`,
      suggestion: 'Implement custom logic for this step',
      nodeId: node.id,
    }],
    requiresManualImplementation: true,
    sourceNode: {
      id: node.id,
      name: node.name,
      type: node.type,
    },
  }
}

/**
 * Generate phases from converted steps
 */
function generatePhases(
  steps: ConvertedStep[],
  flowAnalysis: FlowAnalysis,
  linearChains: ReturnType<typeof detectLinearChains>,
  branchPatterns: ReturnType<typeof detectBranchPatterns>,
  strategy: PlaybookGenerationOptions['phaseStrategy'],
  customPhases?: PlaybookGenerationOptions['customPhases']
): PhaseDefinition[] {
  const stepMap = new Map(steps.map(s => [s.step.id, s]))

  switch (strategy) {
    case 'custom':
      if (customPhases) {
        return customPhases.map(cp => ({
          id: cp.id,
          name: cp.name,
          steps: cp.nodeNames
            .map(name => stepMap.get(name.toLowerCase().replace(/\s+/g, '_')))
            .filter(Boolean)
            .map(s => s!.step),
        }))
      }
      return generateLinearPhases(steps)

    case 'by-category':
      return generateCategoryPhases(steps)

    case 'linear':
      return generateLinearPhases(steps)

    case 'by-pattern':
    default:
      return generatePatternBasedPhases(
        steps,
        flowAnalysis,
        linearChains,
        branchPatterns
      )
  }
}

/**
 * Generate phases based on detected patterns with enhanced UX
 */
function generatePatternBasedPhases(
  steps: ConvertedStep[],
  flowAnalysis: FlowAnalysis,
  linearChains: ReturnType<typeof detectLinearChains>,
  branchPatterns: ReturnType<typeof detectBranchPatterns>
): PhaseDefinition[] {
  const phases: PhaseDefinition[] = []
  const assignedSteps = new Set<string>()

  // Phase 1: Input/Trigger phase
  const inputSteps = steps.filter(s =>
    s.step.type === 'input' ||
    s.sourceNode.type.toLowerCase().includes('trigger')
  )

  if (inputSteps.length > 0) {
    const phaseInfo = enhancePhaseInfo('input', inputSteps.map(s => ({
      name: s.step.name,
      type: s.step.type,
      executorType: s.step.executor,
    })))
    phases.push({
      id: 'input',
      name: phaseInfo.name,
      description: phaseInfo.description,
      steps: inputSteps.map(s => s.step),
    })
    inputSteps.forEach(s => assignedSteps.add(s.step.id))
  }

  // Phase 2: Processing phase (linear chains)
  const processingSteps: StepDefinition[] = []
  for (const chain of linearChains.chains) {
    for (const nodeName of chain.nodeNames) {
      const stepId = nodeName.toLowerCase().replace(/\s+/g, '_')
      const step = steps.find(s => s.step.id === stepId)
      if (step && !assignedSteps.has(stepId)) {
        processingSteps.push(step.step)
        assignedSteps.add(stepId)
      }
    }
  }

  if (processingSteps.length > 0) {
    const phaseInfo = enhancePhaseInfo('processing', processingSteps.map(s => ({
      name: s.name,
      type: s.type,
      executorType: s.executor,
    })))
    phases.push({
      id: 'processing',
      name: phaseInfo.name,
      description: phaseInfo.description,
      steps: processingSteps,
    })
  }

  // Phase 3: Decision phase (branch patterns)
  const decisionSteps: StepDefinition[] = []
  for (const pattern of branchPatterns.patterns) {
    const stepId = pattern.branchNode.name.toLowerCase().replace(/\s+/g, '_')
    const step = steps.find(s => s.step.id === stepId)
    if (step && !assignedSteps.has(stepId)) {
      decisionSteps.push(step.step)
      assignedSteps.add(stepId)

      // Add branch path steps
      for (const branch of pattern.branches) {
        for (const nodeName of branch.nodeNames) {
          const branchStepId = nodeName.toLowerCase().replace(/\s+/g, '_')
          const branchStep = steps.find(s => s.step.id === branchStepId)
          if (branchStep && !assignedSteps.has(branchStepId)) {
            decisionSteps.push(branchStep.step)
            assignedSteps.add(branchStepId)
          }
        }
      }
    }
  }

  if (decisionSteps.length > 0) {
    const phaseInfo = enhancePhaseInfo('decisions', decisionSteps.map(s => ({
      name: s.name,
      type: s.type,
      executorType: s.executor,
    })))
    phases.push({
      id: 'decisions',
      name: phaseInfo.name,
      description: phaseInfo.description,
      steps: decisionSteps,
    })
  }

  // Phase 4: Remaining steps (output/finalization)
  const remainingSteps = steps
    .filter(s => !assignedSteps.has(s.step.id))
    .map(s => s.step)

  if (remainingSteps.length > 0) {
    const phaseInfo = enhancePhaseInfo('output', remainingSteps.map(s => ({
      name: s.name,
      type: s.type,
      executorType: s.executor,
    })))
    phases.push({
      id: 'output',
      name: phaseInfo.name,
      description: phaseInfo.description,
      steps: remainingSteps,
    })
  }

  return phases
}

/**
 * Generate phases based on node categories with enhanced UX
 */
function generateCategoryPhases(steps: ConvertedStep[]): PhaseDefinition[] {
  const categories = {
    trigger: [] as StepDefinition[],
    ai: [] as StepDefinition[],
    transform: [] as StepDefinition[],
    logic: [] as StepDefinition[],
    api: [] as StepDefinition[],
    other: [] as StepDefinition[],
  }

  for (const step of steps) {
    const type = step.sourceNode.type.toLowerCase()

    if (type.includes('trigger')) {
      categories.trigger.push(step.step)
    } else if (type.includes('openai') || type.includes('anthropic') || type.includes('llm')) {
      categories.ai.push(step.step)
    } else if (type.includes('set') || type.includes('code') || type.includes('merge')) {
      categories.transform.push(step.step)
    } else if (type.includes('if') || type.includes('switch')) {
      categories.logic.push(step.step)
    } else if (type.includes('http') || type.includes('request')) {
      categories.api.push(step.step)
    } else {
      categories.other.push(step.step)
    }
  }

  const phases: PhaseDefinition[] = []

  if (categories.trigger.length > 0) {
    const phaseInfo = enhancePhaseInfo('trigger', categories.trigger.map(s => ({
      name: s.name, type: s.type, executorType: s.executor,
    })))
    phases.push({
      id: 'trigger',
      name: phaseInfo.name,
      description: phaseInfo.description,
      steps: categories.trigger,
    })
  }
  if (categories.ai.length > 0) {
    const phaseInfo = enhancePhaseInfo('generate', categories.ai.map(s => ({
      name: s.name, type: s.type, executorType: s.executor,
    })))
    phases.push({
      id: 'ai-processing',
      name: phaseInfo.name,
      description: phaseInfo.description,
      steps: categories.ai,
    })
  }
  if (categories.transform.length > 0) {
    const phaseInfo = enhancePhaseInfo('processing', categories.transform.map(s => ({
      name: s.name, type: s.type, executorType: s.executor,
    })))
    phases.push({
      id: 'transform',
      name: phaseInfo.name,
      description: phaseInfo.description,
      steps: categories.transform,
    })
  }
  if (categories.logic.length > 0) {
    const phaseInfo = enhancePhaseInfo('decision', categories.logic.map(s => ({
      name: s.name, type: s.type, executorType: s.executor,
    })))
    phases.push({
      id: 'logic',
      name: phaseInfo.name,
      description: phaseInfo.description,
      steps: categories.logic,
    })
  }
  if (categories.api.length > 0) {
    phases.push({
      id: 'api-calls',
      name: 'Obtención de Datos',
      description: 'Conexión con servicios externos para obtener o enviar información',
      steps: categories.api,
    })
  }
  if (categories.other.length > 0) {
    const phaseInfo = enhancePhaseInfo('output', categories.other.map(s => ({
      name: s.name, type: s.type, executorType: s.executor,
    })))
    phases.push({
      id: 'other',
      name: phaseInfo.name,
      description: phaseInfo.description,
      steps: categories.other,
    })
  }

  return phases
}

/**
 * Generate a single linear phase with all steps
 */
function generateLinearPhases(steps: ConvertedStep[]): PhaseDefinition[] {
  return [{
    id: 'main',
    name: 'Main',
    description: 'All workflow steps',
    steps: steps.map(s => s.step),
  }]
}

/**
 * Enhance a converted step with UX metadata (guidance, execution explanation)
 */
function enhanceConvertedStep(
  converted: ConvertedStep,
  node: N8nNode,
  dependencies: string[],
  allNodes: N8nNode[],
  isFirstStep: boolean
): ConvertedStep {
  const isLastStep = dependencies.length === 0 && allNodes.indexOf(node) === allNodes.length - 1

  // Generate guidance if not already present
  if (!converted.step.guidance) {
    const guidanceContext: GuidanceContext = {
      nodeType: node.type,
      nodeName: node.name,
      stepType: converted.step.type,
      executorType: converted.step.executor,
      parameters: node.parameters || {},
      dependencies: dependencies,
      isFirstStep,
      isLastStep,
    }
    converted.step.guidance = generateStepGuidance(guidanceContext)
  }

  // Enhance execution explanation if not present or minimal
  if (!converted.step.executionExplanation || converted.step.executionExplanation.steps.length < 3) {
    const explanation = generateExecutionExplanation(
      node.type,
      node.name,
      node.parameters || {}
    )
    converted.step.executionExplanation = {
      ...converted.step.executionExplanation,
      ...explanation,
    }
  }

  return converted
}

/**
 * Extract playbook variables from workflow with enhanced UX metadata
 */
function extractPlaybookVariables(
  workflow: N8nWorkflow,
  steps: ConvertedStep[]
): PlaybookConfig['variables'] {
  const variables: PlaybookConfig['variables'] = []
  const addedKeys = new Set<string>()

  // Look for webhook/trigger parameters that might need user input
  for (const step of steps) {
    if (step.step.type === 'input') {
      const key = `${step.step.id}_input`
      if (!addedKeys.has(key)) {
        const enhanced = enhanceVariable(key, `Input for ${step.step.name}`, 'textarea', {
          nodeType: step.sourceNode.type,
          nodeName: step.sourceNode.name,
          isInput: true,
        })

        variables.push({
          key: enhanced.key,
          label: enhanced.label,
          type: enhanced.type,
          required: enhanced.required,
          defaultValue: enhanced.defaultValue,
          description: enhanced.description || `Initial input data for ${step.step.name}`,
          placeholder: enhanced.placeholder || 'Enter your input here...',
        })
        addedKeys.add(key)
      }
    }
  }

  // Look for AI nodes that might have configurable prompts
  for (const step of steps) {
    const type = step.sourceNode.type.toLowerCase()
    if (type.includes('openai') || type.includes('anthropic') || type.includes('llm')) {
      // Add tone variable for AI steps
      if (!addedKeys.has('tone')) {
        const toneVar = enhanceVariable('tone', 'Tone', 'select', {
          nodeType: step.sourceNode.type,
          isAI: true,
        })
        variables.push({
          key: toneVar.key,
          label: toneVar.label,
          type: toneVar.type,
          required: false,
          defaultValue: toneVar.defaultValue || 'professional',
          description: toneVar.description || 'The tone of the generated content',
          options: toneVar.options || [
            { value: 'professional', label: 'Professional' },
            { value: 'conversational', label: 'Conversational' },
            { value: 'casual', label: 'Casual' },
            { value: 'formal', label: 'Formal' },
          ],
        })
        addedKeys.add('tone')
      }

      // Add target audience variable
      if (!addedKeys.has('targetAudience')) {
        const audienceVar = enhanceVariable('targetAudience', 'Target Audience', 'text', {
          nodeType: step.sourceNode.type,
          isAI: true,
        })
        variables.push({
          key: audienceVar.key,
          label: audienceVar.label,
          type: 'text',
          required: false,
          description: audienceVar.description || 'Who is this content for?',
          placeholder: audienceVar.placeholder || 'e.g., Marketing professionals, Startup founders',
        })
        addedKeys.add('targetAudience')
      }
    }
  }

  // Look for HTTP nodes that might need topic/subject input
  for (const step of steps) {
    const type = step.sourceNode.type.toLowerCase()
    if (type.includes('http') && !addedKeys.has('topic')) {
      const topicVar = enhanceVariable('topic', 'Topic', 'text', {
        nodeType: step.sourceNode.type,
        nodeName: step.sourceNode.name,
      })
      variables.push({
        key: topicVar.key,
        label: topicVar.label,
        type: 'text',
        required: true,
        description: topicVar.description || 'The main topic for this workflow',
        placeholder: topicVar.placeholder || 'e.g., AI in Marketing, Remote Work',
      })
      addedKeys.add('topic')
    }
  }

  return variables.length > 0 ? variables : undefined
}

/**
 * Analyze workflow characteristics for presentation generation
 */
function analyzeWorkflowCharacteristics(
  nodes: N8nNode[],
  steps: ConvertedStep[]
): {
  hasAI: boolean
  hasImageGeneration: boolean
  hasWebScraping: boolean
  hasDataExtraction: boolean
} {
  let hasAI = false
  let hasImageGeneration = false
  let hasWebScraping = false
  let hasDataExtraction = false

  for (const node of nodes) {
    const typeLower = node.type.toLowerCase()
    const nameLower = node.name.toLowerCase()

    // Check for AI
    if (typeLower.includes('openai') ||
        typeLower.includes('anthropic') ||
        typeLower.includes('llm') ||
        typeLower.includes('chat') ||
        nameLower.includes('gpt') ||
        nameLower.includes('claude')) {
      hasAI = true
    }

    // Check for image generation
    if (typeLower.includes('flux') ||
        typeLower.includes('dall') ||
        typeLower.includes('image') ||
        nameLower.includes('image') ||
        nameLower.includes('flux') ||
        nameLower.includes('generate image')) {
      hasImageGeneration = true
    }

    // Check for web scraping
    if (typeLower.includes('scrape') ||
        typeLower.includes('dumpling') ||
        nameLower.includes('scrape') ||
        nameLower.includes('extract') ||
        nameLower.includes('crawl') ||
        (typeLower.includes('http') && (nameLower.includes('article') || nameLower.includes('content')))) {
      hasWebScraping = true
    }

    // Check for data extraction
    if (typeLower.includes('extract') ||
        typeLower.includes('parse') ||
        nameLower.includes('extract') ||
        nameLower.includes('data') ||
        nameLower.includes('csv') ||
        nameLower.includes('json')) {
      hasDataExtraction = true
    }
  }

  // Also check step executor types
  for (const step of steps) {
    if (step.step.executor === 'llm') {
      hasAI = true
    }
  }

  return { hasAI, hasImageGeneration, hasWebScraping, hasDataExtraction }
}
