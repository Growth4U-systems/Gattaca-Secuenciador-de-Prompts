import { useState, useEffect, useCallback } from 'react'

export interface ProjectPlaybook {
  id: string
  project_id: string
  playbook_type: string
  name: string
  config: Record<string, any>
  position: number
  created_at: string
  updated_at: string
}

interface UseProjectPlaybooksReturn {
  playbooks: ProjectPlaybook[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  addPlaybook: (playbookType: string, name: string, config?: Record<string, any>) => Promise<ProjectPlaybook | null>
  updatePlaybook: (playbookId: string, updates: { name?: string; config?: Record<string, any> }) => Promise<ProjectPlaybook | null>
  removePlaybook: (playbookId: string) => Promise<boolean>
  /** @deprecated Use removePlaybook with ID instead */
  removePlaybookByType: (playbookType: string) => Promise<boolean>
  hasPlaybook: (playbookType: string) => boolean
  getPlaybookById: (playbookId: string) => ProjectPlaybook | undefined
  getPlaybooksByType: (playbookType: string) => ProjectPlaybook[]
}

/**
 * Hook to manage playbooks associated with a project
 * Allows adding, removing, and listing playbooks for a project
 */
export function useProjectPlaybooks(projectId: string | null): UseProjectPlaybooksReturn {
  const [playbooks, setPlaybooks] = useState<ProjectPlaybook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlaybooks = useCallback(async () => {
    if (!projectId) {
      setPlaybooks([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/playbooks`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch playbooks')
      }

      setPlaybooks(data.playbooks || [])
    } catch (err) {
      console.error('Error fetching project playbooks:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setPlaybooks([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchPlaybooks()
  }, [fetchPlaybooks])

  const addPlaybook = useCallback(async (
    playbookType: string,
    name: string,
    config?: Record<string, any>
  ): Promise<ProjectPlaybook | null> => {
    if (!projectId) return null

    try {
      const response = await fetch(`/api/projects/${projectId}/playbooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playbook_type: playbookType, name, config }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add playbook')
      }

      // Refresh the list
      await fetchPlaybooks()
      return data.playbook
    } catch (err) {
      console.error('Error adding playbook:', err)
      throw err
    }
  }, [projectId, fetchPlaybooks])

  const updatePlaybook = useCallback(async (
    playbookId: string,
    updates: { name?: string; config?: Record<string, any> }
  ): Promise<ProjectPlaybook | null> => {
    if (!projectId) return null

    try {
      const response = await fetch(`/api/projects/${projectId}/playbooks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: playbookId, ...updates }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update playbook')
      }

      // Refresh the list
      await fetchPlaybooks()
      return data.playbook
    } catch (err) {
      console.error('Error updating playbook:', err)
      throw err
    }
  }, [projectId, fetchPlaybooks])

  const removePlaybook = useCallback(async (playbookId: string): Promise<boolean> => {
    if (!projectId) return false

    try {
      const response = await fetch(
        `/api/projects/${projectId}/playbooks?id=${encodeURIComponent(playbookId)}`,
        { method: 'DELETE' }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove playbook')
      }

      // Refresh the list
      await fetchPlaybooks()
      return true
    } catch (err) {
      console.error('Error removing playbook:', err)
      throw err
    }
  }, [projectId, fetchPlaybooks])

  /** @deprecated Use removePlaybook with ID instead */
  const removePlaybookByType = useCallback(async (playbookType: string): Promise<boolean> => {
    if (!projectId) return false

    try {
      const response = await fetch(
        `/api/projects/${projectId}/playbooks?playbook_type=${encodeURIComponent(playbookType)}`,
        { method: 'DELETE' }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove playbook')
      }

      // Refresh the list
      await fetchPlaybooks()
      return true
    } catch (err) {
      console.error('Error removing playbook:', err)
      throw err
    }
  }, [projectId, fetchPlaybooks])

  const hasPlaybook = useCallback((playbookType: string): boolean => {
    return playbooks.some(p => p.playbook_type === playbookType)
  }, [playbooks])

  const getPlaybookById = useCallback((playbookId: string): ProjectPlaybook | undefined => {
    return playbooks.find(p => p.id === playbookId)
  }, [playbooks])

  const getPlaybooksByType = useCallback((playbookType: string): ProjectPlaybook[] => {
    return playbooks.filter(p =>
      p.playbook_type === playbookType ||
      p.playbook_type === playbookType.replace('_', '-') ||
      p.playbook_type === playbookType.replace('-', '_')
    )
  }, [playbooks])

  return {
    playbooks,
    loading,
    error,
    reload: fetchPlaybooks,
    addPlaybook,
    updatePlaybook,
    removePlaybook,
    removePlaybookByType,
    hasPlaybook,
    getPlaybookById,
    getPlaybooksByType,
  }
}

export default useProjectPlaybooks
