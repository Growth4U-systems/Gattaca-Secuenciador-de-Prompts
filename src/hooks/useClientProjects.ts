import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Project, ProjectInsert, ProjectUpdate } from '@/types/v2.types'

/**
 * Hook para listar proyectos de un cliente.
 * Los proyectos heredan el Context Lake del cliente.
 */
export function useClientProjects(clientId?: string) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    if (!clientId) {
      setProjects([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false })

      if (queryError) throw queryError
      setProjects(data || [])
    } catch (err) {
      console.error('Error loading projects:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar proyectos')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Stats
  const stats = {
    total: projects.length,
    byStatus: {
      active: projects.filter((p) => p.status === 'active').length,
      paused: projects.filter((p) => p.status === 'paused').length,
      archived: projects.filter((p) => p.status === 'archived').length,
      completed: projects.filter((p) => p.status === 'completed').length,
    },
  }

  return {
    projects,
    stats,
    loading,
    error,
    reload: loadProjects,
  }
}

/**
 * Hook para obtener un proyecto específico con su cliente.
 */
export function useProject(projectId: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
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

      const { data, error: queryError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (queryError) throw queryError
      setProject(data)
      setClientId(data?.client_id || null)
    } catch (err) {
      console.error('Error loading project:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar proyecto')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  const updateProject = async (updates: ProjectUpdate): Promise<void> => {
    if (!project) throw new Error('No hay proyecto cargado')

    const { error } = await supabase
      .from('projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id)

    if (error) throw error
    await loadProject()
  }

  return {
    project,
    clientId, // The client that owns this project (for Context Lake access)
    loading,
    error,
    reload: loadProject,
    updateProject,
  }
}

/**
 * Crear un nuevo proyecto dentro de un cliente.
 */
export async function createProject(data: ProjectInsert): Promise<Project> {
  // Generar slug
  const slug =
    data.slug ||
    data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') +
      '-' +
      Date.now().toString(36)

  const { data: newProject, error } = await supabase
    .from('projects')
    .insert({
      ...data,
      slug,
      goals: data.goals || [],
      settings: data.settings || {},
    })
    .select()
    .single()

  if (error) throw error
  return newProject
}

/**
 * Actualizar un proyecto.
 */
export async function updateProjectById(
  projectId: string,
  updates: ProjectUpdate
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Eliminar un proyecto.
 */
export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId)

  if (error) throw error
}

/**
 * Cambiar el estado de un proyecto.
 */
export async function setProjectStatus(
  projectId: string,
  status: Project['status']
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)

  if (error) throw error
}
