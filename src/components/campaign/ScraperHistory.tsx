'use client'

/**
 * ScraperHistory Component
 *
 * Collapsible section showing history of executed scrapers.
 * Displays scraper name, status, documents generated, and links.
 */

import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  Clock,
  FileText,
  ExternalLink,
  Trash2,
} from 'lucide-react'
import type { JobHistoryEntry } from '@/hooks/useScraperJobPersistence'

// ============================================
// TYPES
// ============================================

interface ScraperHistoryProps {
  history: JobHistoryEntry[]
  onViewDocument?: (documentId: string) => void
  onClearHistory?: () => void
}

// ============================================
// HELPERS
// ============================================

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)

  if (diffMins < 1) return 'Justo ahora'
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ScraperHistory({
  history,
  onViewDocument,
  onClearHistory,
}: ScraperHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (history.length === 0) return null

  const completedCount = history.filter((h) => h.status === 'completed').length
  const failedCount = history.filter((h) => h.status === 'failed').length

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Header - Clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-sm text-gray-900">
            Historial de Scrapers
          </span>
          <div className="flex items-center gap-2 text-xs">
            {completedCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                <Check className="w-3 h-3" />
                {completedCount}
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                <AlertCircle className="w-3 h-3" />
                {failedCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{history.length} registros</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="divide-y divide-gray-100">
          {/* Clear button */}
          {onClearHistory && history.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onClearHistory()
                }}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Limpiar historial
              </button>
            </div>
          )}

          {/* History entries */}
          {history.map((entry, index) => (
            <div
              key={`${entry.jobId}-${index}`}
              className="px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left side - Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {/* Status icon */}
                    {entry.status === 'completed' ? (
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    )}

                    {/* Scraper name */}
                    <span className="font-medium text-sm text-gray-900 truncate">
                      {entry.scraperName}
                    </span>

                    {/* Time */}
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatRelativeTime(entry.completedAt || entry.startedAt)}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    {entry.status === 'completed' && entry.documentsGenerated && (
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {entry.documentsGenerated} documento{entry.documentsGenerated > 1 ? 's' : ''}
                      </span>
                    )}
                    {entry.status === 'failed' && entry.error && (
                      <span className="text-red-600 truncate max-w-xs">
                        {entry.error}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side - Actions */}
                {entry.status === 'completed' && entry.documentId && onViewDocument && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onViewDocument(entry.documentId!)
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ver
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {history.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No hay scrapers en el historial
            </div>
          )}
        </div>
      )}
    </div>
  )
}
