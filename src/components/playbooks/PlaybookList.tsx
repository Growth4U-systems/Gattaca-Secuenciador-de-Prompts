'use client'

import { useState } from 'react'
import { Search, Filter, Loader2, Workflow, Sparkles, Play, Zap } from 'lucide-react'
import type { Playbook, PlaybookType, PlaybookStatus, PlaybookConfig } from '@/types/v2.types'
import PlaybookCard from './PlaybookCard'
import PlaybookTemplates from './PlaybookTemplates'

interface PlaybookListProps {
  playbooks: Playbook[]
  loading?: boolean
  onRun?: (playbook: Playbook) => void
  onEdit?: (playbook: Playbook) => void  // For admin only
  onDuplicate?: (playbook: Playbook) => void
  onArchive?: (playbook: Playbook) => void
  onDelete?: (playbook: Playbook) => void
  onCreate?: () => void  // For admin only - hidden by default
  onCreateFromTemplate?: (template: { name: string; description: string; config: PlaybookConfig; tags: readonly string[] }) => void
  isAdmin?: boolean  // Show admin controls only when true
}

export default function PlaybookList({
  playbooks,
  loading = false,
  onRun,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
  onCreate,
  onCreateFromTemplate,
  isAdmin = false,  // Default to user view (no admin controls)
}: PlaybookListProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<PlaybookType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<PlaybookStatus | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showTemplates, setShowTemplates] = useState(playbooks.length === 0 && isAdmin)

  // Filter playbooks
  const filteredPlaybooks = playbooks.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    if (typeFilter !== 'all' && p.type !== typeFilter) {
      return false
    }
    if (statusFilter !== 'all' && p.status !== statusFilter) {
      return false
    }
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    )
  }

  // Empty state - different for users vs admins
  if (playbooks.length === 0) {
    if (isAdmin) {
      // Admin empty state - show templates
      return (
        <div className="space-y-6">
          <PlaybookTemplates
            onUseTemplate={(template) => {
              if (onCreateFromTemplate) {
                onCreateFromTemplate(template)
              }
            }}
          />
        </div>
      )
    }

    // User empty state - simple message
    return (
      <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl border border-gray-100">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
          <Workflow className="w-8 h-8 text-indigo-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No hay playbooks disponibles
        </h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Los playbooks estarán disponibles cuando tu equipo los configure.
          Mientras tanto, puedes explorar tu Context Lake.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar playbooks..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white text-gray-900 placeholder-gray-400"
          />
        </div>

        {/* Filter toggle - only show if we have multiple playbooks */}
        {filteredPlaybooks.length > 3 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
              showFilters || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter size={16} />
            Filtros
          </button>
        )}

        {/* Admin-only controls */}
        {isAdmin && (
          <>
            {/* Templates toggle */}
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={`px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                showTemplates
                  ? 'border-purple-300 bg-purple-50 text-purple-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Sparkles size={16} />
              Templates
            </button>
          </>
        )}
      </div>

      {/* Templates panel - Admin only */}
      {isAdmin && showTemplates && onCreateFromTemplate && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-purple-900">Templates listos para usar</h4>
            </div>
            <button
              onClick={() => setShowTemplates(false)}
              className="text-purple-400 hover:text-purple-600 text-sm"
            >
              Cerrar
            </button>
          </div>
          <PlaybookTemplates
            onUseTemplate={onCreateFromTemplate}
            compact={false}
          />
        </div>
      )}

      {/* Filter panel */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
          {/* Type filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Tipo:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as PlaybookType | 'all')}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="playbook">Playbook</option>
              <option value="enricher">Enricher</option>
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PlaybookStatus | 'all')}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="draft">Borrador</option>
              <option value="active">Activo</option>
              <option value="archived">Archivado</option>
            </select>
          </div>

          {/* Clear filters */}
          {(typeFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setTypeFilter('all')
                setStatusFilter('all')
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      {!showTemplates && (
        <div className="text-sm text-gray-500">
          {filteredPlaybooks.length} de {playbooks.length} playbooks
        </div>
      )}

      {/* Playbook grid */}
      {!showTemplates && (
        <>
          {filteredPlaybooks.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
              <Workflow className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No se encontraron playbooks</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPlaybooks.map((playbook) => (
                <PlaybookCard
                  key={playbook.id}
                  playbook={playbook}
                  onRun={onRun}
                  // Admin-only actions
                  onEdit={isAdmin ? onEdit : undefined}
                  onDuplicate={isAdmin ? onDuplicate : undefined}
                  onArchive={isAdmin ? onArchive : undefined}
                  onDelete={isAdmin ? onDelete : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
