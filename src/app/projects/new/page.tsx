'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles, FolderPlus, Lightbulb, ArrowRight, FileText, Settings, Rocket, Database, Building2 } from 'lucide-react'
import Link from 'next/link'
import { createProject } from '@/hooks/useProjects'
import { useToast } from '@/components/ui'
import { createClient } from '@/lib/supabase-browser'

type Client = {
  id: string
  name: string
}

export default function NewProjectPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_id: '',
  })

  // Load clients on mount
  useEffect(() => {
    async function loadClients() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('clients')
          .select('id, name')
          .order('name', { ascending: true })

        if (error) throw error
        setClients(data || [])
        // Auto-select first client if available
        if (data && data.length > 0) {
          setFormData(prev => ({ ...prev, client_id: data[0].id }))
        }
      } catch (err) {
        console.error('Error loading clients:', err)
        toast.error('Error', 'No se pudieron cargar los clientes')
      } finally {
        setLoadingClients(false)
      }
    }
    loadClients()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const newProject = await createProject({
        name: formData.name,
        description: formData.description || undefined,
        client_id: formData.client_id,
      })

      console.log('Project created:', newProject)
      toast.success('Proyecto creado', 'Proyecto creado exitosamente')

      // Redirect to project page
      router.push(`/projects/${newProject.id}`)
    } catch (error) {
      console.error('Error creating project:', error)
      toast.error('Error al crear proyecto', error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { icon: Settings, title: 'Configurar variables', description: 'Define las variables que usarás en tus prompts' },
    { icon: FileText, title: 'Subir documentos', description: 'Añade información de producto, competidores, research' },
    { icon: Database, title: 'Crear flujo', description: 'Configura los pasos y prompts de tu estrategia' },
    { icon: Rocket, title: 'Lanzar campañas', description: 'Genera contenido para diferentes nichos' },
  ]

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Volver a proyectos
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Form Header */}
              <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/10 backdrop-blur rounded-xl">
                    <FolderPlus className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-white">Nuevo Proyecto</h1>
                </div>
                <p className="text-blue-100">
                  Crea un nuevo proyecto para organizar tus estrategias de marketing
                </p>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div>
                  <label
                    htmlFor="client"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    <span className="flex items-center gap-2">
                      <Building2 size={16} />
                      Cliente
                      <span className="text-red-500">*</span>
                    </span>
                  </label>
                  {loadingClients ? (
                    <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-400">
                      Cargando clientes...
                    </div>
                  ) : clients.length === 0 ? (
                    <div className="w-full px-4 py-3 border border-amber-200 rounded-xl bg-amber-50 text-amber-700 text-sm">
                      No hay clientes disponibles. <Link href="/clients" className="underline font-medium">Crea uno primero</Link>.
                    </div>
                  ) : (
                    <select
                      id="client"
                      required
                      value={formData.client_id}
                      onChange={(e) =>
                        setFormData({ ...formData, client_id: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 transition-all"
                    >
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Nombre del Proyecto
                    <span className="text-red-500 ml-1">*</span>
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 transition-all"
                    placeholder="Ej: Producto XYZ - Campaña 2024"
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Descripción
                    <span className="text-gray-400 font-normal ml-2">(opcional)</span>
                  </label>
                  <textarea
                    id="description"
                    rows={4}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 transition-all resize-none"
                    placeholder="Describe brevemente el objetivo del proyecto..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading || !formData.name.trim() || !formData.client_id}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 inline-flex items-center justify-center gap-2 group"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        Crear Proyecto
                        <ArrowRight size={16} className="opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                      </>
                    )}
                  </button>
                  <Link
                    href="/"
                    className="px-6 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </Link>
                </div>
              </form>
            </div>
          </div>

          {/* Sidebar - Next Steps */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Próximos pasos</h3>
              </div>

              <div className="space-y-4">
                {steps.map((step, index) => {
                  const Icon = step.icon
                  return (
                    <div key={index} className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600">{index + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{step.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-blue-200/50">
                <p className="text-xs text-blue-700">
                  <strong>Tip:</strong> Un buen nombre de proyecto incluye el producto y el período de la campaña.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
