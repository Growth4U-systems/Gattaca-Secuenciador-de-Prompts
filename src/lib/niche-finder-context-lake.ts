/**
 * Niche Finder Context Lake Integration
 *
 * Helper functions to save Niche Finder outputs to Context Lake
 * with proper metadata, tags, and organization.
 */

import { PlaybookStepSourceMetadata } from '@/hooks/useDocuments'

// ============================================
// TYPES
// ============================================

export interface NicheFinderSaveContext {
  projectId: string
  clientId: string
  userId: string
  campaignId: string
  campaignName: string
  jobId: string
}

export interface KeywordConfig {
  lifeContexts?: string[]
  productWords?: string[]
  needWords?: string[]
  urgencyIndicators?: string[]
  subreddits?: string[]
  forums?: string[]
}

export interface SaveToContextLakeOptions {
  context: NicheFinderSaveContext
  stepId: string
  stepName: string
  stepOrder: number
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate consistent tags for Context Lake documents
 */
function generateTags(context: NicheFinderSaveContext, additionalTags: string[] = []): string[] {
  const date = new Date().toISOString().split('T')[0]
  return [
    `fecha:${date}`,
    `job:${context.jobId}`,
    `campaign:${context.campaignId}`,
    'niche-finder',
    ...additionalTags,
  ]
}

/**
 * Generate folder path for organization
 */
function generateFolder(context: NicheFinderSaveContext): string {
  const date = new Date().toISOString().split('T')[0]
  const safeCampaignName = context.campaignName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  return `niche-finder/${safeCampaignName}/${date}`
}

/**
 * Build source metadata for traceability
 */
function buildSourceMetadata(
  context: NicheFinderSaveContext,
  stepId: string,
  stepName: string,
  stepOrder: number,
  inputStepIds: string[] = []
): PlaybookStepSourceMetadata {
  return {
    origin_type: 'flow_step_output',
    playbook_id: 'niche-finder',
    playbook_name: 'Niche Finder',
    campaign_id: context.campaignId,
    campaign_name: context.campaignName,
    campaign_variables: {},
    step_id: stepId,
    step_name: stepName,
    step_order: stepOrder,
    executed_at: new Date().toISOString(),
    model_used: 'system',
    model_provider: 'system',
    input_tokens: 0,
    output_tokens: 0,
    input_document_ids: [],
    input_previous_step_ids: inputStepIds,
    converted_at: new Date().toISOString(),
    converted_by: 'system',
    was_edited_before_conversion: false,
  }
}

// ============================================
// SAVE FUNCTIONS
// ============================================

/**
 * Save keyword configuration to Context Lake
 */
export async function saveKeywordsToContextLake(
  config: KeywordConfig,
  options: SaveToContextLakeOptions
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  const { context, stepId, stepName, stepOrder } = options

  try {
    // Build content as formatted text
    const lines: string[] = [
      '# Configuracion de Busqueda - Niche Finder',
      '',
      `**Campana:** ${context.campaignName}`,
      `**Fecha:** ${new Date().toISOString().split('T')[0]}`,
      '',
    ]

    if (config.lifeContexts?.length) {
      lines.push('## Contextos de Vida')
      config.lifeContexts.forEach(c => lines.push(`- ${c}`))
      lines.push('')
    }

    if (config.productWords?.length) {
      lines.push('## Palabras del Producto')
      config.productWords.forEach(w => lines.push(`- ${w}`))
      lines.push('')
    }

    if (config.needWords?.length) {
      lines.push('## Palabras de Necesidad')
      config.needWords.forEach(w => lines.push(`- ${w}`))
      lines.push('')
    }

    if (config.urgencyIndicators?.length) {
      lines.push('## Indicadores de Urgencia')
      config.urgencyIndicators.forEach(i => lines.push(`- ${i}`))
      lines.push('')
    }

    if (config.subreddits?.length) {
      lines.push('## Subreddits')
      config.subreddits.forEach(s => lines.push(`- r/${s}`))
      lines.push('')
    }

    if (config.forums?.length) {
      lines.push('## Foros')
      config.forums.forEach(f => lines.push(`- ${f}`))
      lines.push('')
    }

    const content = lines.join('\n')
    const date = new Date().toISOString().split('T')[0]

    const response = await fetch('/api/documents/from-step-output', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: context.projectId,
        clientId: context.clientId,
        filename: `Niche Finder - Keywords - ${date}`,
        category: 'research',
        content,
        description: `Configuracion de busqueda del Niche Finder: ${config.lifeContexts?.length || 0} contextos, ${config.needWords?.length || 0} palabras de necesidad`,
        tags: generateTags(context, ['keywords', 'configuracion']),
        userId: context.userId,
        sourceMetadata: buildSourceMetadata(context, stepId, stepName, stepOrder),
        sourceCampaignId: context.campaignId,
        sourceStepId: stepId,
        sourceStepName: stepName,
        sourcePlaybookId: 'niche-finder',
        folder: generateFolder(context),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to save keywords')
    }

    console.log('[Context Lake] Keywords saved:', data.document?.id)
    return { success: true, documentId: data.document?.id }

  } catch (error) {
    console.error('[Context Lake] Error saving keywords:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Save found URLs to Context Lake
 */
export async function saveUrlsToContextLake(
  urls: Array<{ url: string; title?: string; snippet?: string }>,
  options: SaveToContextLakeOptions
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  const { context, stepId, stepName, stepOrder } = options

  try {
    // Build CSV content
    const csvLines = ['url,title,snippet']
    urls.forEach(u => {
      const title = (u.title || '').replace(/"/g, '""')
      const snippet = (u.snippet || '').replace(/"/g, '""')
      csvLines.push(`"${u.url}","${title}","${snippet}"`)
    })

    const content = csvLines.join('\n')
    const date = new Date().toISOString().split('T')[0]

    const response = await fetch('/api/documents/from-step-output', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: context.projectId,
        clientId: context.clientId,
        filename: `Niche Finder - URLs - ${date}.csv`,
        category: 'research',
        content,
        description: `${urls.length} URLs encontradas por SERP search`,
        tags: generateTags(context, ['urls', 'serp']),
        userId: context.userId,
        sourceMetadata: buildSourceMetadata(context, stepId, stepName, stepOrder, ['keyword_config']),
        sourceCampaignId: context.campaignId,
        sourceStepId: stepId,
        sourceStepName: stepName,
        sourcePlaybookId: 'niche-finder',
        folder: generateFolder(context),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to save URLs')
    }

    console.log('[Context Lake] URLs saved:', data.document?.id)
    return { success: true, documentId: data.document?.id }

  } catch (error) {
    console.error('[Context Lake] Error saving URLs:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Save scraped content to Context Lake
 */
export async function saveScrapedContentToContextLake(
  scrapedData: Array<{ url: string; markdown: string; title?: string }>,
  options: SaveToContextLakeOptions
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  const { context, stepId, stepName, stepOrder } = options

  try {
    // Build markdown content with all scraped pages
    const lines: string[] = [
      '# Contenido Scrapeado - Niche Finder',
      '',
      `**Campana:** ${context.campaignName}`,
      `**Fecha:** ${new Date().toISOString().split('T')[0]}`,
      `**Total URLs:** ${scrapedData.length}`,
      '',
      '---',
      '',
    ]

    scrapedData.forEach((item, index) => {
      lines.push(`## ${index + 1}. ${item.title || item.url}`)
      lines.push(`**URL:** ${item.url}`)
      lines.push('')
      lines.push(item.markdown)
      lines.push('')
      lines.push('---')
      lines.push('')
    })

    const content = lines.join('\n')
    const date = new Date().toISOString().split('T')[0]

    const response = await fetch('/api/documents/from-step-output', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: context.projectId,
        clientId: context.clientId,
        filename: `Niche Finder - Contenido Scrapeado - ${date}.md`,
        category: 'research',
        content,
        description: `Contenido de ${scrapedData.length} paginas scrapeadas`,
        tags: generateTags(context, ['scraped', 'content', 'markdown']),
        userId: context.userId,
        sourceMetadata: buildSourceMetadata(context, stepId, stepName, stepOrder, ['keyword_config', 'search_and_preview']),
        sourceCampaignId: context.campaignId,
        sourceStepId: stepId,
        sourceStepName: stepName,
        sourcePlaybookId: 'niche-finder',
        folder: generateFolder(context),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to save scraped content')
    }

    console.log('[Context Lake] Scraped content saved:', data.document?.id)
    return { success: true, documentId: data.document?.id }

  } catch (error) {
    console.error('[Context Lake] Error saving scraped content:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Save extracted problems to Context Lake
 */
export async function saveExtractedProblemsToContextLake(
  problems: Array<{
    problem: string
    persona?: string
    functional_cause?: string
    emotional_load?: string
    evidence?: string
    alternatives?: string
    source_url?: string
  }>,
  options: SaveToContextLakeOptions
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  const { context, stepId, stepName, stepOrder } = options

  try {
    // Build CSV content
    const csvLines = ['problema,persona,causa_funcional,carga_emocional,evidencia,alternativas,url_fuente']
    problems.forEach(p => {
      const problem = (p.problem || '').replace(/"/g, '""')
      const persona = (p.persona || '').replace(/"/g, '""')
      const functionalCause = (p.functional_cause || '').replace(/"/g, '""')
      const emotionalLoad = (p.emotional_load || '').replace(/"/g, '""')
      const evidence = (p.evidence || '').replace(/"/g, '""')
      const alternatives = (p.alternatives || '').replace(/"/g, '""')
      const url = p.source_url || ''
      csvLines.push(`"${problem}","${persona}","${functionalCause}","${emotionalLoad}","${evidence}","${alternatives}","${url}"`)
    })

    const content = csvLines.join('\n')
    const date = new Date().toISOString().split('T')[0]

    const response = await fetch('/api/documents/from-step-output', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: context.projectId,
        clientId: context.clientId,
        filename: `Niche Finder - Problemas Extraidos - ${date}.csv`,
        category: 'research',
        content,
        description: `${problems.length} problemas extraidos de conversaciones reales`,
        tags: generateTags(context, ['problemas', 'extraidos', 'niches']),
        userId: context.userId,
        sourceMetadata: buildSourceMetadata(context, stepId, stepName, stepOrder, ['keyword_config', 'search_and_preview', 'review_and_scrape']),
        sourceCampaignId: context.campaignId,
        sourceStepId: stepId,
        sourceStepName: stepName,
        sourcePlaybookId: 'niche-finder',
        folder: generateFolder(context),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to save extracted problems')
    }

    console.log('[Context Lake] Extracted problems saved:', data.document?.id)
    return { success: true, documentId: data.document?.id }

  } catch (error) {
    console.error('[Context Lake] Error saving extracted problems:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Fetch project details to get clientId
 */
export async function getProjectClientId(projectId: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/projects/${projectId}`)
    if (!response.ok) return null
    const data = await response.json()
    return data.client_id || null
  } catch {
    return null
  }
}

/**
 * Fetch URLs from a job for saving
 */
export async function fetchJobUrls(jobId: string): Promise<Array<{ url: string; title?: string; snippet?: string }>> {
  try {
    const response = await fetch(`/api/niche-finder/jobs/${jobId}/urls?limit=1000`)
    if (!response.ok) return []
    const data = await response.json()
    return data.urls || []
  } catch {
    return []
  }
}

/**
 * Fetch scraped content from a job for saving
 */
export async function fetchScrapedContent(jobId: string): Promise<Array<{ url: string; markdown: string; title?: string }>> {
  try {
    const response = await fetch(`/api/niche-finder/jobs/${jobId}/scraped?limit=1000`)
    if (!response.ok) return []
    const data = await response.json()
    return data.urls || []
  } catch {
    return []
  }
}

/**
 * Fetch extracted problems from a job
 */
export async function fetchExtractedProblems(jobId: string): Promise<Array<{
  problem: string
  persona?: string
  functional_cause?: string
  emotional_load?: string
  evidence?: string
  alternatives?: string
  source_url?: string
}>> {
  try {
    const response = await fetch(`/api/niche-finder/results/${jobId}`)
    if (!response.ok) return []
    const data = await response.json()
    return data.niches || []
  } catch {
    return []
  }
}
