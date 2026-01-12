'use client'

import { useState } from 'react'
import {
  Crown,
  Target,
  MessageSquare,
  Package,
  DollarSign,
  Users,
  FileText,
  X,
  Sparkles,
  RefreshCw,
  Eye,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  Upload,
  Link,
  GripVertical,
  Loader2,
  History,
  Edit3,
} from 'lucide-react'
import type {
  FoundationalSlot,
  FoundationalType,
  DocumentAssignment,
  Document,
} from '@/types/v2.types'
import { getCompletenessLevel } from '@/types/v2.types'
import RegenerateConfirmModal from './RegenerateConfirmModal'
import DocumentVersionHistory from './DocumentVersionHistory'

// Icon mapping
const ICONS: Record<string, React.ElementType> = {
  Dna: Crown, // Using Crown as DNA substitute
  Users,
  MessageSquare,
  Package,
  DollarSign,
  Target,
}

interface FoundationalSlotCardProps {
  slot: FoundationalSlot
  clientId: string
  onAssignFromContextLake: (type: FoundationalType) => void
  onUploadDocument: (type: FoundationalType) => void
  onConnectDrive: (type: FoundationalType) => void
  onPasteUrl: (type: FoundationalType) => void
  onGenerateWithAI: (type: FoundationalType) => void
  onRemoveAssignment: (assignmentId: string) => void
  onSynthesize: (type: FoundationalType, force?: boolean) => Promise<void>
  onViewDocument: (document: Document) => void
  onEditDocument: (document: Document) => void
  onApproveDocument: (documentId: string) => Promise<void>
  onRollback: (documentId: string, targetVersionId: string) => Promise<void>
  synthesizing?: boolean
}

export default function FoundationalSlotCard({
  slot,
  clientId,
  onAssignFromContextLake,
  onUploadDocument,
  onConnectDrive,
  onPasteUrl,
  onGenerateWithAI,
  onRemoveAssignment,
  onSynthesize,
  onViewDocument,
  onEditDocument,
  onApproveDocument,
  onRollback,
  synthesizing = false,
}: FoundationalSlotCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [showRegenerateModal, setShowRegenerateModal] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)

  const hasAssignments = slot.assignments.length > 0
  const hasSynthesizedDoc = slot.synthesizedDocument !== null
  const needsReview = slot.synthesizedDocument?.requires_review
  const isApproved = slot.synthesizedDocument?.approval_status === 'approved'

  // Determine icon
  const iconKey = slot.type === 'brand_dna' ? 'Dna'
    : slot.type === 'icp' ? 'Users'
    : slot.type === 'tone_of_voice' ? 'MessageSquare'
    : slot.type === 'product_docs' ? 'Package'
    : slot.type === 'pricing' ? 'DollarSign'
    : 'Target'
  const Icon = ICONS[iconKey] || FileText

  // Priority colors
  const priorityColors = {
    critical: 'border-red-200 bg-red-50',
    important: 'border-amber-200 bg-amber-50',
    recommended: 'border-blue-200 bg-blue-50',
  }

  const priorityBadgeColors = {
    critical: 'bg-red-100 text-red-700',
    important: 'bg-amber-100 text-amber-700',
    recommended: 'bg-blue-100 text-blue-700',
  }

  // Status badge
  const getStatusBadge = () => {
    if (slot.hasPendingSynthesis || synthesizing) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
          <Loader2 className="w-3 h-3 animate-spin" />
          Sintetizando...
        </span>
      )
    }
    if (isApproved) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
          <Check className="w-3 h-3" />
          Aprobado
        </span>
      )
    }
    if (needsReview && hasSynthesizedDoc) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
          <AlertTriangle className="w-3 h-3" />
          Requiere revisión
        </span>
      )
    }
    if (slot.needsResynthesis && hasAssignments) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
          <RefreshCw className="w-3 h-3" />
          Cambios pendientes
        </span>
      )
    }
    if (!hasAssignments) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
          Sin documentos
        </span>
      )
    }
    return null
  }

  // Completeness indicator
  const completeness = slot.completenessScore
  const completenessLevel = completeness !== null ? getCompletenessLevel(completeness) : null

  return (
    <div className={`rounded-xl border-2 transition-all ${
      isApproved ? 'border-green-200 bg-green-50/30' :
      hasAssignments ? 'border-gray-200 bg-white' :
      priorityColors[slot.priority]
    }`}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
              isApproved ? 'bg-green-100' :
              hasAssignments ? 'bg-gray-100' :
              'bg-white/60'
            }`}>
              <Icon className={`w-5 h-5 ${
                isApproved ? 'text-green-600' :
                hasAssignments ? 'text-gray-600' :
                'text-gray-400'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{slot.label}</h3>
                <span className={`text-xs px-1.5 py-0.5 rounded ${priorityBadgeColors[slot.priority]}`}>
                  Tier {slot.tier}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {slot.assignments.length} documento{slot.assignments.length !== 1 ? 's' : ''} fuente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {/* Completeness bar */}
        {completeness !== null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500">Completitud</span>
              <span className={`font-medium text-${completenessLevel?.color}-600`}>
                {completeness}% - {completenessLevel?.label}
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full bg-${completenessLevel?.color}-500 transition-all`}
                style={{ width: `${completeness}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {/* Source Documents Section */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Documentos Fuente
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowActions(!showActions)
                }}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Plus size={14} />
                Agregar
              </button>
            </div>

            {/* Actions Menu */}
            {showActions && (
              <div className="mb-3 p-3 bg-gray-50 rounded-lg space-y-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAssignFromContextLake(slot.type)
                    setShowActions(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white rounded-lg transition-colors"
                >
                  <FileText size={16} className="text-blue-500" />
                  <span>Asignar de Context Lake</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onUploadDocument(slot.type)
                    setShowActions(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white rounded-lg transition-colors"
                >
                  <Upload size={16} className="text-green-500" />
                  <span>Subir archivo</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onConnectDrive(slot.type)
                    setShowActions(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.71 3.5L1.15 15l2.85 5h15L22.85 15 16.29 3.5H7.71zm5.79 3.5l4.07 7H6.43l4.07-7h3z"/>
                  </svg>
                  <span>Conectar Google Drive</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onPasteUrl(slot.type)
                    setShowActions(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white rounded-lg transition-colors"
                >
                  <Link size={16} className="text-purple-500" />
                  <span>Pegar URL</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onGenerateWithAI(slot.type)
                    setShowActions(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white rounded-lg transition-colors"
                >
                  <Sparkles size={16} className="text-indigo-500" />
                  <span>Generar con IA</span>
                </button>
              </div>
            )}

            {/* Assigned Documents List */}
            {hasAssignments ? (
              <div className="space-y-2">
                {slot.assignments.map((assignment) => (
                  <AssignedDocumentRow
                    key={assignment.id}
                    assignment={assignment}
                    onRemove={() => onRemoveAssignment(assignment.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay documentos asignados</p>
                <p className="text-xs mt-1">Agrega documentos para crear {slot.label}</p>
              </div>
            )}
          </div>

          {/* Divider */}
          {(hasAssignments || hasSynthesizedDoc) && (
            <div className="my-4 border-t border-gray-200" />
          )}

          {/* Synthesized Document Section */}
          {hasAssignments && (
            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Documento Sintetizado
              </span>

              {hasSynthesizedDoc ? (
                <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {slot.synthesizedDocument?.title}
                        </p>
                        {slot.synthesizedDocument?.version && slot.synthesizedDocument.version > 1 && (
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            v{slot.synthesizedDocument.version}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {slot.synthesizedDocument?.token_count?.toLocaleString() || 0} tokens
                        {slot.lastSynthesis?.completed_at && (
                          <> · Última síntesis: {new Date(slot.lastSynthesis.completed_at).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (slot.synthesizedDocument) {
                            onViewDocument(slot.synthesizedDocument)
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        title="Ver documento"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (slot.synthesizedDocument) {
                            onEditDocument(slot.synthesizedDocument)
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-amber-600 rounded"
                        title="Editar documento"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowVersionHistory(true)
                        }}
                        className="p-1.5 text-gray-400 hover:text-purple-600 rounded"
                        title="Ver historial de versiones"
                      >
                        <History size={16} />
                      </button>
                      {needsReview && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (slot.synthesizedDocument) {
                              onApproveDocument(slot.synthesizedDocument.id)
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-green-600 rounded"
                          title="Aprobar documento"
                        >
                          <Check size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stale warning */}
                  {slot.synthesizedDocument?.is_stale && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <p className="text-xs text-amber-700">
                        Los documentos fuente han cambiado desde la última síntesis. Considera regenerar.
                      </p>
                    </div>
                  )}

                  {/* Resynthesis button */}
                  {(slot.needsResynthesis || slot.synthesizedDocument?.is_stale) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowRegenerateModal(true)
                      }}
                      disabled={synthesizing}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                    >
                      {synthesizing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                      <span className="text-sm font-medium">Regenerar documento</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowRegenerateModal(true)
                  }}
                  disabled={synthesizing || !hasAssignments}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50"
                >
                  {synthesizing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="font-medium">Generando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      <span className="font-medium">Generar {slot.label}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Regenerate Confirmation Modal */}
      <RegenerateConfirmModal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        onConfirm={async () => {
          await onSynthesize(slot.type, true)
          setShowRegenerateModal(false)
        }}
        foundationalType={slot.type}
        sourceDocuments={slot.assignments.map(a => ({
          id: a.source_document_id,
          title: a.source_document?.title || 'Sin título',
        }))}
        existingDocument={slot.synthesizedDocument}
        isRegenerating={synthesizing}
      />

      {/* Version History Modal */}
      {slot.synthesizedDocument && (
        <DocumentVersionHistory
          isOpen={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          documentId={slot.synthesizedDocument.id}
          onVersionSelect={(version) => {
            // Rollback to selected version
            onRollback(slot.synthesizedDocument!.id, version.id)
            setShowVersionHistory(false)
          }}
        />
      )}
    </div>
  )
}

// Sub-component for assigned document row
function AssignedDocumentRow({
  assignment,
  onRemove,
}: {
  assignment: DocumentAssignment
  onRemove: () => void
}) {
  const doc = assignment.source_document

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group">
      <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
      <FileText className="w-4 h-4 text-gray-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {doc?.title || 'Documento sin título'}
        </p>
        <p className="text-xs text-gray-500">
          {doc?.token_count?.toLocaleString() || 0} tokens
          {assignment.weight !== 1 && ` · Peso: ${assignment.weight}`}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Quitar asignación"
      >
        <X size={14} />
      </button>
    </div>
  )
}
