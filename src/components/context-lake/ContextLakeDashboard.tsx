'use client'

import { useState, useMemo } from 'react'
import { Plus, Crown, Target, Clock, Layers, AlertTriangle, Loader2, HelpCircle, ArrowRight, Workflow, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { useContextLake, createDocument, updateDocument, deleteDocument, setDocumentApproval } from '@/hooks/useContextLake'
import type { Document, DocumentInsert, DocumentTier } from '@/types/v2.types'
import { TIER_CONFIG, getFoundationalStatus } from '@/types/v2.types'
import DocumentList from './DocumentList'
import DocumentEditor from './DocumentEditor'
import FoundationalDocumentsV2 from './FoundationalDocumentsV2'
import type { FoundationalType } from '@/types/v2.types'

// Help panel explaining the Context Lake system
function ContextLakeHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-semibold text-blue-900">¿Cómo funciona el Context Lake?</h3>
        </div>
        <button onClick={onClose} className="text-blue-400 hover:text-blue-600">✕</button>
      </div>

      <div className="space-y-4 text-sm text-blue-800">
        <p>
          El <strong>Context Lake</strong> es tu base de conocimiento. Los documentos que subas aquí
          serán usados automáticamente como contexto cuando ejecutes Playbooks.
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/60 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-amber-700">Tier 1 - Cimientos</span>
            </div>
            <p className="text-xs text-gray-600">
              Los fundamentos: Brand DNA, ICP, Tone of Voice.
              <strong className="text-amber-600"> La base de todo</strong>.
            </p>
          </div>

          <div className="bg-white/60 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-blue-700">Tier 2 - Estrategia</span>
            </div>
            <p className="text-xs text-gray-600">
              Derivados de los cimientos: briefs, análisis, research.
              <strong className="text-blue-600"> Documentos procesados</strong>.
            </p>
          </div>

          <div className="bg-white/60 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-700">Tier 3 - Assets</span>
            </div>
            <p className="text-xs text-gray-600">
              Contenido final: posts, copies, creativos.
              <strong className="text-gray-600"> Entregables</strong>.
            </p>
          </div>
        </div>

        <div className="bg-white/80 rounded-xl p-4 flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-600">
            <Layers className="w-5 h-5" />
            <span>Context Lake</span>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
          <div className="flex items-center gap-2 text-indigo-600">
            <Workflow className="w-5 h-5" />
            <span>Playbooks</span>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
          <div className="flex items-center gap-2 text-green-600">
            <span className="text-lg">✨</span>
            <span>Contenido Generado</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ContextLakeDashboardProps {
  clientId: string
}

export default function ContextLakeDashboard({ clientId }: ContextLakeDashboardProps) {
  const { documents, documentsByTier, stats, loading, error, reload } = useContextLake(clientId)
  const [showEditor, setShowEditor] = useState(false)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [selectedTier, setSelectedTier] = useState<DocumentTier | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showFoundational, setShowFoundational] = useState(true)
  const [showAllDocuments, setShowAllDocuments] = useState(false)
  const [editorDefaults, setEditorDefaults] = useState<{ tier?: DocumentTier; docType?: string }>({})

  // Get foundational status
  const foundationalStatus = useMemo(() => getFoundationalStatus(documents), [documents])

  const handleCreate = () => {
    setEditorDefaults({}) // Clear defaults
    setEditingDocument(null)
    setShowEditor(true)
  }

  const handleEdit = (doc: Document) => {
    setEditingDocument(doc)
    setShowEditor(true)
  }

  const handleSave = async (data: DocumentInsert) => {
    if (editingDocument) {
      await updateDocument(editingDocument.id, data)
    } else {
      await createDocument(data)
    }
    reload()
  }

  const handleDelete = async (doc: Document) => {
    if (confirm(`¿Eliminar "${doc.title}"?`)) {
      await deleteDocument(doc.id)
      reload()
    }
  }

  const handleApprove = async (doc: Document) => {
    await setDocumentApproval(doc.id, 'approved')
    reload()
  }

  const handleArchive = async (doc: Document) => {
    await setDocumentApproval(doc.id, 'archived')
    reload()
  }

  // Handlers for foundational documents - Open editor with pre-configured tier/type
  const handleUploadFoundational = (docType: string, tier: DocumentTier) => {
    setEditorDefaults({ tier, docType })
    setEditingDocument(null)
    setShowEditor(true)
  }

  const handleConnectDrive = (docType: string, tier: DocumentTier) => {
    // For now, open editor - Google Drive integration future feature
    setEditorDefaults({ tier, docType })
    setEditingDocument(null)
    setShowEditor(true)
  }

  const handlePasteUrl = (docType: string, tier: DocumentTier) => {
    // Open editor where user can paste content
    setEditorDefaults({ tier, docType })
    setEditingDocument(null)
    setShowEditor(true)
  }

  const handleGenerateFoundational = (type: FoundationalType) => {
    // TODO: Launch playbook for generating this document
    console.log('Generate foundational:', type)
    alert(`Generar ${type} con IA\n\nEsta funcionalidad estará disponible pronto.`)
  }

  const handleViewDocument = (doc: Document) => {
    // Open in editor in view mode
    setEditingDocument(doc)
    setShowEditor(true)
  }

  // Filter documents by selected tier
  const displayedDocuments = selectedTier
    ? documentsByTier[selectedTier]
    : documents

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
            <Layers className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Context Lake</h2>
            <p className="text-sm text-gray-500">
              {stats.total} documentos | {stats.totalTokens.toLocaleString()} tokens
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
            title="Ayuda"
          >
            <HelpCircle size={20} />
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md flex items-center gap-2"
          >
            <Plus size={18} />
            Nuevo Documento
          </button>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && <ContextLakeHelp onClose={() => setShowHelp(false)} />}

      {/* Foundational Documents Section V2 - With assignment and synthesis */}
      {showFoundational && (
        <FoundationalDocumentsV2
          clientId={clientId}
          documents={documents}
          onUploadDocument={handleUploadFoundational}
          onConnectDrive={handleConnectDrive}
          onPasteUrl={handlePasteUrl}
          onGenerateDocument={handleGenerateFoundational}
          onViewDocument={handleViewDocument}
          onEditDocument={handleEdit}
        />
      )}

      {/* Toggle to show/hide foundational section */}
      <button
        onClick={() => setShowFoundational(!showFoundational)}
        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-indigo-600" />
          <span className="font-medium text-gray-700">
            {showFoundational ? 'Ocultar Documentos Fundacionales' : 'Mostrar Documentos Fundacionales'}
          </span>
        </div>
        {showFoundational ? <ChevronUp className="text-gray-500" /> : <ChevronDown className="text-gray-500" />}
      </button>

      {/* Tier Summary Cards */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Documentos por Tier</h3>
          <button
            onClick={() => setShowAllDocuments(!showAllDocuments)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {showAllDocuments ? 'Ocultar lista' : 'Ver todos los documentos'}
            {showAllDocuments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {([1, 2, 3] as DocumentTier[]).map((tier) => {
            const config = TIER_CONFIG[tier]
            const count = stats.byTier[tier]
            const isSelected = selectedTier === tier
            const Icon = tier === 1 ? Crown : tier === 2 ? Target : Clock

            return (
              <button
                key={tier}
                onClick={() => {
                  setSelectedTier(isSelected ? null : tier)
                  setShowAllDocuments(true)
                }}
                className={`p-4 rounded-2xl border-2 transition-all text-left ${
                  isSelected
                    ? `${config.borderClass} ${config.bgClass}`
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${isSelected ? config.bgClass : 'bg-gray-100'}`}>
                    <Icon className={`w-5 h-5 ${isSelected ? config.textClass : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{config.name}</p>
                    <p className="text-xs text-gray-500">{config.label}</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{config.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Alerts */}
      {(stats.staleCount > 0 || stats.expiringCount > 0) && (
        <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1 text-sm text-amber-800">
            {stats.staleCount > 0 && (
              <span>{stats.staleCount} documento(s) expirado(s)</span>
            )}
            {stats.staleCount > 0 && stats.expiringCount > 0 && ' · '}
            {stats.expiringCount > 0 && (
              <span>{stats.expiringCount} documento(s) por expirar</span>
            )}
          </div>
        </div>
      )}

      {/* Document List - Collapsible */}
      {showAllDocuments && (
        <div className="space-y-4">
          {/* Selected tier indicator */}
          {selectedTier && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Mostrando:</span>
              <span className={`font-medium ${TIER_CONFIG[selectedTier].textClass}`}>
                {TIER_CONFIG[selectedTier].name}
              </span>
              <button
                onClick={() => setSelectedTier(null)}
                className="text-blue-600 hover:text-blue-800"
              >
                (ver todos)
              </button>
            </div>
          )}

          {/* Document List */}
          <DocumentList
            documents={displayedDocuments}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onApprove={handleApprove}
            onArchive={handleArchive}
            onUpdated={reload}
          />
        </div>
      )}

      {/* Document Editor Modal */}
      <DocumentEditor
        document={editingDocument}
        clientId={clientId}
        isOpen={showEditor}
        defaultTier={editorDefaults.tier}
        defaultDocType={editorDefaults.docType}
        onClose={() => {
          setShowEditor(false)
          setEditorDefaults({})
        }}
        onSave={handleSave}
      />
    </div>
  )
}
