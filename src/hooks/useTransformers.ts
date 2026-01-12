'use client'

import { useState, useCallback } from 'react'
import type {
  FoundationalType,
  FoundationalTransformer,
  TransformerExecuteRequest,
  TransformerExecuteResult,
  DocumentApproveResult,
  DocumentVersion,
} from '@/types/v2.types'

interface TransformersState {
  transformers: FoundationalTransformer[]
  isLoading: boolean
  error: string | null
}

interface ExecutionState {
  isExecuting: boolean
  executingType: FoundationalType | null
  result: TransformerExecuteResult | null
  error: string | null
}

/**
 * Hook for managing foundational transformers
 */
export function useTransformers(agencyId?: string) {
  const [state, setState] = useState<TransformersState>({
    transformers: [],
    isLoading: false,
    error: null,
  })

  const fetchTransformers = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const params = new URLSearchParams()
      if (agencyId) params.set('agencyId', agencyId)

      const response = await fetch(`/api/v2/transformers?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transformers')
      }

      setState({
        transformers: data.transformers || [],
        isLoading: false,
        error: null,
      })
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [agencyId])

  const createTransformer = useCallback(async (
    foundationalType: FoundationalType,
    prompt: string,
    options?: {
      model?: string
      temperature?: number
      maxTokens?: number
      name?: string
      description?: string
    }
  ) => {
    if (!agencyId) throw new Error('Agency ID required')

    const response = await fetch('/api/v2/transformers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyId,
        foundationalType,
        prompt,
        ...options,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create transformer')
    }

    // Refresh list
    await fetchTransformers()
    return data.transformer
  }, [agencyId, fetchTransformers])

  return {
    ...state,
    fetchTransformers,
    createTransformer,
  }
}

/**
 * Hook for executing transformers and managing document synthesis
 */
export function useTransformerExecution() {
  const [state, setState] = useState<ExecutionState>({
    isExecuting: false,
    executingType: null,
    result: null,
    error: null,
  })

  const execute = useCallback(async (request: TransformerExecuteRequest) => {
    setState({
      isExecuting: true,
      executingType: request.foundationalType,
      result: null,
      error: null,
    })

    try {
      const response = await fetch('/api/v2/transformers/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      const data = await response.json() as TransformerExecuteResult

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to execute transformer')
      }

      setState({
        isExecuting: false,
        executingType: null,
        result: data,
        error: null,
      })

      return data
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      setState({
        isExecuting: false,
        executingType: null,
        result: null,
        error,
      })
      throw err
    }
  }, [])

  const reset = useCallback(() => {
    setState({
      isExecuting: false,
      executingType: null,
      result: null,
      error: null,
    })
  }, [])

  return {
    ...state,
    execute,
    reset,
  }
}

/**
 * Hook for document approval workflow
 */
export function useDocumentApproval() {
  const [isApproving, setIsApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const approve = useCallback(async (documentId: string): Promise<DocumentApproveResult> => {
    setIsApproving(true)
    setError(null)

    try {
      const response = await fetch(`/api/v2/documents/${documentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve document')
      }

      setIsApproving(false)
      return data as DocumentApproveResult
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      setIsApproving(false)
      throw err
    }
  }, [])

  const revoke = useCallback(async (documentId: string) => {
    setIsApproving(true)
    setError(null)

    try {
      const response = await fetch(`/api/v2/documents/${documentId}/approve`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to revoke approval')
      }

      setIsApproving(false)
      return data
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      setIsApproving(false)
      throw err
    }
  }, [])

  return {
    isApproving,
    error,
    approve,
    revoke,
  }
}

/**
 * Hook for document version history
 */
export function useDocumentVersions(documentId?: string) {
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchVersions = useCallback(async (docId?: string) => {
    const id = docId || documentId
    if (!id) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v2/documents/${id}/versions`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch versions')
      }

      setVersions(data.versions || [])
      setIsLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsLoading(false)
    }
  }, [documentId])

  const rollback = useCallback(async (targetVersionId: string) => {
    if (!documentId) throw new Error('Document ID required')

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v2/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetVersionId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to rollback')
      }

      // Refresh versions
      await fetchVersions()
      setIsLoading(false)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsLoading(false)
      throw err
    }
  }, [documentId, fetchVersions])

  return {
    versions,
    isLoading,
    error,
    fetchVersions,
    rollback,
  }
}
