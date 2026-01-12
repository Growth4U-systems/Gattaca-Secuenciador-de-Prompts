'use client'

import { useState } from 'react'
import { Workflow, Loader2, AlertTriangle, HelpCircle, ArrowRight, BookOpen, Layers, Brain, ChevronDown, ChevronUp, Plus, Sparkles } from 'lucide-react'
import { usePlaybooks, createPlaybook, updatePlaybookById, deletePlaybook, duplicatePlaybook, setPlaybookStatus } from '@/hooks/usePlaybooks'
import { useContextLake } from '@/hooks/useContextLake'
import type { Playbook, PlaybookInsert, PlaybookConfig, Document } from '@/types/v2.types'
import PlaybookList from './PlaybookList'
import PlaybookEditor from './PlaybookEditor'
import PlaybookRunner from './PlaybookRunner'
import PlaybookAdvisor from './PlaybookAdvisor'
import PlaybookTemplates from './PlaybookTemplates'
import PlaybookContextAdvisor, { ContextAnalysis } from './PlaybookContextAdvisor'

interface PlaybooksDashboardProps {
  agencyId: string
  clientId: string
  onNavigateToContextLake?: () => void
}

export default function PlaybooksDashboard({
  agencyId,
  clientId,
  onNavigateToContextLake,
}: PlaybooksDashboardProps) {
  const { playbooks, stats, loading, error, reload } = usePlaybooks(agencyId)
  const { documents, loading: docsLoading } = useContextLake(clientId)
  const [showEditor, setShowEditor] = useState(false)
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null)
  const [showRunner, setShowRunner] = useState(false)
  const [runningPlaybook, setRunningPlaybook] = useState<Playbook | null>(null)
  const [autoInputs, setAutoInputs] = useState<Record<string, any>>({})
  const [showAdvancedList, setShowAdvancedList] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showContextAdvisor, setShowContextAdvisor] = useState(false)
  const [playbookForContext, setPlaybookForContext] = useState<Playbook | null>(null)

  const handleCreate = () => {
    setEditingPlaybook(null)
    setShowEditor(true)
  }

  const handleEdit = (playbook: Playbook) => {
    setEditingPlaybook(playbook)
    setShowEditor(true)
  }

  const handleSave = async (data: PlaybookInsert) => {
    if (editingPlaybook) {
      await updatePlaybookById(editingPlaybook.id, data)
    } else {
      await createPlaybook(data)
    }
    reload()
  }

  const handleDuplicate = async (playbook: Playbook) => {
    await duplicatePlaybook(playbook.id)
    reload()
  }

  const handleArchive = async (playbook: Playbook) => {
    await setPlaybookStatus(playbook.id, 'archived')
    reload()
  }

  const handleDelete = async (playbook: Playbook) => {
    if (confirm(`¿Eliminar "${playbook.name}"?`)) {
      await deletePlaybook(playbook.id)
      reload()
    }
  }

  const handleRun = (playbook: Playbook, inputs?: Record<string, any>) => {
    // If we have pre-configured inputs (from advisor), skip context check
    if (inputs && Object.keys(inputs).length > 0) {
      setRunningPlaybook(playbook)
      setAutoInputs(inputs)
      setShowRunner(true)
    } else {
      // Show context advisor first
      setPlaybookForContext(playbook)
      setShowContextAdvisor(true)
    }
  }

  const handleContextReady = (analysis: ContextAnalysis) => {
    if (playbookForContext) {
      setShowContextAdvisor(false)
      setRunningPlaybook(playbookForContext)
      setAutoInputs({})  // Let the runner handle inputs
      setShowRunner(true)
    }
  }

  // Get enricher playbooks for context suggestions
  const enrichers = playbooks.filter(p => p.type === 'enricher')

  const handleCreateFromTemplate = async (template: {
    name: string
    description: string
    config: PlaybookConfig
    tags: readonly string[]
  }) => {
    try {
      const newPlaybook = await createPlaybook({
        agency_id: agencyId,
        name: template.name,
        description: template.description,
        type: 'playbook',
        config: template.config,
        tags: [...template.tags],
        status: 'active',
        version: '1.0',
        schedule_enabled: false,
        schedule_cron: null,
        schedule_timezone: 'America/Mexico_City',
        author_id: null,
      })
      reload()
      return newPlaybook
    } catch (err) {
      console.error('Error creating playbook from template:', err)
      alert('Error al crear playbook desde template')
    }
  }

  if (loading || docsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Analizando tu contexto...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
        <p className="text-red-700">{error}</p>
        <button
          onClick={reload}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Playbooks</h2>
          <p className="text-sm text-gray-500">Procesos automatizados con IA</p>
        </div>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${
            showTemplates
              ? 'bg-purple-100 text-purple-700 border border-purple-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          <Plus size={16} />
          {showTemplates ? 'Ocultar Templates' : 'Agregar Playbook'}
        </button>
      </div>

      {/* Templates Section */}
      {showTemplates && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-purple-900">Templates listos para usar</h4>
            </div>
            <button
              onClick={() => setShowTemplates(false)}
              className="text-purple-400 hover:text-purple-600 text-sm"
            >
              Cerrar
            </button>
          </div>
          <PlaybookTemplates
            onUseTemplate={handleCreateFromTemplate}
            compact={false}
          />
        </div>
      )}

      {/* AI Advisor - Always visible, this is the main interface */}
      <PlaybookAdvisor
        clientId={clientId}
        documents={documents}
        playbooks={playbooks}
        onRunPlaybook={handleRun}
        onCreatePlaybook={handleCreateFromTemplate}
      />

      {/* Existing playbooks section - collapsible */}
      {playbooks.length > 0 && (
        <div className="border-t border-gray-200 pt-6">
          <button
            onClick={() => setShowAdvancedList(!showAdvancedList)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Workflow className="w-5 h-5 text-gray-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Tus Playbooks ({playbooks.length})</p>
                <p className="text-xs text-gray-500">
                  {stats.byStatus.active} activos · {stats.byStatus.draft} borradores
                </p>
              </div>
            </div>
            {showAdvancedList ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showAdvancedList && (
            <div className="mt-4">
              <PlaybookList
                playbooks={playbooks}
                loading={loading}
                onRun={(playbook) => handleRun(playbook)}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onArchive={handleArchive}
                onDelete={handleDelete}
                onCreate={handleCreate}
                onCreateFromTemplate={handleCreateFromTemplate}
                isAdmin={true}
              />
            </div>
          )}
        </div>
      )}

      {/* Quick stats for power users */}
      {playbooks.length > 0 && showAdvancedList && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-gray-100 rounded-xl">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
          <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
            <p className="text-2xl font-bold text-green-700">{stats.byStatus.active}</p>
            <p className="text-sm text-green-600">Activos</p>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-2xl font-bold text-amber-700">{stats.byStatus.draft}</p>
            <p className="text-sm text-amber-600">Borradores</p>
          </div>
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
            <p className="text-2xl font-bold text-indigo-700">{stats.byType.enricher}</p>
            <p className="text-sm text-indigo-600">Enrichers</p>
          </div>
        </div>
      )}

      {/* Playbook Editor Modal */}
      <PlaybookEditor
        playbook={editingPlaybook}
        agencyId={agencyId}
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        onSave={handleSave}
      />

      {/* Context Advisor Modal */}
      {playbookForContext && showContextAdvisor && (
        <PlaybookContextAdvisor
          playbook={playbookForContext}
          clientId={clientId}
          documents={documents}
          enrichers={enrichers}
          onReady={handleContextReady}
          onUploadDocument={(docType, tier) => {
            // Navigate to Context Lake to upload
            if (onNavigateToContextLake) {
              setShowContextAdvisor(false)
              setPlaybookForContext(null)
              onNavigateToContextLake()
            } else {
              alert(`Para subir un documento de tipo "${docType}", ve a la pestaña "Context Lake".`)
            }
          }}
          onConnectDrive={(docType, tier) => {
            // Navigate to Context Lake
            if (onNavigateToContextLake) {
              setShowContextAdvisor(false)
              setPlaybookForContext(null)
              onNavigateToContextLake()
            } else {
              alert(`Para conectar Google Drive, ve a la pestaña "Context Lake".`)
            }
          }}
          onPasteUrl={(docType, tier) => {
            // Navigate to Context Lake
            if (onNavigateToContextLake) {
              setShowContextAdvisor(false)
              setPlaybookForContext(null)
              onNavigateToContextLake()
            } else {
              alert(`Para agregar un documento, ve a la pestaña "Context Lake".`)
            }
          }}
          onRunEnricher={(enricher) => {
            // Close context advisor and run enricher
            setShowContextAdvisor(false)
            setPlaybookForContext(null)
            handleRun(enricher, {})
          }}
          onClose={() => {
            setShowContextAdvisor(false)
            setPlaybookForContext(null)
          }}
        />
      )}

      {/* Playbook Runner Modal */}
      {runningPlaybook && (
        <PlaybookRunner
          playbook={runningPlaybook}
          clientId={clientId}
          isOpen={showRunner}
          initialInputs={autoInputs}
          onClose={() => {
            setShowRunner(false)
            setRunningPlaybook(null)
            setAutoInputs({})
          }}
          onComplete={(execution) => {
            console.log('Execution completed:', execution)
            reload()
          }}
        />
      )}
    </div>
  )
}
