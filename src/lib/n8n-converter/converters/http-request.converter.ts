/**
 * HTTP Request Node Converter
 *
 * Converts n8n HTTP Request nodes to Gattaca API route steps.
 */

import { N8nNode, ConvertedStep, GeneratedCode, EnvVariable } from '../types'
import {
  NodeConverter,
  NodeConversionContext,
  registerNodeConverter,
} from '../registry/node-registry'
import {
  convertExpression,
  convertExpressionsInObject,
  generateHelperCode,
  containsExpression,
} from './expression.converter'

/**
 * HTTP Request node converter
 */
const httpRequestConverter: NodeConverter = {
  nodeTypes: ['n8n-nodes-base.httpRequest'],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return node.type === 'n8n-nodes-base.httpRequest'
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const params = node.parameters
    const warnings: ConvertedStep['warnings'] = []

    // Extract HTTP configuration
    const method = (params.method as string) || 'GET'
    const url = params.url as string || ''

    // Check for dynamic URL
    if (containsExpression(url)) {
      warnings.push({
        severity: 'info',
        message: 'URL contains dynamic expressions that will be resolved at runtime',
        nodeId: node.id,
        parameter: 'url',
      })
    }

    // Extract authentication
    const authType = params.authentication as string
    if (authType && authType !== 'none') {
      warnings.push({
        severity: 'info',
        message: `Authentication type "${authType}" detected. Environment variable will be required.`,
        nodeId: node.id,
      })
    }

    // Build step
    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    return {
      step: {
        id: stepId,
        name: node.name,
        description: `HTTP ${method} request${url ? ` to ${url.substring(0, 50)}...` : ''}`,
        type: 'auto',
        executor: 'api',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
        executionExplanation: {
          title: `HTTP ${method} Request`,
          steps: [
            `Makes ${method} request to configured URL`,
            'Handles authentication if configured',
            'Parses response and passes to next step',
          ],
          estimatedCost: 'External API costs may apply',
          costService: 'External API',
        },
      },
      warnings,
      requiresManualImplementation: false,
      sourceNode: {
        id: node.id,
        name: node.name,
        type: node.type,
      },
    }
  },

  generateCode(node: N8nNode, context: NodeConversionContext): GeneratedCode {
    const params = node.parameters
    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    // Convert expressions in parameters
    const { result: convertedParams, requiredHelpers } = convertExpressionsInObject(
      params,
      context.expressionContext
    )

    const method = (params.method as string) || 'GET'
    const url = params.url as string || ''
    const authType = params.authentication as string
    const headers = params.headers as Record<string, string> | undefined
    const body = params.body as unknown

    // Build environment variables
    const envVariables: EnvVariable[] = []

    if (authType === 'headerAuth' || authType === 'genericCredentialType') {
      envVariables.push({
        name: `${stepId.toUpperCase()}_API_KEY`,
        description: `API key for ${node.name}`,
        required: true,
        example: 'your-api-key-here',
        sourceCredentialType: authType,
      })
    }

    if (authType === 'oAuth2') {
      envVariables.push(
        {
          name: `${stepId.toUpperCase()}_CLIENT_ID`,
          description: `OAuth2 Client ID for ${node.name}`,
          required: true,
          example: 'your-client-id',
          sourceCredentialType: 'oAuth2',
        },
        {
          name: `${stepId.toUpperCase()}_CLIENT_SECRET`,
          description: `OAuth2 Client Secret for ${node.name}`,
          required: true,
          example: 'your-client-secret',
          sourceCredentialType: 'oAuth2',
        }
      )
    }

    // Generate helper code if needed
    const helperCode = generateHelperCode(requiredHelpers)

    // Build API route code
    const routeCode = `/**
 * API Route: ${node.name}
 * Converted from n8n HTTP Request node
 *
 * Original node type: ${node.type}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

${helperCode}

interface RequestBody {
  sessionId: string
  stepId: string
  input?: Record<string, unknown>
  context?: Record<string, unknown>
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

    const body: RequestBody = await request.json()
    const { sessionId, stepId, input, context } = body

    // Build request configuration
    const state = { currentStep: { input }, steps: context }
    const url = ${containsExpression(url) ? `\`${convertExpression(url, context.expressionContext).expression}\`` : JSON.stringify(url)}
    const method = ${JSON.stringify(method)}

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ${authType === 'headerAuth' ? `'Authorization': \`Bearer \${process.env.${stepId.toUpperCase()}_API_KEY}\`,` : ''}
    }

    ${headers ? `// Additional headers from n8n config
    Object.assign(headers, ${JSON.stringify(headers)})` : ''}

    // Build request options
    const options: RequestInit = {
      method,
      headers,
      ${body && method !== 'GET' ? `body: JSON.stringify(${JSON.stringify(body)}),` : ''}
    }

    // Make the request
    const response = await fetch(url, options)

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({
        success: false,
        error: \`HTTP \${response.status}: \${errorText}\`,
      }, { status: response.status })
    }

    // Parse response
    const contentType = response.headers.get('content-type') || ''
    let data: unknown

    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    return NextResponse.json({
      success: true,
      data,
      metadata: {
        statusCode: response.status,
        contentType,
      },
    })
  } catch (error) {
    console.error('[${stepId}] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
`

    return {
      apiRoute: {
        path: `src/app/api/playbook/${context.playbookId}/${stepId}/route.ts`,
        content: routeCode,
      },
      envVariables,
    }
  },
}

// Register the converter
registerNodeConverter(httpRequestConverter)

export { httpRequestConverter }
