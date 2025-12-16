'use client'

import { useState } from 'react'
import { Plus, X, Save, BookOpen, Copy, Check, Sparkles, FileText } from 'lucide-react'

interface ResearchPrompt {
  id: string
  name: string
  content: string
}

interface ResearchPromptsEditorProps {
  projectId: string
  initialPrompts: ResearchPrompt[]
  onUpdate?: () => void
}

export default function ResearchPromptsEditor({
  projectId,
  initialPrompts,
  onUpdate,
}: ResearchPromptsEditorProps) {
  const [prompts, setPrompts] = useState<ResearchPrompt[]>(initialPrompts || [])
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const addPrompt = () => {
    setPrompts([
      ...prompts,
      { id: crypto.randomUUID(), name: '', content: '' },
    ])
  }

  const updatePrompt = (
    index: number,
    field: keyof ResearchPrompt,
    value: string
  ) => {
    const updated = [...prompts]
    updated[index] = { ...updated[index], [field]: value }
    setPrompts(updated)
  }

  const removePrompt = (index: number) => {
    setPrompts(prompts.filter((_, i) => i !== index))
  }

  const copyPromptContent = async (prompt: ResearchPrompt) => {
    try {
      await navigator.clipboard.writeText(prompt.content)
      setCopiedId(prompt.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      alert('No se pudo copiar al portapapeles')
    }
  }

  const handleSave = async () => {
    // Validate: all prompts must have a name and content
    const invalidName = prompts.find((p) => !p.name.trim())
    if (invalidName) {
      alert('Todos los prompts deben tener un nombre')
      return
    }

    const invalidContent = prompts.find((p) => !p.content.trim())
    if (invalidContent) {
      alert('Todos los prompts deben tener contenido')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deep_research_prompts: prompts,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update research prompts')
      }

      alert('Prompts de research guardados exitosamente')
      setIsEditing(false)
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error saving research prompts:', error)
      alert(`Error al guardar: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setPrompts(initialPrompts || [])
    setIsEditing(false)
  }

  // Empty state - no prompts defined
  if (!isEditing && prompts.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl">
              <BookOpen className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Prompts de Deep Research</h3>
              <p className="text-xs text-gray-500 mt-0.5">Genera documentación adicional para tus campañas</p>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl mb-4">
            <Sparkles className="w-8 h-8 text-purple-600" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">
            No hay prompts de research definidos
          </h4>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
            Los prompts de research ayudan a generar documentos adicionales para cada campaña.
            Pueden incluir variables con formato <code className="bg-gray-100 px-1.5 py-0.5 rounded text-purple-600 text-xs font-mono">{'{{ variable }}'}</code>.
          </p>
          <button
            onClick={() => setIsEditing(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-md hover:shadow-lg inline-flex items-center gap-2 font-medium"
          >
            <Plus size={18} />
            Agregar Prompts de Research
          </button>
        </div>
      </div>
    )
  }

  // View mode - showing existing prompts
  if (!isEditing) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-xl">
                <BookOpen className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Prompts de Deep Research</h3>
                <p className="text-xs text-gray-500 mt-0.5">{prompts.length} prompt{prompts.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-sm bg-white text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 font-medium transition-colors"
            >
              Editar
            </button>
          </div>
        </div>

        {/* Info text */}
        <div className="px-6 pt-4">
          <p className="text-sm text-gray-600">
            Estos prompts aparecerán en cada campaña con las variables reemplazadas por sus valores reales.
          </p>
        </div>

        {/* Prompts List */}
        <div className="p-6 space-y-4">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="group bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-xl overflow-hidden hover:border-purple-300 hover:shadow-md transition-all"
            >
              {/* Prompt Header */}
              <div className="flex items-center justify-between px-5 py-3 bg-purple-50/50 border-b border-purple-100">
                <h4 className="font-semibold text-purple-900 flex items-center gap-2">
                  <FileText size={16} className="text-purple-500" />
                  {prompt.name}
                </h4>
                <button
                  onClick={() => copyPromptContent(prompt)}
                  className={`px-3 py-1.5 text-xs rounded-lg inline-flex items-center gap-1.5 transition-all ${
                    copiedId === prompt.id
                      ? 'bg-green-600 text-white'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                  title="Copiar contenido del prompt"
                >
                  {copiedId === prompt.id ? (
                    <>
                      <Check size={14} />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      Copiar
                    </>
                  )}
                </button>
              </div>
              {/* Prompt Content */}
              <div className="px-5 py-4">
                <p className="text-sm text-purple-800 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono bg-white/70 rounded-lg p-3 border border-purple-100">
                  {prompt.content.length > 500
                    ? `${prompt.content.substring(0, 500)}...`
                    : prompt.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Edit mode
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl">
              <BookOpen className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Prompts de Deep Research</h3>
              <p className="text-xs text-gray-500 mt-0.5">Modo edición</p>
            </div>
          </div>
          <button
            onClick={addPrompt}
            className="px-4 py-2 text-sm bg-white text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus size={16} />
            Agregar Prompt
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mx-6 mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-purple-100 rounded-lg">
            <Sparkles size={16} className="text-purple-600" />
          </div>
          <p className="text-sm text-purple-800">
            Estos prompts ayudan a generar documentación adicional para cada campaña.
            Usa <code className="bg-white/60 px-1.5 py-0.5 rounded text-purple-700 font-mono text-xs">{'{{ variable }}'}</code> para incluir variables que se reemplazarán con los valores de cada campaña.
          </p>
        </div>
      </div>

      {/* Prompts List */}
      <div className="p-6">
        {prompts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <BookOpen size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">
              No hay prompts. Click en "Agregar Prompt" para crear uno.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {prompts.map((prompt, index) => (
              <div
                key={prompt.id}
                className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-xl p-5 hover:border-purple-300 transition-colors"
              >
                {/* Prompt Name */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Nombre del Prompt <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={prompt.name}
                    onChange={(e) => updatePrompt(index, 'name', e.target.value)}
                    placeholder="ej: Análisis de Competidores"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400 transition-all"
                  />
                </div>

                {/* Prompt Content */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Contenido del Prompt <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={prompt.content}
                    onChange={(e) => updatePrompt(index, 'content', e.target.value)}
                    placeholder="Escribe el prompt aquí. Usa {{ variable }} para incluir variables de la campaña..."
                    rows={8}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400 resize-y font-mono transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Ejemplo: "Analiza el problema de <code className="bg-purple-50 px-1 rounded text-purple-600">{'{{ problem_core }}'}</code> en <code className="bg-purple-50 px-1 rounded text-purple-600">{'{{ country }}'}</code> para el sector <code className="bg-purple-50 px-1 rounded text-purple-600">{'{{ industry }}'}</code>..."
                  </p>
                </div>

                {/* Delete Button */}
                <div className="flex justify-end pt-3 border-t border-purple-100">
                  <button
                    onClick={() => removePrompt(index)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                  >
                    <X size={18} />
                    <span className="text-xs">Eliminar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg transition-all"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={18} />
                Guardar Prompts
              </>
            )}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
