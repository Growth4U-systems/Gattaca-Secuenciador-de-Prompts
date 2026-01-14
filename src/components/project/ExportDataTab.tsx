'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Download, Table2, Shield, MessageSquare } from 'lucide-react'
import { useToast } from '@/components/ui'

type SubTab = 'find-place' | 'prove-legit' | 'usp-uvp'

interface FindPlaceRow {
  id: string
  ecp_name: string
  evaluation_criterion: string
  relevance: string
  justification: string
  competitor_scores: Record<string, { score: number | string }>
  analysis_opportunity: string
}

interface ProveLegitRow {
  id: string
  ecp_name: string
  asset_name: string
  value_criteria: string
  category: string
  justification_differentiation: string
  competitive_advantage: string
  benefit_for_user: string
  proof: string
}

interface UspUvpRow {
  id: string
  ecp_name: string
  message_category: string
  hypothesis: string
  value_criteria: string
  objective: string
  message_en: string
  message_es: string
}

export default function ExportDataTab({ projectId }: { projectId: string }) {
  const toast = useToast()
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('find-place')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Datos de las 3 tablas
  const [findPlaceData, setFindPlaceData] = useState<FindPlaceRow[]>([])
  const [proveLegitData, setProveLegitData] = useState<ProveLegitRow[]>([])
  const [uspUvpData, setUspUvpData] = useState<UspUvpRow[]>([])

  // Cargar datos al montar
  useEffect(() => {
    loadExportData()
  }, [projectId])

  const loadExportData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/export-data`)
      const data = await response.json()
      if (data.success) {
        setFindPlaceData(data.findPlace || [])
        setProveLegitData(data.proveLegit || [])
        setUspUvpData(data.uspUvp || [])
      }
    } catch (error) {
      console.error('Error loading export data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/sync-export`, {
        method: 'POST'
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Sincronizado', data.message)
        await loadExportData()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast.error('Error', 'No se pudo sincronizar los datos')
    } finally {
      setSyncing(false)
    }
  }

  const handleExportCSV = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/export-csv`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ecp-export.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Exportado', 'Archivos CSV descargados')
    } catch (error) {
      toast.error('Error', 'No se pudo exportar los datos')
    }
  }

  const subTabs = [
    { id: 'find-place' as SubTab, label: 'Find Your Place', icon: Table2, count: findPlaceData.length },
    { id: 'prove-legit' as SubTab, label: 'Prove Legit', icon: Shield, count: proveLegitData.length },
    { id: 'usp-uvp' as SubTab, label: 'USP & UVP', icon: MessageSquare, count: uspUvpData.length },
  ]

  const totalCount = findPlaceData.length + proveLegitData.length + uspUvpData.length

  return (
    <div className="space-y-6">
      {/* Header con botones */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Datos Consolidados</h2>
          <p className="text-sm text-gray-500 mt-1">
            Visualiza y exporta los datos parseados de todas las campanas ({totalCount} registros)
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={totalCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Download size={16} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {subTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeSubTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
                  ${isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}
                `}
              >
                <Icon size={16} />
                {tab.label}
                <span className={`
                  px-2 py-0.5 rounded-full text-xs
                  ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
                `}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Contenido de sub-tab */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {activeSubTab === 'find-place' && (
            <FindPlaceTable data={findPlaceData} />
          )}
          {activeSubTab === 'prove-legit' && (
            <ProveLegitTable data={proveLegitData} />
          )}
          {activeSubTab === 'usp-uvp' && (
            <UspUvpTable data={uspUvpData} />
          )}
        </>
      )}
    </div>
  )
}

// Tabla PLANA para Find Your Place - SIN TOGGLE, todas las columnas visibles
function FindPlaceTable({ data }: { data: FindPlaceRow[] }) {
  if (data.length === 0) {
    return <EmptyState message="No hay datos. Haz click en 'Sincronizar' para parsear las campanas." />
  }

  // Extraer todos los competidores unicos del JSONB
  const allCompetitors = new Set<string>()
  data.forEach(row => {
    if (row.competitor_scores) {
      Object.keys(row.competitor_scores).forEach(comp => allCompetitors.add(comp))
    }
  })
  const competitors = Array.from(allCompetitors).sort()

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-xs">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">ECP</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Evaluation Criterion</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Relevance</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Justification</th>
            {competitors.map(comp => (
              <th key={comp} className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">
                {comp}
              </th>
            ))}
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Analysis & Opportunity</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, idx) => (
            <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-2 py-2 text-gray-900 whitespace-nowrap">{row.ecp_name}</td>
              <td className="px-2 py-2 text-gray-700 max-w-[200px]">{row.evaluation_criterion}</td>
              <td className="px-2 py-2">
                <RelevanceBadge value={row.relevance} />
              </td>
              <td className="px-2 py-2 text-gray-600 max-w-[300px]">{row.justification || '-'}</td>
              {competitors.map(comp => {
                const score = row.competitor_scores?.[comp]?.score
                return (
                  <td key={comp} className="px-2 py-2 text-center">
                    {score !== undefined ? (
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${getScoreColor(score)}`}>
                        {score}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                )
              })}
              <td className="px-2 py-2 text-gray-600 max-w-[300px]">{row.analysis_opportunity || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Tabla PLANA para Prove Legit - SIN TOGGLE, todas las columnas visibles
function ProveLegitTable({ data }: { data: ProveLegitRow[] }) {
  if (data.length === 0) {
    return <EmptyState message="No hay datos. Haz click en 'Sincronizar' para parsear las campanas." />
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-xs">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">ECP</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Asset</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Value Criteria</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Category</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Justification for Differentiation</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Competitive Advantage</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Benefit for User</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Proof</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, idx) => (
            <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-2 py-2 text-gray-900 whitespace-nowrap">{row.ecp_name}</td>
              <td className="px-2 py-2 text-gray-700 max-w-[150px]">{row.asset_name}</td>
              <td className="px-2 py-2 text-gray-600 max-w-[150px]">{row.value_criteria || '-'}</td>
              <td className="px-2 py-2">
                <CategoryBadge value={row.category} />
              </td>
              <td className="px-2 py-2 text-gray-600 max-w-[200px]">{row.justification_differentiation || '-'}</td>
              <td className="px-2 py-2 text-gray-600 max-w-[200px]">{row.competitive_advantage || '-'}</td>
              <td className="px-2 py-2 text-gray-600 max-w-[200px]">{row.benefit_for_user || '-'}</td>
              <td className="px-2 py-2 text-gray-600 max-w-[250px]">{row.proof || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Tabla PLANA para USP & UVP - SIN TOGGLE, todas las columnas visibles
function UspUvpTable({ data }: { data: UspUvpRow[] }) {
  if (data.length === 0) {
    return <EmptyState message="No hay datos. Haz click en 'Sincronizar' para parsear las campanas." />
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-xs">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">ECP</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Message Category</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Hypothesis</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Value Criteria</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Objective</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Message (EN)</th>
            <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Message (ES)</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, idx) => (
            <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-2 py-2 text-gray-900 whitespace-nowrap">{row.ecp_name}</td>
              <td className="px-2 py-2 text-gray-700 max-w-[150px]">{row.message_category}</td>
              <td className="px-2 py-2 text-gray-600 max-w-[200px]">{row.hypothesis || '-'}</td>
              <td className="px-2 py-2 text-gray-600 max-w-[150px]">{row.value_criteria || '-'}</td>
              <td className="px-2 py-2 text-gray-600 max-w-[150px]">{row.objective || '-'}</td>
              <td className="px-2 py-2 text-gray-600 max-w-[250px]">{row.message_en || '-'}</td>
              <td className="px-2 py-2 text-gray-600 max-w-[250px]">{row.message_es || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Utilidades
function RelevanceBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    'Critical': 'bg-red-100 text-red-700',
    'High': 'bg-orange-100 text-orange-700',
    'Medium-High': 'bg-yellow-100 text-yellow-700',
    'Medium': 'bg-yellow-100 text-yellow-700',
    'Low': 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${colors[value] || 'bg-gray-100 text-gray-600'}`}>
      {value || '-'}
    </span>
  )
}

function CategoryBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    'Differentiator': 'bg-purple-100 text-purple-700',
    'Qualifier': 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${colors[value] || 'bg-gray-100 text-gray-600'}`}>
      {value || '-'}
    </span>
  )
}

function getScoreColor(score: number | string): string {
  const numScore = typeof score === 'string' ? parseInt(score, 10) : score
  if (isNaN(numScore)) return 'bg-gray-100 text-gray-600'
  if (numScore >= 4) return 'bg-green-100 text-green-700'
  if (numScore >= 3) return 'bg-yellow-100 text-yellow-700'
  if (numScore >= 2) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
      <Table2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
      <p className="text-gray-500">{message}</p>
    </div>
  )
}
