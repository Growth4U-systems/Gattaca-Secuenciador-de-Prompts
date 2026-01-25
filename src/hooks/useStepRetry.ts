'use client'

import { useState, useCallback, useRef } from 'react'
import {
  StepState,
  StepRetryInfo,
  StepAttempt,
  StepAttemptConfig,
  StepRetryConfig,
} from '@/components/playbook/types'

const DEFAULT_MAX_ATTEMPTS = 3

export interface StepRetryState {
  /** Whether a retry operation is in progress */
  isRetrying: boolean
  /** Current retry info for the active step */
  retryInfo: StepRetryInfo | null
  /** Error from the retry operation itself */
  retryError: string | null
}

export interface StepRetryActions {
  /** Initialize retry tracking for a step (call when step starts) */
  initializeAttempt: (stepId: string, config?: StepRetryConfig) => Promise<StepAttempt>
  /** Record a successful completion of the current attempt */
  completeAttempt: (stepId: string, output?: unknown) => Promise<void>
  /** Record a failed attempt */
  failAttempt: (stepId: string, errorMessage: string) => Promise<void>
  /** Start a retry (creates new attempt record) */
  startRetry: (stepId: string, configOverrides?: StepAttemptConfig) => Promise<StepAttempt>
  /** Check if more retries are allowed */
  canRetry: (stepId: string) => boolean
  /** Get retry info for a step */
  getRetryInfo: (stepId: string) => StepRetryInfo | null
  /** Load attempt history from database */
  loadAttemptHistory: (stepId: string) => Promise<StepAttempt[]>
  /** Reset retry tracking for a step (e.g., when starting fresh) */
  resetRetryTracking: (stepId: string) => void
  /** Clear retry error */
  clearRetryError: () => void
}

interface AttemptRecord {
  id: string
  session_id: string
  step_id: string
  attempt_number: number
  status: string
  started_at: string
  ended_at: string | null
  error_message: string | null
  config_snapshot: Record<string, unknown>
  output_data: unknown
  created_at: string
}

/**
 * Hook for managing step retry functionality with attempt tracking.
 *
 * Features:
 * - Track multiple execution attempts per step
 * - Persist attempts to database for audit trail
 * - Allow configuration modification before retry
 * - Enforce maximum attempt limits
 * - Provide retry state and history
 */
export function useStepRetry(
  sessionId: string | null,
  options?: { enabled?: boolean }
): [StepRetryState, StepRetryActions] {
  const { enabled = true } = options || {}

  // State
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  // Track retry info per step (in-memory cache)
  const retryInfoMapRef = useRef<Map<string, StepRetryInfo>>(new Map())

  /**
   * Generate a unique attempt ID
   */
  const generateAttemptId = useCallback((): string => {
    return `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }, [])

  /**
   * Save attempt to database
   */
  const saveAttemptToDb = useCallback(async (
    stepId: string,
    attempt: StepAttempt
  ): Promise<string | null> => {
    if (!sessionId || !enabled) return null

    try {
      const response = await fetch(`/api/playbook/sessions/${sessionId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_id: stepId,
          attempt_number: attempt.attemptNumber,
          status: attempt.status,
          started_at: attempt.startedAt.toISOString(),
          ended_at: attempt.endedAt?.toISOString() || null,
          error_message: attempt.errorMessage || null,
          config_snapshot: attempt.configSnapshot || {},
          output_data: attempt.output || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save attempt')
      }

      const data = await response.json()
      return data.id || null
    } catch (error) {
      console.error('[useStepRetry] Save attempt error:', error)
      return null
    }
  }, [sessionId, enabled])

  /**
   * Update attempt in database
   */
  const updateAttemptInDb = useCallback(async (
    attemptId: string,
    updates: Partial<StepAttempt>
  ): Promise<boolean> => {
    if (!sessionId || !enabled) return false

    try {
      const response = await fetch(`/api/playbook/sessions/${sessionId}/attempts/${attemptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: updates.status,
          ended_at: updates.endedAt?.toISOString(),
          error_message: updates.errorMessage,
          output_data: updates.output,
        }),
      })

      return response.ok
    } catch (error) {
      console.error('[useStepRetry] Update attempt error:', error)
      return false
    }
  }, [sessionId, enabled])

  /**
   * Initialize retry tracking for a step
   */
  const initializeAttempt = useCallback(async (
    stepId: string,
    config?: StepRetryConfig
  ): Promise<StepAttempt> => {
    const maxAttempts = config?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
    const existingInfo = retryInfoMapRef.current.get(stepId)

    // If there's existing info and last attempt failed, increment attempt number
    let attemptNumber = 1
    if (existingInfo && existingInfo.attempts.length > 0) {
      const lastAttempt = existingInfo.attempts[existingInfo.attempts.length - 1]
      if (lastAttempt.status === 'failed') {
        attemptNumber = existingInfo.attemptNumber + 1
      } else {
        // Reset if last attempt was successful
        attemptNumber = 1
      }
    }

    const attempt: StepAttempt = {
      attemptId: generateAttemptId(),
      attemptNumber,
      startedAt: new Date(),
      status: 'running',
    }

    // Update retry info
    const retryInfo: StepRetryInfo = {
      attemptNumber,
      maxAttempts,
      attempts: existingInfo ? [...existingInfo.attempts, attempt] : [attempt],
    }

    retryInfoMapRef.current.set(stepId, retryInfo)

    // Persist to database
    const dbId = await saveAttemptToDb(stepId, attempt)
    if (dbId) {
      attempt.attemptId = dbId
    }

    return attempt
  }, [generateAttemptId, saveAttemptToDb])

  /**
   * Record a successful completion of the current attempt
   */
  const completeAttempt = useCallback(async (
    stepId: string,
    output?: unknown
  ): Promise<void> => {
    const retryInfo = retryInfoMapRef.current.get(stepId)
    if (!retryInfo) return

    const currentAttempt = retryInfo.attempts.find(a => a.status === 'running')
    if (!currentAttempt) return

    // Update attempt
    currentAttempt.status = 'completed'
    currentAttempt.endedAt = new Date()
    currentAttempt.output = output

    // Persist update
    await updateAttemptInDb(currentAttempt.attemptId, currentAttempt)
  }, [updateAttemptInDb])

  /**
   * Record a failed attempt
   */
  const failAttempt = useCallback(async (
    stepId: string,
    errorMessage: string
  ): Promise<void> => {
    const retryInfo = retryInfoMapRef.current.get(stepId)
    if (!retryInfo) return

    const currentAttempt = retryInfo.attempts.find(a => a.status === 'running')
    if (!currentAttempt) return

    // Update attempt
    currentAttempt.status = 'failed'
    currentAttempt.endedAt = new Date()
    currentAttempt.errorMessage = errorMessage

    // Persist update
    await updateAttemptInDb(currentAttempt.attemptId, currentAttempt)
  }, [updateAttemptInDb])

  /**
   * Start a retry with optional config overrides
   */
  const startRetry = useCallback(async (
    stepId: string,
    configOverrides?: StepAttemptConfig
  ): Promise<StepAttempt> => {
    setIsRetrying(true)
    setRetryError(null)

    try {
      const retryInfo = retryInfoMapRef.current.get(stepId)
      if (!retryInfo) {
        throw new Error('No retry info found for step')
      }

      if (retryInfo.attemptNumber >= retryInfo.maxAttempts) {
        throw new Error('Maximum retry attempts reached')
      }

      const newAttemptNumber = retryInfo.attemptNumber + 1

      const attempt: StepAttempt = {
        attemptId: generateAttemptId(),
        attemptNumber: newAttemptNumber,
        startedAt: new Date(),
        status: 'running',
        configSnapshot: configOverrides,
      }

      // Update retry info
      const updatedRetryInfo: StepRetryInfo = {
        attemptNumber: newAttemptNumber,
        maxAttempts: retryInfo.maxAttempts,
        attempts: [...retryInfo.attempts, attempt],
      }

      retryInfoMapRef.current.set(stepId, updatedRetryInfo)

      // Persist to database
      const dbId = await saveAttemptToDb(stepId, attempt)
      if (dbId) {
        attempt.attemptId = dbId
      }

      return attempt
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Retry failed'
      setRetryError(errorMessage)
      throw error
    } finally {
      setIsRetrying(false)
    }
  }, [generateAttemptId, saveAttemptToDb])

  /**
   * Check if more retries are allowed
   */
  const canRetry = useCallback((stepId: string): boolean => {
    const retryInfo = retryInfoMapRef.current.get(stepId)
    if (!retryInfo) return true // No info means first attempt hasn't started

    return retryInfo.attemptNumber < retryInfo.maxAttempts
  }, [])

  /**
   * Get retry info for a step
   */
  const getRetryInfo = useCallback((stepId: string): StepRetryInfo | null => {
    return retryInfoMapRef.current.get(stepId) || null
  }, [])

  /**
   * Load attempt history from database
   */
  const loadAttemptHistory = useCallback(async (stepId: string): Promise<StepAttempt[]> => {
    if (!sessionId) return []

    try {
      const response = await fetch(
        `/api/playbook/sessions/${sessionId}/attempts?step_id=${encodeURIComponent(stepId)}`
      )
      if (!response.ok) return []

      const data = await response.json()
      const records = data.attempts as AttemptRecord[]

      const attempts: StepAttempt[] = records.map(record => ({
        attemptId: record.id,
        attemptNumber: record.attempt_number,
        startedAt: new Date(record.started_at),
        endedAt: record.ended_at ? new Date(record.ended_at) : undefined,
        status: record.status as 'running' | 'completed' | 'failed',
        errorMessage: record.error_message || undefined,
        configSnapshot: record.config_snapshot as StepAttemptConfig | undefined,
        output: record.output_data,
      }))

      // Update local cache
      if (attempts.length > 0) {
        const maxAttemptNum = Math.max(...attempts.map(a => a.attemptNumber))
        retryInfoMapRef.current.set(stepId, {
          attemptNumber: maxAttemptNum,
          maxAttempts: DEFAULT_MAX_ATTEMPTS,
          attempts,
        })
      }

      return attempts
    } catch (error) {
      console.error('[useStepRetry] Load attempt history error:', error)
      return []
    }
  }, [sessionId])

  /**
   * Reset retry tracking for a step
   */
  const resetRetryTracking = useCallback((stepId: string): void => {
    retryInfoMapRef.current.delete(stepId)
  }, [])

  /**
   * Clear retry error
   */
  const clearRetryError = useCallback((): void => {
    setRetryError(null)
  }, [])

  // Build current retry info state (for the most recently accessed step)
  const currentRetryInfo = retryInfoMapRef.current.size > 0
    ? Array.from(retryInfoMapRef.current.values())[0]
    : null

  const state: StepRetryState = {
    isRetrying,
    retryInfo: currentRetryInfo,
    retryError,
  }

  const actions: StepRetryActions = {
    initializeAttempt,
    completeAttempt,
    failAttempt,
    startRetry,
    canRetry,
    getRetryInfo,
    loadAttemptHistory,
    resetRetryTracking,
    clearRetryError,
  }

  return [state, actions]
}

export default useStepRetry
