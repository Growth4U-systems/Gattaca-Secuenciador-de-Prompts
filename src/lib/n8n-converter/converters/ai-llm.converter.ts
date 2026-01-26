/**
 * AI/LLM Node Converters
 *
 * Converts n8n AI and LLM nodes (OpenAI, Anthropic, LangChain) to Gattaca steps.
 * These nodes typically become 'auto_with_review' type steps.
 */

import { N8nNode, ConvertedStep, GeneratedCode, EnvVariable } from '../types'
import {
  NodeConverter,
  NodeConversionContext,
  registerNodeConverter,
} from '../registry/node-registry'
import {
  convertExpression,
  containsExpression,
} from './expression.converter'

// ============================================
// OpenAI Node Converter
// ============================================

const openAiConverter: NodeConverter = {
  nodeTypes: [
    'n8n-nodes-base.openAi',
    '@n8n/n8n-nodes-langchain.openAi',
    '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  ],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return this.nodeTypes.some(t => node.type === t || node.type.includes('openAi'))
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const params = node.parameters
    const warnings: ConvertedStep['warnings'] = []

    // Extract configuration
    const operation = (params.operation as string) || 'message'
    const model = (params.model as string) || (params.options as { model?: string })?.model || 'gpt-4'

    // Check for system prompt
    const systemMessage = params.systemMessage as string || ''
    const hasSystemPrompt = Boolean(systemMessage)

    // Check for dynamic content
    const userMessage = params.text as string || params.content as string || ''
    if (containsExpression(userMessage)) {
      warnings.push({
        severity: 'info',
        message: 'User prompt contains dynamic expressions that will be resolved at runtime',
        nodeId: node.id,
        parameter: 'text',
      })
    }

    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    return {
      step: {
        id: stepId,
        name: node.name,
        description: `OpenAI ${operation} using ${model}`,
        type: 'auto_with_review',
        executor: 'llm',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
        executionExplanation: {
          title: `AI Processing (${model})`,
          steps: [
            hasSystemPrompt ? 'Applies system prompt configuration' : 'No system prompt configured',
            'Sends user prompt to OpenAI API',
            'Receives and processes AI response',
            'Returns structured output for next step',
          ],
          estimatedCost: 'OpenAI API usage charges apply',
          costService: 'OpenAI',
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

    const model = (params.model as string) || (params.options as { model?: string })?.model || 'gpt-4'
    const systemMessage = params.systemMessage as string || ''
    const userMessage = params.text as string || params.content as string || ''
    const maxTokens = (params.maxTokens as number) || (params.options as { maxTokens?: number })?.maxTokens || 4096
    const temperature = (params.temperature as number) || (params.options as { temperature?: number })?.temperature || 0.7

    const envVariables: EnvVariable[] = [
      {
        name: 'OPENAI_API_KEY',
        description: 'OpenAI API key for AI processing',
        required: true,
        example: 'sk-...',
        sourceCredentialType: 'openAiApi',
      },
    ]

    const routeCode = `/**
 * API Route: ${node.name}
 * Converted from n8n OpenAI node
 *
 * Original node type: ${node.type}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

interface RequestBody {
  sessionId: string
  stepId: string
  input?: Record<string, unknown>
  context?: Record<string, unknown>
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

    // Build the state object for expression resolution
    const state = { currentStep: { input }, steps: context }

    // Resolve dynamic content
    ${containsExpression(userMessage) ? `const userPrompt = \`${convertExpression(userMessage, context.expressionContext).expression}\`` : `const userPrompt = ${JSON.stringify(userMessage)}`}

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: ${JSON.stringify(model)},
      messages: [
        ${systemMessage ? `{ role: 'system', content: ${JSON.stringify(systemMessage)} },` : ''}
        { role: 'user', content: userPrompt },
      ],
      max_tokens: ${maxTokens},
      temperature: ${temperature},
    })

    const content = response.choices[0]?.message?.content || ''

    return NextResponse.json({
      success: true,
      data: {
        content,
        model: response.model,
        usage: response.usage,
      },
      metadata: {
        finishReason: response.choices[0]?.finish_reason,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
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

// ============================================
// Anthropic Node Converter
// ============================================

const anthropicConverter: NodeConverter = {
  nodeTypes: [
    '@n8n/n8n-nodes-langchain.lmChatAnthropic',
    'n8n-nodes-base.anthropic',
  ],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return this.nodeTypes.some(t => node.type === t || node.type.includes('anthropic'))
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const params = node.parameters
    const warnings: ConvertedStep['warnings'] = []

    const model = (params.model as string) || 'claude-3-sonnet-20240229'
    const systemMessage = params.systemMessage as string || ''
    const userMessage = params.text as string || params.content as string || ''

    if (containsExpression(userMessage)) {
      warnings.push({
        severity: 'info',
        message: 'User prompt contains dynamic expressions',
        nodeId: node.id,
      })
    }

    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    return {
      step: {
        id: stepId,
        name: node.name,
        description: `Anthropic Claude using ${model}`,
        type: 'auto_with_review',
        executor: 'llm',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
        executionExplanation: {
          title: `AI Processing (${model})`,
          steps: [
            Boolean(systemMessage) ? 'Applies system prompt' : 'Uses default behavior',
            'Sends prompt to Anthropic Claude API',
            'Processes response',
            'Returns output for next step',
          ],
          estimatedCost: 'Anthropic API usage charges apply',
          costService: 'Anthropic',
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

    const model = (params.model as string) || 'claude-3-sonnet-20240229'
    const systemMessage = params.systemMessage as string || ''
    const userMessage = params.text as string || params.content as string || ''
    const maxTokens = (params.maxTokens as number) || 4096

    const envVariables: EnvVariable[] = [
      {
        name: 'ANTHROPIC_API_KEY',
        description: 'Anthropic API key for Claude',
        required: true,
        example: 'sk-ant-...',
        sourceCredentialType: 'anthropicApi',
      },
    ]

    const routeCode = `/**
 * API Route: ${node.name}
 * Converted from n8n Anthropic node
 *
 * Original node type: ${node.type}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

interface RequestBody {
  sessionId: string
  stepId: string
  input?: Record<string, unknown>
  context?: Record<string, unknown>
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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

    const state = { currentStep: { input }, steps: context }

    ${containsExpression(userMessage) ? `const userPrompt = \`${convertExpression(userMessage, context.expressionContext).expression}\`` : `const userPrompt = ${JSON.stringify(userMessage)}`}

    const response = await anthropic.messages.create({
      model: ${JSON.stringify(model)},
      max_tokens: ${maxTokens},
      ${systemMessage ? `system: ${JSON.stringify(systemMessage)},` : ''}
      messages: [
        { role: 'user', content: userPrompt },
      ],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    const content = textBlock && 'text' in textBlock ? textBlock.text : ''

    return NextResponse.json({
      success: true,
      data: {
        content,
        model: response.model,
        stopReason: response.stop_reason,
      },
      metadata: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
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

// ============================================
// LangChain Agent Converter
// ============================================

const agentConverter: NodeConverter = {
  nodeTypes: [
    '@n8n/n8n-nodes-langchain.agent',
    '@n8n/n8n-nodes-langchain.chainLlm',
  ],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return this.nodeTypes.some(t => node.type === t || node.type.includes('agent'))
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const warnings: ConvertedStep['warnings'] = []

    // Agents are complex - warn about potential limitations
    warnings.push({
      severity: 'warning',
      message: 'LangChain agents require manual review. Tool bindings may need configuration.',
      suggestion: 'Review generated code and configure tool functions as needed.',
      nodeId: node.id,
    })

    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    return {
      step: {
        id: stepId,
        name: node.name,
        description: 'AI Agent with tool capabilities',
        type: 'auto_with_review',
        executor: 'llm',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
        executionExplanation: {
          title: 'AI Agent Processing',
          steps: [
            'Initializes AI agent with configured tools',
            'Processes input through agent reasoning loop',
            'May invoke connected tools/functions',
            'Returns final agent response',
          ],
          estimatedCost: 'LLM API charges (varies by model and iterations)',
          costService: 'OpenAI/Anthropic',
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
    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    const envVariables: EnvVariable[] = [
      {
        name: 'OPENAI_API_KEY',
        description: 'API key for agent LLM (typically OpenAI)',
        required: true,
        example: 'sk-...',
      },
    ]

    const routeCode = `/**
 * API Route: ${node.name}
 * Converted from n8n LangChain Agent node
 *
 * IMPORTANT: This is a placeholder. Agent logic requires manual implementation.
 * Original node type: ${node.type}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // TODO: Implement agent logic
    // The n8n agent node had the following configuration:
    // ${JSON.stringify(node.parameters, null, 2).split('\n').map(l => '// ' + l).join('\n')}

    // Placeholder response
    return NextResponse.json({
      success: false,
      error: 'Agent implementation required. See code comments for original configuration.',
      metadata: {
        requiresImplementation: true,
        originalNodeType: '${node.type}',
      },
    }, { status: 501 })
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

// Register all AI converters
registerNodeConverter(openAiConverter)
registerNodeConverter(anthropicConverter)
registerNodeConverter(agentConverter)

export { openAiConverter, anthropicConverter, agentConverter }
