'use client'

import { useState, useRef } from 'react'
import { FolderUp, X, FileText, AlertCircle, Loader2, Check, Upload, Save } from 'lucide-react'
import { DocCategory } from '@/types/database.types'
import { formatTokenCount } from '@/lib/supabase'

interface DocumentUploadProps {
  projectId: string
  onUploadComplete: () => void
}

interface ExtractedFile {
  filename: string
  success: boolean
  extractedContent?: string
  tokenCount?: number
  fileSize: number
  mimeType: string
  error?: string
  category?: DocCategory
}

const CATEGORIES = [
  { value: 'product', label: 'Producto', icon: '📦' },
  { value: 'competitor', label: 'Competidor', icon: '🎯' },
  { value: 'research', label: 'Research', icon: '🔬' },
  { value: 'output', label: 'Output', icon: '📝' },
]

export default function DocumentBulkUpload({
  projectId,
  onUploadComplete,
}: DocumentUploadProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

    if (e.dataTransfer.files) {
      handleFilesProcess(Array.from(e.dataTransfer.files))
    }
  }

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    handleFilesProcess(files)
  }

  const handleFilesProcess = async (files: File[]) => {
    setExtracting(true)
    try {
      console.log(`Uploading ${files.length} files to Blob Storage...`)

      // Step 1: Upload all files to Blob Storage using client upload
      const { upload } = await import('@vercel/blob/client')

      const uploadPromises = files.map(async (file) => {
        try {
          console.log(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) to Blob...`)

          const blob = await upload(file.name, file, {
            access: 'public',
            handleUploadUrl: '/api/documents/upload-url',
          })

          console.log(`Uploaded ${file.name} to Blob: ${blob.url}`)

          return {
            blobUrl: blob.url,
            filename: file.name,
            fileSize: file.size,
            mimeType: file.type,
          }
        } catch (error) {
          console.error(`Failed to upload ${file.name} to Blob:`, error)
          throw error
        }
      })

      const blobFiles = await Promise.all(uploadPromises)
      console.log(`All files uploaded to Blob. Now extracting content...`)

      // Step 2: Tell backend to download from Blob and extract content
      const response = await fetch('/api/documents/extract-from-blob', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blobFiles,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Extraction failed')
      }

      const result = await response.json()
      console.log(`Extraction complete:`, result.summary)

      // Set default category based on filename or first successful extraction
      const filesWithDefaults = result.files.map((file: ExtractedFile) => ({
        ...file,
        category: file.success ? ('product' as DocCategory) : undefined,
      }))

      setExtractedFiles(prev => [...prev, ...filesWithDefaults])

      if (result.summary.failed > 0) {
        alert(
          `${result.summary.failed} de ${result.summary.total} archivos fallaron en la extracción.`
        )
      }
    } catch (error) {
      console.error('Error extracting files:', error)
      alert(
        `Error al procesar archivos: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setExtracting(false)
    }
  }

  const updateCategory = (index: number, category: DocCategory) => {
    setExtractedFiles((prev) =>
      prev.map((file, i) => (i === index ? { ...file, category } : file))
    )
  }

  const removeFile = (index: number) => {
    setExtractedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSaveAll = async () => {
    // Validate all successful files have categories
    const successfulFiles = extractedFiles.filter((f) => f.success)
    const missingCategory = successfulFiles.find((f) => !f.category)

    if (missingCategory) {
      alert(`Por favor asigna una categoría a: ${missingCategory.filename}`)
      return
    }

    if (successfulFiles.length === 0) {
      alert('No hay archivos válidos para guardar')
      return
    }

    setSaving(true)
    try {
      const documentsToSave = successfulFiles.map((file) => ({
        filename: file.filename,
        category: file.category!,
        extractedContent: file.extractedContent!,
        tokenCount: file.tokenCount!,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
      }))

      const response = await fetch('/api/documents/bulk-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          documents: documentsToSave,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Save failed')
      }

      const result = await response.json()
      alert(`${result.count} documentos guardados exitosamente`)

      // Close modal and reset
      handleClose()
      onUploadComplete()
    } catch (error) {
      console.error('Error saving files:', error)
      alert(
        `Error al guardar documentos: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setExtractedFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const totalTokens = extractedFiles
    .filter((f) => f.success)
    .reduce((sum, f) => sum + (f.tokenCount || 0), 0)

  const successCount = extractedFiles.filter((f) => f.success).length
  const readyToSave = extractedFiles.filter((f) => f.success && f.category).length

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
      >
        <FolderUp size={18} />
        Subida Masiva
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 backdrop-blur rounded-xl">
                    <FolderUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Subida Masiva</h2>
                    <p className="text-sm text-blue-100">Sube varios documentos a la vez</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Drop Zone */}
              <div
                className={`
                  border-2 border-dashed rounded-2xl p-6 text-center transition-all
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
                  accept=".pdf,.doc,.docx,.txt"
                  multiple
                  onChange={handleFilesSelect}
                  className="hidden"
                  disabled={extracting}
                />

                <div className="flex flex-col items-center">
                  <div className={`p-3 rounded-xl mb-3 ${dragActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <Upload className={`w-6 h-6 ${dragActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  </div>
                  <p className="text-gray-700 font-medium mb-1">
                    {dragActive ? 'Suelta los archivos' : 'Arrastra archivos aquí'}
                  </p>
                  <p className="text-gray-500 text-sm mb-3">
                    o haz click para seleccionar múltiples archivos
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={extracting}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
                  >
                    Seleccionar archivos
                  </button>
                </div>
              </div>

              {/* Extracting State */}
              {extracting && (
                <div className="text-center py-8">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Extrayendo contenido...</p>
                  <p className="text-gray-500 text-sm mt-1">Esto puede tomar unos segundos</p>
                </div>
              )}

              {/* File List */}
              {extractedFiles.length > 0 && !extracting && (
                <>
                  {/* Summary */}
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Check className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-blue-900">
                          {successCount} de {extractedFiles.length} archivos extraídos
                        </h3>
                        <p className="text-sm text-blue-800 mt-1">
                          Total: {formatTokenCount(totalTokens)} tokens • {readyToSave}/{successCount} categorizados
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Files */}
                  <div className="space-y-3">
                    {extractedFiles.map((file, index) => (
                      <div
                        key={index}
                        className={`
                          rounded-2xl p-4 border-2 transition-all
                          ${file.success
                            ? 'border-gray-100 bg-white'
                            : 'border-red-100 bg-red-50'
                          }
                        `}
                      >
                        {/* File Header */}
                        <div className="flex items-start gap-3 mb-3">
                          {file.success ? (
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                          ) : (
                            <div className="p-2 bg-red-100 rounded-lg">
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">
                              {file.filename}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {(file.fileSize / 1024).toFixed(2)} KB
                              {file.tokenCount && ` • ${formatTokenCount(file.tokenCount)} tokens`}
                            </p>
                            {file.error && (
                              <p className="text-sm text-red-600 mt-1">{file.error}</p>
                            )}
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {/* Category Selection */}
                        {file.success && (
                          <>
                            <div className="grid grid-cols-4 gap-2 mb-3">
                              {CATEGORIES.map((cat) => (
                                <button
                                  key={cat.value}
                                  onClick={() => updateCategory(index, cat.value as DocCategory)}
                                  className={`
                                    flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all
                                    ${file.category === cat.value
                                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                                      : 'bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100'
                                    }
                                  `}
                                >
                                  <span>{cat.icon}</span>
                                  <span className="hidden sm:inline">{cat.label}</span>
                                </button>
                              ))}
                            </div>

                            {/* Content Preview */}
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-24 overflow-y-auto">
                              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                                {file.extractedContent?.slice(0, 300)}
                                {(file.extractedContent?.length || 0) > 300 && '...'}
                              </pre>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Token Warning */}
                  {totalTokens > 500000 && (
                    <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-100 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-900">Documentos Grandes</h4>
                        <p className="text-sm text-yellow-800">
                          Total: {formatTokenCount(totalTokens)} tokens. Ten en cuenta el límite de 2M tokens.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex-shrink-0 flex gap-3">
              <button
                onClick={handleClose}
                disabled={saving || extracting}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                {successCount > 0 ? 'Cerrar' : 'Cancelar'}
              </button>
              {readyToSave > 0 && (
                <button
                  onClick={handleSaveAll}
                  disabled={saving || extracting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Guardar {readyToSave} archivo{readyToSave !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
