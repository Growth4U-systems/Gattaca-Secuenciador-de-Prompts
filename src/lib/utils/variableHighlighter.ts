/**
 * Variable Highlighter Utility
 *
 * Parses prompt text and identifies variables for syntax highlighting.
 * Variables are classified as:
 * - valid: declared and available
 * - undeclared: used but not configured
 * - typo: similar to an existing variable (possible typo)
 * - step-reference: {{step:StepName}} references
 */

export type HighlightSegmentType =
  | 'text'
  | 'variable-valid'
  | 'variable-undeclared'
  | 'variable-typo'
  | 'variable-step-ref'
  | 'variable-error' // syntax errors like empty {{}}

export interface HighlightedSegment {
  text: string
  type: HighlightSegmentType
  variableName?: string
  suggestion?: string
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
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

// Find similar variable name for typo suggestions
function findSimilarVariable(
  varName: string,
  declaredVariables: string[]
): string | null {
  const threshold = Math.max(1, Math.floor(varName.length / 3))
  let bestMatch: string | null = null
  let bestDistance = Infinity

  for (const declared of declaredVariables) {
    const distance = levenshteinDistance(
      varName.toLowerCase(),
      declared.toLowerCase()
    )
    if (distance <= threshold && distance < bestDistance && distance > 0) {
      bestDistance = distance
      bestMatch = declared
    }
  }

  return bestMatch
}

/**
 * Parse a prompt string and return segments for highlighting
 *
 * @param prompt - The prompt text to parse
 * @param declaredVariables - Array of declared/available variable names
 * @returns Array of segments with type classification
 */
export function parsePromptForHighlighting(
  prompt: string,
  declaredVariables: string[]
): HighlightedSegment[] {
  if (!prompt) return []

  const segments: HighlightedSegment[] = []
  const declaredSet = new Set(declaredVariables.map((v) => v.trim()))

  // Combined regex to match all variable patterns
  // Matches: {{variable}}, {{step:name}}, {{}}, {{ }}
  const variableRegex = /\{\{([^}]*)\}\}/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = variableRegex.exec(prompt)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      segments.push({
        text: prompt.substring(lastIndex, match.index),
        type: 'text',
      })
    }

    const fullMatch = match[0]
    const innerContent = match[1].trim()

    // Determine the type of this variable
    let segmentType: HighlightSegmentType
    let variableName: string | undefined
    let suggestion: string | undefined

    if (!innerContent || innerContent.match(/^\s*$/)) {
      // Empty or whitespace-only variable
      segmentType = 'variable-error'
    } else if (innerContent.toLowerCase().startsWith('step:')) {
      // Step reference
      segmentType = 'variable-step-ref'
      variableName = innerContent.substring(5).trim()
    } else if (innerContent.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
      // Valid variable name format
      variableName = innerContent

      if (declaredSet.has(variableName)) {
        segmentType = 'variable-valid'
      } else {
        // Check for possible typo
        const similarVar = findSimilarVariable(variableName, declaredVariables)
        if (similarVar) {
          segmentType = 'variable-typo'
          suggestion = similarVar
        } else {
          segmentType = 'variable-undeclared'
        }
      }
    } else {
      // Invalid variable name format but has content
      segmentType = 'variable-error'
      variableName = innerContent
    }

    segments.push({
      text: fullMatch,
      type: segmentType,
      variableName,
      suggestion,
    })

    lastIndex = match.index + fullMatch.length
  }

  // Add remaining text after last match
  if (lastIndex < prompt.length) {
    segments.push({
      text: prompt.substring(lastIndex),
      type: 'text',
    })
  }

  return segments
}

/**
 * Get Tailwind CSS classes for a segment type
 */
export function getHighlightClasses(type: HighlightSegmentType): string {
  switch (type) {
    case 'variable-valid':
      return 'bg-indigo-100 text-indigo-700 rounded px-0.5'
    case 'variable-undeclared':
      return 'bg-red-100 text-red-700 rounded px-0.5'
    case 'variable-typo':
      return 'bg-amber-100 text-amber-700 rounded px-0.5 underline decoration-wavy decoration-amber-500'
    case 'variable-step-ref':
      return 'bg-purple-100 text-purple-700 rounded px-0.5'
    case 'variable-error':
      return 'bg-red-100 text-red-700 rounded px-0.5 line-through'
    case 'text':
    default:
      return ''
  }
}

/**
 * Extract all variable names from a prompt
 */
export function extractVariables(prompt: string): string[] {
  const regex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g
  const variables: string[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(prompt)) !== null) {
    const varName = match[1]
    if (!variables.includes(varName)) {
      variables.push(varName)
    }
  }

  return variables
}

/**
 * Extract step references from a prompt
 */
export function extractStepReferences(prompt: string): string[] {
  const regex = /\{\{\s*step:([^}]+)\s*\}\}/gi
  const refs: string[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(prompt)) !== null) {
    const stepName = match[1].trim()
    if (!refs.includes(stepName)) {
      refs.push(stepName)
    }
  }

  return refs
}
