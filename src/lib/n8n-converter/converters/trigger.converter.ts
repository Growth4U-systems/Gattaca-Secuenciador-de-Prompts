/**
 * Trigger Node Converters
 *
 * Converts n8n trigger nodes (Manual, Webhook, Schedule) to Gattaca entry points.
 */

import { N8nNode, ConvertedStep, GeneratedCode } from '../types'
import {
  NodeConverter,
  NodeConversionContext,
  registerNodeConverter,
} from '../registry/node-registry'

/**
 * Manual Trigger converter
 * The simplest trigger - user initiates the playbook
 */
const manualTriggerConverter: NodeConverter = {
  nodeTypes: ['n8n-nodes-base.manualTrigger'],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return node.type === 'n8n-nodes-base.manualTrigger'
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    return {
      step: {
        id: stepId,
        name: node.name || 'Start',
        description: 'Manual trigger - user initiates the playbook execution',
        type: 'input',
        executor: 'none',
        dependsOn: [],
      },
      warnings: [],
      requiresManualImplementation: false,
      sourceNode: {
        id: node.id,
        name: node.name,
        type: node.type,
      },
    }
  },
}

/**
 * Webhook Trigger converter
 * Converts to an input step that expects data from external source
 */
const webhookTriggerConverter: NodeConverter = {
  nodeTypes: ['n8n-nodes-base.webhook'],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return node.type === 'n8n-nodes-base.webhook'
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const params = node.parameters
    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    const httpMethod = (params.httpMethod as string) || 'GET'
    const path = (params.path as string) || ''

    return {
      step: {
        id: stepId,
        name: node.name || 'Webhook',
        description: `Webhook trigger (${httpMethod} ${path || '/webhook'})`,
        type: 'input',
        executor: 'none',
        dependsOn: [],
      },
      warnings: [
        {
          severity: 'info',
          message: 'Webhook trigger converted to input step. External webhook endpoint not automatically created.',
          suggestion: 'Create a separate API route if you need to receive external webhooks.',
          nodeId: node.id,
        },
      ],
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
    const httpMethod = (params.httpMethod as string) || 'POST'

    // Generate webhook handler
    const routeCode = `/**
 * Webhook Endpoint: ${node.name}
 * Converted from n8n Webhook trigger
 *
 * This endpoint receives external webhook calls and can trigger playbook execution.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface WebhookPayload {
  [key: string]: unknown
}

export async function ${httpMethod}(request: NextRequest) {
  try {
    // Parse webhook payload
    let payload: WebhookPayload = {}

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      payload = await request.json()
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      formData.forEach((value, key) => {
        payload[key] = value
      })
    }

    // TODO: Create a new playbook session with this data
    // const supabase = await createClient()
    // const { data: session } = await supabase
    //   .from('playbook_sessions')
    //   .insert({
    //     playbook_id: '${context.playbookId}',
    //     status: 'pending',
    //     config: payload,
    //   })
    //   .select()
    //   .single()

    console.log('[webhook:${stepId}] Received payload:', payload)

    return NextResponse.json({
      success: true,
      message: 'Webhook received',
      data: payload,
    })
  } catch (error) {
    console.error('[webhook:${stepId}] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
`

    return {
      apiRoute: {
        path: `src/app/api/playbook/${context.playbookId}/webhook/${stepId}/route.ts`,
        content: routeCode,
      },
    }
  },
}

/**
 * Schedule Trigger converter
 * Converts to a note about external scheduling requirements
 */
const scheduleTriggerConverter: NodeConverter = {
  nodeTypes: ['n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.cronTrigger'],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return (
      node.type === 'n8n-nodes-base.scheduleTrigger' ||
      node.type === 'n8n-nodes-base.cronTrigger'
    )
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const params = node.parameters
    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    // Extract schedule info
    const rule = params.rule as { interval?: unknown[] } | undefined
    const cronExpression = params.cronExpression as string | undefined

    let scheduleDescription = 'Scheduled trigger'
    if (cronExpression) {
      scheduleDescription = `Cron: ${cronExpression}`
    } else if (rule?.interval) {
      scheduleDescription = `Interval: ${JSON.stringify(rule.interval)}`
    }

    return {
      step: {
        id: stepId,
        name: node.name || 'Schedule',
        description: scheduleDescription,
        type: 'input',
        executor: 'none',
        dependsOn: [],
      },
      warnings: [
        {
          severity: 'warning',
          message: 'Schedule trigger requires external scheduler (cron job, Vercel cron, etc.)',
          suggestion: `Set up a cron job or use Vercel Cron to call this playbook on schedule.`,
          nodeId: node.id,
        },
      ],
      requiresManualImplementation: true,
      sourceNode: {
        id: node.id,
        name: node.name,
        type: node.type,
      },
    }
  },
}

/**
 * Chat Trigger converter (for AI agents)
 */
const chatTriggerConverter: NodeConverter = {
  nodeTypes: ['@n8n/n8n-nodes-langchain.chatTrigger'],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return node.type === '@n8n/n8n-nodes-langchain.chatTrigger'
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    return {
      step: {
        id: stepId,
        name: node.name || 'Chat Input',
        description: 'Chat trigger - receives user messages for AI processing',
        type: 'input',
        executor: 'none',
        dependsOn: [],
      },
      warnings: [
        {
          severity: 'info',
          message: 'Chat trigger converted to input step for user message collection',
          nodeId: node.id,
        },
      ],
      requiresManualImplementation: false,
      sourceNode: {
        id: node.id,
        name: node.name,
        type: node.type,
      },
    }
  },
}

// Register all trigger converters
registerNodeConverter(manualTriggerConverter)
registerNodeConverter(webhookTriggerConverter)
registerNodeConverter(scheduleTriggerConverter)
registerNodeConverter(chatTriggerConverter)

export {
  manualTriggerConverter,
  webhookTriggerConverter,
  scheduleTriggerConverter,
  chatTriggerConverter,
}
