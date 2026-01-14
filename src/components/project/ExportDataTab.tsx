'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Download, Table2, Shield, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'
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

// Componente de tabla para Find Your Place
function FindPlaceTable({ data }: { data: FindPlaceRow[] }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

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

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-8 px-2"></th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ECP</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criterion</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Relevance</th>
            {competitors.map(comp => (
              <th key={comp} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                {comp.length > 10 ? comp.substring(0, 10) + '...' : comp}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row) => {
            const isExpanded = expandedRows.has(row.id)
            return (
              <>
                <tr key={row.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(row.id)}>
                  <td className="px-2 py-3">
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-[150px] truncate" title={row.ecp_name}>
                    {row.ecp_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate" title={row.evaluation_criterion}>
                    {row.evaluation_criterion}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <RelevanceBadge value={row.relevance} />
                  </td>
                  {competitors.map(comp => {
                    const score = row.competitor_scores?.[comp]?.score
                    return (
                      <td key={comp} className="px-3 py-3 text-sm text-center">
                        {score !== undefined ? (
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium ${getScoreColor(score)}`}>
                            {score}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
                {isExpanded && (
                  <tr key={`${row.id}-expanded`} className="bg-gray-50">
                    <td colSpan={4 + competitors.length} className="px-8 py-4">
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Justification:</span>
                          <p className="text-gray-600 mt-1">{row.justification || '-'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Analysis & Opportunity:</span>
                          <p className="text-gray-600 mt-1">{row.analysis_opportunity || '-'}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Componente de tabla para Prove Legit
function ProveLegitTable({ data }: { data: ProveLegitRow[] }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  if (data.length === 0) {
    return <EmptyState message="No hay datos. Haz click en 'Sincronizar' para parsear las campanas." />
  }

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-8 px-2"></th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ECP</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value Criteria</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row) => {
            const isExpanded = expandedRows.has(row.id)
            return (
              <>
                <tr key={row.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(row.id)}>
                  <td className="px-2 py-3">
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-[150px] truncate" title={row.ecp_name}>
                    {row.ecp_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate" title={row.asset_name}>
                    {row.asset_name}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <CategoryBadge value={row.category} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate" title={row.value_criteria}>
                    {row.value_criteria || '-'}
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${row.id}-expanded`} className="bg-gray-50">
                    <td colSpan={5} className="px-8 py-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Justification for Differentiation:</span>
                          <p className="text-gray-600 mt-1">{row.justification_differentiation || '-'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Competitive Advantage:</span>
                          <p className="text-gray-600 mt-1">{row.competitive_advantage || '-'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Benefit for User:</span>
                          <p className="text-gray-600 mt-1">{row.benefit_for_user || '-'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Proof:</span>
                          <p className="text-gray-600 mt-1">{row.proof || '-'}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Componente de tabla para USP & UVP
function UspUvpTable({ data }: { data: UspUvpRow[] }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  if (data.length === 0) {
    return <EmptyState message="No hay datos. Haz click en 'Sincronizar' para parsear las campanas." />
  }

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-8 px-2"></th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ECP</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message Category</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value Criteria</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Objective</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row) => {
            const isExpanded = expandedRows.has(row.id)
            return (
              <>
                <tr key={row.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(row.id)}>
                  <td className="px-2 py-3">
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-[150px] truncate" title={row.ecp_name}>
                    {row.ecp_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate" title={row.message_category}>
                    {row.message_category}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate" title={row.value_criteria}>
                    {row.value_criteria || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate" title={row.objective}>
                    {row.objective || '-'}
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${row.id}-expanded`} className="bg-gray-50">
                    <td colSpan={5} className="px-8 py-4">
                      <div className="space-y-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Hypothesis:</span>
                          <p className="text-gray-600 mt-1">{row.hypothesis || '-'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-3 rounded-lg border border-gray-200">
                            <span className="font-medium text-gray-700 block mb-2">Message (EN):</span>
                            <p className="text-gray-800">{row.message_en || '-'}</p>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-gray-200">
                            <span className="font-medium text-gray-700 block mb-2">Message (ES):</span>
                            <p className="text-gray-800">{row.message_es || '-'}</p>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
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
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[value] || 'bg-gray-100 text-gray-600'}`}>
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
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[value] || 'bg-gray-100 text-gray-600'}`}>
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
