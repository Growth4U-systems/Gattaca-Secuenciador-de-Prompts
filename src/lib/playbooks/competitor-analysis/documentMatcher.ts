/**
 * Competitor Analysis Playbook - Document Matcher
 *
 * Utilidad para hacer matching de documentos por metadata.
 * Busca documentos existentes por competitor + source_type.
 */

import type {
  MatchResult,
  ExistingDocumentOption,
  Document,
  DocumentMetadata,
  SourceType,
} from './types'

// ============================================
// TYPES FOR SUPABASE CLIENT
// ============================================

/**
 * Interface genérica para el cliente de Supabase.
 * Permite que el package sea agnóstico al cliente específico.
 * Usamos any para simplificar la cadena de queries, ya que
 * el tipo real de Supabase es muy complejo.
 */
export interface SupabaseClientLike {
  from: (table: string) => {
    select: (columns?: string) => SupabaseQueryBuilder
  }
}

interface SupabaseQueryBuilder {
  eq: (column: string, value: string) => SupabaseQueryBuilder
  in: (column: string, values: string[]) => SupabaseQueryBuilder
  contains: (column: string, value: object) => SupabaseQueryBuilder
  order: (column: string, options: { ascending: boolean }) => SupabaseQueryBuilder
  limit: (count: number) => Promise<{ data: any[] | null; error: any }>
}

// ============================================
// DOCUMENT MATCHING FUNCTIONS
// ============================================

/**
 * Busca un documento por proyecto, competidor y tipo de fuente.
 * Retorna el documento más reciente que coincida.
 *
 * Searches in knowledge_base_docs table using source_metadata for matching.
 */
export async function matchDocumentForStep(
  supabase: SupabaseClientLike,
  projectId: string,
  competitorName: string,
  sourceType: SourceType
): Promise<MatchResult> {
  try {
    // Buscar documentos con source_metadata matching
    // Documents from scrapers have: source_metadata.competitor, source_metadata.source_type
    // Documents from deep research have: source_metadata.competitor, source_metadata.source_type
    const { data: docs, error } = await supabase
      .from('knowledge_base_docs')
      .select('*')
      .eq('project_id', projectId)
      .contains('source_metadata', { competitor: competitorName, source_type: sourceType })
      .order('created_at', { ascending: false })
      .limit(5) // Traer hasta 5 para dar opciones

    if (error) {
      console.error('Error matching document:', error)
      return { documentId: null, status: 'missing' }
    }

    if (docs && docs.length > 0) {
      const existingOptions: ExistingDocumentOption[] = docs.map((doc) => ({
        id: doc.id,
        name: doc.filename || doc.name,
        createdAt: doc.created_at,
        daysSinceCreation: getDaysSince(doc.created_at),
      }))

      // Map knowledge_base_docs fields to Document type
      const mappedDoc: Document = {
        id: docs[0].id,
        name: docs[0].filename || docs[0].name,
        project_id: docs[0].project_id,
        content: docs[0].extracted_content,
        metadata: docs[0].source_metadata,
        created_at: docs[0].created_at,
      }

      return {
        documentId: docs[0].id,
        status: 'available',
        document: mappedDoc,
        existingOptions,
      }
    }

    // Si no encontramos por source_metadata, no intentamos fallback
    // El fallback por nombre era problemático con la API de Supabase

    return { documentId: null, status: 'missing' }
  } catch (error) {
    console.error('Error in matchDocumentForStep:', error)
    return { documentId: null, status: 'missing' }
  }
}

/**
 * Busca todos los documentos existentes para un competidor.
 * Agrupa por source_type.
 *
 * Searches in knowledge_base_docs table using source_metadata.
 */
export async function findAllDocumentsForCompetitor(
  supabase: SupabaseClientLike,
  projectId: string,
  competitorName: string
): Promise<Map<SourceType, Document[]>> {
  const result = new Map<SourceType, Document[]>()

  try {
    const { data: docs, error } = await supabase
      .from('knowledge_base_docs')
      .select('*')
      .eq('project_id', projectId)
      .contains('source_metadata', { competitor: competitorName })
      .order('created_at', { ascending: false })
      .limit(100)

    if (error || !docs) {
      console.error('Error finding documents for competitor:', error)
      return result
    }

    // Agrupar por source_type
    for (const doc of docs) {
      const sourceType = doc.source_metadata?.source_type as SourceType
      if (sourceType) {
        if (!result.has(sourceType)) {
          result.set(sourceType, [])
        }
        // Map to Document type
        const mappedDoc: Document = {
          id: doc.id,
          name: doc.filename || doc.name,
          project_id: doc.project_id,
          content: doc.extracted_content,
          metadata: doc.source_metadata,
          created_at: doc.created_at,
        }
        result.get(sourceType)!.push(mappedDoc)
      }
    }

    return result
  } catch (error) {
    console.error('Error in findAllDocumentsForCompetitor:', error)
    return result
  }
}

/**
 * Verifica si un scraper job está en progreso para un documento.
 *
 * Checks scraper_jobs table for running jobs with matching custom_metadata.
 */
export async function checkScraperJobInProgress(
  supabase: SupabaseClientLike,
  projectId: string,
  competitorName: string,
  sourceType: SourceType
): Promise<boolean> {
  try {
    // Jobs store custom metadata in provider_metadata.custom_metadata
    // We need to check for jobs where provider_metadata.custom_metadata contains
    // the competitor and source_type
    const { data: jobs, error } = await supabase
      .from('scraper_jobs')
      .select('id, status, provider_metadata')
      .eq('project_id', projectId)
      .in('status', ['pending', 'running', 'processing'])
      .limit(50)

    if (error) {
      console.error('Error checking scraper job:', error)
      return false
    }

    if (!jobs || jobs.length === 0) {
      return false
    }

    // Filter jobs that match the competitor and source_type in custom_metadata
    const matchingJobs = jobs.filter((job) => {
      const providerMeta = job.provider_metadata as Record<string, unknown> | null
      const customMeta = providerMeta?.custom_metadata as Record<string, unknown> | undefined
      return (
        customMeta?.competitor === competitorName &&
        customMeta?.source_type === sourceType
      )
    })

    return matchingJobs.length > 0
  } catch (error) {
    console.error('Error in checkScraperJobInProgress:', error)
    return false
  }
}

/**
 * Obtiene el estado de todos los documentos requeridos para un paso.
 */
export async function getDocumentStatusForStep(
  supabase: SupabaseClientLike,
  projectId: string,
  competitorName: string,
  requiredSourceTypes: SourceType[]
): Promise<Map<SourceType, MatchResult>> {
  const results = new Map<SourceType, MatchResult>()

  // Ejecutar todas las búsquedas en paralelo
  const promises = requiredSourceTypes.map(async (sourceType) => {
    const result = await matchDocumentForStep(
      supabase,
      projectId,
      competitorName,
      sourceType
    )

    // Si está missing, verificar si hay un job en progreso
    if (result.status === 'missing') {
      const inProgress = await checkScraperJobInProgress(
        supabase,
        projectId,
        competitorName,
        sourceType
      )
      if (inProgress) {
        result.status = 'in_progress'
      }
    }

    return { sourceType, result }
  })

  const resolved = await Promise.all(promises)

  for (const { sourceType, result } of resolved) {
    results.set(sourceType, result)
  }

  return results
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calcula los días desde una fecha.
 */
function getDaysSince(dateString: string): number {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Formatea la fecha de creación de forma amigable.
 */
export function formatCreatedAt(dateString: string): string {
  const days = getDaysSince(dateString)

  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 30) return `Hace ${Math.floor(days / 7)} semanas`
  if (days < 365) return `Hace ${Math.floor(days / 30)} meses`
  return `Hace ${Math.floor(days / 365)} años`
}

/**
 * Genera metadata para un nuevo documento.
 */
export function createDocumentMetadata(
  competitorName: string,
  sourceType: SourceType,
  campaignId?: string,
  scraperInput?: Record<string, any>,
  scraperId?: string
): DocumentMetadata {
  return {
    competitor: competitorName,
    source_type: sourceType,
    campaign_id: campaignId,
    scraper_id: scraperId,
    scraped_at: new Date().toISOString(),
    scraper_input: scraperInput,
  }
}

/**
 * Genera un nombre estandarizado para un documento.
 */
export function generateDocumentName(
  sourceType: SourceType,
  competitorName: string
): string {
  const sourceTypeLabels: Record<SourceType, string> = {
    deep_research: 'Deep Research',
    website: 'Website Content',
    seo_serp: 'SEO SERP Data',
    news_corpus: 'News Corpus',
    instagram_posts: 'Instagram Posts',
    facebook_posts: 'Facebook Posts',
    linkedin_posts: 'LinkedIn Posts',
    linkedin_insights: 'LinkedIn Insights',
    youtube_videos: 'YouTube Videos',
    tiktok_posts: 'TikTok Posts',
    instagram_comments: 'Instagram Comments',
    facebook_comments: 'Facebook Comments',
    linkedin_comments: 'LinkedIn Comments',
    youtube_comments: 'YouTube Comments',
    tiktok_comments: 'TikTok Comments',
    trustpilot_reviews: 'Trustpilot Reviews',
    g2_reviews: 'G2 Reviews',
    capterra_reviews: 'Capterra Reviews',
    playstore_reviews: 'Play Store Reviews',
    appstore_reviews: 'App Store Reviews',
  }

  const label = sourceTypeLabels[sourceType] || sourceType
  const date = new Date().toISOString().split('T')[0]

  return `${label} - ${competitorName} - ${date}`
}
