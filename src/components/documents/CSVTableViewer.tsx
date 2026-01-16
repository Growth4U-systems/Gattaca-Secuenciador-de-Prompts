'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Download, Table, Code, ChevronLeft, ChevronRight, Search, X, Columns, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

interface CSVTableViewerProps {
  content: string
  filename: string
}

/**
 * Parse CSV content into a 2D array
 * Handles quoted fields with commas and newlines
 */
function parseCSV(content: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const nextChar = content[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        currentField += '"'
        i++ // Skip next quote
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true
      } else if (char === ',') {
        // End of field
        currentRow.push(currentField.trim())
        currentField = ''
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        // End of row
        currentRow.push(currentField.trim())
        if (currentRow.some(cell => cell !== '')) {
          rows.push(currentRow)
        }
        currentRow = []
        currentField = ''
        if (char === '\r') i++ // Skip \n in \r\n
      } else if (char !== '\r') {
        currentField += char
      }
    }
  }

  // Don't forget the last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some(cell => cell !== '')) {
      rows.push(currentRow)
    }
  }

  return rows
}

export default function CSVTableViewer({ content, filename }: CSVTableViewerProps) {
  const [viewMode, setViewMode] = useState<'table' | 'raw'>('table')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [showColumnFilter, setShowColumnFilter] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Set<number>>(new Set())
  const [sortColumn, setSortColumn] = useState<number | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [columnFilters, setColumnFilters] = useState<Record<number, string>>({})
  const columnFilterRef = useRef<HTMLDivElement>(null)
  const rowsPerPage = 50

  // Parse CSV
  const { headers, rows } = useMemo(() => {
    const parsed = parseCSV(content)
    if (parsed.length === 0) return { headers: [], rows: [] }

    const headers = parsed[0]
    const rows = parsed.slice(1)
    return { headers, rows }
  }, [content])

  // Initialize visible columns when headers change
  useEffect(() => {
    if (headers.length > 0 && visibleColumns.size === 0) {
      setVisibleColumns(new Set(headers.map((_, i) => i)))
    }
  }, [headers, visibleColumns.size])

  // Close column filter when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnFilterRef.current && !columnFilterRef.current.contains(event.target as Node)) {
        setShowColumnFilter(false)
      }
    }

    if (showColumnFilter) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showColumnFilter])

  // Process rows: column filters -> global search -> sort
  const processedRows = useMemo(() => {
    let result = [...rows]

    // 1. Apply column filters
    Object.entries(columnFilters).forEach(([col, filter]) => {
      if (filter) {
        const colIndex = parseInt(col)
        result = result.filter(row =>
          row[colIndex]?.toLowerCase().includes(filter.toLowerCase())
        )
      }
    })

    // 2. Apply global search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(row =>
        row.some(cell => cell.toLowerCase().includes(query))
      )
    }

    // 3. Apply sort
    if (sortColumn !== null) {
      result.sort((a, b) => {
        const aVal = a[sortColumn] || ''
        const bVal = b[sortColumn] || ''
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true })
        return sortDirection === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [rows, columnFilters, searchQuery, sortColumn, sortDirection])

  // Check if any column filter is active
  const hasActiveColumnFilters = Object.values(columnFilters).some(f => f)

  // Handle header click for sorting
  const handleHeaderClick = (colIndex: number) => {
    if (sortColumn === colIndex) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortColumn(null)
        setSortDirection('asc')
      }
    } else {
      setSortColumn(colIndex)
      setSortDirection('asc')
    }
  }

  // Clear all column filters
  const clearAllColumnFilters = () => {
    setColumnFilters({})
    setCurrentPage(0)
  }

  // Paginate
  const totalPages = Math.ceil(processedRows.length / rowsPerPage)
  const paginatedRows = useMemo(() => {
    const start = currentPage * rowsPerPage
    return processedRows.slice(start, start + rowsPerPage)
  }, [processedRows, currentPage, rowsPerPage])

  // Download CSV
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Toggle column visibility
  const toggleColumn = (index: number) => {
    const newVisible = new Set(visibleColumns)
    if (newVisible.has(index)) {
      // Don't allow hiding all columns
      if (newVisible.size > 1) {
        newVisible.delete(index)
      }
    } else {
      newVisible.add(index)
    }
    setVisibleColumns(newVisible)
  }

  // Show/hide all columns
  const toggleAllColumns = (show: boolean) => {
    if (show) {
      setVisibleColumns(new Set(headers.map((_, i) => i)))
    } else {
      // Keep at least one column visible
      setVisibleColumns(new Set([0]))
    }
  }

  if (headers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No se pudo parsear el contenido CSV</p>
      </div>
    )
  }

  // Get visible headers and their indices
  const visibleHeadersWithIndex = headers
    .map((header, index) => ({ header, index }))
    .filter(({ index }) => visibleColumns.has(index))

  // Get sort icon for column
  const getSortIcon = (colIndex: number) => {
    if (sortColumn !== colIndex) {
      return <ArrowUpDown size={10} className="text-gray-300" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp size={10} className="text-blue-600" />
      : <ArrowDown size={10} className="text-blue-600" />
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Table size={12} />
              Tabla
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 ${
                viewMode === 'raw'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Code size={12} />
              Raw
            </button>
          </div>

          {/* Column Filter */}
          {viewMode === 'table' && (
            <div className="relative" ref={columnFilterRef}>
              <button
                onClick={() => setShowColumnFilter(!showColumnFilter)}
                className={`px-2 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 border ${
                  showColumnFilter || visibleColumns.size < headers.length
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                <Columns size={12} />
                Columnas
                {visibleColumns.size < headers.length && (
                  <span className="ml-1 px-1 py-0.5 text-[10px] bg-blue-600 text-white rounded">
                    {visibleColumns.size}/{headers.length}
                  </span>
                )}
              </button>

              {showColumnFilter && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px] max-w-[300px] max-h-[300px] overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-gray-100 flex items-center justify-between gap-2 flex-shrink-0">
                    <span className="text-xs font-medium text-gray-700">Mostrar columnas</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleAllColumns(true)}
                        className="px-1.5 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 rounded"
                      >
                        Todas
                      </button>
                      <button
                        onClick={() => toggleAllColumns(false)}
                        className="px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100 rounded"
                      >
                        Ninguna
                      </button>
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1 p-1">
                    {headers.map((header, i) => (
                      <label
                        key={i}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(i)}
                          onChange={() => toggleColumn(i)}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700 truncate flex-1">
                          {header || `Col ${i + 1}`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Row count */}
          <span className="text-xs text-gray-500">
            {processedRows.length} filas
            {(searchQuery || hasActiveColumnFilters) && ` (de ${rows.length})`}
          </span>

          {/* Clear column filters button */}
          {hasActiveColumnFilters && (
            <button
              onClick={clearAllColumnFilters}
              className="px-2 py-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 inline-flex items-center gap-1"
            >
              <X size={12} />
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(0)
              }}
              placeholder="Buscar..."
              className="pl-7 pr-6 py-1 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 w-36"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setCurrentPage(0)
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-1 font-medium transition-colors"
          >
            <Download size={12} />
            CSV
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'table' ? (
        <div className="flex-1 overflow-auto border border-gray-200 rounded-lg bg-white">
          <div className="min-w-max">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                {/* Header row */}
                <tr className="bg-gray-50">
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 border-b border-gray-200 bg-gray-50 sticky left-0 z-20">
                    #
                  </th>
                  {visibleHeadersWithIndex.map(({ header, index }) => (
                    <th
                      key={index}
                      onClick={() => handleHeaderClick(index)}
                      className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-700 border-b border-gray-200 bg-gray-50 whitespace-nowrap min-w-[120px] cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span className="truncate">{header || `Col ${index + 1}`}</span>
                        {getSortIcon(index)}
                      </div>
                    </th>
                  ))}
                </tr>
                {/* Filter row */}
                <tr className="bg-gray-25">
                  <th className="px-1 py-1 bg-white border-b border-gray-200 sticky left-0 z-20"></th>
                  {visibleHeadersWithIndex.map(({ index }) => (
                    <th key={index} className="px-1 py-1 bg-white border-b border-gray-200">
                      <div className="relative">
                        <input
                          type="text"
                          value={columnFilters[index] || ''}
                          onChange={(e) => {
                            setColumnFilters({ ...columnFilters, [index]: e.target.value })
                            setCurrentPage(0)
                          }}
                          placeholder="Filtrar..."
                          className="w-full text-[10px] px-1.5 py-0.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-700 placeholder:text-gray-400"
                        />
                        {columnFilters[index] && (
                          <button
                            onClick={() => {
                              const newFilters = { ...columnFilters }
                              delete newFilters[index]
                              setColumnFilters(newFilters)
                              setCurrentPage(0)
                            }}
                            className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <td className="px-2 py-1.5 text-[10px] text-gray-400 font-mono sticky left-0 bg-white">
                      {currentPage * rowsPerPage + rowIndex + 1}
                    </td>
                    {visibleHeadersWithIndex.map(({ index }) => (
                      <td
                        key={index}
                        className="px-2 py-1.5 text-xs text-gray-700 whitespace-nowrap min-w-[120px]"
                        title={row[index] || ''}
                      >
                        {row[index]?.length > 100 ? row[index].substring(0, 100) + '...' : row[index] || ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <pre className="flex-1 overflow-auto text-xs text-gray-700 whitespace-pre-wrap font-mono bg-white p-3 rounded-lg border border-gray-200">
          {content}
        </pre>
      )}

      {/* Pagination */}
      {viewMode === 'table' && totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 flex-shrink-0">
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <ChevronLeft size={14} />
            Ant
          </button>
          <span className="text-xs text-gray-500">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            Sig
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
