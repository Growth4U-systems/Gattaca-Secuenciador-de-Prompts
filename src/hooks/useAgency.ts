import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Agency, AgencyInsert, AgencyUpdate } from '@/types/v2.types'

/**
 * Hook para obtener la agencia del usuario actual.
 * Si no existe, crea una por defecto.
 */
export function useAgency() {
  const [agency, setAgency] = useState<Agency | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAgency = async () => {
    try {
      setLoading(true)
      setError(null)

      // Obtener la primera agencia (modo single-tenant por ahora)
      const { data, error: queryError } = await supabase
        .from('agencies')
        .select('*')
        .limit(1)
        .single()

      if (queryError) {
        // Si no existe, intentar crearla
        if (queryError.code === 'PGRST116') {
          const newAgency = await createDefaultAgency()
          setAgency(newAgency)
          return
        }
        throw queryError
      }

      setAgency(data)
    } catch (err) {
      console.error('Error loading agency:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar la agencia')
    } finally {
      setLoading(false)
    }
  }

  const createDefaultAgency = async (): Promise<Agency> => {
    const { data, error } = await supabase
      .from('agencies')
      .insert({
        name: 'Mi Agencia',
        slug: 'mi-agencia',
        settings: {},
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  const updateAgency = async (updates: AgencyUpdate): Promise<void> => {
    if (!agency) throw new Error('No hay agencia cargada')

    const { error } = await supabase
      .from('agencies')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agency.id)

    if (error) throw error
    await loadAgency()
  }

  useEffect(() => {
    loadAgency()
  }, [])

  return {
    agency,
    loading,
    error,
    reload: loadAgency,
    updateAgency,
  }
}

/**
 * Hook para crear una nueva agencia.
 */
export async function createAgency(data: AgencyInsert): Promise<Agency> {
  const { data: newAgency, error } = await supabase
    .from('agencies')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return newAgency
}
