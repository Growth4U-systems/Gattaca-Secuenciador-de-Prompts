import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { GeneratedReport, ReportExportConfig } from '@/types/flow.types'
import PptxGenJS from 'pptxgenjs'

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
 * Export report as PPTX
 */
async function exportPPTX(report: GeneratedReport, config: ReportExportConfig) {
  const pptx = new PptxGenJS()

  // Presentation settings
  pptx.author = 'Gattaca'
  pptx.title = config.customTitle || `Reporte: ${report.projectName}`
  pptx.subject = 'Reporte de Campañas'
  pptx.company = 'Gattaca'

  // Define master slide with branding
  pptx.defineSlideMaster({
    title: 'GATTACA_MASTER',
    background: { color: 'FFFFFF' },
    objects: [
      // Header bar
      { rect: { x: 0, y: 0, w: '100%', h: 0.5, fill: { color: '4F46E5' } } },
      // Footer
      { rect: { x: 0, y: 5.25, w: '100%', h: 0.25, fill: { color: 'F3F4F6' } } },
      { text: { text: 'Generado por Gattaca', options: { x: 0.3, y: 5.28, w: 3, h: 0.2, fontSize: 8, color: '6B7280' } } },
    ],
  })

  // Title slide
  const titleSlide = pptx.addSlide({ masterName: 'GATTACA_MASTER' })
  titleSlide.addText(report.projectName, {
    x: 0.5,
    y: 2,
    w: 9,
    h: 1,
    fontSize: 36,
    bold: true,
    color: '1F2937',
    align: 'center',
  })
  titleSlide.addText(`${report.campaigns.length} Campañas · ${report.selectedStepIds.length} Pasos`, {
    x: 0.5,
    y: 3,
    w: 9,
    h: 0.5,
    fontSize: 18,
    color: '6B7280',
    align: 'center',
  })
  titleSlide.addText(new Date(report.generatedAt).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }), {
    x: 0.5,
    y: 3.5,
    w: 9,
    h: 0.5,
    fontSize: 14,
    color: '9CA3AF',
    align: 'center',
  })

  // Executive summary slide (if available)
  if (config.includeExecutiveSummary && report.executiveSummary) {
    const summarySlide = pptx.addSlide({ masterName: 'GATTACA_MASTER' })
    summarySlide.addText('Resumen Ejecutivo', {
      x: 0.5,
      y: 0.7,
      w: 9,
      h: 0.5,
      fontSize: 24,
      bold: true,
      color: '4F46E5',
    })
    // Truncate if too long for slide
    const summaryText = report.executiveSummary.length > 2000
      ? report.executiveSummary.substring(0, 2000) + '...'
      : report.executiveSummary
    summarySlide.addText(stripMarkdown(summaryText), {
      x: 0.5,
      y: 1.3,
      w: 9,
      h: 3.8,
      fontSize: 12,
      color: '374151',
      valign: 'top',
    })
  }

  // Campaign slides
  if (config.includeCampaignDetails) {
    for (const campaign of report.campaigns) {
      // Campaign header slide
      const campaignSlide = pptx.addSlide({ masterName: 'GATTACA_MASTER' })
      campaignSlide.addText(campaign.name, {
        x: 0.5,
        y: 0.7,
        w: 9,
        h: 0.6,
        fontSize: 24,
        bold: true,
        color: '1F2937',
      })
      campaignSlide.addText(`${campaign.country}${campaign.industry ? ` · ${campaign.industry}` : ''}`, {
        x: 0.5,
        y: 1.3,
        w: 9,
        h: 0.4,
        fontSize: 14,
        color: '6B7280',
      })

      // Custom variables if any
      if (Object.keys(campaign.customVariables).length > 0) {
        const varsText = Object.entries(campaign.customVariables)
          .map(([k, v]) => `${k}: ${v}`)
          .join('  |  ')
        campaignSlide.addText(varsText, {
          x: 0.5,
          y: 1.8,
          w: 9,
          h: 0.3,
          fontSize: 10,
          color: '9CA3AF',
          italic: true,
        })
      }

      // Step outputs - each step gets a slide
      for (const stepOutput of campaign.stepOutputs) {
        if (!stepOutput.output) continue

        const stepSlide = pptx.addSlide({ masterName: 'GATTACA_MASTER' })
        stepSlide.addText(`${campaign.name}`, {
          x: 0.5,
          y: 0.7,
          w: 6,
          h: 0.3,
          fontSize: 10,
          color: '9CA3AF',
        })
        stepSlide.addText(stepOutput.stepName, {
          x: 0.5,
          y: 1,
          w: 9,
          h: 0.5,
          fontSize: 20,
          bold: true,
          color: '4F46E5',
        })

        // Output content - truncate if needed
        const outputText = stepOutput.output.length > 2500
          ? stepOutput.output.substring(0, 2500) + '\n\n[Contenido truncado...]'
          : stepOutput.output
        stepSlide.addText(stripMarkdown(outputText), {
          x: 0.5,
          y: 1.6,
          w: 9,
          h: 3.5,
          fontSize: 11,
          color: '374151',
          valign: 'top',
        })
      }
    }
  }

  // Inconsistencies slide (if any)
  if (config.includeInconsistencyReport && report.inconsistencies.length > 0) {
    const incSlide = pptx.addSlide({ masterName: 'GATTACA_MASTER' })
    incSlide.addText('Inconsistencias Detectadas', {
      x: 0.5,
      y: 0.7,
      w: 9,
      h: 0.5,
      fontSize: 24,
      bold: true,
      color: 'DC2626',
    })

    const incRows: any[][] = [
      [
        { text: 'Severidad', options: { bold: true, fill: { color: 'F3F4F6' } } },
        { text: 'Campo', options: { bold: true, fill: { color: 'F3F4F6' } } },
        { text: 'Descripcion', options: { bold: true, fill: { color: 'F3F4F6' } } },
      ],
    ]

    for (const inc of report.inconsistencies.slice(0, 8)) { // Limit to 8 rows
      incRows.push([
        { text: inc.severity === 'high' ? 'Alta' : inc.severity === 'medium' ? 'Media' : 'Baja' },
        { text: inc.field },
        { text: inc.description.substring(0, 100) },
      ])
    }

    incSlide.addTable(incRows, {
      x: 0.5,
      y: 1.3,
      w: 9,
      colW: [1.2, 2.3, 5.5],
      fontSize: 10,
      color: '374151',
      border: { pt: 0.5, color: 'E5E7EB' },
      valign: 'middle',
    })
  }

  // Recommendations slide (if any)
  if (config.includeRecommendations && report.recommendations && report.recommendations.length > 0) {
    const recSlide = pptx.addSlide({ masterName: 'GATTACA_MASTER' })
    recSlide.addText('Recomendaciones', {
      x: 0.5,
      y: 0.7,
      w: 9,
      h: 0.5,
      fontSize: 24,
      bold: true,
      color: '059669',
    })

    const recsText = report.recommendations
      .slice(0, 10) // Limit to 10
      .map((r, i) => `${i + 1}. ${r}`)
      .join('\n\n')
    recSlide.addText(recsText, {
      x: 0.5,
      y: 1.3,
      w: 9,
      h: 3.8,
      fontSize: 12,
      color: '374151',
      valign: 'top',
    })
  }

  // Generate PPTX file
  const pptxBuffer = await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer

  return new Response(pptxBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${report.projectName}-report.pptx"`,
    },
  })
}

/**
 * Strip markdown formatting for plain text display
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '') // headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/__([^_]+)__/g, '$1') // bold alt
    .replace(/_([^_]+)_/g, '$1') // italic alt
    .replace(/`([^`]+)`/g, '$1') // code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^[-*+]\s+/gm, '• ') // bullet points
    .replace(/^\d+\.\s+/gm, (match) => match) // keep numbered lists
    .replace(/---+/g, '') // horizontal rules
    .replace(/\n{3,}/g, '\n\n') // multiple newlines
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
