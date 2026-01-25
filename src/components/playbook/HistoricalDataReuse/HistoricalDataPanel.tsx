'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Search,
  X,
  Filter,
  ChevronDown,
  ChevronRight,
  Calendar,
  Tag,
  History,
  Database,
  FileText,
  Clock,
  Loader2,
  Package,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useHistoricalData } from './useHistoricalData'
import { HistoricalArtifact, ImportedDataReference, getStepDisplayName } from './types'
import { ARTIFACT_TYPE_LABELS, ArtifactType } from '../ArtifactBrowser/types'
import HistoricalDataPreview from './HistoricalDataPreview'

interface HistoricalDataPanelProps {
  projectId: string
  playbookType: string
  currentSessionId?: string
  stepId: string
  stepName: string
  onImport: (artifact: HistoricalArtifact, reference: ImportedDataReference) => void
  onClose: () => void
  isOpen: boolean
}

export default function HistoricalDataPanel({
  projectId,
  playbookType,
  currentSessionId,
  stepId,
  stepName,
  onImport,
  onClose,
  isOpen,
}: HistoricalDataPanelProps) {
  const {
    filteredArtifacts,
    sessions,
    loading,
    error,
    filter,
    setFilter,
    availableTags,
    availableStepIds,
    refresh,
    importArtifact,
  } = useHistoricalData({
    projectId,
    playbookType,
    currentSessionId,
    stepId,
    enabled: isOpen,
  })

  const [showFilters, setShowFilters] = useState(false)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const [previewArtifact, setPreviewArtifact] = useState<HistoricalArtifact | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Group artifacts by session
  const artifactsBySession = useMemo(() => {
    const grouped = new Map<string, HistoricalArtifact[]>()

    filteredArtifacts.forEach(artifact => {
      const sessionId = artifact.sessionId || 'unknown'
      if (!grouped.has(sessionId)) {
        grouped.set(sessionId, [])
      }
      grouped.get(sessionId)!.push(artifact)
    })

    return grouped
  }, [filteredArtifacts])

  // Toggle session expansion
  const toggleSession = useCallback((sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }, [])

  // Handle preview
  const handlePreview = useCallback((artifact: HistoricalArtifact) => {
    setPreviewArtifact(artifact)
    setShowPreview(true)
  }, [])

  // Handle use data
  const handleUseData = useCallback((artifact: HistoricalArtifact) => {
    const reference = importArtifact(artifact)
    onImport(artifact, reference)
    setShowPreview(false)
    onClose()
  }, [importArtifact, onImport, onClose])

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return formatDate(dateStr)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel */}
        <div className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden bg-white rounded-2xl shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-md">
                  <History size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Use Previous Data
                  </h2>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Import data from previous sessions for <span className="font-medium">{stepName}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => refresh()}
                  disabled={loading}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="p-4 border-b border-gray-100 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filter.searchQuery}
                onChange={(e) => setFilter({ searchQuery: e.target.value })}
                placeholder="Search by session name, step, or content..."
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
              {filter.searchQuery && (
                <button
                  onClick={() => setFilter({ searchQuery: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 text-sm ${
                  showFilters || filter.tags.length > 0 || filter.dateFrom || filter.dateTo
                    ? 'text-amber-600'
                    : 'text-gray-500'
                } hover:text-amber-700`}
              >
                <Filter size={14} />
                Filters
                {(filter.tags.length > 0 || filter.dateFrom || filter.dateTo) && (
                  <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                    {(filter.tags.length > 0 ? 1 : 0) + (filter.dateFrom || filter.dateTo ? 1 : 0)}
                  </span>
                )}
                {showFilters ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              <span className="text-sm text-gray-500">
                {filteredArtifacts.length} compatible artifact{filteredArtifacts.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Expanded filters */}
            {showFilters && (
              <div className="space-y-4 pt-2 border-t border-gray-100">
                {/* Date range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">From Date</label>
                    <input
                      type="date"
                      value={filter.dateFrom || ''}
                      onChange={(e) => setFilter({ dateFrom: e.target.value || null })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">To Date</label>
                    <input
                      type="date"
                      value={filter.dateTo || ''}
                      onChange={(e) => setFilter({ dateTo: e.target.value || null })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Tags filter */}
                {availableTags.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Tags</label>
                    <div className="flex flex-wrap gap-1.5">
                      {availableTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => {
                            const tags = filter.tags.includes(tag)
                              ? filter.tags.filter(t => t !== tag)
                              : [...filter.tags, tag]
                            setFilter({ tags })
                          }}
                          className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                            filter.tags.includes(tag)
                              ? 'bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                          }`}
                        >
                          <Tag size={10} className="inline mr-1" />
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clear filters */}
                {(filter.tags.length > 0 || filter.dateFrom || filter.dateTo) && (
                  <button
                    onClick={() => setFilter({ tags: [], dateFrom: null, dateTo: null })}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
                <p className="text-sm text-gray-500">Loading historical data...</p>
              </div>
            ) : error ? (
              <div className="p-6 text-center">
                <p className="text-red-600 mb-2">{error}</p>
                <button
                  onClick={() => refresh()}
                  className="text-amber-600 hover:underline text-sm"
                >
                  Try again
                </button>
              </div>
            ) : filteredArtifacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Package size={48} className="text-gray-300 mb-4" />
                <p className="font-medium">No compatible data found</p>
                <p className="text-sm mt-1 text-center max-w-xs">
                  {filter.searchQuery || filter.tags.length > 0 || filter.dateFrom || filter.dateTo
                    ? 'Try adjusting your filters'
                    : 'Complete this step in other sessions first'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {Array.from(artifactsBySession.entries()).map(([sessionId, artifacts]) => {
                  const session = sessions.find(s => s.id === sessionId)
                  const isExpanded = expandedSessions.has(sessionId)

                  return (
                    <div key={sessionId}>
                      {/* Session Header */}
                      <button
                        onClick={() => toggleSession(sessionId)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                        )}

                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="font-medium text-gray-900 truncate">
                              {session?.name || `Session ${sessionId.slice(0, 8)}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {session ? formatTimeAgo(session.createdAt) : 'Unknown date'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Database size={12} />
                              {artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        {session?.tags && session.tags.length > 0 && (
                          <div className="flex gap-1 flex-shrink-0">
                            {session.tags.slice(0, 2).map(tag => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                            {session.tags.length > 2 && (
                              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                                +{session.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </button>

                      {/* Expanded Artifacts */}
                      {isExpanded && (
                        <div className="bg-gray-50 border-t border-gray-100 px-4 py-2">
                          {artifacts.map(artifact => {
                            const typeInfo = ARTIFACT_TYPE_LABELS[artifact.type as ArtifactType] || {
                              label: 'Data',
                              color: 'text-gray-600 bg-gray-100',
                            }

                            return (
                              <div
                                key={artifact.id}
                                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${typeInfo.color}`}>
                                    {typeInfo.label}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">
                                      {artifact.name}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                      {artifact.stepName}
                                      {artifact.itemCount && ` · ${artifact.itemCount} items`}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => handlePreview(artifact)}
                                    className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-white border border-gray-200 rounded-lg transition-colors flex items-center gap-1.5"
                                  >
                                    <ExternalLink size={12} />
                                    Preview
                                  </button>
                                  <button
                                    onClick={() => handleUseData(artifact)}
                                    className="px-3 py-1.5 text-xs text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                                  >
                                    <Sparkles size={12} />
                                    Use This
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-center">
            <p className="text-xs text-gray-500">
              Importing data skips step execution and marks source for traceability
            </p>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <HistoricalDataPreview
        isOpen={showPreview}
        artifact={previewArtifact}
        onClose={() => setShowPreview(false)}
        onUseData={handleUseData}
        targetStepName={stepName}
      />
    </>
  )
}
