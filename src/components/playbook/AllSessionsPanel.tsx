'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Search,
  Clock,
  ChevronRight,
  Loader2,
  History,
  Filter,
  Calendar,
  RefreshCw,
  Play,
} from 'lucide-react'
import { getPlaybookName, formatStepName } from '@/lib/playbook-metadata'

interface Session {
  id: string
  name: string | null
  playbook_type: string
  status: string
  current_step: string | null
  created_at: string
  updated_at: string
  tags: string[] | null
}

interface AllSessionsPanelProps {
  projectId: string
  playbookType?: string
  onSessionSelect: (sessionId: string) => void
  onClose: () => void
  onStartNew?: () => void
}

type StatusFilter = 'all' | 'draft' | 'running' | 'paused' | 'completed' | 'failed'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'running', label: 'En progreso' },
  { value: 'paused', label: 'Pausado' },
  { value: 'completed', label: 'Completado' },
  { value: 'failed', label: 'Error' },
]

/**
 * Full session history panel with search, status filter, and date range filter.
 * Shows all sessions for a project, sorted by updated_at descending.
 */
export default function AllSessionsPanel({
  projectId,
  playbookType,
  onSessionSelect,
  onClose,
  onStartNew,
}: AllSessionsPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({ project_id: projectId })

      if (playbookType) {
        params.append('playbook_type', playbookType)
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (dateFrom) {
        params.append('date_from', dateFrom)
      }
      if (dateTo) {
        params.append('date_to', dateTo)
      }

      const response = await fetch(`/api/playbook/sessions?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Error al cargar las sesiones')
      }

      const data = await response.json()
      setSessions(data.sessions || [])
    } catch (err) {
      console.error('Error loading sessions:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [projectId, playbookType, searchQuery, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Borrador' },
      running: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En progreso' },
      paused: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pausado' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completado' },
      failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Error' },
      active: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Activo' },
    }
    const config = statusConfig[status] || statusConfig.draft
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || dateFrom || dateTo

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-xl">
                <History size={20} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Historial de sesiones</h2>
                <p className="text-sm text-gray-600">
                  {playbookType ? getPlaybookName(playbookType) : 'Todas las sesiones'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="px-6 py-4 border-b border-gray-100 space-y-3">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 border rounded-xl flex items-center gap-2 text-sm font-medium transition-colors ${
                showFilters || hasActiveFilters
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter size={16} />
              Filtros
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </button>
            <button
              onClick={loadSessions}
              className="px-3 py-2 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
              title="Actualizar"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-3 pt-2">
              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-medium">Estado:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400" />
                <label className="text-xs text-gray-500 font-medium">Desde:</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-medium">Hasta:</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-gray-400 mb-2">
                <History size={48} className="mx-auto opacity-50" />
              </div>
              <p className="text-gray-500 text-sm">
                {hasActiveFilters
                  ? 'No se encontraron sesiones con los filtros aplicados'
                  : 'No hay sesiones registradas'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSessionSelect(session.id)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 truncate">
                        {session.name || `Sesión ${session.id.slice(0, 8)}`}
                      </span>
                      {getStatusBadge(session.status)}
                      {!playbookType && (
                        <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                          {getPlaybookName(session.playbook_type)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Clock size={12} className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-500">
                        {formatDate(session.updated_at)}
                      </span>
                      {session.current_step && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {formatStepName(session.current_step)}
                        </span>
                      )}
                      {session.tags && session.tags.length > 0 && (
                        <span className="text-xs text-gray-400">
                          · {session.tags.slice(0, 3).join(', ')}
                          {session.tags.length > 3 && ` +${session.tags.length - 3}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Continuar
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
          <span className="text-xs text-gray-500">
            {sessions.length} sesión{sessions.length !== 1 ? 'es' : ''} encontrada{sessions.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-white font-medium text-sm transition-colors"
            >
              Cerrar
            </button>
            {onStartNew && (
              <button
                onClick={onStartNew}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium text-sm transition-all inline-flex items-center gap-2"
              >
                <Play size={14} />
                Nueva sesión
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
