'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Search,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  Download,
  Save,
  Filter,
  X,
  ExternalLink,
  Loader2,
  Package,
  RefreshCw,
  BarChart3,
  Sparkles,
  Lightbulb,
  GitBranch,
  Wand2,
} from 'lucide-react'
import { Artifact, ArtifactGroup, ArtifactType, ARTIFACT_TYPE_LABELS } from './types'
import { useArtifacts } from './useArtifacts'
import ArtifactViewerModal from './ArtifactViewerModal'
import SaveToContextLakeModal, { StepOutputContext } from '@/components/documents/SaveToContextLakeModal'
import { useToast } from '@/components/ui/Toast/ToastContext'
import type { LucideIcon } from 'lucide-react'

// Icon mapping for artifact types
const ICON_MAP: Record<string, LucideIcon> = {
  Search: Search,
  FileText: FileText,
  Database: Database,
  Sparkles: Sparkles,
  Wand2: Wand2,
  BarChart3: BarChart3,
  Lightbulb: Lightbulb,
  GitBranch: GitBranch,
  Package: Package,
}

interface ArtifactBrowserProps {
  sessionId?: string
  projectId: string
  clientId: string
  userId: string
  campaignId?: string
  campaignName?: string
  playbookId: string
  playbookName: string
  playbookType: string
  allSteps?: Array<{
    definition: { id: string; name: string }
    state: { id: string; status: string; output?: unknown; input?: unknown }
  }>
  isVisible?: boolean
  onClose?: () => void
}

export default function ArtifactBrowser({
  sessionId,
  projectId,
  clientId,
  userId,
  campaignId,
  campaignName,
  playbookId,
  playbookName,
  playbookType,
  allSteps = [],
  isVisible = true,
  onClose,
}: ArtifactBrowserProps) {
  const toast = useToast()

  const {
    artifacts,
    loading,
    error,
    filter,
    setFilter,
    filteredGroups,
    refreshArtifacts,
    getArtifactById,
  } = useArtifacts({
    sessionId,
    projectId,
    campaignId,
    playbookType,
    allSteps,
  })

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedArtifacts, setExpandedArtifacts] = useState<Set<string>>(new Set())
  const [viewerOpen, setViewerOpen] = useState(false)
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveArtifact, setSaveArtifact] = useState<Artifact | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Toggle group expansion
  const toggleGroup = useCallback((groupType: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupType)) {
        next.delete(groupType)
      } else {
        next.add(groupType)
      }
      return next
    })
  }, [])

  // Toggle artifact expansion
  const toggleArtifact = useCallback((artifactId: string) => {
    setExpandedArtifacts(prev => {
      const next = new Set(prev)
      if (next.has(artifactId)) {
        next.delete(artifactId)
      } else {
        next.add(artifactId)
      }
      return next
    })
  }, [])

  // Open viewer modal
  const handleViewArtifact = useCallback((artifact: Artifact) => {
    setSelectedArtifact(artifact)
    setViewerOpen(true)
  }, [])

  // Open save modal
  const handleSaveToContextLake = useCallback((artifact: Artifact) => {
    setSaveArtifact(artifact)
    setSaveModalOpen(true)
    setViewerOpen(false)
  }, [])

  // Handle save completion
  const handleSaveComplete = useCallback((docId: string) => {
    toast.success('Artifact saved to Context Lake')
    setSaveModalOpen(false)
    setSaveArtifact(null)

    // Mark artifact as saved (in future, could update state)
  }, [toast])

  // Export artifact
  const handleExport = useCallback((artifact: Artifact, format: 'csv' | 'json') => {
    const content = artifact.content

    let data: string
    let filename: string
    let mimeType: string

    if (format === 'json') {
      data = JSON.stringify(content, null, 2)
      filename = `${artifact.name.replace(/\s+/g, '_')}.json`
      mimeType = 'application/json'
    } else {
      // CSV export
      if (Array.isArray(content) && content.length > 0 && typeof content[0] === 'object') {
        const headers = Object.keys(content[0] as Record<string, unknown>)
        const rows = [
          headers.join(','),
          ...content.map(row => {
            const r = row as Record<string, unknown>
            return headers.map(h => {
              const val = r[h]
              if (val === null || val === undefined) return ''
              if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`
              return String(val)
            }).join(',')
          })
        ]
        data = rows.join('\n')
      } else {
        data = typeof content === 'string' ? content : JSON.stringify(content)
      }
      filename = `${artifact.name.replace(/\s+/g, '_')}.csv`
      mimeType = 'text/csv'
    }

    const blob = new Blob([data], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(`Exported as ${format.toUpperCase()}`)
  }, [toast])

  // Get available step names for filter
  const availableSteps = useMemo(() => {
    const steps = new Map<string, string>()
    filteredGroups.forEach(group => {
      group.artifacts.forEach(artifact => {
        steps.set(artifact.stepId, artifact.stepName)
      })
    })
    return Array.from(steps.entries()).map(([id, name]) => ({ id, name }))
  }, [filteredGroups])

  // Get total count
  const totalArtifacts = useMemo(() => {
    return filteredGroups.reduce((sum, group) => sum + group.count, 0)
  }, [filteredGroups])

  if (!isVisible) return null

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Database size={18} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Session Data</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {totalArtifacts} artifacts from {artifacts?.totalSteps || 0} steps
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshArtifacts}
              disabled={loading}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-3 border-b border-gray-100 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filter.searchQuery}
            onChange={(e) => setFilter({ searchQuery: e.target.value })}
            placeholder="Search artifacts..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 text-sm ${
            showFilters || filter.types.length > 0 || filter.stepIds.length > 0
              ? 'text-indigo-600'
              : 'text-gray-500'
          } hover:text-indigo-700`}
        >
          <Filter size={14} />
          Filters
          {(filter.types.length > 0 || filter.stepIds.length > 0) && (
            <span className="px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded">
              {filter.types.length + filter.stepIds.length}
            </span>
          )}
          {showFilters ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Expanded filters */}
        {showFilters && (
          <div className="space-y-3 pt-2">
            {/* Type filter */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Artifact Type</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(ARTIFACT_TYPE_LABELS).map(([type, info]) => (
                  <button
                    key={type}
                    onClick={() => {
                      const types = filter.types.includes(type as ArtifactType)
                        ? filter.types.filter(t => t !== type)
                        : [...filter.types, type as ArtifactType]
                      setFilter({ types })
                    }}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      filter.types.includes(type as ArtifactType)
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {info.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step filter */}
            {availableSteps.length > 1 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Step</p>
                <div className="flex flex-wrap gap-1">
                  {availableSteps.map(step => (
                    <button
                      key={step.id}
                      onClick={() => {
                        const stepIds = filter.stepIds.includes(step.id)
                          ? filter.stepIds.filter(id => id !== step.id)
                          : [...filter.stepIds, step.id]
                        setFilter({ stepIds })
                      }}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        filter.stepIds.includes(step.id)
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {step.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Clear filters */}
            {(filter.types.length > 0 || filter.stepIds.length > 0) && (
              <button
                onClick={() => setFilter({ types: [], stepIds: [] })}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 text-red-600 text-sm">
            <p>{error}</p>
            <button
              onClick={refreshArtifacts}
              className="mt-2 text-indigo-600 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Package size={40} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium">No artifacts found</p>
            <p className="text-xs mt-1">
              {filter.searchQuery || filter.types.length > 0 || filter.stepIds.length > 0
                ? 'Try adjusting your filters'
                : 'Execute steps to generate data'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredGroups.map(group => (
              <ArtifactGroupComponent
                key={group.type}
                group={group}
                isExpanded={expandedGroups.has(group.type)}
                expandedArtifacts={expandedArtifacts}
                onToggle={() => toggleGroup(group.type)}
                onToggleArtifact={toggleArtifact}
                onView={handleViewArtifact}
                onSave={handleSaveToContextLake}
                onExport={handleExport}
              />
            ))}
          </div>
        )}
      </div>

      {/* Artifact Viewer Modal */}
      <ArtifactViewerModal
        isOpen={viewerOpen}
        artifact={selectedArtifact}
        onClose={() => setViewerOpen(false)}
        onSaveToContextLake={handleSaveToContextLake}
        onExport={handleExport}
      />

      {/* Save to Context Lake Modal */}
      {saveArtifact && (
        <SaveToContextLakeModal
          isOpen={saveModalOpen}
          content={typeof saveArtifact.content === 'string'
            ? saveArtifact.content
            : JSON.stringify(saveArtifact.content, null, 2)}
          projectId={projectId}
          clientId={clientId}
          userId={userId}
          stepContext={{
            stepId: saveArtifact.stepId,
            stepName: saveArtifact.stepName,
            stepOrder: saveArtifact.stepOrder,
            campaignId: campaignId || '',
            campaignName: campaignName || '',
            playbookId,
            playbookName,
            wasEditedBeforeConversion: false,
          }}
          onSave={handleSaveComplete}
          onClose={() => {
            setSaveModalOpen(false)
            setSaveArtifact(null)
          }}
        />
      )}
    </div>
  )
}

// Artifact Group Component
interface ArtifactGroupComponentProps {
  group: ArtifactGroup
  isExpanded: boolean
  expandedArtifacts: Set<string>
  onToggle: () => void
  onToggleArtifact: (id: string) => void
  onView: (artifact: Artifact) => void
  onSave: (artifact: Artifact) => void
  onExport: (artifact: Artifact, format: 'csv' | 'json') => void
}

function ArtifactGroupComponent({
  group,
  isExpanded,
  expandedArtifacts,
  onToggle,
  onToggleArtifact,
  onView,
  onSave,
  onExport,
}: ArtifactGroupComponentProps) {
  const typeInfo = ARTIFACT_TYPE_LABELS[group.type]
  const IconComponent = ICON_MAP[typeInfo.icon] || Package

  return (
    <div>
      {/* Group Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown size={16} className="text-gray-400" />
        ) : (
          <ChevronRight size={16} className="text-gray-400" />
        )}
        <span className={`p-1.5 rounded ${typeInfo.color}`}>
          <IconComponent size={14} />
        </span>
        <span className="font-medium text-gray-900 flex-1 text-left">
          {group.label}
        </span>
        <span className="text-sm text-gray-500">{group.count}</span>
      </button>

      {/* Expanded Artifacts */}
      {isExpanded && (
        <div className="bg-gray-50 border-y border-gray-100">
          {group.artifacts.map(artifact => (
            <ArtifactItem
              key={artifact.id}
              artifact={artifact}
              isExpanded={expandedArtifacts.has(artifact.id)}
              onToggle={() => onToggleArtifact(artifact.id)}
              onView={() => onView(artifact)}
              onSave={() => onSave(artifact)}
              onExport={(format) => onExport(artifact, format)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Individual Artifact Item
interface ArtifactItemProps {
  artifact: Artifact
  isExpanded: boolean
  onToggle: () => void
  onView: () => void
  onSave: () => void
  onExport: (format: 'csv' | 'json') => void
}

function ArtifactItem({
  artifact,
  isExpanded,
  onToggle,
  onView,
  onSave,
  onExport,
}: ArtifactItemProps) {
  const preview = useMemo(() => {
    if (typeof artifact.content === 'string') {
      return artifact.content.slice(0, 150) + (artifact.content.length > 150 ? '...' : '')
    }
    if (Array.isArray(artifact.content)) {
      return `${artifact.content.length} items`
    }
    return 'Object data'
  }, [artifact.content])

  const canExportCsv = Array.isArray(artifact.content) && artifact.content.length > 0

  return (
    <div className="border-b border-gray-100 last:border-0">
      {/* Item Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/50">
        <button
          onClick={onToggle}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          {isExpanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {artifact.name}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {artifact.stepName}
            {artifact.itemCount && ` · ${artifact.itemCount} items`}
            {artifact.wordCount && ` · ${artifact.wordCount} words`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onView}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="View"
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={onSave}
            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
            title="Save to Context Lake"
          >
            <Save size={14} />
          </button>
          <button
            onClick={() => onExport(canExportCsv ? 'csv' : 'json')}
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
            title={`Export as ${canExportCsv ? 'CSV' : 'JSON'}`}
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Expanded Preview */}
      {isExpanded && (
        <div className="px-4 py-3 bg-white border-t border-gray-100">
          <div className="text-xs text-gray-600 font-mono bg-gray-50 p-3 rounded max-h-32 overflow-auto">
            {typeof artifact.content === 'string' ? (
              artifact.content.slice(0, 500)
            ) : (
              <pre>{JSON.stringify(artifact.content, null, 2).slice(0, 500)}</pre>
            )}
            {(typeof artifact.content === 'string' ? artifact.content.length : JSON.stringify(artifact.content).length) > 500 && (
              <span className="text-gray-400">... [more]</span>
            )}
          </div>
          <div className="flex justify-end mt-2">
            <button
              onClick={onView}
              className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              View full content
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
