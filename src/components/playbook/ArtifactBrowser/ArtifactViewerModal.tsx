'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Download,
  Save,
  Copy,
  Check,
  Code,
  FileText,
  Table,
  Eye,
  ChevronDown,
  Maximize2,
  Minimize2,
  ExternalLink,
} from 'lucide-react'
import MarkdownRenderer from '@/components/common/MarkdownRenderer'
import { Artifact, ARTIFACT_TYPE_LABELS } from './types'

interface ArtifactViewerModalProps {
  isOpen: boolean
  artifact: Artifact | null
  onClose: () => void
  onSaveToContextLake?: (artifact: Artifact) => void
  onExport?: (artifact: Artifact, format: 'csv' | 'json') => void
}

type ViewMode = 'preview' | 'raw' | 'table'

export default function ArtifactViewerModal({
  isOpen,
  artifact,
  onClose,
  onSaveToContextLake,
  onExport,
}: ArtifactViewerModalProps) {
  const [mounted, setMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true))
      setViewMode('preview')
      setCopied(false)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false)
        } else {
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isFullscreen, onClose])

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

  const handleCopy = async () => {
    if (!artifact) return

    let textToCopy: string
    if (typeof artifact.content === 'string') {
      textToCopy = artifact.content
    } else {
      textToCopy = JSON.stringify(artifact.content, null, 2)
    }

    await navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!mounted || !isOpen || !artifact) return null

  const typeInfo = ARTIFACT_TYPE_LABELS[artifact.type]

  const renderContent = () => {
    const content = artifact.content

    if (viewMode === 'raw') {
      return (
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg overflow-auto max-h-[60vh]">
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
          <div className="prose prose-sm max-w-none overflow-auto max-h-[60vh]">
            <MarkdownRenderer content={content} />
          </div>
        )
      }
      return (
        <div className="text-gray-700 whitespace-pre-wrap overflow-auto max-h-[60vh]">
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
      <div className="overflow-auto max-h-[60vh]">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              {columns.map(col => (
                <th key={col} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.slice(0, 100).map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-sm text-gray-400">{index + 1}</td>
                {columns.map(col => (
                  <td key={col} className="px-3 py-2 text-sm text-gray-700">
                    {renderCellValue((row as Record<string, unknown>)[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 100 && (
          <p className="text-sm text-gray-500 text-center py-2">
            Showing 100 of {data.length} items
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
            className="text-blue-600 hover:underline inline-flex items-center gap-1 max-w-[200px] truncate"
          >
            {new URL(value).hostname}
            <ExternalLink size={12} />
          </a>
        )
      }
      return <span className="max-w-[300px] truncate block">{value}</span>
    }
    if (typeof value === 'number') return value.toLocaleString()
    if (Array.isArray(value)) return `[${value.length} items]`
    if (typeof value === 'object') return JSON.stringify(value).slice(0, 50) + '...'
    return String(value)
  }

  const renderListView = (data: unknown[]) => {
    return (
      <div className="space-y-2 max-h-[60vh] overflow-auto">
        {data.slice(0, 50).map((item, index) => (
          <div key={index} className="p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-400 text-sm mr-2">#{index + 1}</span>
            {typeof item === 'object' ? (
              <pre className="text-sm text-gray-700 mt-1">{JSON.stringify(item, null, 2)}</pre>
            ) : (
              <span className="text-gray-700">{String(item)}</span>
            )}
          </div>
        ))}
        {data.length > 50 && (
          <p className="text-sm text-gray-500 text-center py-2">
            Showing 50 of {data.length} items
          </p>
        )}
      </div>
    )
  }

  const renderObjectView = (data: Record<string, unknown>) => {
    return (
      <div className="space-y-3 max-h-[60vh] overflow-auto">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="border-b border-gray-100 pb-2">
            <span className="text-sm font-medium text-gray-600">{key.replace(/_/g, ' ')}</span>
            <div className="mt-1 text-gray-700">
              {typeof value === 'string' ? (
                value.includes('\n') ? (
                  <pre className="text-sm whitespace-pre-wrap bg-gray-50 p-2 rounded">{value}</pre>
                ) : (
                  <span>{value}</span>
                )
              ) : Array.isArray(value) ? (
                <span className="text-sm text-gray-500">[{value.length} items]</span>
              ) : typeof value === 'object' && value !== null ? (
                <pre className="text-sm bg-gray-50 p-2 rounded">{JSON.stringify(value, null, 2)}</pre>
              ) : (
                <span>{String(value)}</span>
              )}
            </div>
          </div>
        ))}
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
      aria-labelledby="artifact-modal-title"
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
        className={`relative ${isFullscreen ? 'w-full h-full' : 'w-full max-w-4xl max-h-[90vh]'} overflow-hidden bg-white dark:bg-gray-900 rounded-2xl shadow-2xl transform transition-all duration-200 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} flex flex-col`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 rounded text-xs font-medium ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
              <div>
                <h2 id="artifact-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {artifact.name}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  From: {artifact.stepName}
                  {artifact.itemCount && ` | ${artifact.itemCount} items`}
                  {artifact.wordCount && ` | ${artifact.wordCount} words`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* View mode tabs */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                viewMode === 'preview'
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
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
                    ? 'bg-indigo-100 text-indigo-700 font-medium'
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
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Code size={14} />
              Raw
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check size={16} className="text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copy
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onExport && canShowTable && (
              <div className="relative group">
                <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Download size={16} />
                  Export
                  <ChevronDown size={14} />
                </button>
                <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]">
                  <button
                    onClick={() => onExport(artifact, 'csv')}
                    className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => onExport(artifact, 'json')}
                    className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
                  >
                    Export as JSON
                  </button>
                </div>
              </div>
            )}

            {onSaveToContextLake && (
              <button
                onClick={() => onSaveToContextLake(artifact)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md"
              >
                <Save size={16} />
                Save to Context Lake
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
