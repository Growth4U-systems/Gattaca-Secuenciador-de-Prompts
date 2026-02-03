import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

// Tipos inline para clientes
export type ClientStatus = 'active' | 'inactive' | 'archived'

export interface Client {
  id: string
  agency_id: string
  name: string
  slug: string
  description: string | null
  industry: string | null
  website_url: string | null
  logo_url: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  settings: Record<string, unknown>
  status: ClientStatus
  created_at: string
  updated_at: string
}

export type ClientInsert = {
  agency_id: string
  name: string
  slug?: string
  description?: string | null
  industry?: string | null
  website_url?: string | null
  logo_url?: string | null
  primary_contact_name?: string | null
  primary_contact_email?: string | null
  settings?: Record<string, unknown>
  status?: ClientStatus
}

export type ClientUpdate = Partial<ClientInsert>

// Helper to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

/**
 * Hook para listar todos los clientes.
 * Si se proporciona agencyId, filtra por agencia.
 * Si no, carga todos los clientes accesibles.
 */
export function useClients(agencyId?: string) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadClients = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      let query = supabase
        .from('clients')
        .select('*')
        .order('updated_at', { ascending: false })

      // If agencyId is provided, filter by it
      if (agencyId) {
        query = query.eq('agency_id', agencyId)
      }

      // Add 30-second timeout to prevent infinite loading
      // Execute query and wrap in timeout using Promise.resolve to ensure it's a real Promise
      const { data, error: queryError } = await withTimeout(
        Promise.resolve(query),
        30000,
        'La consulta de clientes tardó demasiado. Por favor, recarga la página.'
      )

      if (queryError) throw queryError
      setClients(data || [])
    } catch (err) {
      console.error('Error loading clients:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }, [agencyId])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  // Create client function that uses the hook's context
  const createClientFn = useCallback(async (name: string): Promise<Client> => {
    const supabase = createClient()

    // Get first agency or create a default one
    const { data: agencies } = await supabase
      .from('agencies')
      .select('id')
      .limit(1)
      .single()

    const agencyIdToUse = agencyId || agencies?.id

    if (!agencyIdToUse) {
      throw new Error('No agency found to create client')
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') +
      '-' +
      Date.now().toString(36)

    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        agency_id: agencyIdToUse,
        name,
        slug,
        settings: {},
        status: 'active',
      })
      .select()
      .single()

    if (error) throw error

    // Refresh the list
    await loadClients()

    return newClient
  }, [agencyId, loadClients])

  // Delete client function
  const deleteClientFn = useCallback(async (clientId: string): Promise<void> => {
    const supabase = createClient()
    const { error } = await supabase.from('clients').delete().eq('id', clientId)
    if (error) throw error
    // Refresh the list
    await loadClients()
  }, [loadClients])

  // Update client function
  const updateClientFn = useCallback(async (
    clientId: string,
    updates: ClientUpdate
  ): Promise<Client> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', clientId)
      .select()
      .single()
    if (error) throw error
    await loadClients()
    return data
  }, [loadClients])

  return {
    clients,
    loading,
    error,
    refetch: loadClients,
    createClient: createClientFn,
    updateClient: updateClientFn,
    deleteClient: deleteClientFn,
  }
}

/**
 * Hook para obtener un cliente específico.
 */
export function useClient(clientId: string) {
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadClient = useCallback(async () => {
    if (!clientId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      const { data, error: queryError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (queryError) throw queryError
      setClient(data)
    } catch (err) {
      console.error('Error loading client:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar cliente')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadClient()
  }, [loadClient])

  return {
    client,
    loading,
    error,
    refetch: loadClient,
  }
}

/**
 * Crear un nuevo cliente en una agencia.
 */
export async function createClientFn(data: ClientInsert): Promise<Client> {
  const supabase = createClient()
  const slug =
    data.slug ||
    data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') +
      '-' +
      Date.now().toString(36)

  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      ...data,
      slug,
      settings: data.settings || {},
      status: data.status || 'active',
    })
    .select()
    .single()

  if (error) throw error
  return newClient
}

/**
 * Eliminar un cliente.
 */
export async function deleteClientFn(clientId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) throw error
}
