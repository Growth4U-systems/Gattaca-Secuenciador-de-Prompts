'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { DocumentVersion, DocumentChangeType } from './useDocuments'

// ============================================
// TYPES
// ============================================

export interface UseDocumentVersionsReturn {
  versions: DocumentVersion[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  restoreVersion: (versionId: string, userId: string) => Promise<void>
}

// ============================================
// HOOK: useDocumentVersions
// ============================================

export function useDocumentVersions(documentId: string): UseDocumentVersionsReturn {
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadVersions = useCallback(async () => {
    if (!documentId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()

      const { data, error: queryError } = await supabase
        .from('document_versions')
        .select('*')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })

      if (queryError) throw queryError

      setVersions(data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading versions')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    loadVersions()
  }, [loadVersions])

  const restoreVersion = useCallback(async (versionId: string, userId: string) => {
    const supabase = createClient()

    // Get the version to restore
    const { data: version, error: versionError } = await supabase
      .from('document_versions')
      .select('*')
      .eq('id', versionId)
      .single()

    if (versionError) throw versionError
    if (!version) throw new Error('Version not found')

    // Update the document with the restored content
    // This will trigger the version creation trigger with the new content
    const { error: updateError } = await supabase
      .from('knowledge_base_docs')
      .update({
        extracted_content: version.extracted_content,
        token_count: version.token_count,
        updated_by: userId,
      })
      .eq('id', documentId)

    if (updateError) throw updateError

    // Get the newly created version and update its change_type to 'restored'
    const { data: latestVersion, error: latestError } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    if (latestError) throw latestError

    // Update the change_type to 'restored' with a summary
    const { error: updateVersionError } = await supabase
      .from('document_versions')
      .update({
        change_type: 'restored' as DocumentChangeType,
        change_summary: `Restaurado desde versión ${version.version_number}`,
      })
      .eq('id', latestVersion.id)

    if (updateVersionError) throw updateVersionError

    // Reload versions
    await loadVersions()
  }, [documentId, loadVersions])

  return { versions, loading, error, reload: loadVersions, restoreVersion }
}

// ============================================
// HELPER: Get latest version
// ============================================

export async function getLatestVersion(documentId: string): Promise<DocumentVersion | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // No rows found
    throw error
  }

  return data
}

// ============================================
// HELPER: Get version count
// ============================================

export async function getVersionCount(documentId: string): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('document_versions')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', documentId)

  if (error) throw error

  return count || 0
}

// ============================================
// HELPER: Create manual version
// ============================================

export async function createManualVersion(
  documentId: string,
  content: string,
  userId: string,
  changeType: DocumentChangeType = 'manual_edit',
  changeSummary?: string
): Promise<DocumentVersion> {
  const supabase = createClient()

  // Get next version number
  const { data: maxVersion, error: maxError } = await supabase
    .from('document_versions')
    .select('version_number')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  if (maxError && maxError.code !== 'PGRST116') throw maxError

  const nextVersionNumber = (maxVersion?.version_number || 0) + 1

  // Calculate token count (rough estimate: ~4 chars per token)
  const tokenCount = Math.ceil(content.length / 4)

  // Create the version
  const { data: newVersion, error: insertError } = await supabase
    .from('document_versions')
    .insert({
      document_id: documentId,
      version_number: nextVersionNumber,
      extracted_content: content,
      token_count: tokenCount,
      change_type: changeType,
      change_summary: changeSummary || null,
      created_by: userId,
    })
    .select()
    .single()

  if (insertError) throw insertError

  return newVersion
}

// ============================================
// HELPER: Format change type for display
// ============================================

export function formatChangeType(changeType: DocumentChangeType): string {
  const labels: Record<DocumentChangeType, string> = {
    created: 'Creado',
    manual_edit: 'Editado manualmente',
    ai_suggestion: 'Sugerencia de IA',
    regenerated: 'Regenerado',
    imported: 'Importado',
    merged: 'Fusionado',
    restored: 'Restaurado',
  }
  return labels[changeType] || changeType
}

// ============================================
// HELPER: Get change type icon
// ============================================

export function getChangeTypeIcon(changeType: DocumentChangeType): string {
  const icons: Record<DocumentChangeType, string> = {
    created: '✨',
    manual_edit: '✏️',
    ai_suggestion: '🤖',
    regenerated: '🔄',
    imported: '📥',
    merged: '🔀',
    restored: '↩️',
  }
  return icons[changeType] || '📄'
}
