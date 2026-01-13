/**
 * Document Matcher Utility
 *
 * Provides intelligent matching between required document names
 * and actual documents in the project based on filename and description.
 */

interface MatchableDocument {
  id: string
  filename: string
  description?: string
}

interface MatchResult {
  doc: MatchableDocument
  confidence: number
}

/**
 * Normalize text for comparison:
 * - Lowercase
 * - Remove accents
 * - Remove file extensions
 * - Remove common words
 */
function normalize(text: string): string {
  if (!text) return ''

  // Remove file extensions
  const withoutExtension = text.replace(/\.(pdf|docx?|txt|md|xlsx?|csv)$/i, '')

  // Lowercase and remove accents
  const normalized = withoutExtension
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  // Remove common words (Spanish and English)
  const stopWords = [
    'el', 'la', 'los', 'las', 'de', 'del', 'un', 'una', 'para', 'por', 'con', 'en',
    'the', 'a', 'an', 'of', 'for', 'with', 'in', 'to', 'and', 'or',
    'documento', 'document', 'archivo', 'file'
  ]

  const words = normalized.split(/[\s_\-\.]+/)
  const filteredWords = words.filter(word => !stopWords.includes(word) && word.length > 1)

  return filteredWords.join(' ')
}

/**
 * Calculate Levenshtein distance between two strings
 */
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
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculate similarity score between two strings (0-1)
 * Uses combination of:
 * - Levenshtein distance
 * - Word overlap
 */
function calculateSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1

  // Normalize both strings
  const normA = normalize(a)
  const normB = normalize(b)

  if (!normA || !normB) return 0
  if (normA === normB) return 1

  // Calculate Levenshtein similarity
  const maxLen = Math.max(normA.length, normB.length)
  const levDist = levenshteinDistance(normA, normB)
  const levSimilarity = 1 - (levDist / maxLen)

  // Calculate word overlap (Jaccard similarity)
  const wordsA = new Set(normA.split(' '))
  const wordsB = new Set(normB.split(' '))
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)))
  const union = new Set([...wordsA, ...wordsB])
  const jaccardSimilarity = intersection.size / union.size

  // Combine both metrics (70% word overlap, 30% Levenshtein)
  // Word overlap is more important for document matching
  const combinedScore = (jaccardSimilarity * 0.7) + (levSimilarity * 0.3)

  return Math.min(1, combinedScore)
}

/**
 * Find the best matching document for a required document name
 *
 * @param requiredName - The name/description of the required document
 * @param projectDocuments - Array of documents available in the project
 * @param threshold - Minimum confidence threshold (default: 0.3)
 * @returns Match result or null if no good match found
 */
export function findMatchingDocument(
  requiredName: string,
  projectDocuments: MatchableDocument[],
  threshold: number = 0.3
): MatchResult | null {
  if (!requiredName || projectDocuments.length === 0) return null

  const matches = projectDocuments.map(doc => {
    // Calculate similarity with filename (weight: 60%)
    const filenameScore = calculateSimilarity(requiredName, doc.filename)

    // Calculate similarity with description (weight: 40%)
    const descriptionScore = doc.description
      ? calculateSimilarity(requiredName, doc.description)
      : 0

    // Combined score
    const score = (filenameScore * 0.6) + (descriptionScore * 0.4)

    return { doc, confidence: score }
  })

  // Sort by confidence and get best match
  const sortedMatches = matches.sort((a, b) => b.confidence - a.confidence)
  const bestMatch = sortedMatches[0]

  // Return only if above threshold
  return bestMatch.confidence >= threshold ? bestMatch : null
}

/**
 * Find matches for multiple required documents
 *
 * @param requiredNames - Array of required document names
 * @param projectDocuments - Array of documents available in the project
 * @param threshold - Minimum confidence threshold
 * @returns Array of match results (null for no match)
 */
export function findMatchingDocuments(
  requiredNames: string[],
  projectDocuments: MatchableDocument[],
  threshold: number = 0.3
): (MatchResult | null)[] {
  return requiredNames.map(name =>
    findMatchingDocument(name, projectDocuments, threshold)
  )
}

/**
 * Get confidence level label
 */
export function getConfidenceLabel(confidence: number): {
  label: string
  color: string
} {
  if (confidence >= 0.8) {
    return { label: 'Muy alto', color: 'text-green-700 bg-green-100' }
  } else if (confidence >= 0.6) {
    return { label: 'Alto', color: 'text-emerald-700 bg-emerald-100' }
  } else if (confidence >= 0.4) {
    return { label: 'Medio', color: 'text-yellow-700 bg-yellow-100' }
  } else {
    return { label: 'Bajo', color: 'text-orange-700 bg-orange-100' }
  }
}
