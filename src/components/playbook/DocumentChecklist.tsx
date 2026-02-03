'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Check,
  AlertCircle,
  Upload,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  ExternalLink,
  Info,
} from 'lucide-react'
import type { DocumentRequirement, DocumentStatus, StepRequirements } from './DocumentRequirementsMap'

interface DocumentChecklistProps {
  /** Step requirements with their documents */
  stepRequirements: StepRequirements[]
  /** Current status of each document (keyed by document id) */
  documentStatuses: Record<string, DocumentStatus>
  /** Available project documents to match against requirements */
  projectDocuments?: Array<{
    id: string
    name: string
    category?: string
    folder?: string
  }>
  /** Callback when user clicks to import a document */
  onImportDocument?: (requirement: DocumentRequirement, stepId: string) => void
  /** Whether checking document status */
  isLoading?: boolean
  /** Compact mode for embedding in forms */
  compact?: boolean
  /** Show only documents for specific step */
  filterByStep?: string
  /** Show detailed guidance */
  showGuidance?: boolean
}

/**
 * DocumentChecklist - Compact checklist for document requirements
 *
 * Used in:
 * - CampaignWizard: Before creating a campaign
 * - Step execution: Before running a step that needs documents
 *
 * Shows:
 * - Quick summary of ready vs missing documents
 * - Expandable details with document list
 * - Import actions for missing documents
 */
export default function DocumentChecklist({
  stepRequirements,
  documentStatuses,
  projectDocuments = [],
  onImportDocument,
  isLoading = false,
  compact = false,
  filterByStep,
  showGuidance = true,
}: DocumentChecklistProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Filter requirements by step if specified
  const filteredRequirements = useMemo(() => {
    if (!filterByStep) return stepRequirements
    return stepRequirements.filter(step => step.stepId === filterByStep)
  }, [stepRequirements, filterByStep])

  // Calculate statistics
  const stats = useMemo(() => {
    let total = 0
    let available = 0
    let missing = 0

    filteredRequirements.forEach(step => {
      step.documents.forEach(doc => {
        total++
        const status = documentStatuses[doc.id]?.status || 'missing'
        if (status === 'available') available++
        else missing++
      })
    })

    const percentage = total > 0 ? Math.round((available / total) * 100) : 100
    const isComplete = missing === 0
    const hasDocuments = total > 0

    return { total, available, missing, percentage, isComplete, hasDocuments }
  }, [filteredRequirements, documentStatuses])

  // Group missing documents by category for guidance
  const missingByCategory = useMemo(() => {
    const missing: Record<string, DocumentRequirement[]> = {}

    filteredRequirements.forEach(step => {
      step.documents.forEach(doc => {
        const status = documentStatuses[doc.id]?.status || 'missing'
        if (status !== 'available') {
          const category = doc.category || 'other'
          if (!missing[category]) missing[category] = []
          missing[category].push(doc)
        }
      })
    })

    return missing
  }, [filteredRequirements, documentStatuses])

  if (!stats.hasDocuments) {
    return null // No documents needed for this step/playbook
  }

  if (isLoading) {
    return (
      <div className={`rounded-lg border border-gray-200 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          <span className="text-sm text-gray-600">Verificando documentos...</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-lg border transition-colors ${
        stats.isComplete
          ? 'border-green-200 bg-green-50'
          : 'border-amber-200 bg-amber-50'
      } ${compact ? 'p-3' : 'p-4'}`}
    >
      {/* Summary header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          {stats.isComplete ? (
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
          )}

          <div>
            <p className={`font-medium ${stats.isComplete ? 'text-green-800' : 'text-amber-800'}`}>
              {stats.isComplete
                ? 'Documentos listos'
                : `${stats.missing} documento${stats.missing !== 1 ? 's' : ''} faltante${stats.missing !== 1 ? 's' : ''}`}
            </p>
            <p className="text-xs text-gray-500">
              {stats.available} de {stats.total} documentos disponibles ({stats.percentage}%)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mini progress bar */}
          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                stats.isComplete ? 'bg-green-500' : 'bg-amber-500'
              }`}
              style={{ width: `${stats.percentage}%` }}
            />
          </div>

          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {/* Guidance for missing documents */}
          {!stats.isComplete && showGuidance && (
            <div className="mb-4 p-3 bg-white rounded-lg border border-amber-100">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-gray-600">
                  <p className="font-medium text-gray-700 mb-1">
                    Puedes ejecutar el playbook sin todos los documentos
                  </p>
                  <p>
                    Los pasos que requieren documentos faltantes usarán solo la información disponible.
                    Para mejores resultados, importa los documentos antes de ejecutar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Document list by step */}
          <div className="space-y-4">
            {filteredRequirements.map(step => {
              if (step.documents.length === 0) return null

              const stepMissing = step.documents.filter(
                doc => documentStatuses[doc.id]?.status !== 'available'
              ).length

              return (
                <div key={step.stepId}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {step.stepName}
                    </span>
                    {stepMissing > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {stepMissing} faltantes
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2">
                    {step.documents.map(doc => {
                      const status = documentStatuses[doc.id]?.status || 'missing'
                      const isAvailable = status === 'available'

                      return (
                        <div
                          key={doc.id}
                          className={`flex items-center gap-3 p-2 rounded-lg ${
                            isAvailable ? 'bg-green-100/50' : 'bg-white border border-amber-100'
                          }`}
                        >
                          {isAvailable ? (
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          )}

                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${isAvailable ? 'text-green-700' : 'text-gray-700'}`}>
                              {doc.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{doc.description}</p>
                          </div>

                          {!isAvailable && onImportDocument && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onImportDocument(doc, step.stepId)
                              }}
                              className="flex-shrink-0 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded transition-colors flex items-center gap-1"
                            >
                              <Upload className="w-3 h-3" />
                              Importar
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Quick actions */}
          {!stats.isComplete && onImportDocument && stats.missing > 3 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  // Find first missing document
                  for (const step of filteredRequirements) {
                    for (const doc of step.documents) {
                      if (documentStatuses[doc.id]?.status !== 'available') {
                        onImportDocument(doc, step.stepId)
                        return
                      }
                    }
                  }
                }}
                className="w-full py-2 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Importar todos los documentos faltantes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Hook to check document status against requirements
 */
export function useDocumentStatus(
  requirements: DocumentRequirement[],
  projectDocuments: Array<{ id: string; name: string; category?: string; folder?: string }>
): Record<string, DocumentStatus> {
  const [statuses, setStatuses] = useState<Record<string, DocumentStatus>>({})

  useEffect(() => {
    // Simple matching logic - can be enhanced with AI matching
    const newStatuses: Record<string, DocumentStatus> = {}

    requirements.forEach(req => {
      // Try to find a matching document
      const match = projectDocuments.find(doc => {
        // Match by name similarity
        const nameMatch = doc.name.toLowerCase().includes(req.name.toLowerCase()) ||
                         req.name.toLowerCase().includes(doc.name.toLowerCase())

        // Match by category if available
        const categoryMatch = doc.category === req.category ||
                             doc.folder?.toLowerCase().includes(req.id.split('-')[0])

        return nameMatch || categoryMatch
      })

      newStatuses[req.id] = {
        documentId: req.id,
        status: match ? 'available' : 'missing',
        linkedDocumentId: match?.id,
      }
    })

    setStatuses(newStatuses)
  }, [requirements, projectDocuments])

  return statuses
}
