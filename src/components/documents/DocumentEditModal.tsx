'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2, Tag, Users, FileText } from 'lucide-react'
import { DocCategory } from '@/types/database.types'
import { supabase } from '@/lib/supabase'

interface DocumentEditModalProps {
  document: {
    id: string
    filename: string
    category: DocCategory
    description?: string
    tags?: string[] | null
    source_metadata?: Record<string, unknown> | null
    project_id?: string | null
    client_id?: string | null
  }
  projectId?: string
  clientId?: string
  onSave: (docId: string, updates: DocumentUpdates) => Promise<void>
  onClose: () => void
}

export interface DocumentUpdates {
  filename?: string
  description?: string
  category?: string
  tags?: string[]
  source_metadata?: Record<string, unknown>
}

const CATEGORIES = [
  { value: 'product', label: 'Producto', icon: '📦' },
  { value: 'competitor', label: 'Competidor', icon: '🎯' },
  { value: 'research', label: 'Research', icon: '🔬' },
  { value: 'output', label: 'Output', icon: '📝' },
]

export default function DocumentEditModal({
  document,
  projectId,
  clientId,
  onSave,
  onClose,
}: DocumentEditModalProps) {
  const [filename, setFilename] = useState(document.filename)
  const [description, setDescription] = useState(document.description || '')
  const [category, setCategory] = useState<string>(document.category)
  const [customCategory, setCustomCategory] = useState('')
  const [useCustomCategory, setUseCustomCategory] = useState(false)
  const [competitorName, setCompetitorName] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [competitors, setCompetitors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize state from document
  useEffect(() => {
    const docTags = document.tags || []
    const competitor = (document.source_metadata as Record<string, string>)?.competitor || ''

    // Check if category is a known one or custom
    const isKnown = CATEGORIES.some(c => c.value === document.category)
    if (!isKnown && document.category) {
      setUseCustomCategory(true)
      setCustomCategory(document.category)
    }

    setCompetitorName(competitor)
    // Tags exclude competitor name to avoid duplication
    setTags(competitor ? docTags.filter(t => t !== competitor) : [...docTags])
  }, [document])

  // Fetch competitors list
  useEffect(() => {
    const fetchCompetitors = async () => {
      try {
        const pid = projectId || document.project_id
        const cid = clientId || document.client_id

        if (pid) {
          const res = await fetch(`/api/campaign/list?projectId=${pid}&playbookType=competitor_analysis`)
          const data = await res.json()
          if (data.success && data.campaigns) {
            setCompetitors(data.campaigns.map((c: { ecp_name: string }) => c.ecp_name).filter(Boolean))
          }
        } else if (cid) {
          const { data: projects } = await supabase
            .from('projects')
            .select('id')
            .eq('client_id', cid)
          if (!projects?.length) return

          const allNames: string[] = []
          for (const project of projects) {
            const res = await fetch(`/api/campaign/list?projectId=${project.id}&playbookType=competitor_analysis`)
            const data = await res.json()
            if (data.success && data.campaigns) {
              for (const c of data.campaigns) {
                if (c.ecp_name && !allNames.includes(c.ecp_name)) {
                  allNames.push(c.ecp_name)
                }
              }
            }
          }
          setCompetitors(allNames)
        }
      } catch { /* ignore */ }
    }
    fetchCompetitors()
  }, [projectId, clientId, document.project_id, document.client_id])

  const addTag = () => {
    const trimmed = tagInput.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  const handleSave = async () => {
    if (!filename.trim()) {
      setError('El nombre no puede estar vacío')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const effectiveCategory = useCustomCategory ? customCategory.trim() : category
      if (!effectiveCategory) {
        setError('La categoría no puede estar vacía')
        setSaving(false)
        return
      }

      // Build final tags: competitor first (if set), then user tags
      const finalTags = competitorName
        ? [competitorName, ...tags.filter(t => t !== competitorName)]
        : [...tags]

      // Build source_metadata preserving existing fields
      const currentMeta = (document.source_metadata || {}) as Record<string, unknown>
      const { competitor: _oldComp, ...restMeta } = currentMeta
      const newMeta: Record<string, unknown> = competitorName
        ? { ...restMeta, competitor: competitorName }
        : { ...restMeta }

      const updates: DocumentUpdates = {
        filename: filename.trim(),
        description: description.trim(),
        category: effectiveCategory,
        tags: finalTags,
        source_metadata: newMeta,
      }

      await onSave(document.id, updates)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 backdrop-blur rounded-xl">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-white">Editar Documento</h2>
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
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Filename */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Nombre del documento
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Descripcion <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el contenido del documento..."
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 text-sm resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Categoría
            </label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setUseCustomCategory(false)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  !useCustomCategory
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                Base
              </button>
              <button
                type="button"
                onClick={() => setUseCustomCategory(true)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  useCustomCategory
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                Personalizada
              </button>
            </div>
            {!useCustomCategory ? (
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-left text-sm ${
                      category === cat.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="font-medium">{cat.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="ej: Business Banking, Seguros..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 text-sm"
              />
            )}
          </div>

          {/* Competitor Assignment */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <Users size={14} className="inline mr-1.5" />
              Competidor asignado <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            {competitors.length > 0 ? (
              <select
                value={competitorName}
                onChange={(e) => setCompetitorName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white text-sm"
              >
                <option value="">Documento global (sin competidor)</option>
                {competitors.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={competitorName}
                onChange={(e) => setCompetitorName(e.target.value)}
                placeholder="Nombre del competidor (o dejalo vacío para global)"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 text-sm"
              />
            )}
            <p className="text-xs text-gray-500 mt-1">
              Diferente a la campaña. Define a qué competidor pertenece este documento.
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <Tag size={14} className="inline mr-1.5" />
              Tags <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="p-0.5 hover:bg-purple-200 rounded-full transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Escribí un tag y presioná Enter..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 text-sm"
              />
              <button
                type="button"
                onClick={addTag}
                disabled={!tagInput.trim()}
                className="px-3 py-2 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                Agregar
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !filename.trim()}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={18} />
                Guardar cambios
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
