/**
 * API Routes Generator
 *
 * Generates Next.js API routes from converted n8n nodes.
 * Each step gets its own API route for execution.
 */

import { N8nWorkflow, N8nNode } from '../types'
import { ConvertedStep, GeneratedCode, EnvVariable, GeneratedFile } from '../types'
import { analyzeFlow } from '../analyzers'
import { getNodeConverter, NodeConversionContext } from '../registry/node-registry'

// ============================================
// Types
// ============================================

export interface ApiRouteGenerationOptions {
  /** Base path for API routes (default: 'src/app/api/playbook') */
  basePath?: string

  /** Playbook ID for route organization */
  playbookId: string

  /** Whether to generate shared utilities */
  generateUtilities?: boolean

  /** Whether to generate types file */
  generateTypes?: boolean

  /** Whether to generate env example file */
  generateEnvExample?: boolean
}

export interface ApiRouteGenerationResult {
  /** Success status */
  success: boolean

  /** Generated files */
  files: GeneratedFile[]

  /** All required environment variables */
  envVariables: EnvVariable[]

  /** Warnings/notes */
  warnings: string[]

  /** Statistics */
  stats: {
    routesGenerated: number
    utilitiesGenerated: number
    totalFiles: number
  }
}

// ============================================
// Main Generator
// ============================================

/**
 * Generate API routes for all converted steps
 */
export function generateApiRoutes(
  workflow: N8nWorkflow,
  convertedSteps: ConvertedStep[],
  options: ApiRouteGenerationOptions
): ApiRouteGenerationResult {
  const {
    basePath = 'src/app/api/playbook',
    playbookId,
    generateUtilities = true,
    generateTypes = true,
    generateEnvExample = true,
  } = options

  const files: GeneratedFile[] = []
  const allEnvVariables: EnvVariable[] = []
  const warnings: string[] = []

  // Analyze workflow for code generation context
  const flowAnalysis = analyzeFlow(workflow)
  const nodeMap = new Map<string, N8nNode>(workflow.nodes.map(n => [n.name, n]))

  // Generate route for each step
  for (const step of convertedSteps) {
    const node = nodeMap.get(step.sourceNode.name)
    if (!node) continue

    const analyzed = flowAnalysis.nodes.get(node.name)
    if (!analyzed) continue

    const converter = getNodeConverter(node)
    if (!converter) {
      warnings.push(`No converter for ${node.name} (${node.type}) - skipping code generation`)
      continue
    }

    // Generate code for this node
    const conversionContext: NodeConversionContext = {
      analyzedNode: analyzed,
      playbookId,
      outputDir: basePath,
      allNodes: workflow.nodes,
      allAnalyzedNodes: flowAnalysis.nodes,
      expressionContext: {
        nodeToStepMap: new Map(workflow.nodes.map(n => [
          n.name,
          n.name.toLowerCase().replace(/\s+/g, '_'),
        ])),
      },
    }

    const code = converter.generateCode?.(node, conversionContext)

    if (code?.apiRoute) {
      files.push({
        path: code.apiRoute.path,
        content: code.apiRoute.content,
        type: 'api-route',
        description: `API route for step: ${step.step.name}`,
      })
    }

    // Collect env variables
    if (code?.envVariables) {
      for (const env of code.envVariables) {
        if (!allEnvVariables.find(e => e.name === env.name)) {
          allEnvVariables.push(env)
        }
      }
    }

    // Collect utility files
    if (code?.utilities) {
      for (const util of code.utilities) {
        if (!files.find(f => f.path === util.path)) {
          files.push({
            path: util.path,
            content: util.content,
            type: 'utility',
            description: `Utility for ${step.step.name}`,
          })
        }
      }
    }
  }

  // Generate shared utilities
  if (generateUtilities) {
    const utilityFiles = generateSharedUtilities(basePath, playbookId)
    files.push(...utilityFiles)
  }

  // Generate types file
  if (generateTypes) {
    const typesFile = generateTypesFile(basePath, playbookId, convertedSteps)
    files.push(typesFile)
  }

  // Generate env example
  if (generateEnvExample && allEnvVariables.length > 0) {
    const envFile = generateEnvExampleFile(allEnvVariables)
    files.push(envFile)
  }

  // Generate index route for the playbook
  const indexRoute = generatePlaybookIndexRoute(basePath, playbookId, convertedSteps)
  files.push(indexRoute)

  return {
    success: files.length > 0,
    files,
    envVariables: allEnvVariables,
    warnings,
    stats: {
      routesGenerated: files.filter(f => f.type === 'api-route').length,
      utilitiesGenerated: files.filter(f => f.type === 'utility').length,
      totalFiles: files.length,
    },
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate shared utility files
 */
function generateSharedUtilities(
  basePath: string,
  playbookId: string
): GeneratedFile[] {
  const files: GeneratedFile[] = []

  // Expression resolver utility
  files.push({
    path: `${basePath}/${playbookId}/_utils/expression-resolver.ts`,
    content: `/**
 * Expression Resolver
 * Resolves dynamic expressions in step inputs
 */

export interface StepContext {
  input?: Record<string, unknown>
  steps?: Record<string, { output?: unknown }>
}

/**
 * Resolve a dynamic expression against step context
 * Supports patterns like:
 * - {{$json.field}} - current input field
 * - {{$node["Name"].json.field}} - output from another step
 * - {{$env.VAR}} - environment variable
 */
export function resolveExpression(
  expression: string,
  context: StepContext
): unknown {
  if (!expression || typeof expression !== 'string') {
    return expression
  }

  // Check if it's an expression
  if (!expression.includes('{{')) {
    return expression
  }

  // Replace all expressions
  return expression.replace(/\\{\\{\\s*(.+?)\\s*\\}\\}/g, (_, expr) => {
    try {
      // $json.field pattern
      if (expr.startsWith('$json.')) {
        const field = expr.replace('$json.', '')
        return String(getNestedValue(context.input, field) ?? '')
      }

      // $node["Name"].json.field pattern
      const nodeMatch = expr.match(/\\$node\\["([^"]+)"\\]\\.json\\.(.+)/)
      if (nodeMatch) {
        const [, nodeName, field] = nodeMatch
        const stepId = nodeName.toLowerCase().replace(/\\s+/g, '_')
        const stepOutput = context.steps?.[stepId]?.output
        return String(getNestedValue(stepOutput, field) ?? '')
      }

      // $env.VAR pattern
      if (expr.startsWith('$env.')) {
        const varName = expr.replace('$env.', '')
        return process.env[varName] ?? ''
      }

      return ''
    } catch {
      return ''
    }
  })
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined

  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Resolve all expressions in an object
 */
export function resolveAllExpressions(
  data: Record<string, unknown>,
  context: StepContext
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      result[key] = resolveExpression(value, context)
    } else if (typeof value === 'object' && value !== null) {
      result[key] = resolveAllExpressions(
        value as Record<string, unknown>,
        context
      )
    } else {
      result[key] = value
    }
  }

  return result
}
`,
    type: 'utility',
    description: 'Expression resolver for dynamic values',
  })

  // Auth utility
  files.push({
    path: `${basePath}/${playbookId}/_utils/auth.ts`,
    content: `/**
 * Auth Utilities
 * Shared authentication helpers for playbook routes
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Verify user authentication
 * Returns user if authenticated, null otherwise
 */
export async function verifyAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 401 }
  )
}

/**
 * Create error response
 */
export function errorResponse(message: string, status = 500) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  )
}

/**
 * Create success response
 */
export function successResponse<T>(data: T, metadata?: Record<string, unknown>) {
  return NextResponse.json({
    success: true,
    data,
    ...(metadata ? { metadata } : {}),
  })
}
`,
    type: 'utility',
    description: 'Authentication utilities',
  })

  return files
}

/**
 * Generate types file
 */
function generateTypesFile(
  basePath: string,
  playbookId: string,
  steps: ConvertedStep[]
): GeneratedFile {
  const stepTypes = steps.map(s => `
  /** ${s.step.name} */
  '${s.step.id}': {
    input: Record<string, unknown>
    output: unknown
  }`).join('\n')

  return {
    path: `${basePath}/${playbookId}/_types/index.ts`,
    content: `/**
 * Type Definitions for ${playbookId} Playbook
 * Auto-generated from n8n workflow
 */

/**
 * Step request body
 */
export interface StepRequestBody {
  sessionId: string
  stepId: string
  input?: Record<string, unknown>
  context?: Record<string, unknown>
}

/**
 * Step response
 */
export interface StepResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  metadata?: Record<string, unknown>
}

/**
 * Step input/output types
 */
export interface StepTypes {
${stepTypes}
}

/**
 * Get step input type
 */
export type StepInput<K extends keyof StepTypes> = StepTypes[K]['input']

/**
 * Get step output type
 */
export type StepOutput<K extends keyof StepTypes> = StepTypes[K]['output']
`,
    type: 'types',
    description: 'TypeScript types for playbook steps',
  }
}

/**
 * Generate env example file
 */
function generateEnvExampleFile(envVariables: EnvVariable[]): GeneratedFile {
  const lines = envVariables.map(env => {
    const comment = `# ${env.description}${env.required ? ' (required)' : ' (optional)'}`
    const value = env.example || 'your-value-here'
    return `${comment}\n${env.name}=${value}`
  })

  return {
    path: '.env.example',
    content: `# Environment Variables for Converted n8n Workflow
# Copy this file to .env.local and fill in your values

${lines.join('\n\n')}
`,
    type: 'env-example',
    description: 'Example environment variables file',
  }
}

/**
 * Generate playbook index route
 */
function generatePlaybookIndexRoute(
  basePath: string,
  playbookId: string,
  steps: ConvertedStep[]
): GeneratedFile {
  const stepList = steps.map(s => `  '${s.step.id}'`).join(',\n')

  return {
    path: `${basePath}/${playbookId}/route.ts`,
    content: `/**
 * Playbook Index Route: ${playbookId}
 * Provides metadata about available steps
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, unauthorizedResponse } from './_utils/auth'

const STEPS = [
${stepList}
] as const

export async function GET(request: NextRequest) {
  const user = await verifyAuth()
  if (!user) return unauthorizedResponse()

  return NextResponse.json({
    success: true,
    data: {
      playbookId: '${playbookId}',
      steps: STEPS,
      totalSteps: STEPS.length,
    },
  })
}
`,
    type: 'api-route',
    description: 'Playbook index route',
  }
}
