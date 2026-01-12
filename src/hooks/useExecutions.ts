import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  PlaybookExecution,
  ExecutionInsert,
  ExecutionStatus,
  BlockOutput,
  HitlPending,
  ExecutionProgress,
  StartExecutionRequest,
  HitlResponseRequest,
  Playbook,
} from '@/types/v2.types'

interface UseExecutionsOptions {
  status?: ExecutionStatus
  limit?: number
}

/**
 * Hook para listar ejecuciones de un cliente.
 */
export function useExecutions(clientId: string, options: UseExecutionsOptions = {}) {
  const [executions, setExecutions] = useState<PlaybookExecution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadExecutions = useCallback(async () => {
    if (!clientId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('playbook_executions')
        .select('*')
        .eq('client_id', clientId)

      if (options.status) {
        query = query.eq('status', options.status)
      }
      if (options.limit) {
        query = query.limit(options.limit)
      }

      query = query.order('created_at', { ascending: false })

      const { data, error: queryError } = await query

      if (queryError) throw queryError
      setExecutions(data || [])
    } catch (err) {
      console.error('Error loading executions:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar ejecuciones')
    } finally {
      setLoading(false)
    }
  }, [clientId, options.status, options.limit])

  useEffect(() => {
    loadExecutions()
  }, [loadExecutions])

  // Estadísticas
  const stats = useMemo(() => {
    const byStatus: Record<ExecutionStatus, number> = {
      pending: 0,
      running: 0,
      waiting_human: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    }

    executions.forEach((e) => {
      byStatus[e.status]++
    })

    const completed = byStatus.completed
    const failed = byStatus.failed
    const total = completed + failed

    return {
      total: executions.length,
      byStatus,
      successRate: total > 0 ? (completed / total) * 100 : 0,
      pendingHitl: byStatus.waiting_human,
    }
  }, [executions])

  return {
    executions,
    stats,
    loading,
    error,
    reload: loadExecutions,
  }
}

/**
 * Hook para obtener una ejecución específica con actualizaciones en tiempo real.
 */
export function useExecution(executionId: string) {
  const [execution, setExecution] = useState<PlaybookExecution | null>(null)
  const [playbook, setPlaybook] = useState<Playbook | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadExecution = useCallback(async () => {
    if (!executionId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase
        .from('playbook_executions')
        .select('*')
        .eq('id', executionId)
        .single()

      if (queryError) throw queryError
      setExecution(data)

      // Cargar el playbook asociado
      if (data?.playbook_id) {
        const { data: playbookData } = await supabase
          .from('playbooks')
          .select('*')
          .eq('id', data.playbook_id)
          .single()

        setPlaybook(playbookData)
      }
    } catch (err) {
      console.error('Error loading execution:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar ejecución')
    } finally {
      setLoading(false)
    }
  }, [executionId])

  useEffect(() => {
    loadExecution()
  }, [loadExecution])

  // Calcular progreso
  const progress: ExecutionProgress = useMemo(() => {
    if (!execution || !playbook) {
      return { currentBlockIndex: 0, totalBlocks: 0, percentComplete: 0 }
    }

    const totalBlocks = playbook.config.blocks.length
    const completedBlocks = Object.values(execution.block_outputs || {}).filter(
      (o) => o.status === 'completed'
    ).length

    const currentBlockIndex = playbook.config.blocks.findIndex(
      (b) => b.id === execution.current_block_id
    )

    return {
      currentBlockIndex: currentBlockIndex >= 0 ? currentBlockIndex : completedBlocks,
      totalBlocks,
      percentComplete: totalBlocks > 0 ? (completedBlocks / totalBlocks) * 100 : 0,
    }
  }, [execution, playbook])

  return {
    execution,
    playbook,
    progress,
    loading,
    error,
    reload: loadExecution,
  }
}

/**
 * Iniciar una nueva ejecución de playbook.
 */
export async function startExecution(request: StartExecutionRequest): Promise<PlaybookExecution> {
  const { playbookId, clientId, inputData } = request

  // Obtener el playbook para inicializar block_outputs
  const { data: playbook, error: playbookError } = await supabase
    .from('playbooks')
    .select('*')
    .eq('id', playbookId)
    .single()

  if (playbookError) throw playbookError

  // Inicializar block_outputs con todos los bloques en pending
  const blockOutputs: Record<string, BlockOutput> = {}
  playbook.config.blocks.forEach((block: { id: string }) => {
    blockOutputs[block.id] = {
      output: '',
      tokens: { input: 0, output: 0 },
      status: 'pending',
    }
  })

  const firstBlockId = playbook.config.blocks[0]?.id || null

  const { data, error } = await supabase
    .from('playbook_executions')
    .insert({
      playbook_id: playbookId,
      client_id: clientId,
      input_data: inputData,
      status: 'pending',
      current_block_id: firstBlockId,
      block_outputs: blockOutputs,
      context_snapshot: { documents_used: [], total_tokens: 0, captured_at: new Date().toISOString() },
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Actualizar el output de un bloque.
 */
export async function updateBlockOutput(
  executionId: string,
  blockId: string,
  output: Partial<BlockOutput>
): Promise<void> {
  // Obtener ejecución actual
  const { data: execution, error: fetchError } = await supabase
    .from('playbook_executions')
    .select('block_outputs')
    .eq('id', executionId)
    .single()

  if (fetchError) throw fetchError

  // Actualizar block_outputs
  const blockOutputs = execution.block_outputs || {}
  blockOutputs[blockId] = {
    ...blockOutputs[blockId],
    ...output,
  }

  const { error } = await supabase
    .from('playbook_executions')
    .update({
      block_outputs: blockOutputs,
      updated_at: new Date().toISOString(),
    })
    .eq('id', executionId)

  if (error) throw error
}

/**
 * Actualizar estado de la ejecución.
 */
export async function updateExecutionStatus(
  executionId: string,
  status: ExecutionStatus,
  options: {
    currentBlockId?: string
    errorMessage?: string
  } = {}
): Promise<void> {
  const updates: Partial<PlaybookExecution> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (options.currentBlockId !== undefined) {
    updates.current_block_id = options.currentBlockId
  }
  if (options.errorMessage !== undefined) {
    updates.error_message = options.errorMessage
  }
  if (status === 'running' && !updates.started_at) {
    updates.started_at = new Date().toISOString()
  }
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    updates.completed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('playbook_executions')
    .update(updates)
    .eq('id', executionId)

  if (error) throw error
}

/**
 * Establecer estado HITL pendiente.
 */
export async function setHitlPending(
  executionId: string,
  hitlPending: HitlPending
): Promise<void> {
  const { error } = await supabase
    .from('playbook_executions')
    .update({
      status: 'waiting_human',
      hitl_pending: hitlPending,
      updated_at: new Date().toISOString(),
    })
    .eq('id', executionId)

  if (error) throw error
}

/**
 * Procesar respuesta HITL.
 */
export async function processHitlResponse(request: HitlResponseRequest): Promise<void> {
  const { executionId, blockId, action, editedOutput, selectedOption, notes } = request

  // Obtener ejecución actual
  const { data: execution, error: fetchError } = await supabase
    .from('playbook_executions')
    .select('*')
    .eq('id', executionId)
    .single()

  if (fetchError) throw fetchError

  const blockOutputs = execution.block_outputs || {}

  if (action === 'approve') {
    // Mantener output actual, marcar como completado
    blockOutputs[blockId] = {
      ...blockOutputs[blockId],
      status: 'completed',
      completed_at: new Date().toISOString(),
    }
  } else if (action === 'edit' && editedOutput) {
    // Usar output editado
    blockOutputs[blockId] = {
      ...blockOutputs[blockId],
      output: editedOutput,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }
  } else if (action === 'reject') {
    // Marcar como error
    blockOutputs[blockId] = {
      ...blockOutputs[blockId],
      status: 'error',
      error_message: notes || 'Rechazado por usuario',
      completed_at: new Date().toISOString(),
    }
  }

  // Determinar siguiente estado
  const nextStatus = action === 'reject' ? 'failed' : 'running'

  const { error } = await supabase
    .from('playbook_executions')
    .update({
      block_outputs: blockOutputs,
      hitl_pending: null,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', executionId)

  if (error) throw error
}

/**
 * Cancelar una ejecución.
 */
export async function cancelExecution(executionId: string): Promise<void> {
  await updateExecutionStatus(executionId, 'cancelled')
}

/**
 * Reintentar una ejecución fallida.
 */
export async function retryExecution(executionId: string): Promise<void> {
  // Obtener ejecución actual
  const { data: execution, error: fetchError } = await supabase
    .from('playbook_executions')
    .select('*')
    .eq('id', executionId)
    .single()

  if (fetchError) throw fetchError

  // Resetear bloques con error a pending
  const blockOutputs = execution.block_outputs || {}
  Object.keys(blockOutputs).forEach((blockId) => {
    if (blockOutputs[blockId].status === 'error') {
      blockOutputs[blockId] = {
        output: '',
        tokens: { input: 0, output: 0 },
        status: 'pending',
      }
    }
  })

  // Encontrar primer bloque pendiente o con error
  const { data: playbook } = await supabase
    .from('playbooks')
    .select('config')
    .eq('id', execution.playbook_id)
    .single()

  const firstPendingBlock = playbook?.config.blocks.find(
    (b: { id: string }) => blockOutputs[b.id]?.status === 'pending'
  )

  const { error } = await supabase
    .from('playbook_executions')
    .update({
      status: 'pending',
      block_outputs: blockOutputs,
      current_block_id: firstPendingBlock?.id || null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', executionId)

  if (error) throw error
}

/**
 * Obtener ejecuciones pendientes de HITL.
 */
export async function getPendingHitlExecutions(clientId?: string): Promise<PlaybookExecution[]> {
  let query = supabase
    .from('playbook_executions')
    .select('*')
    .eq('status', 'waiting_human')
    .order('created_at', { ascending: true })

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}
