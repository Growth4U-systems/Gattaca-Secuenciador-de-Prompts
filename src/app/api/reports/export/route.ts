import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { GeneratedReport, ReportExportConfig } from '@/types/flow.types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Export report in various formats
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { report, config } = body as {
      report: GeneratedReport
      config: ReportExportConfig
    }

    if (!report) {
      return NextResponse.json({ error: 'Report data required' }, { status: 400 })
    }

    switch (config.format) {
      case 'markdown':
        return exportMarkdown(report, config)

      case 'json':
        return NextResponse.json(report)

      case 'pptx':
        return exportPPTX(report, config)

      case 'pdf':
        return exportPDF(report, config)

      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Reports Export] Error:', error)
    return NextResponse.json(
      { error: 'Failed to export report' },
      { status: 500 }
    )
  }
}

/**
 * Export report as Markdown
 */
function exportMarkdown(report: GeneratedReport, config: ReportExportConfig) {
  const lines: string[] = []
  const title = config.customTitle || `Reporte: ${report.projectName}`

  // Header
  lines.push(`# ${title}`)
  lines.push('')
  lines.push(`**Fecha:** ${new Date(report.generatedAt).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`)
  lines.push(`**Campañas incluidas:** ${report.campaigns.length}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  // Executive Summary
  if (config.includeExecutiveSummary && report.executiveSummary) {
    lines.push('## Resumen Ejecutivo')
    lines.push('')
    lines.push(report.executiveSummary)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  // Campaigns
  if (config.includeCampaignDetails) {
    lines.push('## Análisis por Campaña')
    lines.push('')

    for (const campaign of report.campaigns) {
      lines.push(`### ${campaign.name}`)
      lines.push('')
      lines.push(`- **País:** ${campaign.country}`)
      if (campaign.industry) {
        lines.push(`- **Industria:** ${campaign.industry}`)
      }

      // Custom variables
      if (Object.keys(campaign.customVariables).length > 0) {
        lines.push('')
        lines.push('**Variables:**')
        for (const [key, value] of Object.entries(campaign.customVariables)) {
          lines.push(`- ${key}: ${value}`)
        }
      }

      lines.push('')

      // Step outputs
      for (const stepOutput of campaign.stepOutputs) {
        lines.push(`#### ${stepOutput.stepName}`)
        lines.push('')
        lines.push(stepOutput.output)
        lines.push('')
      }

      lines.push('---')
      lines.push('')
    }
  }

  // Inconsistencies
  if (config.includeInconsistencyReport && report.inconsistencies.length > 0) {
    lines.push('## Inconsistencias Detectadas')
    lines.push('')

    for (const inc of report.inconsistencies) {
      const severityEmoji = inc.severity === 'high' ? '🔴' : inc.severity === 'medium' ? '🟡' : '🔵'
      lines.push(`### ${severityEmoji} ${inc.field}`)
      lines.push('')
      lines.push(`**Tipo:** ${inc.type}`)
      lines.push(`**Descripción:** ${inc.description}`)
      lines.push('')
      lines.push('**Valores encontrados:**')
      for (const c of inc.campaigns) {
        lines.push(`- ${c.campaignName} (${c.stepName}): "${c.value}"`)
      }
      if (inc.suggestedResolution) {
        lines.push('')
        lines.push(`**Sugerencia:** ${inc.suggestedResolution}`)
      }
      if (inc.resolved && inc.resolvedValue) {
        lines.push('')
        lines.push(`✅ **Resuelto:** ${inc.resolvedValue}`)
      }
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  // Recommendations
  if (config.includeRecommendations && report.recommendations && report.recommendations.length > 0) {
    lines.push('## Recomendaciones')
    lines.push('')
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`)
    }
    lines.push('')
  }

  // Footer
  lines.push('---')
  lines.push('')
  lines.push(`*Reporte generado automáticamente por Gattaca el ${new Date().toLocaleDateString('es-ES')}*`)

  const markdown = lines.join('\n')

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${report.projectName}-report.md"`,
    },
  })
}

/**
 * Export report as PPTX (placeholder - needs pptxgenjs library)
 */
async function exportPPTX(report: GeneratedReport, config: ReportExportConfig) {
  // For now, return a simple implementation message
  // Full implementation would use pptxgenjs library
  return NextResponse.json(
    {
      error: 'PPTX export coming soon',
      message: 'Use Markdown export and convert to PPTX using external tools',
    },
    { status: 501 }
  )
}

/**
 * Export report as PDF (placeholder - needs puppeteer or similar)
 */
async function exportPDF(report: GeneratedReport, config: ReportExportConfig) {
  // For now, return a simple implementation message
  // Full implementation would render HTML and use puppeteer to generate PDF
  return NextResponse.json(
    {
      error: 'PDF export coming soon',
      message: 'Use Markdown export and convert to PDF using external tools',
    },
    { status: 501 }
  )
}
