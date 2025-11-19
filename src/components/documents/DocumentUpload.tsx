'use client'

import { useState, useRef } from 'react'
import { Upload, File, AlertCircle, CheckCircle } from 'lucide-react'
import { DocCategory } from '@/types/database.types'
import { formatTokenCount } from '@/lib/supabase'

interface DocumentUploadProps {
  projectId: string
  onUploadComplete: () => void
}

export default function DocumentUpload({
  projectId,
  onUploadComplete,
}: DocumentUploadProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [category, setCategory] = useState<DocCategory>('product')
  const [extractionResult, setExtractionResult] = useState<{
    text: string
    tokens: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ]

    if (!validTypes.includes(file.type)) {
      alert('Tipo de archivo no soportado. Usa PDF, DOCX o TXT.')
      return
    }

    setSelectedFile(file)

    // Extract content preview (this will be done server-side in production)
    try {
      const text = await extractTextPreview(file)
      const tokens = Math.ceil(text.length / 4)
      setExtractionResult({ text, tokens })
    } catch (error) {
      console.error('Error extracting text:', error)
      alert('Error al extraer texto del archivo')
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !extractionResult) return

    setUploading(true)
    try {
      // Check if file is large and needs Blob
      const USE_BLOB = process.env.NEXT_PUBLIC_USE_BLOB === 'true' || selectedFile.size > 4 * 1024 * 1024

      if (USE_BLOB) {
        // Upload large files directly to Blob from client
        console.log('Using Blob upload for large file:', selectedFile.size)

        // Step 1: Upload directly to Blob (client-side)
        const { put } = await import('@vercel/blob')
        const blob = await put(selectedFile.name, selectedFile, {
          access: 'public',
          addRandomSuffix: true,
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
            projectId: projectId,
            category: category,
            fileSize: selectedFile.size,
            mimeType: selectedFile.type,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to process blob')
        }

        const result = await response.json()
        console.log('Processing successful:', result)

        alert(`✅ Documento "${selectedFile.name}" subido exitosamente (via Blob)`)
      } else {
        // Upload small files normally
        console.log('Using direct upload for small file:', selectedFile.size)

        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('projectId', projectId)
        formData.append('category', category)

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          let errorData
          try {
            errorData = await response.json()
          } catch (e) {
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

        alert(`✅ Documento "${selectedFile.name}" subido exitosamente`)
      }

      setIsOpen(false)
      setSelectedFile(null)
      setExtractionResult(null)
      onUploadComplete()
    } catch (error) {
      console.error('Error uploading:', error)
      alert(`❌ Error al subir el documento: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
      >
        <Upload size={18} />
        Subir Documento
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Subir Documento</h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoría *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="product">Producto</option>
              <option value="competitor">Competidor</option>
              <option value="research">Research</option>
              <option value="output">Output (de pasos anteriores)</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              {category === 'product' &&
                '📦 Información sobre tu producto o servicio'}
              {category === 'competitor' &&
                '🎯 Análisis de competencia y mercado'}
              {category === 'research' &&
                '🔬 Investigación de mercado y audiencia'}
              {category === 'output' &&
                '📝 Resultados guardados de pasos anteriores'}
            </p>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Archivo *
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            >
              {!selectedFile ? (
                <>
                  <Upload size={40} className="mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-600">
                    Click para seleccionar archivo
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    PDF, DOCX o TXT (archivos grandes usan Blob Storage)
                  </p>
                </>
              ) : (
                <>
                  <File size={40} className="mx-auto mb-3 text-blue-600" />
                  <p className="font-medium text-gray-900">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Extraction Preview */}
          {extractionResult && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <CheckCircle size={20} className="text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">
                    Contenido Extraído
                  </h3>
                  <p className="text-sm text-gray-600">
                    {formatTokenCount(extractionResult.tokens)} tokens
                    estimados (~{extractionResult.text.length.toLocaleString()}{' '}
                    caracteres)
                  </p>
                </div>
              </div>
              <div className="bg-white border border-gray-300 rounded p-3 max-h-40 overflow-y-auto">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                  {extractionResult.text.slice(0, 500)}
                  {extractionResult.text.length > 500 && '...'}
                </pre>
              </div>
            </div>
          )}

          {/* Token Warning */}
          {extractionResult && extractionResult.tokens > 500000 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900">
                  Documento Grande
                </h4>
                <p className="text-sm text-yellow-800">
                  Este documento tiene {formatTokenCount(extractionResult.tokens)}{' '}
                  tokens. Ten en cuenta el límite de 2M tokens al combinar
                  múltiples documentos.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {uploading ? 'Subiendo...' : 'Subir Documento'}
          </button>
          <button
            onClick={() => {
              setIsOpen(false)
              setSelectedFile(null)
              setExtractionResult(null)
            }}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// Simple text extraction for demo (will be replaced with server-side extraction)
async function extractTextPreview(file: File): Promise<string> {
  if (file.type === 'text/plain') {
    return await file.text()
  }

  // For PDF/DOCX, return placeholder (actual extraction will be server-side)
  return `[Demo Preview]\n\nContenido extraído del archivo: ${file.name}\n\nTipo: ${file.type}\nTamaño: ${(file.size / 1024).toFixed(2)} KB\n\nLa extracción completa se realizará en el servidor usando pdf-parse (para PDF) o mammoth (para DOCX).`
}
