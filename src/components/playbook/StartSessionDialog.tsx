'use client'

import { useState, useEffect } from 'react'
import { X, Play, Clock, Tag, History, ChevronRight, Loader2 } from 'lucide-react'
import { getPlaybookName } from '@/lib/playbook-metadata'

interface Session {
  id: string
  name: string
  status: string
  created_at: string
  updated_at: string
  tags: string[] | null
}

interface StartSessionDialogProps {
  projectId: string
  playbookType: string
  onSessionStart: (sessionId: string) => void
  onCancel: () => void
}

/**
 * Dialog for starting a new playbook session or resuming an existing one.
 *
 * Features:
 * - Auto-generated session name (format: "Playbook Name - Jan 25, 2026")
 * - Editable name field
 * - Optional tags input (comma-separated)
 * - List of recent sessions to resume
 * - Creates session record via API and returns session ID
 */
export default function StartSessionDialog({
  projectId,
  playbookType,
  onSessionStart,
  onCancel,
}: StartSessionDialogProps) {
  const [sessionName, setSessionName] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [recentSessions, setRecentSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Generate auto-name on mount
  useEffect(() => {
    const playbookName = getPlaybookName(playbookType)
    const dateStr = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    setSessionName(`${playbookName} - ${dateStr}`)
  }, [playbookType])

  // Load recent sessions
  useEffect(() => {
    async function loadRecentSessions() {
      try {
        const response = await fetch(
          `/api/playbook/sessions?project_id=${projectId}&playbook_type=${playbookType}`
        )
        if (response.ok) {
          const data = await response.json()
          setRecentSessions(data.sessions?.slice(0, 5) || [])
        }
      } catch (err) {
        console.error('Error loading recent sessions:', err)
      } finally {
        setLoadingSessions(false)
      }
    }

    loadRecentSessions()
  }, [projectId, playbookType])

  const handleStartSession = async () => {
    if (!sessionName.trim()) {
      setError('El nombre de la sesión es requerido')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      // Parse tags from comma-separated input
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)

      const response = await fetch('/api/playbook/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          playbook_type: playbookType,
          name: sessionName.trim(),
          tags: tags.length > 0 ? tags : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear la sesión')
      }

      onSessionStart(data.session.id)
    } catch (err) {
      console.error('Error creating session:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsCreating(false)
    }
  }

  const handleResumeSession = (sessionId: string) => {
    onSessionStart(sessionId)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
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

  const playbookName = getPlaybookName(playbookType)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-xl">
                <Play size={20} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Nueva sesión</h2>
                <p className="text-sm text-gray-600">{playbookName}</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              disabled={isCreating}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Session Name */}
          <div>
            <label htmlFor="session-name" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la sesión
            </label>
            <input
              id="session-name"
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder={`${playbookName} - ${new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isCreating}
            />
          </div>

          {/* Tags Input */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
              <span className="flex items-center gap-2">
                <Tag size={14} />
                Etiquetas <span className="text-gray-400 font-normal">(opcional)</span>
              </span>
            </label>
            <input
              id="tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="investigación, Q1 2026, cliente-abc"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isCreating}
            />
            <p className="mt-1.5 text-xs text-gray-500">Separa las etiquetas con comas</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Recent Sessions */}
          {(loadingSessions || recentSessions.length > 0) && (
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <History size={14} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700">O continúa una sesión anterior</span>
              </div>

              {loadingSessions ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={20} className="animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-2">
                  {recentSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleResumeSession(session.id)}
                      disabled={isCreating}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left disabled:opacity-50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {session.name || `Sesión ${session.id.slice(0, 8)}`}
                          </span>
                          {getStatusBadge(session.status)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock size={12} className="text-gray-400" />
                          <span className="text-xs text-gray-500">{formatDate(session.updated_at)}</span>
                          {session.tags && session.tags.length > 0 && (
                            <span className="text-xs text-gray-400">
                              · {session.tags.slice(0, 2).join(', ')}
                              {session.tags.length > 2 && ` +${session.tags.length - 2}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isCreating}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-white font-medium transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleStartSession}
            disabled={isCreating || !sessionName.trim()}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Play size={16} />
                Iniciar sesión
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
