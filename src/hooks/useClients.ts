import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Client, ClientInsert, ClientUpdate } from '@/types/v2.types'

/**
 * Hook para listar clientes de una agencia.
 */
export function useClients(agencyId?: string) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadClients = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Load all clients (ignoring agency filter for now - dev mode)
      const { data, error: queryError } = await supabase
        .from('clients')
        .select('*')
        .order('updated_at', { ascending: false })

      if (queryError) throw queryError
      setClients(data || [])
    } catch (err) {
      console.error('Error loading clients:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  return {
    clients,
    loading,
    error,
    reload: loadClients,
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

  const updateClient = async (updates: ClientUpdate): Promise<void> => {
    if (!client) throw new Error('No hay cliente cargado')

    const { error } = await supabase
      .from('clients')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id)

    if (error) throw error
    await loadClient()
  }

  return {
    client,
    loading,
    error,
    reload: loadClient,
    updateClient,
  }
}

/**
 * Crear un nuevo cliente.
 */
export async function createClient(data: ClientInsert): Promise<Client> {
  // Generar slug
  const slug = data.slug || data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36)

  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      ...data,
      slug,
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
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)

  if (error) throw error
}
