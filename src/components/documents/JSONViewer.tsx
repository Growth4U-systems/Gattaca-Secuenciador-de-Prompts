'use client'

import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Copy, Check, Download, Code, Table, Search, X } from 'lucide-react'

interface JSONViewerProps {
  content: string
  filename: string
}

// Recursive component to render JSON nodes
function JSONNode({
  data,
  keyName,
  depth = 0,
  defaultExpanded = true
}: {
  data: unknown
  keyName?: string
  depth?: number
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded && depth < 2)

  const isObject = data !== null && typeof data === 'object'
  const isArray = Array.isArray(data)
  const isEmpty = isObject && Object.keys(data as object).length === 0

  // Render primitive values
  if (!isObject) {
    let valueClass = 'text-gray-700'
    let displayValue: string = String(data)

    if (typeof data === 'string') {
      valueClass = 'text-green-600'
      // Truncate long strings (like URLs)
      if (displayValue.length > 100) {
        displayValue = displayValue.slice(0, 100) + '...'
      }
      displayValue = `"${displayValue}"`
    } else if (typeof data === 'number') {
      valueClass = 'text-blue-600'
    } else if (typeof data === 'boolean') {
      valueClass = 'text-purple-600'
    } else if (data === null) {
      valueClass = 'text-gray-400'
      displayValue = 'null'
    }

    return (
      <span className={valueClass}>{displayValue}</span>
    )
  }

  // Render empty object/array
  if (isEmpty) {
    return (
      <span className="text-gray-400">{isArray ? '[]' : '{}'}</span>
    )
  }

  const entries = Object.entries(data as object)
  const bracketOpen = isArray ? '[' : '{'
  const bracketClose = isArray ? ']' : '}'

  return (
    <div className="inline">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center hover:bg-gray-100 rounded px-0.5 -ml-0.5"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-gray-400" />
        ) : (
          <ChevronRight size={14} className="text-gray-400" />
        )}
        <span className="text-gray-500">{bracketOpen}</span>
        {!expanded && (
          <span className="text-gray-400 text-xs ml-1">
            {isArray ? `${entries.length} items` : `${entries.length} keys`}
          </span>
        )}
        {!expanded && <span className="text-gray-500">{bracketClose}</span>}
      </button>

      {expanded && (
        <>
          <div className="ml-4 border-l border-gray-200 pl-2">
            {entries.map(([key, value], index) => (
              <div key={key} className="py-0.5">
                {!isArray && (
                  <span className="text-purple-700 font-medium">"{key}"</span>
                )}
                {isArray && (
                  <span className="text-gray-400 text-xs">{key}</span>
                )}
                <span className="text-gray-500">: </span>
                <JSONNode
                  data={value}
                  keyName={key}
                  depth={depth + 1}
                  defaultExpanded={depth < 1}
                />
                {index < entries.length - 1 && <span className="text-gray-400">,</span>}
              </div>
            ))}
          </div>
          <span className="text-gray-500">{bracketClose}</span>
        </>
      )}
    </div>
  )
}

// Convert JSON array to CSV for table view
function jsonToTable(data: unknown[]): { headers: string[], rows: string[][] } {
  if (!data.length) return { headers: [], rows: [] }

  // Get all unique keys from all objects
  const allKeys = new Set<string>()
  data.forEach(item => {
    if (item && typeof item === 'object') {
      Object.keys(item as object).forEach(key => allKeys.add(key))
    }
  })

  const headers = Array.from(allKeys)

  // Filter out keys with very long values (like image URLs)
  const filteredHeaders = headers.filter(key => {
    const sampleValues = data.slice(0, 5).map(item => {
      const val = (item as Record<string, unknown>)?.[key]
      return typeof val === 'string' ? val : ''
    })
    // Exclude if most values are very long URLs
    const longUrlCount = sampleValues.filter(v => v.length > 200 && v.includes('http')).length
    return longUrlCount < 3
  })

  const rows = data.map(item => {
    return filteredHeaders.map(key => {
      const val = (item as Record<string, unknown>)?.[key]
      if (val === null || val === undefined) return ''
      if (typeof val === 'object') return JSON.stringify(val).slice(0, 100)
      return String(val).slice(0, 200)
    })
  })

  return { headers: filteredHeaders, rows }
}

export default function JSONViewer({ content, filename }: JSONViewerProps) {
  const [viewMode, setViewMode] = useState<'tree' | 'table' | 'raw'>('tree')
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const rowsPerPage = 50

  // Parse JSON
  const { parsed, error, isArray } = useMemo(() => {
    try {
      const parsed = JSON.parse(content)
      return { parsed, error: null, isArray: Array.isArray(parsed) }
    } catch (e) {
      return { parsed: null, error: (e as Error).message, isArray: false }
    }
  }, [content])

  // Table data (only for arrays)
  const { headers, rows } = useMemo(() => {
    if (!isArray || !parsed) return { headers: [], rows: [] }
    return jsonToTable(parsed as unknown[])
  }, [parsed, isArray])

  // Filter and paginate rows
  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows
    const query = searchQuery.toLowerCase()
    return rows.filter(row =>
      row.some(cell => cell.toLowerCase().includes(query))
    )
  }, [rows, searchQuery])

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage)
  const paginatedRows = filteredRows.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage
  )

  // Copy to clipboard
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Download JSON
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename.endsWith('.json') ? filename : `${filename}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>Error parsing JSON: {error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'tree'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Code size={14} />
              Tree
            </button>
            {isArray && (
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'table'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Table size={14} />
                Tabla
              </button>
            )}
            <button
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'raw'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Raw
            </button>
          </div>

          {/* Item count */}
          <span className="text-xs text-gray-500">
            {isArray ? `${(parsed as unknown[]).length} items` : 'Object'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search (only for table mode) */}
          {viewMode === 'table' && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(0)
                }}
                placeholder="Buscar..."
                className="pl-9 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 w-48"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setCurrentPage(0)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 inline-flex items-center gap-1.5"
          >
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-1.5 font-medium transition-colors"
          >
            <Download size={14} />
            Descargar JSON
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'tree' && (
        <div className="flex-1 overflow-auto bg-white p-4 rounded-xl border border-gray-200 font-mono text-sm">
          <JSONNode data={parsed} defaultExpanded={true} />
        </div>
      )}

      {viewMode === 'table' && isArray && (
        <>
          <div className="flex-1 overflow-auto border border-gray-200 rounded-xl bg-white">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 bg-gray-50">
                    #
                  </th>
                  {headers.map((header, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-gray-200 bg-gray-50 whitespace-nowrap"
                    >
                      {header}
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
                    <td className="px-3 py-2 text-xs text-gray-400 font-mono">
                      {currentPage * rowsPerPage + rowIndex + 1}
                    </td>
                    {row.map((cell, colIndex) => (
                      <td
                        key={colIndex}
                        className="px-3 py-2 text-sm text-gray-700 max-w-xs truncate"
                        title={cell}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 flex-shrink-0">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-500">
                Página {currentPage + 1} de {totalPages}
                {searchQuery && ` (${filteredRows.length} resultados)`}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}

      {viewMode === 'raw' && (
        <pre className="flex-1 overflow-auto text-sm text-gray-700 whitespace-pre-wrap font-mono bg-white p-4 rounded-xl border border-gray-200">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )}
    </div>
  )
}
