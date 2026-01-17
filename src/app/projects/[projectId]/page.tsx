'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Rocket, Sliders, Edit2, Check, X, Trash2, ChevronRight, Home, FolderOpen, Calendar, MoreVertical, Share2, Building2, Table2, Globe, Search } from 'lucide-react'
import { useToast, useModal } from '@/components/ui'
import { useProject } from '@/hooks/useProjects'
import { useDocuments, deleteDocument } from '@/hooks/useDocuments'
import DocumentUpload from '@/components/documents/DocumentUpload'
import DocumentBulkUpload from '@/components/documents/DocumentBulkUpload'
import DocumentList from '@/components/documents/DocumentList'
import CSVTableViewer from '@/components/documents/CSVTableViewer'
import JSONViewer from '@/components/documents/JSONViewer'
import ScraperLauncher from '@/components/scraper/ScraperLauncher'
import TokenMonitor from '@/components/TokenMonitor'
import CampaignRunner from '@/components/campaign/CampaignRunner'
import SetupTab from '@/components/project/SetupTab'
import ResearchPromptsEditor from '@/components/project/ResearchPromptsEditor'
import ShareProjectModal from '@/components/project/ShareProjectModal'
import ExportDataTab from '@/components/project/ExportDataTab'
import ApiKeysConfig from '@/components/settings/ApiKeysConfig'
import NicheFinderPlaybook from '@/components/niche-finder/NicheFinderPlaybook'
import ProjectSidebar from '@/components/project/ProjectSidebar'
import { supabase } from '@/lib/supabase'

type TabType = 'documents' | 'setup' | 'campaigns' | 'export' | 'niche-finder'

interface SiblingProject {
  id: string
  name: string
  playbook_type: string
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
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
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-100 p-4">
            <div className="flex gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 w-28 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function ProjectPage({
  params,
}: {
  params: { projectId: string }
}) {
  const router = useRouter()
  const toast = useToast()
  const modal = useModal()

  const [activeTab, setActiveTab] = useState<TabType | null>(null)
  const { project, userRole, loading: projectLoading, error: projectError } = useProject(params.projectId)
  const { documents, loading: docsLoading, reload: reloadDocs } = useDocuments(params.projectId)
  const [editingProject, setEditingProject] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [savingProject, setSavingProject] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [siblingProjects, setSiblingProjects] = useState<SiblingProject[]>([])

  // Set initial tab based on project type
  useEffect(() => {
    if (project && activeTab === null) {
      setActiveTab(project.playbook_type === 'niche_finder' ? 'niche-finder' : 'documents')
    }
  }, [project, activeTab])

  // Load sidebar collapsed state from localStorage
  useEffect(() => {
    if (project?.client?.id) {
      const saved = localStorage.getItem(`sidebar-collapsed-${project.client.id}`)
      if (saved !== null) {
        setSidebarCollapsed(JSON.parse(saved))
      }
    }
  }, [project?.client?.id])

  // Save sidebar state to localStorage
  const handleSidebarToggle = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    if (project?.client?.id) {
      localStorage.setItem(`sidebar-collapsed-${project.client.id}`, JSON.stringify(newState))
    }
  }

  // Load sibling projects (other projects from same client)
  useEffect(() => {
    const loadSiblingProjects = async () => {
      if (!project?.client?.id) return

      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, name, playbook_type')
          .eq('client_id', project.client.id)
          .order('updated_at', { ascending: false })

        if (error) throw error
        setSiblingProjects(data || [])
      } catch (err) {
        console.error('Error loading sibling projects:', err)
      }
    }

    loadSiblingProjects()
  }, [project?.client?.id])

  // Base tabs available for all projects (Setup unifies Variables + Flow)
  const baseTabs = [
    { id: 'documents' as TabType, label: 'Documentos', icon: FileText, description: 'Base de conocimiento' },
    { id: 'setup' as TabType, label: 'Setup', icon: Sliders, description: 'Variables y flujo' },
    { id: 'campaigns' as TabType, label: 'Campañas', icon: Rocket, description: 'Ejecutar' },
  ]

  // Niche Finder has the same tabs as other projects, plus the niche-finder tab
  const nicheFinderTabs = [
    { id: 'niche-finder' as TabType, label: 'Buscador de Nichos', icon: Search, description: 'Configurar y ejecutar' },
    { id: 'documents' as TabType, label: 'Documentos', icon: FileText, description: 'Base de conocimiento' },
    { id: 'setup' as TabType, label: 'Setup', icon: Sliders, description: 'Variables y flujo' },
    { id: 'campaigns' as TabType, label: 'Campañas', icon: Rocket, description: 'Ejecutar' },
  ]

  // Add Export tab only for ECP projects
  const tabs = project?.playbook_type === 'niche_finder'
    ? nicheFinderTabs
    : project?.playbook_type === 'ecp'
      ? [...baseTabs, { id: 'export' as TabType, label: 'Export', icon: Table2, description: 'Datos consolidados' }]
      : baseTabs

  if (projectLoading || activeTab === null) {
    return <LoadingSkeleton />
  }

  if (projectError || !project) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-red-900 mb-2">Error al cargar el proyecto</h2>
            <p className="text-red-700 mb-6">{projectError || 'Proyecto no encontrado'}</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Home size={18} />
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const totalTokens = documents.reduce((sum, doc) => sum + (doc.token_count || 0), 0)

  const handleEditProject = () => {
    setProjectName(project?.name || '')
    setProjectDescription(project?.description || '')
    setEditingProject(true)
  }

  const handleSaveProject = async () => {
    if (!projectName.trim()) {
      toast.warning('Nombre requerido', 'El nombre del proyecto no puede estar vacío')
      return
    }

    setSavingProject(true)
    try {
      const response = await fetch(`/api/projects/${params.projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription || null,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Guardado', 'Proyecto actualizado')
        setEditingProject(false)
        window.location.reload()
      } else {
        throw new Error(data.error || 'Failed to update')
      }
    } catch (error) {
      console.error('Error updating project:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setSavingProject(false)
    }
  }

  const handleCancelEditProject = () => {
    setEditingProject(false)
    setProjectName('')
    setProjectDescription('')
  }

  const handleDeleteProject = async () => {
    const confirmed = await modal.confirm({
      title: 'Eliminar proyecto',
      message: `¿Estás seguro de que quieres eliminar "${project?.name}"? Se eliminarán todos los documentos, campañas y configuraciones. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      const response = await fetch(`/api/projects/${params.projectId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Eliminado', 'Proyecto eliminado exitosamente')
        router.push('/')
      } else {
        throw new Error(data.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error desconocido')
    }
  }

  // Get current tab info
  const currentTab = tabs.find(t => t.id === activeTab)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex">
      {/* Sidebar */}
      {project.client?.id && (
        <ProjectSidebar
          clientId={project.client.id}
          clientName={project.client.name || 'Cliente'}
          clientIndustry={project.client.industry}
          currentProjectId={params.projectId}
          projects={siblingProjects}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={handleSidebarToggle}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Project Header Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 px-6 py-5">
            <div className="flex items-start justify-between">
              {editingProject ? (
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Nombre del proyecto"
                      className="flex-1 text-xl font-bold text-gray-900 bg-white border-2 border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') handleCancelEditProject()
                      }}
                    />
                    <button
                      onClick={handleSaveProject}
                      disabled={savingProject}
                      className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300"
                      title="Guardar"
                    >
                      <Check size={20} />
                    </button>
                    <button
                      onClick={handleCancelEditProject}
                      disabled={savingProject}
                      className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30"
                      title="Cancelar"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Descripción del proyecto (opcional)"
                    rows={2}
                    className="w-full text-sm text-gray-700 bg-white border-2 border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 backdrop-blur rounded-xl">
                      <FolderOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-white">{project.name}</h1>
                      {project.client?.name && (
                        <p className="text-blue-200 text-sm font-medium mt-0.5">{project.client.name}</p>
                      )}
                      {project.description && (
                        <p className="text-blue-100 mt-1 text-sm max-w-2xl">{project.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="relative" ref={(el) => {
                    if (el && showMenu) {
                      const rect = el.getBoundingClientRect()
                      const menu = el.querySelector('.dropdown-menu') as HTMLElement
                      if (menu) {
                        menu.style.top = `${rect.bottom + 8}px`
                        menu.style.right = `${window.innerWidth - rect.right}px`
                      }
                    }
                  }}>
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <MoreVertical size={20} />
                    </button>
                    {showMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                        <div className="dropdown-menu fixed w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-visible z-50">
                          <button
                            onClick={() => {
                              setShowMenu(false)
                              setShowShareModal(true)
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
                          >
                            <Share2 size={16} />
                            Compartir proyecto
                          </button>
                          <button
                            onClick={() => {
                              setShowMenu(false)
                              handleEditProject()
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
                          >
                            <Edit2 size={16} />
                            Editar proyecto
                          </button>
                          <button
                            onClick={() => {
                              setShowMenu(false)
                              handleDeleteProject()
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 inline-flex items-center gap-2"
                          >
                            <Trash2 size={16} />
                            Eliminar proyecto
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-3 mt-4">
              {project.client?.name && (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  <Building2 className="w-4 h-4 text-blue-200" />
                  <span className="text-sm text-white">{project.client.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <FileText className="w-4 h-4 text-blue-200" />
                <span className="text-sm text-white">{documents.length} documentos</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <Calendar className="w-4 h-4 text-blue-200" />
                <span className="text-sm text-white">
                  Creado {new Date(project.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
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
                      ${isActive
                        ? 'text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                      }
                    `}
                  >
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Icon size={16} className={isActive ? 'text-blue-600' : 'text-gray-500'} />
                    </div>
                    <span>{tab.label}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'documents' && (
              <DocumentsTab
                projectId={params.projectId}
                documents={documents}
                loading={docsLoading}
                onReload={reloadDocs}
                totalTokens={totalTokens}
              />
            )}
            {activeTab === 'setup' && (
              <div className="space-y-8">
                <SetupTab
                  projectId={params.projectId}
                  initialVariables={project.variable_definitions || []}
                  documents={documents}
                  onVariablesUpdate={() => {
                    window.location.reload()
                  }}
                />
                <div className="border-t border-gray-200 pt-6">
                  <ResearchPromptsEditor
                    projectId={params.projectId}
                    initialPrompts={project.deep_research_prompts || []}
                    onUpdate={() => {
                      window.location.reload()
                    }}
                  />
                </div>
                <div className="border-t border-gray-200 pt-6">
                  <ApiKeysConfig />
                </div>
              </div>
            )}
            {activeTab === 'campaigns' && (
              <CampaignRunner projectId={params.projectId} project={project} />
            )}
            {activeTab === 'export' && (
              <ExportDataTab projectId={params.projectId} />
            )}
            {activeTab === 'niche-finder' && (
              <NicheFinderPlaybook projectId={params.projectId} />
            )}
          </div>
        </div>
      </div>

        {/* Share Modal */}
        {showShareModal && (
          <ShareProjectModal
            projectId={params.projectId}
            projectName={project.name}
            onClose={() => setShowShareModal(false)}
          />
        )}
      </main>
    </div>
  )
}

// Tab Components
function DocumentsTab({
  projectId,
  documents,
  loading,
  onReload,
  totalTokens,
}: {
  projectId: string
  documents: any[]
  loading: boolean
  onReload: () => void
  totalTokens: number
}) {
  const toast = useToast()
  const [viewingDoc, setViewingDoc] = useState<any | null>(null)
  const [campaigns, setCampaigns] = useState<Array<{ id: string; ecp_name: string }>>([])
  const [showScraperLauncher, setShowScraperLauncher] = useState(false)

  // Load campaigns for assignment
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const response = await fetch(`/api/campaign/create?projectId=${projectId}`)
        const data = await response.json()
        if (data.success) {
          setCampaigns(data.campaigns || [])
        }
      } catch (error) {
        console.error('Error loading campaigns:', error)
      }
    }
    loadCampaigns()
  }, [projectId])

  const handleDelete = async (docId: string) => {
    try {
      await deleteDocument(docId)
      toast.success('Eliminado', 'Documento eliminado exitosamente')
      onReload()
    } catch (error) {
      toast.error('Error al eliminar', error instanceof Error ? error.message : 'Error desconocido')
    }
  }

  const handleCampaignChange = async (docId: string, campaignId: string | null) => {
    try {
      const response = await fetch('/api/documents', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId: docId, campaignId }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Asignado', 'Documento asignado correctamente')
        onReload()
      } else {
        let errorMsg = data.error || 'Failed to update'
        if (data.details) errorMsg += ` - ${data.details}`
        throw new Error(errorMsg)
      }
    } catch (error) {
      toast.error('Error al asignar', error instanceof Error ? error.message : 'Error desconocido')
    }
  }

  const handleRename = async (docId: string, newName: string) => {
    try {
      const response = await fetch('/api/documents', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId: docId, filename: newName }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Renombrado', 'Nombre del documento actualizado')
        onReload()
      } else {
        let errorMsg = data.error || 'Failed to rename'
        if (data.details) errorMsg += ` - ${data.details}`
        throw new Error(errorMsg)
      }
    } catch (error) {
      toast.error('Error al renombrar', error instanceof Error ? error.message : 'Error desconocido')
      throw error // Re-throw to let DocumentList handle the state
    }
  }

  const tokenBreakdown = documents.map(doc => ({
    label: doc.filename,
    tokens: doc.token_count || 0,
  }))

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Base de Conocimiento</h2>
          <p className="text-sm text-gray-500 mt-1">Gestiona los documentos que alimentan tus prompts</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowScraperLauncher(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm"
          >
            <Globe size={18} />
            <span>Importar datos</span>
          </button>
          <DocumentUpload projectId={projectId} onUploadComplete={onReload} />
          <DocumentBulkUpload projectId={projectId} onUploadComplete={onReload} />
        </div>
      </div>

      {/* Token Monitor */}
      {documents.length > 0 && (
        <div className="mb-6">
          <TokenMonitor totalTokens={totalTokens} breakdown={tokenBreakdown} />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <DocumentList
          documents={documents}
          campaigns={campaigns}
          onDelete={handleDelete}
          onView={setViewingDoc}
          onCampaignChange={handleCampaignChange}
          onRename={handleRename}
        />
      )}

      {/* Document Viewer Modal */}
      {viewingDoc && (() => {
        // Detect content type
        const content = viewingDoc.extracted_content || ''
        const trimmedContent = content.trim()
        const firstLine = content.split('\n')[0] || ''

        // Check if JSON - try to parse it to be sure
        let isJSON = false
        if ((trimmedContent.startsWith('[') || trimmedContent.startsWith('{'))) {
          try {
            JSON.parse(trimmedContent)
            isJSON = true
          } catch {
            // Not valid JSON, check if it looks like JSON array/object anyway
            isJSON = (trimmedContent.startsWith('[') && trimmedContent.includes(']')) ||
                     (trimmedContent.startsWith('{') && trimmedContent.includes('}'))
          }
        }

        // Check if CSV (has commas in first line and multiple columns)
        const isCSV = !isJSON && firstLine.includes(',') && firstLine.split(',').length >= 3

        // Determine format label and icon color
        const formatInfo = isJSON
          ? { label: 'JSON', color: 'blue' }
          : isCSV
            ? { label: 'CSV', color: 'green' }
            : null

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  {formatInfo && (
                    <div className={`p-2 bg-${formatInfo.color}-100 rounded-lg`}>
                      <Table2 size={20} className={`text-${formatInfo.color}-600`} />
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{viewingDoc.filename}</h2>
                    <p className="text-sm text-gray-500">
                      {viewingDoc.token_count?.toLocaleString()} tokens
                      {formatInfo && <span className={`ml-2 text-${formatInfo.color}-600 font-medium`}>• {formatInfo.label}</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 min-h-0 flex-1 bg-gray-50 flex flex-col overflow-hidden">
                {isJSON ? (
                  <JSONViewer content={content} filename={viewingDoc.filename} />
                ) : isCSV ? (
                  <CSVTableViewer content={content} filename={viewingDoc.filename} />
                ) : (
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-white p-4 rounded-xl border border-gray-200 overflow-auto flex-1">
                    {content}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Scraper Launcher Modal */}
      {showScraperLauncher && (
        <ScraperLauncher
          projectId={projectId}
          onComplete={() => {
            setShowScraperLauncher(false)
            onReload()
          }}
          onClose={() => setShowScraperLauncher(false)}
        />
      )}
    </div>
  )
}

function ContextConfigTab({ projectId, project, documents }: { projectId: string; project: any; documents: any[] }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        Configuración de Contexto por Paso
      </h2>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-yellow-800">
          Aquí defines qué documentos se usarán en cada paso del proceso.
          Esto te da control granular sobre qué información ve el modelo en cada etapa.
        </p>
      </div>

      <div className="space-y-6">
        {[
          { key: 'step_1', title: 'Step 1: Find Place', guidance: project.step_1_guidance },
          { key: 'step_2', title: 'Step 2: Select Assets', guidance: project.step_2_guidance },
          { key: 'step_3', title: 'Step 3: Proof Points', guidance: project.step_3_guidance },
          { key: 'step_4', title: 'Step 4: Final Output', guidance: project.step_4_guidance },
        ].map((step) => (
          <div key={step.key} className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium mb-2">{step.title}</h3>
            {step.guidance && (
              <p className="text-sm text-gray-600 mb-3 bg-blue-50 border border-blue-100 rounded p-2">
                {step.guidance}
              </p>
            )}
            <div className="text-sm text-gray-700">
              <p className="mb-2 font-medium">Documentos disponibles:</p>
              {documents.length === 0 ? (
                <p className="text-gray-500 italic">No hay documentos todavía. Sube algunos en la pestaña &quot;Documentos&quot;.</p>
              ) : (
                <ul className="space-y-1">
                  {documents.map(doc => (
                    <li key={doc.id} className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" id={`${step.key}-${doc.id}`} />
                      <label htmlFor={`${step.key}-${doc.id}`} className="text-sm">
                        {doc.filename} <span className="text-gray-400">({doc.category})</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <button className="mt-3 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                Guardar Selección
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PromptsConfigTab({ projectId, project }: { projectId: string; project: any }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Prompts Maestros</h2>
      <p className="text-gray-600 mb-6">
        Edita los prompts que se usarán en cada paso del proceso
      </p>
      <div className="space-y-4">
        {[
          { label: 'Deep Research', value: project.prompt_deep_research },
          { label: 'Step 1: Find Place', value: project.prompt_1_find_place },
          { label: 'Step 2: Select Assets', value: project.prompt_2_select_assets },
          { label: 'Step 3: Proof Points', value: project.prompt_3_proof_legit },
          { label: 'Step 4: Final Output', value: project.prompt_4_final_output },
        ].map((prompt) => (
          <div key={prompt.label} className="border border-gray-200 rounded-lg p-4">
            <label className="block font-medium mb-2">{prompt.label}</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              rows={6}
              defaultValue={prompt.value}
            />
          </div>
        ))}
      </div>
      <div className="mt-6">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Guardar Cambios
        </button>
      </div>
    </div>
  )
}
