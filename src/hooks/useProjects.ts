import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Project = any

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
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
      const supabase = createClient()

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
  client_id: string
}) {
  const supabase = createClient()

  // Generate slug from name
  const slug =
    data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') +
    '-' +
    Date.now().toString(36)

  const { data: newProject, error } = await supabase
    .from('projects')
    .insert({
      name: data.name,
      description: data.description,
      client_id: data.client_id,
      slug,
      status: 'active',
      goals: [],
      settings: {},
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
  const supabase = createClient()
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
  const supabase = createClient()
  const { error } = await supabase.from('projects').delete().eq('id', projectId)

  if (error) throw error
}
