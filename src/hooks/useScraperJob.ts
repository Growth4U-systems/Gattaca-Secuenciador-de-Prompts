'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ScraperJob } from '@/types/scraper.types'

interface UseScraperJobOptions {
  pollInterval?: number  // in milliseconds, default 5000
  onComplete?: (job: ScraperJob) => void
  onError?: (job: ScraperJob) => void
}

interface UseScraperJobReturn {
  job: ScraperJob | null
  isPolling: boolean
  error: string | null
  startPolling: () => void
  stopPolling: () => void
  refresh: () => Promise<void>
}

export function useScraperJob(
  jobId: string | null,
  options: UseScraperJobOptions = {}
): UseScraperJobReturn {
  const { pollInterval = 5000, onComplete, onError } = options

  const [job, setJob] = useState<ScraperJob | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  // Update refs when callbacks change
  useEffect(() => {
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
  }, [onComplete, onError])

  // Fetch job status
  const fetchJobStatus = useCallback(async () => {
    if (!jobId) return

    try {
      const response = await fetch(`/api/scraper/status?job_id=${jobId}`)
      const data = await response.json()

      if (data.success && data.job) {
        setJob(data.job)
        setError(null)

        // Check if job is complete
        if (data.job.status === 'completed') {
          setIsPolling(false)
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          onCompleteRef.current?.(data.job)
        } else if (data.job.status === 'failed') {
          setIsPolling(false)
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          setError(data.job.error_message || 'Job failed')
          onErrorRef.current?.(data.job)
        }
      } else {
        setError(data.error || 'Failed to fetch job status')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    }
  }, [jobId])

  // Start polling
  const startPolling = useCallback(() => {
    if (!jobId || isPolling) return

    setIsPolling(true)
    fetchJobStatus() // Initial fetch

    intervalRef.current = setInterval(fetchJobStatus, pollInterval)
  }, [jobId, isPolling, fetchJobStatus, pollInterval])

  // Stop polling
  const stopPolling = useCallback(() => {
    setIsPolling(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Cleanup on unmount or jobId change
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [jobId])

  // Auto-start polling when jobId is set
  useEffect(() => {
    if (jobId) {
      fetchJobStatus()
    }
  }, [jobId, fetchJobStatus])

  return {
    job,
    isPolling,
    error,
    startPolling,
    stopPolling,
    refresh: fetchJobStatus,
  }
}

// Hook for listing all jobs for a project
export function useScraperJobs(projectId: string) {
  const [jobs, setJobs] = useState<ScraperJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    if (!projectId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/scraper/status?project_id=${projectId}`)
      const data = await response.json()

      if (data.success && data.jobs) {
        setJobs(data.jobs)
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch jobs')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  return {
    jobs,
    loading,
    error,
    refresh: fetchJobs,
  }
}
