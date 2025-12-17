'use client'

import { useState, useEffect } from 'react'
import { X, Mail, Link as LinkIcon, Users, Copy, Check, Loader2, Trash2, AlertCircle } from 'lucide-react'

interface ShareProjectModalProps {
  projectId: string
  projectName: string
  onClose: () => void
}

type TabType = 'invite' | 'link' | 'members'
type ProjectRole = 'owner' | 'editor' | 'viewer'

interface Invitation {
  id: string
  email: string
  role: ProjectRole
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  created_at: string
  expires_at: string
  invitation_token: string
}

interface ShareLink {
  id: string
  role: ProjectRole
  share_token: string
  is_active: boolean
  expires_at: string | null
  max_uses: number | null
  current_uses: number
  created_at: string
}

interface Member {
  id: string
  user_id: string
  role: ProjectRole
  added_at: string
  email?: string
}

const ROLE_DESCRIPTIONS = {
  owner: 'Control total: puede gestionar miembros, compartir y eliminar el proyecto',
  editor: 'Puede editar proyecto, subir documentos y crear campañas',
  viewer: 'Solo puede ver el proyecto y sus recursos',
}

export default function ShareProjectModal({ projectId, projectName, onClose }: ShareProjectModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('members')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Invite tab state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<ProjectRole>('viewer')
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [inviting, setInviting] = useState(false)

  // Link tab state
  const [linkRole, setLinkRole] = useState<ProjectRole>('editor')
  const [linkMaxUses, setLinkMaxUses] = useState<number>(1)
  const [linkExpiresIn, setLinkExpiresIn] = useState<number>(1) // days
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [generating, setGenerating] = useState(false)
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)

  // Members tab state
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    if (activeTab === 'invite') {
      loadInvitations()
    } else if (activeTab === 'link') {
      loadShareLinks()
    } else if (activeTab === 'members') {
      loadMembers()
    }
  }, [activeTab])

  const loadInvitations = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`)
      const data = await res.json()
      if (data.success) {
        setInvitations(data.invitations || [])
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al cargar invitaciones')
    } finally {
      setLoading(false)
    }
  }

  const loadShareLinks = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/share-links`)
      const data = await res.json()
      if (data.success) {
        setShareLinks(data.links || [])
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al cargar links')
    } finally {
      setLoading(false)
    }
  }

  const loadMembers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/members`)
      const data = await res.json()
      if (data.success) {
        setMembers(data.members || [])
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al cargar miembros')
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return

    setInviting(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()
      if (data.success) {
        setInviteEmail('')
        await loadInvitations()
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al enviar invitación')
    } finally {
      setInviting(false)
    }
  }

  const handleGenerateLink = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/share-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: linkRole,
          maxUses: linkMaxUses,
          expiresIn: linkExpiresIn
        }),
      })
      const data = await res.json()
      if (data.success) {
        await loadShareLinks()
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al generar link')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyLink = (token: string, linkId: string) => {
    const url = `${window.location.origin}/projects/join/${token}`
    navigator.clipboard.writeText(url)
    setCopiedLinkId(linkId)
    setTimeout(() => setCopiedLinkId(null), 2000)
  }

  const handleDeactivateLink = async (linkId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/share-links?linkId=${linkId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        await loadShareLinks()
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al desactivar link')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('¿Seguro que quieres remover este miembro?')) return

    try {
      const res = await fetch(`/api/projects/${projectId}/members?memberId=${memberId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        await loadMembers()
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al remover miembro')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations?invitationId=${invitationId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        await loadInvitations()
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al cancelar invitación')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Compartir proyecto</h2>
            <p className="text-sm text-gray-600 mt-1">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'members'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="font-medium">Miembros</span>
          </button>
          <button
            onClick={() => setActiveTab('link')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'link'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span className="font-medium">Link compartible</span>
          </button>
          {/* TODO: Habilitar cuando esté listo para producción
          <button
            onClick={() => setActiveTab('invite')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'invite'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span className="font-medium">Invitar por email</span>
          </button>
          */}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Invite Tab */}
          {activeTab === 'invite' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email del colaborador
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="nombre@ejemplo.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rol
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
                    className="w-full px-3 py-2 text-sm text-gray-900 font-medium border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="viewer" className="py-2 text-gray-900">Viewer (Solo lectura)</option>
                    <option value="editor" className="py-2 text-gray-900">Editor (Puede editar)</option>
                    <option value="owner" className="py-2 text-gray-900">Owner (Control total)</option>
                  </select>
                  <p className="text-xs text-gray-600 mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                    <span className="font-medium text-blue-900 capitalize">{inviteRole}:</span>{' '}
                    {ROLE_DESCRIPTIONS[inviteRole]}
                  </p>
                </div>

                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || inviting}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {inviting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Enviar invitación
                    </>
                  )}
                </button>
              </div>

              {/* Invitations list */}
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : invitations.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Invitaciones pendientes</h3>
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{inv.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-600 capitalize">{inv.role}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className={`text-xs ${isExpired(inv.expires_at) ? 'text-red-600' : 'text-gray-600'}`}>
                            {isExpired(inv.expires_at) ? 'Expirada' : `Expira ${formatDate(inv.expires_at)}`}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCancelInvitation(inv.id)}
                        className="p-2 hover:bg-gray-200 rounded transition-colors"
                        title="Cancelar invitación"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No hay invitaciones pendientes
                </p>
              )}
            </div>
          )}

          {/* Link Tab */}
          {activeTab === 'link' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rol para el link
                  </label>
                  <select
                    value={linkRole}
                    onChange={(e) => setLinkRole(e.target.value as ProjectRole)}
                    className="w-full px-3 py-2 text-sm text-gray-900 font-medium border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="editor" className="py-2 text-gray-900">Editor (Puede editar)</option>
                    {/* TODO: Habilitar viewer cuando esté listo para producción
                    <option value="viewer" className="py-2 text-gray-900">Viewer (Solo lectura)</option>
                    */}
                  </select>
                  <p className="text-xs text-gray-600 mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                    <span className="font-medium text-blue-900 capitalize">{linkRole}:</span>{' '}
                    {ROLE_DESCRIPTIONS[linkRole]}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Máximo de usos
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={linkMaxUses}
                      onChange={(e) => setLinkMaxUses(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 text-sm text-gray-900 font-medium border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Número de veces que se puede usar el link
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expira en (días)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={linkExpiresIn}
                      onChange={(e) => setLinkExpiresIn(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 text-sm text-gray-900 font-medium border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Días hasta que el link expire
                    </p>
                  </div>
                </div>

                {linkMaxUses === 1 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800">
                      <span className="font-medium">⚠️ Link de un solo uso:</span> El link se desactivará automáticamente después de que una persona lo use.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleGenerateLink}
                  disabled={generating}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-4 h-4" />
                      {linkMaxUses === 1 ? 'Generar link de un solo uso' : 'Generar link compartible'}
                    </>
                  )}
                </button>
              </div>

              {/* Share links list */}
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : shareLinks.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Links activos</h3>
                  {shareLinks.map((link) => (
                    <div
                      key={link.id}
                      className="p-3 bg-gray-50 rounded-lg space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-900 capitalize">
                              {link.role}
                            </span>
                            {link.max_uses === 1 ? (
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                link.current_uses === 0
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {link.current_uses === 0 ? 'No usado' : 'Usado'}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">
                                {link.current_uses}/{link.max_uses || '∞'} usos
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded px-2 py-1.5">
                            <input
                              type="text"
                              readOnly
                              value={`${window.location.origin}/projects/join/${link.share_token}`}
                              className="flex-1 text-xs text-gray-600 bg-transparent border-none focus:outline-none"
                            />
                            <button
                              onClick={() => handleCopyLink(link.share_token, link.id)}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                              title="Copiar link"
                            >
                              {copiedLinkId === link.id ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-600" />
                              )}
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeactivateLink(link.id)}
                          className="ml-2 p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Desactivar link"
                        >
                          <Trash2 className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No hay links activos
                </p>
              )}
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : members.length > 0 ? (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {member.email || 'Usuario'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-600 capitalize">{member.role}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-600">
                            Agregado {formatDate(member.added_at)}
                          </span>
                        </div>
                      </div>
                      {member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Remover miembro"
                        >
                          <Trash2 className="w-4 h-4 text-gray-600" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No hay miembros en este proyecto
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
