'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle, Download, Trash2, ArrowRight, RefreshCw } from 'lucide-react'

interface CampaignRow {
  ecp_name: string
  problem_core?: string
  country?: string
  industry?: string
  [key: string]: string | undefined
}

interface RawCsvData {
  headers: string[]
  rows: string[][]
}

interface CampaignBulkUploadProps {
  projectId: string
  projectVariables?: Array<{
    name: string
    default_value: string
    required: boolean
    description?: string
  }>
  onClose: () => void
  onSuccess: () => void
}

type Step = 'upload' | 'mapping' | 'preview'

export default function CampaignBulkUpload({
  projectId,
  projectVariables = [],
  onClose,
  onSuccess
}: CampaignBulkUploadProps) {
  const [step, setStep] = useState<Step>('upload')
  const [rawCsvData, setRawCsvData] = useState<RawCsvData | null>(null)
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({}) // projectVar -> csvColumn
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // All variables we need to map (reserved + project variables)
  const reservedFields = ['ecp_name', 'problem_core', 'country', 'industry']
  const allVariables = [
    ...reservedFields,
    ...projectVariables.map(v => v.name).filter(name => !reservedFields.includes(name))
  ]

  // Parse CSV text into raw data (preserving original headers)
  const parseCSV = useCallback((text: string) => {
    setErrors([])

    if (!text.trim()) {
      setRawCsvData(null)
      return
    }

    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) {
      setErrors(['El CSV debe tener al menos una fila de encabezados y una de datos'])
      return
    }

    // Detect separator
    const headerLine = lines[0]
    let separator = ','
    if (headerLine.includes('\t')) {
      separator = '\t'
    } else if (headerLine.includes(';')) {
      separator = ';'
    }

    // Parse headers (keep original case, just trim and remove {{ }})
    const rawHeaders = parseCSVLine(headerLine, separator)
    const headers = rawHeaders.map(h => {
      let cleaned = h.trim()
      cleaned = cleaned.replace(/^\{\{/, '').replace(/\}\}$/, '')
      return cleaned
    })

    // Parse data rows
    const rows: string[][] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const values = parseCSVLine(line, separator)
      rows.push(values.map(v => v.trim()))
    }

    if (rows.length === 0) {
      setErrors(['No se encontraron filas de datos en el CSV'])
      return
    }

    setRawCsvData({ headers, rows })

    // Auto-detect column mapping
    const autoMapping: Record<string, string> = {}
    allVariables.forEach(varName => {
      // Try exact match first
      let match = headers.find(h => h === varName)
      // Then case-insensitive
      if (!match) {
        match = headers.find(h => h.toLowerCase() === varName.toLowerCase())
      }
      if (match) {
        autoMapping[varName] = match
      }
    })
    setColumnMapping(autoMapping)

    // Go to mapping step
    setStep('mapping')
  }, [allVariables])

  // Parse a single CSV line handling quoted values
  const parseCSVLine = (line: string, separator: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === separator && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    result.push(current)

    return result
  }

  // Apply mapping and go to preview
  const applyMapping = () => {
    if (!rawCsvData) return

    // Check required fields
    if (!columnMapping['ecp_name']) {
      setErrors(['Debes mapear la columna "ecp_name" (nombre de campaña)'])
      return
    }

    setErrors([])

    // Transform raw data using mapping
    const mappedCampaigns: CampaignRow[] = rawCsvData.rows.map(row => {
      const campaign: CampaignRow = { ecp_name: '' }

      allVariables.forEach(varName => {
        const csvColumn = columnMapping[varName]
        if (csvColumn) {
          const colIndex = rawCsvData.headers.indexOf(csvColumn)
          if (colIndex >= 0) {
            campaign[varName] = row[colIndex] || ''
          }
        }
      })

      return campaign
    }).filter(c => c.ecp_name) // Filter out rows without ecp_name

    if (mappedCampaigns.length === 0) {
      setErrors(['No se encontraron campañas válidas después del mapeo'])
      return
    }

    setCampaigns(mappedCampaigns)
    setStep('preview')
  }

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvText(text)
      parseCSV(text)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file || !file.name.endsWith('.csv')) {
      setErrors(['Por favor sube un archivo CSV'])
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvText(text)
      parseCSV(text)
    }
    reader.readAsText(file)
  }

  // Update campaign value
  const updateCampaignValue = (rowIndex: number, field: string, value: string) => {
    setCampaigns(prev => {
      const updated = [...prev]
      updated[rowIndex] = { ...updated[rowIndex], [field]: value }
      return updated
    })
  }

  // Remove a campaign row
  const removeCampaign = (index: number) => {
    setCampaigns(prev => prev.filter((_, i) => i !== index))
  }

  // Reset to upload step
  const resetToUpload = () => {
    setStep('upload')
    setRawCsvData(null)
    setColumnMapping({})
    setCampaigns([])
    setCsvText('')
    setErrors([])
  }

  // Create all campaigns
  const handleCreateCampaigns = async () => {
    if (campaigns.length === 0) {
      setErrors(['No hay campañas para crear'])
      return
    }

    // Validate required variables
    const validationErrors: string[] = []
    const requiredVars = projectVariables.filter(v => v.required).map(v => v.name)

    campaigns.forEach((campaign, index) => {
      requiredVars.forEach(varName => {
        if (!campaign[varName]) {
          validationErrors.push(`Fila ${index + 1}: falta variable requerida "${varName}"`)
        }
      })
    })

    if (validationErrors.length > 0) {
      setErrors(validationErrors.slice(0, 10))
      if (validationErrors.length > 10) {
        setErrors(prev => [...prev, `... y ${validationErrors.length - 10} errores más`])
      }
      return
    }

    setCreating(true)
    setErrors([])

    try {
      const response = await fetch('/api/campaign/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, campaigns }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ ${data.count} campañas creadas exitosamente`)
        onSuccess()
        onClose()
      } else {
        let errorMsg = data.error || 'Error al crear campañas'
        if (data.details) errorMsg += `: ${data.details}`
        setErrors([errorMsg])
        alert(`❌ Error: ${errorMsg}`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
      setErrors([errorMsg])
      alert(`❌ Error de red: ${errorMsg}`)
    } finally {
      setCreating(false)
    }
  }

  // Download CSV template
  const downloadTemplate = () => {
    const allHeaders = [...reservedFields, ...projectVariables.map(v => v.name).filter(v => !reservedFields.includes(v))]
    const sampleRow = allHeaders.map(h => {
      if (h === 'ecp_name') return 'Nombre de Campaña 1'
      if (h === 'problem_core') return 'Descripción del problema'
      if (h === 'country') return 'España'
      if (h === 'industry') return 'Tecnología'
      const varDef = projectVariables.find(v => v.name === h)
      return varDef?.default_value || `Valor de ${h}`
    })

    const csv = [allHeaders.join(','), sampleRow.join(',')].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'campaigns_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Get mapped columns (for preview headers)
  const getMappedHeaders = () => {
    return allVariables.filter(v => columnMapping[v])
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Importar Campañas desde CSV</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded ${step === 'upload' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                1. Subir
              </span>
              <ArrowRight size={12} className="text-gray-400" />
              <span className={`text-xs px-2 py-0.5 rounded ${step === 'mapping' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                2. Mapear
              </span>
              <ArrowRight size={12} className="text-gray-400" />
              <span className={`text-xs px-2 py-0.5 rounded ${step === 'preview' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                3. Crear
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                <FileSpreadsheet size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">Arrastra tu archivo CSV aquí</p>
                <p className="text-sm text-gray-500 mb-4">o haz clic para seleccionar un archivo</p>
                <button
                  onClick={(e) => { e.stopPropagation(); downloadTemplate() }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  <Download size={16} />
                  Descargar plantilla CSV
                </button>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">O pega el contenido CSV directamente:</label>
                <textarea
                  value={csvText}
                  onChange={(e) => { setCsvText(e.target.value); parseCSV(e.target.value) }}
                  placeholder={`ecp_name,problem_core,country,industry
Campaña 1,Problema A,España,Tech
Campaña 2,Problema B,México,Retail`}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </>
          )}

          {/* Step 2: Mapping */}
          {step === 'mapping' && rawCsvData && (
            <>
              <div className="mb-4">
                <h3 className="font-medium text-gray-900 mb-1">Mapear columnas del CSV</h3>
                <p className="text-sm text-gray-500">
                  Selecciona qué columna del CSV corresponde a cada variable del proyecto.
                  Se detectaron {rawCsvData.headers.length} columnas y {rawCsvData.rows.length} filas.
                </p>
              </div>

              <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                {allVariables.map(varName => {
                  const isRequired = varName === 'ecp_name' || projectVariables.find(v => v.name === varName)?.required
                  const isMapped = !!columnMapping[varName]

                  return (
                    <div
                      key={varName}
                      className={`flex items-center gap-4 p-3 rounded-lg border ${
                        isMapped ? 'bg-green-50 border-green-200' : isRequired ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="w-1/3">
                        <span className="font-mono text-sm text-gray-900">{varName}</span>
                        {isRequired && <span className="text-red-500 ml-1">*</span>}
                        {projectVariables.find(v => v.name === varName)?.description && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {projectVariables.find(v => v.name === varName)?.description}
                          </p>
                        )}
                      </div>
                      <ArrowRight size={16} className="text-gray-400" />
                      <select
                        value={columnMapping[varName] || ''}
                        onChange={(e) => setColumnMapping(prev => ({ ...prev, [varName]: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- No mapear --</option>
                        {rawCsvData.headers.map((header, idx) => (
                          <option key={idx} value={header}>
                            {header} (ej: {rawCsvData.rows[0]?.[idx]?.substring(0, 30) || 'vacío'}...)
                          </option>
                        ))}
                      </select>
                      {isMapped && <CheckCircle size={18} className="text-green-600" />}
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  💡 Las columnas se auto-detectaron por nombre similar. Ajusta manualmente si es necesario.
                </p>
              </div>
            </>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Vista previa: {campaigns.length} campañas</h3>
                  <p className="text-sm text-gray-500">Revisa los datos antes de crear las campañas</p>
                </div>
                <button
                  onClick={() => setStep('mapping')}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg inline-flex items-center gap-1"
                >
                  <RefreshCw size={14} />
                  Ajustar mapeo
                </button>
              </div>

              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  ✓ Todas las campañas heredarán automáticamente los documentos del proyecto y su configuración de flujo.
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-10">#</th>
                        {getMappedHeaders().map((header) => (
                          <th key={header} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 min-w-[120px]">
                            <span className="font-mono">{header}</span>
                            {(header === 'ecp_name' || projectVariables.find(v => v.name === header)?.required) && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </th>
                        ))}
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {campaigns.slice(0, 50).map((campaign, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">{rowIndex + 1}</td>
                          {getMappedHeaders().map((header) => (
                            <td key={header} className="px-3 py-2">
                              {editingCell?.row === rowIndex && editingCell?.col === header ? (
                                <input
                                  type="text"
                                  value={campaign[header] || ''}
                                  onChange={(e) => updateCampaignValue(rowIndex, header, e.target.value)}
                                  onBlur={() => setEditingCell(null)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null) }}
                                  autoFocus
                                  className="w-full px-2 py-1 border border-blue-500 rounded text-gray-900 focus:outline-none"
                                />
                              ) : (
                                <div
                                  onClick={() => setEditingCell({ row: rowIndex, col: header })}
                                  className={`px-2 py-1 rounded cursor-pointer hover:bg-gray-100 truncate max-w-[200px] ${
                                    !campaign[header] && (header === 'ecp_name' || projectVariables.find(v => v.name === header)?.required)
                                      ? 'bg-red-50 border border-red-200' : ''
                                  }`}
                                  title={campaign[header] || ''}
                                >
                                  <span className="text-gray-900">
                                    {campaign[header] || <span className="text-gray-400 italic">vacío</span>}
                                  </span>
                                </div>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            <button onClick={() => removeCampaign(rowIndex)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {campaigns.length > 50 && (
                  <div className="px-4 py-2 bg-gray-50 text-sm text-gray-500 text-center">
                    Mostrando 50 de {campaigns.length} campañas
                  </div>
                )}
              </div>
            </>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800 mb-1">Errores:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {errors.map((error, index) => <li key={index}>{error}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {step === 'mapping' && rawCsvData && (
              <span>{Object.keys(columnMapping).filter(k => columnMapping[k]).length} de {allVariables.length} variables mapeadas</span>
            )}
            {step === 'preview' && campaigns.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <CheckCircle size={16} className="text-green-600" />
                {campaigns.length} campañas listas
              </span>
            )}
          </div>
          <div className="flex gap-3">
            {step === 'upload' && (
              <button onClick={onClose} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">
                Cancelar
              </button>
            )}
            {step === 'mapping' && (
              <>
                <button onClick={resetToUpload} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">
                  ← Volver
                </button>
                <button
                  onClick={applyMapping}
                  disabled={!columnMapping['ecp_name']}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  Aplicar mapeo
                  <ArrowRight size={16} />
                </button>
              </>
            )}
            {step === 'preview' && (
              <>
                <button onClick={() => setStep('mapping')} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">
                  ← Volver
                </button>
                <button
                  onClick={handleCreateCampaigns}
                  disabled={creating || campaigns.length === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Crear {campaigns.length} Campañas
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
