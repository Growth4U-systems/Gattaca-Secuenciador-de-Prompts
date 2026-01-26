/**
 * Unsupported Node Converter
 *
 * Handles n8n nodes that don't have specific converters.
 * Generates helpful placeholder code and migration instructions.
 */

import { N8nNode, ConvertedStep, GeneratedCode, ConversionWarning } from '../types'
import { NodeConverter, NodeConversionContext, registerNodeConverter } from '../registry/node-registry'

// ============================================
// Node Type Hints
// ============================================

/**
 * Hints for implementing specific unsupported node types
 */
const NODE_IMPLEMENTATION_HINTS: Record<string, {
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  suggestion: string
  resources?: string[]
}> = {
  // Database nodes
  'n8n-nodes-base.postgres': {
    category: 'Database',
    difficulty: 'easy',
    suggestion: 'Use @supabase/supabase-js or direct pg client. Consider using Prisma for type safety.',
    resources: ['https://supabase.com/docs/reference/javascript'],
  },
  'n8n-nodes-base.mysql': {
    category: 'Database',
    difficulty: 'easy',
    suggestion: 'Use mysql2 package with promise API. Consider using Prisma.',
    resources: ['https://github.com/sidorares/node-mysql2'],
  },
  'n8n-nodes-base.mongoDb': {
    category: 'Database',
    difficulty: 'easy',
    suggestion: 'Use mongodb driver or Mongoose. Consider serverless-friendly options.',
    resources: ['https://mongodb.github.io/node-mongodb-native/'],
  },

  // File/Storage nodes
  'n8n-nodes-base.googleDrive': {
    category: 'File Storage',
    difficulty: 'medium',
    suggestion: 'Use @googleapis/drive package with OAuth2. May need custom auth flow.',
    resources: ['https://developers.google.com/drive/api/v3/quickstart/nodejs'],
  },
  'n8n-nodes-base.s3': {
    category: 'File Storage',
    difficulty: 'easy',
    suggestion: 'Use @aws-sdk/client-s3 v3. Can also use Supabase Storage as alternative.',
    resources: ['https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/'],
  },
  'n8n-nodes-base.dropbox': {
    category: 'File Storage',
    difficulty: 'medium',
    suggestion: 'Use dropbox SDK. Requires OAuth2 app setup.',
    resources: ['https://dropbox.github.io/dropbox-sdk-js/'],
  },

  // Communication nodes
  'n8n-nodes-base.slack': {
    category: 'Communication',
    difficulty: 'easy',
    suggestion: 'Use @slack/web-api. For incoming webhooks, use simple fetch.',
    resources: ['https://slack.dev/node-slack-sdk/web-api'],
  },
  'n8n-nodes-base.discord': {
    category: 'Communication',
    difficulty: 'easy',
    suggestion: 'Use discord.js for bots or simple fetch for webhooks.',
    resources: ['https://discord.js.org/'],
  },
  'n8n-nodes-base.telegram': {
    category: 'Communication',
    difficulty: 'easy',
    suggestion: 'Use node-telegram-bot-api or direct Bot API with fetch.',
    resources: ['https://core.telegram.org/bots/api'],
  },
  'n8n-nodes-base.emailSend': {
    category: 'Communication',
    difficulty: 'easy',
    suggestion: 'Use Resend, SendGrid, or nodemailer. Resend is recommended for modern apps.',
    resources: ['https://resend.com/docs'],
  },

  // CRM/Marketing nodes
  'n8n-nodes-base.hubspot': {
    category: 'CRM',
    difficulty: 'medium',
    suggestion: 'Use @hubspot/api-client. Requires OAuth or private app token.',
    resources: ['https://developers.hubspot.com/docs/api/overview'],
  },
  'n8n-nodes-base.salesforce': {
    category: 'CRM',
    difficulty: 'hard',
    suggestion: 'Use jsforce package. Complex OAuth flow required.',
    resources: ['https://jsforce.github.io/'],
  },
  'n8n-nodes-base.mailchimp': {
    category: 'Marketing',
    difficulty: 'easy',
    suggestion: 'Use @mailchimp/mailchimp_marketing or direct REST API.',
    resources: ['https://mailchimp.com/developer/marketing/'],
  },

  // Data processing nodes
  'n8n-nodes-base.spreadsheetFile': {
    category: 'Data Processing',
    difficulty: 'easy',
    suggestion: 'Use xlsx package for Excel, csv-parse for CSV.',
    resources: ['https://sheetjs.com/'],
  },
  'n8n-nodes-base.xml': {
    category: 'Data Processing',
    difficulty: 'easy',
    suggestion: 'Use xml2js or fast-xml-parser for parsing/building XML.',
    resources: ['https://github.com/NaturalIntelligence/fast-xml-parser'],
  },
  'n8n-nodes-base.html': {
    category: 'Data Processing',
    difficulty: 'easy',
    suggestion: 'Use cheerio for HTML parsing, similar to jQuery syntax.',
    resources: ['https://cheerio.js.org/'],
  },

  // AI/ML nodes
  'n8n-nodes-langchain.agent': {
    category: 'AI/ML',
    difficulty: 'medium',
    suggestion: 'Use LangChain.js or Vercel AI SDK. Consider OpenAI function calling.',
    resources: ['https://js.langchain.com/docs/'],
  },
  'n8n-nodes-langchain.chainLlm': {
    category: 'AI/ML',
    difficulty: 'medium',
    suggestion: 'Use LangChain.js chains or Vercel AI SDK with streaming.',
    resources: ['https://sdk.vercel.ai/docs'],
  },
  'n8n-nodes-langchain.vectorStoreAgent': {
    category: 'AI/ML',
    difficulty: 'hard',
    suggestion: 'Use LangChain.js with Pinecone, Supabase pgvector, or other vector DBs.',
    resources: ['https://js.langchain.com/docs/integrations/vectorstores/'],
  },

  // Utility nodes
  'n8n-nodes-base.wait': {
    category: 'Utility',
    difficulty: 'easy',
    suggestion: 'Use setTimeout/setInterval or better: step-based orchestration.',
    resources: [],
  },
  'n8n-nodes-base.executeCommand': {
    category: 'Utility',
    difficulty: 'easy',
    suggestion: 'Use child_process.exec or execa package. Be careful with security.',
    resources: ['https://github.com/sindresorhus/execa'],
  },
  'n8n-nodes-base.sshCommand': {
    category: 'Utility',
    difficulty: 'medium',
    suggestion: 'Use ssh2 package for SSH connections.',
    resources: ['https://github.com/mscdex/ssh2'],
  },
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get implementation hint for a node type
 */
function getImplementationHint(nodeType: string): {
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  suggestion: string
  resources: string[]
} {
  // Direct match
  if (NODE_IMPLEMENTATION_HINTS[nodeType]) {
    return {
      ...NODE_IMPLEMENTATION_HINTS[nodeType],
      resources: NODE_IMPLEMENTATION_HINTS[nodeType].resources || [],
    }
  }

  // Pattern match (e.g., n8n-nodes-base.*)
  for (const [pattern, hint] of Object.entries(NODE_IMPLEMENTATION_HINTS)) {
    if (nodeType.startsWith(pattern.replace('*', ''))) {
      return { ...hint, resources: hint.resources || [] }
    }
  }

  // Categorize by common patterns
  const lowerType = nodeType.toLowerCase()

  if (lowerType.includes('database') || lowerType.includes('sql')) {
    return {
      category: 'Database',
      difficulty: 'medium',
      suggestion: 'Research the specific database driver for Node.js/TypeScript.',
      resources: [],
    }
  }

  if (lowerType.includes('webhook') || lowerType.includes('api')) {
    return {
      category: 'API',
      difficulty: 'easy',
      suggestion: 'Use fetch or axios for HTTP requests. Consider using existing API client.',
      resources: [],
    }
  }

  if (lowerType.includes('ai') || lowerType.includes('llm') || lowerType.includes('langchain')) {
    return {
      category: 'AI/ML',
      difficulty: 'medium',
      suggestion: 'Use Vercel AI SDK or LangChain.js for AI functionality.',
      resources: ['https://sdk.vercel.ai/docs'],
    }
  }

  // Default
  return {
    category: 'Unknown',
    difficulty: 'medium',
    suggestion: 'Research the equivalent npm package or REST API for this functionality.',
    resources: [],
  }
}

/**
 * Generate TypeScript interface based on node parameters
 */
function generateTypeInterface(node: N8nNode): string {
  const params = node.parameters || {}
  const fields: string[] = []

  for (const [key, value] of Object.entries(params)) {
    let type = 'unknown'
    if (typeof value === 'string') type = 'string'
    else if (typeof value === 'number') type = 'number'
    else if (typeof value === 'boolean') type = 'boolean'
    else if (Array.isArray(value)) type = 'unknown[]'
    else if (typeof value === 'object') type = 'Record<string, unknown>'

    fields.push(`  ${key}?: ${type}`)
  }

  return `interface ${toPascalCase(node.name)}Input {\n${fields.join('\n')}\n}`
}

/**
 * Convert to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^./, str => str.toUpperCase())
}

// ============================================
// Enhanced Unsupported Converter
// ============================================

/**
 * Enhanced converter for unsupported nodes
 * Provides detailed implementation guidance
 */
export const unsupportedNodeConverter: NodeConverter = {
  nodeTypes: ['*'],
  priority: -50, // Lower than normal converters, higher than basic fallback

  canConvert(): boolean {
    return true
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const hint = getImplementationHint(node.type)
    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    const warnings: ConversionWarning[] = [
      {
        severity: 'warning',
        message: `Node type "${node.type}" requires manual implementation`,
        suggestion: hint.suggestion,
        nodeId: node.id,
      },
    ]

    if (hint.difficulty === 'hard') {
      warnings.push({
        severity: 'info',
        message: `This is a complex integration (${hint.category}). Consider simplifying or breaking into smaller steps.`,
        nodeId: node.id,
      })
    }

    return {
      step: {
        id: stepId,
        name: node.name,
        description: `[${hint.category}] ${node.type.split('.').pop()} - Manual Implementation Required`,
        type: 'manual_research',
        executor: 'custom',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
        executionExplanation: {
          title: `Manual Implementation: ${node.name}`,
          steps: [
            `Original n8n node type: ${node.type}`,
            `Category: ${hint.category}`,
            `Difficulty: ${hint.difficulty}`,
            `Suggestion: ${hint.suggestion}`,
            ...(hint.resources.length > 0
              ? [`Resources: ${hint.resources.join(', ')}`]
              : []),
          ],
        },
      },
      warnings,
      requiresManualImplementation: true,
      sourceNode: {
        id: node.id,
        name: node.name,
        type: node.type,
      },
    }
  },

  generateCode(node: N8nNode, context: NodeConversionContext): GeneratedCode {
    const hint = getImplementationHint(node.type)
    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')
    const typeInterface = generateTypeInterface(node)
    const nodeConfig = JSON.stringify(node.parameters, null, 2)

    const apiRouteContent = `/**
 * MANUAL IMPLEMENTATION REQUIRED
 *
 * Original n8n Node: ${node.type}
 * Node Name: ${node.name}
 * Category: ${hint.category}
 * Difficulty: ${hint.difficulty}
 *
 * Implementation Guide:
 * ${hint.suggestion}
 *
 * ${hint.resources.length > 0 ? `Resources:\n * - ${hint.resources.join('\n * - ')}` : ''}
 *
 * Original Configuration:
 * ${nodeConfig.split('\n').map(l => ' * ' + l).join('\n')}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Generated type based on n8n parameters
${typeInterface}

interface StepInput {
  sessionId: string
  stepId: string
  input?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: StepInput = await request.json()

    // TODO: Implement ${node.type} functionality
    // See the implementation guide above for suggestions

    // Original n8n parameters were:
    // ${JSON.stringify(node.parameters, null, 2).split('\n').join('\n    // ')}

    throw new Error('Not implemented: ${node.name}')

    // Example success response:
    // return NextResponse.json({
    //   success: true,
    //   data: { result: 'your data here' },
    // })
  } catch (error) {
    console.error('[${stepId}] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      },
      { status: 500 }
    )
  }
}
`

    return {
      apiRoute: {
        path: `${context.outputDir}/${stepId}/route.ts`,
        content: apiRouteContent,
      },
      envVariables: detectEnvVariables(node),
    }
  },
}

/**
 * Detect potential environment variables from node configuration
 */
function detectEnvVariables(node: N8nNode): GeneratedCode['envVariables'] {
  const envVars: NonNullable<GeneratedCode['envVariables']> = []
  const params = node.parameters || {}
  const nodeType = node.type.toLowerCase()

  // Check for credential references
  if (node.credentials) {
    for (const [credType] of Object.entries(node.credentials)) {
      const envName = credType
        .replace(/([A-Z])/g, '_$1')
        .toUpperCase()
        .replace(/^_/, '')
        + '_API_KEY'

      envVars.push({
        name: envName,
        description: `API key for ${credType}`,
        required: true,
        sourceCredentialType: credType,
      })
    }
  }

  // Common patterns in parameters
  const paramStr = JSON.stringify(params).toLowerCase()

  if (paramStr.includes('api_key') || paramStr.includes('apikey')) {
    const baseName = node.type.split('.').pop()?.toUpperCase() || 'SERVICE'
    envVars.push({
      name: `${baseName}_API_KEY`,
      description: `API key for ${node.type}`,
      required: true,
    })
  }

  if (paramStr.includes('webhook') || paramStr.includes('url')) {
    envVars.push({
      name: 'WEBHOOK_SECRET',
      description: 'Secret for webhook verification',
      required: false,
    })
  }

  return envVars.length > 0 ? envVars : undefined
}

// Register the enhanced unsupported converter
registerNodeConverter(unsupportedNodeConverter)
