import { useState, useEffect, useCallback } from 'react'

export interface ClientPlaybook {
  id: string
  client_id: string
  playbook_type: string
  name: string
  description: string | null
  config: {
    flow_config?: {
      steps: any[]
    }
    phases?: any[]
    variables?: any[]
    presentation?: {
      name: string
      description: string
      icon?: string
    }
  }
  base_template_type: string
  is_enabled: boolean
  position: number
  created_at: string
  updated_at: string
}

export interface BasePlaybookTemplate {
  type: string
  name: string
  description: string
  isCustomized: boolean
}

interface UseClientPlaybooksReturn {
  /** Custom playbooks created for this client */
  customPlaybooks: ClientPlaybook[]
  /** Base playbook templates with customization status */
  basePlaybooks: BasePlaybookTemplate[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  /** Fork a base template to create a client-specific playbook */
  forkFromTemplate: (playbookType: string, name: string, description?: string) => Promise<ClientPlaybook | null>
  /** Update an existing client playbook */
  updatePlaybook: (id: string, updates: { name?: string; description?: string; config?: any; is_enabled?: boolean }) => Promise<ClientPlaybook | null>
  /** Delete a client playbook (revert to base template) */
  deletePlaybook: (id: string) => Promise<boolean>
  /** Check if a playbook type has been customized */
  hasCustomPlaybook: (playbookType: string) => boolean
  /** Get a custom playbook by ID */
  getPlaybookById: (playbookId: string) => ClientPlaybook | undefined
  /** Get custom playbooks by type */
  getPlaybooksByType: (playbookType: string) => ClientPlaybook[]
}

/**
 * Hook to manage playbooks at the client level
 * Allows forking base templates, customizing, and managing client-specific playbooks
 */
export function useClientPlaybooks(clientId: string | null): UseClientPlaybooksReturn {
  const [customPlaybooks, setCustomPlaybooks] = useState<ClientPlaybook[]>([])
  const [basePlaybooks, setBasePlaybooks] = useState<BasePlaybookTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlaybooks = useCallback(async () => {
    if (!clientId) {
      setCustomPlaybooks([])
      setBasePlaybooks([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v2/clients/${clientId}/playbooks?include_base=true`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch playbooks')
      }

      setCustomPlaybooks(data.customPlaybooks || [])
      setBasePlaybooks(data.basePlaybooks || [])
    } catch (err) {
      console.error('Error fetching client playbooks:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setCustomPlaybooks([])
      setBasePlaybooks([])
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchPlaybooks()
  }, [fetchPlaybooks])

  const forkFromTemplate = useCallback(async (
    playbookType: string,
    name: string,
    description?: string
  ): Promise<ClientPlaybook | null> => {
    if (!clientId) return null

    try {
      const response = await fetch(`/api/v2/clients/${clientId}/playbooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playbook_type: playbookType, name, description }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create playbook')
      }

      // Refresh the list
      await fetchPlaybooks()
      return data.playbook
    } catch (err) {
      console.error('Error forking playbook template:', err)
      throw err
    }
  }, [clientId, fetchPlaybooks])

  const updatePlaybook = useCallback(async (
    id: string,
    updates: { name?: string; description?: string; config?: any; is_enabled?: boolean }
  ): Promise<ClientPlaybook | null> => {
    if (!clientId) return null

    try {
      const response = await fetch(`/api/v2/clients/${clientId}/playbooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
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
  }, [clientId, fetchPlaybooks])

  const deletePlaybook = useCallback(async (id: string): Promise<boolean> => {
    if (!clientId) return false

    try {
      const response = await fetch(`/api/v2/clients/${clientId}/playbooks/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete playbook')
      }

      // Refresh the list
      await fetchPlaybooks()
      return true
    } catch (err) {
      console.error('Error deleting playbook:', err)
      throw err
    }
  }, [clientId, fetchPlaybooks])

  const hasCustomPlaybook = useCallback((playbookType: string): boolean => {
    return customPlaybooks.some(p =>
      p.playbook_type === playbookType ||
      p.playbook_type === playbookType.replace('_', '-') ||
      p.playbook_type === playbookType.replace('-', '_')
    )
  }, [customPlaybooks])

  const getPlaybookById = useCallback((playbookId: string): ClientPlaybook | undefined => {
    return customPlaybooks.find(p => p.id === playbookId)
  }, [customPlaybooks])

  const getPlaybooksByType = useCallback((playbookType: string): ClientPlaybook[] => {
    return customPlaybooks.filter(p =>
      p.playbook_type === playbookType ||
      p.playbook_type === playbookType.replace('_', '-') ||
      p.playbook_type === playbookType.replace('-', '_')
    )
  }, [customPlaybooks])

  return {
    customPlaybooks,
    basePlaybooks,
    loading,
    error,
    reload: fetchPlaybooks,
    forkFromTemplate,
    updatePlaybook,
    deletePlaybook,
    hasCustomPlaybook,
    getPlaybookById,
    getPlaybooksByType,
  }
}

export default useClientPlaybooks
