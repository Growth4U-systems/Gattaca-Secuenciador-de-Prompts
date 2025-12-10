'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Settings, Rocket, Database, Workflow, Sliders, Edit2, Check, X, Trash2, ChevronRight, Home } from 'lucide-react'
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

  const tabs = [
    { id: 'documents' as TabType, label: 'Documentos', icon: FileText },
    { id: 'variables' as TabType, label: 'Variables', icon: Sliders },
    { id: 'flow' as TabType, label: 'Flow Setup', icon: Workflow },
    { id: 'campaigns' as TabType, label: 'Campañas', icon: Rocket },
  ]

  if (projectLoading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-gray-500">Cargando proyecto...</p>
        </div>
      </main>
    )
  }

  if (projectError || !project) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">Error al cargar el proyecto: {projectError}</p>
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
        alert('✅ Project name updated successfully')
        setEditingProjectName(false)
        window.location.reload()
      } else {
        throw new Error(data.error || 'Failed to update')
      }
    } catch (error) {
      console.error('Error updating project name:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
        alert('✅ Project deleted successfully')
        router.push('/')
      } else {
        throw new Error(data.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Get current tab label
  const currentTabLabel = tabs.find(t => t.id === activeTab)?.label || ''

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm mb-6" aria-label="Breadcrumb">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Home size={16} />
            <span>Proyectos</span>
          </Link>
          <ChevronRight size={14} className="text-gray-400" />
          <span className="text-gray-700 font-medium truncate max-w-[200px]" title={project.name}>
            {project.name}
          </span>
          <ChevronRight size={14} className="text-gray-400" />
          <span className="text-blue-600 font-medium">
            {currentTabLabel}
          </span>
        </nav>

        {/* Project Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {editingProjectName ? (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="flex-1 text-2xl font-bold text-gray-900 border-2 border-blue-500 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveProjectName()
                  if (e.key === 'Escape') handleCancelEditProjectName()
                }}
              />
              <button
                onClick={handleSaveProjectName}
                disabled={savingProjectName}
                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
              >
                <Check size={20} />
              </button>
              <button
                onClick={handleCancelEditProjectName}
                disabled={savingProjectName}
                className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 flex-1">{project.name}</h1>
              <button
                onClick={handleEditProjectName}
                className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 inline-flex items-center gap-2"
              >
                <Edit2 size={16} />
                <span className="text-sm">Edit Name</span>
              </button>
              <button
                onClick={handleDeleteProject}
                className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 inline-flex items-center gap-2"
              >
                <Trash2 size={16} />
                <span className="text-sm">Delete Project</span>
              </button>
            </div>
          )}
          {project.description && (
            <p className="text-gray-600 mt-1">{project.description}</p>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                      ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon size={18} />
                    {tab.label}
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
                    // Reload project to get updated variables
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
        onReload() // Reload documents to reflect the change
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Base de Conocimiento</h2>
        <div className="flex gap-3">
          <DocumentUpload projectId={projectId} onUploadComplete={onReload} />
          <DocumentBulkUpload projectId={projectId} onUploadComplete={onReload} />
        </div>
      </div>

      {/* Documentation Guide */}
      {showGuide && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">📚 Guía de Documentación</h3>
              <p className="text-sm text-blue-800 mb-3">
                Para obtener mejores resultados, organiza tu documentación en estas categorías:
              </p>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="bg-white/60 rounded p-3">
                  <span className="font-medium text-blue-700">📦 Producto</span>
                  <p className="text-blue-600 mt-1">Fichas técnicas, features, beneficios, casos de uso, pricing</p>
                </div>
                <div className="bg-white/60 rounded p-3">
                  <span className="font-medium text-purple-700">🎯 Competidor</span>
                  <p className="text-purple-600 mt-1">Análisis competitivo, comparativas, posicionamiento de mercado</p>
                </div>
                <div className="bg-white/60 rounded p-3">
                  <span className="font-medium text-green-700">🔬 Research</span>
                  <p className="text-green-600 mt-1">Estudios de mercado, insights de cliente, tendencias del sector</p>
                </div>
                <div className="bg-white/60 rounded p-3">
                  <span className="font-medium text-orange-700">📝 Output</span>
                  <p className="text-orange-600 mt-1">Guías de marca, tono de voz, ejemplos de mensajes anteriores</p>
                </div>
              </div>
              <p className="text-xs text-blue-700 mt-3">
                💡 <strong>Tip:</strong> Los documentos sin asignar aplican a todas las campañas. Usa el selector de campaña en cada documento para asignarlo a una campaña específica.
              </p>
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
        <p className="text-gray-500 text-center py-8">Cargando documentos...</p>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">{viewingDoc.filename}</h2>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                {viewingDoc.extracted_content}
              </pre>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setViewingDoc(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Cerrar
              </button>
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
          💡 Aquí defines qué documentos se usarán en cada paso del proceso.
          Esto te da control granular sobre qué información ve el modelo en cada etapa.
        </p>
      </div>

      <div className="space-y-6">
        {[
          { key: 'step_1', title: '🎯 Step 1: Find Place', guidance: project.step_1_guidance },
          { key: 'step_2', title: '🔧 Step 2: Select Assets', guidance: project.step_2_guidance },
          { key: 'step_3', title: '✅ Step 3: Proof Points', guidance: project.step_3_guidance },
          { key: 'step_4', title: '📝 Step 4: Final Output', guidance: project.step_4_guidance },
        ].map((step) => (
          <div key={step.key} className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium mb-2">{step.title}</h3>
            {step.guidance && (
              <p className="text-sm text-gray-600 mb-3 bg-blue-50 border border-blue-100 rounded p-2">
                💡 {step.guidance}
              </p>
            )}
            <div className="text-sm text-gray-700">
              <p className="mb-2 font-medium">Documentos disponibles:</p>
              {documents.length === 0 ? (
                <p className="text-gray-500 italic">No hay documentos todavía. Sube algunos en la pestaña "Documentos".</p>
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

