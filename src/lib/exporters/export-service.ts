/**
 * Servicio para parsear step_outputs y poblar las tablas de export
 */

import { createClient } from '@/lib/supabase-server'
import { parseMarkdownTables, findTableByHeader, getColumnValue, ParsedTable } from './markdown-table-parser'

interface Campaign {
  id: string
  project_id: string
  ecp_name: string
  step_outputs: Record<string, { output?: string }>
}

/**
 * Pobla las 3 tablas de export para una campana
 */
export async function populateExportTables(campaignId: string): Promise<{
  findPlace: number
  proveLegit: number
  uspUvp: number
}> {
  const supabase = await createClient()

  // Obtener campana con step_outputs
  const { data: campaign, error } = await supabase
    .from('ecp_campaigns')
    .select('id, project_id, ecp_name, step_outputs')
    .eq('id', campaignId)
    .single()

  if (error || !campaign?.step_outputs) {
    console.error('Error fetching campaign:', error)
    return { findPlace: 0, proveLegit: 0, uspUvp: 0 }
  }

  const results = {
    findPlace: await parseAndSaveFindPlace(supabase, campaign as Campaign),
    proveLegit: await parseAndSaveProveLegit(supabase, campaign as Campaign),
    uspUvp: await parseAndSaveUspUvp(supabase, campaign as Campaign)
  }

  return results
}

/**
 * Parsea Step 4 (Find Your Place to Win) y guarda en export_find_place
 */
async function parseAndSaveFindPlace(supabase: any, campaign: Campaign): Promise<number> {
  const output = campaign.step_outputs['step-4-find-place']?.output
  if (!output) return 0

  const tables = parseMarkdownTables(output)
  if (tables.length < 2) return 0

  // Tabla 1: Evaluation Criteria (headers: Evaluation Criteria, Relevance, Justification)
  const criteriaTable = findTableByHeader(tables, 'Relevance') || tables[0]

  // Tabla 2: Competitive Positioning Map (headers: Evaluation Criteria, [Competitor] Score, ..., Analysis)
  const positioningTable = findTableByHeader(tables, 'Score') || tables[1]

  if (!criteriaTable || !positioningTable) return 0

  // Construir filas combinando ambas tablas
  const rows = []

  for (let i = 0; i < criteriaTable.rows.length; i++) {
    const criteriaRow = criteriaTable.rows[i]
    const positioningRow = positioningTable.rows[i] || []

    // Extraer criterio y datos de la primera tabla
    const criterion = getColumnValue(criteriaTable, criteriaRow, 'Criteria') ||
                     getColumnValue(criteriaTable, criteriaRow, 'Criterion') ||
                     criteriaRow[0] || ''
    const relevance = getColumnValue(criteriaTable, criteriaRow, 'Relevance') || criteriaRow[1] || ''
    const justification = getColumnValue(criteriaTable, criteriaRow, 'Justification') || criteriaRow[2] || ''

    // Extraer scores de competidores de la segunda tabla
    const competitorScores = extractCompetitorScores(positioningTable.headers, positioningRow)

    // Ultima columna es analysis_opportunity
    const analysisIndex = positioningTable.headers.findIndex(h =>
      h.toLowerCase().includes('analysis') || h.toLowerCase().includes('opportunity')
    )
    const analysisOpportunity = analysisIndex >= 0 ? positioningRow[analysisIndex] : positioningRow[positioningRow.length - 1]

    if (criterion) {
      rows.push({
        project_id: campaign.project_id,
        campaign_id: campaign.id,
        ecp_name: campaign.ecp_name,
        evaluation_criterion: criterion.substring(0, 500), // Limitar longitud
        relevance: relevance.substring(0, 50),
        justification: justification.substring(0, 2000),
        competitor_scores: competitorScores,
        analysis_opportunity: analysisOpportunity?.substring(0, 2000) || ''
      })
    }
  }

  if (rows.length === 0) return 0

  // UPSERT: actualiza si ya existe, inserta si no
  const { error } = await supabase
    .from('export_find_place')
    .upsert(rows, {
      onConflict: 'campaign_id,evaluation_criterion',
      ignoreDuplicates: false
    })

  if (error) {
    console.error('Error saving find_place:', error)
    return 0
  }

  return rows.length
}

/**
 * Extrae scores de competidores de los headers y valores de una fila
 */
function extractCompetitorScores(headers: string[], row: string[]): Record<string, { score: number | string }> {
  const scores: Record<string, { score: number | string }> = {}

  headers.forEach((header, index) => {
    // Detectar columnas de score (ej: "Qonto Score", "BBVA Score", "Public Utility (CIRCE) Score")
    const scoreMatch = header.match(/(.+?)\s*(?:\(.*?\))?\s*Score/i)
    if (scoreMatch && row[index]) {
      const competitorName = scoreMatch[1].trim()
      const scoreValue = row[index].trim()

      // Intentar parsear como numero, si no, guardar como string
      const numericScore = parseInt(scoreValue, 10)
      scores[competitorName] = {
        score: isNaN(numericScore) ? scoreValue : numericScore
      }
    }
  })

  return scores
}

/**
 * Parsea Step 5 + Step 6 y guarda en export_prove_legit
 */
async function parseAndSaveProveLegit(supabase: any, campaign: Campaign): Promise<number> {
  const step5Output = campaign.step_outputs['step-5-select-assets']?.output
  const step6Output = campaign.step_outputs['step-6-proof-points']?.output

  if (!step5Output && !step6Output) return 0

  // Parsear Step 5: Asset | Value Criteria | Category | Justification for Differentiation
  const step5Tables = step5Output ? parseMarkdownTables(step5Output) : []
  const assetsTable = step5Tables.find(t =>
    t.headers.some(h => h.toLowerCase().includes('asset'))
  )

  // Parsear Step 6: Unique Asset | Competitive Advantage | Benefit for the User | Proof
  const step6Tables = step6Output ? parseMarkdownTables(step6Output) : []
  const proofTable = step6Tables.find(t =>
    t.headers.some(h => h.toLowerCase().includes('proof') || h.toLowerCase().includes('advantage'))
  )

  // Crear un mapa de assets de step 5
  const assetsMap = new Map<string, any>()

  if (assetsTable) {
    for (const row of assetsTable.rows) {
      const assetName = getColumnValue(assetsTable, row, 'Asset') || row[0] || ''
      if (assetName) {
        assetsMap.set(normalizeAssetName(assetName), {
          asset_name: assetName.substring(0, 500),
          value_criteria: (getColumnValue(assetsTable, row, 'Value') || getColumnValue(assetsTable, row, 'Criteria') || row[1] || '').substring(0, 500),
          category: (getColumnValue(assetsTable, row, 'Category') || row[2] || '').substring(0, 100),
          justification_differentiation: (getColumnValue(assetsTable, row, 'Justification') || getColumnValue(assetsTable, row, 'Differentiation') || row[3] || '').substring(0, 2000)
        })
      }
    }
  }

  // Combinar con datos de step 6
  if (proofTable) {
    for (const row of proofTable.rows) {
      const assetName = getColumnValue(proofTable, row, 'Asset') || row[0] || ''
      if (assetName) {
        const normalizedName = normalizeAssetName(assetName)
        const existing = assetsMap.get(normalizedName) || {
          asset_name: assetName.substring(0, 500),
          value_criteria: '',
          category: '',
          justification_differentiation: ''
        }

        assetsMap.set(normalizedName, {
          ...existing,
          competitive_advantage: (getColumnValue(proofTable, row, 'Advantage') || row[1] || '').substring(0, 2000),
          benefit_for_user: (getColumnValue(proofTable, row, 'Benefit') || row[2] || '').substring(0, 2000),
          proof: (getColumnValue(proofTable, row, 'Proof') || row[3] || '').substring(0, 4000)
        })
      }
    }
  }

  // Convertir a array para upsert
  const rows = Array.from(assetsMap.values()).map(asset => ({
    project_id: campaign.project_id,
    campaign_id: campaign.id,
    ecp_name: campaign.ecp_name,
    ...asset
  }))

  if (rows.length === 0) return 0

  const { error } = await supabase
    .from('export_prove_legit')
    .upsert(rows, {
      onConflict: 'campaign_id,asset_name',
      ignoreDuplicates: false
    })

  if (error) {
    console.error('Error saving prove_legit:', error)
    return 0
  }

  return rows.length
}

/**
 * Normaliza nombre de asset para hacer match entre tablas
 */
function normalizeAssetName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Parsea Step 7 (Final Output / USP & UVP) y guarda en export_usp_uvp
 */
async function parseAndSaveUspUvp(supabase: any, campaign: Campaign): Promise<number> {
  const output = campaign.step_outputs['step-7-final-output']?.output
  if (!output) return 0

  const tables = parseMarkdownTables(output)

  // Buscar tabla con Message Category o similar
  const messageTable = tables.find(t =>
    t.headers.some(h =>
      h.toLowerCase().includes('message') ||
      h.toLowerCase().includes('category') ||
      h.toLowerCase().includes('uvp') ||
      h.toLowerCase().includes('usp')
    )
  )

  if (!messageTable) return 0

  const rows = messageTable.rows.map(row => {
    const category = getColumnValue(messageTable, row, 'Category') ||
                    getColumnValue(messageTable, row, 'Message Category') ||
                    row[0] || ''

    return {
      project_id: campaign.project_id,
      campaign_id: campaign.id,
      ecp_name: campaign.ecp_name,
      message_category: category.substring(0, 200),
      hypothesis: (getColumnValue(messageTable, row, 'Hypothesis') || row[1] || '').substring(0, 2000),
      value_criteria: (getColumnValue(messageTable, row, 'Value') || getColumnValue(messageTable, row, 'Criteria') || row[2] || '').substring(0, 500),
      objective: (getColumnValue(messageTable, row, 'Objective') || row[3] || '').substring(0, 1000),
      message_en: (getColumnValue(messageTable, row, 'English') || getColumnValue(messageTable, row, 'EN') || row[4] || '').substring(0, 2000),
      message_es: (getColumnValue(messageTable, row, 'Spanish') || getColumnValue(messageTable, row, 'ES') || getColumnValue(messageTable, row, 'Castellano') || row[5] || '').substring(0, 2000)
    }
  }).filter(row => row.message_category)

  if (rows.length === 0) return 0

  const { error } = await supabase
    .from('export_usp_uvp')
    .upsert(rows, {
      onConflict: 'campaign_id,message_category',
      ignoreDuplicates: false
    })

  if (error) {
    console.error('Error saving usp_uvp:', error)
    return 0
  }

  return rows.length
}

/**
 * Sincroniza todas las campanas de un proyecto
 */
export async function syncProjectExportData(projectId: string): Promise<{
  campaignsProcessed: number
  totalFindPlace: number
  totalProveLegit: number
  totalUspUvp: number
}> {
  const supabase = await createClient()

  // Obtener todas las campanas del proyecto
  const { data: campaigns, error } = await supabase
    .from('ecp_campaigns')
    .select('id')
    .eq('project_id', projectId)

  if (error || !campaigns) {
    console.error('Error fetching campaigns:', error)
    return { campaignsProcessed: 0, totalFindPlace: 0, totalProveLegit: 0, totalUspUvp: 0 }
  }

  let totalFindPlace = 0
  let totalProveLegit = 0
  let totalUspUvp = 0

  for (const campaign of campaigns) {
    const results = await populateExportTables(campaign.id)
    totalFindPlace += results.findPlace
    totalProveLegit += results.proveLegit
    totalUspUvp += results.uspUvp
  }

  return {
    campaignsProcessed: campaigns.length,
    totalFindPlace,
    totalProveLegit,
    totalUspUvp
  }
}
