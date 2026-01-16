/**
 * Niche Extractor - LLM-based extraction of niches from scraped content
 */

import type { ExtractedNiche } from '@/types/scraper.types'

/**
 * Default prompt for extracting niches from forum content
 */
export const DEFAULT_EXTRACTION_PROMPT = `ROLE: Customer Research Analyst and Product Strategist

PRODUCTO: {{product}}
TARGET: {{target}}
INDUSTRIA: {{industry}}
EMPRESA: {{company_name}}

CONTENIDO DE FORO:
{{content}}

INSTRUCCIÓN:
1. Lee la conversación completa con atención
2. Identifica si hay un PAIN POINT relevante para el producto/industria
3. Si la conversación NO es relevante al producto/target, responde SOLO: "IGNORAR"
4. Si ES relevante, extrae nichos en formato CSV

CRITERIOS DE RELEVANCIA:
- El problema debe estar relacionado con {{industry}} o necesidades que {{product}} podría resolver
- El problema debe ser funcional y solucionable (no solo emocional)
- Debe haber evidencia clara en el texto (citas, quejas específicas)

FORMATO DE OUTPUT (si es relevante):
"Problem";"Persona";"Functional Cause";"Emotional Load";"Evidence";"Alternatives";"URL"

CAMPOS:
- Problem: Pain point en formato "Cuando [contexto], me frustro por [obstáculo], lo que me impide [resultado]"
- Persona: Tipo de usuario específico con contexto (ej: "Autónomo que acaba de darse de alta")
- Functional Cause: Raíz del problema (burocracia, falta de automatización, falta de información)
- Emotional Load: Estrés, confusión, frustración visible en el texto
- Evidence: 2-3 citas literales del texto separadas por |
- Alternatives: Soluciones actuales mencionadas (Excel, manual, otra app)
- URL: URL de la fuente

EJEMPLO DE OUTPUT:
"Cuando llega el trimestre, me frustro por no saber cuánto tengo que pagar de IVA, lo que me impide planificar mis gastos";"Autónomo de servicios digitales sin conocimientos contables";"Falta de visibilidad de obligaciones fiscales en tiempo real";"Ansiedad por posibles sanciones, confusión con las fechas";"'cada trimestre es un infierno' | 'nunca sé cuánto voy a deber'";"Excel manual, preguntar al gestor";"https://example.com/thread"

IMPORTANTE:
- Solo extrae nichos que tengan EVIDENCIA CLARA en el texto
- No inventes información ni completes campos sin datos
- Si hay múltiples nichos distintos, genera múltiples líneas CSV
- Si el contenido no es relevante, responde SOLO "IGNORAR"
`

/**
 * Parse CSV output from LLM into ExtractedNiche objects
 */
export function parseNicheExtractionOutput(
  output: string,
  jobId: string,
  urlId: string,
  sourceUrl: string
): { niches: Omit<ExtractedNiche, 'id' | 'created_at'>[]; filtered: boolean; reason?: string } {
  const trimmed = output.trim()

  // Check if content was filtered
  if (trimmed === 'IGNORAR' || trimmed.startsWith('IGNORAR')) {
    return {
      niches: [],
      filtered: true,
      reason: trimmed.replace('IGNORAR', '').trim() || 'No relevante para el producto/target',
    }
  }

  // Parse CSV lines
  const lines = trimmed.split('\n').filter((line) => line.includes(';'))
  const niches: Omit<ExtractedNiche, 'id' | 'created_at'>[] = []

  for (const line of lines) {
    // Skip header line if present
    if (line.includes('"Problem"') && line.includes('"Persona"')) {
      continue
    }

    try {
      // Extract fields using regex to handle quotes properly
      const fields = parseCSVLine(line)

      if (fields.length >= 6) {
        niches.push({
          job_id: jobId,
          url_id: urlId,
          problem: fields[0] || '',
          persona: fields[1] || '',
          functional_cause: fields[2] || '',
          emotional_load: fields[3] || '',
          evidence: fields[4] || '',
          alternatives: fields[5] || '',
          source_url: fields[6] || sourceUrl,
        })
      }
    } catch (error) {
      console.error('Error parsing CSV line:', line, error)
    }
  }

  return { niches, filtered: false }
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ';' && !inQuotes) {
      // Field separator
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // Add last field
  fields.push(current.trim())

  return fields
}

/**
 * Replace variables in the extraction prompt
 */
export function prepareExtractionPrompt(
  prompt: string,
  variables: {
    product?: string
    target?: string
    industry?: string
    company_name?: string
    content: string
  }
): string {
  let result = prompt

  if (variables.product) {
    result = result.replace(/\{\{product\}\}/g, variables.product)
  }
  if (variables.target) {
    result = result.replace(/\{\{target\}\}/g, variables.target)
  }
  if (variables.industry) {
    result = result.replace(/\{\{industry\}\}/g, variables.industry)
  }
  if (variables.company_name) {
    result = result.replace(/\{\{company_name\}\}/g, variables.company_name)
  }
  result = result.replace(/\{\{content\}\}/g, variables.content)

  return result
}
