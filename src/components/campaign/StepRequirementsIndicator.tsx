'use client'

/**
 * StepRequirementsIndicator Component
 *
 * Shows the document requirements for a specific playbook step
 * and their completion status.
 */

import { useMemo } from 'react'
import {
  CheckCircle,
  Circle,
  AlertCircle,
  ArrowRight,
  FileText,
  Sparkles,
  Globe,
  MessageSquare,
  Star,
  Search,
} from 'lucide-react'
import {
  STEP_DOCUMENT_REQUIREMENTS,
  ALL_DOCUMENT_REQUIREMENTS,
  DOCUMENT_CATEGORIES,
  getDocumentsForStep,
} from '@/lib/playbooks/competitor-analysis/constants'
import type { DocumentRequirement, SourceType } from '@/lib/playbooks/competitor-analysis/types'

// ============================================
// TYPES
// ============================================

interface ExistingDocument {
  id: string
  name: string
  created_at: string
  metadata?: {
    source_type?: string
    competitor?: string
  }
}

export interface StepRequirementsIndicatorProps {
  stepId: string
  competitorName: string
  existingDocuments: ExistingDocument[]
  onNavigateToScrapers?: () => void
  onViewDocument?: (documentId: string) => void
  compact?: boolean
}

// ============================================
// ICON MAPPING
// ============================================

const categoryIcons: Record<string, React.ReactNode> = {
  research: <Sparkles size={14} />,
  website: <Globe size={14} />,
  seo: <Search size={14} />,
  social_posts: <MessageSquare size={14} />,
  social_comments: <MessageSquare size={14} />,
  reviews: <Star size={14} />,
}

// ============================================
// UTILITY
// ============================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function StepRequirementsIndicator({
  stepId,
  competitorName,
  existingDocuments,
  onNavigateToScrapers,
  onViewDocument,
  compact = false,
}: StepRequirementsIndicatorProps) {
  // Get required documents for this step
  const requiredDocuments = useMemo(() => {
    return getDocumentsForStep(stepId)
  }, [stepId])

  // Check which documents exist
  const documentStatus = useMemo(() => {
    return requiredDocuments.map((doc) => {
      const existingDoc = existingDocuments.find(
        (d) =>
          d.metadata?.source_type === doc.source_type && d.metadata?.competitor === competitorName
      )

      return {
        requirement: doc,
        exists: !!existingDoc,
        document: existingDoc,
      }
    })
  }, [requiredDocuments, existingDocuments, competitorName])

  // Calculate stats
  const stats = useMemo(() => {
    const total = documentStatus.length
    const completed = documentStatus.filter((d) => d.exists).length
    const missing = total - completed
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    return { total, completed, missing, percentage }
  }, [documentStatus])

  // If no requirements, show nothing
  if (requiredDocuments.length === 0) {
    return null
  }

  // Compact mode - just show a badge
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            stats.missing === 0
              ? 'bg-green-100 text-green-700'
              : stats.completed > 0
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600'
          }`}
        >
          {stats.completed}/{stats.total} docs
        </div>
        {stats.missing > 0 && (
          <span className="text-xs text-amber-600">{stats.missing} pendientes</span>
        )}
      </div>
    )
  }

  // Full mode - detailed view
  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-gray-500" />
            <h4 className="text-sm font-medium text-gray-900">Documentos Requeridos</h4>
          </div>
          <div
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              stats.missing === 0
                ? 'bg-green-100 text-green-700'
                : stats.completed > 0
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-600'
            }`}
          >
            {stats.completed}/{stats.total}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              stats.missing === 0 ? 'bg-green-500' : 'bg-yellow-500'
            }`}
            style={{ width: `${stats.percentage}%` }}
          />
        </div>
      </div>

      {/* Document list */}
      <div className="divide-y divide-gray-100">
        {documentStatus.map(({ requirement, exists, document }) => {
          const Icon = categoryIcons[requirement.category] || <FileText size={14} />

          return (
            <div
              key={requirement.id}
              className={`px-4 py-2.5 flex items-center gap-3 ${
                exists ? 'bg-white' : 'bg-amber-50/50'
              }`}
            >
              {/* Status icon */}
              {exists ? (
                <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
              ) : (
                <Circle size={16} className="text-gray-300 flex-shrink-0" />
              )}

              {/* Doc info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{Icon}</span>
                  <span
                    className={`text-sm truncate ${exists ? 'text-gray-700' : 'text-gray-600'}`}
                  >
                    {requirement.name}
                  </span>
                </div>
                {document && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Generado {formatDate(document.created_at)}
                  </p>
                )}
              </div>

              {/* Actions */}
              {exists && document && onViewDocument && (
                <button
                  onClick={() => onViewDocument(document.id)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Ver
                </button>
              )}
              {!exists && onNavigateToScrapers && (
                <button
                  onClick={onNavigateToScrapers}
                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                >
                  Ir a scrapers
                  <ArrowRight size={12} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer with warning if missing */}
      {stats.missing > 0 && (
        <div className="px-4 py-3 bg-amber-50 border-t border-amber-100">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-800 font-medium">
                Faltan {stats.missing} documento{stats.missing > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Puedes ejecutar el paso con los documentos disponibles o ir a scrapers para
                generarlos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success message if all complete */}
      {stats.missing === 0 && (
        <div className="px-4 py-2.5 bg-green-50 border-t border-green-100">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            <span className="text-sm text-green-700">
              Todos los documentos requeridos estan listos
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// INLINE VARIANT (for step headers)
// ============================================

export function StepRequirementsBadge({
  stepId,
  competitorName,
  existingDocuments,
}: {
  stepId: string
  competitorName: string
  existingDocuments: ExistingDocument[]
}) {
  const requiredDocuments = useMemo(() => getDocumentsForStep(stepId), [stepId])

  const stats = useMemo(() => {
    const total = requiredDocuments.length
    const completed = requiredDocuments.filter((doc) =>
      existingDocuments.some(
        (d) =>
          d.metadata?.source_type === doc.source_type && d.metadata?.competitor === competitorName
      )
    ).length

    return { total, completed, missing: total - completed }
  }, [requiredDocuments, existingDocuments, competitorName])

  if (stats.total === 0) return null

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        stats.missing === 0
          ? 'bg-green-100 text-green-700'
          : stats.completed > 0
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-gray-100 text-gray-500'
      }`}
    >
      {stats.missing === 0 ? (
        <>
          <CheckCircle size={10} />
          Listo
        </>
      ) : (
        <>
          {stats.completed}/{stats.total}
        </>
      )}
    </span>
  )
}
