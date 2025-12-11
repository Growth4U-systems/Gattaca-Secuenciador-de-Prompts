import { useMemo } from 'react'

/**
 * Prompt Validator Hook
 *
 * Validates prompt templates against configured variables and detects various issues:
 * - Undeclared variables (used in prompt but not configured)
 * - Unused variables (configured but not used in prompt)
 * - Syntax errors (malformed variable syntax)
 * - Empty variables
 * - Possible typos (similar to existing variables)
 * - Invalid step references
 */

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  type:
    | 'undeclared_variable'      // Variable used but not configured
    | 'unused_variable'          // Variable configured but not used
    | 'syntax_error'            // Malformed variable syntax
    | 'empty_variable'          // Empty {{}}
    | 'possible_typo'           // Similar to an existing variable
    | 'invalid_step_reference'  // Reference to non-existent step
    | 'unclosed_bracket'        // {{ without closing }}
    | 'whitespace_only'         // Variable with only whitespace
  severity: ValidationSeverity
  message: string
  variable?: string
  suggestion?: string
  position?: { start: number; end: number }
}

export interface ValidationResult {
  isValid: boolean
  issues: ValidationIssue[]
  usedVariables: string[]
  declaredVariables: string[]
  stats: {
    totalVariablesUsed: number
    totalVariablesDeclared: number
    undeclaredCount: number
    unusedCount: number
    errorCount: number
    warningCount: number
  }
}

interface UsePromptValidatorProps {
  prompt: string
  declaredVariables: string[] // All configured/available variables
  availableSteps?: Array<{ id: string; name: string }> // For step reference validation
}

// Calculate Levenshtein distance for typo detection
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

// Find similar variable name for typo suggestions
function findSimilarVariable(varName: string, declaredVariables: string[]): string | null {
  const threshold = Math.max(1, Math.floor(varName.length / 3)) // Allow up to 1/3 of length as errors
  let bestMatch: string | null = null
  let bestDistance = Infinity

  for (const declared of declaredVariables) {
    const distance = levenshteinDistance(varName.toLowerCase(), declared.toLowerCase())
    if (distance <= threshold && distance < bestDistance && distance > 0) {
      bestDistance = distance
      bestMatch = declared
    }
  }

  return bestMatch
}

export function usePromptValidator({
  prompt,
  declaredVariables,
  availableSteps = [],
}: UsePromptValidatorProps): ValidationResult {
  return useMemo(() => {
    const issues: ValidationIssue[] = []
    const usedVariables = new Set<string>()
    const declaredSet = new Set(declaredVariables)

    // ==========================================
    // 1. Extract all properly formatted variables {{ variable }}
    // ==========================================
    const validVariableRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g
    let match: RegExpExecArray | null

    while ((match = validVariableRegex.exec(prompt)) !== null) {
      const varName = match[1]
      usedVariables.add(varName)

      // Check if variable is declared
      if (!declaredSet.has(varName)) {
        // Check for possible typo
        const similarVar = findSimilarVariable(varName, declaredVariables)

        if (similarVar) {
          issues.push({
            type: 'possible_typo',
            severity: 'warning',
            message: `Variable "{{${varName}}}" no está declarada. ¿Quisiste decir "{{${similarVar}}}"?`,
            variable: varName,
            suggestion: similarVar,
            position: { start: match.index, end: match.index + match[0].length }
          })
        } else {
          issues.push({
            type: 'undeclared_variable',
            severity: 'error',
            message: `Variable "{{${varName}}}" no está declarada en la configuración de variables`,
            variable: varName,
            position: { start: match.index, end: match.index + match[0].length }
          })
        }
      }
    }

    // ==========================================
    // 2. Check for syntax errors - single braces {variable}
    // ==========================================
    const singleBraceRegex = /(?<!\{)\{([a-zA-Z_][a-zA-Z0-9_]*)\}(?!\})/g
    while ((match = singleBraceRegex.exec(prompt)) !== null) {
      issues.push({
        type: 'syntax_error',
        severity: 'error',
        message: `Sintaxis incorrecta: "{${match[1]}}" debería ser "{{${match[1]}}}" (doble llave)`,
        variable: match[1],
        suggestion: `{{${match[1]}}}`,
        position: { start: match.index, end: match.index + match[0].length }
      })
    }

    // ==========================================
    // 3. Check for empty variables {{ }}
    // ==========================================
    const emptyVariableRegex = /\{\{\s*\}\}/g
    while ((match = emptyVariableRegex.exec(prompt)) !== null) {
      issues.push({
        type: 'empty_variable',
        severity: 'error',
        message: 'Variable vacía detectada: "{{ }}" - especifica un nombre de variable',
        position: { start: match.index, end: match.index + match[0].length }
      })
    }

    // ==========================================
    // 4. Check for whitespace-only variables {{ \n }}
    // ==========================================
    const whitespaceOnlyRegex = /\{\{[\s\n\r\t]+\}\}/g
    while ((match = whitespaceOnlyRegex.exec(prompt)) !== null) {
      issues.push({
        type: 'whitespace_only',
        severity: 'error',
        message: 'Variable con solo espacios en blanco detectada - especifica un nombre válido',
        position: { start: match.index, end: match.index + match[0].length }
      })
    }

    // ==========================================
    // 5. Check for unclosed brackets {{ without }}
    // ==========================================
    const openBracketRegex = /\{\{(?![^{}]*\}\})/g
    while ((match = openBracketRegex.exec(prompt)) !== null) {
      // Verify this isn't a valid variable
      const afterOpen = prompt.substring(match.index)
      if (!afterOpen.match(/^\{\{[^{}]*\}\}/)) {
        issues.push({
          type: 'unclosed_bracket',
          severity: 'error',
          message: 'Llave de apertura "{{" sin cierre "}}" correspondiente',
          position: { start: match.index, end: match.index + 2 }
        })
      }
    }

    // ==========================================
    // 6. Check for step references (special pattern: {{step:StepName}})
    // ==========================================
    const stepRefRegex = /\{\{\s*step:([^}]+)\s*\}\}/gi
    while ((match = stepRefRegex.exec(prompt)) !== null) {
      const stepName = match[1].trim()
      const stepExists = availableSteps.some(
        s => s.name.toLowerCase() === stepName.toLowerCase() || s.id === stepName
      )

      if (!stepExists && availableSteps.length > 0) {
        issues.push({
          type: 'invalid_step_reference',
          severity: 'warning',
          message: `Referencia a paso "{{step:${stepName}}}" no encontrada. Pasos disponibles: ${availableSteps.map(s => s.name).join(', ')}`,
          variable: `step:${stepName}`,
          position: { start: match.index, end: match.index + match[0].length }
        })
      }
    }

    // ==========================================
    // 7. Check for unused declared variables
    // ==========================================
    const unusedVariables = declaredVariables.filter(v => !usedVariables.has(v))
    for (const unused of unusedVariables) {
      // Skip base variables as they might be used in other steps
      const baseVariables = ['ecp_name', 'problem_core', 'country', 'industry', 'client_name']
      if (!baseVariables.includes(unused)) {
        issues.push({
          type: 'unused_variable',
          severity: 'info',
          message: `Variable "{{${unused}}}" está declarada pero no se usa en este prompt`,
          variable: unused
        })
      }
    }

    // ==========================================
    // Calculate statistics
    // ==========================================
    const errorCount = issues.filter(i => i.severity === 'error').length
    const warningCount = issues.filter(i => i.severity === 'warning').length
    const undeclaredCount = issues.filter(i =>
      i.type === 'undeclared_variable' || i.type === 'possible_typo'
    ).length
    const unusedCount = issues.filter(i => i.type === 'unused_variable').length

    return {
      isValid: errorCount === 0,
      issues: issues.sort((a, b) => {
        // Sort by severity: error > warning > info
        const severityOrder = { error: 0, warning: 1, info: 2 }
        return severityOrder[a.severity] - severityOrder[b.severity]
      }),
      usedVariables: Array.from(usedVariables),
      declaredVariables,
      stats: {
        totalVariablesUsed: usedVariables.size,
        totalVariablesDeclared: declaredVariables.length,
        undeclaredCount,
        unusedCount,
        errorCount,
        warningCount
      }
    }
  }, [prompt, declaredVariables, availableSteps])
}

// Utility function to get severity color classes
export function getSeverityClasses(severity: ValidationSeverity): {
  bg: string
  text: string
  border: string
  icon: string
} {
  switch (severity) {
    case 'error':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        icon: 'text-red-500'
      }
    case 'warning':
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
        icon: 'text-yellow-500'
      }
    case 'info':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: 'text-blue-500'
      }
  }
}
