'use client'

import { useEffect } from 'react'
import { X, Clock, CheckCircle, FileText, RotateCcw, Loader2 } from 'lucide-react'
import { useDocumentVersions } from '@/hooks/useTransformers'
import type { DocumentVersion, ApprovalStatus } from '@/types/v2.types'

interface DocumentVersionHistoryProps {
  documentId: string
  isOpen: boolean
  onClose: () => void
  onVersionSelect?: (version: DocumentVersion) => void
}

const STATUS_STYLES: Record<ApprovalStatus, { bg: string; text: string; icon: typeof CheckCircle }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-600', icon: FileText },
  approved: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  archived: { bg: 'bg-gray-100', text: 'text-gray-500', icon: Clock },
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function DocumentVersionHistory({
  documentId,
  isOpen,
  onClose,
  onVersionSelect,
}: DocumentVersionHistoryProps) {
  const { versions, isLoading, error, fetchVersions, rollback } = useDocumentVersions(documentId)

  useEffect(() => {
    if (isOpen && documentId) {
      fetchVersions()
    }
  }, [isOpen, documentId, fetchVersions])

  if (!isOpen) return null

  const handleRollback = async (version: DocumentVersion) => {
    if (version.is_current) return

    try {
      await rollback(version.id)
    } catch (err) {
      console.error('Rollback failed:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Historial de Versiones
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-slate-600">Cargando versiones...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Error: {error}
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No hay versiones anteriores
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => {
                const statusStyle = STATUS_STYLES[version.approval_status]
                const StatusIcon = statusStyle.icon

                return (
                  <div
                    key={version.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      version.is_current
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">
                            Versión {version.version}
                          </span>
                          {version.is_current && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                              Actual
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded ${statusStyle.bg} ${statusStyle.text}`}>
                            <StatusIcon className="h-3 w-3" />
                            {version.approval_status === 'draft' && 'Borrador'}
                            {version.approval_status === 'approved' && 'Aprobado'}
                            {version.approval_status === 'archived' && 'Archivado'}
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatDate(version.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {onVersionSelect && (
                          <button
                            onClick={() => onVersionSelect(version)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                            title="Ver versión"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        )}
                        {!version.is_current && (
                          <button
                            onClick={() => handleRollback(version)}
                            className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            title="Restaurar esta versión"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500 text-center">
            Restaurar una versión crea una nueva copia que deberás aprobar
          </p>
        </div>
      </div>
    </div>
  )
}
