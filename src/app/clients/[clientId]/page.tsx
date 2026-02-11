'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Building2,
  FolderOpen,
  Folder,
  FileText,
  ChevronRight,
  ChevronLeft,
  Plus,
  Settings,
  Database,
  Loader2,
  X,
  Book,
  Rocket,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react'
import { useClient } from '@/hooks/useClients'
import {
  useAllClientDocuments,
  useClientDocuments,
  type Document,
  groupByFolder,
  getFolderDisplayName,
  updateDocumentFolder,
  canDeleteDocument,
} from '@/hooks/useDocuments'
import DocumentList from '@/components/documents/DocumentList'
import DocumentFolderView from '@/components/documents/DocumentFolderView'
import { useToast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import ClientSidebar from '@/components/layout/ClientSidebar'

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
      <ClientSidebar client={client} />

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
  const [viewMode, setViewMode] = useState<'list' | 'folders'>('folders')
  const [movingToFolder, setMovingToFolder] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [manualFolders, setManualFolders] = useState<string[]>([])

  const handleDelete = async (docId: string) => {
    try {
      // Check for references first
      const { canDelete, referenceCount, referencingProjects } = await canDeleteDocument(docId)
      if (!canDelete) {
        toast.error(
          'No se puede eliminar',
          `Este documento tiene ${referenceCount} referencia(s) en: ${referencingProjects.join(', ')}`
        )
        return
      }

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

  const handleMoveToFolder = async (docId: string, folder: string | null) => {
    try {
      setMovingToFolder(docId)
      await updateDocumentFolder(docId, folder)
      toast.success('Movido', folder ? `Documento movido a "${folder}"` : 'Documento movido a Sin carpeta')
      onReload()
    } catch (err) {
      toast.error('Error', 'No se pudo mover el documento')
    } finally {
      setMovingToFolder(null)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    const folderName = newFolderName.trim()
    // Add to manual folders to show immediately
    if (!folders.includes(folderName)) {
      setManualFolders(prev => [...prev, folderName])
    }
    setShowNewFolderInput(false)
    toast.success('Carpeta creada', `La carpeta "${folderName}" está lista. Mueve documentos a ella.`)
    setNewFolderName('')
  }

  // Get unique projects from documents
  const uniqueProjects = [...new Set(documents.map(d => d.project_id).filter(Boolean))]

  // Filter documents by project
  const filteredDocuments = projectFilter === 'all'
    ? documents
    : projectFilter === 'shared'
      ? documents.filter(d => !d.project_id)
      : documents.filter(d => d.project_id === projectFilter)

  // Get only Context Lake docs (shared, no project_id)
  const contextLakeDocs = documents.filter(d => !d.project_id)

  // Get folders from Context Lake docs (include manual folders)
  const folders = [...new Set([
    ...contextLakeDocs.map(d => d.folder).filter(Boolean) as string[],
    ...manualFolders
  ])].sort()

  // Stats
  const sharedCount = documents.filter(d => !d.project_id).length
  const projectDocsCount = documents.filter(d => d.project_id).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Context Lake</h1>
          <p className="text-gray-500 mt-1">
            {sharedCount} documentos compartidos + {projectDocsCount} en proyectos
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('folders')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'folders'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Folder size={16} className="inline mr-1.5" />
            Carpetas
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText size={16} className="inline mr-1.5" />
            Lista
          </button>
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
            🔗 Context Lake ({sharedCount})
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

      {/* Create Folder for Context Lake docs */}
      {projectFilter === 'shared' && viewMode === 'folders' && (
        <div className="mb-4">
          {showNewFolderInput ? (
            <div className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl">
              <Folder size={18} className="text-gray-400" />
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                  if (e.key === 'Escape') {
                    setShowNewFolderInput(false)
                    setNewFolderName('')
                  }
                }}
                placeholder="Nombre de la carpeta..."
                className="flex-1 px-2 py-1 text-sm text-gray-900 placeholder-gray-400 border-0 focus:ring-0 focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Crear
              </button>
              <button
                onClick={() => {
                  setShowNewFolderInput(false)
                  setNewFolderName('')
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewFolderInput(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <Plus size={16} />
              Nueva carpeta
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : viewMode === 'folders' && projectFilter === 'shared' ? (
        <DocumentFolderView
          documents={contextLakeDocs}
          onDocumentClick={(doc) => {
            // Could open document viewer
          }}
          onDelete={handleDelete}
          onMoveToFolder={handleMoveToFolder}
          showCreateFolder={false}
          emptyMessage="No hay documentos en el Context Lake"
          emptyFolders={manualFolders}
        />
      ) : (
        <DocumentList
          documents={filteredDocuments as any[]}
          onDelete={handleDelete}
          onView={() => {}}
          showContextLakeFilters={true}
          onMoveToFolder={handleMoveToFolder}
          availableFolders={folders}
        />
      )}
    </div>
  )
}

import { playbookMetadata, getPlaybookName, formatStepName } from '@/lib/playbook-metadata'
import ApiKeysConfig from '@/components/settings/ApiKeysConfig'
import { useClientPlaybooks } from '@/hooks/useClientPlaybooks'
import { Pencil, Library, Copy, ChevronDown, ChevronUp } from 'lucide-react'
import { getPlaybookConfig } from '@/components/playbook/configs'

// Playbooks Tab - Now shows client's custom playbooks and link to library
function PlaybooksTab({
  clientId,
  playbookTypesInUse,
}: {
  clientId: string
  playbookTypesInUse: Set<string>
}) {
  const router = useRouter()
  const toast = useToast()
  const {
    customPlaybooks,
    basePlaybooks,
    loading,
    forkFromTemplate,
  } = useClientPlaybooks(clientId)

  // State for customization modal
  const [showNameModal, setShowNameModal] = useState(false)
  const [newPlaybookName, setNewPlaybookName] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [isCustomizing, setIsCustomizing] = useState(false)

  // State for viewing playbook details
  const [viewingPlaybook, setViewingPlaybook] = useState<{
    type: string
    name: string
    description: string
    isCustom?: boolean
    config?: any
  } | null>(null)
  const [loadingPlaybookConfig, setLoadingPlaybookConfig] = useState(false)
  const [playbookConfig, setPlaybookConfig] = useState<{
    steps?: Array<{
      id: string
      name: string
      description?: string
      prompt?: string
    }>
    variables?: Array<{
      key: string
      label: string
      description?: string
    }>
  } | null>(null)

  // Load playbook config when viewing
  useEffect(() => {
    if (!viewingPlaybook) {
      setPlaybookConfig(null)
      return
    }

    // Get config from static playbook configs
    const config = getPlaybookConfig(viewingPlaybook.type)
      || getPlaybookConfig(viewingPlaybook.type.replace('_', '-'))
      || getPlaybookConfig(viewingPlaybook.type.replace('-', '_'))

    if (config) {
      setPlaybookConfig({
        steps: config.flow_config?.steps?.map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          prompt: s.prompt,
        })) || [],
        variables: config.variables?.map((v: any) => ({
          key: v.key || v.name,
          label: v.label || v.name || v.key,
          description: v.description,
        })) || [],
      })
    }
  }, [viewingPlaybook])

  // Map playbook_type to icon
  const getPlaybookIcon = (type: string) => {
    const icons: Record<string, string> = {
      niche_finder: '🔍',
      'niche-finder': '🔍',
      competitor_analysis: '📊',
      'competitor-analysis': '📊',
      ecp: '🎯',
      'signal-outreach': '📡',
      'seo-seed-keywords': '🔑',
      'linkedin-post-generator': '💼',
      'github-fork-to-crm': '🐙',
      'video-viral-ia': '🎬',
    }
    return icons[type] || '📖'
  }

  const handleCustomize = (playbookType: string) => {
    const template = basePlaybooks.find(t => t.type === playbookType)
    setSelectedType(playbookType)
    setNewPlaybookName(template?.name || playbookType)
    setShowNameModal(true)
  }

  const handleConfirmCustomize = async () => {
    if (!selectedType || !newPlaybookName.trim()) return

    setIsCustomizing(true)
    setShowNameModal(false)

    try {
      const playbook = await forkFromTemplate(selectedType, newPlaybookName.trim())
      if (playbook) {
        toast.success('Playbook creado', `Se creó "${newPlaybookName}" para este cliente`)
        router.push(`/clients/${clientId}/playbooks/${playbook.id}/edit`)
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'No se pudo crear el playbook')
    } finally {
      setIsCustomizing(false)
      setSelectedType(null)
      setNewPlaybookName('')
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
            {customPlaybooks.length} personalizados • {basePlaybooks.length} disponibles
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

      {/* Custom Playbooks Section */}
      {customPlaybooks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Pencil size={18} className="text-indigo-600" />
            Playbooks Personalizados
          </h2>
          <div className="space-y-3">
            {customPlaybooks.map((playbook) => {
              const isInUse = playbookTypesInUse.has(playbook.playbook_type)

              return (
                <div
                  key={playbook.id}
                  className="bg-white rounded-xl border border-indigo-100 p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl text-xl">
                        {getPlaybookIcon(playbook.playbook_type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{playbook.name}</h3>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                            <Pencil size={10} />
                            Personalizado
                          </span>
                          {isInUse && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              ✓ En uso
                            </span>
                          )}
                        </div>
                        {playbook.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{playbook.description}</p>
                        )}
                        <span className="text-xs text-gray-400">{playbook.playbook_type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/clients/${clientId}/playbooks/${playbook.id}/edit`}
                        className="inline-flex items-center gap-2 px-3 py-2 text-indigo-600 text-sm font-medium rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors"
                      >
                        <Pencil size={14} />
                        Editar
                      </Link>
                      <Link
                        href={`/projects/new?clientId=${clientId}&playbookType=${playbook.playbook_type}`}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <Rocket size={14} />
                        Usar
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Base Templates Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Book size={18} className="text-gray-400" />
          Templates Disponibles
        </h2>

        {(() => {
          // Filter out templates that have been customized - they appear in the "Playbooks Personalizados" section
          const availableTemplates = basePlaybooks.filter(t => !t.isCustomized)

          return availableTemplates.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Book className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="font-medium text-gray-900 mb-2">Todos los templates están personalizados</h3>
              <p className="text-gray-500 text-sm">
                Ya has personalizado todos los playbooks disponibles
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableTemplates.map((template) => {
                const isInUse = playbookTypesInUse.has(template.type)

                return (
                  <div
                    key={template.type}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => setViewingPlaybook({
                      type: template.type,
                      name: template.name,
                      description: template.description,
                      isCustom: false,
                    })}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg text-lg">
                        {getPlaybookIcon(template.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-gray-900 text-sm">{template.name}</h3>
                          {isInUse && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              En uso
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{template.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleCustomize(template.type)}
                        disabled={isCustomizing}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-indigo-600 font-medium rounded-lg border border-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
                      >
                        {isCustomizing && selectedType === template.type ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Copy size={12} />
                        )}
                        Personalizar
                      </button>
                      <Link
                        href={`/projects/new?clientId=${clientId}&playbookType=${template.type}`}
                        className="flex-1 text-center px-3 py-1.5 text-xs bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700"
                      >
                        Usar
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Name Modal for Customization */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Personalizar Playbook
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Crea una versión personalizada de este playbook para el cliente.
            </p>
            <input
              type="text"
              value={newPlaybookName}
              onChange={(e) => setNewPlaybookName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCustomize()
                if (e.key === 'Escape') setShowNameModal(false)
              }}
              placeholder="Nombre del playbook..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNameModal(false)
                  setSelectedType(null)
                  setNewPlaybookName('')
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCustomize}
                disabled={!newPlaybookName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Crear y Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Playbook Modal */}
      {viewingPlaybook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl text-2xl">
                    {getPlaybookIcon(viewingPlaybook.type)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{viewingPlaybook.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">{viewingPlaybook.type}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingPlaybook(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-6">
                {/* Description */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Descripción</h3>
                  <p className="text-gray-600">{viewingPlaybook.description}</p>
                </div>

                {/* Variables */}
                {playbookConfig?.variables && playbookConfig.variables.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Variables ({playbookConfig.variables.length})</h3>
                    <div className="flex flex-wrap gap-2">
                      {playbookConfig.variables.map((v) => (
                        <span
                          key={v.key}
                          className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-md border border-purple-100"
                          title={v.description}
                        >
                          {`{{${v.key}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Steps */}
                {playbookConfig?.steps && playbookConfig.steps.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Pasos del Análisis ({playbookConfig.steps.length})</h3>
                    <div className="space-y-2">
                      {playbookConfig.steps.map((step, index) => (
                        <details key={step.id} className="group border border-gray-200 rounded-lg overflow-hidden">
                          <summary className="flex items-center gap-3 p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                              {index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-gray-900 text-sm">{step.name}</span>
                              {step.description && (
                                <span className="text-gray-500 text-xs ml-2">- {step.description}</span>
                              )}
                            </div>
                            <ChevronDown size={16} className="text-gray-400 group-open:rotate-180 transition-transform" />
                          </summary>
                          <div className="p-3 bg-white border-t border-gray-100">
                            {step.prompt ? (
                              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded-lg max-h-48 overflow-y-auto">
                                {step.prompt.slice(0, 500)}{step.prompt.length > 500 ? '...' : ''}
                              </pre>
                            ) : (
                              <p className="text-xs text-gray-400 italic">Sin prompt definido</p>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}

                {/* Info about customization */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-sm text-blue-800">
                    Este es un template base. Para modificar los prompts y configuraciones,
                    haz clic en <strong>"Personalizar"</strong> para crear tu propia versión.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setViewingPlaybook(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  handleCustomize(viewingPlaybook.type)
                  setViewingPlaybook(null)
                }}
                className="px-4 py-2 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
              >
                <Copy size={16} className="inline mr-2" />
                Personalizar
              </button>
              <Link
                href={`/projects/new?clientId=${clientId}&playbookType=${viewingPlaybook.type}`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                onClick={() => setViewingPlaybook(null)}
              >
                Usar en Proyecto
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Settings Tab
function SettingsTab({ client }: { client: any }) {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 mt-1">Configuración del cliente {client.name}</p>
      </div>

      {/* Client Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Información del Cliente</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              defaultValue={client.name}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl text-gray-900 bg-gray-50"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industria</label>
            <input
              type="text"
              defaultValue={client.industry || ''}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl text-gray-900 bg-gray-50"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              defaultValue={client.status}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl text-gray-900 bg-gray-50"
              disabled
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="archived">Archivado</option>
            </select>
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          La edición de información del cliente estará disponible próximamente.
        </p>
      </div>

      {/* API Keys Section */}
      <ApiKeysConfig />
    </div>
  )
}
