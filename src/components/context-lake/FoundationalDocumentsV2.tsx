'use client'

import { useState, useCallback } from 'react'
import {
  Crown,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileText,
  RefreshCw,
} from 'lucide-react'
import type { Document, FoundationalType, DocumentTier } from '@/types/v2.types'
import { FOUNDATIONAL_TYPES, FOUNDATIONAL_TYPE_CONFIG } from '@/types/v2.types'
import { useDocumentAssignments } from '@/hooks/useDocumentAssignments'
import FoundationalSlotCard from './FoundationalSlotCard'
import DocumentAssignmentModal from './DocumentAssignmentModal'

interface FoundationalDocumentsV2Props {
  clientId: string
  documents: Document[]
  onUploadDocument?: (docType: string, tier: DocumentTier) => void
  onConnectDrive?: (docType: string, tier: DocumentTier) => void
  onPasteUrl?: (docType: string, tier: DocumentTier) => void
  onGenerateDocument?: (type: FoundationalType) => void
  onViewDocument?: (document: Document) => void
  onEditDocument?: (document: Document) => void
}

export default function FoundationalDocumentsV2({
  clientId,
  documents,
  onUploadDocument,
  onConnectDrive,
  onPasteUrl,
  onGenerateDocument,
  onViewDocument,
  onEditDocument,
}: FoundationalDocumentsV2Props) {
  const {
    slots,
    loading,
    error,
    synthesizing,
    assignDocument,
    unassignDocument,
    synthesize,
    reload,
    clearError,
  } = useDocumentAssignments(clientId)

  const [assigningType, setAssigningType] = useState<FoundationalType | null>(null)

  // Calculate completion stats
  const approvedCount = slots.filter(s => s.synthesizedDocument?.approval_status === 'approved').length
  const totalCount = slots.length
  const completionPercent = Math.round((approvedCount / totalCount) * 100)

  // Critical slots without synthesized+approved docs
  const criticalPending = slots.filter(
    s => s.priority === 'critical' &&
    (s.synthesizedDocument?.approval_status !== 'approved')
  )

  // Handle assignment from Context Lake
  const handleAssignFromContextLake = (type: FoundationalType) => {
    setAssigningType(type)
  }

  const handleAssignDocuments = useCallback(async (documentIds: string[]) => {
    if (!assigningType) return

    // Assign each document
    for (const docId of documentIds) {
      await assignDocument(docId, assigningType)
    }

    setAssigningType(null)
  }, [assigningType, assignDocument])

  // Handle synthesis
  const handleSynthesize = useCallback(async (type: FoundationalType, force?: boolean) => {
    const result = await synthesize(type, force)
    if (result.success) {
      // Reload to get updated status
      await reload()
    } else {
      alert(`Error al sintetizar: ${result.error}`)
    }
  }, [synthesize, reload])

  // Handle document approval
  const handleApproveDocument = useCallback(async (documentId: string) => {
    try {
      const response = await fetch(`/api/v2/documents/${documentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Failed to approve document')
      }

      await reload()
    } catch (err) {
      console.error('Error approving document:', err)
      alert('Error al aprobar el documento')
    }
  }, [reload])

  // Handle version rollback
  const handleRollback = useCallback(async (documentId: string, targetVersionId: string) => {
    try {
      const response = await fetch(`/api/v2/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetVersionId }),
      })

      if (!response.ok) {
        throw new Error('Failed to rollback')
      }

      await reload()
    } catch (err) {
      console.error('Error rolling back:', err)
      alert('Error al restaurar versión')
    }
  }, [reload])

  // Get current slot's assignments for the modal
  const currentSlot = assigningType ? slots.find(s => s.type === assigningType) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Cargando documentos fundacionales...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      {/* Progress Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Documentos Fundacionales</h2>
              <p className="text-indigo-200 text-sm">
                Asigna documentos fuente y sintetiza documentos base para tu marca
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{completionPercent}%</div>
            <div className="text-indigo-200 text-sm">aprobados</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${completionPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-indigo-200">
            {approvedCount} de {totalCount} documentos aprobados
          </span>
          {criticalPending.length > 0 && (
            <span className="flex items-center gap-1 text-amber-300">
              <AlertTriangle size={14} />
              {criticalPending.length} críticos pendientes
            </span>
          )}
          <button
            onClick={reload}
            className="flex items-center gap-1 text-white/70 hover:text-white transition-colors"
          >
            <RefreshCw size={14} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Critical Missing Alert */}
      {criticalPending.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800">Documentos críticos pendientes</h3>
              <p className="text-sm text-red-700 mt-1">
                Estos documentos son necesarios para que los playbooks generen contenido de calidad.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {criticalPending.map(slot => (
                  <span
                    key={slot.type}
                    className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded-lg"
                  >
                    {slot.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">¿Cómo funciona?</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li><strong>Asigna documentos</strong> de tu Context Lake a cada tipo fundacional</li>
              <li><strong>Sintetiza</strong> - La IA combina los documentos en uno unificado</li>
              <li><strong>Revisa y aprueba</strong> el documento sintetizado</li>
              <li>Los playbooks usarán el documento aprobado automáticamente</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Foundational Slots */}
      <div className="space-y-4">
        {slots.map(slot => (
          <FoundationalSlotCard
            key={slot.type}
            slot={slot}
            clientId={clientId}
            onAssignFromContextLake={handleAssignFromContextLake}
            onUploadDocument={(type) => {
              const config = FOUNDATIONAL_TYPE_CONFIG[type]
              onUploadDocument?.(type, config.tier)
            }}
            onConnectDrive={(type) => {
              const config = FOUNDATIONAL_TYPE_CONFIG[type]
              onConnectDrive?.(type, config.tier)
            }}
            onPasteUrl={(type) => {
              const config = FOUNDATIONAL_TYPE_CONFIG[type]
              onPasteUrl?.(type, config.tier)
            }}
            onGenerateWithAI={onGenerateDocument || (() => {})}
            onRemoveAssignment={unassignDocument}
            onSynthesize={handleSynthesize}
            onViewDocument={onViewDocument || (() => {})}
            onEditDocument={onEditDocument || (() => {})}
            onApproveDocument={handleApproveDocument}
            onRollback={handleRollback}
            synthesizing={synthesizing === slot.type}
          />
        ))}
      </div>

      {/* All Complete Message */}
      {approvedCount === totalCount && (
        <div className="text-center py-8 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-green-800">
            ¡Todos los documentos fundacionales están listos!
          </h3>
          <p className="text-sm text-green-700 mt-1">
            Tu Context Lake está completamente preparado para los playbooks.
          </p>
        </div>
      )}

      {/* Assignment Modal */}
      {assigningType && currentSlot && (
        <DocumentAssignmentModal
          isOpen={true}
          foundationalType={assigningType}
          clientId={clientId}
          existingAssignments={currentSlot.assignments}
          onClose={() => setAssigningType(null)}
          onAssign={handleAssignDocuments}
        />
      )}
    </div>
  )
}
