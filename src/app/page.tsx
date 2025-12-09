'use client'

import Link from 'next/link'
import { Plus, FolderOpen, Calendar } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'

export default function HomePage() {
  const { projects, loading, error } = useProjects()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gattaca (secuenciador de prompts)</h1>
            <p className="mt-2 text-gray-600">
              Sistema automatizado para generar estrategias de marketing
            </p>
          </div>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Nuevo Proyecto
          </Link>
        </div>

        {/* Projects List */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            <p>Cargando proyectos...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">Error al cargar proyectos: {error}</p>
            <p className="text-sm text-red-600 mt-2">
              Asegúrate de que Supabase esté corriendo: <code>supabase start</code>
            </p>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FolderOpen size={64} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay proyectos todavía
            </h3>
            <p className="text-gray-600 mb-6">
              Crea tu primer proyecto para empezar a generar estrategias
            </p>
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={18} />
              Crear Primer Proyecto
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <FolderOpen
                    size={24}
                    className="text-blue-600 group-hover:text-blue-700"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar size={14} />
                  {new Date(project.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
