'use client'

/**
 * useScraperJobPersistence Hook
 *
 * Persists scraper jobs to localStorage to survive navigation.
 * When user returns to the page, recovers job states and polls for completion.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/components/ui/Toast/ToastContext'

// ============================================
// TYPES
// ============================================

export interface PersistedJob {
  jobId: string
  scraperId: string
  scraperName: string
  sourceType: string
  projectId: string
  startedAt: string
  status: 'running' | 'processing' | 'completed' | 'failed'
  error?: string
  documentId?: string
  documentsGenerated?: number
}

export interface JobHistoryEntry extends PersistedJob {
  completedAt?: string
}

interface UseScraperJobPersistenceOptions {
  projectId: string
  onJobCompleted?: (job: PersistedJob) => void
  onJobFailed?: (job: PersistedJob) => void
}

interface UseScraperJobPersistenceReturn {
  /** Currently active (running/processing) jobs */
  activeJobs: Map<string, PersistedJob>
  /** History of completed/failed jobs (last 2 hours) */
  jobHistory: JobHistoryEntry[]
  /** Add a new job to track */
  trackJob: (job: Omit<PersistedJob, 'status' | 'startedAt'> & { status?: PersistedJob['status'] }) => void
  /** Remove a job from tracking */
  removeJob: (jobId: string) => void
  /** Update job status */
  updateJobStatus: (jobId: string, status: PersistedJob['status'], extra?: Partial<PersistedJob>) => void
  /** Check if a specific job is being tracked */
  isJobTracked: (jobId: string) => boolean
  /** Get job by source type */
  getJobBySourceType: (sourceType: string) => PersistedJob | undefined
  /** Clear all job history */
  clearHistory: () => void
  /** Whether jobs are being recovered on mount */
  isRecovering: boolean
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY_PREFIX = 'scraper_jobs_'
const HISTORY_KEY_PREFIX = 'scraper_history_'
const JOB_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours
const POLL_INTERVAL_MS = 5000 // 5 seconds

// ============================================
// HOOK
// ============================================

export function useScraperJobPersistence({
  projectId,
  onJobCompleted,
  onJobFailed,
}: UseScraperJobPersistenceOptions): UseScraperJobPersistenceReturn {
  const toast = useToast()
  const [activeJobs, setActiveJobs] = useState<Map<string, PersistedJob>>(new Map())
  const [jobHistory, setJobHistory] = useState<JobHistoryEntry[]>([])
  const [isRecovering, setIsRecovering] = useState(true)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const hasRecovered = useRef(false)

  const storageKey = `${STORAGE_KEY_PREFIX}${projectId}`
  const historyKey = `${HISTORY_KEY_PREFIX}${projectId}`

  // ============================================
  // PERSISTENCE HELPERS
  // ============================================

  const saveToLocalStorage = useCallback(
    (jobs: Map<string, PersistedJob>) => {
      if (typeof window === 'undefined') return
      const jobsArray = Array.from(jobs.values())
      localStorage.setItem(storageKey, JSON.stringify(jobsArray))
    },
    [storageKey]
  )

  const saveHistoryToLocalStorage = useCallback(
    (history: JobHistoryEntry[]) => {
      if (typeof window === 'undefined') return
      localStorage.setItem(historyKey, JSON.stringify(history))
    },
    [historyKey]
  )

  const loadFromLocalStorage = useCallback((): PersistedJob[] => {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(storageKey)
      if (!stored) return []
      const jobs: PersistedJob[] = JSON.parse(stored)
      // Filter out jobs older than TTL
      const now = Date.now()
      return jobs.filter((job) => {
        const jobAge = now - new Date(job.startedAt).getTime()
        return jobAge < JOB_TTL_MS
      })
    } catch {
      return []
    }
  }, [storageKey])

  const loadHistoryFromLocalStorage = useCallback((): JobHistoryEntry[] => {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(historyKey)
      if (!stored) return []
      const history: JobHistoryEntry[] = JSON.parse(stored)
      // Filter out entries older than TTL
      const now = Date.now()
      const filtered = history.filter((entry) => {
        const entryAge = now - new Date(entry.completedAt || entry.startedAt).getTime()
        return entryAge < JOB_TTL_MS
      })
      // Deduplicate by jobId (keep first occurrence = most recent)
      const seen = new Set<string>()
      const deduplicated = filtered.filter((entry) => {
        if (seen.has(entry.jobId)) {
          return false
        }
        seen.add(entry.jobId)
        return true
      })
      // If we removed duplicates, save the cleaned history
      if (deduplicated.length < filtered.length) {
        localStorage.setItem(historyKey, JSON.stringify(deduplicated))
      }
      return deduplicated
    } catch {
      return []
    }
  }, [historyKey])

  // ============================================
  // JOB MANAGEMENT
  // ============================================

  const trackJob = useCallback(
    (job: Omit<PersistedJob, 'status' | 'startedAt'> & { status?: PersistedJob['status'] }) => {
      const newJob: PersistedJob = {
        ...job,
        status: job.status || 'running',
        startedAt: new Date().toISOString(),
      }

      setActiveJobs((prev) => {
        const newMap = new Map(prev)
        newMap.set(job.jobId, newJob)
        saveToLocalStorage(newMap)
        return newMap
      })
    },
    [saveToLocalStorage]
  )

  const removeJob = useCallback(
    (jobId: string) => {
      setActiveJobs((prev) => {
        const newMap = new Map(prev)
        newMap.delete(jobId)
        saveToLocalStorage(newMap)
        return newMap
      })
    },
    [saveToLocalStorage]
  )

  const updateJobStatus = useCallback(
    (jobId: string, status: PersistedJob['status'], extra?: Partial<PersistedJob>) => {
      setActiveJobs((prev) => {
        const newMap = new Map(prev)
        const existingJob = newMap.get(jobId)
        if (existingJob) {
          const updatedJob = { ...existingJob, ...extra, status }
          newMap.set(jobId, updatedJob)

          // If completed or failed, move to history
          if (status === 'completed' || status === 'failed') {
            const historyEntry: JobHistoryEntry = {
              ...updatedJob,
              completedAt: new Date().toISOString(),
            }
            setJobHistory((prevHistory) => {
              // Deduplicate by jobId to prevent duplicates
              const existingIds = new Set(prevHistory.map(h => h.jobId))
              if (existingIds.has(jobId)) {
                // Job already in history, don't add again
                return prevHistory
              }
              const newHistory = [historyEntry, ...prevHistory].slice(0, 50) // Keep last 50
              saveHistoryToLocalStorage(newHistory)
              return newHistory
            })
            newMap.delete(jobId)
          }

          saveToLocalStorage(newMap)
        }
        return newMap
      })
    },
    [saveToLocalStorage, saveHistoryToLocalStorage]
  )

  const isJobTracked = useCallback(
    (jobId: string) => {
      return activeJobs.has(jobId)
    },
    [activeJobs]
  )

  const getJobBySourceType = useCallback(
    (sourceType: string) => {
      for (const job of activeJobs.values()) {
        if (job.sourceType === sourceType) {
          return job
        }
      }
      return undefined
    },
    [activeJobs]
  )

  const clearHistory = useCallback(() => {
    setJobHistory([])
    if (typeof window !== 'undefined') {
      localStorage.removeItem(historyKey)
    }
  }, [historyKey])

  // ============================================
  // POLLING
  // ============================================

  const pollJobs = useCallback(async () => {
    const jobsToCheck = Array.from(activeJobs.values()).filter(
      (job) => job.status === 'running' || job.status === 'processing'
    )

    if (jobsToCheck.length === 0) return

    for (const job of jobsToCheck) {
      try {
        // Handle Deep Research jobs differently
        const isDeepResearch = job.sourceType === 'deep_research'
        const endpoint = isDeepResearch
          ? `/api/deep-research/status?jobId=${job.jobId}`
          : `/api/scraper/poll?jobId=${job.jobId}`

        const response = await fetch(endpoint)
        if (!response.ok) continue

        const result = await response.json()

        if (result.completed || result.status === 'completed' || result.status === 'failed') {
          const isSuccess = result.status === 'completed' || (result.completed && !result.error)

          if (isSuccess) {
            updateJobStatus(job.jobId, 'completed', {
              documentId: result.document_id || result.documentId,
              documentsGenerated: result.documentsGenerated || 1,
            })

            // Show success toast
            toast.success(
              `${job.scraperName} completado`,
              result.documentsGenerated
                ? `${result.documentsGenerated} documentos generados`
                : 'Documento generado exitosamente'
            )

            onJobCompleted?.({ ...job, status: 'completed', documentId: result.document_id })
          } else {
            const errorMessage = result.error || 'Error desconocido'
            updateJobStatus(job.jobId, 'failed', { error: errorMessage })

            // Show error toast
            toast.error(`${job.scraperName} falló`, errorMessage)

            onJobFailed?.({ ...job, status: 'failed', error: errorMessage })
          }
        } else if (result.status === 'processing' && job.status !== 'processing') {
          updateJobStatus(job.jobId, 'processing')
        }
      } catch (error) {
        console.warn(`Error polling job ${job.jobId}:`, error)
      }
    }
  }, [activeJobs, updateJobStatus, toast, onJobCompleted, onJobFailed])

  // Set up polling interval
  useEffect(() => {
    const hasActiveJobs = Array.from(activeJobs.values()).some(
      (job) => job.status === 'running' || job.status === 'processing'
    )

    if (hasActiveJobs) {
      pollingRef.current = setInterval(pollJobs, POLL_INTERVAL_MS)
      // Initial poll
      pollJobs()
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [activeJobs, pollJobs])

  // ============================================
  // RECOVERY ON MOUNT
  // ============================================

  useEffect(() => {
    if (hasRecovered.current) return
    hasRecovered.current = true

    const recoverJobs = async () => {
      setIsRecovering(true)

      // Load persisted jobs and history
      const storedJobs = loadFromLocalStorage()
      const storedHistory = loadHistoryFromLocalStorage()

      setJobHistory(storedHistory)

      if (storedJobs.length === 0) {
        setIsRecovering(false)
        return
      }

      // Check status of recovered jobs
      const recoveredJobsMap = new Map<string, PersistedJob>()
      const completedSinceAway: PersistedJob[] = []
      const failedSinceAway: PersistedJob[] = []

      for (const job of storedJobs) {
        try {
          const isDeepResearch = job.sourceType === 'deep_research'
          const endpoint = isDeepResearch
            ? `/api/deep-research/status?jobId=${job.jobId}`
            : `/api/scraper/poll?jobId=${job.jobId}`

          const response = await fetch(endpoint)
          if (!response.ok) {
            // Keep job in recovery state
            recoveredJobsMap.set(job.jobId, job)
            continue
          }

          const result = await response.json()

          if (result.completed || result.status === 'completed' || result.status === 'failed') {
            const isSuccess = result.status === 'completed' || (result.completed && !result.error)

            if (isSuccess) {
              completedSinceAway.push({
                ...job,
                status: 'completed',
                documentId: result.document_id || result.documentId,
                documentsGenerated: result.documentsGenerated || 1,
              })
            } else {
              failedSinceAway.push({
                ...job,
                status: 'failed',
                error: result.error || 'Error desconocido',
              })
            }
          } else {
            // Still running
            recoveredJobsMap.set(job.jobId, {
              ...job,
              status: result.status === 'processing' ? 'processing' : 'running',
            })
          }
        } catch {
          // Keep job in recovery state
          recoveredJobsMap.set(job.jobId, job)
        }
      }

      // Update state with recovered jobs
      setActiveJobs(recoveredJobsMap)
      saveToLocalStorage(recoveredJobsMap)

      // Add completed/failed to history (with deduplication)
      if (completedSinceAway.length > 0 || failedSinceAway.length > 0) {
        const now = new Date().toISOString()
        const newHistoryEntries: JobHistoryEntry[] = [
          ...completedSinceAway.map((job) => ({ ...job, completedAt: now })),
          ...failedSinceAway.map((job) => ({ ...job, completedAt: now })),
        ]

        setJobHistory((prev) => {
          // Deduplicate by jobId
          const existingIds = new Set(prev.map(h => h.jobId))
          const uniqueNewEntries = newHistoryEntries.filter(e => !existingIds.has(e.jobId))
          if (uniqueNewEntries.length === 0) {
            return prev
          }
          const updated = [...uniqueNewEntries, ...prev].slice(0, 50)
          saveHistoryToLocalStorage(updated)
          return updated
        })
      }

      // Show toast summary if jobs completed while away
      if (completedSinceAway.length > 0 || failedSinceAway.length > 0) {
        const totalCompleted = completedSinceAway.length
        const totalFailed = failedSinceAway.length

        if (totalCompleted > 0 && totalFailed > 0) {
          toast.info(
            'Scrapers actualizados',
            `${totalCompleted} completado${totalCompleted > 1 ? 's' : ''}, ${totalFailed} con error${totalFailed > 1 ? 'es' : ''}`
          )
        } else if (totalCompleted > 0) {
          toast.success(
            `${totalCompleted} scraper${totalCompleted > 1 ? 's' : ''} completado${totalCompleted > 1 ? 's' : ''}`,
            'Los documentos se generaron mientras estabas fuera'
          )
        } else if (totalFailed > 0) {
          toast.error(
            `${totalFailed} scraper${totalFailed > 1 ? 's' : ''} con error`,
            'Revisa el historial para más detalles'
          )
        }

        // Trigger callbacks
        completedSinceAway.forEach((job) => onJobCompleted?.(job))
        failedSinceAway.forEach((job) => onJobFailed?.(job))
      }

      setIsRecovering(false)
    }

    recoverJobs()
  }, [
    loadFromLocalStorage,
    loadHistoryFromLocalStorage,
    saveToLocalStorage,
    saveHistoryToLocalStorage,
    toast,
    onJobCompleted,
    onJobFailed,
  ])

  return {
    activeJobs,
    jobHistory,
    trackJob,
    removeJob,
    updateJobStatus,
    isJobTracked,
    getJobBySourceType,
    clearHistory,
    isRecovering,
  }
}
