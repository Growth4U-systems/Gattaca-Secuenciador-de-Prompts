'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Rocket, Workflow, Sliders, Edit2, Check, X, Trash2, ChevronRight, Home, FolderOpen, Calendar, MoreVertical } from 'lucide-react'
import { useProject } from '@/hooks/useProjects'
import { useDocuments, deleteDocument } from '@/hooks/useDocuments'
import DocumentUpload from '@/components/documents/DocumentUpload'
import DocumentBulkUpload from '@/components/documents/DocumentBulkUpload'
import DocumentList from '@/components/documents/DocumentList'
import TokenMonitor from '@/components/TokenMonitor'
import FlowSetup from '@/components/flow/FlowSetup'
import CampaignRunner from '@/components/campaign/CampaignRunner'
import ProjectVariables from '@/components/project/ProjectVariables'
import ResearchPromptsEditor from '@/components/project/ResearchPromptsEditor'

type TabType = 'documents' | 'flow' | 'config' | 'campaigns' | 'context' | 'variables'

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
  const [activeTab, setActiveTab] = useState<TabType>('documents')
  const { project, loading: projectLoading, error: projectError } = useProject(params.projectId)
  const { documents, loading: docsLoading, reload: reloadDocs } = useDocuments(params.projectId)
  const [editingProjectName, setEditingProjectName] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [savingProjectName, setSavingProjectName] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const tabs = [
    { id: 'documents' as TabType, label: 'Documentos', icon: FileText, description: 'Base de conocimiento' },
    { id: 'variables' as TabType, label: 'Variables', icon: Sliders, description: 'Configuración' },
    { id: 'flow' as TabType, label: 'Flujo', icon: Workflow, description: 'Pasos y prompts' },
    { id: 'campaigns' as TabType, label: 'Campañas', icon: Rocket, description: 'Ejecutar' },
  ]

  if (projectLoading) {
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

  const handleEditProjectName = () => {
    setProjectName(project?.name || '')
    setEditingProjectName(true)
  }

  const handleSaveProjectName = async () => {
    if (!projectName.trim()) {
      alert('Project name cannot be empty')
      return
    }

    setSavingProjectName(true)
    try {
      const response = await fetch(`/api/projects/${params.projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: projectName }),
      })

      const data = await response.json()

      if (data.success) {
        setEditingProjectName(false)
        window.location.reload()
      } else {
        throw new Error(data.error || 'Failed to update')
      }
    } catch (error) {
      console.error('Error updating project name:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSavingProjectName(false)
    }
  }

  const handleCancelEditProjectName = () => {
    setEditingProjectName(false)
    setProjectName('')
  }

  const handleDeleteProject = async () => {
    if (!confirm(`¿Estás seguro de que quieres eliminar el proyecto "${project?.name}"? Esta acción eliminará todos los documentos, campañas y configuraciones. Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      const response = await fetch(`/api/projects/${params.projectId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        router.push('/')
      } else {
        throw new Error(data.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Get current tab info
  const currentTab = tabs.find(t => t.id === activeTab)

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 py-3 text-sm" aria-label="Breadcrumb">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors"
            >
              <Home size={14} />
              <span>Proyectos</span>
            </Link>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="text-gray-900 font-medium truncate max-w-[200px]" title={project.name}>
              {project.name}
            </span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Project Header Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 px-6 py-5">
            <div className="flex items-start justify-between">
              {editingProjectName ? (
                <div className="flex items-center gap-3 flex-1">
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="flex-1 text-xl font-bold text-gray-900 bg-white border-2 border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveProjectName()
                      if (e.key === 'Escape') handleCancelEditProjectName()
                    }}
                  />
                  <button
                    onClick={handleSaveProjectName}
                    disabled={savingProjectName}
                    className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300"
                  >
                    <Check size={20} />
                  </button>
                  <button
                    onClick={handleCancelEditProjectName}
                    disabled={savingProjectName}
                    className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30"
                  >
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 backdrop-blur rounded-xl">
                      <FolderOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-white">{project.name}</h1>
                      {project.description && (
                        <p className="text-blue-100 mt-1">{project.description}</p>
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
                        <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20">
                          <button
                            onClick={() => {
                              setShowMenu(false)
                              handleEditProjectName()
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
                          >
                            <Edit2 size={16} />
                            Editar nombre
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
            <div className="flex flex-wrap gap-4 mt-4">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <FileText className="w-4 h-4 text-blue-200" />
                <span className="text-sm text-white">{documents.length} documentos</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <Calendar className="w-4 h-4 text-blue-200" />
                <span className="text-sm text-white">
                  {new Date(project.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
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
            {activeTab === 'variables' && (
              <div className="space-y-6">
                <ProjectVariables
                  projectId={params.projectId}
                  initialVariables={project.variable_definitions || []}
                  onUpdate={() => {
                    window.location.reload()
                  }}
                />
                <ResearchPromptsEditor
                  projectId={params.projectId}
                  initialPrompts={project.deep_research_prompts || []}
                  onUpdate={() => {
                    window.location.reload()
                  }}
                />
              </div>
            )}
            {activeTab === 'flow' && (
              <FlowSetup projectId={params.projectId} documents={documents} />
            )}
            {activeTab === 'campaigns' && (
              <CampaignRunner projectId={params.projectId} project={project} />
            )}
          </div>
        </div>
      </div>
    </main>
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
  const [viewingDoc, setViewingDoc] = useState<any | null>(null)
  const [showGuide, setShowGuide] = useState(true)
  const [campaigns, setCampaigns] = useState<Array<{ id: string; ecp_name: string }>>([])

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
      onReload()
    } catch (error) {
      alert(`Error al eliminar: ${error instanceof Error ? error.message : 'Unknown'}`)
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
        onReload()
      } else {
        let errorMsg = data.error || 'Failed to update'
        if (data.details) errorMsg += `\n\nDetalles: ${data.details}`
        if (data.hint) errorMsg += `\n\nSugerencia: ${data.hint}`
        if (data.code) errorMsg += `\n\nCódigo: ${data.code}`
        throw new Error(errorMsg)
      }
    } catch (error) {
      alert(`Error al asignar documento: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }

  const tokenBreakdown = documents.map(doc => ({
    label: doc.filename,
    tokens: doc.token_count || 0,
  }))

  const categoryCards = [
    { key: 'product', icon: '📦', label: 'Producto', color: 'blue', description: 'Fichas técnicas, features, beneficios' },
    { key: 'competitor', icon: '🎯', label: 'Competidor', color: 'purple', description: 'Análisis competitivo, comparativas' },
    { key: 'research', icon: '🔬', label: 'Research', color: 'green', description: 'Estudios de mercado, insights' },
    { key: 'output', icon: '📝', label: 'Output', color: 'orange', description: 'Guías de marca, ejemplos previos' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Base de Conocimiento</h2>
          <p className="text-sm text-gray-500 mt-1">Gestiona los documentos que alimentan tus prompts</p>
        </div>
        <div className="flex gap-3">
          <DocumentUpload projectId={projectId} onUploadComplete={onReload} />
          <DocumentBulkUpload projectId={projectId} onUploadComplete={onReload} />
        </div>
      </div>

      {/* Documentation Guide */}
      {showGuide && documents.length === 0 && (
        <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-3">Guía de Documentación</h3>
              <p className="text-sm text-blue-800 mb-4">
                Organiza tu documentación en estas categorías para mejores resultados:
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {categoryCards.map((cat) => (
                  <div key={cat.key} className="bg-white/70 rounded-xl p-3 border border-blue-100">
                    <span className="text-lg">{cat.icon}</span>
                    <p className={`font-medium text-${cat.color}-700 text-sm mt-1`}>{cat.label}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{cat.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="p-1 text-blue-400 hover:text-blue-600"
            >
              <X size={18} />
            </button>
          </div>
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
      ) : (
        <DocumentList
          documents={documents}
          campaigns={campaigns}
          onDelete={handleDelete}
          onView={setViewingDoc}
          onCampaignChange={handleCampaignChange}
        />
      )}

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{viewingDoc.filename}</h2>
                <p className="text-sm text-gray-500">{viewingDoc.token_count?.toLocaleString()} tokens</p>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-white p-4 rounded-xl border border-gray-200">
                {viewingDoc.extracted_content}
              </pre>
            </div>
          </div>
        </div>
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
