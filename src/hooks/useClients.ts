import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

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

/**
 * Hook para listar todos los clientes de una agencia.
 */
export function useClients(agencyId?: string) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadClients = useCallback(async () => {
    if (!agencyId) {
      setClients([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase
        .from('clients')
        .select('*')
        .eq('agency_id', agencyId)
        .order('updated_at', { ascending: false })

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

  return {
    clients,
    loading,
    error,
    refetch: loadClients,
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
export async function createClient(data: ClientInsert): Promise<Client> {
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
export async function deleteClient(clientId: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) throw error
}
