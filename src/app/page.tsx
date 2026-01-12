'use client'

import { useState, useMemo } from 'react'
import { Plus, Building2, Calendar, Search, Layers, Sparkles, ArrowRight, LayoutGrid, List, Users, FolderKanban } from 'lucide-react'
import { useClients, deleteClient } from '@/hooks/useClients'
import { useAgency } from '@/hooks/useAgency'
import ClientCard from '@/components/clients/ClientCard'
import CreateClientModal from '@/components/clients/CreateClientModal'
import type { Client } from '@/types/v2.types'

function ClientCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gray-200 rounded-xl" />
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-full mb-1" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-50">
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
    </div>
  )
}

export default function HomePage() {
  const { agency, loading: agencyLoading } = useAgency()
  const { clients, loading: clientsLoading, error, reload } = useClients(agency?.id)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loading = agencyLoading || clientsLoading

  const handleDeleteClient = async (client: Client) => {
    if (!confirm(`¿Eliminar "${client.name}"? Esta acción eliminará todos los proyectos y documentos del cliente.`)) {
      return
    }
    try {
      await deleteClient(client.id)
      reload()
    } catch (err) {
      console.error('Error deleting client:', err)
      alert('Error al eliminar el cliente')
    }
  }

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients
    const query = searchQuery.toLowerCase()
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.description?.toLowerCase().includes(query) ||
        client.industry?.toLowerCase().includes(query)
    )
  }, [clients, searchQuery])

  const stats = useMemo(
    () => ({
      total: clients.length,
      active: clients.filter((c) => c.status === 'active').length,
    }),
    [clients]
  )

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/10 backdrop-blur rounded-xl">
                  <Sparkles className="w-6 h-6 text-indigo-200" />
                </div>
                <span className="text-indigo-200 text-sm font-medium tracking-wide uppercase">
                  {agency?.name || 'Gattaca'}
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
                Clientes
              </h1>
              <p className="mt-3 text-indigo-100 text-lg max-w-xl">
                Gestiona los clientes de tu agencia, su Context Lake y proyectos
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="group inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-700 font-semibold rounded-xl hover:bg-indigo-50 transition-all shadow-lg shadow-indigo-900/20 hover:shadow-xl hover:shadow-indigo-900/30"
            >
              <Plus size={20} />
              Nuevo Cliente
              <ArrowRight
                size={16}
                className="opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all"
              />
            </button>
          </div>

          {/* Stats */}
          {!loading && !error && clients.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-6">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                <Building2 className="w-5 h-5 text-indigo-200" />
                <div>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                  <p className="text-xs text-indigo-200">Clientes totales</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                <Users className="w-5 h-5 text-indigo-200" />
                <div>
                  <p className="text-2xl font-bold text-white">{stats.active}</p>
                  <p className="text-xs text-indigo-200">Activos</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        {!loading && !error && clients.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar clientes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-gray-400"
              />
            </div>
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title="Vista en cuadrícula"
              >
                <LayoutGrid size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title="Vista en lista"
              >
                <List size={20} />
              </button>
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
                <h3 className="font-semibold text-red-900 text-lg">
                  Error al cargar clientes
                </h3>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && clients.length === 0 && (
          <div className="text-center py-16">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-indigo-200 rounded-full blur-2xl opacity-30 scale-150" />
              <div className="relative p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl">
                <Building2 size={64} className="text-indigo-600" />
              </div>
            </div>
            <h3 className="mt-6 text-2xl font-bold text-gray-900">
              Agrega tu primer cliente
            </h3>
            <p className="mt-2 text-gray-600 max-w-md mx-auto">
              Los clientes son el centro de tu trabajo. Cada cliente tiene su propio
              Context Lake y proyectos.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/25"
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
                className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Limpiar búsqueda
              </button>
            </div>
          )}

        {/* Clients Grid */}
        {!loading && !error && filteredClients.length > 0 && (
          <div
            className={
              viewMode === 'grid'
                ? 'grid gap-6 md:grid-cols-2 lg:grid-cols-3'
                : 'flex flex-col gap-4'
            }
          >
            {filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                viewMode={viewMode}
                onDelete={handleDeleteClient}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {agency && (
        <CreateClientModal
          agencyId={agency.id}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={reload}
        />
      )}
    </main>
  )
}
