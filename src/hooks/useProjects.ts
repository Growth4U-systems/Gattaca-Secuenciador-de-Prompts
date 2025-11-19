import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Project = any

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setProjects(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  return { projects, loading, error, reload: loadProjects }
}

export function useProject(projectId: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProject = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (error) throw error

      setProject(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (projectId) {
      loadProject()
    }
  }, [projectId])

  return { project, loading, error, reload: loadProject }
}

export async function createProject(data: {
  name: string
  description?: string
}) {
  // For now, use a dummy user_id since we don't have auth yet
  const { data: newProject, error } = await supabase
    .from('projects')
    .insert({
      ...data,
      user_id: '00000000-0000-0000-0000-000000000000', // Placeholder
    })
    .select()
    .single()

  if (error) throw error
  return newProject
}

export async function updateProject(
  projectId: string,
  updates: Partial<any>
) {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteProject(projectId: string) {
  const { error } = await supabase.from('projects').delete().eq('id', projectId)

  if (error) throw error
}
