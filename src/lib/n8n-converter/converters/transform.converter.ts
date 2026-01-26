/**
 * Data Transform Node Converters
 *
 * Converts n8n data transformation nodes (Set, Code, Item Lists, etc.)
 * to Gattaca steps. These typically become 'auto' type steps with custom execution.
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
  convertExpressionsInObject,
} from './expression.converter'

// ============================================
// Set Node Converter
// ============================================

const setNodeConverter: NodeConverter = {
  nodeTypes: [
    'n8n-nodes-base.set',
    'n8n-nodes-base.setV2',
  ],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return this.nodeTypes.some(t => node.type === t || node.type.endsWith('.set'))
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const params = node.parameters
    const warnings: ConvertedStep['warnings'] = []

    // Check for dynamic values
    const values = params.values as Record<string, unknown> | undefined
    if (values && containsExpression(JSON.stringify(values))) {
      warnings.push({
        severity: 'info',
        message: 'Set node contains dynamic expressions that reference previous step outputs',
        nodeId: node.id,
      })
    }

    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    // Count fields being set
    const fieldCount = values
      ? Object.keys(values).length
      : (params.assignments as { assignments?: unknown[] })?.assignments?.length || 0

    return {
      step: {
        id: stepId,
        name: node.name,
        description: `Set ${fieldCount} field(s) on data`,
        type: 'auto',
        executor: 'custom',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
        executionExplanation: {
          title: 'Data Transformation',
          steps: [
            'Receives input data from previous step',
            `Sets/modifies ${fieldCount} field(s)`,
            'Passes transformed data to next step',
          ],
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

    // Extract assignments (v2 format) or values (v1 format)
    const assignments = (params.assignments as { assignments?: Array<{ name: string; value: unknown }> })?.assignments || []
    const keepOnlySet = params.keepOnlySet as boolean || false

    const routeCode = `/**
 * API Route: ${node.name}
 * Converted from n8n Set node
 *
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

    // Build state for expression resolution
    const state = { currentStep: { input }, steps: context }

    // ${keepOnlySet ? 'Start with empty object (keepOnlySet: true)' : 'Start with input data'}
    const result = ${keepOnlySet ? '{}' : '{ ...input }'}

    // Apply assignments
    ${assignments.map((a, i) => {
      const valueStr = containsExpression(String(a.value))
        ? `// Dynamic: ${a.value}\n    result['${a.name}'] = state.steps?.['${context.analyzedNode.dependencies[0]?.toLowerCase().replace(/\s+/g, '_') || 'previous'}']?.output // TODO: resolve expression`
        : `result['${a.name}'] = ${JSON.stringify(a.value)}`
      return valueStr
    }).join('\n    ')}

    return NextResponse.json({
      success: true,
      data: result,
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
      envVariables: [],
    }
  },
}

// ============================================
// Code Node Converter
// ============================================

const codeNodeConverter: NodeConverter = {
  nodeTypes: [
    'n8n-nodes-base.code',
    'n8n-nodes-base.function',
    'n8n-nodes-base.functionItem',
  ],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return this.nodeTypes.some(t => node.type === t)
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const params = node.parameters
    const warnings: ConvertedStep['warnings'] = []

    const jsCode = (params.jsCode as string) || (params.functionCode as string) || ''
    const language = (params.language as string) || 'javaScript'

    // Check code complexity
    const lineCount = jsCode.split('\n').length

    if (lineCount > 50) {
      warnings.push({
        severity: 'warning',
        message: `Code node has ${lineCount} lines. Consider reviewing for optimization.`,
        nodeId: node.id,
      })
    }

    // Check for unsupported features
    if (jsCode.includes('$getCredential') || jsCode.includes('$credential')) {
      warnings.push({
        severity: 'warning',
        message: 'Code node accesses credentials. These need manual configuration.',
        suggestion: 'Move credential access to environment variables',
        nodeId: node.id,
      })
    }

    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    return {
      step: {
        id: stepId,
        name: node.name,
        description: `Execute custom ${language} code`,
        type: 'auto',
        executor: 'custom',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
        executionExplanation: {
          title: 'Custom Code Execution',
          steps: [
            'Receives input data',
            `Executes ${lineCount} lines of ${language} code`,
            'Returns transformed output',
          ],
        },
      },
      warnings,
      requiresManualImplementation: lineCount > 100,
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

    const jsCode = (params.jsCode as string) || (params.functionCode as string) || ''
    const mode = (params.mode as string) || 'runOnceForAllItems'

    // Convert n8n code patterns to plain JS
    const convertedCode = jsCode
      .replace(/\$input\.all\(\)/g, 'items')
      .replace(/\$input\.first\(\)/g, 'items[0]')
      .replace(/\$input\.item/g, 'item')
      .replace(/\$json/g, 'item.json')
      .replace(/\$node\["([^"]+)"\]\.json/g, "context?.['$1']?.output")

    const routeCode = `/**
 * API Route: ${node.name}
 * Converted from n8n Code node
 *
 * Original node type: ${node.type}
 * Mode: ${mode}
 *
 * Original code:
 * ${jsCode.split('\n').map(l => '* ' + l).join('\n * ')}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RequestBody {
  sessionId: string
  stepId: string
  input?: Record<string, unknown> | Array<Record<string, unknown>>
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

    // Wrap input as items array for compatibility
    const items = Array.isArray(input)
      ? input.map(i => ({ json: i }))
      : [{ json: input || {} }]

    // Execute converted code
    ${mode === 'runOnceForEachItem' ? `
    const results = []
    for (const item of items) {
      // Per-item processing
      ${convertedCode.split('\n').map(l => '      ' + l).join('\n')}
    }
    const output = results` : `
    // All items processing
    ${convertedCode.split('\n').map(l => '    ' + l).join('\n')}`}

    return NextResponse.json({
      success: true,
      data: ${mode === 'runOnceForEachItem' ? 'output' : 'items.map(i => i.json)'},
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
      envVariables: [],
    }
  },
}

// ============================================
// Item Lists Node Converter
// ============================================

const itemListsConverter: NodeConverter = {
  nodeTypes: [
    'n8n-nodes-base.itemLists',
    'n8n-nodes-base.splitInBatches',
  ],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return this.nodeTypes.some(t => node.type === t)
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const params = node.parameters
    const warnings: ConvertedStep['warnings'] = []

    const operation = (params.operation as string) || 'concatenate'
    const batchSize = (params.batchSize as number) || 10

    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    const operationDescriptions: Record<string, string> = {
      concatenate: 'Combine multiple input items into one array',
      limit: 'Limit items to specified count',
      removeDuplicates: 'Remove duplicate items',
      sort: 'Sort items by field',
      splitInBatches: `Split into batches of ${batchSize}`,
      summarize: 'Aggregate/summarize item data',
    }

    return {
      step: {
        id: stepId,
        name: node.name,
        description: operationDescriptions[operation] || `List operation: ${operation}`,
        type: 'auto',
        executor: 'custom',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
        executionExplanation: {
          title: 'List Manipulation',
          steps: [
            'Receives array of items',
            `Performs ${operation} operation`,
            'Returns processed array',
          ],
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

    const operation = (params.operation as string) || 'concatenate'

    const routeCode = `/**
 * API Route: ${node.name}
 * Converted from n8n Item Lists node
 *
 * Operation: ${operation}
 * Original node type: ${node.type}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RequestBody {
  sessionId: string
  stepId: string
  input?: unknown[] | Record<string, unknown>
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

    // Ensure we have an array
    const items = Array.isArray(input) ? input : [input]

    let result: unknown[]

    // Apply operation
    ${getOperationCode(operation, params)}

    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        inputCount: items.length,
        outputCount: result.length,
        operation: '${operation}',
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
      envVariables: [],
    }
  },
}

// Helper to generate operation-specific code
function getOperationCode(operation: string, params: Record<string, unknown>): string {
  switch (operation) {
    case 'limit':
      const maxItems = (params.maxItems as number) || 10
      return `result = items.slice(0, ${maxItems})`

    case 'removeDuplicates':
      const compareField = (params.compare as string) || 'all'
      return compareField === 'all'
        ? `result = [...new Map(items.map(i => [JSON.stringify(i), i])).values()]`
        : `result = [...new Map(items.map(i => [i['${compareField}'], i])).values()]`

    case 'sort':
      const sortField = (params.sortField as string) || 'id'
      const sortOrder = (params.sortOrder as string) || 'ascending'
      return `result = [...items].sort((a, b) => {
      const aVal = a['${sortField}']
      const bVal = b['${sortField}']
      return ${sortOrder === 'descending' ? 'bVal > aVal ? 1 : -1' : 'aVal > bVal ? 1 : -1'}
    })`

    case 'splitInBatches':
      const batchSize = (params.batchSize as number) || 10
      return `const batches: unknown[][] = []
    for (let i = 0; i < items.length; i += ${batchSize}) {
      batches.push(items.slice(i, i + ${batchSize}))
    }
    result = batches`

    case 'concatenate':
    default:
      return `result = items.flat()`
  }
}

// ============================================
// Merge Node Converter
// ============================================

const mergeNodeConverter: NodeConverter = {
  nodeTypes: [
    'n8n-nodes-base.merge',
    'n8n-nodes-base.mergeV2',
  ],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return this.nodeTypes.some(t => node.type === t || node.type.endsWith('.merge'))
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const params = node.parameters
    const warnings: ConvertedStep['warnings'] = []

    const mode = (params.mode as string) || 'append'

    const modeDescriptions: Record<string, string> = {
      append: 'Append items from all inputs',
      merge: 'Merge items by index position',
      mergeByKey: 'Merge items by matching key',
      combine: 'Combine all inputs into single output',
      chooseBranch: 'Choose which branch to output',
    }

    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    return {
      step: {
        id: stepId,
        name: node.name,
        description: modeDescriptions[mode] || `Merge: ${mode}`,
        type: 'auto',
        executor: 'custom',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
        executionExplanation: {
          title: 'Data Merge',
          steps: [
            `Receives data from ${context.analyzedNode.dependencies.length} inputs`,
            `Applies ${mode} merge strategy`,
            'Outputs combined result',
          ],
        },
      },
      warnings,
      requiresManualImplementation: mode === 'mergeByKey',
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

    const mode = (params.mode as string) || 'append'
    const mergeKey = (params.mergeByField as string) || 'id'

    const routeCode = `/**
 * API Route: ${node.name}
 * Converted from n8n Merge node
 *
 * Mode: ${mode}
 * Original node type: ${node.type}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RequestBody {
  sessionId: string
  stepId: string
  inputs?: Array<unknown[] | Record<string, unknown>>
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
    const { sessionId, stepId, inputs, context } = body

    // Get inputs from dependencies
    const inputArrays = inputs || Object.values(context || {})
      .filter(v => v && typeof v === 'object')
      .map(v => (v as { output?: unknown }).output)
      .filter(Boolean)

    let result: unknown[]

    // Apply merge mode
    ${getMergeCode(mode, mergeKey)}

    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        inputSources: inputArrays.length,
        outputCount: result.length,
        mergeMode: '${mode}',
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
      envVariables: [],
    }
  },
}

// Helper to generate merge-specific code
function getMergeCode(mode: string, mergeKey: string): string {
  switch (mode) {
    case 'merge':
      return `// Merge by index
    const maxLength = Math.max(...inputArrays.map(arr =>
      Array.isArray(arr) ? arr.length : 1
    ))
    result = []
    for (let i = 0; i < maxLength; i++) {
      const merged = {}
      for (const arr of inputArrays) {
        const items = Array.isArray(arr) ? arr : [arr]
        if (items[i]) {
          Object.assign(merged, items[i])
        }
      }
      result.push(merged)
    }`

    case 'mergeByKey':
      return `// Merge by key field: ${mergeKey}
    const keyMap = new Map<unknown, Record<string, unknown>>()
    for (const arr of inputArrays) {
      const items = Array.isArray(arr) ? arr : [arr]
      for (const item of items) {
        const key = (item as Record<string, unknown>)['${mergeKey}']
        const existing = keyMap.get(key) || {}
        keyMap.set(key, { ...existing, ...(item as object) })
      }
    }
    result = Array.from(keyMap.values())`

    case 'combine':
      return `// Combine all into single object
    const combined = {}
    for (const arr of inputArrays) {
      const items = Array.isArray(arr) ? arr : [arr]
      for (const item of items) {
        Object.assign(combined, item)
      }
    }
    result = [combined]`

    case 'append':
    default:
      return `// Append all items
    result = inputArrays.flatMap(arr =>
      Array.isArray(arr) ? arr : [arr]
    )`
  }
}

// ============================================
// DateTime Node Converter
// ============================================

const dateTimeConverter: NodeConverter = {
  nodeTypes: [
    'n8n-nodes-base.dateTime',
  ],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return node.type === 'n8n-nodes-base.dateTime'
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const params = node.parameters
    const action = (params.action as string) || 'format'

    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    return {
      step: {
        id: stepId,
        name: node.name,
        description: `DateTime ${action} operation`,
        type: 'auto',
        executor: 'custom',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
        executionExplanation: {
          title: 'Date/Time Processing',
          steps: [
            'Receives date input',
            `Applies ${action} transformation`,
            'Returns formatted/calculated result',
          ],
        },
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

  generateCode(node: N8nNode, context: NodeConversionContext): GeneratedCode {
    const params = node.parameters
    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    const action = (params.action as string) || 'format'
    const format = (params.format as string) || 'yyyy-MM-dd'

    const routeCode = `/**
 * API Route: ${node.name}
 * Converted from n8n DateTime node
 *
 * Action: ${action}
 * Original node type: ${node.type}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RequestBody {
  sessionId: string
  stepId: string
  input?: { date?: string | Date } | Record<string, unknown>
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

    const inputDate = input?.date ? new Date(input.date as string) : new Date()

    let result: unknown

    // Action: ${action}
    switch ('${action}') {
      case 'format':
        // Simple format - for complex formatting use date-fns
        result = inputDate.toISOString()
        break
      case 'calculate':
        // Add/subtract time
        result = inputDate.toISOString()
        break
      case 'extract':
        result = {
          year: inputDate.getFullYear(),
          month: inputDate.getMonth() + 1,
          day: inputDate.getDate(),
          hour: inputDate.getHours(),
          minute: inputDate.getMinutes(),
          weekday: inputDate.toLocaleDateString('en', { weekday: 'long' }),
        }
        break
      default:
        result = inputDate.toISOString()
    }

    return NextResponse.json({
      success: true,
      data: {
        ...input,
        result,
        originalDate: inputDate.toISOString(),
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
      envVariables: [],
    }
  },
}

// Register all transform converters
registerNodeConverter(setNodeConverter)
registerNodeConverter(codeNodeConverter)
registerNodeConverter(itemListsConverter)
registerNodeConverter(mergeNodeConverter)
registerNodeConverter(dateTimeConverter)

export {
  setNodeConverter,
  codeNodeConverter,
  itemListsConverter,
  mergeNodeConverter,
  dateTimeConverter,
}
