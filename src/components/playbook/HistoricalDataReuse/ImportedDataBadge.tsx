'use client'

import { useState } from 'react'
import {
  History,
  ExternalLink,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  X,
} from 'lucide-react'
import { ImportedDataReference } from './types'
import { ARTIFACT_TYPE_LABELS } from '../ArtifactBrowser/types'

interface ImportedDataBadgeProps {
  reference: ImportedDataReference
  onRemove?: () => void
  compact?: boolean
  className?: string
}

export default function ImportedDataBadge({
  reference,
  onRemove,
  compact = false,
  className = '',
}: ImportedDataBadgeProps) {
  const [expanded, setExpanded] = useState(false)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(dateStr)
  }

  const typeInfo = ARTIFACT_TYPE_LABELS[reference.artifactType] || {
    label: 'Data',
    color: 'text-gray-600 bg-gray-50',
  }

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs ${className}`}
        title={`Imported from: ${reference.sourceSessionName || reference.sourceSessionId}`}
      >
        <History size={12} />
        <span>Imported</span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-0.5 hover:bg-amber-100 rounded transition-colors"
          >
            <X size={10} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl overflow-hidden ${className}`}>
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <History size={16} className="text-amber-600" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-800">
                Using Historical Data
              </p>
              <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Imported {formatTimeAgo(reference.importedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors"
              title="Remove imported data"
            >
              <X size={16} />
            </button>
          )}
          {expanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-amber-100 bg-white/50">
          <div className="space-y-3">
            {/* Source session */}
            <div className="flex items-start gap-2">
              <FileText size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">Source Session</p>
                <p className="text-sm text-gray-700 truncate">
                  {reference.sourceSessionName || `Session ${reference.sourceSessionId.slice(0, 8)}`}
                </p>
              </div>
            </div>

            {/* Source step */}
            <div className="flex items-start gap-2">
              <ArrowRight size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">Source Step</p>
                <p className="text-sm text-gray-700">{reference.sourceStepName}</p>
              </div>
            </div>

            {/* Import time */}
            <div className="flex items-start gap-2">
              <Calendar size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">Imported At</p>
                <p className="text-sm text-gray-700">{formatDate(reference.importedAt)}</p>
              </div>
            </div>
          </div>

          {/* Note about skipped execution */}
          <div className="mt-3 p-2 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-700">
              This step was skipped because historical data was imported.
              The data retains its original source for traceability.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
