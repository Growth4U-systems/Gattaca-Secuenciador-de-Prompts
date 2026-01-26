/**
 * Logic Node Converters
 *
 * Converts n8n IF and Switch nodes to Gattaca decision steps.
 * These become 'decision' type steps with branch routing.
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
// IF Node Converter
// ============================================

const ifNodeConverter: NodeConverter = {
  nodeTypes: [
    'n8n-nodes-base.if',
    'n8n-nodes-base.ifV2',
  ],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return this.nodeTypes.some(t => node.type === t || node.type.endsWith('.if'))
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const params = node.parameters
    const warnings: ConvertedStep['warnings'] = []

    // Parse conditions
    const conditions = params.conditions as {
      string?: Array<{ value1?: string; operation?: string; value2?: string }>
      number?: Array<{ value1?: string; operation?: string; value2?: string }>
      boolean?: Array<{ value1?: string; operation?: string; value2?: string }>
    } | undefined

    // Get first condition for description
    const allConditions = [
      ...(conditions?.string || []),
      ...(conditions?.number || []),
      ...(conditions?.boolean || []),
    ]
    const firstCondition = allConditions[0]

    let conditionDesc = 'Evaluate condition'
    if (firstCondition) {
      const v1 = firstCondition.value1 || ''
      const op = firstCondition.operation || 'equals'
      const v2 = firstCondition.value2 || ''
      conditionDesc = `If ${v1} ${op} ${v2}`
    }

    // Check for dynamic values
    if (firstCondition && containsExpression(firstCondition.value1 || '')) {
      warnings.push({
        severity: 'info',
        message: 'IF condition uses dynamic expression',
        nodeId: node.id,
      })
    }

    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    return {
      step: {
        id: stepId,
        name: node.name,
        description: conditionDesc,
        type: 'decision',
        executor: 'custom',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
        executionExplanation: {
          title: 'Conditional Branch',
          steps: [
            'Evaluates condition against input data',
            'Routes to TRUE branch if condition matches',
            'Routes to FALSE branch otherwise',
          ],
        },
        decisionConfig: {
          question: conditionDesc,
          optionsFrom: 'fixed' as const,
          fixedOptions: [
            { id: 'true', label: 'True' },
            { id: 'false', label: 'False' },
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

    // Extract conditions
    const conditions = params.conditions as {
      string?: Array<{ value1?: string; operation?: string; value2?: string }>
      number?: Array<{ value1?: string; operation?: string; value2?: string }>
      boolean?: Array<{ value1?: string; operation?: string; value2?: string }>
    } | undefined

    const combineWith = (params.combineWith as string) || 'and'

    const allConditions = [
      ...(conditions?.string || []).map(c => ({ ...c, type: 'string' })),
      ...(conditions?.number || []).map(c => ({ ...c, type: 'number' })),
      ...(conditions?.boolean || []).map(c => ({ ...c, type: 'boolean' })),
    ]

    const routeCode = `/**
 * API Route: ${node.name}
 * Converted from n8n IF node
 *
 * Condition logic: ${combineWith.toUpperCase()} of ${allConditions.length} condition(s)
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

// Condition evaluation helpers
function evaluateCondition(
  value1: unknown,
  operation: string,
  value2: unknown,
  type: string
): boolean {
  // Coerce types as needed
  const v1 = type === 'number' ? Number(value1) : String(value1)
  const v2 = type === 'number' ? Number(value2) : String(value2)

  switch (operation) {
    case 'equals':
    case 'equal':
      return v1 === v2
    case 'notEquals':
    case 'notEqual':
      return v1 !== v2
    case 'contains':
      return String(v1).includes(String(v2))
    case 'notContains':
      return !String(v1).includes(String(v2))
    case 'startsWith':
      return String(v1).startsWith(String(v2))
    case 'endsWith':
      return String(v1).endsWith(String(v2))
    case 'larger':
      return Number(v1) > Number(v2)
    case 'smaller':
      return Number(v1) < Number(v2)
    case 'largerEqual':
      return Number(v1) >= Number(v2)
    case 'smallerEqual':
      return Number(v1) <= Number(v2)
    case 'isEmpty':
      return v1 === '' || v1 === null || v1 === undefined
    case 'isNotEmpty':
      return v1 !== '' && v1 !== null && v1 !== undefined
    case 'isTrue':
      return Boolean(v1) === true
    case 'isFalse':
      return Boolean(v1) === false
    case 'regex':
      return new RegExp(String(v2)).test(String(v1))
    default:
      return false
  }
}

function resolveValue(expr: string, state: Record<string, unknown>): unknown {
  // Simple expression resolver for common patterns
  if (!expr || !expr.includes('{{')) return expr

  // Extract expression content
  const match = expr.match(/\\{\\{\\s*(.+?)\\s*\\}\\}/)
  if (!match) return expr

  const path = match[1]

  // Handle $json.field pattern
  if (path.startsWith('$json.')) {
    const field = path.replace('$json.', '')
    return (state.input as Record<string, unknown>)?.[field]
  }

  // Handle $node["name"].json.field pattern
  const nodeMatch = path.match(/\\$node\\["([^"]+)"\\]\\.json\\.(.+)/)
  if (nodeMatch) {
    const [, nodeName, field] = nodeMatch
    const nodeId = nodeName.toLowerCase().replace(/\\s+/g, '_')
    return ((state.steps as Record<string, unknown>)?.[nodeId] as Record<string, unknown>)?.output?.[field]
  }

  return expr
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

    const state = { input, steps: context }

    // Evaluate all conditions
    const conditions = ${JSON.stringify(allConditions)}
    const results = conditions.map((cond: { value1?: string; operation?: string; value2?: string; type?: string }) => {
      const v1 = resolveValue(cond.value1 || '', state)
      const v2 = resolveValue(cond.value2 || '', state)
      return evaluateCondition(v1, cond.operation || 'equals', v2, cond.type || 'string')
    })

    // Combine results
    const combinedResult = '${combineWith}' === 'and'
      ? results.every(Boolean)
      : results.some(Boolean)

    return NextResponse.json({
      success: true,
      data: {
        result: combinedResult,
        branch: combinedResult ? 'true' : 'false',
        input,
      },
      metadata: {
        conditions: results.map((r, i) => ({
          index: i,
          result: r,
        })),
        combineWith: '${combineWith}',
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

// ============================================
// Switch Node Converter
// ============================================

const switchNodeConverter: NodeConverter = {
  nodeTypes: [
    'n8n-nodes-base.switch',
  ],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return node.type === 'n8n-nodes-base.switch' || node.type.endsWith('.switch')
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const params = node.parameters
    const warnings: ConvertedStep['warnings'] = []

    const mode = (params.mode as string) || 'rules'
    const rules = (params.rules as { rules?: Array<{ value?: unknown; operation?: string }> })?.rules || []

    // Check for complex rules
    if (rules.length > 5) {
      warnings.push({
        severity: 'info',
        message: `Switch has ${rules.length} cases. Consider simplifying if possible.`,
        nodeId: node.id,
      })
    }

    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    // Build decision options from rules
    const fixedOptions = rules.map((rule, index) => ({
      id: `case_${index}`,
      label: `Case: ${rule.value || index}`,
    }))

    // Add default option
    fixedOptions.push({
      id: 'default',
      label: 'Default',
    })

    return {
      step: {
        id: stepId,
        name: node.name,
        description: `Switch with ${rules.length} case(s)`,
        type: 'decision',
        executor: 'custom',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
        executionExplanation: {
          title: 'Multi-way Branch',
          steps: [
            'Evaluates input against multiple conditions',
            `Checks ${rules.length} case(s) in order`,
            'Routes to first matching case or default',
          ],
        },
        decisionConfig: {
          question: `Which case matches the input?`,
          optionsFrom: 'fixed' as const,
          fixedOptions,
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

    const mode = (params.mode as string) || 'rules'
    const dataType = (params.dataType as string) || 'string'
    const rules = (params.rules as { rules?: Array<{ value?: unknown; operation?: string }> })?.rules || []
    const fallbackOutput = (params.fallbackOutput as number) ?? rules.length

    const routeCode = `/**
 * API Route: ${node.name}
 * Converted from n8n Switch node
 *
 * Mode: ${mode}
 * Data type: ${dataType}
 * Cases: ${rules.length}
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

function evaluateRule(
  inputValue: unknown,
  operation: string,
  ruleValue: unknown,
  dataType: string
): boolean {
  const v1 = dataType === 'number' ? Number(inputValue) : String(inputValue)
  const v2 = dataType === 'number' ? Number(ruleValue) : String(ruleValue)

  switch (operation) {
    case 'equals':
    case 'equal':
      return v1 === v2
    case 'notEquals':
    case 'notEqual':
      return v1 !== v2
    case 'contains':
      return String(v1).includes(String(v2))
    case 'startsWith':
      return String(v1).startsWith(String(v2))
    case 'endsWith':
      return String(v1).endsWith(String(v2))
    case 'larger':
      return Number(v1) > Number(v2)
    case 'smaller':
      return Number(v1) < Number(v2)
    case 'regex':
      return new RegExp(String(v2)).test(String(v1))
    default:
      return v1 === v2
  }
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

    // Get the value to switch on
    // TODO: Configure which input field to switch on
    const switchValue = input?.value ?? input

    // Define rules
    const rules = ${JSON.stringify(rules)}
    const dataType = '${dataType}'

    // Evaluate rules in order
    let matchedCase = -1
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i] as { value?: unknown; operation?: string }
      if (evaluateRule(switchValue, rule.operation || 'equals', rule.value, dataType)) {
        matchedCase = i
        break
      }
    }

    // Use fallback if no match
    const outputIndex = matchedCase >= 0 ? matchedCase : ${fallbackOutput}
    const branch = matchedCase >= 0 ? \`case_\${matchedCase}\` : 'default'

    return NextResponse.json({
      success: true,
      data: {
        branch,
        outputIndex,
        input,
      },
      metadata: {
        switchValue,
        matchedCase,
        totalCases: rules.length,
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

// ============================================
// Filter Node Converter
// ============================================

const filterNodeConverter: NodeConverter = {
  nodeTypes: [
    'n8n-nodes-base.filter',
  ],
  priority: 10,

  canConvert(node: N8nNode): boolean {
    return node.type === 'n8n-nodes-base.filter'
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    const params = node.parameters
    const warnings: ConvertedStep['warnings'] = []

    const stepId = node.name.toLowerCase().replace(/\s+/g, '_')

    return {
      step: {
        id: stepId,
        name: node.name,
        description: 'Filter items based on condition',
        type: 'auto',
        executor: 'custom',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
        executionExplanation: {
          title: 'Data Filter',
          steps: [
            'Receives array of items',
            'Evaluates filter condition on each item',
            'Returns only matching items',
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

    const conditions = params.conditions as {
      string?: Array<{ value1?: string; operation?: string; value2?: string }>
      number?: Array<{ value1?: string; operation?: string; value2?: string }>
    } | undefined

    const combineWith = (params.combineWith as string) || 'and'

    const allConditions = [
      ...(conditions?.string || []).map(c => ({ ...c, type: 'string' })),
      ...(conditions?.number || []).map(c => ({ ...c, type: 'number' })),
    ]

    const routeCode = `/**
 * API Route: ${node.name}
 * Converted from n8n Filter node
 *
 * Filter conditions: ${allConditions.length}
 * Combine: ${combineWith}
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

function evaluateCondition(
  item: Record<string, unknown>,
  field: string,
  operation: string,
  compareValue: unknown,
  type: string
): boolean {
  const itemValue = item[field]
  const v1 = type === 'number' ? Number(itemValue) : String(itemValue ?? '')
  const v2 = type === 'number' ? Number(compareValue) : String(compareValue ?? '')

  switch (operation) {
    case 'equals':
      return v1 === v2
    case 'notEquals':
      return v1 !== v2
    case 'contains':
      return String(v1).includes(String(v2))
    case 'notContains':
      return !String(v1).includes(String(v2))
    case 'larger':
      return Number(v1) > Number(v2)
    case 'smaller':
      return Number(v1) < Number(v2)
    case 'isEmpty':
      return v1 === '' || itemValue === null || itemValue === undefined
    case 'isNotEmpty':
      return v1 !== '' && itemValue !== null && itemValue !== undefined
    default:
      return v1 === v2
  }
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

    const conditions = ${JSON.stringify(allConditions)}
    const combineWith = '${combineWith}'

    // Filter items
    const filtered = items.filter(item => {
      if (!item || typeof item !== 'object') return false

      const results = conditions.map((cond: { value1?: string; operation?: string; value2?: string; type?: string }) => {
        // value1 is typically the field name
        const field = cond.value1?.replace(/\\{\\{\\$json\\.([^}]+)\\}\\}/g, '$1') || ''
        return evaluateCondition(
          item as Record<string, unknown>,
          field,
          cond.operation || 'equals',
          cond.value2,
          cond.type || 'string'
        )
      })

      return combineWith === 'and'
        ? results.every(Boolean)
        : results.some(Boolean)
    })

    return NextResponse.json({
      success: true,
      data: filtered,
      metadata: {
        inputCount: items.length,
        outputCount: filtered.length,
        filteredOut: items.length - filtered.length,
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

// Register all logic converters
registerNodeConverter(ifNodeConverter)
registerNodeConverter(switchNodeConverter)
registerNodeConverter(filterNodeConverter)

export {
  ifNodeConverter,
  switchNodeConverter,
  filterNodeConverter,
}
