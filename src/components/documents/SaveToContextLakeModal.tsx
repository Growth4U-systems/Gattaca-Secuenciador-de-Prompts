'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, FileText, Tag, Folder, Building2, FolderKanban, User, Clock, Cpu, Sparkles, Loader2, Info } from 'lucide-react'
import { PlaybookStepSourceMetadata } from '@/hooks/useDocuments'

// ============================================
// TYPES
// ============================================

export interface StepOutputContext {
  // Step info
  stepId: string
  stepName: string
  stepOrder: number
  // Campaign info
  campaignId: string
  campaignName: string
  campaignVariables?: Record<string, string>
  // Playbook info
  playbookId: string
  playbookName: string
  // Execution info
  executedAt?: string
  modelUsed?: string
  modelProvider?: string
  inputTokens?: number
  outputTokens?: number
  // Input references
  inputDocumentIds?: string[]
  inputPreviousStepIds?: string[]
  // Was the content edited before saving?
  wasEditedBeforeConversion: boolean
}

export interface SaveToContextLakeModalProps {
  isOpen: boolean
  content: string
  projectId: string
  clientId: string
  userId: string
  stepContext: StepOutputContext
  onSave: (savedDocId: string) => void
  onClose: () => void
}

// Document categories
const DOCUMENT_CATEGORIES = [
  { value: 'research', label: 'Investigación' },
  { value: 'strategy', label: 'Estrategia' },
  { value: 'content', label: 'Contenido' },
  { value: 'analysis', label: 'Análisis' },
  { value: 'persona', label: 'Persona/Avatar' },
  { value: 'brief', label: 'Brief' },
  { value: 'guidelines', label: 'Guías/Guidelines' },
  { value: 'other', label: 'Otro' },
]

// ============================================
// MODAL COMPONENT
// ============================================

export default function SaveToContextLakeModal({
  isOpen,
  content,
  projectId,
  clientId,
  userId,
  stepContext,
  onSave,
  onClose,
}: SaveToContextLakeModalProps) {
  const [mounted, setMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Form state
  const defaultFilename = `${stepContext.stepName} - ${stepContext.campaignName} - ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const [filename, setFilename] = useState(defaultFilename)
  const [category, setCategory] = useState('content')
  const [description, setDescription] = useState(`Output del paso "${stepContext.stepName}" del playbook ${stepContext.playbookName}.`)
  const [tags, setTags] = useState<string[]>([stepContext.campaignName.toLowerCase().replace(/\s+/g, '-')])
  const [newTag, setNewTag] = useState('')
  const [destination, setDestination] = useState<'project' | 'client'>('project')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true))
      // Reset form when opening
      setFilename(defaultFilename)
      setError(null)
    } else {
      setIsVisible(false)
    }
  }, [isOpen, defaultFilename])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleAddTag = () => {
    const trimmedTag = newTag.trim().toLowerCase().replace(/\s+/g, '-')
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove))
  }

  const handleSave = async () => {
    if (!filename.trim()) {
      setError('El nombre del documento es requerido')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Build source metadata
      const sourceMetadata: PlaybookStepSourceMetadata = {
        origin_type: 'flow_step_output',
        playbook_id: stepContext.playbookId,
        playbook_name: stepContext.playbookName,
        campaign_id: stepContext.campaignId,
        campaign_name: stepContext.campaignName,
        campaign_variables: stepContext.campaignVariables || {},
        step_id: stepContext.stepId,
        step_name: stepContext.stepName,
        step_order: stepContext.stepOrder,
        executed_at: stepContext.executedAt || new Date().toISOString(),
        model_used: stepContext.modelUsed || 'unknown',
        model_provider: stepContext.modelProvider || 'unknown',
        input_tokens: stepContext.inputTokens || 0,
        output_tokens: stepContext.outputTokens || 0,
        input_document_ids: stepContext.inputDocumentIds || [],
        input_previous_step_ids: stepContext.inputPreviousStepIds || [],
        converted_at: new Date().toISOString(),
        converted_by: userId,
        was_edited_before_conversion: stepContext.wasEditedBeforeConversion,
      }

      const response = await fetch('/api/documents/from-step-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: destination === 'project' ? projectId : null,
          clientId,
          filename: filename.trim(),
          category,
          content,
          description: description.trim() || null,
          tags: tags.length > 0 ? tags : null,
          userId,
          sourceMetadata,
          sourceCampaignId: stepContext.campaignId,
          sourceStepId: stepContext.stepId,
          sourceStepName: stepContext.stepName,
          sourcePlaybookId: stepContext.playbookId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al guardar el documento')
      }

      onSave(data.document.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  if (!mounted || !isOpen) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center p-4 transition-all duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl transform transition-all duration-200 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Save className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 id="modal-title" className="text-xl font-bold text-white">
                  Guardar en Context Lake
                </h2>
                <p className="text-indigo-100 text-sm mt-0.5">
                  Crear documento permanente desde este output
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Filename */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FileText size={14} className="inline mr-1.5" />
              Nombre del documento
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Nombre del documento..."
            />
          </div>

          {/* Category and Destination */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Folder size={14} className="inline mr-1.5" />
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Guardar en
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDestination('project')}
                  className={`flex-1 px-4 py-3 text-sm rounded-xl border transition-all flex items-center justify-center gap-2 ${
                    destination === 'project'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-600 dark:text-indigo-300'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  <FolderKanban size={16} />
                  Proyecto
                </button>
                <button
                  type="button"
                  onClick={() => setDestination('client')}
                  className={`flex-1 px-4 py-3 text-sm rounded-xl border transition-all flex items-center justify-center gap-2 ${
                    destination === 'client'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-600 dark:text-indigo-300'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  <Building2 size={16} />
                  Cliente
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                {destination === 'project'
                  ? 'Visible solo en este proyecto'
                  : 'Compartido con todos los proyectos del cliente'}
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
              placeholder="Descripción del documento..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Tag size={14} className="inline mr-1.5" />
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 text-indigo-400 hover:text-indigo-600"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Agregar tag..."
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Agregar
              </button>
            </div>
          </div>

          {/* Traceability Info */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium text-sm mb-3">
              <Info size={16} />
              Trazabilidad que se guardará
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <FolderKanban size={14} />
                <span className="font-medium">Campaña:</span>
                <span className="truncate">{stepContext.campaignName}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Sparkles size={14} />
                <span className="font-medium">Paso:</span>
                <span className="truncate">{stepContext.stepName} (#{stepContext.stepOrder})</span>
              </div>
              {stepContext.modelUsed && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Cpu size={14} />
                  <span className="font-medium">Modelo:</span>
                  <span className="truncate">{stepContext.modelUsed}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <User size={14} />
                <span className="font-medium">Creado por:</span>
                <span className="truncate">Usuario actual</span>
              </div>
              {stepContext.wasEditedBeforeConversion && (
                <div className="col-span-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Clock size={14} />
                  <span>El output fue editado antes de guardarse</span>
                </div>
              )}
            </div>
          </div>

          {/* Content Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Vista previa del contenido ({content.length.toLocaleString()} caracteres)
            </label>
            <div className="max-h-40 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap">
              {content.substring(0, 1000)}
              {content.length > 1000 && (
                <span className="text-gray-400">... [{(content.length - 1000).toLocaleString()} caracteres más]</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !filename.trim()}
            className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg inline-flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={16} />
                Guardar en Context Lake
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
