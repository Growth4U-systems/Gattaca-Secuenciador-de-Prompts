'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  FileText, Rocket, Edit2, Check, X, Trash2, Home, FolderOpen, Calendar,
  MoreVertical, Share2, Building2, Plus, ChevronRight, Search, Users, Video,
  Linkedin, GitFork, KeyRound, Zap
} from 'lucide-react'
import { useToast, useModal } from '@/components/ui'
import { useProject } from '@/hooks/useProjects'
import { useProjectPlaybooks } from '@/hooks/useProjectPlaybooks'
import { useDocuments } from '@/hooks/useDocuments'
import ClientSidebar from '@/components/layout/ClientSidebar'
import ShareProjectModal from '@/components/project/ShareProjectModal'

// Playbook metadata for display
const PLAYBOOK_INFO: Record<string, { name: string; description: string; icon: any; color: string }> = {
  'ecp': {
    name: 'ECP Positioning',
    description: 'Estrategia de posicionamiento basada en el framework ECP',
    icon: Zap,
    color: 'blue',
  },
  'competitor_analysis': {
    name: 'Competitor Analysis',
    description: 'Análisis profundo de competidores y oportunidades de mercado',
    icon: Search,
    color: 'purple',
  },
  'competitor-analysis': {
    name: 'Competitor Analysis',
    description: 'Análisis profundo de competidores y oportunidades de mercado',
    icon: Search,
    color: 'purple',
  },
  'niche_finder': {
    name: 'Buscador de Nichos',
    description: 'Descubre nichos de mercado rentables',
    icon: Search,
    color: 'green',
  },
  'signal_based_outreach': {
    name: 'Signal Outreach',
    description: 'Outreach basado en señales de compra',
    icon: Users,
    color: 'orange',
  },
  'video_viral_ia': {
    name: 'Video Viral IA',
    description: 'Crear videos virales con IA',
    icon: Video,
    color: 'red',
  },
  'seo-seed-keywords': {
    name: 'SEO Keywords',
    description: 'Generar keywords SEO desde ICP',
    icon: KeyRound,
    color: 'teal',
  },
  'linkedin-post-generator': {
    name: 'LinkedIn Posts',
    description: 'Generar posts virales para LinkedIn',
    icon: Linkedin,
    color: 'sky',
  },
  'github-fork-to-crm': {
    name: 'Fork → CRM',
    description: 'Convertir forks de GitHub en leads',
    icon: GitFork,
    color: 'gray',
  },
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </main>
  )
}

function ProjectPageContent({
  params,
}: {
  params: { projectId: string }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const modal = useModal()

  const { project, loading: projectLoading, error: projectError } = useProject(params.projectId)
  const { documents } = useDocuments(params.projectId)
  const {
    playbooks: projectPlaybooks,
    loading: playbooksLoading,
    addPlaybook,
    removePlaybook,
    hasPlaybook,
    reload: reloadPlaybooks
  } = useProjectPlaybooks(params.projectId)

  const [showAddPlaybookModal, setShowAddPlaybookModal] = useState(false)
  const [autoAddingPlaybook, setAutoAddingPlaybook] = useState(false)
  const [selectedPlaybookType, setSelectedPlaybookType] = useState<string | null>(null)
  const [playbookName, setPlaybookName] = useState('')
  const [addingPlaybook, setAddingPlaybook] = useState(false)

  // Handle addPlaybook query parameter - auto-add playbook and navigate
  const addPlaybookParam = searchParams.get('addPlaybook')

  useEffect(() => {
    if (addPlaybookParam && !projectLoading && !playbooksLoading && !autoAddingPlaybook && project) {
      const handleAutoAddPlaybook = async () => {
        setAutoAddingPlaybook(true)
        try {
          // Check if playbook already exists
          if (!hasPlaybook(addPlaybookParam)) {
            const info = PLAYBOOK_INFO[addPlaybookParam]
            const defaultName = info?.name || addPlaybookParam
            const newPlaybook = await addPlaybook(addPlaybookParam, defaultName)
            toast.success('Playbook agregado', 'El playbook se ha agregado al proyecto')
            // Navigate to the new playbook using its ID
            if (newPlaybook?.id) {
              router.replace(`/projects/${params.projectId}/playbooks/${newPlaybook.id}`)
              return
            }
          }
          // Navigate to the playbook page (which has the campaign runner/wizard)
          router.replace(`/projects/${params.projectId}/playbooks/${addPlaybookParam}`)
        } catch (error) {
          console.error('Error adding playbook:', error)
          toast.error('Error', 'No se pudo agregar el playbook')
          // Clear the query param on error
          router.replace(`/projects/${params.projectId}`)
        }
      }
      handleAutoAddPlaybook()
    }
  }, [addPlaybookParam, projectLoading, playbooksLoading, autoAddingPlaybook, project, hasPlaybook, addPlaybook, toast, router, params.projectId])
  const [availablePlaybooks, setAvailablePlaybooks] = useState<Array<{ id: string; name: string; playbook_type: string; description: string }>>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [editingProject, setEditingProject] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [savingProject, setSavingProject] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)

  // Load available playbooks when modal opens
  useEffect(() => {
    if (showAddPlaybookModal && availablePlaybooks.length === 0) {
      setLoadingAvailable(true)
      fetch('/api/v2/playbooks')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setAvailablePlaybooks(data.playbooks || [])
          }
        })
        .catch(console.error)
        .finally(() => setLoadingAvailable(false))
    }
  }, [showAddPlaybookModal, availablePlaybooks.length])

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
        headers: { 'Content-Type': 'application/json' },
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

  const handleAddPlaybookWithName = async () => {
    if (!selectedPlaybookType || !playbookName.trim()) return

    setAddingPlaybook(true)
    try {
      const newPlaybook = await addPlaybook(selectedPlaybookType, playbookName.trim())
      toast.success('Playbook agregado', `${playbookName} agregado al proyecto`)
      setShowAddPlaybookModal(false)
      setSelectedPlaybookType(null)
      setPlaybookName('')
      // Navigate to the new playbook
      if (newPlaybook?.id) {
        router.push(`/projects/${params.projectId}/playbooks/${newPlaybook.id}`)
      }
    } catch (err: any) {
      if (err?.message?.includes('already exists')) {
        toast.error('Nombre duplicado', 'Ya existe un playbook con ese nombre en este proyecto')
      } else {
        toast.error('Error', 'No se pudo agregar el playbook')
      }
    } finally {
      setAddingPlaybook(false)
    }
  }

  const handleRemovePlaybook = async (playbookId: string, playbookName: string) => {
    const confirmed = await modal.confirm({
      title: 'Quitar playbook',
      message: `¿Estás seguro de que quieres quitar "${playbookName}" del proyecto? Las campañas asociadas no se eliminarán.`,
      confirmText: 'Quitar',
      cancelText: 'Cancelar',
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      await removePlaybook(playbookId)
      toast.success('Playbook eliminado', `Playbook eliminado del proyecto`)
    } catch (err) {
      toast.error('Error', 'No se pudo eliminar el playbook')
    }
  }

  // Create client object for sidebar
  const clientForSidebar = project.client ? {
    id: project.client.id,
    name: project.client.name,
    industry: project.client.industry || null,
    status: 'active' as const,
  } : null

  // Get color classes for playbook cards
  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string; hover: string }> = {
      blue: { bg: 'from-blue-500 to-blue-600', icon: 'text-blue-100', hover: 'hover:from-blue-600 hover:to-blue-700' },
      purple: { bg: 'from-purple-500 to-purple-600', icon: 'text-purple-100', hover: 'hover:from-purple-600 hover:to-purple-700' },
      green: { bg: 'from-green-500 to-green-600', icon: 'text-green-100', hover: 'hover:from-green-600 hover:to-green-700' },
      orange: { bg: 'from-orange-500 to-orange-600', icon: 'text-orange-100', hover: 'hover:from-orange-600 hover:to-orange-700' },
      red: { bg: 'from-red-500 to-red-600', icon: 'text-red-100', hover: 'hover:from-red-600 hover:to-red-700' },
      teal: { bg: 'from-teal-500 to-teal-600', icon: 'text-teal-100', hover: 'hover:from-teal-600 hover:to-teal-700' },
      sky: { bg: 'from-sky-500 to-sky-600', icon: 'text-sky-100', hover: 'hover:from-sky-600 hover:to-sky-700' },
      gray: { bg: 'from-gray-600 to-gray-700', icon: 'text-gray-200', hover: 'hover:from-gray-700 hover:to-gray-800' },
    }
    return colors[color] || colors.blue
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex">
      {/* Sidebar */}
      {clientForSidebar && (
        <ClientSidebar client={clientForSidebar} currentProjectId={params.projectId} />
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Project Header Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
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
                    <div className="relative">
                      <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                      >
                        <MoreVertical size={20} />
                      </button>
                      {showMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                          <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1">
                            <button
                              onClick={() => {
                                setShowMenu(false)
                                setShowShareModal(true)
                              }}
                              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
                            >
                              <Share2 size={16} />
                              Compartir proyecto
                            </button>
                            <button
                              onClick={() => {
                                setShowMenu(false)
                                handleEditProject()
                              }}
                              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
                            >
                              <Edit2 size={16} />
                              Editar proyecto
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            <button
                              onClick={() => {
                                setShowMenu(false)
                                handleDeleteProject()
                              }}
                              className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 inline-flex items-center gap-2"
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
                  <Rocket className="w-4 h-4 text-blue-200" />
                  <span className="text-sm text-white">{projectPlaybooks.length} playbooks</span>
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

          {/* Playbooks Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Playbooks</h2>
              <button
                onClick={() => setShowAddPlaybookModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus size={18} />
                Agregar playbook
              </button>
            </div>

            {projectPlaybooks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Rocket className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Sin playbooks</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Los playbooks definen flujos de trabajo para generar contenido y análisis.
                  Agrega un playbook para comenzar.
                </p>
                <button
                  onClick={() => setShowAddPlaybookModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  <Plus size={18} />
                  Agregar primer playbook
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {projectPlaybooks.map((pb) => {
                  const info = PLAYBOOK_INFO[pb.playbook_type] || {
                    name: pb.playbook_type,
                    description: 'Playbook personalizado',
                    icon: Rocket,
                    color: 'blue',
                  }
                  const Icon = info.icon
                  const colors = getColorClasses(info.color)
                  const displayName = pb.name || info.name

                  return (
                    <div
                      key={pb.id}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group"
                    >
                      <Link
                        href={`/projects/${params.projectId}/playbooks/${pb.id}`}
                        className={`block p-6 bg-gradient-to-r ${colors.bg} ${colors.hover} transition-all`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="p-2 bg-white/20 backdrop-blur rounded-xl">
                            <Icon className={`w-6 h-6 ${colors.icon}`} />
                          </div>
                          <ChevronRight className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
                        </div>
                        <h3 className="text-lg font-semibold text-white mt-4">{displayName}</h3>
                        <p className="text-white/80 text-sm mt-1 line-clamp-2">{info.description}</p>
                      </Link>
                      <div className="px-6 py-3 bg-gray-50 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Agregado el {new Date(pb.created_at).toLocaleDateString('es-ES')}
                        </span>
                        <button
                          onClick={() => handleRemovePlaybook(pb.id, displayName)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Quitar playbook"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
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

      {/* Add Playbook Modal */}
      {showAddPlaybookModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedPlaybookType ? 'Nombrar Playbook' : 'Agregar Playbook'}
              </h2>
              <button
                onClick={() => {
                  setShowAddPlaybookModal(false)
                  setSelectedPlaybookType(null)
                  setPlaybookName('')
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {loadingAvailable ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : selectedPlaybookType ? (
                // Step 2: Enter name for the playbook
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Dale un nombre a este playbook. Puedes tener múltiples playbooks del mismo tipo
                    (por ejemplo, "Análisis de Competidor A" y "Análisis de Competidor B").
                  </p>
                  <div>
                    <label htmlFor="playbook-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del playbook
                    </label>
                    <input
                      id="playbook-name"
                      type="text"
                      value={playbookName}
                      onChange={(e) => setPlaybookName(e.target.value)}
                      placeholder={PLAYBOOK_INFO[selectedPlaybookType]?.name || selectedPlaybookType}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && playbookName.trim()) {
                          e.preventDefault()
                          handleAddPlaybookWithName()
                        }
                      }}
                    />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => {
                        setSelectedPlaybookType(null)
                        setPlaybookName('')
                      }}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Volver
                    </button>
                    <button
                      onClick={handleAddPlaybookWithName}
                      disabled={!playbookName.trim() || addingPlaybook}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                      {addingPlaybook ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Agregando...
                        </>
                      ) : (
                        <>
                          <Plus size={18} />
                          Agregar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                // Step 1: Select playbook type
                <div className="space-y-2">
                  {availablePlaybooks.map(pb => {
                    const info = PLAYBOOK_INFO[pb.playbook_type] || {
                      icon: Rocket,
                      color: 'blue',
                    }
                    const Icon = info.icon
                    return (
                      <button
                        key={pb.id}
                        onClick={() => {
                          setSelectedPlaybookType(pb.playbook_type)
                          setPlaybookName(info.name || pb.name)
                        }}
                        className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-left"
                      >
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Icon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900">{pb.name}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">{pb.description}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>
                    )
                  })}
                  {availablePlaybooks.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No hay playbooks disponibles
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// Wrap in Suspense for useSearchParams
export default function ProjectPage({
  params,
}: {
  params: { projectId: string }
}) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ProjectPageContent params={params} />
    </Suspense>
  )
}
