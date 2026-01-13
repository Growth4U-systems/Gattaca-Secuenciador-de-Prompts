'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, FolderOpen, Calendar, Search, Layers, Sparkles, ArrowRight, LayoutGrid, List, Trash2, RotateCcw, X, AlertTriangle } from 'lucide-react'
import { useProjects, useDeletedProjects, restoreProject, permanentlyDeleteProject } from '@/hooks/useProjects'
import { useToast } from '@/components/ui'

function ProjectCardSkeleton() {
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
  const { projects, loading, error, reload } = useProjects()
  const { projects: deletedProjects, loading: loadingDeleted, reload: reloadDeleted } = useDeletedProjects()
  const toast = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showDeletedModal, setShowDeletedModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects
    const query = searchQuery.toLowerCase()
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query) ||
        project.client?.name?.toLowerCase().includes(query)
    )
  }, [projects, searchQuery])

  const stats = useMemo(() => ({
    total: projects.length,
    thisMonth: projects.filter((p) => {
      const created = new Date(p.created_at)
      const now = new Date()
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
    }).length,
  }), [projects])

  const handleRestore = async (projectId: string) => {
    setProcessingId(projectId)
    try {
      await restoreProject(projectId)
      toast.success('Proyecto restaurado', 'El proyecto ha sido restaurado exitosamente')
      reloadDeleted()
      reload()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'No se pudo restaurar el proyecto')
    } finally {
      setProcessingId(null)
    }
  }

  const handlePermanentDelete = async (projectId: string) => {
    setProcessingId(projectId)
    try {
      await permanentlyDeleteProject(projectId)
      toast.success('Proyecto eliminado', 'El proyecto ha sido eliminado permanentemente')
      setConfirmDelete(null)
      reloadDeleted()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'No se pudo eliminar el proyecto')
    } finally {
      setProcessingId(null)
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

            <Link
              href="/projects/new"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-all shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30"
            >
              <Plus size={20} />
              Nuevo Proyecto
              <ArrowRight size={16} className="opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
            </Link>
          </div>

          {/* Stats */}
          {!loading && !error && projects.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-6">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                <Layers className="w-5 h-5 text-blue-200" />
                <div>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                  <p className="text-xs text-blue-200">Proyectos totales</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                <Calendar className="w-5 h-5 text-blue-200" />
                <div>
                  <p className="text-2xl font-bold text-white">{stats.thisMonth}</p>
                  <p className="text-xs text-blue-200">Este mes</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        {!loading && !error && projects.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar proyectos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-gray-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === 'grid'
                      ? 'bg-blue-100 text-blue-700'
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
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title="Vista en lista"
                >
                  <List size={20} />
                </button>
              </div>
              {deletedProjects.length > 0 && (
                <button
                  onClick={() => setShowDeletedModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Ver proyectos eliminados"
                >
                  <Trash2 size={18} />
                  <span className="text-sm font-medium">{deletedProjects.length}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-red-900 text-lg">Error al cargar proyectos</h3>
                <p className="text-red-700 mt-1">{error}</p>
                <p className="text-sm text-red-600 mt-3 bg-red-100/50 rounded-lg px-3 py-2 font-mono">
                  supabase start
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && projects.length === 0 && (
          <div className="text-center py-16">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-blue-200 rounded-full blur-2xl opacity-30 scale-150" />
              <div className="relative p-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl">
                <FolderOpen size={64} className="text-blue-600" />
              </div>
            </div>
            <h3 className="mt-6 text-2xl font-bold text-gray-900">
              Comienza tu primer proyecto
            </h3>
            <p className="mt-2 text-gray-600 max-w-md mx-auto">
              Crea tu primer proyecto para empezar a generar estrategias de marketing automatizadas con IA
            </p>
            <Link
              href="/projects/new"
              className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
            >
              <Plus size={20} />
              Crear Primer Proyecto
            </Link>
          </div>
        )}

        {/* No Results State */}
        {!loading && !error && projects.length > 0 && filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <Search size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              No se encontraron proyectos
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

        {/* Projects Grid */}
        {!loading && !error && filteredProjects.length > 0 && (
          <div
            className={
              viewMode === 'grid'
                ? 'grid gap-6 md:grid-cols-2 lg:grid-cols-3'
                : 'flex flex-col gap-4'
            }
          >
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className={`group bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-300 ${
                  viewMode === 'grid' ? 'p-6' : 'p-5 flex items-center gap-6'
                }`}
              >
                <div
                  className={`flex ${
                    viewMode === 'grid' ? 'items-start gap-4' : 'items-center gap-4 flex-1 min-w-0'
                  }`}
                >
                  <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl group-hover:from-blue-100 group-hover:to-indigo-200 transition-colors">
                    <FolderOpen className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                      {project.name}
                    </h3>
                    {project.client?.name && (
                      <p className="text-xs text-blue-600 font-medium mt-0.5">
                        {project.client.name}
                      </p>
                    )}
                    {project.description && (
                      <p
                        className={`text-sm text-gray-500 mt-1 ${
                          viewMode === 'grid' ? 'line-clamp-2' : 'truncate'
                        }`}
                      >
                        {project.description}
                      </p>
                    )}
                  </div>
                </div>
                <div
                  className={`flex items-center gap-2 text-xs text-gray-400 ${
                    viewMode === 'grid' ? 'mt-4 pt-4 border-t border-gray-50' : ''
                  }`}
                >
                  <Calendar size={14} />
                  <span>
                    {new Date(project.created_at).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                {viewMode === 'list' && (
                  <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Deleted Projects Modal */}
      {showDeletedModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-xl">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Proyectos Eliminados</h2>
                  <p className="text-sm text-gray-500">{deletedProjects.length} proyecto(s) en papelera</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDeletedModal(false)
                  setConfirmDelete(null)
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {loadingDeleted ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : deletedProjects.length === 0 ? (
                <div className="text-center py-8">
                  <Trash2 size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600">No hay proyectos eliminados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deletedProjects.map((project) => (
                    <div
                      key={project.id}
                      className="p-4 bg-gray-50 rounded-xl border border-gray-100"
                    >
                      {confirmDelete === project.id ? (
                        // Confirmation view
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-red-100 rounded-lg">
                              <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                ¿Eliminar permanentemente?
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                Esta acción no se puede deshacer. Se eliminarán todos los datos asociados a <span className="font-medium">&quot;{project.name}&quot;</span>.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setConfirmDelete(null)}
                              disabled={processingId === project.id}
                              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(project.id)}
                              disabled={processingId === project.id}
                              className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              {processingId === project.id ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Eliminando...
                                </>
                              ) : (
                                'Eliminar definitivamente'
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Normal view
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-gray-200 rounded-lg">
                              <FolderOpen className="w-5 h-5 text-gray-500" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-medium text-gray-900 truncate">
                                {project.name}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {project.client?.name && (
                                  <span className="text-blue-600">{project.client.name}</span>
                                )}
                                {project.deleted_at && (
                                  <span>
                                    Eliminado {new Date(project.deleted_at).toLocaleDateString('es-ES', {
                                      day: 'numeric',
                                      month: 'short'
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRestore(project.id)}
                              disabled={processingId === project.id}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {processingId === project.id ? (
                                <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                              ) : (
                                <>
                                  <RotateCcw size={16} />
                                  Restaurar
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(project.id)}
                              disabled={processingId === project.id}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Trash2 size={16} />
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
