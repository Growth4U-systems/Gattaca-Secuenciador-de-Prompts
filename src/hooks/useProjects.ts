import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Project = any

export function useProjects(includeDeleted = false) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      let query = supabase
        .from('projects')
        .select('*, client:clients(id, name)')
        .order('created_at', { ascending: false })

      // Filter by status unless includeDeleted is true
      if (!includeDeleted) {
        query = query.or('status.is.null,status.neq.deleted')
      }

      const { data, error } = await query

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
  }, [includeDeleted])

  return { projects, loading, error, reload: loadProjects }
}

export function useDeletedProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('projects')
        .select('*, client:clients(id, name)')
        .eq('status', 'deleted')
        .order('deleted_at', { ascending: false })

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

      // Load project data with client info
      const { data, error } = await supabase
        .from('projects')
        .select('*, client:clients(id, name)')
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

  // Also insert into projects_legacy for FK compatibility with ecp_campaigns
  // This is a workaround until we consolidate the tables
  try {
    await supabase
      .from('projects_legacy')
      .insert({
        id: newProject.id,
        user_id: newProject.user_id,
        name: newProject.name,
        description: newProject.description,
        created_at: newProject.created_at,
        updated_at: newProject.updated_at,
      })
  } catch (legacyError) {
    // Silently ignore if projects_legacy doesn't exist or insert fails
    console.warn('Failed to sync to projects_legacy:', legacyError)
  }

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
  // Soft delete: update status to 'deleted' and set deleted_at timestamp
  const { error } = await supabase
    .from('projects')
    .update({
      status: 'deleted',
      deleted_at: new Date().toISOString()
    })
    .eq('id', projectId)

  if (error) throw error
}

export async function restoreProject(projectId: string) {
  const supabase = createClient()
  // Restore: set status back to 'active' and clear deleted_at
  const { data, error } = await supabase
    .from('projects')
    .update({
      status: 'active',
      deleted_at: null
    })
    .eq('id', projectId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function permanentlyDeleteProject(projectId: string) {
  const supabase = createClient()
  // Permanent delete: actually remove from database
  const { error } = await supabase.from('projects').delete().eq('id', projectId)

  if (error) throw error
}
