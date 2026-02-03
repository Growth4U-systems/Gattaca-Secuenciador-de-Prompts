/**
 * Document Naming Convention Validator
 *
 * Validates document filenames against the recommended naming convention:
 * {Fuente} - {Objetivo} - {YYYY-MM-DD}
 *
 * Examples:
 * - "Website Content - Acme Corp - 2026-02-03"
 * - "Trustpilot Reviews - Competitor X - 2026-01-15"
 * - "LinkedIn Posts - Mi Empresa - 2026-02-01"
 */

export type DocumentNameIssueSeverity = 'warning' | 'info'

export type DocumentNameIssueType =
  | 'missing_source'
  | 'missing_target'
  | 'missing_date'
  | 'invalid_date_format'
  | 'wrong_separator'
  | 'too_many_parts'
  | 'file_extension_in_name'

export interface DocumentNameIssue {
  type: DocumentNameIssueType
  severity: DocumentNameIssueSeverity
  message: string
}

export interface ParsedDocumentName {
  source?: string
  target?: string
  date?: string
}

export interface DocumentNameValidation {
  isValid: boolean
  parsedParts: ParsedDocumentName
  issues: DocumentNameIssue[]
  suggestedName?: string
  confidence: 'high' | 'medium' | 'low'
}

// Common source types (in Spanish for display)
export const KNOWN_SOURCES: Record<string, string> = {
  website: 'Website Content',
  trustpilot: 'Trustpilot Reviews',
  instagram: 'Instagram Posts',
  instagram_comments: 'Instagram Comments',
  facebook: 'Facebook Posts',
  facebook_comments: 'Facebook Comments',
  linkedin: 'LinkedIn Posts',
  linkedin_comments: 'LinkedIn Comments',
  youtube: 'YouTube Videos',
  youtube_comments: 'YouTube Comments',
  youtube_transcripts: 'YouTube Transcripts',
  tiktok: 'TikTok Posts',
  tiktok_comments: 'TikTok Comments',
  g2_reviews: 'G2 Reviews',
  capterra_reviews: 'Capterra Reviews',
  app_store: 'App Store Reviews',
  play_store: 'Play Store Reviews',
  google_maps: 'Google Maps Reviews',
  seo_serp: 'SEO SERP Data',
  seo_keywords: 'SEO Keywords',
  deep_research: 'Deep Research',
  news: 'News Articles',
  manual: 'Manual Document',
}

// Pattern: {Source} - {Target} - {YYYY-MM-DD}
const FULL_PATTERN = /^(.+?)\s*-\s*(.+?)\s*-\s*(\d{4}-\d{2}-\d{2})$/
const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/
const FILE_EXTENSION_PATTERN = /\.(pdf|docx?|txt|md|csv|json|xlsx?)$/i

/**
 * Parse a document filename to extract its parts
 */
export function parseDocumentName(filename: string): ParsedDocumentName {
  // Remove file extension if present
  const cleanName = filename.replace(FILE_EXTENSION_PATTERN, '').trim()

  const match = cleanName.match(FULL_PATTERN)
  if (match) {
    return {
      source: match[1].trim(),
      target: match[2].trim(),
      date: match[3],
    }
  }

  // Try partial parsing
  const parts = cleanName.split(/\s*-\s*/)

  if (parts.length >= 3) {
    // Check if last part is a date
    const lastPart = parts[parts.length - 1]
    if (DATE_PATTERN.test(lastPart)) {
      return {
        source: parts[0],
        target: parts.slice(1, -1).join(' - '),
        date: lastPart,
      }
    }
  }

  if (parts.length === 2) {
    // Could be Source - Target (missing date)
    return {
      source: parts[0],
      target: parts[1],
    }
  }

  // Single part - assume it's the target/filename
  return {
    target: cleanName,
  }
}

/**
 * Validate a document filename against the naming convention
 */
export function validateDocumentName(filename: string): DocumentNameValidation {
  const issues: DocumentNameIssue[] = []
  const cleanName = filename.replace(FILE_EXTENSION_PATTERN, '').trim()

  // Check for file extension in the display name (unusual)
  if (FILE_EXTENSION_PATTERN.test(filename)) {
    issues.push({
      type: 'file_extension_in_name',
      severity: 'info',
      message: 'La extensión del archivo no es necesaria en el nombre',
    })
  }

  const parsed = parseDocumentName(filename)
  const parts = cleanName.split(/\s*-\s*/)

  // Check for wrong separator (underscore, dot, etc.)
  if (cleanName.includes('_') && !cleanName.includes(' - ')) {
    issues.push({
      type: 'wrong_separator',
      severity: 'warning',
      message: 'Usa " - " (guión con espacios) como separador en lugar de "_"',
    })
  }

  // Check for missing source
  if (!parsed.source) {
    issues.push({
      type: 'missing_source',
      severity: 'warning',
      message: 'Falta el tipo de fuente (ej: "Website Content", "Trustpilot Reviews")',
    })
  }

  // Check for missing target
  if (!parsed.target) {
    issues.push({
      type: 'missing_target',
      severity: 'warning',
      message: 'Falta el nombre del objetivo/competidor',
    })
  }

  // Check for missing date
  if (!parsed.date) {
    issues.push({
      type: 'missing_date',
      severity: 'warning',
      message: 'Falta la fecha en formato YYYY-MM-DD',
    })
  } else {
    // Validate date format
    const dateMatch = parsed.date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateMatch) {
      const year = parseInt(dateMatch[1], 10)
      const month = parseInt(dateMatch[2], 10)
      const day = parseInt(dateMatch[3], 10)

      if (month < 1 || month > 12 || day < 1 || day > 31) {
        issues.push({
          type: 'invalid_date_format',
          severity: 'warning',
          message: 'La fecha parece inválida (mes o día fuera de rango)',
        })
      }

      // Check for reasonable year range (2020-2030)
      if (year < 2020 || year > 2030) {
        issues.push({
          type: 'invalid_date_format',
          severity: 'info',
          message: 'El año parece inusual para un documento reciente',
        })
      }
    }
  }

  // Check for too many parts
  if (parts.length > 4) {
    issues.push({
      type: 'too_many_parts',
      severity: 'info',
      message: 'El nombre tiene muchas partes. Formato recomendado: Fuente - Objetivo - Fecha',
    })
  }

  // Determine validity and confidence
  const isValid = issues.filter((i) => i.severity === 'warning').length === 0
  const warningCount = issues.filter((i) => i.severity === 'warning').length

  let confidence: 'high' | 'medium' | 'low'
  if (warningCount === 0) {
    confidence = 'high'
  } else if (warningCount <= 1) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  // Generate suggestion if not valid
  let suggestedName: string | undefined
  if (!isValid) {
    suggestedName = suggestDocumentName(
      parsed.source || detectSourceFromName(cleanName) || 'Documento',
      parsed.target || extractTargetFromName(cleanName) || 'Sin nombre'
    )
  }

  return {
    isValid,
    parsedParts: parsed,
    issues,
    suggestedName,
    confidence,
  }
}

/**
 * Generate a suggested document name following the convention
 */
export function suggestDocumentName(
  source: string,
  target: string,
  date?: Date
): string {
  const dateStr = formatDate(date || new Date())
  return `${source} - ${target} - ${dateStr}`
}

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Try to detect the source type from a filename
 */
function detectSourceFromName(name: string): string | null {
  const lowerName = name.toLowerCase()

  for (const [key, label] of Object.entries(KNOWN_SOURCES)) {
    if (
      lowerName.includes(key.replace('_', ' ')) ||
      lowerName.includes(key.replace('_', '')) ||
      lowerName.includes(label.toLowerCase())
    ) {
      return label
    }
  }

  // Check common patterns
  if (lowerName.includes('web') || lowerName.includes('sitio')) {
    return 'Website Content'
  }
  if (lowerName.includes('review') || lowerName.includes('reseña')) {
    return 'Reviews'
  }
  if (lowerName.includes('post')) {
    return 'Social Posts'
  }
  if (lowerName.includes('comment') || lowerName.includes('comentario')) {
    return 'Comments'
  }

  return null
}

/**
 * Try to extract a target/company name from a filename
 */
function extractTargetFromName(name: string): string | null {
  // Remove common prefixes and suffixes
  const cleaned = name
    .replace(FILE_EXTENSION_PATTERN, '')
    .replace(/^(website|posts?|reviews?|comments?|content)\s*/i, '')
    .replace(/\s*(website|posts?|reviews?|comments?|content)$/i, '')
    .replace(/^\d{4}-\d{2}-\d{2}\s*-?\s*/, '')
    .replace(/\s*-?\s*\d{4}-\d{2}-\d{2}$/, '')
    .trim()

  // If it looks like underscored or camelCase, convert
  if (cleaned.includes('_')) {
    return cleaned.split('_').map(capitalize).join(' ')
  }

  // Return if non-empty
  return cleaned || null
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Get confidence badge color classes
 */
export function getConfidenceClasses(confidence: 'high' | 'medium' | 'low'): {
  bg: string
  text: string
  border: string
} {
  switch (confidence) {
    case 'high':
      return {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
      }
    case 'medium':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
      }
    case 'low':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
      }
  }
}
