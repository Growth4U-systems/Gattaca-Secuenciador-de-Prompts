'use client'

import React, { useState, useEffect } from 'react'
import {
  Globe,
  FileSearch,
  Brain,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react'
import type { NicheFinderResults, ExtractedNiche } from '@/types/scraper.types'
import NicheTable from './NicheTable'
import NicheDetail from './NicheDetail'

interface NicheResultsDashboardProps {
  jobId: string
  onBack?: () => void
}

type ExportFormat = 'csv' | 'sheets'

export default function NicheResultsDashboard({
  jobId,
  onBack,
}: NicheResultsDashboardProps) {
  const [results, setResults] = useState<NicheFinderResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNiche, setSelectedNiche] = useState<ExtractedNiche | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)

  // Fetch results
  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/niche-finder/results/${jobId}`)
        if (!response.ok) {
          throw new Error('Error al cargar los resultados')
        }

        const data = await response.json()
        setResults(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [jobId])

  const handleExport = async (format: ExportFormat) => {
    if (!results) return

    try {
      setExporting(true)
      setExportSuccess(null)

      const response = await fetch(`/api/niche-finder/results/${jobId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      })

      if (!response.ok) {
        throw new Error('Error al exportar')
      }

      if (format === 'csv') {
        // Download CSV file
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `nichos-${jobId.slice(0, 8)}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        setExportSuccess('CSV descargado correctamente')
      } else {
        // Google Sheets
        const data = await response.json()
        if (data.sheets_url) {
          window.open(data.sheets_url, '_blank')
          setExportSuccess('Abierto en Google Sheets')
        } else {
          setExportSuccess(data.message || 'Descargue el CSV para importar a Sheets.')
        }
      }

      setTimeout(() => setExportSuccess(null), 3000)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.round((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(3)}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando resultados...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle size={40} className="text-amber-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium mb-2">Error al cargar resultados</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
          >
            <RefreshCw size={16} className="inline mr-2" />
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!results) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">No se encontraron resultados</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Resultados del Niche Finder
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Job ID: {jobId.slice(0, 8)}...
          </p>
        </div>
        <div className="flex items-center gap-3">
          {exportSuccess && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle size={16} />
              {exportSuccess}
            </span>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 disabled:opacity-50"
            >
              <Download size={16} />
              CSV
            </button>
            <button
              onClick={() => handleExport('sheets')}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <FileSpreadsheet size={16} />
              Google Sheets
            </button>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors text-sm"
            >
              Volver
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* URLs Found */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-lg">
              <Globe size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{results.urls.found}</p>
              <p className="text-xs text-gray-500">URLs encontradas</p>
            </div>
          </div>
        </div>

        {/* URLs Scraped */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 rounded-lg">
              <FileSearch size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{results.urls.scraped}</p>
              <p className="text-xs text-gray-500">URLs scrapeadas</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-amber-600">
              <Filter size={12} />
              {results.urls.filtered} filtradas
            </span>
            <span className="flex items-center gap-1 text-red-500">
              <XCircle size={12} />
              {results.urls.failed} fallidas
            </span>
          </div>
        </div>

        {/* Niches Extracted */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 rounded-lg">
              <Brain size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{results.niches.length}</p>
              <p className="text-xs text-gray-500">Nichos extraídos</p>
            </div>
          </div>
        </div>

        {/* Duration */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gray-100 rounded-lg">
              <Clock size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatDuration(results.duration_ms)}
              </p>
              <p className="text-xs text-gray-500">Duración total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign size={18} className="text-green-600" />
          <h3 className="font-semibold text-gray-900">Desglose de Costes</h3>
          <span className="ml-auto text-lg font-bold text-green-600">
            {formatCost(results.costs.total)} total
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">SERP (Serper)</span>
              <span className="font-semibold text-blue-900">
                {formatCost(results.costs.serp)}
              </span>
            </div>
            <div className="mt-1 h-2 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${results.costs.total > 0 ? (results.costs.serp / results.costs.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-700">Scraping (Firecrawl)</span>
              <span className="font-semibold text-green-900">
                {formatCost(results.costs.firecrawl)}
              </span>
            </div>
            <div className="mt-1 h-2 bg-green-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{
                  width: `${results.costs.total > 0 ? (results.costs.firecrawl / results.costs.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-purple-700">LLM Extracción</span>
              <span className="font-semibold text-purple-900">
                {formatCost(results.costs.llm)}
              </span>
            </div>
            <div className="mt-1 h-2 bg-purple-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{
                  width: `${results.costs.total > 0 ? (results.costs.llm / results.costs.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Table + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={selectedNiche ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <NicheTable
            niches={results.niches}
            onSelectNiche={setSelectedNiche}
            selectedNicheId={selectedNiche?.id}
          />
        </div>
        {selectedNiche && (
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <NicheDetail
                niche={selectedNiche}
                onClose={() => setSelectedNiche(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
