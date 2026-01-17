import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

// ============================================
// TYPES
// ============================================
export type DocumentTier = 'T1' | 'T2' | 'T3'
export type DocumentSourceType = 'manual' | 'scraper' | 'playbook' | 'api' | 'import'

export interface Document {
  id: string
  project_id?: string | null
  client_id?: string | null
  filename: string
  category: string
  extracted_content: string | null
  file_size_bytes: number | null
  mime_type: string | null
  storage_path: string | null
  source_type: DocumentSourceType
  source_playbook_id?: string | null
  tier: DocumentTier
  description?: string | null
  token_count?: number | null
  tags?: string[] | null
  campaign_id?: string | null
  created_at: string
  updated_at?: string
  isShared?: boolean
}

export interface DocumentFilters {
  sourceType?: DocumentSourceType
  tier?: DocumentTier
  category?: string
}

// ============================================
// HOOK: useDocuments (project-level)
// ============================================
export function useDocuments(projectId: string, filters?: DocumentFilters) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = useCallback(async () => {
    if (!projectId) return

    try {
      setLoading(true)
      const supabase = createClient()
      let query = supabase
        .from('knowledge_base_docs')
        .select('*')
        .eq('project_id', projectId)

      // Apply filters
      if (filters?.sourceType) {
        query = query.eq('source_type', filters.sourceType)
      }
      if (filters?.tier) {
        query = query.eq('tier', filters.tier)
      }
      if (filters?.category) {
        query = query.eq('category', filters.category)
      }

      const { data, error } = await query
        .order('tier', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error

      setDocuments(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [projectId, filters?.sourceType, filters?.tier, filters?.category])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  return { documents, loading, error, reload: loadDocuments }
}

// ============================================
// HOOK: useClientDocuments (client-level shared docs)
// ============================================
export function useClientDocuments(clientId: string, filters?: DocumentFilters) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = useCallback(async () => {
    if (!clientId) return

    try {
      setLoading(true)
      const supabase = createClient()
      let query = supabase
        .from('knowledge_base_docs')
        .select('*')
        .eq('client_id', clientId)
        .is('project_id', null) // Only client-level docs

      // Apply filters
      if (filters?.sourceType) {
        query = query.eq('source_type', filters.sourceType)
      }
      if (filters?.tier) {
        query = query.eq('tier', filters.tier)
      }
      if (filters?.category) {
        query = query.eq('category', filters.category)
      }

      const { data, error } = await query
        .order('tier', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error

      setDocuments(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [clientId, filters?.sourceType, filters?.tier, filters?.category])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  return { documents, loading, error, reload: loadDocuments }
}

// ============================================
// HOOK: useContextLake (combined project + client docs)
// ============================================
export function useContextLake(projectId: string, clientId?: string, filters?: DocumentFilters) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = useCallback(async () => {
    if (!projectId) return

    try {
      setLoading(true)
      const supabase = createClient()

      // Get project documents
      let projectQuery = supabase
        .from('knowledge_base_docs')
        .select('*')
        .eq('project_id', projectId)

      if (filters?.sourceType) projectQuery = projectQuery.eq('source_type', filters.sourceType)
      if (filters?.tier) projectQuery = projectQuery.eq('tier', filters.tier)
      if (filters?.category) projectQuery = projectQuery.eq('category', filters.category)

      const { data: projectDocs, error: projectError } = await projectQuery

      if (projectError) throw projectError

      let allDocs = projectDocs || []

      // If clientId is provided, also get client-level docs
      if (clientId) {
        let clientQuery = supabase
          .from('knowledge_base_docs')
          .select('*')
          .eq('client_id', clientId)
          .is('project_id', null)

        if (filters?.sourceType) clientQuery = clientQuery.eq('source_type', filters.sourceType)
        if (filters?.tier) clientQuery = clientQuery.eq('tier', filters.tier)
        if (filters?.category) clientQuery = clientQuery.eq('category', filters.category)

        const { data: clientDocs, error: clientError } = await clientQuery

        if (clientError) throw clientError

        // Mark client docs as shared
        const sharedDocs = (clientDocs || []).map(doc => ({
          ...doc,
          isShared: true
        }))

        allDocs = [...allDocs, ...sharedDocs]
      }

      // Sort: T1 first, then T2, then T3, then by date
      allDocs.sort((a, b) => {
        const tierOrder = { T1: 0, T2: 1, T3: 2 }
        const tierDiff = (tierOrder[a.tier as DocumentTier] || 2) - (tierOrder[b.tier as DocumentTier] || 2)
        if (tierDiff !== 0) return tierDiff
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      setDocuments(allDocs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [projectId, clientId, filters?.sourceType, filters?.tier, filters?.category])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  return { documents, loading, error, reload: loadDocuments }
}

export async function deleteDocument(docId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('knowledge_base_docs')
    .delete()
    .eq('id', docId)

  if (error) throw error
}

export async function createDocumentFromText(data: {
  projectId?: string
  clientId?: string
  filename: string
  category: string
  content: string
  sourceType?: DocumentSourceType
  sourcePlaybookId?: string
  tier?: DocumentTier
  description?: string
}) {
  const supabase = createClient()
  const { data: newDoc, error } = await supabase
    .from('knowledge_base_docs')
    .insert({
      project_id: data.projectId || null,
      client_id: data.clientId || null,
      filename: data.filename,
      category: data.category,
      extracted_content: data.content,
      file_size_bytes: data.content.length,
      mime_type: 'text/plain',
      source_type: data.sourceType || 'manual',
      source_playbook_id: data.sourcePlaybookId || null,
      tier: data.tier || 'T3',
      description: data.description || null,
    })
    .select()
    .single()

  if (error) throw error
  return newDoc
}

// ============================================
// UPDATE DOCUMENT TIER
// ============================================
export async function updateDocumentTier(docId: string, tier: DocumentTier) {
  const supabase = createClient()
  const { error } = await supabase
    .from('knowledge_base_docs')
    .update({ tier })
    .eq('id', docId)

  if (error) throw error
}

// ============================================
// UPDATE DOCUMENT
// ============================================
export async function updateDocument(docId: string, updates: Partial<Document>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('knowledge_base_docs')
    .update(updates)
    .eq('id', docId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// HOOK: useAllClientDocuments (ALL docs for a client including all projects)
// ============================================
export function useAllClientDocuments(clientId: string, filters?: DocumentFilters) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({})

  const loadDocuments = useCallback(async () => {
    if (!clientId) return

    try {
      setLoading(true)
      const supabase = createClient()

      // First, get all projects for this client
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('client_id', clientId)

      if (projectsError) throw projectsError

      const projectIds = projects?.map(p => p.id) || []
      const projectNames: Record<string, string> = {}
      projects?.forEach(p => {
        projectNames[p.id] = p.name
      })
      setProjectsMap(projectNames)

      // Get client-level documents
      let clientQuery = supabase
        .from('knowledge_base_docs')
        .select('*')
        .eq('client_id', clientId)
        .is('project_id', null)

      if (filters?.sourceType) clientQuery = clientQuery.eq('source_type', filters.sourceType)
      if (filters?.tier) clientQuery = clientQuery.eq('tier', filters.tier)
      if (filters?.category) clientQuery = clientQuery.eq('category', filters.category)

      const { data: clientDocs, error: clientError } = await clientQuery

      if (clientError) throw clientError

      // Get documents from all projects
      let projectDocs: Document[] = []
      if (projectIds.length > 0) {
        let projectQuery = supabase
          .from('knowledge_base_docs')
          .select('*')
          .in('project_id', projectIds)

        if (filters?.sourceType) projectQuery = projectQuery.eq('source_type', filters.sourceType)
        if (filters?.tier) projectQuery = projectQuery.eq('tier', filters.tier)
        if (filters?.category) projectQuery = projectQuery.eq('category', filters.category)

        const { data, error: projectError } = await projectQuery

        if (projectError) throw projectError
        projectDocs = data || []
      }

      // Mark client docs as shared, project docs with their project name
      const sharedDocs = (clientDocs || []).map(doc => ({
        ...doc,
        isShared: true,
        projectName: 'Cliente (compartido)'
      }))

      const allProjectDocs = projectDocs.map(doc => ({
        ...doc,
        isShared: false,
        projectName: projectNames[doc.project_id || ''] || 'Proyecto'
      }))

      // Combine and sort
      const allDocs = [...sharedDocs, ...allProjectDocs]

      // Sort: T1 first, then T2, then T3, then by date
      allDocs.sort((a, b) => {
        const tierOrder = { T1: 0, T2: 1, T3: 2 }
        const tierDiff = (tierOrder[a.tier as DocumentTier] || 2) - (tierOrder[b.tier as DocumentTier] || 2)
        if (tierDiff !== 0) return tierDiff
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      setDocuments(allDocs as Document[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [clientId, filters?.sourceType, filters?.tier, filters?.category])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  return { documents, loading, error, reload: loadDocuments, projectsMap }
}
