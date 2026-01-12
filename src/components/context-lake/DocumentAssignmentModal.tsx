'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, FileText, Search, Check, Crown, Target, Clock, Loader2 } from 'lucide-react'
import type { Document, DocumentAssignment, FoundationalType } from '@/types/v2.types'
import { TIER_CONFIG, FOUNDATIONAL_TYPE_CONFIG } from '@/types/v2.types'

interface DocumentAssignmentModalProps {
  isOpen: boolean
  foundationalType: FoundationalType
  clientId: string
  existingAssignments: DocumentAssignment[]
  onClose: () => void
  onAssign: (documentIds: string[]) => Promise<void>
}

export default function DocumentAssignmentModal({
  isOpen,
  foundationalType,
  clientId,
  existingAssignments,
  onClose,
  onAssign,
}: DocumentAssignmentModalProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [assigning, setAssigning] = useState(false)

  const typeConfig = FOUNDATIONAL_TYPE_CONFIG[foundationalType]

  // Load available documents
  useEffect(() => {
    if (!isOpen) return

    const load = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/v2/documents?clientId=${clientId}`)
        if (!response.ok) throw new Error('Failed to load documents')

        const data = await response.json()
        const allDocs: Document[] = data.documents || []

        // Filter out already assigned and archived
        const assignedIds = new Set(existingAssignments.map(a => a.source_document_id))
        const available = allDocs.filter(d =>
          !assignedIds.has(d.id) &&
          d.approval_status !== 'archived'
        )

        setDocuments(available)
      } catch (err) {
        console.error('Error loading documents:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [isOpen, clientId, existingAssignments])

  // Reset selection when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set())
      setSearch('')
    }
  }, [isOpen])

  // Filtered documents
  const filteredDocs = useMemo(() => {
    if (!search.trim()) return documents

    const searchLower = search.toLowerCase()
    return documents.filter(d =>
      d.title.toLowerCase().includes(searchLower) ||
      d.document_type?.toLowerCase().includes(searchLower)
    )
  }, [documents, search])

  // Group by tier
  const docsByTier = useMemo(() => {
    const grouped: Record<1 | 2 | 3, Document[]> = { 1: [], 2: [], 3: [] }
    filteredDocs.forEach(doc => {
      grouped[doc.tier].push(doc)
    })
    return grouped
  }, [filteredDocs])

  const toggleDocument = (docId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(docId)) {
      newSelected.delete(docId)
    } else {
      newSelected.add(docId)
    }
    setSelectedIds(newSelected)
  }

  const handleAssign = async () => {
    if (selectedIds.size === 0) return

    setAssigning(true)
    try {
      await onAssign(Array.from(selectedIds))
      onClose()
    } catch (err) {
      console.error('Error assigning documents:', err)
    } finally {
      setAssigning(false)
    }
  }

  if (!isOpen) return null

  const TierIcon = { 1: Crown, 2: Target, 3: Clock }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Asignar documentos a {typeConfig.label}
            </h2>
            <p className="text-sm text-blue-100 mt-0.5">
              Selecciona los documentos que contienen información sobre {typeConfig.label.toLowerCase()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar documentos..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No hay documentos disponibles</p>
              <p className="text-sm mt-1">
                {documents.length === 0
                  ? 'Sube documentos al Context Lake primero'
                  : 'No se encontraron resultados para tu búsqueda'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {([1, 2, 3] as const).map(tier => {
                const tierDocs = docsByTier[tier]
                if (tierDocs.length === 0) return null

                const config = TIER_CONFIG[tier]
                const Icon = TierIcon[tier]

                return (
                  <div key={tier}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`w-4 h-4 ${config.textClass}`} />
                      <span className={`text-sm font-medium ${config.textClass}`}>
                        {config.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({tierDocs.length})
                      </span>
                    </div>

                    <div className="space-y-2">
                      {tierDocs.map(doc => {
                        const isSelected = selectedIds.has(doc.id)

                        return (
                          <button
                            key={doc.id}
                            onClick={() => toggleDocument(doc.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-100 hover:border-gray-200 bg-white'
                            }`}
                          >
                            <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300'
                            }`}>
                              {isSelected && <Check size={12} className="text-white" />}
                            </div>

                            <FileText className={`w-5 h-5 ${
                              isSelected ? 'text-blue-500' : 'text-gray-400'
                            }`} />

                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${
                                isSelected ? 'text-blue-900' : 'text-gray-900'
                              }`}>
                                {doc.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {doc.document_type?.replace(/_/g, ' ')}
                                {' · '}
                                {doc.token_count?.toLocaleString() || 0} tokens
                              </p>
                            </div>

                            <span className={`text-xs px-2 py-0.5 rounded ${
                              doc.approval_status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {doc.approval_status === 'approved' ? 'Aprobado' : 'Borrador'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {selectedIds.size} documento{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={assigning}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleAssign}
              disabled={selectedIds.size === 0 || assigning}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {assigning ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Asignando...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Asignar {selectedIds.size > 0 && `(${selectedIds.size})`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
