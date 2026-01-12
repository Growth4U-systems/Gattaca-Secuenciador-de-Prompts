import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  Playbook,
  PlaybookInsert,
  PlaybookUpdate,
  PlaybookType,
  PlaybookStatus,
  PlaybookStats,
  PlaybookBlock,
  PlaybookConfig,
} from '@/types/v2.types'

interface UsePlaybooksOptions {
  type?: PlaybookType
  status?: PlaybookStatus
  tags?: string[]
  search?: string
}

/**
 * Hook para listar playbooks de una agencia.
 */
export function usePlaybooks(agencyId: string, options: UsePlaybooksOptions = {}) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPlaybooks = useCallback(async () => {
    if (!agencyId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('playbooks')
        .select('*')
        .eq('agency_id', agencyId)

      // Filtros
      if (options.type) {
        query = query.eq('type', options.type)
      }
      if (options.status) {
        query = query.eq('status', options.status)
      }
      if (options.tags?.length) {
        query = query.contains('tags', options.tags)
      }
      if (options.search) {
        query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`)
      }

      query = query.order('updated_at', { ascending: false })

      const { data, error: queryError } = await query

      if (queryError) throw queryError
      setPlaybooks(data || [])
    } catch (err) {
      console.error('Error loading playbooks:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar playbooks')
    } finally {
      setLoading(false)
    }
  }, [agencyId, options.type, options.status, options.tags, options.search])

  useEffect(() => {
    loadPlaybooks()
  }, [loadPlaybooks])

  // Estadísticas
  const stats: PlaybookStats = useMemo(() => {
    const byType: Record<PlaybookType, number> = { playbook: 0, enricher: 0 }
    const byStatus: Record<PlaybookStatus, number> = { draft: 0, active: 0, archived: 0 }

    playbooks.forEach((p) => {
      byType[p.type]++
      byStatus[p.status]++
    })

    return {
      total: playbooks.length,
      byType,
      byStatus,
      totalExecutions: 0, // TODO: calcular desde executions
      successRate: 0, // TODO: calcular desde executions
    }
  }, [playbooks])

  return {
    playbooks,
    stats,
    loading,
    error,
    reload: loadPlaybooks,
  }
}

/**
 * Hook para obtener un playbook específico.
 */
export function usePlaybook(playbookId: string) {
  const [playbook, setPlaybook] = useState<Playbook | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPlaybook = useCallback(async () => {
    if (!playbookId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase
        .from('playbooks')
        .select('*')
        .eq('id', playbookId)
        .single()

      if (queryError) throw queryError
      setPlaybook(data)
    } catch (err) {
      console.error('Error loading playbook:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar playbook')
    } finally {
      setLoading(false)
    }
  }, [playbookId])

  useEffect(() => {
    loadPlaybook()
  }, [loadPlaybook])

  const updatePlaybook = async (updates: PlaybookUpdate): Promise<void> => {
    if (!playbook) throw new Error('No hay playbook cargado')

    const { error } = await supabase
      .from('playbooks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', playbook.id)

    if (error) throw error
    await loadPlaybook()
  }

  return {
    playbook,
    loading,
    error,
    reload: loadPlaybook,
    updatePlaybook,
  }
}

/**
 * Crear un nuevo playbook.
 */
export async function createPlaybook(data: PlaybookInsert): Promise<Playbook> {
  // Generar slug
  const slug = data.slug || data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36)

  const { data: newPlaybook, error } = await supabase
    .from('playbooks')
    .insert({
      ...data,
      slug,
    })
    .select()
    .single()

  if (error) throw error
  return newPlaybook
}

/**
 * Actualizar un playbook.
 */
export async function updatePlaybookById(playbookId: string, updates: PlaybookUpdate): Promise<Playbook> {
  const { data, error } = await supabase
    .from('playbooks')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', playbookId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Eliminar un playbook.
 */
export async function deletePlaybook(playbookId: string): Promise<void> {
  const { error } = await supabase
    .from('playbooks')
    .delete()
    .eq('id', playbookId)

  if (error) throw error
}

/**
 * Duplicar un playbook.
 */
export async function duplicatePlaybook(playbookId: string, newName?: string): Promise<Playbook> {
  const { data: original, error: fetchError } = await supabase
    .from('playbooks')
    .select('*')
    .eq('id', playbookId)
    .single()

  if (fetchError) throw fetchError

  const duplicated: PlaybookInsert = {
    agency_id: original.agency_id,
    name: newName || `${original.name} (copia)`,
    description: original.description,
    type: original.type,
    tags: original.tags,
    config: original.config,
    version: '1.0.0',
    status: 'draft',
    schedule_enabled: false,
    schedule_cron: null,
    schedule_timezone: original.schedule_timezone,
    author_id: original.author_id,
  }

  return createPlaybook(duplicated)
}

/**
 * Cambiar el estado de un playbook.
 */
export async function setPlaybookStatus(playbookId: string, status: PlaybookStatus): Promise<Playbook> {
  return updatePlaybookById(playbookId, { status })
}

/**
 * Incrementar la versión del playbook.
 */
export function incrementVersion(currentVersion: string): string {
  const parts = currentVersion.split('.').map(Number)
  if (parts.length !== 3) return '1.0.1'

  parts[2]++ // Patch
  if (parts[2] >= 10) {
    parts[2] = 0
    parts[1]++ // Minor
  }
  if (parts[1] >= 10) {
    parts[1] = 0
    parts[0]++ // Major
  }

  return parts.join('.')
}

/**
 * Crear un playbook vacío con estructura base.
 */
export function createEmptyPlaybookConfig(): PlaybookConfig {
  return {
    blocks: [],
    context_requirements: {
      required_documents: [],
      dynamic_queries: [],
    },
    input_schema: {},
    output_config: {
      destination: 'context_lake',
    },
  }
}

/**
 * Crear un bloque vacío.
 */
export function createEmptyBlock(order: number): PlaybookBlock {
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: `Bloque ${order + 1}`,
    type: 'prompt',
    order,
    prompt: '',
    model: 'gemini-2.5-flash',
    provider: 'gemini',
    temperature: 0.7,
    max_tokens: 4096,
    context_docs: [],
    receives_from: [],
    output_format: 'markdown',
  }
}

/**
 * Validar configuración de playbook.
 */
export function validatePlaybookConfig(config: PlaybookConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.blocks || config.blocks.length === 0) {
    errors.push('El playbook debe tener al menos un bloque')
  }

  config.blocks.forEach((block, index) => {
    if (!block.name?.trim()) {
      errors.push(`Bloque ${index + 1}: nombre requerido`)
    }
    if (block.type === 'prompt' && !block.prompt?.trim()) {
      errors.push(`Bloque ${index + 1}: prompt requerido`)
    }
    if (block.type === 'conditional' && !block.condition?.trim()) {
      errors.push(`Bloque ${index + 1}: condición requerida`)
    }
    if (block.type === 'human_review' && !block.hitl_config?.interface_type) {
      errors.push(`Bloque ${index + 1}: tipo de interfaz HITL requerido`)
    }
  })

  // Validar referencias entre bloques
  const blockIds = new Set(config.blocks.map((b) => b.id))
  config.blocks.forEach((block, index) => {
    block.receives_from?.forEach((refId) => {
      if (!blockIds.has(refId)) {
        errors.push(`Bloque ${index + 1}: referencia a bloque inexistente "${refId}"`)
      }
    })
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

// ============================================================================
// TEMPLATES
// ============================================================================

export const PLAYBOOK_TEMPLATES = {
  ecp_strategy: {
    name: 'ECP Strategy',
    description: 'Genera Value Proposition y USPs para un ECP',
    type: 'playbook' as PlaybookType,
    tags: ['STRATEGY', 'ECP', 'VP'],
    config: {
      blocks: [
        {
          id: 'deep-research',
          name: 'Deep Research',
          type: 'prompt' as const,
          order: 0,
          prompt: `Analiza el mercado para {{ecp_name}} en {{country}}.
Industry: {{industry}}
Problem Core: {{problem_core}}

Genera un análisis profundo de:
1. Contexto del mercado
2. Tendencias relevantes
3. Oportunidades identificadas`,
          model: 'gemini-2.5-pro',
          provider: 'gemini',
          context_tiers: [1, 2],
          output_format: 'markdown',
        },
        {
          id: 'competitor-analysis',
          name: 'Competitor Analysis',
          type: 'prompt' as const,
          order: 1,
          prompt: `Basándote en el Deep Research anterior, analiza los competidores.

{{step:deep-research}}

Identifica:
1. Principales competidores
2. Sus propuestas de valor
3. Gaps en el mercado`,
          model: 'gemini-2.5-flash',
          provider: 'gemini',
          receives_from: ['deep-research'],
          output_format: 'markdown',
        },
        {
          id: 'value-proposition',
          name: 'Value Proposition',
          type: 'prompt' as const,
          order: 2,
          prompt: `Genera la Value Proposition y USPs.

Research:
{{step:deep-research}}

Competitors:
{{step:competitor-analysis}}

Crea:
1. Value Proposition principal
2. 5 USPs diferenciadores
3. Messaging framework`,
          model: 'gemini-2.5-pro',
          provider: 'gemini',
          receives_from: ['deep-research', 'competitor-analysis'],
          context_tiers: [1],
          output_format: 'markdown',
        },
      ],
      context_requirements: {
        required_documents: [],
        required_tiers: [1, 2],
        dynamic_queries: [],
      },
      input_schema: {
        ecp_name: { type: 'string', required: true, label: 'Nombre del ECP' },
        problem_core: { type: 'textarea', required: true, label: 'Problem Core' },
        country: { type: 'string', required: true, label: 'País' },
        industry: { type: 'string', required: true, label: 'Industria' },
      },
      output_config: {
        destination: 'context_lake' as const,
        document_tier: 3 as const,
        document_type: 'output',
      },
    },
  },

  content_enricher: {
    name: 'Content Enricher',
    description: 'Enriquece documentos con análisis adicional',
    type: 'enricher' as PlaybookType,
    tags: ['ENRICHER', 'CONTENT'],
    config: {
      blocks: [
        {
          id: 'analyze',
          name: 'Analyze Document',
          type: 'prompt' as const,
          order: 0,
          prompt: `Analiza el siguiente documento y extrae:
1. Temas principales
2. Entidades clave (personas, empresas, productos)
3. Fechas y métricas relevantes
4. Resumen ejecutivo

Documento:
{{input_content}}`,
          model: 'gemini-2.5-flash',
          provider: 'gemini',
          output_format: 'json',
        },
      ],
      context_requirements: {
        required_documents: [],
        dynamic_queries: [],
      },
      input_schema: {
        input_content: { type: 'textarea', required: true, label: 'Contenido a enriquecer' },
      },
      output_config: {
        destination: 'context_lake' as const,
        document_tier: 2 as const,
        document_type: 'market_research',
      },
    },
  },
}
