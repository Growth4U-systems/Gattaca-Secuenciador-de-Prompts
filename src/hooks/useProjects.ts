import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Project = any

export function useProjects(includeDeleted = false) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      let query = supabase
        .from('projects')
        .select('*, client:clients(id, name)')
        .order('created_at', { ascending: false })

      // Filter by status unless includeDeleted is true
      if (!includeDeleted) {
        query = query.or('status.is.null,status.neq.deleted')
      }

      // Execute query directly
      const { data, error: queryError } = await query

      if (queryError) throw queryError

      setProjects(data || [])
    } catch (err) {
      console.error('Error loading projects:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [includeDeleted])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  return { projects, loading, error, reload: loadProjects }
}

export function useDeletedProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()

      // Execute query directly
      const { data, error: queryError } = await supabase
        .from('projects')
        .select('*, client:clients(id, name)')
        .eq('status', 'deleted')
        .order('deleted_at', { ascending: false })

      if (queryError) throw queryError

      setProjects(data || [])
    } catch (err) {
      console.error('Error loading deleted projects:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  return { projects, loading, error, reload: loadProjects }
}

export function useProject(projectId: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProject = useCallback(async () => {
    if (!projectId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()

      // Get current user
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        throw new Error('No authenticated user')
      }

      // Load project data with client info
      const { data, error: queryError } = await supabase
        .from('projects')
        .select('*, client:clients(id, name)')
        .eq('id', projectId)
        .single()

      if (queryError) throw queryError

      setProject(data)

      // Get user's role in the project (non-blocking)
      try {
        const { data: role, error: roleError } = await supabase.rpc('get_user_project_role', {
          p_project_id: projectId,
          p_user_id: session.user.id
        })

        if (!roleError) {
          setUserRole(role)
        }
      } catch (roleErr) {
        console.warn('Could not fetch user role:', roleErr)
      }
    } catch (err) {
      console.error('Error loading project:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  return { project, userRole, loading, error, reload: loadProject }
}

export async function createProject(data: {
  name: string
  description?: string
  client_id: string
  playbook_type?: string | null  // Now truly optional - project can exist without a playbook
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

  // Build insert data - only include playbook_type if provided
  const insertData: Record<string, any> = {
    name: data.name,
    description: data.description,
    client_id: data.client_id,
    slug,
    status: 'active',
    goals: [],
    settings: {},
  }

  // Only set playbook_type if provided (for backwards compatibility)
  if (data.playbook_type) {
    insertData.playbook_type = data.playbook_type
  }

  const { data: newProject, error } = await supabase
    .from('projects')
    .insert(insertData)
    .select()
    .single()

  if (error) throw error

  // If a playbook_type was provided, also add it to project_playbooks table
  if (data.playbook_type) {
    try {
      await supabase
        .from('project_playbooks')
        .insert({
          project_id: newProject.id,
          playbook_type: data.playbook_type,
          position: 0,
        })
    } catch (playbookError) {
      // Silently ignore if table doesn't exist yet
      console.warn('Failed to add to project_playbooks:', playbookError)
    }
  }

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
