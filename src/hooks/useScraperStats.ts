'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { ScraperType, ScraperStatus } from '@/types/scraper.types'

// ============================================
// TYPES
// ============================================

export interface ScraperStats {
  scraper_type: ScraperType
  execution_count: number
  success_count: number
  failed_count: number
  last_run_at: string | null
  last_status: ScraperStatus | null
  last_result_count: number | null
}

export interface UseScraperStatsReturn {
  stats: Record<string, ScraperStats>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// ============================================
// HELPER: Format relative time
// ============================================

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 30) {
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }
  if (diffDays > 0) {
    return `${diffDays}d ago`
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`
  }
  if (diffMins > 0) {
    return `${diffMins}m ago`
  }
  return 'just now'
}

// ============================================
// HOOK: useScraperStats
// ============================================

export function useScraperStats(projectId: string): UseScraperStatsReturn {
  const [stats, setStats] = useState<Record<string, ScraperStats>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    if (!projectId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()

      // Fetch all jobs for this project
      const { data: jobs, error: queryError } = await supabase
        .from('scraper_jobs')
        .select('scraper_type, status, result_count, created_at, completed_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (queryError) throw queryError

      // Aggregate stats by scraper_type
      const statsMap: Record<string, ScraperStats> = {}

      for (const job of jobs || []) {
        const type = job.scraper_type as ScraperType

        if (!statsMap[type]) {
          statsMap[type] = {
            scraper_type: type,
            execution_count: 0,
            success_count: 0,
            failed_count: 0,
            last_run_at: null,
            last_status: null,
            last_result_count: null,
          }
        }

        statsMap[type].execution_count++

        if (job.status === 'completed') {
          statsMap[type].success_count++
        } else if (job.status === 'failed') {
          statsMap[type].failed_count++
        }

        // First job is the most recent (ordered by created_at desc)
        if (!statsMap[type].last_run_at) {
          statsMap[type].last_run_at = job.completed_at || job.created_at
          statsMap[type].last_status = job.status as ScraperStatus
          statsMap[type].last_result_count = job.result_count
        }
      }

      setStats(statsMap)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading scraper stats')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  return { stats, loading, error, refresh: loadStats }
}
