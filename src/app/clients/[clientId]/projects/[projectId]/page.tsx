'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FolderKanban, Building2, Layers, Workflow, Rocket, Settings,
  Home, ChevronRight, Calendar, Play, Edit2, Trash2, MoreVertical,
  X, Check, Loader2, BookOpen
} from 'lucide-react'
import { useProject, updateProjectById, deleteProject } from '@/hooks/useClientProjects'
import { useClient } from '@/hooks/useClients'
import { useAgency } from '@/hooks/useAgency'
import ContextLakeDashboard from '@/components/context-lake/ContextLakeDashboard'
import PlaybooksDashboard from '@/components/playbooks/PlaybooksDashboard'

type TabType = 'playbooks' | 'context-lake' | 'executions' | 'settings'

function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-96 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    </main>
  )
}

export default function ProjectPage({
  params,
}: {
  params: { clientId: string; projectId: string }
}) {
  const { project, clientId, loading: projectLoading, error: projectError, reload: reloadProject } = useProject(params.projectId)
  const { client, loading: clientLoading } = useClient(params.clientId)
  const { agency } = useAgency()
  const [activeTab, setActiveTab] = useState<TabType>('playbooks')
  const [editingName, setEditingName] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const tabs = [
    { id: 'playbooks' as TabType, label: 'Playbooks', icon: BookOpen, description: 'Ejecutar playbooks' },
    { id: 'context-lake' as TabType, label: 'Context Lake', icon: Layers, description: 'Documentos del cliente' },
    { id: 'executions' as TabType, label: 'Ejecuciones', icon: Rocket, description: 'Historial' },
    { id: 'settings' as TabType, label: 'Configuración', icon: Settings, description: 'Ajustes' },
  ]

  const loading = projectLoading || clientLoading

  const handleEditName = () => {
    setProjectName(project?.name || '')
    setEditingName(true)
  }

  const handleSaveName = async () => {
    if (!projectName.trim() || !project) return

    try {
      setSavingName(true)
      await updateProjectById(project.id, { name: projectName.trim() })
      setEditingName(false)
      reloadProject()
    } catch (err) {
      console.error('Error updating project name:', err)
      alert('Error al guardar el nombre')
    } finally {
      setSavingName(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!project) return
    if (!confirm(`¿Eliminar el proyecto "${project.name}"? Esta acción no se puede deshacer.`)) return

    try {
      await deleteProject(project.id)
      window.location.href = `/clients/${params.clientId}`
    } catch (err) {
      console.error('Error deleting project:', err)
      alert('Error al eliminar el proyecto')
    }
  }

  if (loading) {
    return <LoadingSkeleton />
  }

  if (projectError || !project) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-red-900 mb-2">Error al cargar el proyecto</h2>
            <p className="text-red-700 mb-6">{projectError || 'Proyecto no encontrado'}</p>
            <Link
              href={`/clients/${params.clientId}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Building2 size={18} />
              Volver al Cliente
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 py-3 text-sm" aria-label="Breadcrumb">
            <Link
              href="/clients"
              className="inline-flex items-center gap-1.5 text-gray-500 hover:text-indigo-600 transition-colors"
            >
              <Building2 size={14} />
              <span>Clientes</span>
            </Link>
            <ChevronRight size={14} className="text-gray-300" />
            <Link
              href={`/clients/${params.clientId}`}
              className="text-gray-500 hover:text-indigo-600 transition-colors truncate max-w-[150px]"
              title={client?.name}
            >
              {client?.name || 'Cliente'}
            </Link>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="text-gray-900 font-medium truncate max-w-[150px]" title={project.name}>
              {project.name}
            </span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Project Header Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-purple-600 via-indigo-700 to-blue-800 px-6 py-5">
            <div className="flex items-start justify-between">
              {editingName ? (
                <div className="flex items-center gap-3 flex-1">
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="flex-1 text-xl font-bold text-gray-900 bg-white border-2 border-purple-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName()
                      if (e.key === 'Escape') setEditingName(false)
                    }}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300"
                  >
                    {savingName ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    disabled={savingName}
                    className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30"
                  >
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 backdrop-blur rounded-xl">
                      <FolderKanban className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-white">{project.name}</h1>
                      {project.description && (
                        <p className="text-purple-100 mt-1">{project.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <MoreVertical size={20} />
                    </button>
                    {showMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20">
                          <button
                            onClick={() => {
                              setShowMenu(false)
                              handleEditName()
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
                          >
                            <Edit2 size={16} />
                            Editar nombre
                          </button>
                          <button
                            onClick={() => {
                              setShowMenu(false)
                              handleDeleteProject()
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 inline-flex items-center gap-2"
                          >
                            <Trash2 size={16} />
                            Eliminar proyecto
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-4 mt-4">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <Building2 className="w-4 h-4 text-purple-200" />
                <span className="text-sm text-white">{client?.name}</span>
              </div>
              {project.project_type && (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  <Workflow className="w-4 h-4 text-purple-200" />
                  <span className="text-sm text-white">{project.project_type}</span>
                </div>
              )}
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <Calendar className="w-4 h-4 text-purple-200" />
                <span className="text-sm text-white">
                  {new Date(project.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-gray-100">
            <nav className="flex -mb-px overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      relative flex-shrink-0 flex items-center gap-2.5 px-6 py-4 text-sm font-medium transition-all
                      ${isActive ? 'text-purple-600' : 'text-gray-500 hover:text-gray-700'}
                    `}
                  >
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-purple-100' : 'bg-gray-100'}`}>
                      <Icon size={16} className={isActive ? 'text-purple-600' : 'text-gray-500'} />
                    </div>
                    <span>{tab.label}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'playbooks' && agency && (
              <PlaybooksDashboard
                agencyId={agency.id}
                clientId={params.clientId}
              />
            )}

            {activeTab === 'context-lake' && (
              <div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>Nota:</strong> El Context Lake es compartido a nivel de cliente.
                    Todos los proyectos de "{client?.name}" acceden a los mismos documentos.
                  </p>
                </div>
                <ContextLakeDashboard clientId={params.clientId} />
              </div>
            )}

            {activeTab === 'executions' && (
              <div className="text-center py-12">
                <Rocket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-medium text-gray-900">Historial de Ejecuciones</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Aquí verás el historial de playbooks ejecutados en este proyecto.
                </p>
                <p className="text-xs text-gray-400 mt-4">
                  Ejecuta un playbook desde la pestaña Playbooks para comenzar.
                </p>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="p-6 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold text-gray-900 mb-4">Información del Proyecto</h3>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-500">Nombre</dt>
                      <dd className="font-medium text-gray-900">{project.name}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Estado</dt>
                      <dd className="font-medium text-gray-900 capitalize">{project.status}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Cliente</dt>
                      <dd className="font-medium text-gray-900">{client?.name}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Tipo</dt>
                      <dd className="font-medium text-gray-900">{project.project_type || '-'}</dd>
                    </div>
                  </dl>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800">
                    La edición avanzada de configuración estará disponible próximamente.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
