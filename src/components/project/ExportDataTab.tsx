'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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

// Anchos de columna en pixeles (para resize libre)
interface ColumnPixelWidths {
  [columnKey: string]: number
}

// Anchos iniciales por defecto
const defaultWidths: Record<string, number> = {
  ecp_name: 180,
  evaluation_criterion: 200,
  relevance: 100,
  justification: 300,
  analysis_opportunity: 300,
  asset_name: 180,
  value_criteria: 180,
  category: 120,
  justification_differentiation: 280,
  competitive_advantage: 280,
  benefit_for_user: 280,
  proof: 280,
  message_category: 160,
  hypothesis: 280,
  objective: 180,
  message_en: 320,
  message_es: 320,
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

// Hook para manejar el resize de columnas con drag
function useColumnResize(initialWidths: ColumnPixelWidths) {
  const [columnWidths, setColumnWidths] = useState<ColumnPixelWidths>(initialWidths)
  const [resizing, setResizing] = useState<string | null>(null)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = useCallback((columnKey: string, e: React.MouseEvent) => {
    e.preventDefault()
    setResizing(columnKey)
    startX.current = e.clientX
    startWidth.current = columnWidths[columnKey] || defaultWidths[columnKey] || 150
  }, [columnWidths])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing) return
    const diff = e.clientX - startX.current
    const newWidth = Math.max(60, startWidth.current + diff) // minimo 60px
    setColumnWidths(prev => ({ ...prev, [resizing]: newWidth }))
  }, [resizing])

  const handleMouseUp = useCallback(() => {
    setResizing(null)
  }, [])

  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizing, handleMouseMove, handleMouseUp])

  return { columnWidths, handleMouseDown, resizing }
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

// Funcion para extraer valores unicos de una columna
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

// Header redimensionable con drag
function ResizableHeader({
  label,
  columnKey,
  width,
  onResizeStart,
  values,
  filterSelected,
  onFilterChange,
  showFilter = true,
}: {
  label: string
  columnKey: string
  width: number
  onResizeStart: (columnKey: string, e: React.MouseEvent) => void
  values?: string[]
  filterSelected?: string[]
  onFilterChange?: (selected: string[]) => void
  showFilter?: boolean
}) {
  return (
    <th
      className="relative px-2 py-2 text-left font-semibold text-gray-700 bg-gray-50 select-none"
      style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
    >
      <div className="flex items-center gap-1 overflow-hidden">
        <span className="truncate">{label}</span>
        {showFilter && values && onFilterChange && (
          <FilterDropdown
            values={values}
            selected={filterSelected || []}
            onChange={onFilterChange}
            label={label}
          />
        )}
      </div>
      {/* Resize handle - borde derecho de la columna */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors group"
        onMouseDown={(e) => onResizeStart(columnKey, e)}
      >
        <div className="absolute right-0 top-0 bottom-0 w-[3px] group-hover:bg-blue-400" />
      </div>
    </th>
  )
}

// Celda con ancho fijo
function ResizableCell({
  children,
  width,
  className = '',
}: {
  children: React.ReactNode
  width: number
  className?: string
}) {
  return (
    <td
      className={`px-2 py-2 overflow-hidden ${className}`}
      style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
    >
      <div className="whitespace-normal break-words">{children}</div>
    </td>
  )
}

// Tabla para Find Your Place con resize libre
function FindPlaceTable({ data }: { data: FindPlaceRow[] }) {
  const [filters, setFilters] = useState<ColumnFilters>({})
  const { columnWidths, handleMouseDown, resizing } = useColumnResize({
    ecp_name: defaultWidths.ecp_name,
    evaluation_criterion: defaultWidths.evaluation_criterion,
    relevance: defaultWidths.relevance,
    justification: defaultWidths.justification,
    analysis_opportunity: defaultWidths.analysis_opportunity,
  })

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

  // Filtrar datos
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
      <div className={`overflow-x-auto rounded-lg border border-gray-200 ${resizing ? 'select-none' : ''}`}>
        <div className="max-h-[600px] overflow-y-auto">
          <table className="divide-y divide-gray-200 text-xs" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <ResizableHeader
                  label="ECP"
                  columnKey="ecp_name"
                  width={columnWidths.ecp_name || defaultWidths.ecp_name}
                  onResizeStart={handleMouseDown}
                  values={getUniqueValues(data, 'ecp_name')}
                  filterSelected={filters['ecp_name']}
                  onFilterChange={(v) => updateFilter('ecp_name', v)}
                />
                <ResizableHeader
                  label="Evaluation Criterion"
                  columnKey="evaluation_criterion"
                  width={columnWidths.evaluation_criterion || defaultWidths.evaluation_criterion}
                  onResizeStart={handleMouseDown}
                  values={getUniqueValues(data, 'evaluation_criterion')}
                  filterSelected={filters['evaluation_criterion']}
                  onFilterChange={(v) => updateFilter('evaluation_criterion', v)}
                />
                <ResizableHeader
                  label="Relevance"
                  columnKey="relevance"
                  width={columnWidths.relevance || defaultWidths.relevance}
                  onResizeStart={handleMouseDown}
                  values={getUniqueValues(data, 'relevance')}
                  filterSelected={filters['relevance']}
                  onFilterChange={(v) => updateFilter('relevance', v)}
                />
                <ResizableHeader
                  label="Justification"
                  columnKey="justification"
                  width={columnWidths.justification || defaultWidths.justification}
                  onResizeStart={handleMouseDown}
                  showFilter={false}
                />
                {competitors.map(comp => (
                  <th key={comp} className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap bg-gray-50" style={{ minWidth: '70px' }}>
                    {comp}
                  </th>
                ))}
                <ResizableHeader
                  label="Analysis & Opportunity"
                  columnKey="analysis_opportunity"
                  width={columnWidths.analysis_opportunity || defaultWidths.analysis_opportunity}
                  onResizeStart={handleMouseDown}
                  showFilter={false}
                />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <ResizableCell width={columnWidths.ecp_name || defaultWidths.ecp_name} className="text-gray-900">
                    {row.ecp_name}
                  </ResizableCell>
                  <ResizableCell width={columnWidths.evaluation_criterion || defaultWidths.evaluation_criterion} className="text-gray-700">
                    {row.evaluation_criterion}
                  </ResizableCell>
                  <td className="px-2 py-2" style={{ width: `${columnWidths.relevance || defaultWidths.relevance}px` }}>
                    <RelevanceBadge value={row.relevance} />
                  </td>
                  <ResizableCell width={columnWidths.justification || defaultWidths.justification} className="text-gray-600">
                    {row.justification || '-'}
                  </ResizableCell>
                  {competitors.map(comp => {
                    const score = row.competitor_scores?.[comp]?.score
                    return (
                      <td key={comp} className="px-2 py-2 text-center" style={{ minWidth: '70px' }}>
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
                  <ResizableCell width={columnWidths.analysis_opportunity || defaultWidths.analysis_opportunity} className="text-gray-600">
                    {row.analysis_opportunity || '-'}
                  </ResizableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Tabla para Prove Legit con resize libre
function ProveLegitTable({ data }: { data: ProveLegitRow[] }) {
  const [filters, setFilters] = useState<ColumnFilters>({})
  const { columnWidths, handleMouseDown, resizing } = useColumnResize({
    ecp_name: defaultWidths.ecp_name,
    asset_name: defaultWidths.asset_name,
    value_criteria: defaultWidths.value_criteria,
    category: defaultWidths.category,
    justification_differentiation: defaultWidths.justification_differentiation,
    competitive_advantage: defaultWidths.competitive_advantage,
    benefit_for_user: defaultWidths.benefit_for_user,
    proof: defaultWidths.proof,
  })

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
      <div className={`overflow-x-auto rounded-lg border border-gray-200 ${resizing ? 'select-none' : ''}`}>
        <div className="max-h-[600px] overflow-y-auto">
          <table className="divide-y divide-gray-200 text-xs" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <ResizableHeader
                  label="ECP"
                  columnKey="ecp_name"
                  width={columnWidths.ecp_name || defaultWidths.ecp_name}
                  onResizeStart={handleMouseDown}
                  values={getUniqueValues(data, 'ecp_name')}
                  filterSelected={filters['ecp_name']}
                  onFilterChange={(v) => updateFilter('ecp_name', v)}
                />
                <ResizableHeader
                  label="Asset"
                  columnKey="asset_name"
                  width={columnWidths.asset_name || defaultWidths.asset_name}
                  onResizeStart={handleMouseDown}
                  values={getUniqueValues(data, 'asset_name')}
                  filterSelected={filters['asset_name']}
                  onFilterChange={(v) => updateFilter('asset_name', v)}
                />
                <ResizableHeader
                  label="Value Criteria"
                  columnKey="value_criteria"
                  width={columnWidths.value_criteria || defaultWidths.value_criteria}
                  onResizeStart={handleMouseDown}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Category"
                  columnKey="category"
                  width={columnWidths.category || defaultWidths.category}
                  onResizeStart={handleMouseDown}
                  values={getUniqueValues(data, 'category')}
                  filterSelected={filters['category']}
                  onFilterChange={(v) => updateFilter('category', v)}
                />
                <ResizableHeader
                  label="Justification"
                  columnKey="justification_differentiation"
                  width={columnWidths.justification_differentiation || defaultWidths.justification_differentiation}
                  onResizeStart={handleMouseDown}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Competitive Advantage"
                  columnKey="competitive_advantage"
                  width={columnWidths.competitive_advantage || defaultWidths.competitive_advantage}
                  onResizeStart={handleMouseDown}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Benefit for User"
                  columnKey="benefit_for_user"
                  width={columnWidths.benefit_for_user || defaultWidths.benefit_for_user}
                  onResizeStart={handleMouseDown}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Proof"
                  columnKey="proof"
                  width={columnWidths.proof || defaultWidths.proof}
                  onResizeStart={handleMouseDown}
                  showFilter={false}
                />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <ResizableCell width={columnWidths.ecp_name || defaultWidths.ecp_name} className="text-gray-900">
                    {row.ecp_name}
                  </ResizableCell>
                  <ResizableCell width={columnWidths.asset_name || defaultWidths.asset_name} className="text-gray-700">
                    {row.asset_name}
                  </ResizableCell>
                  <ResizableCell width={columnWidths.value_criteria || defaultWidths.value_criteria} className="text-gray-600">
                    {row.value_criteria || '-'}
                  </ResizableCell>
                  <td className="px-2 py-2" style={{ width: `${columnWidths.category || defaultWidths.category}px` }}>
                    <CategoryBadge value={row.category} />
                  </td>
                  <ResizableCell width={columnWidths.justification_differentiation || defaultWidths.justification_differentiation} className="text-gray-600">
                    {row.justification_differentiation || '-'}
                  </ResizableCell>
                  <ResizableCell width={columnWidths.competitive_advantage || defaultWidths.competitive_advantage} className="text-gray-600">
                    {row.competitive_advantage || '-'}
                  </ResizableCell>
                  <ResizableCell width={columnWidths.benefit_for_user || defaultWidths.benefit_for_user} className="text-gray-600">
                    {row.benefit_for_user || '-'}
                  </ResizableCell>
                  <ResizableCell width={columnWidths.proof || defaultWidths.proof} className="text-gray-600">
                    {row.proof || '-'}
                  </ResizableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Tabla para USP & UVP con resize libre
function UspUvpTable({ data }: { data: UspUvpRow[] }) {
  const [filters, setFilters] = useState<ColumnFilters>({})
  const { columnWidths, handleMouseDown, resizing } = useColumnResize({
    ecp_name: defaultWidths.ecp_name,
    message_category: defaultWidths.message_category,
    hypothesis: defaultWidths.hypothesis,
    value_criteria: defaultWidths.value_criteria,
    objective: defaultWidths.objective,
    message_en: defaultWidths.message_en,
    message_es: defaultWidths.message_es,
  })

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
      <div className={`overflow-x-auto rounded-lg border border-gray-200 ${resizing ? 'select-none' : ''}`}>
        <div className="max-h-[600px] overflow-y-auto">
          <table className="divide-y divide-gray-200 text-xs" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <ResizableHeader
                  label="ECP"
                  columnKey="ecp_name"
                  width={columnWidths.ecp_name || defaultWidths.ecp_name}
                  onResizeStart={handleMouseDown}
                  values={getUniqueValues(data, 'ecp_name')}
                  filterSelected={filters['ecp_name']}
                  onFilterChange={(v) => updateFilter('ecp_name', v)}
                />
                <ResizableHeader
                  label="Message Category"
                  columnKey="message_category"
                  width={columnWidths.message_category || defaultWidths.message_category}
                  onResizeStart={handleMouseDown}
                  values={getUniqueValues(data, 'message_category')}
                  filterSelected={filters['message_category']}
                  onFilterChange={(v) => updateFilter('message_category', v)}
                />
                <ResizableHeader
                  label="Hypothesis"
                  columnKey="hypothesis"
                  width={columnWidths.hypothesis || defaultWidths.hypothesis}
                  onResizeStart={handleMouseDown}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Value Criteria"
                  columnKey="value_criteria"
                  width={columnWidths.value_criteria || defaultWidths.value_criteria}
                  onResizeStart={handleMouseDown}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Objective"
                  columnKey="objective"
                  width={columnWidths.objective || defaultWidths.objective}
                  onResizeStart={handleMouseDown}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Message (EN)"
                  columnKey="message_en"
                  width={columnWidths.message_en || defaultWidths.message_en}
                  onResizeStart={handleMouseDown}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Message (ES)"
                  columnKey="message_es"
                  width={columnWidths.message_es || defaultWidths.message_es}
                  onResizeStart={handleMouseDown}
                  showFilter={false}
                />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <ResizableCell width={columnWidths.ecp_name || defaultWidths.ecp_name} className="text-gray-900">
                    {row.ecp_name}
                  </ResizableCell>
                  <ResizableCell width={columnWidths.message_category || defaultWidths.message_category} className="text-gray-700">
                    {row.message_category}
                  </ResizableCell>
                  <ResizableCell width={columnWidths.hypothesis || defaultWidths.hypothesis} className="text-gray-600">
                    {row.hypothesis || '-'}
                  </ResizableCell>
                  <ResizableCell width={columnWidths.value_criteria || defaultWidths.value_criteria} className="text-gray-600">
                    {row.value_criteria || '-'}
                  </ResizableCell>
                  <ResizableCell width={columnWidths.objective || defaultWidths.objective} className="text-gray-600">
                    {row.objective || '-'}
                  </ResizableCell>
                  <ResizableCell width={columnWidths.message_en || defaultWidths.message_en} className="text-gray-600">
                    {row.message_en || '-'}
                  </ResizableCell>
                  <ResizableCell width={columnWidths.message_es || defaultWidths.message_es} className="text-gray-600">
                    {row.message_es || '-'}
                  </ResizableCell>
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
