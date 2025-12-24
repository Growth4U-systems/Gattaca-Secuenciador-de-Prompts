'use client'

import { useState, useMemo, useRef } from 'react'
import { X, Save, RotateCcw, Edit2, AlertTriangle, Table, Download, Sparkles, Loader2, Check, XCircle, MousePointer2, ChevronDown, ChevronUp, FileOutput, Clock, Hash, Type, Cpu, Settings } from 'lucide-react'
import MarkdownRenderer, { extractTables, tablesToCSV } from '../common/MarkdownRenderer'
import { useToast, useModal } from '@/components/ui'

// Modelos LLM disponibles para el asistente de IA
const LLM_MODELS = [
  // Gemini
  { value: 'gemini-3.0-pro-preview', label: 'Gemini 3.0 Pro', provider: 'Google' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'Google' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google' },
  // OpenAI
  { value: 'gpt-5', label: 'GPT-5', provider: 'OpenAI' },
  { value: 'gpt-4.1', label: 'GPT-4.1', provider: 'OpenAI' },
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  // Anthropic
  { value: 'claude-4.5-sonnet', label: 'Claude 4.5 Sonnet', provider: 'Anthropic' },
  { value: 'claude-4.5-haiku', label: 'Claude 4.5 Haiku', provider: 'Anthropic' },
]

// Token equivalence helper: 1 token ≈ 0.75 words, 500 words = 1 page
const getTokenEquivalence = (tokens: number) => {
  const words = Math.round(tokens * 0.75)
  const pages = (words / 500).toFixed(1)
  return { words, pages }
}

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

// Generate a simple summary of changes between two texts
function generateChangeSummary(original: string, modified: string): string[] {
  const changes: string[] = []

  const origLines = original.split('\n').filter(l => l.trim())
  const modLines = modified.split('\n').filter(l => l.trim())

  const origSet = new Set(origLines)
  const modSet = new Set(modLines)

  // Find removed lines
  const removed = origLines.filter(l => !modSet.has(l))
  // Find added lines
  const added = modLines.filter(l => !origSet.has(l))

  if (removed.length > 0) {
    changes.push(`${removed.length} línea(s) modificada(s)`)
  }
  if (added.length > 0) {
    changes.push(`${added.length} línea(s) nueva(s)`)
  }

  // Character count change
  const charDiff = modified.length - original.length
  if (charDiff > 0) {
    changes.push(`+${charDiff} caracteres`)
  } else if (charDiff < 0) {
    changes.push(`${charDiff} caracteres`)
  }

  return changes
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
  const toast = useToast()
  const modal = useModal()

  const [editedOutput, setEditedOutput] = useState(currentOutput.output || '')
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // AI Assistant state
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [showAiConfig, setShowAiConfig] = useState(false)

  // AI Model configuration
  const [aiModel, setAiModel] = useState('gemini-2.5-flash')
  const [aiTemperature, setAiTemperature] = useState(0.7)
  const [aiMaxTokens, setAiMaxTokens] = useState(8192)

  // Selection state
  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Store original output for revert functionality
  const originalOutput = currentOutput.original_output || currentOutput.output

  // Extract tables from the content
  const tables = useMemo(() => extractTables(aiSuggestion || editedOutput), [aiSuggestion, editedOutput])

  // Generate change summary
  const changeSummary = useMemo(() => {
    if (!aiSuggestion) return []
    return generateChangeSummary(editedOutput, aiSuggestion)
  }, [editedOutput, aiSuggestion])

  // Handle text selection
  const handleTextSelection = () => {
    if (!selectionMode) return

    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim())
    }
  }

  const clearSelection = () => {
    setSelectedText(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleTextChange = (value: string) => {
    setEditedOutput(value)
    setHasChanges(value !== currentOutput.output)
  }

  const handleGenerateSuggestion = async () => {
    if (!aiPrompt.trim()) {
      toast.warning('Instrucción requerida', 'Por favor, describe qué cambios deseas realizar.')
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/campaign/suggest-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentOutput: aiSuggestion || editedOutput,
          instruction: aiPrompt,
          stepName,
          campaignName,
          selectedText: selectedText || undefined,
          model: aiModel,
          temperature: aiTemperature,
          maxTokens: aiMaxTokens,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setAiSuggestion(data.suggestion)
        setAiPrompt('')
        setSelectedText(null)
        setSelectionMode(false)
        toast.info('Sugerencia generada', 'Revisa la sugerencia y aplícala si te parece correcta')
      } else {
        throw new Error(data.error || 'Failed to generate suggestion')
      }
    } catch (error) {
      console.error('Error generating suggestion:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApplySuggestion = async () => {
    if (!aiSuggestion) return

    setSaving(true)
    try {
      const updatedStepOutputs = {
        ...allStepOutputs,
        [stepId]: {
          ...currentOutput,
          output: aiSuggestion,
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
        setEditedOutput(aiSuggestion)
        setAiSuggestion(null)
        setHasChanges(false)
        onSave(updatedStepOutputs)
        toast.success('Guardado', 'Output guardado correctamente')
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Error saving output:', error)
      toast.error('Error al guardar', error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscardSuggestion = () => {
    setAiSuggestion(null)
    setAiPrompt('')
    setShowComparison(false)
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
        toast.success('Guardado', 'Output guardado correctamente')
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Error saving output:', error)
      toast.error('Error al guardar', error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  const handleRevert = async () => {
    const confirmed = await modal.confirm({
      title: 'Restaurar original',
      message: '¿Restaurar el output original generado por la IA?',
      confirmText: 'Restaurar',
      cancelText: 'Cancelar',
      variant: 'warning',
    })
    if (confirmed) {
      setEditedOutput(originalOutput)
      setHasChanges(originalOutput !== currentOutput.output)
      setAiSuggestion(null)
      setIsEditing(true)
      toast.info('Restaurado', 'Output original restaurado')
    }
  }

  const handleExportTables = () => {
    if (tables.length === 0) {
      toast.warning('Sin tablas', 'No se encontraron tablas en el output')
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <FileOutput className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-white/90 bg-white/20 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                    Paso {stepOrder}
                  </span>
                  <h2 className="text-xl font-bold text-white">{stepName}</h2>
                  {isEdited && (
                    <span className="text-xs font-medium text-amber-100 bg-amber-600/50 px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
                      <Edit2 size={10} />
                      Editado
                    </span>
                  )}
                  {aiSuggestion && (
                    <span className="text-xs font-medium text-purple-100 bg-purple-600/50 px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
                      <Sparkles size={10} />
                      Sugerencia AI
                    </span>
                  )}
                </div>
                <p className="text-orange-100 text-sm mt-1">{campaignName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <div className="flex items-center gap-2 text-orange-100 text-sm">
              <Type size={14} />
              <span>{charCount.toLocaleString()} caracteres</span>
            </div>
            <div className="flex items-center gap-2 text-orange-100 text-sm">
              <Hash size={14} />
              <span>{wordCount.toLocaleString()} palabras</span>
            </div>
            {currentOutput.tokens && (
              <div className="flex items-center gap-2 text-orange-100 text-sm">
                <Sparkles size={14} />
                <span>{currentOutput.tokens.toLocaleString()} tokens</span>
              </div>
            )}
            {currentOutput.completed_at && (
              <div className="flex items-center gap-2 text-orange-100 text-sm">
                <Clock size={14} />
                <span>{new Date(currentOutput.completed_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* AI Assistant Bar */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-purple-600">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Sparkles size={16} />
              </div>
              <span className="text-sm font-semibold">AI Assistant</span>
            </div>
            <div className="flex-1 flex items-center gap-3">
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
                placeholder={selectedText
                  ? `Instrucción para: "${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}"`
                  : aiSuggestion
                    ? "Pide más cambios a la sugerencia..."
                    : "Describe qué cambios deseas (ej: 'Agrega más detalle sobre X')..."
                }
                className="flex-1 px-4 py-2.5 text-sm border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900 placeholder:text-gray-400"
                disabled={isGenerating}
              />
              <button
                onClick={() => setShowAiConfig(!showAiConfig)}
                className={`p-2.5 rounded-xl border transition-all ${
                  showAiConfig
                    ? 'bg-purple-100 border-purple-300 text-purple-700'
                    : 'bg-white border-purple-200 text-purple-600 hover:bg-purple-50'
                }`}
                title="Configurar modelo de IA"
              >
                <Settings size={16} />
              </button>
              <button
                onClick={handleGenerateSuggestion}
                disabled={isGenerating || !aiPrompt.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed inline-flex items-center gap-2 font-medium shadow-md hover:shadow-lg transition-all"
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

          {/* AI Model Configuration Panel */}
          {showAiConfig && (
            <div className="mt-4 p-4 bg-white rounded-xl border border-purple-200 space-y-4">
              <div className="flex items-center gap-2 text-purple-700 font-medium text-sm">
                <Cpu size={16} />
                Configuración del Modelo
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Model Selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Modelo
                  </label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  >
                    <optgroup label="Google (Gemini)">
                      {LLM_MODELS.filter(m => m.provider === 'Google').map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="OpenAI">
                      {LLM_MODELS.filter(m => m.provider === 'OpenAI').map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Anthropic (Claude)">
                      {LLM_MODELS.filter(m => m.provider === 'Anthropic').map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Temperature */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Temperature: {aiTemperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={aiTemperature}
                    onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Preciso</span>
                    <span>Creativo</span>
                  </div>
                </div>

                {/* Max Tokens */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    min="1000"
                    max="32000"
                    step="1000"
                    value={aiMaxTokens}
                    onChange={(e) => setAiMaxTokens(parseInt(e.target.value) || 8192)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {(() => {
                      const equiv = getTokenEquivalence(aiMaxTokens)
                      return `≈ ${equiv.words.toLocaleString()} palabras (${equiv.pages} pág)`
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selection mode and info */}
          <div className="flex items-center gap-4 mt-3">
            {!aiSuggestion && !isEditing && (
              <button
                onClick={() => {
                  setSelectionMode(!selectionMode)
                  if (selectionMode) clearSelection()
                }}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectionMode
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                <MousePointer2 size={12} />
                {selectionMode ? 'Selección activa' : 'Seleccionar texto'}
              </button>
            )}

            {selectedText && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-purple-700 bg-purple-100 px-3 py-1.5 rounded-lg max-w-xs truncate font-medium">
                  Seleccionado: &quot;{selectedText.substring(0, 40)}{selectedText.length > 40 ? '...' : ''}&quot;
                </span>
                <button
                  onClick={clearSelection}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {aiSuggestion && changeSummary.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-purple-600 font-medium">Cambios:</span>
                {changeSummary.map((change, i) => (
                  <span key={i} className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg">{change}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-3">
            {tables.length > 0 && (
              <button
                onClick={handleExportTables}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <Table size={14} />
                <span>Exportar {tables.length} tabla{tables.length > 1 ? 's' : ''}</span>
                <Download size={12} />
              </button>
            )}
            {aiSuggestion && (
              <button
                onClick={() => setShowComparison(!showComparison)}
                className="inline-flex items-center gap-1.5 text-xs text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                {showComparison ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showComparison ? 'Ocultar original' : 'Comparar con original'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEdited && !isEditing && !aiSuggestion && (
              <button
                onClick={handleRevert}
                disabled={saving}
                className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50 inline-flex items-center gap-1.5 font-medium transition-colors"
              >
                <RotateCcw size={12} />
                Restaurar Original
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-6 min-h-0 bg-gradient-to-b from-gray-50/50 to-white">
          {aiSuggestion ? (
            // AI Suggestion Mode
            showComparison ? (
              // Side by side comparison
              <div className="h-full flex gap-4">
                <div className="flex-1 overflow-auto bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <div className="text-xs text-gray-500 mb-4 pb-3 border-b border-gray-100 font-semibold uppercase tracking-wide">
                    Original
                  </div>
                  <MarkdownRenderer content={editedOutput} />
                </div>
                <div className="flex-1 overflow-auto bg-white rounded-2xl border-2 border-purple-200 p-6 shadow-sm">
                  <div className="text-xs text-purple-600 mb-4 pb-3 border-b border-purple-100 font-semibold uppercase tracking-wide flex items-center gap-2">
                    <Sparkles size={12} />
                    Sugerencia AI
                  </div>
                  <MarkdownRenderer content={aiSuggestion} />
                </div>
              </div>
            ) : (
              // Just show the suggestion with full markdown
              <div
                ref={contentRef}
                className="h-full overflow-auto bg-white rounded-2xl border-2 border-purple-200 p-6 shadow-sm"
              >
                <MarkdownRenderer content={aiSuggestion} />
              </div>
            )
          ) : isEditing ? (
            // Manual editing mode - split view with editor and preview
            <div className="h-full flex gap-4">
              <div className="flex-1 flex flex-col min-w-0">
                <div className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">Editor</div>
                <textarea
                  value={editedOutput}
                  onChange={(e) => handleTextChange(e.target.value)}
                  className="flex-1 w-full resize-none bg-white rounded-2xl border-2 border-orange-200 p-5 text-sm text-gray-900 font-mono leading-relaxed focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none shadow-sm"
                  placeholder="Output del paso..."
                  autoFocus
                />
              </div>
              <div className="flex-1 flex flex-col min-w-0">
                <div className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">Vista Previa</div>
                <div className="flex-1 overflow-auto bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  {editedOutput ? (
                    <MarkdownRenderer content={editedOutput} />
                  ) : (
                    <span className="text-gray-400 italic">Escribe para ver la vista previa...</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Preview mode with markdown rendering
            <div
              ref={contentRef}
              className={`h-full overflow-auto bg-white rounded-2xl border p-6 shadow-sm transition-all ${
                selectionMode
                  ? 'border-2 border-purple-300 cursor-text selection:bg-purple-200'
                  : 'border-gray-200'
              }`}
              onMouseUp={handleTextSelection}
            >
              {selectionMode && (
                <div className="text-sm text-purple-600 mb-4 pb-3 border-b border-purple-100 bg-purple-50 -mx-6 -mt-6 px-6 py-3 rounded-t-2xl flex items-center gap-2">
                  <MousePointer2 size={16} />
                  Selecciona el texto que quieres modificar, luego escribe la instrucción arriba
                </div>
              )}
              {editedOutput ? (
                <MarkdownRenderer content={editedOutput} />
              ) : (
                <div className="text-center py-12">
                  <div className="inline-block p-4 bg-gray-100 rounded-2xl mb-4">
                    <FileOutput className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-gray-500">No hay output generado todavía.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-orange-50/30 shrink-0">
          <div className="flex items-center gap-3">
            {hasChanges && !aiSuggestion && (
              <span className="text-sm text-amber-600 inline-flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-lg font-medium">
                <AlertTriangle size={14} />
                Cambios sin guardar
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {aiSuggestion ? (
              // AI Suggestion actions
              <>
                <button
                  onClick={handleDiscardSuggestion}
                  className="px-4 py-2.5 text-sm border border-red-200 text-red-700 rounded-xl hover:bg-red-50 inline-flex items-center gap-1.5 font-medium transition-colors"
                >
                  <XCircle size={14} />
                  Descartar
                </button>
                <button
                  onClick={() => {
                    setIsEditing(true)
                    setEditedOutput(aiSuggestion)
                    setAiSuggestion(null)
                    setHasChanges(true)
                    setShowComparison(false)
                  }}
                  className="px-4 py-2.5 text-sm border border-purple-200 text-purple-700 rounded-xl hover:bg-purple-50 inline-flex items-center gap-1.5 font-medium transition-colors"
                >
                  <Edit2 size={14} />
                  Editar Manualmente
                </button>
                <button
                  onClick={handleApplySuggestion}
                  disabled={saving}
                  className="px-5 py-2.5 text-sm bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 inline-flex items-center gap-1.5 font-medium shadow-md hover:shadow-lg transition-all"
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Aplicar y Guardar
                </button>
              </>
            ) : isEditing ? (
              // Manual editing actions
              <>
                <button
                  onClick={async () => {
                    if (hasChanges) {
                      const confirmed = await modal.confirm({
                        title: 'Descartar cambios',
                        message: '¿Estás seguro de que quieres descartar los cambios?',
                        confirmText: 'Descartar',
                        cancelText: 'Seguir editando',
                        variant: 'warning',
                      })
                      if (!confirmed) return
                    }
                    setEditedOutput(currentOutput.output || '')
                    setHasChanges(false)
                    setIsEditing(false)
                  }}
                  className="px-5 py-2.5 text-sm border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="px-5 py-2.5 text-sm bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed inline-flex items-center gap-1.5 font-medium shadow-md hover:shadow-lg transition-all"
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
                  className="px-5 py-2.5 text-sm border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-medium transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 text-sm bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 inline-flex items-center gap-1.5 font-medium shadow-md hover:shadow-lg transition-all"
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
