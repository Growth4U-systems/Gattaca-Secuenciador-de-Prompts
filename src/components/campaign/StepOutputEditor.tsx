'use client'

import { useState, useMemo, useCallback } from 'react'
import { X, Save, RotateCcw, Eye, Edit2, AlertTriangle, FileText, Table, Download, Sparkles, Loader2, Check, XCircle } from 'lucide-react'
import MarkdownRenderer, { extractTables, tablesToCSV } from '../common/MarkdownRenderer'

interface StepOutputEditorProps {
  campaignId: string
  campaignName: string
  stepId: string
  stepName: string
  stepOrder: number
  currentOutput: {
    step_name: string
    output: string
    tokens?: number
    status: string
    completed_at?: string
    edited_at?: string
    original_output?: string
  }
  allStepOutputs: Record<string, any>
  onSave: (updatedStepOutputs: Record<string, any>) => void
  onClose: () => void
}

// Simple diff function to find changes between two texts
function computeSimpleDiff(original: string, modified: string): { type: 'same' | 'added' | 'removed', text: string }[] {
  const originalLines = original.split('\n')
  const modifiedLines = modified.split('\n')
  const result: { type: 'same' | 'added' | 'removed', text: string }[] = []

  let i = 0, j = 0

  while (i < originalLines.length || j < modifiedLines.length) {
    if (i >= originalLines.length) {
      // Remaining lines in modified are additions
      result.push({ type: 'added', text: modifiedLines[j] })
      j++
    } else if (j >= modifiedLines.length) {
      // Remaining lines in original are removals
      result.push({ type: 'removed', text: originalLines[i] })
      i++
    } else if (originalLines[i] === modifiedLines[j]) {
      // Lines match
      result.push({ type: 'same', text: originalLines[i] })
      i++
      j++
    } else {
      // Lines differ - check if it's a modification or insertion/deletion
      const nextOriginalMatch = modifiedLines.indexOf(originalLines[i], j)
      const nextModifiedMatch = originalLines.indexOf(modifiedLines[j], i)

      if (nextOriginalMatch === -1 && nextModifiedMatch === -1) {
        // Both are different - treat as modification
        result.push({ type: 'removed', text: originalLines[i] })
        result.push({ type: 'added', text: modifiedLines[j] })
        i++
        j++
      } else if (nextOriginalMatch === -1 || (nextModifiedMatch !== -1 && nextModifiedMatch < nextOriginalMatch)) {
        // Original line appears later or not at all - current modified is added
        result.push({ type: 'added', text: modifiedLines[j] })
        j++
      } else {
        // Modified line appears later or not at all - current original is removed
        result.push({ type: 'removed', text: originalLines[i] })
        i++
      }
    }
  }

  return result
}

export default function StepOutputEditor({
  campaignId,
  campaignName,
  stepId,
  stepName,
  stepOrder,
  currentOutput,
  allStepOutputs,
  onSave,
  onClose,
}: StepOutputEditorProps) {
  const [editedOutput, setEditedOutput] = useState(currentOutput.output || '')
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // AI Assistant state
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(true)

  // Store original output for revert functionality
  const originalOutput = currentOutput.original_output || currentOutput.output

  // Extract tables from the content
  const tables = useMemo(() => extractTables(aiSuggestion || editedOutput), [aiSuggestion, editedOutput])

  // Compute diff between current and suggestion
  const diffResult = useMemo(() => {
    if (!aiSuggestion) return null
    return computeSimpleDiff(editedOutput, aiSuggestion)
  }, [editedOutput, aiSuggestion])

  const handleTextChange = (value: string) => {
    setEditedOutput(value)
    setHasChanges(value !== currentOutput.output)
  }

  const handleSuggestionChange = (value: string) => {
    setAiSuggestion(value)
  }

  const handleGenerateSuggestion = async () => {
    if (!aiPrompt.trim()) {
      alert('Por favor, describe qué cambios deseas realizar.')
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/campaign/suggest-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentOutput: aiSuggestion || editedOutput, // Use current suggestion if iterating
          instruction: aiPrompt,
          stepName,
          campaignName,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setAiSuggestion(data.suggestion)
        setAiPrompt('') // Clear prompt for next iteration
      } else {
        throw new Error(data.error || 'Failed to generate suggestion')
      }
    } catch (error) {
      console.error('Error generating suggestion:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApplySuggestion = () => {
    if (aiSuggestion) {
      setEditedOutput(aiSuggestion)
      setHasChanges(aiSuggestion !== currentOutput.output)
      setAiSuggestion(null)
      setIsEditing(true) // Allow further manual editing
    }
  }

  const handleDiscardSuggestion = () => {
    setAiSuggestion(null)
    setAiPrompt('')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updatedStepOutputs = {
        ...allStepOutputs,
        [stepId]: {
          ...currentOutput,
          output: editedOutput,
          edited_at: new Date().toISOString(),
          original_output: currentOutput.original_output || currentOutput.output,
        },
      }

      const response = await fetch(`/api/campaign/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_outputs: updatedStepOutputs }),
      })

      const data = await response.json()

      if (data.success) {
        onSave(updatedStepOutputs)
        setHasChanges(false)
        setIsEditing(false)
        alert('Output guardado correctamente.')
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Error saving output:', error)
      alert(`Error al guardar: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleRevert = () => {
    if (confirm('¿Restaurar el output original generado por la IA?')) {
      setEditedOutput(originalOutput)
      setHasChanges(originalOutput !== currentOutput.output)
      setAiSuggestion(null)
      setIsEditing(true)
    }
  }

  const handleExportTables = () => {
    if (tables.length === 0) {
      alert('No se encontraron tablas en el output.')
      return
    }

    const csv = tablesToCSV(tables)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${stepName.replace(/\s+/g, '_')}_tables.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isEdited = !!currentOutput.edited_at || !!currentOutput.original_output
  const displayContent = aiSuggestion || editedOutput
  const charCount = displayContent.length
  const wordCount = displayContent.trim() ? displayContent.trim().split(/\s+/).length : 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                Step {stepOrder}
              </span>
              <h2 className="text-lg font-semibold text-gray-900">{stepName} - Output</h2>
              {isEdited && (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded inline-flex items-center gap-1">
                  <Edit2 size={10} />
                  Editado
                </span>
              )}
              {aiSuggestion && (
                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded inline-flex items-center gap-1">
                  <Sparkles size={10} />
                  Sugerencia AI
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{campaignName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* AI Assistant Bar */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-purple-600">
              <Sparkles size={18} />
              <span className="text-sm font-medium">AI Assistant</span>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
                    e.preventDefault()
                    handleGenerateSuggestion()
                  }
                }}
                placeholder={aiSuggestion
                  ? "Pide más cambios a la sugerencia..."
                  : "Describe qué cambios deseas (ej: 'Agrega más detalle sobre competidores en LATAM')..."
                }
                className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900 placeholder:text-gray-400"
                disabled={isGenerating}
              />
              <button
                onClick={handleGenerateSuggestion}
                disabled={isGenerating || !aiPrompt.trim()}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Sugerir
                  </>
                )}
              </button>
            </div>
          </div>
          {aiSuggestion && (
            <p className="text-xs text-purple-600 mt-2">
              💡 Puedes editar la sugerencia manualmente, pedir más cambios al AI, o aplicar/descartar.
            </p>
          )}
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{charCount.toLocaleString()} caracteres</span>
              <span>•</span>
              <span>{wordCount.toLocaleString()} palabras</span>
              {currentOutput.tokens && (
                <>
                  <span>•</span>
                  <span>{currentOutput.tokens.toLocaleString()} tokens</span>
                </>
              )}
            </div>
            {tables.length > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <button
                  onClick={handleExportTables}
                  className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded transition-colors"
                >
                  <Table size={12} />
                  <span>Exportar {tables.length} tabla{tables.length > 1 ? 's' : ''}</span>
                  <Download size={10} />
                </button>
              </>
            )}
            {aiSuggestion && (
              <>
                <span className="text-gray-300">|</span>
                <label className="inline-flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDiff}
                    onChange={(e) => setShowDiff(e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  Mostrar diferencias
                </label>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            {currentOutput.completed_at && (
              <span>Generado: {new Date(currentOutput.completed_at).toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-4 min-h-0">
          {aiSuggestion ? (
            // AI Suggestion Mode - show diff or editable suggestion
            showDiff && diffResult ? (
              <div className="h-full overflow-auto bg-white rounded-lg border border-purple-200 p-4">
                <div className="text-xs text-gray-500 mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded">+ Agregado</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded">- Eliminado</span>
                  <span className="text-gray-400 ml-2">Haz clic en "Editar Sugerencia" para modificar manualmente</span>
                </div>
                <div className="font-mono text-sm leading-relaxed">
                  {diffResult.map((line, index) => (
                    <div
                      key={index}
                      className={`py-0.5 px-2 -mx-2 ${
                        line.type === 'added'
                          ? 'bg-green-100 text-green-800 border-l-4 border-green-500'
                          : line.type === 'removed'
                          ? 'bg-red-100 text-red-800 border-l-4 border-red-500 line-through opacity-70'
                          : 'text-gray-700'
                      }`}
                    >
                      {line.type === 'added' && <span className="text-green-600 mr-2">+</span>}
                      {line.type === 'removed' && <span className="text-red-600 mr-2">−</span>}
                      {line.text || '\u00A0'}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Editable suggestion
              <textarea
                value={aiSuggestion}
                onChange={(e) => handleSuggestionChange(e.target.value)}
                className="w-full h-full resize-none bg-white rounded-lg border border-purple-300 p-4 text-sm text-gray-900 font-mono leading-relaxed focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none"
                placeholder="Sugerencia del AI..."
              />
            )
          ) : isEditing ? (
            // Manual editing mode
            <textarea
              value={editedOutput}
              onChange={(e) => handleTextChange(e.target.value)}
              className="w-full h-full resize-none bg-white rounded-lg border border-blue-300 p-4 text-sm text-gray-900 font-mono leading-relaxed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              placeholder="Output del paso..."
              autoFocus
            />
          ) : (
            // Preview mode with markdown rendering
            <div className="h-full overflow-auto bg-white rounded-lg border border-gray-200 p-6">
              {editedOutput ? (
                <MarkdownRenderer content={editedOutput} />
              ) : (
                <span className="text-gray-400 italic">No hay output generado todavía.</span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            {isEdited && !isEditing && !aiSuggestion && (
              <button
                onClick={handleRevert}
                disabled={saving}
                className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                Restaurar Original
              </button>
            )}
            {hasChanges && !aiSuggestion && (
              <span className="text-sm text-amber-600 inline-flex items-center gap-1">
                <AlertTriangle size={14} />
                Cambios sin guardar
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {aiSuggestion ? (
              // AI Suggestion actions
              <>
                <button
                  onClick={handleDiscardSuggestion}
                  className="px-4 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 inline-flex items-center gap-1.5"
                >
                  <XCircle size={14} />
                  Descartar
                </button>
                {showDiff && (
                  <button
                    onClick={() => setShowDiff(false)}
                    className="px-4 py-2 text-sm border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 inline-flex items-center gap-1.5"
                  >
                    <Edit2 size={14} />
                    Editar Sugerencia
                  </button>
                )}
                {!showDiff && (
                  <button
                    onClick={() => setShowDiff(true)}
                    className="px-4 py-2 text-sm border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 inline-flex items-center gap-1.5"
                  >
                    <Eye size={14} />
                    Ver Diferencias
                  </button>
                )}
                <button
                  onClick={handleApplySuggestion}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-1.5"
                >
                  <Check size={14} />
                  Aplicar Sugerencia
                </button>
              </>
            ) : isEditing ? (
              // Manual editing actions
              <>
                <button
                  onClick={() => {
                    if (hasChanges && !confirm('¿Descartar cambios?')) return
                    setEditedOutput(currentOutput.output || '')
                    setHasChanges(false)
                    setIsEditing(false)
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      Guardar
                    </>
                  )}
                </button>
              </>
            ) : (
              // Preview mode actions
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-1.5"
                >
                  <Edit2 size={14} />
                  Editar Manual
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
