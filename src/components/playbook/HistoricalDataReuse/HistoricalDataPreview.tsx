'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Check,
  Eye,
  Code,
  Table,
  Calendar,
  Tag,
  ArrowRight,
  ExternalLink,
  History,
  FileText,
  Database,
} from 'lucide-react'
import { HistoricalArtifact, getStepDisplayName } from './types'
import { ARTIFACT_TYPE_LABELS } from '../ArtifactBrowser/types'
import MarkdownRenderer from '@/components/common/MarkdownRenderer'

interface HistoricalDataPreviewProps {
  isOpen: boolean
  artifact: HistoricalArtifact | null
  onClose: () => void
  onUseData: (artifact: HistoricalArtifact) => void
  targetStepName?: string
}

type ViewMode = 'preview' | 'raw' | 'table'

export default function HistoricalDataPreview({
  isOpen,
  artifact,
  onClose,
  onUseData,
  targetStepName,
}: HistoricalDataPreviewProps) {
  const [mounted, setMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true))
      setViewMode('preview')
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleUseData = () => {
    if (artifact) {
      onUseData(artifact)
    }
  }

  if (!mounted || !isOpen || !artifact) return null

  const typeInfo = ARTIFACT_TYPE_LABELS[artifact.type as keyof typeof ARTIFACT_TYPE_LABELS] || {
    label: 'Data',
    color: 'text-gray-600 bg-gray-50',
  }

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

  const renderContent = () => {
    const content = artifact.content

    if (viewMode === 'raw') {
      return (
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg overflow-auto max-h-[50vh]">
          {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
        </pre>
      )
    }

    if (viewMode === 'table' && (Array.isArray(content) || typeof content === 'object')) {
      return renderTableView(content)
    }

    // Preview mode
    if (typeof content === 'string') {
      if (artifact.contentType === 'markdown') {
        return (
          <div className="prose prose-sm max-w-none overflow-auto max-h-[50vh]">
            <MarkdownRenderer content={content} />
          </div>
        )
      }
      return (
        <div className="text-gray-700 whitespace-pre-wrap overflow-auto max-h-[50vh]">
          {content}
        </div>
      )
    }

    if (Array.isArray(content)) {
      return renderListView(content)
    }

    if (typeof content === 'object' && content !== null) {
      return renderObjectView(content as Record<string, unknown>)
    }

    return <p className="text-gray-500">No content to display</p>
  }

  const renderTableView = (data: unknown) => {
    if (!Array.isArray(data) || data.length === 0) {
      if (typeof data === 'object' && data !== null) {
        return renderObjectView(data as Record<string, unknown>)
      }
      return <p className="text-gray-500">No table data available</p>
    }

    const firstItem = data[0]
    if (typeof firstItem !== 'object' || firstItem === null) {
      return renderListView(data)
    }

    const columns = Object.keys(firstItem as Record<string, unknown>)

    return (
      <div className="overflow-auto max-h-[50vh]">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              {columns.slice(0, 5).map(col => (
                <th key={col} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
              {columns.length > 5 && (
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">
                  +{columns.length - 5} more
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.slice(0, 50).map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-sm text-gray-400">{index + 1}</td>
                {columns.slice(0, 5).map(col => (
                  <td key={col} className="px-3 py-2 text-sm text-gray-700">
                    {renderCellValue((row as Record<string, unknown>)[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 50 && (
          <p className="text-sm text-gray-500 text-center py-2">
            Showing 50 of {data.length} items
          </p>
        )}
      </div>
    )
  }

  const renderCellValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-gray-400">-</span>
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'string') {
      if (value.startsWith('http')) {
        return (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline inline-flex items-center gap-1 max-w-[150px] truncate"
          >
            {new URL(value).hostname}
            <ExternalLink size={12} />
          </a>
        )
      }
      return <span className="max-w-[200px] truncate block">{value}</span>
    }
    if (typeof value === 'number') return value.toLocaleString()
    if (Array.isArray(value)) return `[${value.length} items]`
    if (typeof value === 'object') return JSON.stringify(value).slice(0, 30) + '...'
    return String(value)
  }

  const renderListView = (data: unknown[]) => {
    return (
      <div className="space-y-2 max-h-[50vh] overflow-auto">
        {data.slice(0, 20).map((item, index) => (
          <div key={index} className="p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-400 text-sm mr-2">#{index + 1}</span>
            {typeof item === 'object' ? (
              <pre className="text-sm text-gray-700 mt-1 max-h-24 overflow-auto">{JSON.stringify(item, null, 2)}</pre>
            ) : (
              <span className="text-gray-700">{String(item)}</span>
            )}
          </div>
        ))}
        {data.length > 20 && (
          <p className="text-sm text-gray-500 text-center py-2">
            Showing 20 of {data.length} items
          </p>
        )}
      </div>
    )
  }

  const renderObjectView = (data: Record<string, unknown>) => {
    return (
      <div className="space-y-3 max-h-[50vh] overflow-auto">
        {Object.entries(data).slice(0, 10).map(([key, value]) => (
          <div key={key} className="border-b border-gray-100 pb-2">
            <span className="text-sm font-medium text-gray-600">{key.replace(/_/g, ' ')}</span>
            <div className="mt-1 text-gray-700">
              {typeof value === 'string' ? (
                value.includes('\n') ? (
                  <pre className="text-sm whitespace-pre-wrap bg-gray-50 p-2 rounded max-h-24 overflow-auto">{value.slice(0, 500)}</pre>
                ) : (
                  <span className="text-sm">{value.slice(0, 200)}{value.length > 200 ? '...' : ''}</span>
                )
              ) : Array.isArray(value) ? (
                <span className="text-sm text-gray-500">[{value.length} items]</span>
              ) : typeof value === 'object' && value !== null ? (
                <pre className="text-sm bg-gray-50 p-2 rounded max-h-24 overflow-auto">{JSON.stringify(value, null, 2).slice(0, 200)}</pre>
              ) : (
                <span className="text-sm">{String(value)}</span>
              )}
            </div>
          </div>
        ))}
        {Object.keys(data).length > 10 && (
          <p className="text-sm text-gray-500 text-center py-2">
            +{Object.keys(data).length - 10} more fields
          </p>
        )}
      </div>
    )
  }

  const canShowTable = Array.isArray(artifact.content) ||
    (typeof artifact.content === 'object' && artifact.content !== null)

  return createPortal(
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center p-4 transition-all duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-900 rounded-2xl shadow-2xl transform transition-all duration-200 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} flex flex-col`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <History size={18} className="text-amber-600" />
              </div>
              <div>
                <h2 id="preview-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Preview Historical Data
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Review data before importing into current session
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Source Info */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <span className={`px-2.5 py-1 rounded text-xs font-medium ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
              <div>
                <p className="font-medium text-gray-900">{artifact.name}</p>
                <p className="text-sm text-gray-600">
                  From: {artifact.stepName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600">
              {artifact.sessionName && (
                <div className="flex items-center gap-1.5">
                  <FileText size={14} className="text-gray-400" />
                  <span>{artifact.sessionName}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-400" />
                <span>{formatDate(artifact.createdAt)}</span>
              </div>
              {artifact.itemCount && (
                <div className="flex items-center gap-1.5">
                  <Database size={14} className="text-gray-400" />
                  <span>{artifact.itemCount} items</span>
                </div>
              )}
            </div>
          </div>

          {artifact.tags && artifact.tags.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <Tag size={14} className="text-gray-400" />
              <div className="flex flex-wrap gap-1">
                {artifact.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs bg-white text-gray-600 rounded border border-gray-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* View mode tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100">
          <button
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'preview'
                ? 'bg-amber-100 text-amber-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Eye size={14} />
            Preview
          </button>
          {canShowTable && (
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                viewMode === 'table'
                  ? 'bg-amber-100 text-amber-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Table size={14} />
              Table
            </button>
          )}
          <button
            onClick={() => setViewMode('raw')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'raw'
                ? 'bg-amber-100 text-amber-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Code size={14} />
            Raw
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-sm text-gray-500">
            {targetStepName && (
              <span className="flex items-center gap-2">
                <span>Import to:</span>
                <span className="font-medium text-gray-700">{targetStepName}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUseData}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-md"
            >
              <Check size={16} />
              Use This Data
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
