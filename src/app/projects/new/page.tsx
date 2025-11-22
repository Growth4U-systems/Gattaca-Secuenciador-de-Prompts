'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createProject } from '@/hooks/useProjects'

export default function NewProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const newProject = await createProject({
        name: formData.name,
        description: formData.description || undefined,
      })

      console.log('Project created:', newProject)

      // Redirect to project page
      router.push(`/projects/${newProject.id}`)
    } catch (error) {
      console.error('Error creating project:', error)
      alert(`Error al crear el proyecto: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={20} />
          Volver a proyectos
        </Link>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Nuevo Proyecto
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Nombre del Proyecto *
              </label>
              <input
                type="text"
                id="name"
                required
                maxLength={200}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                placeholder="Ej: Producto XYZ - Campaña 2024"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Descripción
              </label>
              <textarea
                id="description"
                rows={4}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                placeholder="Descripción opcional del proyecto..."
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                📋 Próximos pasos
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>1. Configurar prompts maestros para cada paso</li>
                <li>2. Subir documentos (producto, competidores, research)</li>
                <li>3. Configurar qué documentos usar en cada paso</li>
                <li>4. Crear campañas por nicho</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !formData.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creando...' : 'Crear Proyecto'}
              </button>
              <Link
                href="/"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
