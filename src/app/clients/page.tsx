'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Building2, FolderOpen, ChevronRight, Search, Loader2 } from 'lucide-react'
import { useClients, type Client } from '@/hooks/useClients'
import { useToast, useModal } from '@/components/ui'

export default function ClientsPage() {
  const toast = useToast()
  const modal = useModal()
  // No pasamos agency_id - el hook cargará todos los clientes accesibles según RLS
  const { clients, loading, error, refetch, createClient } = useClients()
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientIndustry, setNewClientIndustry] = useState('')
  const [creating, setCreating] = useState(false)

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      toast.warning('Nombre requerido', 'Ingresa un nombre para el cliente')
      return
    }

    setCreating(true)
    try {
      // El hook createClient ya obtiene la agencia del usuario automáticamente
      await createClient(newClientName.trim())
      toast.success('Cliente creado', `${newClientName} ha sido creado exitosamente`)
      setNewClientName('')
      setNewClientIndustry('')
      setShowNewClientModal(false)
      // refetch no es necesario, el hook lo hace internamente
    } catch (err) {
      console.error('Error creating client:', err)
      toast.error('Error', err instanceof Error ? err.message : 'Error al crear cliente')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-gray-200 rounded" />
            <div className="h-4 w-72 bg-gray-100 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-40 bg-gray-100 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
            <p className="text-gray-500 mt-1">Gestiona tus clientes y sus proyectos</p>
          </div>
          <button
            onClick={() => setShowNewClientModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm font-medium"
          >
            <Plus size={18} />
            Nuevo Cliente
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar clientes..."
              className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Client Grid */}
        {filteredClients.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-block p-4 bg-gray-100 rounded-2xl mb-4">
              <Building2 className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {searchQuery ? 'No se encontraron clientes' : 'No hay clientes'}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchQuery ? 'Prueba con otros términos de búsqueda' : 'Crea tu primer cliente para empezar'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowNewClientModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
                Crear Cliente
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="group bg-white rounded-2xl border border-gray-100 p-6 hover:border-blue-200 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <ChevronRight size={20} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                </div>
                <h3 className="font-semibold text-gray-900 text-lg mb-1 group-hover:text-blue-600 transition-colors">
                  {client.name}
                </h3>
                {client.industry && (
                  <p className="text-sm text-gray-500 mb-3">{client.industry}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <FolderOpen size={14} />
                    Proyectos
                  </span>
                  <span className={`px-2 py-0.5 rounded-full ${
                    client.status === 'active' ? 'bg-green-50 text-green-600' :
                    client.status === 'inactive' ? 'bg-gray-100 text-gray-500' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    {client.status === 'active' ? 'Activo' :
                     client.status === 'inactive' ? 'Inactivo' : 'Archivado'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New Client Modal */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Nuevo Cliente</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del cliente *
                </label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ej: Acme Corp"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industria
                </label>
                <input
                  type="text"
                  value={newClientIndustry}
                  onChange={(e) => setNewClientIndustry(e.target.value)}
                  placeholder="Ej: SaaS, E-commerce, Fintech..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewClientModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateClient}
                disabled={creating || !newClientName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {creating && <Loader2 size={16} className="animate-spin" />}
                Crear Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
