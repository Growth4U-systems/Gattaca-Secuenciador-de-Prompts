import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Document = any

export function useDocuments(projectId: string) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = async () => {
    if (!projectId) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('knowledge_base_docs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setDocuments(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [projectId])

  return { documents, loading, error, reload: loadDocuments }
}

export async function deleteDocument(docId: string) {
  const { error } = await supabase
    .from('knowledge_base_docs')
    .delete()
    .eq('id', docId)

  if (error) throw error
}

export async function createDocumentFromText(data: {
  projectId: string
  filename: string
  category: string
  content: string
}) {
  const { data: newDoc, error } = await supabase
    .from('knowledge_base_docs')
    .insert({
      project_id: data.projectId,
      filename: data.filename,
      category: data.category,
      extracted_content: data.content,
      file_size_bytes: data.content.length,
      mime_type: 'text/plain',
    })
    .select()
    .single()

  if (error) throw error
  return newDoc
}
