/**
 * n8n Expression Converter
 *
 * Converts n8n expression syntax to Gattaca state references.
 *
 * n8n Expression Syntax:
 * - {{ $json.field }}         - Current item's JSON field
 * - {{ $json["field"] }}      - Same, bracket notation
 * - {{ $node["name"].json.field }} - Output from specific node
 * - {{ $input.item.json.field }}   - Current input item
 * - {{ $now }}                - Current timestamp
 * - {{ $today }}              - Today's date
 * - {{ $if(cond, a, b) }}     - Conditional
 * - {{ $isEmpty(val) }}       - Check if empty
 * - {{ $first(array) }}       - First array item
 * - {{ $last(array) }}        - Last array item
 *
 * Gattaca State References:
 * - state.steps.stepName.output.field
 * - state.currentStep.input.field
 * - context.fieldName
 */

import { ConversionWarning } from '../types'

// ============================================
// Types
// ============================================

/**
 * Converted expression result
 */
export interface ConvertedExpression {
  /** The converted expression string */
  expression: string

  /** Whether this is a simple value (no dynamic parts) */
  isStatic: boolean

  /** Referenced node names (for dependency tracking) */
  referencedNodes: string[]

  /** Warnings during conversion */
  warnings: ConversionWarning[]

  /** Helper functions needed for this expression */
  requiredHelpers: string[]
}

/**
 * Expression context for conversion
 */
export interface ExpressionContext {
  /** Map of n8n node names to Gattaca step IDs */
  nodeToStepMap: Map<string, string>

  /** Current step ID */
  currentStepId?: string

  /** Name of the context object (default: 'context') */
  contextName?: string

  /** Name of the state object (default: 'state') */
  stateName?: string
}

// ============================================
// Expression Patterns
// ============================================

// Match n8n expression wrapper: ={{ ... }} or {{ ... }}
// Using [\s\S] instead of . with 's' flag for cross-line matching
const EXPRESSION_WRAPPER = /^=?\{\{([\s\S]+)\}\}$/

// Match $json.field or $json["field"]
const JSON_DOT_ACCESS = /\$json\.(\w+)/g
const JSON_BRACKET_ACCESS = /\$json\["([^"]+)"\]/g
const JSON_BRACKET_ACCESS_SINGLE = /\$json\['([^']+)'\]/g

// Match $node["name"].json.field
const NODE_ACCESS = /\$node\["([^"]+)"\]\.json\.(\w+)/g
const NODE_ACCESS_SINGLE = /\$node\['([^']+)'\]\.json\.(\w+)/g
const NODE_ACCESS_NESTED = /\$node\["([^"]+)"\]\.json\["([^"]+)"\]/g

// Match $input references
const INPUT_ACCESS = /\$input\.item\.json\.(\w+)/g
const INPUT_FIRST = /\$input\.first\(\)\.json\.(\w+)/g
const INPUT_LAST = /\$input\.last\(\)\.json\.(\w+)/g
const INPUT_ALL = /\$input\.all\(\)/g

// Match built-in functions
const NOW_FUNCTION = /\$now/g
const TODAY_FUNCTION = /\$today/g
const IF_FUNCTION = /\$if\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g
const IS_EMPTY_FUNCTION = /\$isEmpty\(([^)]+)\)/g
const FIRST_FUNCTION = /\$first\(([^)]+)\)/g
const LAST_FUNCTION = /\$last\(([^)]+)\)/g

// Match execution data references
const EXECUTION_ID = /\$execution\.id/g
const EXECUTION_MODE = /\$execution\.mode/g
const WORKFLOW_ID = /\$workflow\.id/g
const WORKFLOW_NAME = /\$workflow\.name/g

// ============================================
// Helper Function Definitions
// ============================================

/**
 * Helper functions to include in generated code
 */
export const HELPER_FUNCTIONS: Record<string, string> = {
  isEmpty: `
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}`,

  first: `
function first<T>(arr: T[]): T | undefined {
  return Array.isArray(arr) ? arr[0] : undefined
}`,

  last: `
function last<T>(arr: T[]): T | undefined {
  return Array.isArray(arr) ? arr[arr.length - 1] : undefined
}`,

  now: `
function now(): string {
  return new Date().toISOString()
}`,

  today: `
function today(): string {
  return new Date().toISOString().split('T')[0]
}`,
}

// ============================================
// Conversion Functions
// ============================================

/**
 * Check if a string contains n8n expressions
 */
export function containsExpression(value: string): boolean {
  return typeof value === 'string' && (
    value.includes('{{') ||
    value.includes('$json') ||
    value.includes('$node') ||
    value.includes('$input')
  )
}

/**
 * Extract the inner expression from n8n wrapper
 */
function unwrapExpression(value: string): string | null {
  const match = value.match(EXPRESSION_WRAPPER)
  if (match) {
    return match[1].trim()
  }
  // Check if it's already unwrapped but contains expressions
  if (containsExpression(value)) {
    return value
  }
  return null
}

/**
 * Convert a single n8n expression to Gattaca format
 */
export function convertExpression(
  value: string,
  context: ExpressionContext
): ConvertedExpression {
  const warnings: ConversionWarning[] = []
  const referencedNodes: string[] = []
  const requiredHelpers: string[] = []

  const stateName = context.stateName || 'state'
  const contextName = context.contextName || 'context'

  // Check if this is an expression
  const inner = unwrapExpression(value)
  if (!inner) {
    return {
      expression: JSON.stringify(value),
      isStatic: true,
      referencedNodes: [],
      warnings: [],
      requiredHelpers: [],
    }
  }

  let converted = inner

  // Convert $json.field -> state.currentStep.input.field
  converted = converted.replace(JSON_DOT_ACCESS, (_, field) => {
    return `${stateName}.currentStep?.input?.${field}`
  })

  // Convert $json["field"] -> state.currentStep.input.field
  converted = converted.replace(JSON_BRACKET_ACCESS, (_, field) => {
    return `${stateName}.currentStep?.input?.["${field}"]`
  })
  converted = converted.replace(JSON_BRACKET_ACCESS_SINGLE, (_, field) => {
    return `${stateName}.currentStep?.input?.["${field}"]`
  })

  // Convert $node["name"].json.field -> state.steps.stepId.output.field
  converted = converted.replace(NODE_ACCESS, (_, nodeName, field) => {
    const stepId = context.nodeToStepMap.get(nodeName)
    if (!stepId) {
      warnings.push({
        severity: 'warning',
        message: `Referenced node "${nodeName}" not found in conversion map`,
        suggestion: `Ensure the node is converted and mapped correctly`,
      })
      return `${contextName}["${nodeName}_output"]?.${field}`
    }
    referencedNodes.push(nodeName)
    return `${stateName}.steps?.["${stepId}"]?.output?.${field}`
  })

  converted = converted.replace(NODE_ACCESS_SINGLE, (_, nodeName, field) => {
    const stepId = context.nodeToStepMap.get(nodeName)
    if (!stepId) {
      warnings.push({
        severity: 'warning',
        message: `Referenced node "${nodeName}" not found`,
      })
      return `${contextName}["${nodeName}_output"]?.${field}`
    }
    referencedNodes.push(nodeName)
    return `${stateName}.steps?.["${stepId}"]?.output?.${field}`
  })

  converted = converted.replace(NODE_ACCESS_NESTED, (_, nodeName, field) => {
    const stepId = context.nodeToStepMap.get(nodeName)
    if (!stepId) {
      warnings.push({
        severity: 'warning',
        message: `Referenced node "${nodeName}" not found`,
      })
      return `${contextName}["${nodeName}_output"]?.["${field}"]`
    }
    referencedNodes.push(nodeName)
    return `${stateName}.steps?.["${stepId}"]?.output?.["${field}"]`
  })

  // Convert $input references
  converted = converted.replace(INPUT_ACCESS, (_, field) => {
    return `${stateName}.currentStep?.input?.${field}`
  })

  converted = converted.replace(INPUT_FIRST, (_, field) => {
    requiredHelpers.push('first')
    return `first(${stateName}.currentStep?.input)?.${field}`
  })

  converted = converted.replace(INPUT_LAST, (_, field) => {
    requiredHelpers.push('last')
    return `last(${stateName}.currentStep?.input)?.${field}`
  })

  converted = converted.replace(INPUT_ALL, () => {
    return `${stateName}.currentStep?.input`
  })

  // Convert built-in functions
  converted = converted.replace(NOW_FUNCTION, () => {
    requiredHelpers.push('now')
    return 'now()'
  })

  converted = converted.replace(TODAY_FUNCTION, () => {
    requiredHelpers.push('today')
    return 'today()'
  })

  converted = converted.replace(IF_FUNCTION, (_, condition, trueVal, falseVal) => {
    return `(${condition.trim()} ? ${trueVal.trim()} : ${falseVal.trim()})`
  })

  converted = converted.replace(IS_EMPTY_FUNCTION, (_, val) => {
    requiredHelpers.push('isEmpty')
    return `isEmpty(${val.trim()})`
  })

  converted = converted.replace(FIRST_FUNCTION, (_, val) => {
    requiredHelpers.push('first')
    return `first(${val.trim()})`
  })

  converted = converted.replace(LAST_FUNCTION, (_, val) => {
    requiredHelpers.push('last')
    return `last(${val.trim()})`
  })

  // Convert execution/workflow metadata
  converted = converted.replace(EXECUTION_ID, `${contextName}.executionId || ''`)
  converted = converted.replace(EXECUTION_MODE, `${contextName}.executionMode || 'manual'`)
  converted = converted.replace(WORKFLOW_ID, `${contextName}.playbookId || ''`)
  converted = converted.replace(WORKFLOW_NAME, `${contextName}.playbookName || ''`)

  // Check for unconverted expressions
  if (converted.includes('$')) {
    const unconvertedMatch = converted.match(/\$\w+/g)
    if (unconvertedMatch) {
      for (const uc of unconvertedMatch) {
        warnings.push({
          severity: 'warning',
          message: `Unconverted n8n expression: ${uc}`,
          suggestion: `This expression may need manual implementation`,
        })
      }
    }
  }

  return {
    expression: converted,
    isStatic: false,
    referencedNodes: [...new Set(referencedNodes)],
    warnings,
    requiredHelpers: [...new Set(requiredHelpers)],
  }
}

/**
 * Convert all expressions in an object recursively
 */
export function convertExpressionsInObject(
  obj: unknown,
  context: ExpressionContext
): {
  result: unknown
  warnings: ConversionWarning[]
  referencedNodes: string[]
  requiredHelpers: string[]
} {
  const allWarnings: ConversionWarning[] = []
  const allReferencedNodes: string[] = []
  const allRequiredHelpers: string[] = []

  function process(value: unknown): unknown {
    if (typeof value === 'string') {
      if (containsExpression(value)) {
        const converted = convertExpression(value, context)
        allWarnings.push(...converted.warnings)
        allReferencedNodes.push(...converted.referencedNodes)
        allRequiredHelpers.push(...converted.requiredHelpers)

        // Return as template literal if it's a dynamic expression
        if (!converted.isStatic) {
          return `\${${converted.expression}}`
        }
        return value
      }
      return value
    }

    if (Array.isArray(value)) {
      return value.map(process)
    }

    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value)) {
        result[k] = process(v)
      }
      return result
    }

    return value
  }

  return {
    result: process(obj),
    warnings: allWarnings,
    referencedNodes: [...new Set(allReferencedNodes)],
    requiredHelpers: [...new Set(allRequiredHelpers)],
  }
}

/**
 * Generate helper function code for the required helpers
 */
export function generateHelperCode(requiredHelpers: string[]): string {
  if (requiredHelpers.length === 0) return ''

  const helpers = requiredHelpers
    .filter(h => HELPER_FUNCTIONS[h])
    .map(h => HELPER_FUNCTIONS[h])

  if (helpers.length === 0) return ''

  return `// n8n expression helper functions\n${helpers.join('\n\n')}`
}
