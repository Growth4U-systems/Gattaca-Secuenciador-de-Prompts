'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Building2,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  Plus,
  Settings,
  Database,
  Loader2,
  X,
  Book,
  Rocket,
  LayoutDashboard,
  Sparkles,
  Eye,
} from 'lucide-react'
import { useClient } from '@/hooks/useClients'
import { useAllClientDocuments, type Document } from '@/hooks/useDocuments'
import DocumentList from '@/components/documents/DocumentList'
import { useToast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { Growth4ULogo } from '@/components/ui/Growth4ULogo'

type TabType = 'overview' | 'context-lake' | 'projects' | 'playbooks' | 'settings'

interface Project {
  id: string
  name: string
  description: string | null
  playbook_type: string
  created_at: string
}

interface Playbook {
  id: string
  name: string
  description: string | null
  playbook_type: string
  is_public: boolean
  version: string
  config?: { steps?: string[] }
}

export default function ClientPage({
  params,
}: {
  params: { clientId: string }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const { client, loading: clientLoading, error: clientError } = useClient(params.clientId)
  const { documents, loading: docsLoading, reload: reloadDocs, projectsMap } = useAllClientDocuments(params.clientId)

  // Sync activeTab with URL query param
  const tabFromUrl = searchParams.get('tab') as TabType | null
  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl || 'overview')

  // Update activeTab when URL changes
  useEffect(() => {
    const tab = searchParams.get('tab') as TabType | null
    if (tab && ['overview', 'context-lake', 'projects', 'playbooks', 'settings'].includes(tab)) {
      setActiveTab(tab)
    } else if (!tab) {
      setActiveTab('overview')
    }
  }, [searchParams])

  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loadingPlaybooks, setLoadingPlaybooks] = useState(true)

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

  // Load all playbooks
  useEffect(() => {
    const loadPlaybooks = async () => {
      try {
        const { data, error } = await supabase
          .from('playbooks')
          .select('id, name, description, playbook_type, is_public, version')
          .order('name')

        if (error) throw error
        setPlaybooks(data || [])
      } catch (err) {
        console.error('Error loading playbooks:', err)
      } finally {
        setLoadingPlaybooks(false)
      }
    }

    loadPlaybooks()
  }, [])

  const tabs = [
    { id: 'overview' as const, label: 'Resumen', icon: LayoutDashboard },
    { id: 'context-lake' as const, label: 'Context Lake', icon: Database },
    { id: 'playbooks' as const, label: 'Playbooks', icon: Book },
    { id: 'settings' as const, label: 'Configuración', icon: Settings },
  ]

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId)
    const url = tabId === 'overview'
      ? `/clients/${params.clientId}`
      : `/clients/${params.clientId}?tab=${tabId}`
    router.push(url, { scroll: false })
  }

  if (clientLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-gray-500">Cargando cliente...</p>
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
              <ChevronLeft size={18} />
              Volver a Clientes
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Get playbook types in use
  const playbookTypesInUse = new Set(projects.map(p => p.playbook_type))

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col min-h-screen sticky top-0">
        {/* Logo */}
        <div className="p-4 border-b border-gray-100">
          <Link href="/" className="block">
            <Growth4ULogo size="lg" />
          </Link>
        </div>

        {/* Client Info */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900 truncate">{client.name}</h2>
              {client.industry && (
                <p className="text-xs text-gray-500 truncate">{client.industry}</p>
              )}
            </div>
          </div>
          <div className="mt-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              client.status === 'active' ? 'bg-green-100 text-green-700' :
              client.status === 'inactive' ? 'bg-gray-100 text-gray-600' :
              'bg-amber-100 text-amber-700'
            }`}>
              {client.status === 'active' ? 'Activo' :
               client.status === 'inactive' ? 'Inactivo' : 'Archivado'}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3">
          <div className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-indigo-600' : 'text-gray-400'} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Projects Section */}
          <div className="mt-6">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Proyectos ({projects.length})
              </span>
              <Link
                href={`/projects/new?clientId=${params.clientId}`}
                className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Nuevo proyecto"
              >
                <Plus size={14} />
              </Link>
            </div>
            <div className="space-y-1">
              {loadingProjects ? (
                <div className="px-3 py-2">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
              ) : projects.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">Sin proyectos</p>
              ) : (
                projects.slice(0, 5).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-colors"
                  >
                    <FolderOpen size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate">{project.name}</span>
                  </Link>
                ))
              )}
              {projects.length > 5 && (
                <button
                  onClick={() => handleTabChange('overview')}
                  className="w-full px-3 py-1.5 text-xs text-indigo-600 hover:text-indigo-700 text-left"
                >
                  Ver todos ({projects.length})
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* Back to Clients */}
        <div className="p-3 border-t border-gray-100">
          <Link
            href="/clients"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-colors"
          >
            <ChevronLeft size={18} className="text-gray-400" />
            Todos los clientes
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Tab Content */}
          {activeTab === 'overview' && (
            <OverviewTab client={client} projects={projects} documents={documents} />
          )}
          {activeTab === 'context-lake' && (
            <ContextLakeTab
              documents={documents}
              loading={docsLoading}
              onReload={reloadDocs}
              projectsMap={projectsMap}
            />
          )}
          {activeTab === 'playbooks' && (
            <PlaybooksTab
              clientId={params.clientId}
              playbooks={playbooks}
              loading={loadingPlaybooks}
              playbookTypesInUse={playbookTypesInUse}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsTab client={client} />
          )}
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
  // Stats by source type (cast to string for legacy values from DB)
  const sourceStats = {
    import: documents.filter(d => {
      const sourceType = d.source_type as string
      return sourceType === 'import' || sourceType === 'manual' || sourceType === 'upload'
    }).length,
    scraper: documents.filter(d => d.source_type === 'scraper').length,
    playbook: documents.filter(d => d.source_type === 'playbook').length,
    api: documents.filter(d => d.source_type === 'api').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resumen</h1>
        <p className="text-gray-500 mt-1">Vista general de {client.name}</p>
      </div>

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
            Documentos del cliente
          </p>
        </div>

        {/* Sources */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
          <div className="flex items-center justify-between mb-3">
            <Database className="w-8 h-8 text-green-600" />
            <div className="text-right">
              <span className="text-sm text-green-600">
                📥 {sourceStats.import} | 🔍 {sourceStats.scraper} | 🎯 {sourceStats.playbook} | 🔗 {sourceStats.api}
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
  onReload,
  projectsMap,
}: {
  documents: Document[]
  loading: boolean
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Context Lake</h1>
        <p className="text-gray-500 mt-1">
          Todos los documentos del cliente: {sharedCount} compartidos + {projectDocsCount} en proyectos
        </p>
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : (
        <DocumentList
          documents={filteredDocuments as any[]}
          onDelete={handleDelete}
          onView={() => {}}
          showContextLakeFilters={true}
        />
      )}
    </div>
  )
}

import { playbookMetadata, getPlaybookName, formatStepName } from '@/lib/playbook-metadata'

// Playbooks Tab
function PlaybooksTab({
  clientId,
  playbooks,
  loading,
  playbookTypesInUse,
}: {
  clientId: string
  playbooks: Playbook[]
  loading: boolean
  playbookTypesInUse: Set<string>
}) {
  const [expandedPlaybookId, setExpandedPlaybookId] = useState<string | null>(null)
  const playbooksInUse = playbooks.filter(p => playbookTypesInUse.has(p.playbook_type)).length

  // Map playbook_type to icon
  const getPlaybookIcon = (type: string) => {
    switch (type) {
      case 'niche_finder':
        return '🔍'
      case 'competitor_analysis':
        return '📊'
      case 'ecp':
        return '🎯'
      default:
        return '📖'
    }
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Playbooks</h1>
          <p className="text-gray-500 mt-1">
            {playbooks.length} disponibles • {playbooksInUse} en uso
          </p>
        </div>
        <Link
          href={`/projects/new?clientId=${clientId}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm font-medium"
        >
          <Sparkles size={18} />
          Nuevo Proyecto
        </Link>
      </div>

      {playbooks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Book className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">No hay playbooks</h3>
          <p className="text-gray-500 text-sm">
            Crea tu primer playbook para empezar
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {playbooks.map((playbook) => {
            const isInUse = playbookTypesInUse.has(playbook.playbook_type)
            const isExpanded = expandedPlaybookId === playbook.id
            const steps = (playbook.config as { steps?: string[] })?.steps || []

            return (
              <div
                key={playbook.id}
                className={`bg-white rounded-xl border p-5 transition-all ${
                  isExpanded
                    ? 'border-indigo-300 shadow-md'
                    : 'border-gray-200 hover:border-indigo-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl text-2xl">
                      {getPlaybookIcon(playbook.playbook_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{playbook.name}</h3>
                        {isInUse && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            ✓ En uso
                          </span>
                        )}
                      </div>
                      {playbook.description && (
                        <p className="text-sm text-gray-500 mt-1">{playbook.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-400">
                          {playbook.playbook_type} v{playbook.version}
                        </span>
                        {playbook.is_public && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                            Público
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedPlaybookId(isExpanded ? null : playbook.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={16} />
                          Ocultar
                        </>
                      ) : (
                        <>
                          <Eye size={16} />
                          Ver
                        </>
                      )}
                    </button>
                    <Link
                      href={`/projects/new?clientId=${clientId}&playbookType=${playbook.playbook_type}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Rocket size={16} />
                      Usar
                    </Link>
                  </div>
                </div>

                {/* Expanded section with metadata */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {(() => {
                      const meta = playbookMetadata[playbook.playbook_type]
                      if (!meta) return null

                      return (
                        <div className="space-y-4">
                          {/* Purpose */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-1">¿Para qué sirve?</h4>
                            <p className="text-sm text-gray-600">{meta.purpose}</p>
                          </div>

                          {/* When to use */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-1">¿Cuándo usarlo?</h4>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {meta.whenToUse.map((item, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-indigo-500 mt-0.5">•</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Outcome */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-1">¿Qué consigues?</h4>
                            <p className="text-sm text-gray-600">{meta.outcome}</p>
                          </div>

                          {/* Related playbooks */}
                          {meta.relatedPlaybooks.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-1">Relacionado con</h4>
                              <div className="flex flex-wrap gap-2">
                                {meta.relatedPlaybooks.map((related) => (
                                  <span
                                    key={related}
                                    className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"
                                  >
                                    {getPlaybookName(related)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Steps */}
                          {steps.length > 0 && (
                            <div className="pt-3 border-t border-gray-100">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                Flujo de Trabajo ({steps.length} pasos)
                              </h4>
                              <div className="space-y-2">
                                {steps.map((step: string, i: number) => (
                                  <div key={i} className="flex gap-3">
                                    <div className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-semibold">
                                      {i + 1}
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-800 text-sm">
                                        {formatStepName(step)}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {meta.steps[step] || 'Paso del flujo'}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Settings Tab
function SettingsTab({ client }: { client: any }) {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 mt-1">Configuración del cliente {client.name}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
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
    </div>
  )
}
