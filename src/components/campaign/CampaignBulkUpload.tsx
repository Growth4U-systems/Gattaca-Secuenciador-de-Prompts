'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle, Download, Trash2 } from 'lucide-react'

interface CampaignRow {
  ecp_name: string
  problem_core?: string
  country?: string
  industry?: string
  prompt_research?: string
  [key: string]: string | undefined
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

export default function CampaignBulkUpload({
  projectId,
  projectVariables = [],
  onClose,
  onSuccess
}: CampaignBulkUploadProps) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Parse CSV text into campaigns array
  const parseCSV = useCallback((text: string) => {
    setErrors([])

    if (!text.trim()) {
      setCampaigns([])
      setHeaders([])
      return
    }

    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) {
      setErrors(['El CSV debe tener al menos una fila de encabezados y una de datos'])
      return
    }

    // Detect separator: tab, semicolon, or comma (in priority order)
    const headerLine = lines[0]
    let separator = ','
    if (headerLine.includes('\t')) {
      separator = '\t'
    } else if (headerLine.includes(';')) {
      separator = ';'
    }

    // Parse and clean headers - remove {{ }} if present, trim, lowercase
    const rawHeaders = parseCSVLine(headerLine, separator)
    const parsedHeaders = rawHeaders.map(h => {
      let cleaned = h.trim()
      // Remove {{ and }} from header names
      cleaned = cleaned.replace(/^\{\{/, '').replace(/\}\}$/, '')
      return cleaned.toLowerCase()
    })

    // Validate required header
    if (!parsedHeaders.includes('ecp_name')) {
      setErrors(['El CSV debe incluir una columna "ecp_name" o "{{ecp_name}}" para el nombre de cada campaña'])
      return
    }

    setHeaders(parsedHeaders)

    // Parse data rows
    const parsedCampaigns: CampaignRow[] = []
    const parseErrors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue // Skip empty lines

      const values = parseCSVLine(line, separator)
      const campaign: CampaignRow = { ecp_name: '' }

      parsedHeaders.forEach((header, index) => {
        const value = values[index]?.trim() || ''
        campaign[header] = value
      })

      if (!campaign.ecp_name) {
        parseErrors.push(`Fila ${i + 1}: falta el nombre de la campaña (ecp_name)`)
      } else {
        parsedCampaigns.push(campaign)
      }
    }

    if (parseErrors.length > 0) {
      setErrors(parseErrors)
    }

    setCampaigns(parsedCampaigns)
  }, [])

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

    // Reset input so same file can be re-uploaded
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

  // Create all campaigns
  const handleCreateCampaigns = async () => {
    if (campaigns.length === 0) {
      setErrors(['No hay campañas para crear'])
      return
    }

    // Validate required variables from project
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
      setErrors(validationErrors.slice(0, 10)) // Show max 10 errors
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          campaigns,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ ${data.count} campañas creadas exitosamente`)
        onSuccess()
        onClose()
      } else {
        setErrors([data.error || 'Error al crear campañas'])
      }
    } catch (error) {
      console.error('Error creating campaigns:', error)
      setErrors([error instanceof Error ? error.message : 'Error desconocido'])
    } finally {
      setCreating(false)
    }
  }

  // Download CSV template
  const downloadTemplate = () => {
    // Build header from reserved fields + project variables + prompt_research
    const reservedHeaders = ['ecp_name', 'problem_core', 'country', 'industry', 'prompt_research']
    const variableHeaders = projectVariables.map(v => v.name)
    const allHeaders = [...reservedHeaders, ...variableHeaders.filter(v => !reservedHeaders.includes(v))]

    // Create sample row
    const sampleRow = allHeaders.map(h => {
      if (h === 'ecp_name') return 'Nombre de Campaña 1'
      if (h === 'problem_core') return 'Descripción del problema'
      if (h === 'country') return 'España'
      if (h === 'industry') return 'Tecnología'
      if (h === 'prompt_research') return 'Prompt para deep research de esta campaña...'
      const varDef = projectVariables.find(v => v.name === h)
      return varDef?.default_value || `Valor de ${h}`
    })

    const csv = [
      allHeaders.join(','),
      sampleRow.join(','),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'campaigns_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Importar Campañas desde CSV</h2>
            <p className="text-sm text-gray-500 mt-1">
              Carga un archivo CSV con múltiples campañas y sus variables
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {campaigns.length === 0 ? (
            <>
              {/* Upload Section */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <FileSpreadsheet size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  Arrastra tu archivo CSV aquí
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  o haz clic para seleccionar un archivo
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    downloadTemplate()
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  <Download size={16} />
                  Descargar plantilla CSV
                </button>
              </div>

              {/* Or paste CSV */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  O pega el contenido CSV directamente:
                </label>
                <textarea
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value)
                    parseCSV(e.target.value)
                  }}
                  placeholder={`ecp_name,problem_core,country,industry,variable1,variable2
Campaña 1,Problema A,España,Tech,valor1,valor2
Campaña 2,Problema B,México,Retail,valor3,valor4`}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm text-gray-900 placeholder:text-gray-400"
                />
              </div>

              {/* Format Help */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2">Formato del CSV:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• La primera fila debe ser los nombres de las columnas (headers)</li>
                  <li>• Los headers pueden tener formato <code className="bg-blue-100 px-1 rounded">{'{{variable}}'}</code> o solo <code className="bg-blue-100 px-1 rounded">variable</code></li>
                  <li>• <code className="bg-blue-100 px-1 rounded">ecp_name</code> es obligatorio - es el nombre de cada campaña</li>
                  <li>• <code className="bg-blue-100 px-1 rounded">prompt_research</code> es opcional - prompt de deep research para la campaña</li>
                  <li>• Soporta separadores: tabulador, coma (,) o punto y coma (;)</li>
                  <li>• Solo se importarán las variables definidas en el proyecto</li>
                </ul>

                {projectVariables.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <h5 className="font-medium text-blue-800 mb-1">Variables del proyecto:</h5>
                    <div className="flex flex-wrap gap-2">
                      {projectVariables.map(v => (
                        <span
                          key={v.name}
                          className={`px-2 py-1 text-xs rounded ${
                            v.required
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {v.name}{v.required && ' *'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Preview Table */}
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">
                    Vista previa: {campaigns.length} campañas
                  </h3>
                  <p className="text-sm text-gray-500">
                    Revisa y edita los datos antes de crear las campañas
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCampaigns([])
                    setHeaders([])
                    setCsvText('')
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                >
                  Cargar otro archivo
                </button>
              </div>

              {/* Info: All project documents are inherited automatically */}
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
                        {headers.map((header) => (
                          <th
                            key={header}
                            className="px-3 py-2 text-left text-xs font-semibold text-gray-600 min-w-[120px]"
                          >
                            <span className="font-mono">{`{{${header}}}`}</span>
                            {projectVariables.find(v => v.name === header)?.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </th>
                        ))}
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {campaigns.map((campaign, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">{rowIndex + 1}</td>
                          {headers.map((header) => (
                            <td key={header} className="px-3 py-2">
                              {editingCell?.row === rowIndex && editingCell?.col === header ? (
                                <input
                                  type="text"
                                  value={campaign[header] || ''}
                                  onChange={(e) => updateCampaignValue(rowIndex, header, e.target.value)}
                                  onBlur={() => setEditingCell(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === 'Escape') {
                                      setEditingCell(null)
                                    }
                                  }}
                                  autoFocus
                                  className="w-full px-2 py-1 border border-blue-500 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              ) : (
                                <div
                                  onClick={() => setEditingCell({ row: rowIndex, col: header })}
                                  className={`px-2 py-1 rounded cursor-pointer hover:bg-gray-100 ${
                                    !campaign[header] && projectVariables.find(v => v.name === header)?.required
                                      ? 'bg-red-50 border border-red-200'
                                      : ''
                                  }`}
                                >
                                  <span className="text-gray-900">
                                    {campaign[header] || <span className="text-gray-400 italic">vacío</span>}
                                  </span>
                                </div>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            <button
                              onClick={() => removeCampaign(rowIndex)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800 mb-1">Errores encontrados:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {campaigns.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <CheckCircle size={16} className="text-green-600" />
                {campaigns.length} campañas listas para crear
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Cancelar
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
          </div>
        </div>
      </div>
    </div>
  )
}
