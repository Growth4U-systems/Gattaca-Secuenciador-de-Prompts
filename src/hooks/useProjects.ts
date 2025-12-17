import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

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
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProject = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        throw new Error('No authenticated user')
      }

      // Load project data
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (error) throw error

      setProject(data)

      // Get user's role in the project
      const { data: role, error: roleError } = await supabase
        .rpc('get_user_project_role', {
          p_project_id: projectId,
          p_user_id: session.user.id
        })

      if (!roleError) {
        setUserRole(role)
      }
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

  return { project, userRole, loading, error, reload: loadProject }
}

export async function createProject(data: {
  name: string
  description?: string
}) {
  // Get current authenticated user
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    throw new Error('No authenticated user')
  }

  const { data: newProject, error } = await supabase
    .from('projects')
    .insert({
      ...data,
      user_id: session.user.id, // Use authenticated user's ID
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
