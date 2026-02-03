/**
 * Variable Extractor Utility
 *
 * Extracts variables from prompts in the format {{variable_name}}
 * Used to auto-populate variable definitions from playbook steps.
 */

export interface ExtractedVariable {
  name: string
  default_value: string
  description: string
  required: boolean
}

/**
 * Extract all unique variable names from a prompt string.
 * Variables must be in the format {{variable_name}}
 *
 * Excludes special patterns like:
 * - {{step:step_id}} - step references
 * - {{#if ...}} / {{/if}} - conditionals
 * - {{previous_step_output}} - built-in variable
 *
 * @param prompt - The prompt string to extract variables from
 * @returns Array of unique variable names
 */
export function extractVariablesFromPrompt(prompt: string): string[] {
  if (!prompt) return []

  // Match {{variable_name}} but not special patterns
  const variableRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g
  const matches = new Set<string>()

  let match
  while ((match = variableRegex.exec(prompt)) !== null) {
    const varName = match[1]

    // Skip special built-in variables and patterns
    const skipPatterns = [
      'previous_step_output',
      'step', // Part of {{step:...}}
      'if', 'endif', 'else', 'unless', // Conditionals
    ]

    // Skip if it's a step reference pattern like {{step:step_id}}
    if (prompt.substring(match.index).startsWith('{{step:')) {
      continue
    }

    // Skip conditional patterns
    if (prompt.substring(match.index).match(/^\{\{#?(?:if|endif|else|unless)/i)) {
      continue
    }

    if (!skipPatterns.includes(varName.toLowerCase())) {
      matches.add(varName)
    }
  }

  return Array.from(matches).sort()
}

/**
 * Extract variables from all steps in a flow config.
 *
 * @param flowConfig - The flow config containing steps with prompts
 * @returns Array of unique ExtractedVariable objects
 */
export function extractVariablesFromFlowConfig(flowConfig: {
  steps?: Array<{ prompt?: string }>
}): ExtractedVariable[] {
  if (!flowConfig?.steps) return []

  const allVariables = new Set<string>()

  // Extract from each step's prompt
  for (const step of flowConfig.steps) {
    if (step.prompt) {
      const vars = extractVariablesFromPrompt(step.prompt)
      vars.forEach(v => allVariables.add(v))
    }
  }

  // Convert to ExtractedVariable format
  return Array.from(allVariables).sort().map(name => ({
    name,
    default_value: '',
    description: '',
    required: true,
  }))
}

/**
 * Extract variables from a playbook config (including phases and steps).
 *
 * @param playbookConfig - The playbook config
 * @returns Array of unique ExtractedVariable objects
 */
export function extractVariablesFromPlaybookConfig(playbookConfig: {
  flow_config?: { steps?: Array<{ prompt?: string }> }
  phases?: Array<{
    steps?: Array<{ prompt?: string }>
  }>
}): ExtractedVariable[] {
  const allVariables = new Set<string>()

  // Extract from flow_config steps
  if (playbookConfig.flow_config?.steps) {
    for (const step of playbookConfig.flow_config.steps) {
      if (step.prompt) {
        const vars = extractVariablesFromPrompt(step.prompt)
        vars.forEach(v => allVariables.add(v))
      }
    }
  }

  // Extract from phases/steps
  if (playbookConfig.phases) {
    for (const phase of playbookConfig.phases) {
      if (phase.steps) {
        for (const step of phase.steps) {
          if ((step as any).prompt) {
            const vars = extractVariablesFromPrompt((step as any).prompt)
            vars.forEach(v => allVariables.add(v))
          }
        }
      }
    }
  }

  // Convert to ExtractedVariable format
  return Array.from(allVariables).sort().map(name => ({
    name,
    default_value: '',
    description: '',
    required: true,
  }))
}

/**
 * Merge extracted variables with existing variable definitions.
 * Preserves existing values/descriptions while adding new variables.
 *
 * @param extracted - Variables extracted from prompts
 * @param existing - Existing variable definitions
 * @returns Merged array with all variables
 */
export function mergeVariableDefinitions(
  extracted: ExtractedVariable[],
  existing: ExtractedVariable[]
): ExtractedVariable[] {
  const existingMap = new Map(existing.map(v => [v.name, v]))

  return extracted.map(v => {
    const existingVar = existingMap.get(v.name)
    if (existingVar) {
      // Preserve existing values
      return existingVar
    }
    return v
  })
}
