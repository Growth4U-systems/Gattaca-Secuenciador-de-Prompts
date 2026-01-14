/**
 * Debug endpoint para analizar el parsing de step-4
 * GET /api/debug/parse-step4?campaign_id=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { parseMarkdownTables, findTableByHeader, getColumnValue } from '@/lib/exporters/markdown-table-parser'

function normalizeCriterion(criterion: string): string {
  return criterion.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findBestPositioningMatch(
  normalizedCriterion: string,
  positioningMap: Map<string, string[]>
): { row: string[], matchType: string, matchedKey: string } {
  // 1. Match exacto
  if (positioningMap.has(normalizedCriterion)) {
    return { row: positioningMap.get(normalizedCriterion)!, matchType: 'exact', matchedKey: normalizedCriterion }
  }

  // 2. Buscar si el criterio contiene alguna key del mapa o viceversa
  for (const [key, value] of positioningMap.entries()) {
    if (normalizedCriterion.includes(key) && key.length >= 10) {
      return { row: value, matchType: 'contains', matchedKey: key }
    }
    if (key.includes(normalizedCriterion) && normalizedCriterion.length >= 10) {
      return { row: value, matchType: 'contained-by', matchedKey: key }
    }
  }

  // 3. Buscar coincidencia por palabras clave
  const criterionWords = new Set(normalizedCriterion.match(/[a-z]{3,}/g) || [])
  if (criterionWords.size >= 2) {
    let bestMatch: string[] = []
    let bestScore = 0
    let bestKey = ''

    for (const [key, value] of positioningMap.entries()) {
      const keyWords = new Set(key.match(/[a-z]{3,}/g) || [])
      if (keyWords.size === 0) continue

      let commonWords = 0
      for (const word of criterionWords) {
        if (keyWords.has(word)) commonWords++
      }

      const score = commonWords / Math.max(criterionWords.size, keyWords.size)
      if (score > bestScore && score >= 0.6) {
        bestScore = score
        bestMatch = value
        bestKey = key
      }
    }

    if (bestMatch.length > 0) {
      return { row: bestMatch, matchType: `fuzzy-${Math.round(bestScore * 100)}%`, matchedKey: bestKey }
    }
  }

  return { row: [], matchType: 'none', matchedKey: '' }
}

function extractCompetitorScores(headers: string[], row: string[]): Record<string, { score: number | string }> {
  const scores: Record<string, { score: number | string }> = {}

  const excludePatterns = [
    /evaluation/i,
    /criteria/i,
    /criterion/i,
    /analysis/i,
    /opportunity/i,
    /relevance/i,
    /justification/i,
    /type/i
  ]

  headers.forEach((header, index) => {
    if (excludePatterns.some(p => p.test(header))) {
      return
    }

    const cellValue = row[index]?.trim()
    if (!cellValue) return

    const scoreMatch = header.match(/^(.+?)\s+Score$/i)
    if (scoreMatch) {
      let competitorName = scoreMatch[1].trim()
      const parenMatch = competitorName.match(/\(([^)]+)\)/)
      if (parenMatch) {
        competitorName = parenMatch[1]
      }

      const numericScore = parseInt(cellValue, 10)
      scores[competitorName] = {
        score: isNaN(numericScore) ? cellValue : numericScore
      }
      return
    }

    const numericValue = parseInt(cellValue, 10)
    if (!isNaN(numericValue) && numericValue >= 0 && numericValue <= 5) {
      const competitorName = header.trim()
      if (competitorName.length > 0 && competitorName.length < 50) {
        scores[competitorName] = { score: numericValue }
      }
    }
  })

  return scores
}

export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get('campaign_id')
  const ecpName = request.nextUrl.searchParams.get('ecp_name')

  const supabase = await createClient()

  let query = supabase
    .from('ecp_campaigns')
    .select('id, ecp_name, step_outputs')

  if (campaignId) {
    query = query.eq('id', campaignId)
  } else if (ecpName) {
    query = query.ilike('ecp_name', `%${ecpName}%`)
  } else {
    return NextResponse.json({ error: 'Provide campaign_id or ecp_name parameter' }, { status: 400 })
  }

  const { data: campaign, error } = await query.single()

  if (error || !campaign) {
    return NextResponse.json({ error: 'Campaign not found', details: error }, { status: 404 })
  }

  const output = campaign.step_outputs?.['step-4-find-place']?.output
  if (!output) {
    return NextResponse.json({ error: 'No step-4 output found', campaign_id: campaign.id })
  }

  const tables = parseMarkdownTables(output)

  const criteriaTable = findTableByHeader(tables, 'Relevance') || tables[0]
  const positioningTable = findTableByHeader(tables, 'Score') || tables[1]

  // Build positioning map
  const positioningMap = new Map<string, string[]>()
  if (positioningTable) {
    for (const row of positioningTable.rows) {
      const criterion = getColumnValue(positioningTable, row, 'Criteria') ||
                       getColumnValue(positioningTable, row, 'Criterion') ||
                       row[0] || ''
      if (criterion) {
        positioningMap.set(normalizeCriterion(criterion), row)
      }
    }
  }

  // Debug info
  const debugInfo: any = {
    campaign_id: campaign.id,
    ecp_name: campaign.ecp_name,
    tables_found: tables.length,
    criteria_table: criteriaTable ? {
      headers: criteriaTable.headers,
      row_count: criteriaTable.rows.length,
      sample_rows: criteriaTable.rows.slice(0, 3)
    } : null,
    positioning_table: positioningTable ? {
      headers: positioningTable.headers,
      row_count: positioningTable.rows.length,
      sample_rows: positioningTable.rows.slice(0, 3)
    } : null,
    positioning_map_keys: Array.from(positioningMap.keys()),
    parsed_results: [] as any[]
  }

  if (criteriaTable && positioningTable) {
    for (const criteriaRow of criteriaTable.rows) {
      const criterion = getColumnValue(criteriaTable, criteriaRow, 'Criteria') ||
                       getColumnValue(criteriaTable, criteriaRow, 'Criterion') ||
                       criteriaRow[0] || ''

      const normalizedCriterion = normalizeCriterion(criterion)
      const { row: positioningRow, matchType, matchedKey } = findBestPositioningMatch(normalizedCriterion, positioningMap)
      const competitorScores = extractCompetitorScores(positioningTable.headers, positioningRow)

      debugInfo.parsed_results.push({
        criterion,
        normalized: normalizedCriterion,
        match_type: matchType,
        matched_key: matchedKey,
        positioning_row: positioningRow,
        extracted_scores: competitorScores
      })
    }
  }

  // Also include raw output snippet
  debugInfo.raw_output_snippet = output.substring(0, 3000)

  return NextResponse.json(debugInfo, { status: 200 })
}
