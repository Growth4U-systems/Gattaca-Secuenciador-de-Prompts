import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

// ============================================
// TYPES
// ============================================
export type DocumentSourceType = 'import' | 'scraper' | 'playbook' | 'api'

export type DocumentChangeType =
  | 'created'
  | 'manual_edit'
  | 'ai_suggestion'
  | 'regenerated'
  | 'imported'
  | 'merged'
  | 'restored'

export interface Document {
  id: string
  project_id?: string | null
  client_id?: string | null
  filename: string
  category: string
  extracted_content: string | null
  file_size_bytes: number | null
  mime_type: string | null
  storage_path?: string | null
  source_type: DocumentSourceType
  source_playbook_id?: string | null
  source_job_id?: string | null
  source_url?: string | null
  source_metadata?: Record<string, unknown>
  description?: string | null
  token_count?: number | null
  tags?: string[] | null
  campaign_id?: string | null
  created_at: string
  updated_at?: string
  // Traceability fields
  created_by?: string | null
  updated_by?: string | null
  source_campaign_id?: string | null
  source_step_id?: string | null
  source_step_name?: string | null
  // Soft delete
  is_deleted?: boolean
  deleted_at?: string | null
  deleted_by?: string | null
  // Folder organization
  folder?: string | null
  // Reference fields (for linking to Context Lake docs)
  is_reference?: boolean
  source_doc_id?: string | null
  // UI-only fields
  isShared?: boolean
  projectName?: string
  version_count?: number
}

export interface DocumentVersion {
  id: string
  document_id: string
  version_number: number
  extracted_content: string
  token_count: number | null
  change_type: DocumentChangeType
  change_summary: string | null
  created_by: string | null
  created_at: string
}

// Metadata structure for playbook step outputs
export interface PlaybookStepSourceMetadata {
  origin_type: 'flow_step_output'
  // Playbook context
  playbook_id: string
  playbook_name: string
  // Campaign context
  campaign_id: string
  campaign_name: string
  campaign_variables: {
    ecp_name?: string
    problem_core?: string
    country?: string
    industry?: string
    [key: string]: string | undefined
  }
  // Step context
  step_id: string
  step_name: string
  step_order: number
  // Execution info
  executed_at: string
  model_used: string
  model_provider: string
  input_tokens: number
  output_tokens: number
  // Input references
  input_document_ids: string[]
  input_previous_step_ids: string[]
  // Conversion info
  converted_at: string
  converted_by: string
  was_edited_before_conversion: boolean
}

export interface DocumentFilters {
  sourceType?: DocumentSourceType
  category?: string
  folder?: string | null // null = uncategorized, undefined = all
}

// ============================================
// FOLDER UTILITIES
// ============================================

/** Get unique folder names from documents */
export function getFolders(docs: Document[]): string[] {
  const folders = docs
    .map(d => d.folder)
    .filter((f): f is string => f !== null && f !== undefined)
  return [...new Set(folders)].sort()
}

/** Group documents by folder */
export function groupByFolder(docs: Document[]): Record<string, Document[]> {
  return docs.reduce((acc, doc) => {
    const folder = doc.folder || '__uncategorized__'
    if (!acc[folder]) acc[folder] = []
    acc[folder].push(doc)
    return acc
  }, {} as Record<string, Document[]>)
}

/** Get folder display name */
export function getFolderDisplayName(folder: string): string {
  return folder === '__uncategorized__' ? 'Sin carpeta' : folder
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
        .or('is_deleted.is.null,is_deleted.eq.false') // Filter out soft-deleted docs

      // Apply filters
      if (filters?.sourceType) {
        query = query.eq('source_type', filters.sourceType)
      }
      if (filters?.category) {
        query = query.eq('category', filters.category)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })

      if (error) throw error

      setDocuments(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [projectId, filters?.sourceType, filters?.category])

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
        .or('is_deleted.is.null,is_deleted.eq.false') // Filter out soft-deleted docs

      // Apply filters
      if (filters?.sourceType) {
        query = query.eq('source_type', filters.sourceType)
      }
      if (filters?.category) {
        query = query.eq('category', filters.category)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })

      if (error) throw error

      setDocuments(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [clientId, filters?.sourceType, filters?.category])

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
        .or('is_deleted.is.null,is_deleted.eq.false')

      if (filters?.sourceType) projectQuery = projectQuery.eq('source_type', filters.sourceType)
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
          .or('is_deleted.is.null,is_deleted.eq.false')

        if (filters?.sourceType) clientQuery = clientQuery.eq('source_type', filters.sourceType)
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

      // Sort by date
      allDocs.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      setDocuments(allDocs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [projectId, clientId, filters?.sourceType, filters?.category])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  return { documents, loading, error, reload: loadDocuments }
}

// Soft delete document (preserves for audit trail)
export async function deleteDocument(docId: string, userId?: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('knowledge_base_docs')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: userId || null,
    })
    .eq('id', docId)

  if (error) throw error
}

// Permanently delete document (use with caution)
export async function hardDeleteDocument(docId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('knowledge_base_docs')
    .delete()
    .eq('id', docId)

  if (error) throw error
}

// Restore soft-deleted document
export async function restoreDocument(docId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('knowledge_base_docs')
    .update({
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
    })
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
      source_type: data.sourceType || 'import',
      source_playbook_id: data.sourcePlaybookId || null,
      description: data.description || null,
    })
    .select()
    .single()

  if (error) throw error
  return newDoc
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
        .or('is_deleted.is.null,is_deleted.eq.false') // Filter out soft-deleted docs

      if (filters?.sourceType) clientQuery = clientQuery.eq('source_type', filters.sourceType)
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
          .or('is_deleted.is.null,is_deleted.eq.false') // Filter out soft-deleted docs

        if (filters?.sourceType) projectQuery = projectQuery.eq('source_type', filters.sourceType)
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

      // Combine and sort by date
      const allDocs = [...sharedDocs, ...allProjectDocs]
      allDocs.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      setDocuments(allDocs as Document[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [clientId, filters?.sourceType, filters?.category])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  return { documents, loading, error, reload: loadDocuments, projectsMap }
}

// ============================================
// CREATE DOCUMENT FROM STEP OUTPUT
// ============================================
export interface CreateFromStepOutputData {
  // Target location
  projectId?: string
  clientId?: string
  // Document info
  filename: string
  category: string
  content: string
  description?: string
  tags?: string[]
  // Traceability
  userId: string
  // Source metadata (playbook step context)
  sourceMetadata: PlaybookStepSourceMetadata
  // Source linkage
  sourceCampaignId: string
  sourceStepId: string
  sourceStepName: string
  sourcePlaybookId?: string
}

export async function createDocumentFromStepOutput(data: CreateFromStepOutputData) {
  const supabase = createClient()

  const { data: newDoc, error } = await supabase
    .from('knowledge_base_docs')
    .insert({
      project_id: data.projectId || null,
      client_id: data.clientId || null,
      filename: data.filename,
      category: data.category,
      extracted_content: data.content,
      file_size_bytes: new Blob([data.content]).size,
      mime_type: 'text/plain',
      source_type: 'playbook' as DocumentSourceType,
      source_playbook_id: data.sourcePlaybookId || null,
      source_metadata: data.sourceMetadata,
      description: data.description || null,
      tags: data.tags || null,
      // Traceability fields
      created_by: data.userId,
      updated_by: data.userId,
      source_campaign_id: data.sourceCampaignId,
      source_step_id: data.sourceStepId,
      source_step_name: data.sourceStepName,
    })
    .select()
    .single()

  if (error) throw error
  return newDoc
}

// ============================================
// GET DOCUMENT WITH VERSION COUNT
// ============================================
export async function getDocumentWithVersionCount(docId: string): Promise<Document | null> {
  const supabase = createClient()

  // Get document
  const { data: doc, error: docError } = await supabase
    .from('knowledge_base_docs')
    .select('*')
    .eq('id', docId)
    .single()

  if (docError) throw docError
  if (!doc) return null

  // Get version count
  const { count, error: countError } = await supabase
    .from('document_versions')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', docId)

  if (countError) throw countError

  return {
    ...doc,
    version_count: count || 0
  }
}

// ============================================
// FOLDER OPERATIONS
// ============================================

/** Update document folder */
export async function updateDocumentFolder(docId: string, folder: string | null) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('knowledge_base_docs')
    .update({ folder })
    .eq('id', docId)
    .select()
    .single()

  if (error) throw error
  return data
}

/** Move multiple documents to a folder */
export async function moveDocumentsToFolder(docIds: string[], folder: string | null) {
  const supabase = createClient()
  const { error } = await supabase
    .from('knowledge_base_docs')
    .update({ folder })
    .in('id', docIds)

  if (error) throw error
}

// ============================================
// REFERENCE OPERATIONS
// ============================================

/** Create a reference to a Context Lake document in a project */
export async function createDocumentReference(
  sourceDocId: string,
  projectId: string,
  folder?: string | null
): Promise<Document> {
  const supabase = createClient()

  // First, get the source document
  const { data: sourceDoc, error: fetchError } = await supabase
    .from('knowledge_base_docs')
    .select('*')
    .eq('id', sourceDocId)
    .single()

  if (fetchError) throw fetchError
  if (!sourceDoc) throw new Error('Source document not found')

  // Verify it's a Context Lake document (no project_id)
  if (sourceDoc.project_id) {
    throw new Error('Can only reference Context Lake documents (documents without a project)')
  }

  // Create the reference
  const { data: refDoc, error: insertError } = await supabase
    .from('knowledge_base_docs')
    .insert({
      filename: sourceDoc.filename,
      project_id: projectId,
      client_id: sourceDoc.client_id,
      category: sourceDoc.category,
      mime_type: sourceDoc.mime_type,
      file_size_bytes: sourceDoc.file_size_bytes,
      source_type: sourceDoc.source_type,
      description: sourceDoc.description,
      tags: sourceDoc.tags,
      folder: folder || null,
      is_reference: true,
      source_doc_id: sourceDocId,
      // Note: extracted_content is NOT copied - it's read from source
    })
    .select()
    .single()

  if (insertError) throw insertError
  return refDoc
}

/** Get the actual content of a document, following references if needed */
export async function getDocumentContent(doc: Document): Promise<string | null> {
  if (!doc.is_reference || !doc.source_doc_id) {
    return doc.extracted_content
  }

  // Fetch content from source document
  const supabase = createClient()
  const { data: sourceDoc, error } = await supabase
    .from('knowledge_base_docs')
    .select('extracted_content')
    .eq('id', doc.source_doc_id)
    .single()

  if (error) throw error
  return sourceDoc?.extracted_content || null
}

/** Promote a project document to Context Lake */
export async function promoteToContextLake(
  docId: string,
  options: {
    convertToReference?: boolean
    targetFolder?: string | null
  } = {}
): Promise<Document> {
  const supabase = createClient()

  // Get the original document
  const { data: originalDoc, error: fetchError } = await supabase
    .from('knowledge_base_docs')
    .select('*')
    .eq('id', docId)
    .single()

  if (fetchError) throw fetchError
  if (!originalDoc) throw new Error('Document not found')
  if (!originalDoc.project_id) {
    throw new Error('Document is already in Context Lake')
  }
  if (originalDoc.is_reference) {
    throw new Error('Cannot promote a reference document')
  }

  // Create copy in Context Lake (no project_id)
  const { data: newDoc, error: insertError } = await supabase
    .from('knowledge_base_docs')
    .insert({
      filename: originalDoc.filename,
      client_id: originalDoc.client_id,
      project_id: null, // This makes it a Context Lake doc
      category: originalDoc.category,
      extracted_content: originalDoc.extracted_content,
      mime_type: originalDoc.mime_type,
      file_size_bytes: originalDoc.file_size_bytes,
      storage_path: originalDoc.storage_path,
      source_type: originalDoc.source_type,
      description: originalDoc.description,
      tags: originalDoc.tags,
      token_count: originalDoc.token_count,
      folder: options.targetFolder || null,
      is_reference: false,
      source_doc_id: null,
    })
    .select()
    .single()

  if (insertError) throw insertError

  // Optionally convert original to a reference
  if (options.convertToReference) {
    const { error: updateError } = await supabase
      .from('knowledge_base_docs')
      .update({
        is_reference: true,
        source_doc_id: newDoc.id,
        extracted_content: null, // Clear content since it's now a reference
      })
      .eq('id', docId)

    if (updateError) throw updateError
  }

  return newDoc
}

/** Get documents that reference a given source document */
export async function getDocumentReferences(sourceDocId: string): Promise<Document[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('knowledge_base_docs')
    .select('*, projects(name)')
    .eq('source_doc_id', sourceDocId)
    .or('is_deleted.is.null,is_deleted.eq.false')

  if (error) throw error
  return data || []
}

/** Check if a document can be deleted (has no active references) */
export async function canDeleteDocument(docId: string): Promise<{
  canDelete: boolean
  referenceCount: number
  referencingProjects: string[]
}> {
  const refs = await getDocumentReferences(docId)
  const projectNames = refs
    .map(r => (r as Document & { projects?: { name: string } }).projects?.name)
    .filter((name): name is string => !!name)

  return {
    canDelete: refs.length === 0,
    referenceCount: refs.length,
    referencingProjects: [...new Set(projectNames)]
  }
}
