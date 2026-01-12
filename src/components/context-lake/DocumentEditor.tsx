'use client'

import { useState, useEffect } from 'react'
import { X, Save, Crown, Target, Clock, AlertCircle } from 'lucide-react'
import type { Document, DocumentInsert, DocumentTier, ApprovalStatus, ContentFormat } from '@/types/v2.types'
import { TIER_CONFIG, DOCUMENT_TYPES } from '@/types/v2.types'

interface DocumentEditorProps {
  document?: Document | null
  clientId: string
  isOpen: boolean
  defaultTier?: DocumentTier
  defaultDocType?: string
  onClose: () => void
  onSave: (data: DocumentInsert) => Promise<void>
}

export default function DocumentEditor({
  document,
  clientId,
  isOpen,
  defaultTier,
  defaultDocType,
  onClose,
  onSave,
}: DocumentEditorProps) {
  const [title, setTitle] = useState('')
  const [tier, setTier] = useState<DocumentTier>(2)
  const [documentType, setDocumentType] = useState('')
  const [content, setContent] = useState('')
  const [contentFormat, setContentFormat] = useState<ContentFormat>('markdown')
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('draft')
  const [validityEnd, setValidityEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when document changes or modal opens with defaults
  useEffect(() => {
    if (document) {
      setTitle(document.title)
      setTier(document.tier)
      setDocumentType(document.document_type)
      setContent(document.content || '')
      setContentFormat(document.content_format)
      setApprovalStatus(document.approval_status)
      setValidityEnd(document.validity_end || '')
    } else {
      // Use defaults if provided, otherwise use tier 2
      const initialTier = defaultTier || 2
      const initialDocType = defaultDocType || DOCUMENT_TYPES.find((t) => t.tier === initialTier)?.value || 'market_research'

      setTitle('')
      setTier(initialTier)
      setDocumentType(initialDocType)
      setContent('')
      setContentFormat('markdown')
      setApprovalStatus('draft')
      setValidityEnd('')
    }
    setError(null)
  }, [document, isOpen, defaultTier, defaultDocType])

  // Filter document types by tier
  const availableTypes = DOCUMENT_TYPES.filter((t) => t.tier === tier)

  // Update document type when tier changes
  useEffect(() => {
    if (!availableTypes.find((t) => t.value === documentType)) {
      setDocumentType(availableTypes[0]?.value || '')
    }
  }, [tier, availableTypes, documentType])

  const handleSave = async () => {
    if (!title.trim()) {
      setError('El título es requerido')
      return
    }
    if (!documentType) {
      setError('El tipo de documento es requerido')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave({
        client_id: clientId,
        title: title.trim(),
        tier,
        document_type: documentType,
        content,
        content_format: contentFormat,
        approval_status: approvalStatus,
        validity_start: new Date().toISOString().split('T')[0],
        validity_end: validityEnd || null,
        source_type: 'manual',
        source_id: null,
        source_file_url: null,
        source_file_name: null,
        author_id: null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const TierIcon = tier === 1 ? Crown : tier === 2 ? Target : Clock
  const tierConfig = TIER_CONFIG[tier]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {document ? 'Editar Documento' : 'Nuevo Documento'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre del documento"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Tier Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tier</label>
            <div className="grid grid-cols-3 gap-3">
              {([1, 2, 3] as DocumentTier[]).map((t) => {
                const config = TIER_CONFIG[t]
                const Icon = t === 1 ? Crown : t === 2 ? Target : Clock
                const isSelected = tier === t

                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? `${config.borderClass} ${config.bgClass}`
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${isSelected ? config.textClass : 'text-gray-400'}`} />
                      <span className={`font-medium text-sm ${isSelected ? config.textClass : 'text-gray-700'}`}>
                        {config.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{config.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de Documento</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {availableTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Contenido</label>
              <select
                value={contentFormat}
                onChange={(e) => setContentFormat(e.target.value as ContentFormat)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1"
              >
                <option value="markdown">Markdown</option>
                <option value="text">Texto plano</option>
                <option value="json">JSON</option>
                <option value="html">HTML</option>
              </select>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Contenido del documento..."
              rows={8}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              ~{Math.ceil((content?.length || 0) / 4).toLocaleString()} tokens estimados
            </p>
          </div>

          {/* Validity End (for Tier 2) */}
          {tier === 2 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Fecha de Expiración (opcional)
              </label>
              <input
                type="date"
                value={validityEnd}
                onChange={(e) => setValidityEnd(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Los documentos Tier 2 pueden tener una fecha de expiración
              </p>
            </div>
          )}

          {/* Approval Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
            <select
              value={approvalStatus}
              onChange={(e) => setApprovalStatus(e.target.value as ApprovalStatus)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="draft">Borrador</option>
              <option value="approved">Aprobado</option>
              <option value="archived">Archivado</option>
            </select>
            {tier === 1 && approvalStatus !== 'approved' && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                Los documentos Tier 1 deben ser aprobados para usarse en playbooks
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
