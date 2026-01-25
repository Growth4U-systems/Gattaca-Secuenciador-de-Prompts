'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { StepState, StepStatus } from '@/components/playbook/types'

export interface StepPersistenceConfig {
  /** Session ID for persisting step data */
  sessionId: string | null
  /** Interval for periodic auto-save in milliseconds (default: 30000 = 30 seconds) */
  autoSaveInterval?: number
  /** Enable/disable auto-save (default: true) */
  enabled?: boolean
}

export interface StepPersistenceState {
  /** Whether a save is currently in progress */
  isSaving: boolean
  /** Timestamp of last successful save */
  lastSavedAt: Date | null
  /** Error message if last save failed */
  saveError: string | null
  /** Whether there are unsaved changes */
  isDirty: boolean
}

export interface StepPersistenceActions {
  /** Save step data immediately */
  saveStep: (stepId: string, stepState: Partial<StepState>, status?: StepStatus) => Promise<void>
  /** Mark step as running (creates record if needed) */
  markStepRunning: (stepId: string, inputData?: unknown) => Promise<void>
  /** Mark step as completed */
  markStepCompleted: (stepId: string, outputData?: unknown) => Promise<void>
  /** Mark step as failed */
  markStepFailed: (stepId: string, errorMessage: string) => Promise<void>
  /** Save step output data (for auto-save during execution) */
  saveStepOutput: (stepId: string, outputData: unknown) => Promise<void>
  /** Schedule an auto-save (debounced) */
  scheduleAutoSave: (stepId: string, outputData: unknown) => void
  /** Load step data from database */
  loadStepData: (stepId: string) => Promise<StepState | null>
  /** Load all steps for session */
  loadAllSteps: () => Promise<Record<string, StepState>>
  /** Clear save error */
  clearSaveError: () => void
}

interface StepRecord {
  id: string
  session_id: string
  step_id: string
  status: string
  started_at: string | null
  completed_at: string | null
  input_data: unknown
  output_data: unknown
  error_message: string | null
  step_order: number | null
  created_at: string
  updated_at: string
}

/**
 * Hook for managing step data persistence with auto-save functionality.
 *
 * Features:
 * - Auto-save step output every 30 seconds during execution
 * - Immediate save on significant data changes
 * - Status tracking (running, completed, failed)
 * - Session resume support
 * - "Saved" indicator state
 */
export function useStepPersistence(
  config: StepPersistenceConfig
): [StepPersistenceState, StepPersistenceActions] {
  const { sessionId, autoSaveInterval = 30000, enabled = true } = config

  // State
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Refs for auto-save management
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingAutoSaveRef = useRef<{ stepId: string; outputData: unknown } | null>(null)
  const periodicSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentStepRef = useRef<string | null>(null)

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
      if (periodicSaveIntervalRef.current) {
        clearInterval(periodicSaveIntervalRef.current)
      }
    }
  }, [])

  /**
   * Internal function to make API call to save step data
   */
  const saveStepToApi = useCallback(async (
    stepId: string,
    data: {
      status?: StepStatus
      started_at?: string
      completed_at?: string
      input?: unknown
      output?: unknown
      error_message?: string
    }
  ): Promise<boolean> => {
    if (!sessionId || !enabled) {
      return false
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const response = await fetch(`/api/playbook/sessions/${sessionId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_id: stepId,
          ...data,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save step')
      }

      setLastSavedAt(new Date())
      setIsDirty(false)
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown save error'
      console.error('[useStepPersistence] Save error:', errorMessage)
      setSaveError(errorMessage)
      return false
    } finally {
      setIsSaving(false)
    }
  }, [sessionId, enabled])

  /**
   * Save step data immediately
   */
  const saveStep = useCallback(async (
    stepId: string,
    stepState: Partial<StepState>,
    status?: StepStatus
  ): Promise<void> => {
    const data: Parameters<typeof saveStepToApi>[1] = {}

    if (status) {
      data.status = status
    }
    if (stepState.startedAt) {
      data.started_at = stepState.startedAt.toISOString()
    }
    if (stepState.completedAt) {
      data.completed_at = stepState.completedAt.toISOString()
    }
    if (stepState.input !== undefined) {
      data.input = stepState.input
    }
    if (stepState.output !== undefined) {
      data.output = stepState.output
    }
    if (stepState.error) {
      data.error_message = stepState.error
    }

    await saveStepToApi(stepId, data)
  }, [saveStepToApi])

  /**
   * Mark step as running - creates/updates record with status "running"
   */
  const markStepRunning = useCallback(async (
    stepId: string,
    inputData?: unknown
  ): Promise<void> => {
    currentStepRef.current = stepId

    await saveStepToApi(stepId, {
      status: 'in_progress',
      started_at: new Date().toISOString(),
      input: inputData,
    })

    // Start periodic auto-save for running steps
    if (periodicSaveIntervalRef.current) {
      clearInterval(periodicSaveIntervalRef.current)
    }

    if (enabled && autoSaveInterval > 0) {
      periodicSaveIntervalRef.current = setInterval(() => {
        // If there's pending data, save it
        if (pendingAutoSaveRef.current && pendingAutoSaveRef.current.stepId === stepId) {
          const { outputData } = pendingAutoSaveRef.current
          saveStepToApi(stepId, { output: outputData })
          pendingAutoSaveRef.current = null
        }
      }, autoSaveInterval)
    }
  }, [saveStepToApi, enabled, autoSaveInterval])

  /**
   * Mark step as completed
   */
  const markStepCompleted = useCallback(async (
    stepId: string,
    outputData?: unknown
  ): Promise<void> => {
    // Stop periodic auto-save
    if (periodicSaveIntervalRef.current) {
      clearInterval(periodicSaveIntervalRef.current)
      periodicSaveIntervalRef.current = null
    }

    // Clear any pending auto-save
    pendingAutoSaveRef.current = null
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    currentStepRef.current = null

    await saveStepToApi(stepId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      output: outputData,
    })
  }, [saveStepToApi])

  /**
   * Mark step as failed
   */
  const markStepFailed = useCallback(async (
    stepId: string,
    errorMessage: string
  ): Promise<void> => {
    // Stop periodic auto-save
    if (periodicSaveIntervalRef.current) {
      clearInterval(periodicSaveIntervalRef.current)
      periodicSaveIntervalRef.current = null
    }

    // Clear any pending auto-save
    pendingAutoSaveRef.current = null
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    currentStepRef.current = null

    await saveStepToApi(stepId, {
      status: 'error',
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
  }, [saveStepToApi])

  /**
   * Save step output data immediately (for explicit saves during execution)
   */
  const saveStepOutput = useCallback(async (
    stepId: string,
    outputData: unknown
  ): Promise<void> => {
    setIsDirty(false)
    await saveStepToApi(stepId, { output: outputData })
  }, [saveStepToApi])

  /**
   * Schedule an auto-save (debounced) - useful for frequent updates
   */
  const scheduleAutoSave = useCallback((
    stepId: string,
    outputData: unknown
  ): void => {
    if (!sessionId || !enabled) return

    // Mark as dirty
    setIsDirty(true)

    // Store the pending data
    pendingAutoSaveRef.current = { stepId, outputData }

    // Clear existing debounce timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Set new debounce timer (3 seconds for immediate significant changes)
    autoSaveTimerRef.current = setTimeout(() => {
      if (pendingAutoSaveRef.current) {
        saveStepToApi(stepId, { output: pendingAutoSaveRef.current.outputData })
        pendingAutoSaveRef.current = null
      }
    }, 3000)
  }, [sessionId, enabled, saveStepToApi])

  /**
   * Load step data from database
   */
  const loadStepData = useCallback(async (
    stepId: string
  ): Promise<StepState | null> => {
    if (!sessionId) return null

    try {
      const response = await fetch(`/api/playbook/sessions/${sessionId}/steps`)
      if (!response.ok) return null

      const data = await response.json()
      const steps = data.steps as StepRecord[]
      const stepRecord = steps.find(s => s.step_id === stepId)

      if (!stepRecord) return null

      return mapRecordToStepState(stepRecord)
    } catch (error) {
      console.error('[useStepPersistence] Load step error:', error)
      return null
    }
  }, [sessionId])

  /**
   * Load all steps for session
   */
  const loadAllSteps = useCallback(async (): Promise<Record<string, StepState>> => {
    if (!sessionId) return {}

    try {
      const response = await fetch(`/api/playbook/sessions/${sessionId}/steps`)
      if (!response.ok) return {}

      const data = await response.json()
      const steps = data.steps as StepRecord[]

      const stepStates: Record<string, StepState> = {}
      for (const record of steps) {
        stepStates[record.step_id] = mapRecordToStepState(record)
      }

      return stepStates
    } catch (error) {
      console.error('[useStepPersistence] Load all steps error:', error)
      return {}
    }
  }, [sessionId])

  /**
   * Clear save error
   */
  const clearSaveError = useCallback((): void => {
    setSaveError(null)
  }, [])

  // Build state object
  const state: StepPersistenceState = {
    isSaving,
    lastSavedAt,
    saveError,
    isDirty,
  }

  // Build actions object
  const actions: StepPersistenceActions = {
    saveStep,
    markStepRunning,
    markStepCompleted,
    markStepFailed,
    saveStepOutput,
    scheduleAutoSave,
    loadStepData,
    loadAllSteps,
    clearSaveError,
  }

  return [state, actions]
}

/**
 * Map database record to StepState
 */
function mapRecordToStepState(record: StepRecord): StepState {
  const statusMap: Record<string, StepStatus> = {
    pending: 'pending',
    running: 'in_progress',
    in_progress: 'in_progress',
    completed: 'completed',
    failed: 'error',
    error: 'error',
    skipped: 'skipped',
  }

  return {
    id: record.step_id,
    status: statusMap[record.status] || 'pending',
    startedAt: record.started_at ? new Date(record.started_at) : undefined,
    completedAt: record.completed_at ? new Date(record.completed_at) : undefined,
    input: record.input_data,
    output: record.output_data,
    error: record.error_message || undefined,
  }
}

export default useStepPersistence
