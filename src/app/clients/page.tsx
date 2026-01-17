'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Plus,
  FolderOpen,
  Search,
  Sparkles,
  ArrowRight,
  Building2,
  ChevronRight,
  Zap,
  Target,
  X,
  Trash2,
  Pencil,
  Users,
} from 'lucide-react'
import type { Client } from '@/hooks/useClients'
import { useClients } from '@/hooks/useClients'
import { useProjects, useDeletedProjects } from '@/hooks/useProjects'

// Playbook type icons and colors
const PlaybookIcon: Record<string, typeof Zap> = {
  ecp: Zap,
  competitor_analysis: Target,
  niche_finder: Search,
  signal_based_outreach: Users,
}

const PlaybookColor: Record<string, string> = {
  ecp: 'bg-yellow-100 text-yellow-700',
  competitor_analysis: 'bg-purple-100 text-purple-700',
  niche_finder: 'bg-green-100 text-green-700',
  signal_based_outreach: 'bg-blue-100 text-blue-700',
}

function ClientCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gray-200 rounded-xl" />
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-50 flex gap-2">
        <div className="h-6 bg-gray-100 rounded w-16" />
        <div className="h-6 bg-gray-100 rounded w-16" />
      </div>
    </div>
  )
}

export default function ClientsPage() {
  const { clients, loading: loadingClients, error: errorClients, createClient, updateClient, deleteClient } = useClients()
  const { projects, loading: loadingProjects } = useProjects()
  const { projects: deletedProjects } = useDeletedProjects()
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [creatingClient, setCreatingClient] = useState(false)
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null)
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null)
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null)
  const [editForm, setEditForm] = useState({ name: '', industry: '', description: '' })
  const [updatingClient, setUpdatingClient] = useState(false)

  const loading = loadingClients || loadingProjects
  const error = errorClients

  // Group projects by client_id
  const projectsByClient = useMemo(() => {
    const grouped: Record<string, typeof projects> = {}
    for (const project of projects) {
      const clientId = project.client_id || 'no-client'
      if (!grouped[clientId]) {
        grouped[clientId] = []
      }
      grouped[clientId].push(project)
    }
    return grouped
  }, [projects])

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients
    const query = searchQuery.toLowerCase()
    return clients.filter((client) => client.name.toLowerCase().includes(query))
  }, [clients, searchQuery])

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return
    setCreatingClient(true)
    try {
      await createClient(newClientName.trim())
      setNewClientName('')
      setShowNewClientModal(false)
    } catch (err) {
      console.error('Error creating client:', err)
    } finally {
      setCreatingClient(false)
    }
  }

  const handleDeleteClient = async () => {
    if (!clientToDelete) return
    setDeletingClientId(clientToDelete.id)
    try {
      await deleteClient(clientToDelete.id)
      setClientToDelete(null)
    } catch (err) {
      console.error('Error deleting client:', err)
    } finally {
      setDeletingClientId(null)
    }
  }

  const handleEditClient = (client: Client) => {
    setClientToEdit(client)
    setEditForm({
      name: client.name,
      industry: client.industry || '',
      description: client.description || '',
    })
  }

  const handleUpdateClient = async () => {
    if (!clientToEdit || !editForm.name.trim()) return
    setUpdatingClient(true)
    try {
      await updateClient(clientToEdit.id, {
        name: editForm.name.trim(),
        industry: editForm.industry.trim() || null,
        description: editForm.description.trim() || null,
      })
      setClientToEdit(null)
    } catch (err) {
      console.error('Error updating client:', err)
    } finally {
      setUpdatingClient(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/10 backdrop-blur rounded-xl">
                  <Sparkles className="w-6 h-6 text-blue-200" />
                </div>
                <span className="text-blue-200 text-sm font-medium tracking-wide uppercase">
                  Secuenciador de Prompts
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
                Gattaca
              </h1>
              <p className="mt-3 text-blue-100 text-lg max-w-xl">
                Sistema automatizado para generar estrategias de marketing con IA
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Trash Link */}
              <Link
                href="/trash"
                className="relative p-3 bg-white/10 backdrop-blur rounded-xl hover:bg-white/20 transition-colors"
                title="Papelera"
              >
                <Trash2 size={20} className="text-white" />
                {deletedProjects.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center px-1.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {deletedProjects.length}
                  </span>
                )}
              </Link>

              <button
                onClick={() => setShowNewClientModal(true)}
                className="group inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-all shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30"
              >
                <Plus size={20} />
                Nuevo Cliente
                <ArrowRight
                  size={16}
                  className="opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all"
                />
              </button>
            </div>
          </div>

          {/* Stats */}
          {!loading && !error && clients.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-6">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                <Building2 className="w-5 h-5 text-blue-200" />
                <div>
                  <p className="text-2xl font-bold text-white">{clients.length}</p>
                  <p className="text-xs text-blue-200">Clientes</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                <FolderOpen className="w-5 h-5 text-blue-200" />
                <div>
                  <p className="text-2xl font-bold text-white">{projects.length}</p>
                  <p className="text-xs text-blue-200">Proyectos totales</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        {!loading && !error && clients.length > 0 && (
          <div className="mb-8">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar clientes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-gray-400"
              />
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ClientCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-red-900 text-lg">Error al cargar</h3>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && clients.length === 0 && (
          <div className="text-center py-16">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-blue-200 rounded-full blur-2xl opacity-30 scale-150" />
              <div className="relative p-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl">
                <Building2 size={64} className="text-blue-600" />
              </div>
            </div>
            <h3 className="mt-6 text-2xl font-bold text-gray-900">
              Comienza agregando un cliente
            </h3>
            <p className="mt-2 text-gray-600 max-w-md mx-auto">
              Los clientes te permiten organizar tus proyectos y compartir documentos entre ellos
            </p>
            <button
              onClick={() => setShowNewClientModal(true)}
              className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
            >
              <Plus size={20} />
              Crear Primer Cliente
            </button>
          </div>
        )}

        {/* No Results State */}
        {!loading &&
          !error &&
          clients.length > 0 &&
          filteredClients.length === 0 && (
            <div className="text-center py-12">
              <Search size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                No se encontraron clientes
              </h3>
              <p className="text-gray-600 mt-1">
                No hay resultados para &quot;{searchQuery}&quot;
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Limpiar búsqueda
              </button>
            </div>
          )}

        {/* Clients Grid */}
        {!loading && !error && filteredClients.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredClients.map((client) => {
              const clientProjects = projectsByClient[client.id] || []
              const projectTypes = clientProjects.reduce(
                (acc, p) => {
                  const pType = p.playbook_type || 'other'
                  acc[pType] = (acc[pType] || 0) + 1
                  return acc
                },
                {} as Record<string, number>
              )

              return (
                <div
                  key={client.id}
                  className="group bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-300 p-6"
                >
                  <Link href={`/clients/${client.id}`} className="block">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl group-hover:from-blue-100 group-hover:to-indigo-200 transition-colors">
                        <Building2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                            {client.name}
                          </h3>
                          <ChevronRight
                            size={18}
                            className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0"
                          />
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {clientProjects.length}{' '}
                          {clientProjects.length === 1 ? 'proyecto' : 'proyectos'}
                        </p>
                      </div>
                    </div>

                    {/* Project Types Preview */}
                    {clientProjects.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-2">
                        {(Object.entries(projectTypes) as [string, number][]).map(([type, count]) => {
                          const Icon = PlaybookIcon[type] || FolderOpen
                          const colorClass = PlaybookColor[type] || 'bg-gray-100 text-gray-600'
                          return (
                            <span
                              key={type}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${colorClass}`}
                            >
                              <Icon size={12} />
                              {count}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {/* Empty state for client without projects */}
                    {clientProjects.length === 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-50">
                        <p className="text-xs text-gray-400 italic">Sin proyectos aún</p>
                      </div>
                    )}
                  </Link>

                  {/* Action buttons - footer */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleEditClient(client)
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Pencil size={14} />
                      Editar
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setClientToDelete({ id: client.id, name: client.name })
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* New Client Modal */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Nuevo Cliente</h2>
              <button
                onClick={() => setShowNewClientModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del cliente
              </label>
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Ej: Acme Corp"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateClient()
                }}
              />
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => setShowNewClientModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateClient}
                  disabled={!newClientName.trim() || creatingClient}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {creatingClient ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creando...
                    </>
                  ) : (
                    'Crear Cliente'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Eliminar Cliente</h2>
              <button
                onClick={() => setClientToDelete(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-100 rounded-xl">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-gray-900 font-medium">
                    ¿Eliminar &quot;{clientToDelete.name}&quot;?
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Se eliminarán todos los proyectos y documentos asociados.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => setClientToDelete(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteClient}
                  disabled={deletingClientId === clientToDelete.id}
                  className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deletingClientId === clientToDelete.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    'Eliminar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {clientToEdit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Editar Cliente</h2>
              <button
                onClick={() => setClientToEdit(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del cliente *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Ej: Acme Corp"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industria
                </label>
                <input
                  type="text"
                  value={editForm.industry}
                  onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                  placeholder="Ej: Tecnología, Retail, Finanzas..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Breve descripción del cliente..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="pt-2 flex gap-3 justify-end">
                <button
                  onClick={() => setClientToEdit(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateClient}
                  disabled={!editForm.name.trim() || updatingClient}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {updatingClient ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Cambios'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
