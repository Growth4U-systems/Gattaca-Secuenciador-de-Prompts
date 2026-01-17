'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  ChevronLeft,
  FolderOpen,
  Calendar,
  Clock,
  Building2,
  Loader2,
} from 'lucide-react'
import { useDeletedProjects, restoreProject, permanentlyDeleteProject } from '@/hooks/useProjects'
import { useToast, useModal } from '@/components/ui'

const RETENTION_DAYS = 7

function getDaysRemaining(deletedAt: string): number {
  const deleted = new Date(deletedAt)
  const now = new Date()
  const diffMs = now.getTime() - deleted.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, RETENTION_DAYS - diffDays)
}

function formatDeletedDate(deletedAt: string): string {
  return new Date(deletedAt).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TrashPage() {
  const router = useRouter()
  const toast = useToast()
  const modal = useModal()
  const { projects, loading, error, reload } = useDeletedProjects()
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleRestore = async (projectId: string, projectName: string) => {
    setRestoringId(projectId)
    try {
      await restoreProject(projectId)
      toast.success('Restaurado', `El proyecto "${projectName}" ha sido restaurado`)
      reload()
    } catch (err) {
      console.error('Error restoring project:', err)
      toast.error('Error', 'No se pudo restaurar el proyecto')
    } finally {
      setRestoringId(null)
    }
  }

  const handlePermanentDelete = async (projectId: string, projectName: string) => {
    const confirmed = await modal.confirm({
      title: 'Eliminar definitivamente',
      message: `¿Estás seguro de que quieres eliminar permanentemente "${projectName}"? Esta acción NO se puede deshacer y se perderán todos los datos del proyecto.`,
      confirmText: 'Eliminar para siempre',
      cancelText: 'Cancelar',
      variant: 'danger',
    })

    if (!confirmed) return

    setDeletingId(projectId)
    try {
      await permanentlyDeleteProject(projectId)
      toast.success('Eliminado', `El proyecto "${projectName}" ha sido eliminado permanentemente`)
      reload()
    } catch (err) {
      console.error('Error permanently deleting project:', err)
      toast.error('Error', 'No se pudo eliminar el proyecto')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors group mb-4"
          >
            <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Volver a Proyectos
          </Link>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-xl">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Papelera</h1>
              <p className="text-gray-500 mt-0.5">
                Los proyectos eliminados se conservan por {RETENTION_DAYS} días antes de eliminarse definitivamente
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && projects.length === 0 && (
          <div className="text-center py-16">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-gray-200 rounded-full blur-2xl opacity-30 scale-150" />
              <div className="relative p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl">
                <Trash2 size={64} className="text-gray-400" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              La papelera está vacía
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Los proyectos que elimines aparecerán aquí durante {RETENTION_DAYS} días antes de eliminarse definitivamente
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
            >
              <FolderOpen size={18} />
              Ver proyectos
            </Link>
          </div>
        )}

        {/* Projects List */}
        {!loading && !error && projects.length > 0 && (
          <div className="space-y-4">
            {projects.map((project) => {
              const daysRemaining = getDaysRemaining(project.deleted_at)
              const isUrgent = daysRemaining <= 2
              const isRestoring = restoringId === project.id
              const isDeleting = deletingId === project.id

              return (
                <div
                  key={project.id}
                  className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Project Info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="p-3 bg-gray-100 rounded-xl">
                        <FolderOpen className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {project.name}
                        </h3>
                        {project.client?.name && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                            <Building2 size={14} />
                            <span>{project.client.name}</span>
                          </div>
                        )}
                        {project.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                            {project.description}
                          </p>
                        )}

                        {/* Deletion info */}
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Calendar size={12} />
                            <span>Eliminado: {formatDeletedDate(project.deleted_at)}</span>
                          </div>
                          <div className={`flex items-center gap-1.5 text-xs font-medium ${
                            isUrgent ? 'text-red-600' : 'text-amber-600'
                          }`}>
                            <Clock size={12} />
                            <span>
                              {daysRemaining === 0
                                ? 'Se eliminará hoy'
                                : daysRemaining === 1
                                  ? 'Se eliminará mañana'
                                  : `Se eliminará en ${daysRemaining} días`
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleRestore(project.id, project.name)}
                        disabled={isRestoring || isDeleting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRestoring ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <RotateCcw size={16} />
                        )}
                        Restaurar
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(project.id, project.name)}
                        disabled={isRestoring || isDeleting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-xl hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeleting ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Info Notice */}
        {!loading && !error && projects.length > 0 && (
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-800 font-medium">
                Retención de {RETENTION_DAYS} días
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                Los proyectos en la papelera se eliminan automáticamente después de {RETENTION_DAYS} días.
                Restaura los proyectos que quieras conservar antes de que expiren.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
