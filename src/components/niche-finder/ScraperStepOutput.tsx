'use client'

import React, { useState, useEffect } from 'react'
import {
  Globe,
  DollarSign,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import type { NicheFinderResults, ExtractedNiche } from '@/types/scraper.types'
import NicheDetail from './NicheDetail'

interface ScraperStepOutputProps {
  stepOutput: {
    output: string
    tokens?: number
    status: string
    completed_at?: string
    scraper_stats?: {
      urls_found: number
      urls_scraped: number
      urls_filtered: number
      urls_failed: number
      niches_extracted: number
    }
    scraper_costs?: {
      serp: number
      firecrawl: number
      llm: number
      total: number
    }
    job_id?: string
  }
  stepName: string
  onViewFullDashboard?: () => void
}

export default function ScraperStepOutput({
  stepOutput,
  stepName,
  onViewFullDashboard,
}: ScraperStepOutputProps) {
  const [expanded, setExpanded] = useState(true)
  const [loadingResults, setLoadingResults] = useState(false)
  const [fullResults, setFullResults] = useState<NicheFinderResults | null>(null)
  const [selectedNiche, setSelectedNiche] = useState<ExtractedNiche | null>(null)
  const [showNicheDetail, setShowNicheDetail] = useState(false)

  const stats = stepOutput.scraper_stats
  const costs = stepOutput.scraper_costs

  // Load full results if we have a job_id
  useEffect(() => {
    if (stepOutput.job_id && !fullResults) {
      loadFullResults()
    }
  }, [stepOutput.job_id])

  const loadFullResults = async () => {
    if (!stepOutput.job_id) return

    try {
      setLoadingResults(true)
      const response = await fetch(`/api/niche-finder/results/${stepOutput.job_id}`)
      if (response.ok) {
        const data = await response.json()
        setFullResults(data)
      }
    } catch (err) {
      console.error('Failed to load full results:', err)
    } finally {
      setLoadingResults(false)
    }
  }

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(3)}`
  }

  // If we have full results with niches, show them
  const niches = fullResults?.niches || []

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 bg-gradient-to-r from-rose-50 to-orange-50 border-b border-gray-200 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-rose-600" />
            <h3 className="font-semibold text-gray-900">{stepName}</h3>
            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-medium rounded-full">
              Scraper
            </span>
          </div>
          <div className="flex items-center gap-3">
            {stepOutput.status === 'completed' && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle size={14} />
                Completado
              </span>
            )}
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-700">{stats.urls_found}</div>
                <div className="text-xs text-blue-600">URLs encontradas</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <div className="text-xl font-bold text-green-700">{stats.urls_scraped}</div>
                <div className="text-xs text-green-600">URLs scrapeadas</div>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg text-center">
                <div className="text-xl font-bold text-amber-700">{stats.urls_filtered}</div>
                <div className="text-xs text-amber-600">Filtradas</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <div className="text-xl font-bold text-red-700">{stats.urls_failed}</div>
                <div className="text-xs text-red-600">Fallidas</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg text-center">
                <div className="text-xl font-bold text-purple-700">{stats.niches_extracted}</div>
                <div className="text-xs text-purple-600">Nichos extraídos</div>
              </div>
            </div>
          )}

          {/* Costs */}
          {costs && (
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-1.5">
                <DollarSign size={16} className="text-green-600" />
                <span className="text-sm font-medium text-gray-700">Costes:</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-blue-600">SERP: {formatCost(costs.serp)}</span>
                <span className="text-green-600">Scraping: {formatCost(costs.firecrawl)}</span>
                <span className="text-purple-600">LLM: {formatCost(costs.llm)}</span>
                <span className="font-semibold text-gray-900">Total: {formatCost(costs.total)}</span>
              </div>
            </div>
          )}

          {/* Niches Preview or Full Table */}
          {loadingResults ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Cargando nichos...</span>
            </div>
          ) : niches.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">
                  Nichos Extraídos ({niches.length})
                </h4>
                {onViewFullDashboard && (
                  <button
                    onClick={onViewFullDashboard}
                    className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <ExternalLink size={12} />
                    Ver dashboard completo
                  </button>
                )}
              </div>

              {/* Mini Table - First 5 niches */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        Problema
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        Persona
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-20">
                        URL
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {niches.slice(0, 5).map((niche) => (
                      <tr
                        key={niche.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedNiche(niche)
                          setShowNicheDetail(true)
                        }}
                      >
                        <td className="px-3 py-2 text-gray-900">
                          {niche.problem?.substring(0, 80)}
                          {(niche.problem?.length || 0) > 80 ? '...' : ''}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {niche.persona?.substring(0, 50)}
                          {(niche.persona?.length || 0) > 50 ? '...' : ''}
                        </td>
                        <td className="px-3 py-2">
                          {niche.source_url && (
                            <a
                              href={niche.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-indigo-600 hover:text-indigo-700"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {niches.length > 5 && (
                  <div className="px-3 py-2 bg-gray-50 text-center text-xs text-gray-500">
                    + {niches.length - 5} nichos más
                  </div>
                )}
              </div>
            </div>
          ) : stepOutput.output ? (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 whitespace-pre-wrap">
                {stepOutput.output.substring(0, 500)}
                {stepOutput.output.length > 500 && '...'}
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-gray-500">
              Sin datos de salida disponibles
            </div>
          )}
        </div>
      )}

      {/* Niche Detail Modal */}
      {showNicheDetail && selectedNiche && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-w-2xl w-full mx-4">
            <NicheDetail
              niche={selectedNiche}
              onClose={() => {
                setShowNicheDetail(false)
                setSelectedNiche(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
