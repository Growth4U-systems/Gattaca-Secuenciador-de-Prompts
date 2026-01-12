'use client'

import { FileText, Calendar, Hash, MoreVertical, Edit2, Trash2, CheckCircle, Archive, Tag } from 'lucide-react'
import { useState } from 'react'
import type { Document, ApprovalStatus } from '@/types/v2.types'
import { DOCUMENT_TYPES } from '@/types/v2.types'
import TierBadge from './TierBadge'
import AuthorityMeter from './AuthorityMeter'
import DocumentTypeAssigner from './DocumentTypeAssigner'

interface DocumentCardProps {
  document: Document
  onEdit?: (doc: Document) => void
  onDelete?: (doc: Document) => void
  onApprove?: (doc: Document) => void
  onArchive?: (doc: Document) => void
  onUpdated?: () => void
}

const statusConfig: Record<ApprovalStatus, { label: string; color: string; icon: any }> = {
  draft: { label: 'Borrador', color: 'text-amber-600 bg-amber-50', icon: Edit2 },
  approved: { label: 'Aprobado', color: 'text-green-600 bg-green-50', icon: CheckCircle },
  archived: { label: 'Archivado', color: 'text-slate-500 bg-slate-50', icon: Archive },
}

export default function DocumentCard({
  document,
  onEdit,
  onDelete,
  onApprove,
  onArchive,
  onUpdated,
}: DocumentCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showTypeAssigner, setShowTypeAssigner] = useState(false)

  // Get human-readable document type label
  const docTypeLabel = DOCUMENT_TYPES.find(dt => dt.value === document.document_type)?.label || document.document_type

  const status = statusConfig[document.approval_status]
  const StatusIcon = status.icon

  // Check if document is expiring soon (within 7 days)
  const isExpiringSoon = document.validity_end
    ? new Date(document.validity_end) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    : false

  // Check if document is expired
  const isExpired = document.validity_end
    ? new Date(document.validity_end) < new Date()
    : false

  return (
    <div className="group bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-md transition-all relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-gray-50 rounded-lg">
            <FileText className="w-5 h-5 text-gray-600" />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-gray-900 truncate">{document.title}</h3>
            <p className="text-xs text-gray-500">{docTypeLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TierBadge tier={document.tier} size="sm" />

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
                  {/* Assign Type - Always available */}
                  <button
                    onClick={() => { setShowTypeAssigner(true); setShowMenu(false) }}
                    className="w-full px-3 py-2 text-left text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                  >
                    <Tag size={14} />
                    Asignar tipo
                  </button>
                  {onEdit && (
                    <button
                      onClick={() => { onEdit(document); setShowMenu(false) }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Edit2 size={14} />
                      Editar contenido
                    </button>
                  )}
                  {onApprove && document.approval_status === 'draft' && (
                    <button
                      onClick={() => { onApprove(document); setShowMenu(false) }}
                      className="w-full px-3 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                    >
                      <CheckCircle size={14} />
                      Aprobar
                    </button>
                  )}
                  {onArchive && document.approval_status !== 'archived' && (
                    <button
                      onClick={() => { onArchive(document); setShowMenu(false) }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Archive size={14} />
                      Archivar
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => { onDelete(document); setShowMenu(false) }}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content preview */}
      {document.content && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
          {document.content.slice(0, 150)}
          {document.content.length > 150 && '...'}
        </p>
      )}

      {/* Authority Score */}
      <div className="mb-3">
        <AuthorityMeter score={document.authority_score} size="sm" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${status.color}`}>
            <StatusIcon size={12} />
            {status.label}
          </span>

          <span className="flex items-center gap-1">
            <Hash size={12} />
            {document.token_count?.toLocaleString() || 0} tokens
          </span>
        </div>

        {document.validity_end && (
          <span className={`flex items-center gap-1 ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : ''}`}>
            <Calendar size={12} />
            {isExpired ? 'Expirado' : `Expira ${new Date(document.validity_end).toLocaleDateString()}`}
          </span>
        )}
      </div>

      {/* Document Type Assigner Modal */}
      <DocumentTypeAssigner
        document={document}
        isOpen={showTypeAssigner}
        onClose={() => setShowTypeAssigner(false)}
        onUpdated={() => {
          setShowTypeAssigner(false)
          onUpdated?.()
        }}
      />
    </div>
  )
}
