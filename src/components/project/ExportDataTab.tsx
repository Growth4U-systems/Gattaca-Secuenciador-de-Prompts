'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { RefreshCw, Download, Table2, Shield, MessageSquare, Filter, X, GripVertical } from 'lucide-react'
import { useToast } from '@/components/ui'

type SubTab = 'find-place' | 'prove-legit' | 'usp-uvp'
type ColumnWidth = 'auto' | 'compact' | 'normal' | 'wide'

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

interface ColumnWidths {
  [columnKey: string]: ColumnWidth
}

const widthConfig: Record<ColumnWidth, { className: string; label: string }> = {
  auto: { className: '', label: 'Auto' },
  compact: { className: 'max-w-[120px]', label: 'S' },
  normal: { className: 'max-w-[200px]', label: 'M' },
  wide: { className: 'max-w-[350px]', label: 'L' },
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

// Selector de ancho de columna individual
function ColumnWidthSelector({
  width,
  onChange,
}: {
  width: ColumnWidth
  onChange: (width: ColumnWidth) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const widths: ColumnWidth[] = ['auto', 'compact', 'normal', 'wide']

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-0.5 rounded hover:bg-gray-300 transition-colors text-gray-400 hover:text-gray-600"
        title="Ajustar ancho de columna"
      >
        <GripVertical size={10} />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[60px]">
          {widths.map(w => (
            <button
              key={w}
              onClick={() => {
                onChange(w)
                setOpen(false)
              }}
              className={`w-full px-2 py-1 text-xs text-left hover:bg-gray-100 ${
                width === w ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              {widthConfig[w].label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
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

// Header con filtro y selector de ancho integrado
function ResizableHeader({
  label,
  columnKey,
  values,
  filterSelected,
  onFilterChange,
  width,
  onWidthChange,
  showFilter = true,
}: {
  label: string
  columnKey: string
  values?: string[]
  filterSelected?: string[]
  onFilterChange?: (selected: string[]) => void
  width: ColumnWidth
  onWidthChange: (width: ColumnWidth) => void
  showFilter?: boolean
}) {
  return (
    <th className={`px-2 py-2 text-left font-semibold text-gray-700 ${widthConfig[width].className}`}>
      <div className="flex items-center gap-1">
        <ColumnWidthSelector width={width} onChange={onWidthChange} />
        <span className="whitespace-nowrap truncate">{label}</span>
        {showFilter && values && onFilterChange && (
          <FilterDropdown
            values={values}
            selected={filterSelected || []}
            onChange={onFilterChange}
            label={label}
          />
        )}
      </div>
    </th>
  )
}

// Tabla para Find Your Place con filtros, sticky header y anchos por columna
function FindPlaceTable({ data }: { data: FindPlaceRow[] }) {
  const [filters, setFilters] = useState<ColumnFilters>({})
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
    ecp_name: 'normal',
    evaluation_criterion: 'normal',
    relevance: 'auto',
    justification: 'wide',
    analysis_opportunity: 'wide',
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

  const updateWidth = (key: string, width: ColumnWidth) => {
    setColumnWidths(prev => ({ ...prev, [key]: width }))
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
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <ResizableHeader
                  label="ECP"
                  columnKey="ecp_name"
                  values={getUniqueValues(data, 'ecp_name')}
                  filterSelected={filters['ecp_name']}
                  onFilterChange={(v) => updateFilter('ecp_name', v)}
                  width={columnWidths['ecp_name'] || 'normal'}
                  onWidthChange={(w) => updateWidth('ecp_name', w)}
                />
                <ResizableHeader
                  label="Evaluation Criterion"
                  columnKey="evaluation_criterion"
                  values={getUniqueValues(data, 'evaluation_criterion')}
                  filterSelected={filters['evaluation_criterion']}
                  onFilterChange={(v) => updateFilter('evaluation_criterion', v)}
                  width={columnWidths['evaluation_criterion'] || 'normal'}
                  onWidthChange={(w) => updateWidth('evaluation_criterion', w)}
                />
                <ResizableHeader
                  label="Relevance"
                  columnKey="relevance"
                  values={getUniqueValues(data, 'relevance')}
                  filterSelected={filters['relevance']}
                  onFilterChange={(v) => updateFilter('relevance', v)}
                  width={columnWidths['relevance'] || 'auto'}
                  onWidthChange={(w) => updateWidth('relevance', w)}
                />
                <ResizableHeader
                  label="Justification"
                  columnKey="justification"
                  width={columnWidths['justification'] || 'wide'}
                  onWidthChange={(w) => updateWidth('justification', w)}
                  showFilter={false}
                />
                {competitors.map(comp => (
                  <th key={comp} className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">
                    {comp}
                  </th>
                ))}
                <ResizableHeader
                  label="Analysis & Opportunity"
                  columnKey="analysis_opportunity"
                  width={columnWidths['analysis_opportunity'] || 'wide'}
                  onWidthChange={(w) => updateWidth('analysis_opportunity', w)}
                  showFilter={false}
                />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className={`px-2 py-2 text-gray-900 ${widthConfig[columnWidths['ecp_name'] || 'normal'].className} whitespace-normal`}>
                    {row.ecp_name}
                  </td>
                  <td className={`px-2 py-2 text-gray-700 ${widthConfig[columnWidths['evaluation_criterion'] || 'normal'].className} whitespace-normal`}>
                    {row.evaluation_criterion}
                  </td>
                  <td className="px-2 py-2">
                    <RelevanceBadge value={row.relevance} />
                  </td>
                  <td className={`px-2 py-2 text-gray-600 ${widthConfig[columnWidths['justification'] || 'wide'].className} whitespace-normal`}>
                    {row.justification || '-'}
                  </td>
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
                  <td className={`px-2 py-2 text-gray-600 ${widthConfig[columnWidths['analysis_opportunity'] || 'wide'].className} whitespace-normal`}>
                    {row.analysis_opportunity || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Tabla para Prove Legit con filtros, sticky header y anchos por columna
function ProveLegitTable({ data }: { data: ProveLegitRow[] }) {
  const [filters, setFilters] = useState<ColumnFilters>({})
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
    ecp_name: 'normal',
    asset_name: 'normal',
    value_criteria: 'normal',
    category: 'auto',
    justification_differentiation: 'wide',
    competitive_advantage: 'wide',
    benefit_for_user: 'wide',
    proof: 'wide',
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

  const updateWidth = (key: string, width: ColumnWidth) => {
    setColumnWidths(prev => ({ ...prev, [key]: width }))
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
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <ResizableHeader
                  label="ECP"
                  columnKey="ecp_name"
                  values={getUniqueValues(data, 'ecp_name')}
                  filterSelected={filters['ecp_name']}
                  onFilterChange={(v) => updateFilter('ecp_name', v)}
                  width={columnWidths['ecp_name'] || 'normal'}
                  onWidthChange={(w) => updateWidth('ecp_name', w)}
                />
                <ResizableHeader
                  label="Asset"
                  columnKey="asset_name"
                  values={getUniqueValues(data, 'asset_name')}
                  filterSelected={filters['asset_name']}
                  onFilterChange={(v) => updateFilter('asset_name', v)}
                  width={columnWidths['asset_name'] || 'normal'}
                  onWidthChange={(w) => updateWidth('asset_name', w)}
                />
                <ResizableHeader
                  label="Value Criteria"
                  columnKey="value_criteria"
                  width={columnWidths['value_criteria'] || 'normal'}
                  onWidthChange={(w) => updateWidth('value_criteria', w)}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Category"
                  columnKey="category"
                  values={getUniqueValues(data, 'category')}
                  filterSelected={filters['category']}
                  onFilterChange={(v) => updateFilter('category', v)}
                  width={columnWidths['category'] || 'auto'}
                  onWidthChange={(w) => updateWidth('category', w)}
                />
                <ResizableHeader
                  label="Justification"
                  columnKey="justification_differentiation"
                  width={columnWidths['justification_differentiation'] || 'wide'}
                  onWidthChange={(w) => updateWidth('justification_differentiation', w)}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Competitive Advantage"
                  columnKey="competitive_advantage"
                  width={columnWidths['competitive_advantage'] || 'wide'}
                  onWidthChange={(w) => updateWidth('competitive_advantage', w)}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Benefit for User"
                  columnKey="benefit_for_user"
                  width={columnWidths['benefit_for_user'] || 'wide'}
                  onWidthChange={(w) => updateWidth('benefit_for_user', w)}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Proof"
                  columnKey="proof"
                  width={columnWidths['proof'] || 'wide'}
                  onWidthChange={(w) => updateWidth('proof', w)}
                  showFilter={false}
                />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className={`px-2 py-2 text-gray-900 ${widthConfig[columnWidths['ecp_name'] || 'normal'].className} whitespace-normal`}>
                    {row.ecp_name}
                  </td>
                  <td className={`px-2 py-2 text-gray-700 ${widthConfig[columnWidths['asset_name'] || 'normal'].className} whitespace-normal`}>
                    {row.asset_name}
                  </td>
                  <td className={`px-2 py-2 text-gray-600 ${widthConfig[columnWidths['value_criteria'] || 'normal'].className} whitespace-normal`}>
                    {row.value_criteria || '-'}
                  </td>
                  <td className="px-2 py-2">
                    <CategoryBadge value={row.category} />
                  </td>
                  <td className={`px-2 py-2 text-gray-600 ${widthConfig[columnWidths['justification_differentiation'] || 'wide'].className} whitespace-normal`}>
                    {row.justification_differentiation || '-'}
                  </td>
                  <td className={`px-2 py-2 text-gray-600 ${widthConfig[columnWidths['competitive_advantage'] || 'wide'].className} whitespace-normal`}>
                    {row.competitive_advantage || '-'}
                  </td>
                  <td className={`px-2 py-2 text-gray-600 ${widthConfig[columnWidths['benefit_for_user'] || 'wide'].className} whitespace-normal`}>
                    {row.benefit_for_user || '-'}
                  </td>
                  <td className={`px-2 py-2 text-gray-600 ${widthConfig[columnWidths['proof'] || 'wide'].className} whitespace-normal`}>
                    {row.proof || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Tabla para USP & UVP con filtros, sticky header y anchos por columna
function UspUvpTable({ data }: { data: UspUvpRow[] }) {
  const [filters, setFilters] = useState<ColumnFilters>({})
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
    ecp_name: 'normal',
    message_category: 'normal',
    hypothesis: 'wide',
    value_criteria: 'normal',
    objective: 'normal',
    message_en: 'wide',
    message_es: 'wide',
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

  const updateWidth = (key: string, width: ColumnWidth) => {
    setColumnWidths(prev => ({ ...prev, [key]: width }))
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
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <ResizableHeader
                  label="ECP"
                  columnKey="ecp_name"
                  values={getUniqueValues(data, 'ecp_name')}
                  filterSelected={filters['ecp_name']}
                  onFilterChange={(v) => updateFilter('ecp_name', v)}
                  width={columnWidths['ecp_name'] || 'normal'}
                  onWidthChange={(w) => updateWidth('ecp_name', w)}
                />
                <ResizableHeader
                  label="Message Category"
                  columnKey="message_category"
                  values={getUniqueValues(data, 'message_category')}
                  filterSelected={filters['message_category']}
                  onFilterChange={(v) => updateFilter('message_category', v)}
                  width={columnWidths['message_category'] || 'normal'}
                  onWidthChange={(w) => updateWidth('message_category', w)}
                />
                <ResizableHeader
                  label="Hypothesis"
                  columnKey="hypothesis"
                  width={columnWidths['hypothesis'] || 'wide'}
                  onWidthChange={(w) => updateWidth('hypothesis', w)}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Value Criteria"
                  columnKey="value_criteria"
                  width={columnWidths['value_criteria'] || 'normal'}
                  onWidthChange={(w) => updateWidth('value_criteria', w)}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Objective"
                  columnKey="objective"
                  width={columnWidths['objective'] || 'normal'}
                  onWidthChange={(w) => updateWidth('objective', w)}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Message (EN)"
                  columnKey="message_en"
                  width={columnWidths['message_en'] || 'wide'}
                  onWidthChange={(w) => updateWidth('message_en', w)}
                  showFilter={false}
                />
                <ResizableHeader
                  label="Message (ES)"
                  columnKey="message_es"
                  width={columnWidths['message_es'] || 'wide'}
                  onWidthChange={(w) => updateWidth('message_es', w)}
                  showFilter={false}
                />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className={`px-2 py-2 text-gray-900 ${widthConfig[columnWidths['ecp_name'] || 'normal'].className} whitespace-normal`}>
                    {row.ecp_name}
                  </td>
                  <td className={`px-2 py-2 text-gray-700 ${widthConfig[columnWidths['message_category'] || 'normal'].className} whitespace-normal`}>
                    {row.message_category}
                  </td>
                  <td className={`px-2 py-2 text-gray-600 ${widthConfig[columnWidths['hypothesis'] || 'wide'].className} whitespace-normal`}>
                    {row.hypothesis || '-'}
                  </td>
                  <td className={`px-2 py-2 text-gray-600 ${widthConfig[columnWidths['value_criteria'] || 'normal'].className} whitespace-normal`}>
                    {row.value_criteria || '-'}
                  </td>
                  <td className={`px-2 py-2 text-gray-600 ${widthConfig[columnWidths['objective'] || 'normal'].className} whitespace-normal`}>
                    {row.objective || '-'}
                  </td>
                  <td className={`px-2 py-2 text-gray-600 ${widthConfig[columnWidths['message_en'] || 'wide'].className} whitespace-normal`}>
                    {row.message_en || '-'}
                  </td>
                  <td className={`px-2 py-2 text-gray-600 ${widthConfig[columnWidths['message_es'] || 'wide'].className} whitespace-normal`}>
                    {row.message_es || '-'}
                  </td>
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
