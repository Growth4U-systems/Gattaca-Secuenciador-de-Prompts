'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2,
  FolderOpen,
  FileText,
  ChevronRight,
  Home,
  Plus,
  Settings,
  Database,
  Loader2,
  X,
  Book,
  Rocket,
} from 'lucide-react'
import { useClient } from '@/hooks/useClients'
import { useAllClientDocuments, type Document, updateDocumentTier, type DocumentTier } from '@/hooks/useDocuments'
import DocumentList from '@/components/documents/DocumentList'
import { useToast } from '@/components/ui'
import { supabase } from '@/lib/supabase'

type TabType = 'overview' | 'context-lake' | 'projects' | 'playbooks' | 'settings'

interface Project {
  id: string
  name: string
  description: string | null
  playbook_type: string
  created_at: string
}

export default function ClientPage({
  params,
}: {
  params: { clientId: string }
}) {
  const router = useRouter()
  const toast = useToast()
  const { client, loading: clientLoading, error: clientError } = useClient(params.clientId)
  const { documents, loading: docsLoading, reload: reloadDocs, projectsMap } = useAllClientDocuments(params.clientId)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)

  // Load projects for this client
  useEffect(() => {
    const loadProjects = async () => {
      if (!params.clientId) return

      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, name, description, playbook_type, created_at')
          .eq('client_id', params.clientId)
          .order('updated_at', { ascending: false })

        if (error) throw error
        setProjects(data || [])
      } catch (err) {
        console.error('Error loading projects:', err)
      } finally {
        setLoadingProjects(false)
      }
    }

    loadProjects()
  }, [params.clientId])

  const handleTierChange = async (docId: string, tier: DocumentTier) => {
    try {
      await updateDocumentTier(docId, tier)
      toast.success('Tier actualizado', `Documento movido a ${tier}`)
      reloadDocs()
    } catch (err) {
      toast.error('Error', 'No se pudo actualizar el tier')
    }
  }

  const tabs = [
    { id: 'overview' as const, label: 'Resumen', icon: Building2 },
    { id: 'context-lake' as const, label: 'Context Lake', icon: Database },
    { id: 'projects' as const, label: 'Proyectos', icon: FolderOpen },
    { id: 'playbooks' as const, label: 'Playbooks', icon: Book },
    { id: 'settings' as const, label: 'Configuración', icon: Settings },
  ]

  if (clientLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-gray-200 rounded" />
            <div className="h-40 bg-gray-100 rounded-2xl" />
          </div>
        </div>
      </main>
    )
  }

  if (clientError || !client) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
            <X className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-900 mb-2">Cliente no encontrado</h2>
            <p className="text-red-700 mb-6">{clientError || 'El cliente no existe o no tienes acceso'}</p>
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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Top Navigation */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 py-3 text-sm">
            <Link
              href="/clients"
              className="inline-flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors"
            >
              <Building2 size={14} />
              <span>Clientes</span>
            </Link>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="text-gray-900 font-medium">{client.name}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Client Header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-700 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 backdrop-blur rounded-xl">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{client.name}</h1>
                {client.industry && (
                  <p className="text-indigo-200 text-sm mt-0.5">{client.industry}</p>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-3 mt-4">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <FolderOpen className="w-4 h-4 text-indigo-200" />
                <span className="text-sm text-white">{projects.length} proyectos</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <FileText className="w-4 h-4 text-indigo-200" />
                <span className="text-sm text-white">{documents.length} documentos</span>
              </div>
              <span className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                client.status === 'active' ? 'bg-green-500/20 text-green-100' :
                client.status === 'inactive' ? 'bg-gray-500/20 text-gray-200' :
                'bg-amber-500/20 text-amber-100'
              }`}>
                {client.status === 'active' ? 'Activo' :
                 client.status === 'inactive' ? 'Inactivo' : 'Archivado'}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="border-b border-gray-100">
            <nav className="flex -mb-px overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex-shrink-0 flex items-center gap-2.5 px-6 py-4 text-sm font-medium transition-all ${
                      isActive ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                    }`}
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
              <OverviewTab client={client} projects={projects} documents={documents} />
            )}
            {activeTab === 'context-lake' && (
              <ContextLakeTab
                documents={documents}
                loading={docsLoading}
                onTierChange={handleTierChange}
                onReload={reloadDocs}
                projectsMap={projectsMap}
              />
            )}
            {activeTab === 'projects' && (
              <ProjectsTab clientId={params.clientId} projects={projects} loading={loadingProjects} />
            )}
            {activeTab === 'playbooks' && (
              <PlaybooksTab />
            )}
            {activeTab === 'settings' && (
              <SettingsTab client={client} />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

// Overview Tab
function OverviewTab({
  client,
  projects,
  documents,
}: {
  client: any
  projects: Project[]
  documents: Document[]
}) {
  // Stats
  const tierStats = {
    T1: documents.filter(d => d.tier === 'T1').length,
    T2: documents.filter(d => d.tier === 'T2').length,
    T3: documents.filter(d => d.tier === 'T3').length,
  }

  const sourceStats = {
    manual: documents.filter(d => d.source_type === 'manual').length,
    scraper: documents.filter(d => d.source_type === 'scraper').length,
    playbook: documents.filter(d => d.source_type === 'playbook').length,
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Projects */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
          <div className="flex items-center justify-between mb-3">
            <FolderOpen className="w-8 h-8 text-blue-600" />
            <span className="text-3xl font-bold text-blue-900">{projects.length}</span>
          </div>
          <h3 className="font-medium text-blue-900">Proyectos</h3>
          <p className="text-sm text-blue-600 mt-1">Proyectos activos del cliente</p>
        </div>

        {/* Documents */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-100">
          <div className="flex items-center justify-between mb-3">
            <FileText className="w-8 h-8 text-purple-600" />
            <span className="text-3xl font-bold text-purple-900">{documents.length}</span>
          </div>
          <h3 className="font-medium text-purple-900">Context Lake</h3>
          <p className="text-sm text-purple-600 mt-1">
            T1: {tierStats.T1} | T2: {tierStats.T2} | T3: {tierStats.T3}
          </p>
        </div>

        {/* Sources */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
          <div className="flex items-center justify-between mb-3">
            <Database className="w-8 h-8 text-green-600" />
            <div className="text-right">
              <span className="text-sm text-green-600">
                📤 {sourceStats.manual} | 🔍 {sourceStats.scraper} | 🎯 {sourceStats.playbook}
              </span>
            </div>
          </div>
          <h3 className="font-medium text-green-900">Fuentes de Datos</h3>
          <p className="text-sm text-green-600 mt-1">Documentos por origen</p>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Proyectos Recientes</h3>
        {projects.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay proyectos aún</p>
        ) : (
          <div className="space-y-3">
            {projects.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FolderOpen size={18} className="text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{project.name}</p>
                    <p className="text-xs text-gray-500">{project.playbook_type}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Context Lake Tab
function ContextLakeTab({
  documents,
  loading,
  onTierChange,
  onReload,
  projectsMap,
}: {
  documents: Document[]
  loading: boolean
  onTierChange: (docId: string, tier: DocumentTier) => Promise<void>
  onReload: () => void
  projectsMap: Record<string, string>
}) {
  const toast = useToast()
  const [projectFilter, setProjectFilter] = useState<string>('all')

  const handleDelete = async (docId: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_base_docs')
        .delete()
        .eq('id', docId)
      if (error) throw error
      toast.success('Eliminado', 'Documento eliminado del Context Lake')
      onReload()
    } catch (err) {
      toast.error('Error', 'No se pudo eliminar el documento')
    }
  }

  // Get unique projects from documents
  const uniqueProjects = [...new Set(documents.map(d => d.project_id).filter(Boolean))]

  // Filter documents by project
  const filteredDocuments = projectFilter === 'all'
    ? documents
    : projectFilter === 'shared'
      ? documents.filter(d => !d.project_id)
      : documents.filter(d => d.project_id === projectFilter)

  // Stats
  const sharedCount = documents.filter(d => !d.project_id).length
  const projectDocsCount = documents.filter(d => d.project_id).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Context Lake</h2>
          <p className="text-sm text-gray-500 mt-1">
            Todos los documentos del cliente: {sharedCount} compartidos + {projectDocsCount} en proyectos
          </p>
        </div>
      </div>

      {/* Project Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
        <span className="text-sm font-medium text-indigo-700">Filtrar por origen:</span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setProjectFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              projectFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-indigo-100'
            }`}
          >
            Todos ({documents.length})
          </button>
          <button
            onClick={() => setProjectFilter('shared')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              projectFilter === 'shared'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-purple-100'
            }`}
          >
            🔗 Compartidos ({sharedCount})
          </button>
          {uniqueProjects.map(projectId => (
            <button
              key={projectId}
              onClick={() => setProjectFilter(projectId!)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                projectFilter === projectId
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-blue-100'
              }`}
            >
              📁 {projectsMap[projectId!] || 'Proyecto'} ({documents.filter(d => d.project_id === projectId).length})
            </button>
          ))}
        </div>
      </div>

      {/* Tier Legend */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-emerald-50 text-emerald-700">T1</span>
          <span className="text-sm text-gray-600">Siempre incluido en prompts</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-50 text-yellow-700">T2</span>
          <span className="text-sm text-gray-600">Incluido si es relevante</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-500">T3</span>
          <span className="text-sm text-gray-600">Archivo / Opcional</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : (
        <DocumentList
          documents={filteredDocuments as any[]}
          onDelete={handleDelete}
          onView={() => {}}
          onTierChange={onTierChange}
          showContextLakeFilters={true}
        />
      )}
    </div>
  )
}

// Projects Tab
function ProjectsTab({
  clientId,
  projects,
  loading,
}: {
  clientId: string
  projects: Project[]
  loading: boolean
}) {
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Proyectos</h2>
          <p className="text-sm text-gray-500 mt-1">
            Todos los proyectos de este cliente
          </p>
        </div>
        <Link
          href={`/projects/new?clientId=${clientId}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          <Plus size={18} />
          Nuevo Proyecto
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">No hay proyectos</h3>
          <p className="text-gray-500 text-sm mb-4">Crea el primer proyecto para este cliente</p>
          <Link
            href={`/projects/new?clientId=${clientId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={18} />
            Crear Proyecto
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Rocket size={20} className="text-blue-600" />
                </div>
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                  {project.playbook_type}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {project.name}
              </h3>
              {project.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{project.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-3">
                Creado {new Date(project.created_at).toLocaleDateString('es-ES')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// Playbooks Tab
function PlaybooksTab() {
  return (
    <div className="text-center py-12">
      <Book className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="font-medium text-gray-900 mb-2">Playbooks</h3>
      <p className="text-gray-500 text-sm">
        Los playbooks disponibles para este cliente aparecerán aquí
      </p>
    </div>
  )
}

// Settings Tab
function SettingsTab({ client }: { client: any }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Configuración del Cliente</h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input
            type="text"
            defaultValue={client.name}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-gray-900"
            disabled
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Industria</label>
          <input
            type="text"
            defaultValue={client.industry || ''}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-gray-900"
            disabled
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select
            defaultValue={client.status}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-gray-900"
            disabled
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="archived">Archivado</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-gray-500 mt-6">
        La edición de configuración estará disponible próximamente.
      </p>
    </div>
  )
}
