'use client'

import { useState, useRef } from 'react'
import { Upload, File, AlertCircle, CheckCircle, X, Save } from 'lucide-react'
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
  // Added by user after extraction
  category?: DocCategory
}

export default function DocumentBulkUpload({
  projectId,
  onUploadComplete,
}: DocumentUploadProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setExtracting(true)
    try {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch('/api/documents/extract', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Extraction failed')
      }

      const result = await response.json()

      // Set default category based on filename or first successful extraction
      const filesWithDefaults = result.files.map((file: ExtractedFile) => ({
        ...file,
        category: file.success ? ('product' as DocCategory) : undefined,
      }))

      setExtractedFiles(filesWithDefaults)

      if (result.summary.failed > 0) {
        alert(
          `⚠️ ${result.summary.failed} de ${result.summary.total} archivos fallaron en la extracción. Revisa los errores abajo.`
        )
      }
    } catch (error) {
      console.error('Error extracting files:', error)
      alert(
        `❌ Error al procesar archivos: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      setExtractedFiles([])
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
      alert(
        `⚠️ Por favor asigna una categoría a: ${missingCategory.filename}`
      )
      return
    }

    if (successfulFiles.length === 0) {
      alert('⚠️ No hay archivos válidos para guardar')
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
      alert(`✅ ${result.count} documentos guardados exitosamente`)

      // Close modal and reset
      setIsOpen(false)
      setExtractedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      onUploadComplete()
    } catch (error) {
      console.error('Error saving files:', error)
      alert(
        `❌ Error al guardar documentos: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const totalTokens = extractedFiles
    .filter((f) => f.success)
    .reduce((sum, f) => sum + (f.tokenCount || 0), 0)

  const successCount = extractedFiles.filter((f) => f.success).length
  const readyToSave = extractedFiles.filter((f) => f.success && f.category).length

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-2"
      >
        <Upload size={18} />
        Subir Múltiples Documentos
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Subir Múltiples Documentos</h2>
          <p className="text-sm text-gray-600 mt-1">
            Selecciona archivos, revisa el contenido extraído y asigna categorías antes de guardar
          </p>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* File Upload */}
          {extractedFiles.length === 0 && (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
              >
                <Upload size={40} className="mx-auto mb-3 text-gray-400" />
                <p className="text-gray-600">
                  Click para seleccionar múltiples archivos
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  PDF, DOCX o TXT (max 50MB cada uno)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                multiple
                onChange={handleFilesSelect}
                className="hidden"
                disabled={extracting}
              />
            </div>
          )}

          {/* Extracting State */}
          {extracting && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
              <p className="text-gray-600">Extrayendo contenido de archivos...</p>
            </div>
          )}

          {/* Extracted Files List */}
          {extractedFiles.length > 0 && !extracting && (
            <>
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-blue-900">
                      {successCount} de {extractedFiles.length} archivos extraídos exitosamente
                    </h3>
                    <p className="text-sm text-blue-800 mt-1">
                      Total: {formatTokenCount(totalTokens)} tokens • {readyToSave}/{successCount} categorizados
                    </p>
                  </div>
                </div>
              </div>

              {/* Files */}
              <div className="space-y-4">
                {extractedFiles.map((file, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${
                      file.success
                        ? 'border-gray-300 bg-white'
                        : 'border-red-300 bg-red-50'
                    }`}
                  >
                    {/* File Header */}
                    <div className="flex items-start gap-3 mb-3">
                      {file.success ? (
                        <File size={20} className="text-blue-600 mt-0.5" />
                      ) : (
                        <AlertCircle size={20} className="text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {file.filename}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {(file.fileSize / 1024).toFixed(2)} KB
                          {file.tokenCount && ` • ${formatTokenCount(file.tokenCount)} tokens`}
                        </p>
                        {file.error && (
                          <p className="text-sm text-red-600 mt-1">
                            ❌ {file.error}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Category Selection (only for successful extractions) */}
                    {file.success && (
                      <>
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Categoría *
                          </label>
                          <select
                            value={file.category || ''}
                            onChange={(e) =>
                              updateCategory(index, e.target.value as DocCategory)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                            <option value="">-- Seleccionar categoría --</option>
                            <option value="product">📦 Producto</option>
                            <option value="competitor">🎯 Competidor</option>
                            <option value="research">🔬 Research</option>
                            <option value="output">📝 Output</option>
                          </select>
                        </div>

                        {/* Content Preview */}
                        <div className="bg-gray-50 border border-gray-200 rounded p-3 max-h-32 overflow-y-auto">
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

              {/* Add More Files Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                + Agregar más archivos
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                multiple
                onChange={handleFilesSelect}
                className="hidden"
                disabled={extracting}
              />
            </>
          )}

          {/* Token Warning */}
          {totalTokens > 500000 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900">
                  Documentos Grandes
                </h4>
                <p className="text-sm text-yellow-800">
                  Total: {formatTokenCount(totalTokens)} tokens. Ten en cuenta el
                  límite de 2M tokens al usar estos documentos.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={handleSaveAll}
            disabled={readyToSave === 0 || saving || extracting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            <Save size={18} />
            {saving
              ? 'Guardando...'
              : `Guardar ${readyToSave} documento${readyToSave !== 1 ? 's' : ''}`}
          </button>
          <button
            onClick={() => {
              setIsOpen(false)
              setExtractedFiles([])
              if (fileInputRef.current) {
                fileInputRef.current.value = ''
              }
            }}
            disabled={saving || extracting}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
