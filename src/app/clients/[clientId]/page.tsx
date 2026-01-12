'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Building2, Layers, FolderKanban, Plus, Home, ChevronRight,
  Settings, Calendar, Globe, Briefcase, ArrowRight, Loader2,
  Sparkles, MoreVertical, Edit2, Trash2, X, Check
} from 'lucide-react'
import { useClient } from '@/hooks/useClients'
import { useClientProjects, createProject, deleteProject } from '@/hooks/useClientProjects'
import { useAgency } from '@/hooks/useAgency'
import ContextLakeDashboard from '@/components/context-lake/ContextLakeDashboard'
import PlaybooksDashboard from '@/components/playbooks/PlaybooksDashboard'
import type { Project, ProjectInsert } from '@/types/v2.types'

type TabType = 'overview' | 'context-lake' | 'projects' | 'playbooks' | 'settings'

function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
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

function ProjectCard({
  project,
  onDelete
}: {
  project: Project
  onDelete: (p: Project) => void
}) {
  const statusConfig = {
    active: { label: 'Activo', bgClass: 'bg-green-100', textClass: 'text-green-700' },
    paused: { label: 'Pausado', bgClass: 'bg-amber-100', textClass: 'text-amber-700' },
    archived: { label: 'Archivado', bgClass: 'bg-gray-100', textClass: 'text-gray-600' },
    completed: { label: 'Completado', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  }

  const status = statusConfig[project.status] || statusConfig.active

  return (
    <div className="group relative">
      <Link
        href={`/clients/${project.client_id}/projects/${project.id}`}
        className="block p-5 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 transition-all"
      >
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-50 to-purple-100 rounded-lg group-hover:from-indigo-100 group-hover:to-purple-200 transition-colors">
            <FolderKanban className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {project.name}
              </h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${status.bgClass} ${status.textClass}`}>
                {status.label}
              </span>
            </div>
            {project.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{project.description}</p>
            )}
            {project.project_type && (
              <p className="text-xs text-gray-400 mt-2">{project.project_type}</p>
            )}
          </div>
          <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDelete(project)
        }}
        className="absolute top-3 right-3 p-1.5 bg-white/80 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
        title="Eliminar proyecto"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function CreateProjectForm({
  clientId,
  onCreated,
  onCancel,
}: {
  clientId: string
  onCreated: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      setSaving(true)
      await createProject({
        client_id: clientId,
        name: name.trim(),
        description: description.trim() || null,
        status: 'active',
        project_type: null,
        start_date: null,
        end_date: null,
        goals: [],
        settings: {},
        legacy_flow_config: null,
        legacy_variable_definitions: null,
        legacy_prompts: null,
      })
      onCreated()
    } catch (err) {
      console.error('Error creating project:', err)
      alert('Error al crear proyecto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del proyecto"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          autoFocus
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción (opcional)"
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Crear
          </button>
        </div>
      </div>
    </form>
  )
}

export default function ClientDetailPage({
  params,
}: {
  params: { clientId: string }
}) {
  const { client, loading: clientLoading, error: clientError } = useClient(params.clientId)
  const { projects, loading: projectsLoading, reload: reloadProjects } = useClientProjects(params.clientId)
  const { agency } = useAgency()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [showCreateProject, setShowCreateProject] = useState(false)

  const tabs = [
    { id: 'overview' as TabType, label: 'Resumen', icon: Building2 },
    { id: 'context-lake' as TabType, label: 'Context Lake', icon: Layers },
    { id: 'projects' as TabType, label: 'Proyectos', icon: FolderKanban },
    { id: 'playbooks' as TabType, label: 'Playbooks', icon: Sparkles },
    { id: 'settings' as TabType, label: 'Configuración', icon: Settings },
  ]

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`¿Eliminar el proyecto "${project.name}"?`)) return
    try {
      await deleteProject(project.id)
      reloadProjects()
    } catch (err) {
      console.error('Error deleting project:', err)
      alert('Error al eliminar proyecto')
    }
  }

  if (clientLoading) {
    return <LoadingSkeleton />
  }

  if (clientError || !client) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-red-900 mb-2">Error al cargar el cliente</h2>
            <p className="text-red-700 mb-6">{clientError || 'Cliente no encontrado'}</p>
            <Link
              href="/clients"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Home size={18} />
              Volver a Clientes
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
            <span className="text-gray-900 font-medium truncate max-w-[200px]" title={client.name}>
              {client.name}
            </span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Client Header Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 px-6 py-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 backdrop-blur rounded-xl">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{client.name}</h1>
                  {client.description && (
                    <p className="text-indigo-100 mt-1">{client.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-4 mt-4">
              {client.industry && (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  <Briefcase className="w-4 h-4 text-indigo-200" />
                  <span className="text-sm text-white">{client.industry}</span>
                </div>
              )}
              {client.website_url && (
                <a
                  href={client.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 hover:bg-white/20 transition-colors"
                >
                  <Globe className="w-4 h-4 text-indigo-200" />
                  <span className="text-sm text-white">Sitio web</span>
                </a>
              )}
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <FolderKanban className="w-4 h-4 text-indigo-200" />
                <span className="text-sm text-white">{projects.length} proyectos</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <Calendar className="w-4 h-4 text-indigo-200" />
                <span className="text-sm text-white">
                  {new Date(client.created_at).toLocaleDateString('es-ES', {
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
                      ${isActive ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}
                    `}
                  >
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                      <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-gray-500'} />
                    </div>
                    <span>{tab.label}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    onClick={() => setActiveTab('context-lake')}
                    className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl hover:shadow-md transition-all text-left"
                  >
                    <Layers className="w-6 h-6 text-amber-600 mb-2" />
                    <p className="font-medium text-gray-900">Context Lake</p>
                    <p className="text-xs text-gray-500 mt-1">Documentos fundacionales</p>
                  </button>
                  <button
                    onClick={() => setActiveTab('projects')}
                    className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl hover:shadow-md transition-all text-left"
                  >
                    <FolderKanban className="w-6 h-6 text-indigo-600 mb-2" />
                    <p className="font-medium text-gray-900">Proyectos</p>
                    <p className="text-xs text-gray-500 mt-1">{projects.length} activos</p>
                  </button>
                  <button
                    onClick={() => setActiveTab('playbooks')}
                    className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-xl hover:shadow-md transition-all text-left"
                  >
                    <Sparkles className="w-6 h-6 text-purple-600 mb-2" />
                    <p className="font-medium text-gray-900">Playbooks</p>
                    <p className="text-xs text-gray-500 mt-1">Procesos IA</p>
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="p-4 bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-100 rounded-xl hover:shadow-md transition-all text-left"
                  >
                    <Settings className="w-6 h-6 text-gray-600 mb-2" />
                    <p className="font-medium text-gray-900">Configuración</p>
                    <p className="text-xs text-gray-500 mt-1">Ajustes del cliente</p>
                  </button>
                </div>

                {/* Recent Projects */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Proyectos Recientes</h3>
                    <button
                      onClick={() => setActiveTab('projects')}
                      className="text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      Ver todos
                    </button>
                  </div>
                  {projectsLoading ? (
                    <div className="h-32 bg-gray-50 rounded-xl animate-pulse" />
                  ) : projects.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl">
                      <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">No hay proyectos aún</p>
                      <button
                        onClick={() => {
                          setActiveTab('projects')
                          setShowCreateProject(true)
                        }}
                        className="mt-3 text-sm text-indigo-600 hover:text-indigo-700"
                      >
                        Crear primer proyecto
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {projects.slice(0, 4).map((project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          onDelete={handleDeleteProject}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'context-lake' && (
              <ContextLakeDashboard clientId={params.clientId} />
            )}

            {activeTab === 'projects' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Proyectos del Cliente</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Todos los proyectos comparten el mismo Context Lake
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateProject(!showCreateProject)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Nuevo Proyecto
                  </button>
                </div>

                {showCreateProject && (
                  <CreateProjectForm
                    clientId={params.clientId}
                    onCreated={() => {
                      reloadProjects()
                      setShowCreateProject(false)
                    }}
                    onCancel={() => setShowCreateProject(false)}
                  />
                )}

                {projectsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 bg-gray-50 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="font-medium text-gray-900">No hay proyectos</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Crea el primer proyecto para este cliente
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {projects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onDelete={handleDeleteProject}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'playbooks' && agency && (
              <PlaybooksDashboard
                agencyId={agency.id}
                clientId={params.clientId}
                onNavigateToContextLake={() => setActiveTab('context-lake')}
              />
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="p-6 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold text-gray-900 mb-4">Información del Cliente</h3>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-500">Nombre</dt>
                      <dd className="font-medium text-gray-900">{client.name}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Estado</dt>
                      <dd className="font-medium text-gray-900 capitalize">{client.status}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Industria</dt>
                      <dd className="font-medium text-gray-900">{client.industry || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Sitio web</dt>
                      <dd className="font-medium text-gray-900">{client.website_url || '-'}</dd>
                    </div>
                  </dl>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800">
                    La edición de configuración del cliente estará disponible próximamente.
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
