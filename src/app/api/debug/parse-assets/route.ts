/**
 * Debug endpoint para analizar el parsing de step-5 y step-6 (Prove Legit / Assets)
 * GET /api/debug/parse-assets?ecp_name=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { parseMarkdownTables, getColumnValue } from '@/lib/exporters/markdown-table-parser'

function normalizeAssetName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
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

  const step5Output = campaign.step_outputs?.['step-5-select-assets']?.output
  const step6Output = campaign.step_outputs?.['step-6-proof-points']?.output

  const debugInfo: any = {
    campaign_id: campaign.id,
    ecp_name: campaign.ecp_name,
    has_step5: !!step5Output,
    has_step6: !!step6Output,
    step5_tables: [],
    step6_tables: [],
    assets_table_found: null,
    proof_table_found: null,
    parsed_assets: [],
    issues: []
  }

  // Parse Step 5
  if (step5Output) {
    const step5Tables = parseMarkdownTables(step5Output)
    debugInfo.step5_tables = step5Tables.map((t, i) => ({
      index: i,
      headers: t.headers,
      row_count: t.rows.length,
      sample_row: t.rows[0]
    }))

    const assetsTable = step5Tables.find(t =>
      t.headers.some(h => h.toLowerCase().includes('asset'))
    )

    if (assetsTable) {
      debugInfo.assets_table_found = {
        headers: assetsTable.headers,
        row_count: assetsTable.rows.length
      }

      // Analizar cada fila
      for (const row of assetsTable.rows) {
        const assetName = getColumnValue(assetsTable, row, 'Asset') || row[0] || ''

        const analysis: any = {
          raw_row: row,
          asset_name: assetName,
          column_matches: {
            'Asset': getColumnValue(assetsTable, row, 'Asset') ? 'MATCH' : 'FALLBACK row[0]',
            'Value/Criteria': getColumnValue(assetsTable, row, 'Value') || getColumnValue(assetsTable, row, 'Criteria') ? 'MATCH' : 'FALLBACK row[1]',
            'Category': getColumnValue(assetsTable, row, 'Category') ? 'MATCH' : 'FALLBACK row[2]',
            'Justification': getColumnValue(assetsTable, row, 'Justification') || getColumnValue(assetsTable, row, 'Differentiation') ? 'MATCH' : 'FALLBACK row[3]'
          },
          extracted: {
            asset_name: assetName,
            value_criteria: getColumnValue(assetsTable, row, 'Value') || getColumnValue(assetsTable, row, 'Criteria') || row[1] || '',
            category: getColumnValue(assetsTable, row, 'Category') || row[2] || '',
            justification: getColumnValue(assetsTable, row, 'Justification') || getColumnValue(assetsTable, row, 'Differentiation') || row[3] || ''
          }
        }

        // Detectar si hay fallback que podria causar desfasaje
        if (analysis.column_matches['Value/Criteria'] === 'FALLBACK row[1]') {
          debugInfo.issues.push(`Asset "${assetName}": Value/Criteria uses index fallback`)
        }
        if (analysis.column_matches['Category'] === 'FALLBACK row[2]') {
          debugInfo.issues.push(`Asset "${assetName}": Category uses index fallback`)
        }

        debugInfo.parsed_assets.push(analysis)
      }
    } else {
      debugInfo.issues.push('No table found with "asset" in headers for step-5')
    }

    debugInfo.step5_raw_snippet = step5Output.substring(0, 2000)
  }

  // Parse Step 6
  if (step6Output) {
    const step6Tables = parseMarkdownTables(step6Output)
    debugInfo.step6_tables = step6Tables.map((t, i) => ({
      index: i,
      headers: t.headers,
      row_count: t.rows.length,
      sample_row: t.rows[0]
    }))

    const proofTable = step6Tables.find(t =>
      t.headers.some(h => h.toLowerCase().includes('proof') || h.toLowerCase().includes('advantage'))
    )

    if (proofTable) {
      debugInfo.proof_table_found = {
        headers: proofTable.headers,
        row_count: proofTable.rows.length,
        sample_rows: proofTable.rows.slice(0, 3)
      }
    } else {
      debugInfo.issues.push('No table found with "proof" or "advantage" in headers for step-6')
    }

    debugInfo.step6_raw_snippet = step6Output.substring(0, 2000)
  }

  return NextResponse.json(debugInfo, { status: 200 })
}
