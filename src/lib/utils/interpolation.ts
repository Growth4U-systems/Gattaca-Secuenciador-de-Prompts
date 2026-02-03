/**
 * Utility functions for interpolating step outputs and variables in prompts
 */

/**
 * Step output record from database
 */
export interface StepOutputRecord {
  step_id: string
  output_content: string | null
  imported_data?: unknown
  status: string
}

/**
 * Interpolate step outputs in a prompt
 *
 * Replaces patterns like {{step:step-id}} with the output from that step
 *
 * @param prompt - The prompt template with {{step:step-id}} patterns
 * @param stepOutputs - Array of step output records from database
 * @returns The prompt with step outputs interpolated
 *
 * @example
 * ```
 * const prompt = "Use these findings: {{step:research}} to create a summary"
 * const outputs = [{ step_id: 'research', output_content: 'Finding 1...', status: 'completed' }]
 * const result = interpolateStepOutputs(prompt, outputs)
 * // result: "Use these findings: Finding 1... to create a summary"
 * ```
 */
export function interpolateStepOutputs(
  prompt: string,
  stepOutputs: StepOutputRecord[]
): string {
  // Regex to match {{step:step-id}} patterns
  // Captures: step-id (alphanumeric, hyphens, underscores)
  const stepPattern = /\{\{step:([a-zA-Z0-9-_]+)\}\}/g

  return prompt.replace(stepPattern, (match, stepId: string) => {
    // Find the step output by ID
    const stepOutput = stepOutputs.find(output => output.step_id === stepId)

    // If step doesn't exist, return a warning message
    if (!stepOutput) {
      console.warn(`[interpolation] Step "${stepId}" not found in outputs. Available steps:`, stepOutputs.map(s => s.step_id))
      return `[⚠️ Step "${stepId}" not found or not executed yet]`
    }

    // If step exists but isn't completed, return a warning
    if (stepOutput.status !== 'completed') {
      console.warn(`[interpolation] Step "${stepId}" has status "${stepOutput.status}", not "completed"`)
      return `[⚠️ Step "${stepId}" is ${stepOutput.status}, not completed yet]`
    }

    // Build output from both output_content and imported_data
    let result = ''

    // Add imported_data if available (structured data like arrays/objects)
    if (stepOutput.imported_data) {
      // Check if it's an array (common for scraped data)
      if (Array.isArray(stepOutput.imported_data)) {
        result += `## Datos Estructurados (${stepOutput.imported_data.length} registros)\n\n`
        result += '```json\n' + JSON.stringify(stepOutput.imported_data.slice(0, 50), null, 2) + '\n```\n'
        if (stepOutput.imported_data.length > 50) {
          result += `\n*... y ${stepOutput.imported_data.length - 50} registros más*\n\n`
        }
      } else {
        // imported_data is an object
        result += '```json\n' + JSON.stringify(stepOutput.imported_data, null, 2) + '\n```\n\n'
      }
    }

    // Add output_content (text output from LLM)
    if (stepOutput.output_content) {
      result += stepOutput.output_content
    }

    // If both are empty, return a message
    if (!result.trim()) {
      console.warn(`[interpolation] Step "${stepId}" has no output_content or imported_data`)
      return `[⚠️ Step "${stepId}" completed but has no output]`
    }

    return result
  })
}

/**
 * Detect all step references in a prompt
 *
 * Useful for validation before execution to ensure all required steps are completed
 *
 * @param prompt - The prompt template to analyze
 * @returns Array of step IDs referenced in the prompt
 *
 * @example
 * ```
 * const prompt = "Analyze {{step:research}} and {{step:data-collection}}"
 * const stepIds = detectStepReferences(prompt)
 * // stepIds: ['research', 'data-collection']
 * ```
 */
export function detectStepReferences(prompt: string): string[] {
  const stepPattern = /\{\{step:([a-zA-Z0-9-_]+)\}\}/g
  const matches = prompt.matchAll(stepPattern)
  const stepIds: string[] = []

  for (const match of matches) {
    if (match[1] && !stepIds.includes(match[1])) {
      stepIds.push(match[1])
    }
  }

  return stepIds
}

/**
 * Validate that all step references in a prompt have completed outputs
 *
 * @param prompt - The prompt template to validate
 * @param stepOutputs - Array of step output records from database
 * @returns Object with validation result and details
 *
 * @example
 * ```
 * const result = validateStepReferences(prompt, outputs)
 * if (!result.valid) {
 *   console.error('Missing steps:', result.missingSteps)
 *   console.error('Incomplete steps:', result.incompleteSteps)
 * }
 * ```
 */
export function validateStepReferences(
  prompt: string,
  stepOutputs: StepOutputRecord[]
): {
  valid: boolean
  requiredSteps: string[]
  missingSteps: string[]
  incompleteSteps: string[]
} {
  const requiredSteps = detectStepReferences(prompt)
  const missingSteps: string[] = []
  const incompleteSteps: string[] = []

  for (const stepId of requiredSteps) {
    const stepOutput = stepOutputs.find(output => output.step_id === stepId)

    if (!stepOutput) {
      missingSteps.push(stepId)
    } else if (stepOutput.status !== 'completed') {
      incompleteSteps.push(stepId)
    }
  }

  return {
    valid: missingSteps.length === 0 && incompleteSteps.length === 0,
    requiredSteps,
    missingSteps,
    incompleteSteps,
  }
}
