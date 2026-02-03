'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Sparkles, FolderPlus, Lightbulb, ArrowRight, FileText, Settings, Rocket, Database, Building2, Plus, X, Search, Zap, Target, Globe, Filter, Brain, BarChart3, Table } from 'lucide-react'
import PlaybookSelector from '@/components/playbook/PlaybookSelector'
import Link from 'next/link'
import { createProject } from '@/hooks/useProjects'
import { useToast } from '@/components/ui'

type Client = {
  id: string
  name: string
}

type Playbook = {
  id: string
  name: string
  slug: string
  description: string
  type: string
  playbook_type: string
}

type Project = {
  id: string
  name: string
  description: string | null
  playbook_type: string | null
  created_at: string
}

type ProjectMode = 'new' | 'existing'

function NewProjectForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loadingPlaybooks, setLoadingPlaybooks] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_id: '',
    playbook_type: '' as string,
  })
  const [showNewClientForm, setShowNewClientForm] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [creatingClient, setCreatingClient] = useState(false)

  // Project mode: create new or use existing
  const [projectMode, setProjectMode] = useState<ProjectMode>('new')
  const [existingProjects, setExistingProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [projectSearchQuery, setProjectSearchQuery] = useState('')

  // Get preselected client and playbook from URL query params
  const preselectedClientId = searchParams.get('clientId')
  const preselectedPlaybookType = searchParams.get('playbookType')

  // Load clients function
  const loadClients = async (selectClientId?: string) => {
    try {
      setLoadingClients(true)
      const response = await fetch('/api/v2/clients')
      const result = await response.json()

      if (!result.success) throw new Error(result.error || 'Failed to load clients')
      const data = result.clients || []
      setClients(data)

      // Select specific client or first one
      if (selectClientId) {
        setFormData(prev => ({ ...prev, client_id: selectClientId }))
      } else if (data && data.length > 0 && !formData.client_id) {
        setFormData(prev => ({ ...prev, client_id: data[0].id }))
      }
    } catch (err) {
      console.error('Error loading clients:', err)
      toast.error('Error', 'No se pudieron cargar los clientes')
    } finally {
      setLoadingClients(false)
    }
  }

  // Load playbooks
  const loadPlaybooks = async () => {
    try {
      setLoadingPlaybooks(true)
      const response = await fetch('/api/v2/playbooks')
      const result = await response.json()

      if (!result.success) throw new Error(result.error || 'Failed to load playbooks')
      const data = result.playbooks || []
      setPlaybooks(data)

      // Pre-select playbook from URL if provided (otherwise leave empty)
      if (preselectedPlaybookType) {
        setFormData(prev => ({ ...prev, playbook_type: preselectedPlaybookType }))
      }
    } catch (err) {
      console.error('Error loading playbooks:', err)
      toast.error('Error', 'No se pudieron cargar los playbooks')
    } finally {
      setLoadingPlaybooks(false)
    }
  }

  // Load existing projects for the selected client
  const loadExistingProjects = async (clientId: string) => {
    if (!clientId) {
      setExistingProjects([])
      return
    }

    try {
      setLoadingProjects(true)
      const response = await fetch(`/api/v2/clients/${clientId}/projects`)
      const result = await response.json()

      if (!result.success) throw new Error(result.error || 'Failed to load projects')
      setExistingProjects(result.projects || [])
    } catch (err) {
      console.error('Error loading projects:', err)
      setExistingProjects([])
    } finally {
      setLoadingProjects(false)
    }
  }

  // Load clients on mount, preselect from URL if available
  useEffect(() => {
    loadClients(preselectedClientId || undefined)
    loadPlaybooks()
  }, [preselectedClientId, preselectedPlaybookType])

  // Load existing projects when client changes
  useEffect(() => {
    if (formData.client_id) {
      loadExistingProjects(formData.client_id)
    }
  }, [formData.client_id])

  // Create new client
  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      toast.warning('Nombre requerido', 'Ingresa un nombre para el cliente')
      return
    }

    setCreatingClient(true)
    try {
      const response = await fetch('/api/v2/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newClientName.trim(),
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'No se pudo crear el cliente')
      }

      toast.success('Cliente creado', `"${newClientName}" creado exitosamente`)
      setNewClientName('')
      setShowNewClientForm(false)

      // Reload clients and select the new one
      await loadClients(result.client.id)
    } catch (err) {
      console.error('Error creating client:', err)
      toast.error('Error', err instanceof Error ? err.message : 'No se pudo crear el cliente')
    } finally {
      setCreatingClient(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const newProject = await createProject({
        name: formData.name,
        description: formData.description || undefined,
        client_id: formData.client_id,
        playbook_type: formData.playbook_type || undefined,
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

  const ecpSteps = [
    { icon: Settings, title: 'Configurar variables', description: 'Define las variables que usarás en tus prompts' },
    { icon: FileText, title: 'Subir documentos', description: 'Añade información de producto, competidores, research' },
    { icon: Database, title: 'Crear flujo', description: 'Configura los pasos y prompts de tu estrategia' },
    { icon: Rocket, title: 'Lanzar campañas', description: 'Genera contenido para diferentes nichos' },
  ]

  const competitorAnalysisSteps = [
    { icon: Target, title: 'Identificar competidores', description: 'Lista de competidores a analizar' },
    { icon: Search, title: 'Recopilar información', description: 'Scraping de sitios web y redes sociales' },
    { icon: FileText, title: 'Análisis comparativo', description: 'Genera matriz de fortalezas y debilidades' },
    { icon: Rocket, title: 'Insights estratégicos', description: 'Recomendaciones de posicionamiento' },
  ]

  const nicheFinderSteps = [
    { icon: Settings, title: 'Configurar búsqueda', description: 'Define contextos de vida y palabras de producto' },
    { icon: Search, title: 'Buscar en SERP', description: 'Encuentra URLs relevantes en Reddit y foros' },
    { icon: Globe, title: 'Scrapear contenido', description: 'Extrae el contenido de las URLs encontradas' },
    { icon: FileText, title: 'Extraer nichos', description: 'Identifica nichos con IA desde el contenido' },
    { icon: Filter, title: 'Limpiar y filtrar', description: 'Consolida y valida los nichos encontrados' },
    { icon: Brain, title: 'Scoring (Deep Research)', description: 'Analiza pain, reachability y market size' },
    { icon: Table, title: 'Consolidar tabla', description: 'Genera la tabla final con todos los datos' },
    { icon: Rocket, title: 'Exportar resultados', description: 'Descarga CSV o exporta a Google Sheets' },
  ]

  // Generic steps when no playbook is selected
  const genericSteps = [
    { icon: FolderPlus, title: 'Crear proyecto', description: 'Define nombre y cliente' },
    { icon: Zap, title: 'Agregar playbooks', description: 'Añade playbooks desde la página del proyecto' },
    { icon: FileText, title: 'Crear campañas', description: 'Lanza campañas para cada playbook' },
  ]

  // Get steps based on playbook type
  const getStepsForPlaybook = (playbookType: string) => {
    if (!playbookType) return genericSteps
    switch (playbookType) {
      case 'niche_finder':
        return nicheFinderSteps
      case 'competitor_analysis':
        return competitorAnalysisSteps
      case 'ecp':
        return ecpSteps
      default:
        return genericSteps
    }
  }
  const steps = getStepsForPlaybook(formData.playbook_type)

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href={preselectedClientId ? `/clients/${preselectedClientId}?tab=playbooks` : '/clients'}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Volver a panel cliente
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
                  <h1 className="text-2xl font-bold text-white">
                    {projectMode === 'new' ? 'Nuevo Proyecto' : 'Seleccionar Proyecto'}
                  </h1>
                </div>
                <p className="text-blue-100">
                  {projectMode === 'new'
                    ? 'Crea un nuevo proyecto para organizar tus estrategias de marketing'
                    : 'Selecciona un proyecto existente para continuar trabajando'}
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="px-8 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => setProjectMode('existing')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                      projectMode === 'existing'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Search size={16} />
                      Usar existente
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectMode('new')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                      projectMode === 'new'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Plus size={16} />
                      Crear nuevo
                    </span>
                  </button>
                </div>
              </div>

              {/* Existing Projects List */}
              {projectMode === 'existing' && (
                <div className="p-8 space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={projectSearchQuery}
                      onChange={(e) => setProjectSearchQuery(e.target.value)}
                      placeholder="Buscar proyecto..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Projects List */}
                  {loadingProjects ? (
                    <div className="py-8 text-center text-gray-500">
                      <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                      Cargando proyectos...
                    </div>
                  ) : existingProjects.length === 0 ? (
                    <div className="py-8 text-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <FolderPlus size={24} className="text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-medium">No hay proyectos existentes</p>
                      <p className="text-sm text-gray-500 mt-1">Crea un nuevo proyecto para comenzar</p>
                      <button
                        type="button"
                        onClick={() => setProjectMode('new')}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Crear proyecto
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {existingProjects
                        .filter(p =>
                          !projectSearchQuery ||
                          p.name.toLowerCase().includes(projectSearchQuery.toLowerCase())
                        )
                        .map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => {
                              // Navigate with playbook type to trigger wizard
                              const url = preselectedPlaybookType
                                ? `/projects/${project.id}?addPlaybook=${preselectedPlaybookType}`
                                : `/projects/${project.id}`
                              router.push(url)
                            }}
                            className="w-full text-left px-4 py-3 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all group"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900 group-hover:text-blue-700">
                                  {project.name}
                                </p>
                                {project.description && (
                                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                                    {project.description}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                  Creado el {new Date(project.created_at).toLocaleDateString('es-ES')}
                                </p>
                              </div>
                              <ArrowRight size={18} className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Form Content - Only show when creating new */}
              {projectMode === 'new' && (
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

                  {/* Show preselected client when coming from client page */}
                  {preselectedClientId && clients.find(c => c.id === preselectedClientId) ? (
                    <div className="flex items-center gap-3 px-4 py-3 border border-green-200 rounded-xl bg-green-50">
                      <Building2 size={18} className="text-green-600" />
                      <span className="font-medium text-green-800">
                        {clients.find(c => c.id === preselectedClientId)?.name}
                      </span>
                      <span className="text-xs text-green-600 ml-auto">Cliente preseleccionado</span>
                    </div>
                  ) : showNewClientForm ? (
                    <div className="space-y-3 p-4 border border-blue-200 rounded-xl bg-blue-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-800">Nuevo Cliente</span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewClientForm(false)
                            setNewClientName('')
                          }}
                          className="p-1 text-blue-600 hover:text-blue-800"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Nombre del cliente"
                        className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleCreateClient()
                          }
                          if (e.key === 'Escape') {
                            setShowNewClientForm(false)
                            setNewClientName('')
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleCreateClient}
                        disabled={creatingClient || !newClientName.trim()}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {creatingClient ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Creando...
                          </>
                        ) : (
                          <>
                            <Plus size={16} />
                            Crear Cliente
                          </>
                        )}
                      </button>
                    </div>
                  ) : loadingClients ? (
                    <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-400">
                      Cargando clientes...
                    </div>
                  ) : clients.length === 0 ? (
                    <div className="space-y-3">
                      <div className="w-full px-4 py-3 border border-amber-200 rounded-xl bg-amber-50 text-amber-700 text-sm">
                        No hay clientes disponibles.
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowNewClientForm(true)}
                        className="w-full px-4 py-2 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus size={16} />
                        Crear primer cliente
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        id="client"
                        required
                        value={formData.client_id}
                        onChange={(e) =>
                          setFormData({ ...formData, client_id: e.target.value })
                        }
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 transition-all"
                      >
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowNewClientForm(true)}
                        className="px-3 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
                        title="Agregar nuevo cliente"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Playbook Type Selector - Horizontal */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <Zap size={16} />
                      Playbook
                      <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                    </span>
                  </label>
                  <PlaybookSelector
                    value={formData.playbook_type}
                    onChange={(value) => setFormData({ ...formData, playbook_type: value })}
                    clientId={formData.client_id}
                    disabled={loading}
                    showDescription={true}
                  />
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
              )}
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
                  <strong>Tip:</strong> {!formData.playbook_type
                    ? 'Puedes crear un proyecto sin playbook y agregarlo después desde la página del proyecto.'
                    : formData.playbook_type === 'niche_finder'
                    ? 'El buscador de nichos combina contextos de vida × palabras de producto para encontrar oportunidades.'
                    : formData.playbook_type === 'competitor_analysis'
                    ? 'El análisis de competidores identifica fortalezas, debilidades y oportunidades de diferenciación.'
                    : 'Un buen nombre de proyecto incluye el producto y el período de la campaña.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

// Wrap in Suspense for useSearchParams
export default function NewProjectPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      </main>
    }>
      <NewProjectForm />
    </Suspense>
  )
}
