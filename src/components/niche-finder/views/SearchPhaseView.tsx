'use client'

import { useState, useEffect } from 'react'
import { Loader2, Check, AlertCircle, Globe, Search } from 'lucide-react'
import type { StepProgress } from '@/lib/playbooks/niche-finder/types'

interface SearchPhaseViewProps {
  jobId: string
  onComplete: () => void
  onStepProgressUpdate: (progress: Record<string, StepProgress>) => void
}

interface JobStatus {
  status: string
  urls_found: number
  urls_scraped: number
  urls_failed: number
  error_message?: string
  config?: {
    life_contexts?: string[]
    product_words?: string[]
  }
}

export default function SearchPhaseView({ jobId, onComplete, onStepProgressUpdate }: SearchPhaseViewProps) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [serpStarted, setSerpStarted] = useState(false)
  const [scrapeStarted, setScrapeStarted] = useState(false)

  // Start SERP search on mount
  useEffect(() => {
    if (serpStarted) return
    setSerpStarted(true)

    const runSerp = async () => {
      try {
        const resp = await fetch(`/api/niche-finder/jobs/${jobId}/serp`, { method: 'POST' })
        const data = await resp.json()
        if (!data.success) throw new Error(data.error || 'SERP failed')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error en SERP')
      }
    }

    runSerp()
  }, [jobId, serpStarted])

  // Poll status
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const resp = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
        const data = await resp.json()
        if (!data.success || !data.job) return

        const job = data.job as JobStatus
        setJobStatus(job)

        // Update step progress for PhaseNavigation
        const serpDone = ['serp_done', 'scraping', 'scrape_done', 'extracting', 'completed'].includes(job.status)
        const scrapeDone = ['scrape_done', 'extracting', 'completed'].includes(job.status)

        onStepProgressUpdate({
          'serp-search': {
            stepId: 'serp-search',
            status: serpDone ? 'completed' : job.status === 'serp_running' ? 'running' : 'pending',
            progress: serpDone ? undefined : { completed: job.urls_found, total: 0 },
          },
          'scrape-urls': {
            stepId: 'scrape-urls',
            status: scrapeDone ? 'completed' : job.status === 'scraping' ? 'running' : 'pending',
            progress: job.status === 'scraping' ? { completed: job.urls_scraped, total: job.urls_found } : undefined,
          },
        })

        // Start scraping when SERP is done
        if (job.status === 'serp_done' && !scrapeStarted) {
          setScrapeStarted(true)
          try {
            const scrapeResp = await fetch(`/api/niche-finder/jobs/${jobId}/scrape`, { method: 'POST' })
            const scrapeData = await scrapeResp.json()
            if (!scrapeData.success) throw new Error(scrapeData.error || 'Scrape failed')
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error en scraping')
          }
        }

        // Search phase complete
        if (scrapeDone) {
          clearInterval(poll)
          onComplete()
        }

        if (job.status === 'failed') {
          clearInterval(poll)
          setError(job.error_message || 'Job failed')
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 3000)

    return () => clearInterval(poll)
  }, [jobId, scrapeStarted, onComplete, onStepProgressUpdate])

  const serpDone = jobStatus && ['serp_done', 'scraping', 'scrape_done', 'extracting', 'completed'].includes(jobStatus.status)
  const isScraping = jobStatus?.status === 'scraping'
  const scrapeDone = jobStatus && ['scrape_done', 'extracting', 'completed'].includes(jobStatus.status)

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">B\u00fasqueda en Progreso</h2>
        <p className="text-sm text-gray-500 mt-1">
          Buscando en foros y scrapeando contenido relevante.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: SERP */}
      <div className={`p-4 rounded-lg border ${serpDone ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex items-center gap-3">
          {serpDone ? (
            <Check className="w-5 h-5 text-green-600" />
          ) : (
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-600" />
              <span className="font-medium text-sm">B\u00fasqueda SERP</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {serpDone
                ? `${jobStatus?.urls_found || 0} URLs encontradas`
                : 'Buscando combinaciones A\u00d7B en Google...'}
            </p>
          </div>
        </div>
      </div>

      {/* Step 2: Scraping */}
      <div className={`p-4 rounded-lg border ${
        scrapeDone ? 'bg-green-50 border-green-200'
        : isScraping ? 'bg-blue-50 border-blue-200'
        : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          {scrapeDone ? (
            <Check className="w-5 h-5 text-green-600" />
          ) : isScraping ? (
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          ) : (
            <Globe className="w-5 h-5 text-gray-400" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-600" />
              <span className="font-medium text-sm">Scraping de Contenido</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {scrapeDone
                ? `${jobStatus?.urls_scraped || 0} URLs scrapeadas`
                : isScraping
                  ? `${jobStatus?.urls_scraped || 0} / ${jobStatus?.urls_found || 0} URLs...`
                  : 'Esperando b\u00fasqueda SERP...'}
            </p>
          </div>
        </div>
        {isScraping && jobStatus && jobStatus.urls_found > 0 && (
          <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.round((jobStatus.urls_scraped / jobStatus.urls_found) * 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
