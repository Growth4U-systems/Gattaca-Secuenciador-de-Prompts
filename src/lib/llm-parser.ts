/**
 * Robust LLM JSON Parser
 *
 * Handles various formats that LLMs might return when asked for JSON:
 * - Direct JSON
 * - JSON wrapped in markdown code blocks
 * - JSON with surrounding text
 * - Partial JSON extraction
 */

export interface LLMParseResult<T> {
  success: boolean
  data?: T
  error?: string
  raw?: string
}

/**
 * Parse JSON response from LLM with multiple fallback strategies
 *
 * @param output - Raw LLM output string
 * @param options - Parsing options
 * @returns Parsed result with success status
 */
export function parseLLMJsonResponse<T = unknown>(
  output: string,
  options: {
    /** Expected type: 'array' for arrays, 'object' for objects */
    expectedType?: 'array' | 'object'
    /** Truncate raw output in error response to prevent leaking sensitive data */
    truncateRaw?: number
  } = {}
): LLMParseResult<T> {
  const { expectedType = 'array', truncateRaw = 200 } = options

  if (!output || typeof output !== 'string') {
    return {
      success: false,
      error: 'Empty or invalid output',
      raw: output?.toString().slice(0, truncateRaw)
    }
  }

  let jsonStr = output.trim()

  // Strategy 1: Extract from markdown code blocks (```json ... ``` or ``` ... ```)
  const codeBlockPatterns = [
    /```json\s*([\s\S]*?)```/i,
    /```\s*([\s\S]*?)```/,
  ]

  for (const pattern of codeBlockPatterns) {
    const match = jsonStr.match(pattern)
    if (match) {
      try {
        const parsed = JSON.parse(match[1].trim())
        if (validateType(parsed, expectedType)) {
          return { success: true, data: parsed as T }
        }
      } catch {
        // Try next strategy
      }
    }
  }

  // Strategy 2: Extract array from response (find [...] pattern)
  if (expectedType === 'array') {
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0])
        if (Array.isArray(parsed)) {
          return { success: true, data: parsed as T }
        }
      } catch {
        // Try next strategy
      }
    }
  }

  // Strategy 3: Extract object from response (find {...} pattern)
  if (expectedType === 'object') {
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (objectMatch) {
      try {
        const parsed = JSON.parse(objectMatch[0])
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return { success: true, data: parsed as T }
        }
      } catch {
        // Try next strategy
      }
    }
  }

  // Strategy 4: Direct JSON parse (clean string)
  // Remove common prefixes/suffixes LLMs add
  const cleanedStr = jsonStr
    .replace(/^(Here's|Here is|The|Output:|Result:|Response:|JSON:)\s*/i, '')
    .replace(/^[^[{]*/, '') // Remove text before first [ or {
    .replace(/[}\]]\s*[^}\]]*$/, (match) => match[0]) // Remove text after last ] or }
    .trim()

  try {
    const parsed = JSON.parse(cleanedStr)
    if (validateType(parsed, expectedType)) {
      return { success: true, data: parsed as T }
    }
  } catch {
    // Continue to final strategy
  }

  // Strategy 5: Try parsing with relaxed JSON (common LLM errors)
  try {
    // Fix common issues: trailing commas, single quotes
    const fixedStr = jsonStr
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/'/g, '"') // Convert single quotes to double
      .replace(/(\w+):/g, '"$1":') // Quote unquoted keys

    const parsed = JSON.parse(fixedStr)
    if (validateType(parsed, expectedType)) {
      return { success: true, data: parsed as T }
    }
  } catch {
    // Final fallback
  }

  // All strategies failed
  return {
    success: false,
    error: `Could not parse ${expectedType} from LLM response`,
    raw: output.slice(0, truncateRaw) + (output.length > truncateRaw ? '...' : '')
  }
}

/**
 * Parse array response from LLM (convenience wrapper)
 */
export function parseLLMArrayResponse<T = string[]>(
  output: string,
  options?: { truncateRaw?: number }
): LLMParseResult<T> {
  return parseLLMJsonResponse<T>(output, { ...options, expectedType: 'array' })
}

/**
 * Parse object response from LLM (convenience wrapper)
 */
export function parseLLMObjectResponse<T = Record<string, unknown>>(
  output: string,
  options?: { truncateRaw?: number }
): LLMParseResult<T> {
  return parseLLMJsonResponse<T>(output, { ...options, expectedType: 'object' })
}

/**
 * Validate parsed value matches expected type
 */
function validateType(value: unknown, expectedType: 'array' | 'object'): boolean {
  if (expectedType === 'array') {
    return Array.isArray(value)
  }
  if (expectedType === 'object') {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
  return false
}

/**
 * Extract specific fields from LLM response that might be wrapped in various formats
 * Useful when LLM returns {suggestions: [...]} instead of just [...]
 */
export function extractFieldFromLLMResponse<T>(
  output: string,
  fieldNames: string[],
  options?: { truncateRaw?: number }
): LLMParseResult<T> {
  // First try to parse as object
  const objectResult = parseLLMObjectResponse<Record<string, unknown>>(output, options)

  if (objectResult.success && objectResult.data) {
    // Look for any of the specified field names
    for (const fieldName of fieldNames) {
      if (fieldName in objectResult.data) {
        return { success: true, data: objectResult.data[fieldName] as T }
      }
    }
  }

  // Fallback: try as array directly
  const arrayResult = parseLLMArrayResponse<T>(output, options)
  if (arrayResult.success) {
    return arrayResult
  }

  return {
    success: false,
    error: `Could not extract fields [${fieldNames.join(', ')}] from response`,
    raw: output.slice(0, options?.truncateRaw ?? 200)
  }
}
