/**
 * Transformadores para convertir datos de export a CSV
 */

interface FindPlaceRow {
  ecp_name: string
  evaluation_criterion: string
  relevance: string
  justification: string
  competitor_scores: Record<string, { score: number | string }>
  analysis_opportunity: string
}

interface ProveLegitRow {
  ecp_name: string
  asset_name: string
  value_criteria: string
  category: string
  justification_differentiation: string
  competitive_advantage: string
  benefit_for_user: string
  proof: string
}

interface UspUvpRow {
  ecp_name: string
  message_category: string
  hypothesis: string
  value_criteria: string
  objective: string
  message_en: string
  message_es: string
}

/**
 * Escapa un valor para CSV (maneja comas, comillas y saltos de linea)
 */
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Si contiene coma, comilla o salto de linea, envolver en comillas y escapar comillas internas
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convierte un array de objetos a CSV
 */
function arrayToCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSV).join(',')
  const dataLines = rows.map(row => row.map(escapeCSV).join(','))
  return [headerLine, ...dataLines].join('\n')
}

/**
 * Transforma datos de export_find_place a CSV
 * Incluye columnas dinamicas para cada competidor encontrado
 */
export function transformFindPlaceToCSV(data: FindPlaceRow[]): string {
  if (data.length === 0) {
    return 'ECP,Evaluation Criterion,Relevance,Justification,Analysis & Opportunity'
  }

  // Extraer todos los competidores unicos
  const allCompetitors = new Set<string>()
  data.forEach(row => {
    if (row.competitor_scores) {
      Object.keys(row.competitor_scores).forEach(comp => allCompetitors.add(comp))
    }
  })
  const competitors = Array.from(allCompetitors).sort()

  // Construir headers
  const headers = [
    'ECP',
    'Evaluation Criterion',
    'Relevance',
    'Justification',
    ...competitors.map(c => `${c} Score`),
    'Analysis & Opportunity'
  ]

  // Construir filas
  const rows = data.map(row => {
    const competitorScores = competitors.map(comp => {
      const score = row.competitor_scores?.[comp]?.score
      return score !== undefined ? String(score) : ''
    })

    return [
      row.ecp_name || '',
      row.evaluation_criterion || '',
      row.relevance || '',
      row.justification || '',
      ...competitorScores,
      row.analysis_opportunity || ''
    ]
  })

  return arrayToCSV(headers, rows)
}

/**
 * Transforma datos de export_prove_legit a CSV
 */
export function transformProveLegitToCSV(data: ProveLegitRow[]): string {
  const headers = [
    'ECP',
    'Asset',
    'Value Criteria',
    'Category',
    'Justification for Differentiation',
    'Competitive Advantage',
    'Benefit for User',
    'Proof'
  ]

  const rows = data.map(row => [
    row.ecp_name || '',
    row.asset_name || '',
    row.value_criteria || '',
    row.category || '',
    row.justification_differentiation || '',
    row.competitive_advantage || '',
    row.benefit_for_user || '',
    row.proof || ''
  ])

  return arrayToCSV(headers, rows)
}

/**
 * Transforma datos de export_usp_uvp a CSV
 */
export function transformUspUvpToCSV(data: UspUvpRow[]): string {
  const headers = [
    'ECP',
    'Message Category',
    'Hypothesis',
    'Value Criteria',
    'Objective',
    'Message (EN)',
    'Message (ES)'
  ]

  const rows = data.map(row => [
    row.ecp_name || '',
    row.message_category || '',
    row.hypothesis || '',
    row.value_criteria || '',
    row.objective || '',
    row.message_en || '',
    row.message_es || ''
  ])

  return arrayToCSV(headers, rows)
}
