'use client'

import { useState, useMemo } from 'react'
import {
  FileText,
  Globe,
  MessageSquare,
  Star,
  Search,
  Newspaper,
  ChevronDown,
  ChevronRight,
  Check,
  AlertCircle,
  Upload,
  ExternalLink,
  Loader2,
} from 'lucide-react'

/**
 * Document requirement definition for a playbook step
 */
export interface DocumentRequirement {
  id: string
  name: string
  description: string
  source: 'scraping' | 'deep_research' | 'manual' | 'generated'
  /** Icon key for the document type */
  icon: 'globe' | 'social' | 'review' | 'search' | 'news' | 'file'
  /** Optional: Apify actor ID for scraping */
  apifyActor?: string
  /** Optional: External tool for deep research */
  externalTool?: 'chatgpt' | 'perplexity' | 'claude'
  /** Optional: Category for grouping */
  category?: string
}

/**
 * Step with its document requirements
 */
export interface StepRequirements {
  stepId: string
  stepName: string
  stepOrder: number
  description?: string
  documents: DocumentRequirement[]
  /** Whether this step requires documents from previous steps only */
  receivesFromPrevious?: boolean
}

/**
 * Document availability status
 */
export interface DocumentStatus {
  documentId: string
  status: 'available' | 'missing' | 'in_progress'
  /** If available, the actual document ID in the system */
  linkedDocumentId?: string
}

interface DocumentRequirementsMapProps {
  /** Step requirements with their documents */
  stepRequirements: StepRequirements[]
  /** Current status of each document */
  documentStatuses: Record<string, DocumentStatus>
  /** Callback when user clicks to import a document */
  onImportDocument?: (requirement: DocumentRequirement, stepId: string) => void
  /** Callback when user clicks to view an existing document */
  onViewDocument?: (documentId: string) => void
  /** Campaign name (e.g., competitor name) */
  campaignName?: string
  /** Whether to show in compact mode */
  compact?: boolean
}

const ICON_MAP = {
  globe: Globe,
  social: MessageSquare,
  review: Star,
  search: Search,
  news: Newspaper,
  file: FileText,
}

const SOURCE_LABELS = {
  scraping: { label: 'Scraping', color: 'bg-blue-100 text-blue-700' },
  deep_research: { label: 'Deep Research', color: 'bg-purple-100 text-purple-700' },
  manual: { label: 'Manual', color: 'bg-gray-100 text-gray-700' },
  generated: { label: 'Generado', color: 'bg-green-100 text-green-700' },
}

/**
 * DocumentRequirementsMap - Visual map of all documents required for a playbook
 *
 * Shows:
 * - All steps with their required documents
 * - Status of each document (available/missing/in progress)
 * - Source type (scraping vs deep research vs manual)
 * - Quick actions to import missing documents
 */
export default function DocumentRequirementsMap({
  stepRequirements,
  documentStatuses,
  onImportDocument,
  onViewDocument,
  campaignName,
  compact = false,
}: DocumentRequirementsMapProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set(stepRequirements.map(s => s.stepId)))

  // Calculate summary statistics
  const stats = useMemo(() => {
    let total = 0
    let available = 0
    let missing = 0
    let inProgress = 0

    stepRequirements.forEach(step => {
      step.documents.forEach(doc => {
        total++
        const status = documentStatuses[doc.id]?.status || 'missing'
        if (status === 'available') available++
        else if (status === 'missing') missing++
        else if (status === 'in_progress') inProgress++
      })
    })

    return { total, available, missing, inProgress }
  }, [stepRequirements, documentStatuses])

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }

  const getStatusIcon = (status: DocumentStatus['status']) => {
    switch (status) {
      case 'available':
        return <Check className="w-4 h-4 text-green-600" />
      case 'in_progress':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
      case 'missing':
      default:
        return <AlertCircle className="w-4 h-4 text-amber-500" />
    }
  }

  const getStatusBg = (status: DocumentStatus['status']) => {
    switch (status) {
      case 'available':
        return 'bg-green-50 border-green-200'
      case 'in_progress':
        return 'bg-blue-50 border-blue-200'
      case 'missing':
      default:
        return 'bg-amber-50 border-amber-200'
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header with summary */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Documentos Requeridos
              {campaignName && (
                <span className="text-gray-500 font-normal">
                  para <span className="font-medium text-gray-700">{campaignName}</span>
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {stats.total} documentos en {stepRequirements.length} pasos
            </p>
          </div>

          {/* Progress indicators */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-gray-600">{stats.available} listos</span>
            </div>
            {stats.inProgress > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm text-gray-600">{stats.inProgress} en progreso</span>
              </div>
            )}
            {stats.missing > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-sm text-gray-600">{stats.missing} faltantes</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full flex">
            <div
              className="bg-green-500 transition-all duration-300"
              style={{ width: `${(stats.available / stats.total) * 100}%` }}
            />
            <div
              className="bg-blue-500 transition-all duration-300"
              style={{ width: `${(stats.inProgress / stats.total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps with documents */}
      <div className="divide-y divide-gray-100">
        {stepRequirements.map((step, index) => {
          const isExpanded = expandedSteps.has(step.stepId)
          const stepDocs = step.documents
          const stepStats = {
            total: stepDocs.length,
            available: stepDocs.filter(d => documentStatuses[d.id]?.status === 'available').length,
          }
          const allAvailable = stepStats.available === stepStats.total
          const hasDocuments = stepDocs.length > 0

          return (
            <div key={step.stepId} className="bg-white">
              {/* Step header */}
              <button
                onClick={() => hasDocuments && toggleStep(step.stepId)}
                className={`w-full px-6 py-4 flex items-center gap-4 text-left transition-colors ${
                  hasDocuments ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
                }`}
                disabled={!hasDocuments}
              >
                {/* Step number */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    allAvailable
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {index + 1}
                </div>

                {/* Step info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 truncate">{step.stepName}</h4>
                    {hasDocuments && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {stepStats.available}/{stepStats.total} docs
                      </span>
                    )}
                    {step.receivesFromPrevious && (
                      <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                        Recibe de pasos anteriores
                      </span>
                    )}
                  </div>
                  {step.description && (
                    <p className="text-sm text-gray-500 truncate mt-0.5">{step.description}</p>
                  )}
                </div>

                {/* Expand icon */}
                {hasDocuments && (
                  <div className="text-gray-400">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                )}
              </button>

              {/* Documents list */}
              {isExpanded && hasDocuments && (
                <div className={`px-6 pb-4 ${compact ? 'space-y-2' : 'space-y-3'}`}>
                  <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                    {stepDocs.map(doc => {
                      const status = documentStatuses[doc.id]?.status || 'missing'
                      const IconComponent = ICON_MAP[doc.icon] || FileText
                      const sourceInfo = SOURCE_LABELS[doc.source]

                      return (
                        <div
                          key={doc.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${getStatusBg(status)}`}
                        >
                          {/* Icon */}
                          <div className={`p-2 rounded-lg ${status === 'available' ? 'bg-green-100' : status === 'in_progress' ? 'bg-blue-100' : 'bg-amber-100'}`}>
                            <IconComponent className={`w-4 h-4 ${status === 'available' ? 'text-green-600' : status === 'in_progress' ? 'text-blue-600' : 'text-amber-600'}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 text-sm">{doc.name}</span>
                              {getStatusIcon(status)}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{doc.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${sourceInfo.color}`}>
                                {sourceInfo.label}
                              </span>
                              {doc.apifyActor && (
                                <span className="text-xs text-gray-400">Apify</span>
                              )}
                              {doc.externalTool && (
                                <span className="text-xs text-gray-400 capitalize">{doc.externalTool}</span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            {status === 'available' && onViewDocument && documentStatuses[doc.id]?.linkedDocumentId && (
                              <button
                                onClick={() => onViewDocument(documentStatuses[doc.id].linkedDocumentId!)}
                                className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                title="Ver documento"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                            {status === 'missing' && onImportDocument && (
                              <button
                                onClick={() => onImportDocument(doc, step.stepId)}
                                className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                                title="Importar documento"
                              >
                                <Upload className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer with action */}
      {stats.missing > 0 && onImportDocument && (
        <div className="px-6 py-4 bg-amber-50 border-t border-amber-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">
                {stats.missing} documento{stats.missing !== 1 ? 's' : ''} faltante{stats.missing !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => {
                // Find first missing document
                for (const step of stepRequirements) {
                  for (const doc of step.documents) {
                    if (documentStatuses[doc.id]?.status !== 'available') {
                      onImportDocument(doc, step.stepId)
                      return
                    }
                  }
                }
              }}
              className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Importar Documentos
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
