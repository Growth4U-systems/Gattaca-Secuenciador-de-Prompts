'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Check, AlertCircle, Globe, Search, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { generateSearchQueries, type SearchQuery } from '@/lib/scraper/query-builder'
import type { StepProgress } from '@/lib/playbooks/niche-finder/types'
import type { ScraperStepConfig } from '@/types/scraper.types'

interface SearchPhaseViewProps {
  jobId: string
  onComplete: () => void
  onStepProgressUpdate: (progress: Record<string, StepProgress>) => void
}

interface Combination {
  lifeContext: string
  productWord: string
  queries: SearchQuery[]
  status: 'pending' | 'running' | 'completed' | 'error'
  urlsFound: number
  queriesCompleted: number
  error?: string
}

type Phase = 'loading' | 'serp' | 'no_results' | 'scraping' | 'done'

function groupByCombination(queries: SearchQuery[]): Combination[] {
  const map = new Map<string, Combination>()

  for (const q of queries) {
    const key = `${q.lifeContext}||${q.productWord}`
    if (!map.has(key)) {
      map.set(key, {
        lifeContext: q.lifeContext,
        productWord: q.productWord,
        queries: [],
        status: 'pending',
        urlsFound: 0,
        queriesCompleted: 0,
      })
    }
    map.get(key)!.queries.push(q)
  }

  return Array.from(map.values())
}

export default function SearchPhaseView({ jobId, onComplete, onStepProgressUpdate }: SearchPhaseViewProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [error, setError] = useState<string | null>(null)
  const [totalUrlsFound, setTotalUrlsFound] = useState(0)
  const [scrapingProgress, setScrapingProgress] = useState({ scraped: 0, total: 0, failed: 0 })
  const [retryingScrape, setRetryingScrape] = useState(false)
  const [expandedCombo, setExpandedCombo] = useState<number | null>(null)

  const combosRef = useRef<Combination[]>([])
  const serpPagesRef = useRef(5)
  const abortRef = useRef(false)
  const initRef = useRef(false)
  const scrapeStartedRef = useRef(false)
  const urlsFoundRef = useRef(0)

  const updateNavProgress = useCallback((
    serpStatus: 'pending' | 'running' | 'completed',
    serpCompleted: number,
    serpTotal: number,
    scrapeStatus: 'pending' | 'running' | 'completed',
    scrapeCompleted: number,
    scrapeTotal: number,
  ) => {
    onStepProgressUpdate({
      'serp-search': {
        stepId: 'serp-search',
        status: serpStatus,
        progress: { completed: serpCompleted, total: serpTotal },
      },
      'scrape-urls': {
        stepId: 'scrape-urls',
        status: scrapeStatus,
        progress: { completed: scrapeCompleted, total: scrapeTotal },
      },
    })
  }, [onStepProgressUpdate])

  // Initialize
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function initialize() {
    try {
      const resp = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
      const raw = await resp.json()

      if (!resp.ok || !raw.job) {
        setError('No se pudo obtener el estado del job')
        return
      }

      const job = raw.job
      const config = job.config as ScraperStepConfig

      // Already past search phase
      if (['scrape_done', 'extracting', 'completed'].includes(job.status)) {
        onComplete()
        return
      }

      const queries = generateSearchQueries(config)
      const pages = config.serp_pages || 5
      serpPagesRef.current = pages

      const groups = groupByCombination(queries)

      // Resume: mark already-completed queries
      if (['serp_running', 'serp_done', 'scraping'].includes(job.status) && (job.serp_completed || 0) > 0) {
        let remaining = Math.floor((job.serp_completed || 0) / pages)
        for (const combo of groups) {
          if (remaining <= 0) break
          const toMark = Math.min(remaining, combo.queries.length)
          combo.queriesCompleted = toMark
          if (toMark >= combo.queries.length) {
            combo.status = 'completed'
          }
          remaining -= toMark
        }
        setTotalUrlsFound(job.urls_found || 0)
        urlsFoundRef.current = job.urls_found || 0
      }

      combosRef.current = groups
      setCombinations(groups)

      if (job.status === 'scraping' || job.status === 'serp_done') {
        // Mark all SERP combos as completed for display
        for (const combo of groups) {
          combo.status = 'completed'
          combo.queriesCompleted = combo.queries.length
        }
        setCombinations([...groups])
        setPhase('scraping')
      } else {
        setPhase('serp')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al inicializar')
    }
  }

  // SERP processing loop
  useEffect(() => {
    if (phase !== 'serp' || combosRef.current.length === 0) return
    abortRef.current = false
    runSerpLoop()
    return () => { abortRef.current = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  async function runSerpLoop() {
    const combos = combosRef.current
    const pages = serpPagesRef.current
    let urlsFound = urlsFoundRef.current

    const totalQueries = combos.reduce((sum, c) => sum + c.queries.length, 0)

    // Set serp_total on the job (first call)
    await fetch(`/api/niche-finder/jobs/${jobId}/serp-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serp_total: totalQueries * pages }),
    }).catch(() => {})

    for (let ci = 0; ci < combos.length; ci++) {
      if (abortRef.current) return
      const combo = combos[ci]
      if (combo.status === 'completed') continue

      updateCombo(ci, { status: 'running' })

      let comboUrls = 0
      let completedQueries = combo.queriesCompleted
      let hasError = false

      for (let qi = completedQueries; qi < combo.queries.length; qi++) {
        if (abortRef.current) return
        const query = combo.queries[qi]

        try {
          const resp = await fetch(`/api/niche-finder/jobs/${jobId}/serp-single`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: query.query,
              life_context: query.lifeContext,
              product_word: query.productWord,
              source_type: query.sourceType,
              source_domain: query.sourceDomain || '',
              indicator: query.indicator,
              pages,
            }),
          })

          const data = await resp.json()
          if (!resp.ok) throw new Error(data.error || 'SERP query failed')

          comboUrls += data.urls_inserted
          urlsFound += data.urls_inserted
          completedQueries++

          updateCombo(ci, { urlsFound: comboUrls, queriesCompleted: completedQueries })
          setTotalUrlsFound(urlsFound)
          urlsFoundRef.current = urlsFound

          // Update nav progress
          const completedSoFar = combos.slice(0, ci).reduce((s, c) =>
            s + (c.status === 'completed' ? c.queries.length : c.queriesCompleted), 0
          ) + completedQueries
          updateNavProgress('running', completedSoFar, totalQueries, 'pending', 0, 0)
        } catch (err) {
          console.error(`[SERP] Error: ${query.query}`, err)
          updateCombo(ci, {
            status: 'error',
            error: err instanceof Error ? err.message : 'Error',
            urlsFound: comboUrls,
            queriesCompleted: completedQueries,
          })
          hasError = true
          break
        }
      }

      if (!hasError && !abortRef.current) {
        updateCombo(ci, { status: 'completed', urlsFound: comboUrls, queriesCompleted: combo.queries.length })
      }
    }

    // Finalize SERP
    if (!abortRef.current) {
      try {
        await fetch(`/api/niche-finder/jobs/${jobId}/serp-single`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ finalize: true }),
        })
      } catch (err) {
        console.error('[SERP] Error finalizing:', err)
      }

      updateNavProgress('completed', totalQueries, totalQueries, 'pending', 0, urlsFound)

      // STOP if no URLs found — don't proceed to scraping
      if (urlsFound === 0) {
        setPhase('no_results')
        return
      }

      setPhase('scraping')
    }
  }

  // Scraping phase
  useEffect(() => {
    if (phase !== 'scraping') return

    const runScrapeBatches = async () => {
      try {
        let hasMore = true
        while (hasMore) {
          const resp = await fetch(`/api/niche-finder/jobs/${jobId}/scrape`, { method: 'POST' })
          const data = await resp.json()
          if (!resp.ok) {
            if (data.error && !data.error.includes('already')) {
              console.warn('[SCRAPE] Batch error:', data.error)
            }
            break
          }
          hasMore = data.has_more ?? false
        }
      } catch (err) {
        console.error('[SCRAPE] Error:', err)
      }
    }

    scrapeStartedRef.current = true

    let scrapeLoopRunning = true
    runScrapeBatches().finally(() => { scrapeLoopRunning = false })

    const poll = setInterval(async () => {
      try {
        const resp = await fetch(`/api/niche-finder/jobs/${jobId}/status`)
        const raw = await resp.json()
        if (!resp.ok || !raw.job) return

        const jobStatus = raw.job.status
        const urlCounts = raw.url_counts || { scraped: 0, failed: 0, pending: 0 }
        const total = raw.job.urls_found || 0

        setScrapingProgress({ scraped: urlCounts.scraped, total, failed: urlCounts.failed })

        const isDone = ['scrape_done', 'extracting', 'completed'].includes(jobStatus)
        updateNavProgress(
          'completed', total, total,
          isDone ? 'completed' : 'running', urlCounts.scraped, total,
        )

        if (isDone) {
          clearInterval(poll)
          setPhase('done')
          onComplete()
          return
        }

        if (jobStatus === 'failed') {
          clearInterval(poll)
          setError(raw.job.error_message || 'Job failed')
          return
        }

        // Restart scraping if loop exited but URLs still pending
        if (!scrapeLoopRunning && jobStatus === 'scraping' && urlCounts.pending > 0) {
          console.log(`[SCRAPE] Restarting scrape loop (${urlCounts.pending} pending URLs)`)
          scrapeLoopRunning = true
          runScrapeBatches().finally(() => { scrapeLoopRunning = false })
        }
      } catch (err) {
        console.error('[SCRAPE] Poll error:', err)
      }
    }, 3000)

    return () => clearInterval(poll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function updateCombo(index: number, updates: Partial<Combination>) {
    setCombinations(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c))
    if (combosRef.current[index]) {
      Object.assign(combosRef.current[index], updates)
    }
  }

  const retryFailed = useCallback(() => {
    setError(null)
    const updated = combosRef.current.map(c =>
      c.status === 'error' ? { ...c, status: 'pending' as const, error: undefined } : c
    )
    combosRef.current = updated
    setCombinations(updated)
    setPhase('serp')
  }, [])

  // -- Derived state --

  const serpDone = phase === 'scraping' || phase === 'done' || phase === 'no_results'
  const isScraping = phase === 'scraping'
  const noResults = phase === 'no_results'
  const completedCombos = combinations.filter(c => c.status === 'completed').length
  const failedCombos = combinations.filter(c => c.status === 'error').length
  const totalCombos = combinations.length
  const scrapePercent = scrapingProgress.total > 0
    ? Math.round(((scrapingProgress.scraped + scrapingProgress.failed) / scrapingProgress.total) * 100)
    : 0

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          {noResults ? 'Sin Resultados' : serpDone ? 'Scraping en Progreso' : 'Busqueda SERP'}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {noResults
            ? 'La busqueda SERP no encontro URLs. Revisa la configuracion y vuelve a intentar.'
            : serpDone
              ? 'Descargando contenido de las URLs encontradas.'
              : `Procesando ${totalCombos} combinaciones en Google.`}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          {failedCombos > 0 && (
            <button
              onClick={retryFailed}
              className="flex items-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Reintentar
            </button>
          )}
        </div>
      )}

      {/* SERP Summary Card */}
      <div className={`p-3 rounded-lg border ${noResults ? 'bg-amber-50 border-amber-200' : serpDone ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex items-center gap-3">
          {noResults ? (
            <AlertCircle className="w-5 h-5 text-amber-600" />
          ) : serpDone ? (
            <Check className="w-5 h-5 text-green-600" />
          ) : phase === 'loading' ? (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          ) : (
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-600" />
              <span className="font-medium text-sm">Busqueda SERP</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {phase === 'loading'
                ? 'Cargando configuracion...'
                : `${completedCombos}/${totalCombos} combinaciones \u00b7 ${totalUrlsFound} URLs encontradas`}
              {failedCombos > 0 && ` \u00b7 ${failedCombos} fallidas`}
            </p>
          </div>
        </div>

        {!serpDone && totalCombos > 0 && (
          <div className="mt-2 w-full bg-blue-100 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.round((completedCombos / totalCombos) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Combinations List */}
      {phase !== 'loading' && combinations.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {combinations.map((combo, i) => (
            <div
              key={`${combo.lifeContext}-${combo.productWord}`}
              className={`px-3 py-2 text-sm ${
                combo.status === 'running' ? 'bg-blue-50' :
                combo.status === 'error' ? 'bg-red-50' :
                'bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                {combo.status === 'completed' && <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                {combo.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />}
                {combo.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                {combo.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0" />}

                <button
                  onClick={() => setExpandedCombo(expandedCombo === i ? null : i)}
                  className="flex-1 flex items-center gap-1 text-left"
                >
                  <span className="text-gray-700">
                    <span className="font-medium">{combo.lifeContext}</span>
                    <span className="text-gray-400 mx-1">&times;</span>
                    <span className="font-medium">{combo.productWord}</span>
                  </span>
                  {expandedCombo === i ? (
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                  )}
                </button>

                <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
                  {combo.status !== 'pending' && `${combo.urlsFound} URLs`}
                  {combo.status === 'running' && ` (${combo.queriesCompleted}/${combo.queries.length})`}
                </span>
              </div>

              {expandedCombo === i && (
                <div className="mt-1.5 ml-6 pl-2 border-l-2 border-gray-200 space-y-1">
                  {combo.queries.map((q, qi) => (
                    <div key={qi} className="text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        {qi < combo.queriesCompleted ? (
                          <Check className="w-2.5 h-2.5 text-green-400 flex-shrink-0" />
                        ) : qi === combo.queriesCompleted && combo.status === 'running' ? (
                          <Loader2 className="w-2.5 h-2.5 text-blue-400 animate-spin flex-shrink-0" />
                        ) : (
                          <div className="w-2.5 h-2.5 flex-shrink-0" />
                        )}
                        <span className="truncate font-medium">{q.sourceDomain || q.sourceType}</span>
                        {q.indicator && <span className="text-gray-400 truncate">+ {q.indicator}</span>}
                      </div>
                      <div className="ml-4 text-[10px] text-gray-400 font-mono truncate" title={q.query}>
                        {q.query}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {combo.status === 'error' && combo.error && (
                <p className="mt-1 ml-6 text-xs text-red-600">{combo.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No Results - action card */}
      {noResults && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
          <p className="text-sm text-amber-800">
            Google no devolvio resultados para las queries generadas. Esto puede ocurrir cuando las combinaciones de contexto + producto son muy especificas o no tienen presencia en los foros configurados.
          </p>
          <p className="text-xs text-amber-600">
            Expande cada combinacion para ver las queries exactas que se enviaron a Google.
          </p>
        </div>
      )}

      {/* Scraping Card */}
      {serpDone && !noResults && (
        <div className={`p-3 rounded-lg border ${
          phase === 'done' ? 'bg-green-50 border-green-200' :
          isScraping ? 'bg-blue-50 border-blue-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            {phase === 'done' ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-sm">Scraping de Contenido</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {phase === 'done'
                  ? `${scrapingProgress.scraped} URLs scrapeadas${scrapingProgress.failed > 0 ? ` (${scrapingProgress.failed} fallidas)` : ''}`
                  : scrapingProgress.scraped > 0
                    ? `${scrapingProgress.scraped}/${scrapingProgress.total} URLs${scrapingProgress.failed > 0 ? ` (${scrapingProgress.failed} fallidas)` : ''}...`
                    : 'Iniciando scraping...'}
              </p>
            </div>
          </div>

          {isScraping && scrapingProgress.total > 0 && (
            <div className="mt-2 w-full bg-blue-100 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${scrapePercent}%` }}
              />
            </div>
          )}

          {/* Retry failed scrape URLs */}
          {phase === 'done' && scrapingProgress.failed > 0 && (
            <button
              onClick={async () => {
                try {
                  setRetryingScrape(true)
                  const resp = await fetch(`/api/niche-finder/jobs/${jobId}/urls/retry`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                  })
                  const data = await resp.json()
                  if (data.success && data.resetCount > 0) {
                    setScrapingProgress(prev => ({
                      ...prev,
                      failed: 0,
                      total: prev.scraped + data.resetCount,
                    }))
                    setPhase('scraping')
                  }
                } catch (err) {
                  console.error('[SCRAPE] Retry error:', err)
                } finally {
                  setRetryingScrape(false)
                }
              }}
              disabled={retryingScrape}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs border border-orange-300 rounded-lg text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors disabled:opacity-50"
            >
              {retryingScrape ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Reintentar {scrapingProgress.failed} URLs fallidas
            </button>
          )}
        </div>
      )}

      {/* Retry button */}
      {failedCombos > 0 && !error && (
        <button
          onClick={retryFailed}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar {failedCombos} combinacion{failedCombos > 1 ? 'es' : ''} fallida{failedCombos > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
