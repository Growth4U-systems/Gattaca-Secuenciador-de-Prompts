'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText, Rocket, Sliders, X, Home, FolderOpen, Calendar,
  MoreVertical, Building2, Table2, Globe, Search, List, Plus,
  ChevronLeft, Folder, Pencil, Check, Trash2, FolderOutput
} from 'lucide-react'
import { useToast, useModal } from '@/components/ui'
import { useProject } from '@/hooks/useProjects'
import { useProjectPlaybooks } from '@/hooks/useProjectPlaybooks'
import { useDocuments, deleteDocument, canDeleteDocument, updateDocumentFolder, getFolders } from '@/hooks/useDocuments'
import DocumentUpload from '@/components/documents/DocumentUpload'
import DocumentBulkUpload from '@/components/documents/DocumentBulkUpload'
import DocumentList from '@/components/documents/DocumentList'
import DocumentFolderView from '@/components/documents/DocumentFolderView'
import CSVTableViewer from '@/components/documents/CSVTableViewer'
import JSONViewer from '@/components/documents/JSONViewer'
import ScraperLauncher from '@/components/scraper/ScraperLauncher'
import TokenMonitor from '@/components/TokenMonitor'
import CampaignRunner from '@/components/campaign/CampaignRunner'
import SetupTab from '@/components/project/SetupTab'
import ExportDataTab from '@/components/project/ExportDataTab'
import NicheFinderPlaybookV2 from '@/components/niche-finder/NicheFinderPlaybookV2'
import SignalBasedOutreachPlaybook from '@/components/signal-outreach/SignalBasedOutreachPlaybook'
import { VideoViralIAPlaybook } from '@/components/video-viral-ia'
import ClientSidebar from '@/components/layout/ClientSidebar'
import { PlaybookShell } from '@/components/playbook'
import { getPlaybookConfig } from '@/components/playbook/configs'
import { useScraperRecovery } from '@/hooks/useScraperRecovery'
import { CompetitorAnalysisView } from '@/components/scraper-dashboard'

type TabType = 'main' | 'documents' | 'setup' | 'campaigns' | 'export'

// Playbook display names
const PLAYBOOK_NAMES: Record<string, string> = {
  'niche_finder': 'Buscador de Nichos',
  'signal_based_outreach': 'Signal Outreach',
  'video_viral_ia': 'Video Viral IA',
  'seo-seed-keywords': 'SEO Keywords',
  'linkedin-post-generator': 'LinkedIn Posts',
  'github-fork-to-crm': 'Fork → CRM',
  'ecp': 'ECP Positioning',
  'competitor_analysis': 'Competitor Analysis',
  'competitor-analysis': 'Competitor Analysis',
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
              {[1, 2, 3].map((i) => (
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

export default function PlaybookPage({
  params,
}: {
  params: { projectId: string; playbookType: string }
}) {
  const router = useRouter()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<TabType>('main')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)
  const [showPlaybookMenu, setShowPlaybookMenu] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [availableProjects, setAvailableProjects] = useState<Array<{ id: string; name: string; client_name?: string }>>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [selectedTargetProject, setSelectedTargetProject] = useState<string | null>(null)
  const { project, loading: projectLoading, error: projectError } = useProject(params.projectId)
  const { documents, loading: docsLoading, reload: reloadDocs } = useDocuments(params.projectId)
  const { playbooks: projectPlaybooks, loading: playbooksLoading, hasPlaybook, getPlaybookById, updatePlaybook, removePlaybook } = useProjectPlaybooks(params.projectId)

  // Auto-recover stale scraper jobs when page loads
  useScraperRecovery(params.projectId, (result) => {
    if (result.recovered > 0) {
      toast.success(`Se recuperaron ${result.recovered} scraper(s) que estaban pendientes`)
      reloadDocs() // Reload documents to show newly recovered ones
    }
  })

  // The URL param can be either a UUID (new style) or playbook type (legacy)
  const paramValue = decodeURIComponent(params.playbookType)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paramValue)

  // Find the playbook - by ID if UUID, by type if legacy
  const currentPlaybook = isUUID
    ? getPlaybookById(paramValue)
    : projectPlaybooks.find(p =>
        p.playbook_type === paramValue ||
        p.playbook_type === paramValue.replace('_', '-') ||
        p.playbook_type === paramValue.replace('-', '_')
      )

  const playbookType = currentPlaybook?.playbook_type || paramValue
  const playbookName = currentPlaybook?.name || PLAYBOOK_NAMES[playbookType] || playbookType
  const playbookId = currentPlaybook?.id

  // Get playbook config from template
  const templateConfig = getPlaybookConfig(playbookType)
    || getPlaybookConfig(playbookType.replace('_', '-'))
    || getPlaybookConfig(playbookType.replace('-', '_'))

  // Use flow_config from database if available, otherwise from template
  const playbookConfig = templateConfig && currentPlaybook?.config?.flow_config
    ? { ...templateConfig, flow_config: currentPlaybook.config.flow_config }
    : templateConfig

  // Check if this playbook is associated with the project
  const isPlaybookAssociated = !!currentPlaybook || hasPlaybook(playbookType)
    || hasPlaybook(playbookType.replace('_', '-'))
    || hasPlaybook(playbookType.replace('-', '_'))

  // Handle saving the playbook name
  const handleSaveName = async () => {
    if (!playbookId || !editedName.trim() || editedName === playbookName) {
      setIsEditingName(false)
      return
    }

    setIsSavingName(true)
    try {
      await updatePlaybook(playbookId, { name: editedName.trim() })
      toast.success('Nombre actualizado')
      setIsEditingName(false)
    } catch (error) {
      console.error('Error updating playbook name:', error)
      toast.error('Error al actualizar el nombre')
    } finally {
      setIsSavingName(false)
    }
  }

  // Handle deleting the playbook
  const handleDeletePlaybook = async () => {
    if (!playbookId) return

    setIsDeleting(true)
    try {
      await removePlaybook(playbookId)
      toast.success('Playbook eliminado')
      setShowDeleteConfirm(false)
      // Navigate back to project
      router.push(`/projects/${params.projectId}`)
    } catch (error) {
      console.error('Error deleting playbook:', error)
      toast.error('Error al eliminar el playbook')
    } finally {
      setIsDeleting(false)
    }
  }

  // Load available projects for move modal
  const loadAvailableProjects = async () => {
    setLoadingProjects(true)
    try {
      // Get all projects the user has access to
      const response = await fetch('/api/projects')
      const data = await response.json()
      if (data.success && data.projects) {
        // Filter out the current project
        const otherProjects = data.projects.filter((p: any) => p.id !== params.projectId)
        setAvailableProjects(otherProjects.map((p: any) => ({
          id: p.id,
          name: p.name,
          client_name: p.client?.name,
        })))
      }
    } catch (error) {
      console.error('Error loading projects:', error)
      toast.error('Error al cargar proyectos')
    } finally {
      setLoadingProjects(false)
    }
  }

  // Handle moving playbook to another project
  const handleMovePlaybook = async () => {
    if (!playbookId || !selectedTargetProject) return

    setIsMoving(true)
    try {
      // Call API to move the playbook
      const response = await fetch(`/api/projects/${params.projectId}/playbooks/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playbookId,
          targetProjectId: selectedTargetProject,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to move playbook')
      }

      toast.success('Playbook movido exitosamente')
      setShowMoveModal(false)
      // Navigate to the playbook in the new project
      router.push(`/projects/${selectedTargetProject}/playbooks/${playbookId}`)
    } catch (error) {
      console.error('Error moving playbook:', error)
      toast.error('Error al mover el playbook')
    } finally {
      setIsMoving(false)
    }
  }

  // Determine which tabs to show based on playbook type
  const getTabsForPlaybook = () => {
    // Playbooks with unified main view (have their own component)
    const unifiedPlaybooks = ['niche_finder', 'signal_based_outreach', 'video_viral_ia']
    const hasUnifiedView = unifiedPlaybooks.includes(playbookType)

    // Playbooks using PlaybookShell (config-driven)
    const shellPlaybooks = ['seo-seed-keywords', 'linkedin-post-generator', 'github-fork-to-crm']
    const usesShell = shellPlaybooks.includes(playbookType)

    // Standard playbooks (ecp only now - competitor_analysis has its own view)
    const standardPlaybooks = ['ecp']
    const isStandard = standardPlaybooks.includes(playbookType)

    // Competitor Analysis uses new competitor-centric view (no tabs)
    const isCompetitorAnalysis = ['competitor_analysis', 'competitor-analysis'].includes(playbookType)
    if (isCompetitorAnalysis) {
      return [
        { id: 'main' as TabType, label: 'Competidores', icon: Rocket, description: 'Análisis de competidores' },
        { id: 'documents' as TabType, label: 'Documentos', icon: FileText, description: 'Context Lake' },
      ]
    }

    if (hasUnifiedView) {
      return [
        { id: 'main' as TabType, label: playbookName, icon: Rocket, description: 'Configurar y ejecutar' },
        { id: 'documents' as TabType, label: 'Documentos', icon: FileText, description: 'Base de conocimiento' },
      ]
    }

    if (usesShell && playbookConfig) {
      return [
        { id: 'main' as TabType, label: playbookName, icon: Rocket, description: 'Configurar y ejecutar' },
        { id: 'documents' as TabType, label: 'Documentos', icon: FileText, description: 'Base de conocimiento' },
      ]
    }

    // Standard playbooks with setup/campaigns tabs
    const tabs = [
      { id: 'setup' as TabType, label: 'Setup', icon: Sliders, description: 'Variables y flujo' },
      { id: 'campaigns' as TabType, label: 'Campañas', icon: Rocket, description: 'Ejecutar' },
      { id: 'documents' as TabType, label: 'Documentos', icon: FileText, description: 'Base de conocimiento' },
    ]

    if (playbookType === 'ecp') {
      tabs.push({ id: 'export' as TabType, label: 'Export', icon: Table2, description: 'Datos consolidados' })
    }

    return tabs
  }

  const tabs = getTabsForPlaybook()

  // Set initial tab
  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id)
    }
  }, [tabs, activeTab])

  if (projectLoading || playbooksLoading) {
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

  // Playbook not associated with project
  if (!isPlaybookAssociated && !playbooksLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-8 h-8 text-yellow-600" />
            </div>
            <h2 className="text-xl font-semibold text-yellow-900 mb-2">Playbook no asociado</h2>
            <p className="text-yellow-700 mb-6">
              El playbook "{playbookName}" no está asociado a este proyecto.
            </p>
            <Link
              href={`/projects/${params.projectId}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              <ChevronLeft size={18} />
              Volver al proyecto
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const totalTokens = documents.reduce((sum, doc) => sum + (doc.token_count || 0), 0)

  // Create client object for sidebar
  const clientForSidebar = project.client ? {
    id: project.client.id,
    name: project.client.name,
    industry: project.client.industry || null,
    status: 'active' as const,
  } : null

  // Render main content based on playbook type
  const renderMainContent = () => {
    switch (playbookType) {
      case 'niche_finder':
        return <NicheFinderPlaybookV2 projectId={params.projectId} />
      case 'signal_based_outreach':
        return <SignalBasedOutreachPlaybook projectId={params.projectId} />
      case 'video_viral_ia':
        return <VideoViralIAPlaybook projectId={params.projectId} />
      case 'competitor_analysis':
      case 'competitor-analysis':
        return <CompetitorAnalysisView projectId={params.projectId} playbookId={playbookId} />
      case 'seo-seed-keywords':
      case 'linkedin-post-generator':
      case 'github-fork-to-crm':
        if (playbookConfig) {
          return <PlaybookShell projectId={params.projectId} playbookConfig={playbookConfig} />
        }
        return <div className="text-gray-500">Configuración del playbook no disponible</div>
      default:
        // Standard playbooks don't have a "main" tab
        return null
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex">
      {/* Sidebar */}
      {clientForSidebar && (
        <ClientSidebar
          client={clientForSidebar}
          currentProjectId={params.projectId}
          currentPlaybookId={playbookId}
          currentPlaybookType={playbookType}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Breadcrumb */}
          <div className="mb-4">
            <Link
              href={`/projects/${params.projectId}`}
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ChevronLeft size={16} />
              <span>Volver a {project.name}</span>
            </Link>
          </div>

          {/* Playbook Header Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 px-6 py-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 backdrop-blur rounded-xl">
                    <Rocket className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    {isEditingName ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="text-2xl font-bold bg-white/20 text-white placeholder:text-white/50 border border-white/30 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-white/50"
                          placeholder="Nombre del playbook"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveName()
                            } else if (e.key === 'Escape') {
                              setIsEditingName(false)
                            }
                          }}
                        />
                        <button
                          onClick={handleSaveName}
                          disabled={isSavingName || !editedName.trim()}
                          className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
                          title="Guardar nombre"
                        >
                          {isSavingName ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Check className="w-5 h-5 text-white" />
                          )}
                        </button>
                        <button
                          onClick={() => setIsEditingName(false)}
                          className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                          title="Cancelar"
                        >
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h1
                          className="text-2xl font-bold text-white cursor-pointer hover:underline"
                          onClick={() => {
                            if (playbookId) {
                              setEditedName(playbookName)
                              setIsEditingName(true)
                            }
                          }}
                          title={playbookId ? "Haz clic para editar el nombre" : ""}
                        >
                          {playbookName}
                        </h1>
                        {playbookId && (
                          <button
                            onClick={() => {
                              setEditedName(playbookName)
                              setIsEditingName(true)
                            }}
                            className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
                            title="Editar nombre"
                          >
                            <Pencil className="w-4 h-4 text-white" />
                          </button>
                        )}
                      </div>
                    )}
                    <p className="text-indigo-200 text-sm font-medium mt-0.5">
                      {project.name}
                      {project.client?.name && ` • ${project.client.name}`}
                    </p>
                  </div>
                </div>

                {/* Playbook Actions Menu */}
                {playbookId && (
                  <div className="relative">
                    <button
                      onClick={() => setShowPlaybookMenu(!showPlaybookMenu)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      title="Opciones del playbook"
                    >
                      <MoreVertical className="w-5 h-5 text-white" />
                    </button>

                    {showPlaybookMenu && (
                      <>
                        {/* Backdrop */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowPlaybookMenu(false)}
                        />
                        {/* Menu */}
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-20">
                          <button
                            onClick={() => {
                              setShowPlaybookMenu(false)
                              loadAvailableProjects()
                              setShowMoveModal(true)
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                          >
                            <FolderOutput size={18} className="text-gray-400" />
                            Mover a otro proyecto
                          </button>
                          <hr className="my-2 border-gray-100" />
                          <button
                            onClick={() => {
                              setShowPlaybookMenu(false)
                              setShowDeleteConfirm(true)
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                          >
                            <Trash2 size={18} />
                            Eliminar playbook
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-3 mt-4">
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  <FileText className="w-4 h-4 text-indigo-200" />
                  <span className="text-sm text-white">{documents.length} documentos</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  <Calendar className="w-4 h-4 text-indigo-200" />
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
                          ? 'text-indigo-600'
                          : 'text-gray-500 hover:text-gray-700'
                        }
                      `}
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
              {activeTab === 'main' && renderMainContent()}

              {activeTab === 'documents' && (
                <DocumentsTab
                  projectId={params.projectId}
                  playbookType={playbookType}
                  documents={documents}
                  loading={docsLoading}
                  onReload={reloadDocs}
                  totalTokens={totalTokens}
                />
              )}

              {activeTab === 'setup' && (
                <div className="space-y-8">
                  {/* Show warning if no flow_config */}
                  {!currentPlaybook?.config?.flow_config?.steps && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-yellow-800 mb-2">Flujo no configurado</h3>
                      <p className="text-yellow-700">
                        Este playbook no tiene un flujo de pasos configurado.
                        Elimina el playbook y agrégalo nuevamente para cargar la configuración.
                      </p>
                    </div>
                  )}

                  <SetupTab
                    projectId={params.projectId}
                    clientId={project.client?.id || ''}
                    initialVariables={project.variable_definitions || []}
                    documents={documents}
                    onVariablesUpdate={() => {
                      window.location.reload()
                    }}
                    playbookFlowConfig={currentPlaybook?.config?.flow_config}
                  />
                </div>
              )}

              {activeTab === 'campaigns' && (
                <CampaignRunner
                  projectId={params.projectId}
                  project={project}
                  playbookType={playbookType}
                  playbookConfig={currentPlaybook?.config}
                />
              )}

              {activeTab === 'export' && (
                <ExportDataTab projectId={params.projectId} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-100 rounded-xl">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Eliminar Playbook</h2>
                  <p className="text-sm text-gray-500">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                ¿Estás seguro de que deseas eliminar el playbook <strong>"{playbookName}"</strong>?
                Los documentos asociados permanecerán en el proyecto.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                  disabled={isDeleting}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeletePlaybook}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      Eliminar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move to Another Project Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FolderOutput className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Mover Playbook</h2>
              </div>
              <button
                onClick={() => {
                  setShowMoveModal(false)
                  setSelectedTargetProject(null)
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Selecciona el proyecto destino para mover <strong>"{playbookName}"</strong>:
              </p>

              {loadingProjects ? (
                <div className="py-8 text-center">
                  <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Cargando proyectos...</p>
                </div>
              ) : availableProjects.length === 0 ? (
                <div className="py-8 text-center bg-gray-50 rounded-xl">
                  <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No hay otros proyectos disponibles</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableProjects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedTargetProject(p.id)}
                      className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
                        selectedTargetProject === p.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{p.name}</div>
                      {p.client_name && (
                        <div className="text-sm text-gray-500 mt-0.5">{p.client_name}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowMoveModal(false)
                    setSelectedTargetProject(null)
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                  disabled={isMoving}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleMovePlaybook}
                  disabled={isMoving || !selectedTargetProject}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isMoving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Moviendo...
                    </>
                  ) : (
                    <>
                      <FolderOutput size={18} />
                      Mover
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// Documents Tab Component
function DocumentsTab({
  projectId,
  playbookType,
  documents,
  loading,
  onReload,
  totalTokens,
}: {
  projectId: string
  playbookType: string
  documents: any[]
  loading: boolean
  onReload: () => void
  totalTokens: number
}) {
  const toast = useToast()
  const [viewingDoc, setViewingDoc] = useState<any | null>(null)
  const [campaigns, setCampaigns] = useState<Array<{ id: string; ecp_name: string }>>([])
  const [showScraperLauncher, setShowScraperLauncher] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'folders'>('list')
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [manualFolders, setManualFolders] = useState<string[]>([])

  const existingFolders = [...new Set([...getFolders(documents), ...manualFolders])].sort()

  // Load campaigns for this playbook type
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const response = await fetch(`/api/campaign/create?projectId=${projectId}`)
        const data = await response.json()
        if (data.success) {
          // Filter campaigns by playbook type
          const filteredCampaigns = (data.campaigns || []).filter(
            (c: any) => c.playbook_type === playbookType ||
                       c.playbook_type === playbookType.replace('_', '-') ||
                       c.playbook_type === playbookType.replace('-', '_')
          )
          setCampaigns(filteredCampaigns)
        }
      } catch (error) {
        console.error('Error loading campaigns:', error)
      }
    }
    loadCampaigns()
  }, [projectId, playbookType])

  const handleDelete = async (docId: string) => {
    try {
      const { canDelete, referenceCount, referencingProjects } = await canDeleteDocument(docId)
      if (!canDelete) {
        toast.error(
          'No se puede eliminar',
          `Este documento tiene ${referenceCount} referencia(s) en: ${referencingProjects.join(', ')}`
        )
        return
      }

      await deleteDocument(docId)
      toast.success('Eliminado', 'Documento eliminado exitosamente')
      onReload()
    } catch (error) {
      toast.error('Error al eliminar', error instanceof Error ? error.message : 'Error desconocido')
    }
  }

  const handleMoveToFolder = async (docId: string, folder: string | null) => {
    try {
      await updateDocumentFolder(docId, folder)
      toast.success('Movido', folder ? `Documento movido a "${folder}"` : 'Documento movido a Sin carpeta')
      onReload()
    } catch (error) {
      toast.error('Error', 'No se pudo mover el documento')
    }
  }

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return
    const folderName = newFolderName.trim()
    setManualFolders(prev => [...new Set([...prev, folderName])])
    setShowNewFolderInput(false)
    toast.success('Carpeta creada', `La carpeta "${folderName}" está lista.`)
    setNewFolderName('')
  }

  const handleCampaignChange = async (docId: string, campaignId: string | null) => {
    try {
      const response = await fetch('/api/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, campaignId }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Asignado', 'Documento asignado correctamente')
        onReload()
      } else {
        throw new Error(data.error || 'Failed to update')
      }
    } catch (error) {
      toast.error('Error al asignar', error instanceof Error ? error.message : 'Error desconocido')
    }
  }

  const handleRename = async (docId: string, newName: string) => {
    try {
      const response = await fetch('/api/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, filename: newName }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Renombrado', 'Nombre del documento actualizado')
        onReload()
      } else {
        throw new Error(data.error || 'Failed to rename')
      }
    } catch (error) {
      toast.error('Error al renombrar', error instanceof Error ? error.message : 'Error desconocido')
      throw error
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
          <p className="text-sm text-gray-500 mt-1">Documentos para este playbook</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Vista lista"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('folders')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'folders'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Vista carpetas"
            >
              <Folder size={16} />
            </button>
          </div>

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

      {/* Create Folder (only in folder view) */}
      {viewMode === 'folders' && (
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
      ) : viewMode === 'folders' ? (
        <DocumentFolderView
          documents={documents}
          onDocumentClick={setViewingDoc}
          onMoveToFolder={handleMoveToFolder}
          showCreateFolder={false}
          emptyMessage="No hay documentos en este playbook"
          emptyFolders={manualFolders}
        />
      ) : (
        <DocumentList
          documents={documents}
          campaigns={campaigns}
          onDelete={handleDelete}
          onView={setViewingDoc}
          onCampaignChange={handleCampaignChange}
          onRename={handleRename}
          onMoveToFolder={handleMoveToFolder}
          availableFolders={existingFolders}
        />
      )}

      {/* Document Viewer Modal */}
      {viewingDoc && (() => {
        const content = viewingDoc.extracted_content || ''
        const trimmedContent = content.trim()
        const firstLine = content.split('\n')[0] || ''

        let isJSON = false
        if ((trimmedContent.startsWith('[') || trimmedContent.startsWith('{'))) {
          try {
            JSON.parse(trimmedContent)
            isJSON = true
          } catch {
            isJSON = (trimmedContent.startsWith('[') && trimmedContent.includes(']')) ||
                     (trimmedContent.startsWith('{') && trimmedContent.includes('}'))
          }
        }

        const isCSV = !isJSON && firstLine.includes(',') && firstLine.split(',').length >= 3

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
