'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { RefreshCw, Download, Table2, Shield, MessageSquare, Filter, X } from 'lucide-react'
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

interface ColumnFilters {
  [columnKey: string]: string[]
}

export default function ExportDataTab({ projectId }: { projectId: string }) {
  const toast = useToast()
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('find-place')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [findPlaceData, setFindPlaceData] = useState<FindPlaceRow[]>([])
  const [proveLegitData, setProveLegitData] = useState<ProveLegitRow[]>([])
  const [uspUvpData, setUspUvpData] = useState<UspUvpRow[]>([])

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Datos Consolidados</h2>
          <p className="text-sm text-gray-500 mt-1">
            Visualiza y exporta los datos parseados de todas las campanas ({totalCount} registros)
          </p>
        </div>
        <div className="flex items-center gap-3">
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {activeSubTab === 'find-place' && <FindPlaceTable data={findPlaceData} />}
          {activeSubTab === 'prove-legit' && <ProveLegitTable data={proveLegitData} />}
          {activeSubTab === 'usp-uvp' && <UspUvpTable data={uspUvpData} />}
        </>
      )}
    </div>
  )
}

// Hook para manejar resize de columnas con drag
function useColumnResize(initialWidth: number) {
  const [width, setWidth] = useState(initialWidth)
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = width

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const delta = e.clientX - startX.current
      const newWidth = Math.max(60, Math.min(800, startWidth.current + delta))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      isResizing.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return { width, handleMouseDown }
}

// Componente de filtro dropdown
function FilterDropdown({
  values,
  selected,
  onChange,
  label
}: {
  values: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (values.length === 0) return null

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`p-1 rounded hover:bg-gray-200 transition-colors ${selected.length > 0 ? 'text-blue-600' : 'text-gray-400'}`}
        title={`Filtrar por ${label}`}
      >
        <Filter size={12} />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[180px] max-w-[250px]">
          <div className="max-h-[200px] overflow-y-auto">
            {values.map(value => (
              <label key={value} className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...selected, value])
                    } else {
                      onChange(selected.filter(v => v !== value))
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700 truncate">{value}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <button
              className="w-full mt-2 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded flex items-center justify-center gap-1"
              onClick={() => onChange([])}
            >
              <X size={12} />
              Limpiar filtro
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function getUniqueValues<T>(data: T[], columnKey: keyof T): string[] {
  const values = new Set<string>()
  data.forEach(row => {
    const value = row[columnKey]
    if (value !== null && value !== undefined && value !== '') {
      values.add(String(value))
    }
  })
  return Array.from(values).sort()
}

// Header redimensionable con drag handle
function ResizableTh({
  children,
  initialWidth = 150,
  filterValues,
  filterSelected,
  onFilterChange,
  label,
  className = ''
}: {
  children: React.ReactNode
  initialWidth?: number
  filterValues?: string[]
  filterSelected?: string[]
  onFilterChange?: (selected: string[]) => void
  label?: string
  className?: string
}) {
  const { width, handleMouseDown } = useColumnResize(initialWidth)

  return (
    <th
      className={`relative px-3 py-2 text-left font-semibold text-gray-700 bg-gray-50 ${className}`}
      style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
    >
      <div className="flex items-center gap-1 pr-2">
        <span className="truncate">{children}</span>
        {filterValues && onFilterChange && label && (
          <FilterDropdown
            values={filterValues}
            selected={filterSelected || []}
            onChange={onFilterChange}
            label={label}
          />
        )}
      </div>
      {/* Drag handle - borde derecho */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 transition-colors"
        style={{ borderRight: '2px solid transparent' }}
        title="Arrastrar para redimensionar"
      />
    </th>
  )
}

// Tabla Find Your Place
function FindPlaceTable({ data }: { data: FindPlaceRow[] }) {
  const [filters, setFilters] = useState<ColumnFilters>({})

  if (data.length === 0) {
    return <EmptyState message="No hay datos. Haz click en 'Sincronizar' para parsear las campanas." />
  }

  const allCompetitors = new Set<string>()
  data.forEach(row => {
    if (row.competitor_scores) {
      Object.keys(row.competitor_scores).forEach(comp => allCompetitors.add(comp))
    }
  })
  const competitors = Array.from(allCompetitors).sort()

  const filteredData = useMemo(() => {
    return data.filter(row => {
      return Object.entries(filters).every(([key, selectedValues]) => {
        if (selectedValues.length === 0) return true
        const value = String(row[key as keyof FindPlaceRow] || '')
        return selectedValues.includes(value)
      })
    })
  }, [data, filters])

  const updateFilter = (key: string, values: string[]) => {
    setFilters(prev => ({ ...prev, [key]: values }))
  }

  const activeFiltersCount = Object.values(filters).filter(v => v.length > 0).length

  return (
    <div className="space-y-2">
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{filteredData.length} de {data.length} registros</span>
          <button
            onClick={() => setFilters({})}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <X size={14} />
            Limpiar filtros
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <ResizableTh
                  initialWidth={180}
                  filterValues={getUniqueValues(data, 'ecp_name')}
                  filterSelected={filters['ecp_name']}
                  onFilterChange={(v) => updateFilter('ecp_name', v)}
                  label="ECP"
                >
                  ECP
                </ResizableTh>
                <ResizableTh
                  initialWidth={200}
                  filterValues={getUniqueValues(data, 'evaluation_criterion')}
                  filterSelected={filters['evaluation_criterion']}
                  onFilterChange={(v) => updateFilter('evaluation_criterion', v)}
                  label="Criterion"
                >
                  Evaluation Criterion
                </ResizableTh>
                <ResizableTh
                  initialWidth={100}
                  filterValues={getUniqueValues(data, 'relevance')}
                  filterSelected={filters['relevance']}
                  onFilterChange={(v) => updateFilter('relevance', v)}
                  label="Relevance"
                >
                  Relevance
                </ResizableTh>
                <ResizableTh initialWidth={300}>Justification</ResizableTh>
                {competitors.map(comp => (
                  <th key={comp} className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap bg-gray-50" style={{ minWidth: '70px' }}>
                    {comp}
                  </th>
                ))}
                <ResizableTh initialWidth={300}>Analysis & Opportunity</ResizableTh>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-gray-900">{row.ecp_name}</td>
                  <td className="px-3 py-2 text-gray-700">{row.evaluation_criterion}</td>
                  <td className="px-3 py-2"><RelevanceBadge value={row.relevance} /></td>
                  <td className="px-3 py-2 text-gray-600">{row.justification || '-'}</td>
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
                  <td className="px-3 py-2 text-gray-600">{row.analysis_opportunity || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Tabla Prove Legit
function ProveLegitTable({ data }: { data: ProveLegitRow[] }) {
  const [filters, setFilters] = useState<ColumnFilters>({})

  if (data.length === 0) {
    return <EmptyState message="No hay datos. Haz click en 'Sincronizar' para parsear las campanas." />
  }

  const filteredData = useMemo(() => {
    return data.filter(row => {
      return Object.entries(filters).every(([key, selectedValues]) => {
        if (selectedValues.length === 0) return true
        const value = String(row[key as keyof ProveLegitRow] || '')
        return selectedValues.includes(value)
      })
    })
  }, [data, filters])

  const updateFilter = (key: string, values: string[]) => {
    setFilters(prev => ({ ...prev, [key]: values }))
  }

  const activeFiltersCount = Object.values(filters).filter(v => v.length > 0).length

  return (
    <div className="space-y-2">
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{filteredData.length} de {data.length} registros</span>
          <button
            onClick={() => setFilters({})}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <X size={14} />
            Limpiar filtros
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <ResizableTh
                  initialWidth={180}
                  filterValues={getUniqueValues(data, 'ecp_name')}
                  filterSelected={filters['ecp_name']}
                  onFilterChange={(v) => updateFilter('ecp_name', v)}
                  label="ECP"
                >
                  ECP
                </ResizableTh>
                <ResizableTh
                  initialWidth={180}
                  filterValues={getUniqueValues(data, 'asset_name')}
                  filterSelected={filters['asset_name']}
                  onFilterChange={(v) => updateFilter('asset_name', v)}
                  label="Asset"
                >
                  Asset
                </ResizableTh>
                <ResizableTh initialWidth={180}>Value Criteria</ResizableTh>
                <ResizableTh
                  initialWidth={120}
                  filterValues={getUniqueValues(data, 'category')}
                  filterSelected={filters['category']}
                  onFilterChange={(v) => updateFilter('category', v)}
                  label="Category"
                >
                  Category
                </ResizableTh>
                <ResizableTh initialWidth={280}>Justification</ResizableTh>
                <ResizableTh initialWidth={280}>Competitive Advantage</ResizableTh>
                <ResizableTh initialWidth={280}>Benefit for User</ResizableTh>
                <ResizableTh initialWidth={280}>Proof</ResizableTh>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-gray-900">{row.ecp_name}</td>
                  <td className="px-3 py-2 text-gray-700">{row.asset_name}</td>
                  <td className="px-3 py-2 text-gray-600">{row.value_criteria || '-'}</td>
                  <td className="px-3 py-2"><CategoryBadge value={row.category} /></td>
                  <td className="px-3 py-2 text-gray-600">{row.justification_differentiation || '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{row.competitive_advantage || '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{row.benefit_for_user || '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{row.proof || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Tabla USP & UVP
function UspUvpTable({ data }: { data: UspUvpRow[] }) {
  const [filters, setFilters] = useState<ColumnFilters>({})

  if (data.length === 0) {
    return <EmptyState message="No hay datos. Haz click en 'Sincronizar' para parsear las campanas." />
  }

  const filteredData = useMemo(() => {
    return data.filter(row => {
      return Object.entries(filters).every(([key, selectedValues]) => {
        if (selectedValues.length === 0) return true
        const value = String(row[key as keyof UspUvpRow] || '')
        return selectedValues.includes(value)
      })
    })
  }, [data, filters])

  const updateFilter = (key: string, values: string[]) => {
    setFilters(prev => ({ ...prev, [key]: values }))
  }

  const activeFiltersCount = Object.values(filters).filter(v => v.length > 0).length

  return (
    <div className="space-y-2">
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{filteredData.length} de {data.length} registros</span>
          <button
            onClick={() => setFilters({})}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <X size={14} />
            Limpiar filtros
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <ResizableTh
                  initialWidth={180}
                  filterValues={getUniqueValues(data, 'ecp_name')}
                  filterSelected={filters['ecp_name']}
                  onFilterChange={(v) => updateFilter('ecp_name', v)}
                  label="ECP"
                >
                  ECP
                </ResizableTh>
                <ResizableTh
                  initialWidth={160}
                  filterValues={getUniqueValues(data, 'message_category')}
                  filterSelected={filters['message_category']}
                  onFilterChange={(v) => updateFilter('message_category', v)}
                  label="Category"
                >
                  Message Category
                </ResizableTh>
                <ResizableTh initialWidth={280}>Hypothesis</ResizableTh>
                <ResizableTh initialWidth={180}>Value Criteria</ResizableTh>
                <ResizableTh initialWidth={180}>Objective</ResizableTh>
                <ResizableTh initialWidth={320}>Message (EN)</ResizableTh>
                <ResizableTh initialWidth={320}>Message (ES)</ResizableTh>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-gray-900">{row.ecp_name}</td>
                  <td className="px-3 py-2 text-gray-700">{row.message_category}</td>
                  <td className="px-3 py-2 text-gray-600">{row.hypothesis || '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{row.value_criteria || '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{row.objective || '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{row.message_en || '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{row.message_es || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
