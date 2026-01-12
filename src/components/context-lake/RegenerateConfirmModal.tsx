'use client'

import { useState } from 'react'
import { X, RefreshCw, AlertTriangle, FileText, Loader2 } from 'lucide-react'
import type { FoundationalType, Document } from '@/types/v2.types'

interface RegenerateConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  foundationalType: FoundationalType
  sourceDocuments: Array<{ id: string; title: string }>
  existingDocument?: Document | null
  isRegenerating?: boolean
}

const FOUNDATIONAL_LABELS: Record<FoundationalType, string> = {
  brand_dna: 'Brand DNA',
  icp: 'ICP / Buyer Persona',
  tone_of_voice: 'Tone of Voice',
  product_docs: 'Documentación de Producto',
  pricing: 'Estrategia de Precios',
  competitor_analysis: 'Análisis de Competencia',
}

export default function RegenerateConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  foundationalType,
  sourceDocuments,
  existingDocument,
  isRegenerating = false,
}: RegenerateConfirmModalProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Error regenerating:', error)
    } finally {
      setIsConfirming(false)
    }
  }

  const isLoading = isConfirming || isRegenerating

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <RefreshCw className="h-5 w-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              {existingDocument ? 'Regenerar' : 'Generar'} {FOUNDATIONAL_LABELS[foundationalType]}
            </h2>
          </div>
          {!isLoading && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {existingDocument && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Se creará una nueva versión</p>
                <p className="text-amber-700 mt-1">
                  La versión actual se guardará en el historial. Deberás revisar y aprobar el nuevo documento antes de usarlo en playbooks.
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Documentos fuente ({sourceDocuments.length}):
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {sourceDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg"
                >
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-700 truncate">{doc.title}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              El sistema analizará los documentos fuente y generará un documento de{' '}
              <strong>{FOUNDATIONAL_LABELS[foundationalType]}</strong> unificado.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || sourceDocuments.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                {existingDocument ? 'Regenerar' : 'Generar'} Documento
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
