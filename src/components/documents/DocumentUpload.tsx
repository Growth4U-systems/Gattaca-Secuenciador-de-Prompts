'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, X, AlertCircle, Loader2, FileUp, Check, Users } from 'lucide-react'
import { DocCategory } from '@/types/database.types'
import { formatTokenCount, supabase } from '@/lib/supabase'
import { DocumentNameValidationBadge } from './DocumentNameInput'

interface DocumentUploadProps {
  projectId?: string
  clientId?: string
  onUploadComplete: () => void
}

// Base categories with labels
const CATEGORIES = [
  { value: 'product', label: 'Producto', icon: '📦', description: 'Información sobre tu producto o servicio' },
  { value: 'competitor', label: 'Competidor', icon: '🎯', description: 'Análisis de competencia y mercado' },
  { value: 'research', label: 'Research', icon: '🔬', description: 'Investigación de mercado y audiencia' },
  { value: 'output', label: 'Output', icon: '📝', description: 'Resultados guardados de pasos anteriores' },
  { value: 'custom', label: 'Personalizada', icon: '🏷️', description: 'Categoría personalizada' },
]

export default function DocumentUpload({
  projectId,
  clientId,
  onUploadComplete,
}: DocumentUploadProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [category, setCategory] = useState<DocCategory>('product')
  const [customCategory, setCustomCategory] = useState('')
  const [useCustomCategory, setUseCustomCategory] = useState(false)
  const [description, setDescription] = useState('')
  const [extractionResult, setExtractionResult] = useState<{
    text: string
    tokens: number
  } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [competitorName, setCompetitorName] = useState('')
  const [competitors, setCompetitors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // The actual category to use (custom or selected)
  const effectiveCategory = useCustomCategory ? customCategory.trim() : category

  // Fetch competitors list from campaigns
  useEffect(() => {
    const fetchCompetitors = async () => {
      try {
        if (projectId) {
          // Direct: fetch campaigns for this project
          const res = await fetch(`/api/campaign/list?projectId=${projectId}&playbookType=competitor_analysis`)
          const data = await res.json()
          if (data.success && data.campaigns) {
            setCompetitors(data.campaigns.map((c: { ecp_name: string }) => c.ecp_name).filter(Boolean))
          }
        } else if (clientId) {
          // Indirect: fetch client's projects, then campaigns for each
          const { data: projects } = await supabase
            .from('projects')
            .select('id')
            .eq('client_id', clientId)
          if (!projects?.length) return

          const allNames: string[] = []
          for (const project of projects) {
            const res = await fetch(`/api/campaign/list?projectId=${project.id}&playbookType=competitor_analysis`)
            const data = await res.json()
            if (data.success && data.campaigns) {
              for (const c of data.campaigns) {
                if (c.ecp_name && !allNames.includes(c.ecp_name)) {
                  allNames.push(c.ecp_name)
                }
              }
            }
          }
          setCompetitors(allNames)
        }
      } catch { /* ignore - competitors dropdown won't show */ }
    }
    fetchCompetitors()
  }, [projectId, clientId])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = async (file: File) => {
    setError(null)

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/csv',
      'text/markdown',
      'text/html',
      'text/x-markdown',
      'application/json',
      'application/vnd.ms-excel',
    ]

    const validExtensions = ['.csv', '.md', '.markdown', '.html', '.htm', '.json', '.txt', '.pdf', '.doc', '.docx']
    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))

    if (!validTypes.includes(file.type) && !hasValidExtension) {
      setError('Tipo de archivo no soportado. Usa PDF, DOCX, TXT, CSV, Markdown o HTML.')
      return
    }

    setSelectedFile(file)

    // Extract content preview (this will be done server-side in production)
    try {
      const text = await extractTextPreview(file)
      const tokens = Math.ceil(text.length / 4)
      setExtractionResult({ text, tokens })
    } catch (err) {
      console.error('Error extracting text:', err)
      setError('Error al extraer texto del archivo')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    if (!extractionResult) {
      setError('El contenido del archivo aún no se ha extraído. Intenta seleccionar el archivo de nuevo.')
      return
    }

    setUploading(true)
    setError(null)
    try {
      // Check if file is large and needs Blob
      const USE_BLOB = process.env.NEXT_PUBLIC_USE_BLOB === 'true' || selectedFile.size > 4 * 1024 * 1024

      if (USE_BLOB) {
        // Upload large files using Vercel Blob client upload
        console.log('Using Blob upload for large file:', selectedFile.size)

        // Step 1: Upload to Blob using client upload
        const { upload } = await import('@vercel/blob/client')

        const blob = await upload(selectedFile.name, selectedFile, {
          access: 'public',
          handleUploadUrl: '/api/documents/upload-url',
        })

        console.log('Uploaded to Blob:', blob.url)

        // Step 2: Tell backend to process the blob
        const response = await fetch('/api/documents/process-blob', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blobUrl: blob.url,
            filename: selectedFile.name,
            projectId: projectId || null,
            clientId: clientId || null,
            category: effectiveCategory,
            description: description.trim(),
            fileSize: selectedFile.size,
            mimeType: selectedFile.type,
            competitorName: competitorName || null,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to process blob')
        }

        const result = await response.json()
        console.log('Processing successful:', result)
      } else {
        // Upload small files normally
        console.log('Using direct upload for small file:', selectedFile.size)

        const formData = new FormData()
        formData.append('file', selectedFile)
        if (projectId) formData.append('projectId', projectId)
        if (clientId) formData.append('clientId', clientId)
        formData.append('category', effectiveCategory)
        formData.append('description', description.trim())
        if (competitorName) formData.append('competitorName', competitorName)

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          let errorData
          try {
            errorData = await response.json()
          } catch {
            throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
          }

          let errorMsg = errorData.error || 'Upload failed'
          if (errorData.hint) {
            errorMsg += `\n\n${errorData.hint}`
          }
          throw new Error(errorMsg)
        }

        const result = await response.json()
        console.log('Upload successful:', result)
      }

      // Reset and close
      handleCancel()
      onUploadComplete()
    } catch (err) {
      console.error('Error uploading:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    setIsOpen(false)
    setSelectedFile(null)
    setExtractionResult(null)
    setUseCustomCategory(false)
    setCustomCategory('')
    setCategory('product')
    setDescription('')
    setCompetitorName('')
    setError(null)
    setDragActive(false)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md"
      >
        <Upload size={18} />
        Subir Documento
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 backdrop-blur rounded-xl">
                    <FileUp className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Subir Documento</h2>
                </div>
                <button
                  onClick={handleCancel}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* File Upload Zone */}
              {!selectedFile ? (
                <div
                  className={`
                    relative border-2 border-dashed rounded-2xl p-8 text-center transition-all
                    ${dragActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'
                    }
                  `}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.csv,.md,.markdown,.html,.htm,.json"
                    onChange={handleInputChange}
                    className="hidden"
                  />

                  <div className="flex flex-col items-center">
                    <div className={`p-4 rounded-2xl mb-4 ${dragActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Upload className={`w-8 h-8 ${dragActive ? 'text-blue-600' : 'text-gray-400'}`} />
                    </div>
                    <p className="text-gray-700 font-medium mb-1">
                      {dragActive ? 'Suelta el archivo aquí' : 'Arrastra un archivo aquí'}
                    </p>
                    <p className="text-gray-500 text-sm mb-4">
                      o haz click para seleccionar
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                    >
                      Seleccionar archivo
                    </button>
                    <p className="text-xs text-gray-400 mt-4">
                      PDF, DOCX, TXT, CSV, Markdown o HTML
                    </p>
                  </div>
                </div>
              ) : (
                /* Selected File Preview */
                <div className="bg-blue-50 rounded-2xl p-4 flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">{selectedFile.name}</p>
                      <DocumentNameValidationBadge filename={selectedFile.name} size="xs" />
                    </div>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null)
                      setExtractionResult(null)
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              {/* Extraction Preview */}
              {extractionResult && (
                <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-green-900">Contenido Extraído</h4>
                      <p className="text-sm text-green-700">
                        {formatTokenCount(extractionResult.tokens)} tokens estimados
                      </p>
                    </div>
                  </div>
                  <div className="bg-white border border-green-200 rounded-xl p-3 max-h-32 overflow-y-auto">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                      {extractionResult.text.slice(0, 500)}
                      {extractionResult.text.length > 500 && '...'}
                    </pre>
                  </div>
                </div>
              )}

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Categoría del documento
                </label>

                {/* Category Toggle */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setUseCustomCategory(false)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      !useCustomCategory
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    Categorías base
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseCustomCategory(true)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      useCustomCategory
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    Personalizada
                  </button>
                </div>

                {!useCustomCategory ? (
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.filter(c => c.value !== 'custom').map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value as DocCategory)}
                        className={`
                          flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all text-left
                          ${category === cat.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200 hover:bg-gray-100'
                          }
                        `}
                      >
                        <span className="text-lg">{cat.icon}</span>
                        <span className="text-sm font-medium">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="ej: Business Banking, Personal Banking, Seguros..."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                  />
                )}
              </div>

              {/* Competitor Assignment - show when there are competitors available */}
              {competitors.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Asignar a competidor <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select
                      value={competitorName}
                      onChange={(e) => setCompetitorName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white appearance-none text-sm"
                    >
                      <option value="">Documento global (sin competidor)</option>
                      {competitors.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Asigna este documento a un competidor para agruparlo en el Context Lake.
                  </p>
                </div>
              )}

              {/* Document Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descripcion del documento <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe brevemente el contenido del documento para facilitar su busqueda y asignacion automatica..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 text-sm resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Esta descripcion ayuda al sistema a sugerir este documento automaticamente en los pasos del flujo.
                </p>
              </div>

              {/* Token Warning */}
              {extractionResult && extractionResult.tokens > 500000 && (
                <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-100 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Documento Grande</h4>
                    <p className="text-sm text-yellow-800">
                      Este documento tiene {formatTokenCount(extractionResult.tokens)} tokens.
                      Ten en cuenta el límite de 2M tokens.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={handleCancel}
                disabled={uploading}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || !extractionResult || uploading || (useCustomCategory && !customCategory.trim())}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Subir Documento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Simple text extraction for demo (will be replaced with server-side extraction)
async function extractTextPreview(file: File): Promise<string> {
  const textTypes = ['text/plain', 'text/csv', 'text/markdown', 'text/x-markdown', 'text/html', 'application/json']
  const textExtensions = ['.csv', '.md', '.markdown', '.html', '.htm', '.json', '.txt']
  const isTextFile = textTypes.includes(file.type) || textExtensions.some(ext => file.name.toLowerCase().endsWith(ext))

  if (isTextFile) {
    return await file.text()
  }

  // For PDF/DOCX, return placeholder (actual extraction will be server-side)
  return `[Demo Preview]\n\nContenido extraído del archivo: ${file.name}\n\nTipo: ${file.type}\nTamaño: ${(file.size / 1024).toFixed(2)} KB\n\nLa extracción completa se realizará en el servidor usando pdf-parse (para PDF) o mammoth (para DOCX).`
}
