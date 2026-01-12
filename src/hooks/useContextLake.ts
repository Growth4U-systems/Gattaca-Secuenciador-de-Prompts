import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  Document,
  DocumentInsert,
  DocumentUpdate,
  DocumentTier,
  ApprovalStatus,
  ContextLakeStats,
  ListDocumentsParams,
} from '@/types/v2.types'

interface UseContextLakeOptions {
  tier?: DocumentTier
  documentType?: string
  approvalStatus?: ApprovalStatus
  search?: string
  sortBy?: 'authority_score' | 'created_at' | 'updated_at' | 'title' | 'validity_end'
  sortOrder?: 'asc' | 'desc'
  includeExpired?: boolean
}

/**
 * Hook principal para Context Lake - maneja documentos con sistema de tiers.
 */
export function useContextLake(clientId: string, options: UseContextLakeOptions = {}) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = useCallback(async () => {
    if (!clientId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('documents')
        .select('*')
        .eq('client_id', clientId)

      // Filtros
      if (options.tier) {
        query = query.eq('tier', options.tier)
      }
      if (options.documentType) {
        query = query.eq('document_type', options.documentType)
      }
      if (options.approvalStatus) {
        query = query.eq('approval_status', options.approvalStatus)
      }
      if (options.search) {
        query = query.or(`title.ilike.%${options.search}%,content.ilike.%${options.search}%`)
      }

      // Excluir expirados por defecto
      if (!options.includeExpired) {
        const today = new Date().toISOString().split('T')[0]
        query = query.or(`validity_end.is.null,validity_end.gte.${today}`)
      }

      // Ordenamiento
      const sortBy = options.sortBy || 'authority_score'
      const sortOrder = options.sortOrder || 'desc'
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })

      const { data, error: queryError } = await query

      if (queryError) throw queryError
      setDocuments(data || [])
    } catch (err) {
      console.error('Error loading documents:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar documentos')
    } finally {
      setLoading(false)
    }
  }, [
    clientId,
    options.tier,
    options.documentType,
    options.approvalStatus,
    options.search,
    options.sortBy,
    options.sortOrder,
    options.includeExpired,
  ])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // Estadísticas calculadas
  const stats: ContextLakeStats = useMemo(() => {
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const byTier: Record<DocumentTier, number> = { 1: 0, 2: 0, 3: 0 }
    const byType: Record<string, number> = {}
    const byStatus: Record<ApprovalStatus, number> = { draft: 0, approved: 0, archived: 0 }
    let totalTokens = 0
    let totalAuthority = 0
    let staleCount = 0
    let expiringCount = 0

    documents.forEach((doc) => {
      byTier[doc.tier]++
      byType[doc.document_type] = (byType[doc.document_type] || 0) + 1
      byStatus[doc.approval_status]++
      totalTokens += doc.token_count || 0
      totalAuthority += doc.authority_score || 0

      if (doc.validity_end) {
        const validityEnd = new Date(doc.validity_end)
        if (validityEnd < now) {
          staleCount++
        } else if (validityEnd <= sevenDaysFromNow) {
          expiringCount++
        }
      }
    })

    return {
      total: documents.length,
      byTier,
      byType,
      byStatus,
      totalTokens,
      avgAuthority: documents.length > 0 ? totalAuthority / documents.length : 0,
      staleCount,
      expiringCount,
    }
  }, [documents])

  // Documentos agrupados por tier
  const documentsByTier = useMemo(() => ({
    1: documents.filter((d) => d.tier === 1),
    2: documents.filter((d) => d.tier === 2),
    3: documents.filter((d) => d.tier === 3),
  }), [documents])

  return {
    documents,
    documentsByTier,
    stats,
    loading,
    error,
    reload: loadDocuments,
  }
}

/**
 * Hook para obtener un documento específico.
 */
export function useDocument(documentId: string) {
  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDocument = useCallback(async () => {
    if (!documentId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (queryError) throw queryError
      setDocument(data)
    } catch (err) {
      console.error('Error loading document:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar documento')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    loadDocument()
  }, [loadDocument])

  return {
    document,
    loading,
    error,
    reload: loadDocument,
  }
}

/**
 * Crear un nuevo documento en Context Lake.
 */
export async function createDocument(data: DocumentInsert): Promise<Document> {
  // Generar slug
  const slug = data.slug || data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36)

  const { data: newDoc, error } = await supabase
    .from('documents')
    .insert({
      ...data,
      slug,
      validity_start: data.validity_start || new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (error) throw error
  return newDoc
}

/**
 * Actualizar un documento.
 */
export async function updateDocument(documentId: string, updates: DocumentUpdate): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Eliminar un documento.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)

  if (error) throw error
}

/**
 * Cambiar el tier de un documento.
 */
export async function changeDocumentTier(documentId: string, newTier: DocumentTier): Promise<Document> {
  return updateDocument(documentId, { tier: newTier })
}

/**
 * Aprobar/rechazar un documento.
 */
export async function setDocumentApproval(documentId: string, status: ApprovalStatus): Promise<Document> {
  return updateDocument(documentId, { approval_status: status })
}

/**
 * Bulk update de documentos.
 */
export async function bulkUpdateDocuments(
  documentIds: string[],
  updates: DocumentUpdate
): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .in('id', documentIds)

  if (error) throw error
}

/**
 * Obtener documentos por tier para un cliente.
 */
export async function getDocumentsByTier(clientId: string, tier: DocumentTier): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('client_id', clientId)
    .eq('tier', tier)
    .eq('approval_status', 'approved')
    .order('authority_score', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Buscar documentos con contexto para un playbook.
 */
export async function getContextForPlaybook(
  clientId: string,
  options: {
    requiredTiers?: DocumentTier[]
    requiredTypes?: string[]
    maxTokens?: number
  } = {}
): Promise<Document[]> {
  let query = supabase
    .from('documents')
    .select('*')
    .eq('client_id', clientId)
    .eq('approval_status', 'approved')
    .order('authority_score', { ascending: false })

  if (options.requiredTiers?.length) {
    query = query.in('tier', options.requiredTiers)
  }
  if (options.requiredTypes?.length) {
    query = query.in('document_type', options.requiredTypes)
  }

  const { data, error } = await query

  if (error) throw error

  // Filtrar por tokens si hay límite
  if (options.maxTokens) {
    let totalTokens = 0
    const filtered: Document[] = []
    for (const doc of data || []) {
      if (totalTokens + (doc.token_count || 0) <= options.maxTokens) {
        filtered.push(doc)
        totalTokens += doc.token_count || 0
      }
    }
    return filtered
  }

  return data || []
}
