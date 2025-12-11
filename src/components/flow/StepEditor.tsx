'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Eye, Code, Copy, Check, FileText, ArrowRight, Hash, MessageSquare, Sparkles, AlertTriangle, Info } from 'lucide-react'
import { FlowStep, OutputFormat } from '@/types/flow.types'
import { formatTokenCount } from '@/lib/supabase'
import { usePromptValidator } from '@/hooks/usePromptValidator'
import PromptValidationPanel, { ValidationBadge } from './PromptValidationPanel'

interface StepEditorProps {
  step: FlowStep
  documents: any[]
  allSteps: FlowStep[]
  projectVariables: Array<{ name: string; default_value?: string; description?: string }>
  campaignVariables?: Record<string, string> // Variables reales de la campaña
  onSave: (step: FlowStep) => void
  onCancel: () => void
}

const OUTPUT_FORMATS: { value: OutputFormat; label: string; description: string }[] = [
  { value: 'text', label: 'Plain Text', description: 'Simple text output' },
  { value: 'markdown', label: 'Markdown', description: 'Formatted markdown with headings, lists, etc.' },
  { value: 'json', label: 'JSON', description: 'Structured data in JSON format' },
  { value: 'csv', label: 'CSV', description: 'Comma-separated values for spreadsheets' },
  { value: 'html', label: 'HTML (Google Docs)', description: 'HTML format - import to Google Docs via File > Open' },
  { value: 'xml', label: 'XML', description: 'XML structured data' },
]

export default function StepEditor({
  step,
  documents,
  allSteps,
  projectVariables,
  campaignVariables = {},
  onSave,
  onCancel,
}: StepEditorProps) {
  const [editedStep, setEditedStep] = useState<FlowStep>({ ...step })
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')
  const [showRealValues, setShowRealValues] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hoveredDoc, setHoveredDoc] = useState<any | null>(null)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteFilter, setAutocompleteFilter] = useState('')
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Get all available variables
  const getAllVariables = useCallback(() => {
    const allVarsSet = new Set<string>()
    ;['ecp_name', 'problem_core', 'country', 'industry', 'client_name'].forEach(v => allVarsSet.add(v))
    if (projectVariables) projectVariables.forEach(v => v?.name && allVarsSet.add(v.name))
    if (campaignVariables) Object.keys(campaignVariables).forEach(k => allVarsSet.add(k))
    return Array.from(allVarsSet).sort()
  }, [projectVariables, campaignVariables])

  // Prompt validation
  const validation = usePromptValidator({
    prompt: editedStep.prompt,
    declaredVariables: getAllVariables(),
    availableSteps: allSteps.filter(s => s.order < step.order).map(s => ({ id: s.id, name: s.name }))
  })

  // Handle applying a suggestion from validation
  const handleApplySuggestion = useCallback((originalVar: string, suggestion: string) => {
    if (!originalVar) return
    // Replace all occurrences of the original variable with the suggestion
    const regex = new RegExp(`\\{\\{\\s*${originalVar}\\s*\\}\\}`, 'g')
    const newPrompt = editedStep.prompt.replace(regex, `{{ ${suggestion} }}`)
    setEditedStep(prev => ({ ...prev, prompt: newPrompt }))
  }, [editedStep.prompt])

  // Filter variables for autocomplete
  const filteredVariables = getAllVariables().filter(v =>
    v.toLowerCase().includes(autocompleteFilter.toLowerCase())
  )

  // Handle prompt change with autocomplete detection
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart
    setEditedStep(prev => ({ ...prev, prompt: value }))

    // Check for {{ trigger
    const textBeforeCursor = value.substring(0, cursorPos)
    const match = textBeforeCursor.match(/\{\{\s*([a-zA-Z_]*)$/)

    if (match) {
      setShowAutocomplete(true)
      setAutocompleteFilter(match[1] || '')
      setAutocompleteIndex(0)
    } else {
      setShowAutocomplete(false)
      setAutocompleteFilter('')
    }
  }

  // Insert variable from autocomplete
  const insertVariable = (varName: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const text = editedStep.prompt
    const textBeforeCursor = text.substring(0, cursorPos)
    const textAfterCursor = text.substring(cursorPos)

    // Find where {{ starts
    const match = textBeforeCursor.match(/\{\{\s*[a-zA-Z_]*$/)
    if (match) {
      const startPos = cursorPos - match[0].length
      const newText = text.substring(0, startPos) + `{{ ${varName} }}` + textAfterCursor
      setEditedStep(prev => ({ ...prev, prompt: newText }))

      // Reset cursor position
      setTimeout(() => {
        const newPos = startPos + `{{ ${varName} }}`.length
        textarea.focus()
        textarea.setSelectionRange(newPos, newPos)
      }, 0)
    }

    setShowAutocomplete(false)
    setAutocompleteFilter('')
  }

  // Handle keyboard navigation in autocomplete
  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showAutocomplete) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAutocompleteIndex(prev => Math.min(prev + 1, filteredVariables.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAutocompleteIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filteredVariables.length > 0) {
      e.preventDefault()
      insertVariable(filteredVariables[autocompleteIndex])
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false)
    }
  }

  // Handle save with keyboard
  const handleSaveStep = useCallback(() => {
    onSave(editedStep)
  }, [editedStep, onSave])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSaveStep()
      }
      // Escape to cancel
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSaveStep, onCancel])

  // Copy prompt to clipboard
  const handleCopyPrompt = async (withValues: boolean = false) => {
    const textToCopy = withValues ? getPromptWithRealValues(editedStep.prompt) : editedStep.prompt
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Reemplazar variables en el prompt con valores reales
  const getPromptWithRealValues = (prompt: string): string => {
    let result = prompt

    // Variables de campaña (custom_variables)
    Object.entries(campaignVariables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
      result = result.replace(regex, value || `[${key}: sin valor]`)
    })

    return result
  }

  const displayPrompt = showRealValues ? getPromptWithRealValues(editedStep.prompt) : editedStep.prompt
  const hasVariables = Object.keys(campaignVariables).length > 0

  // Previous steps (lower order) that can be dependencies
  const availablePrevSteps = allSteps.filter((s) => s.order < step.order)

  // Filter documents by category and assignment status
  const filteredDocs = documents.filter((doc) => {
    // Category filter
    if (categoryFilter !== 'all' && doc.category !== categoryFilter) {
      return false
    }
    // Assignment filter
    if (assignmentFilter === 'assigned' && !editedStep.base_doc_ids.includes(doc.id)) {
      return false
    }
    if (assignmentFilter === 'unassigned' && editedStep.base_doc_ids.includes(doc.id)) {
      return false
    }
    return true
  })

  // Get unique categories from all documents
  const categories = Array.from(new Set(documents.map((doc) => doc.category))).sort()

  // Count documents by assignment
  const assignedCount = documents.filter(doc => editedStep.base_doc_ids.includes(doc.id)).length
  const unassignedCount = documents.length - assignedCount

  const handleToggleDoc = (docId: string) => {
    setEditedStep((prev) => ({
      ...prev,
      base_doc_ids: prev.base_doc_ids.includes(docId)
        ? prev.base_doc_ids.filter((id) => id !== docId)
        : [...prev.base_doc_ids, docId],
    }))
  }

  const handleToggleDependency = (stepId: string) => {
    setEditedStep((prev) => ({
      ...prev,
      auto_receive_from: prev.auto_receive_from.includes(stepId)
        ? prev.auto_receive_from.filter((id) => id !== stepId)
        : [...prev.auto_receive_from, stepId],
    }))
  }

  const selectedDocsTokens = documents
    .filter((doc) => editedStep.base_doc_ids.includes(doc.id))
    .reduce((sum, doc) => sum + (doc.token_count || 0), 0)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-md">
                {editedStep.order}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Editar Paso</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  Configura nombre, documentos, prompt y dependencias
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info Section */}
          <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Info size={18} className="text-gray-400" />
              Información Básica
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Step Order */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  <Hash size={14} className="inline mr-1" />
                  Posición (Orden)
                </label>
                <input
                  type="number"
                  min="1"
                  value={editedStep.order}
                  onChange={(e) =>
                    setEditedStep((prev) => ({ ...prev, order: parseInt(e.target.value) || 1 }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 transition-all"
                />
              </div>

              {/* Step Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Nombre del Paso
                </label>
                <input
                  type="text"
                  value={editedStep.name}
                  onChange={(e) =>
                    setEditedStep((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="ej: Market Research, Competitor Analysis"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 transition-all"
                />
              </div>
            </div>

            {/* Step Description */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Descripción <span className="text-gray-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={editedStep.description}
                onChange={(e) =>
                  setEditedStep((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Breve descripción de lo que hace este paso"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 transition-all"
              />
            </div>
          </div>

          {/* Base Documents Section */}
          <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText size={18} className="text-blue-500" />
              Documentos Base
            </h3>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Categoría:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-700 bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todas ({documents.length})</option>
                  {categories.map((cat) => {
                    const count = documents.filter(d => d.category === cat).length
                    return (
                      <option key={cat} value={cat}>
                        {cat} ({count})
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Assignment Filter */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {[
                  { value: 'all', label: `Todos (${documents.length})` },
                  { value: 'assigned', label: `Asignados (${assignedCount})` },
                  { value: 'unassigned', label: `Sin asignar (${unassignedCount})` },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setAssignmentFilter(filter.value as typeof assignmentFilter)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      assignmentFilter === filter.value
                        ? filter.value === 'assigned' ? 'bg-green-100 text-green-700 shadow-sm' :
                          filter.value === 'unassigned' ? 'bg-yellow-100 text-yellow-700 shadow-sm' :
                          'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <FileText size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500 italic">
                  No hay documentos disponibles. Sube documentos primero.
                </p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-sm text-gray-500 italic">
                  No hay documentos con estos filtros
                </p>
              </div>
            ) : (
              <>
                <div className="border border-gray-200 rounded-xl max-h-64 overflow-y-auto bg-white">
                  {filteredDocs.map((doc) => (
                    <label
                      key={doc.id}
                      className={`flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer relative transition-colors ${
                        editedStep.base_doc_ids.includes(doc.id) ? 'bg-green-50' : ''
                      }`}
                      onMouseEnter={() => setHoveredDoc(doc)}
                      onMouseLeave={() => setHoveredDoc(null)}
                    >
                      <input
                        type="checkbox"
                        checked={editedStep.base_doc_ids.includes(doc.id)}
                        onChange={() => handleToggleDoc(doc.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 mr-1">
                            {doc.category}
                          </span>
                          {formatTokenCount(doc.token_count || 0)} tokens
                        </p>
                      </div>
                      {/* Preview tooltip */}
                      {hoveredDoc?.id === doc.id && doc.extracted_content && (
                        <div className="absolute left-full ml-2 top-0 z-50 w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-4 pointer-events-none">
                          <p className="text-xs font-medium text-gray-700 mb-2">{doc.filename}</p>
                          <div className="text-xs text-gray-600 max-h-48 overflow-hidden whitespace-pre-wrap">
                            {doc.extracted_content.substring(0, 500)}
                            {doc.extracted_content.length > 500 && '...'}
                          </div>
                        </div>
                      )}
                    </label>
                  ))}
                </div>

                <p className="text-sm text-gray-600 mt-3 flex items-center gap-2">
                  <Check size={16} className="text-green-500" />
                  Seleccionados: <span className="font-medium">{editedStep.base_doc_ids.length}</span> documento{editedStep.base_doc_ids.length !== 1 ? 's' : ''},{' '}
                  <span className="font-medium">{formatTokenCount(selectedDocsTokens)}</span> tokens
                </p>
              </>
            )}
          </div>

          {/* Auto-receive from previous steps */}
          <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ArrowRight size={18} className="text-purple-500" />
              Recibir Output de Pasos Anteriores
            </h3>

            {availablePrevSteps.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-sm text-gray-500 italic">
                  No hay pasos anteriores disponibles (este es uno de los primeros pasos)
                </p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                {availablePrevSteps.map((prevStep) => (
                  <label
                    key={prevStep.id}
                    className={`flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors ${
                      editedStep.auto_receive_from.includes(prevStep.id) ? 'bg-purple-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editedStep.auto_receive_from.includes(prevStep.id)}
                      onChange={() => handleToggleDependency(prevStep.id)}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-700 font-medium text-sm">
                      {prevStep.order}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {prevStep.name}
                      </p>
                      {prevStep.description && (
                        <p className="text-xs text-gray-500">{prevStep.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Output Format */}
          <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText size={18} className="text-gray-500" />
              Formato de Salida
            </h3>
            <select
              value={editedStep.output_format || 'text'}
              onChange={(e) =>
                setEditedStep((prev) => ({ ...prev, output_format: e.target.value as OutputFormat }))
              }
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
            >
              {OUTPUT_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label} - {format.description}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt Section */}
          <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare size={18} className="text-indigo-500" />
                  Prompt
                </h3>
                <ValidationBadge validation={validation} />
              </div>
              <div className="flex items-center gap-2">
                {/* Copy buttons */}
                <button
                  type="button"
                  onClick={() => handleCopyPrompt(false)}
                  className={`px-3 py-1.5 text-xs rounded-lg inline-flex items-center gap-1.5 transition-all ${
                    copied ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                  title="Copiar prompt con variables"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
                {hasVariables && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(true)}
                      className="px-3 py-1.5 text-xs rounded-lg inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors"
                      title="Copiar con valores reales"
                    >
                      <Copy size={14} />
                      Con valores
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRealValues(!showRealValues)}
                      className={`px-3 py-1.5 text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                        showRealValues
                          ? 'bg-green-100 border border-green-200 text-green-700'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {showRealValues ? (
                        <>
                          <Eye size={14} />
                          Valores reales
                        </>
                      ) : (
                        <>
                          <Code size={14} />
                          Variables
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {showRealValues ? (
              // Vista de solo lectura con valores reales
              <div className="w-full px-4 py-3 border border-green-200 bg-green-50 rounded-xl font-mono text-sm text-gray-900 whitespace-pre-wrap max-h-96 overflow-y-auto">
                {displayPrompt}
              </div>
            ) : (
              // Vista editable con variables y autocompletado
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={editedStep.prompt}
                  onChange={handlePromptChange}
                  onKeyDown={handlePromptKeyDown}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 transition-all"
                  placeholder="Escribe {{ para ver las variables disponibles..."
                />
                {/* Autocomplete dropdown */}
                {showAutocomplete && filteredVariables.length > 0 && (
                  <div className="absolute left-4 bottom-4 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                      <p className="text-xs text-gray-500">Variables disponibles (↑↓ navegar, Enter seleccionar)</p>
                    </div>
                    {filteredVariables.map((varName, index) => (
                      <button
                        key={varName}
                        type="button"
                        onClick={() => insertVariable(varName)}
                        className={`w-full text-left px-3 py-2 text-sm font-mono hover:bg-indigo-50 transition-colors ${
                          index === autocompleteIndex ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
                        }`}
                      >
                        {'{{ '}{varName}{' }}'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showRealValues && (
              <p className="text-xs text-green-600 mt-2">
                Vista previa con los valores de las variables de esta campaña (solo lectura)
              </p>
            )}

            {/* Prompt Validation Panel */}
            <div className="mt-4">
              <PromptValidationPanel
                validation={validation}
                onApplySuggestion={handleApplySuggestion}
              />
            </div>

            {/* Available Variables Section */}
            <div className="mt-4 p-4 bg-white/70 rounded-xl border border-indigo-100">
              <p className="text-sm font-medium text-indigo-800 mb-3 flex items-center gap-2">
                <Sparkles size={16} />
                Variables disponibles ({getAllVariables().length})
              </p>
              <div className="flex flex-wrap gap-2">
                {getAllVariables().map(varName => (
                  <code
                    key={varName}
                    className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1.5 rounded-lg border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
                    onClick={() => {
                      const textarea = textareaRef.current
                      if (textarea && !showRealValues) {
                        const start = textarea.selectionStart
                        const end = textarea.selectionEnd
                        const text = editedStep.prompt
                        const newText = text.substring(0, start) + `{{ ${varName} }}` + text.substring(end)
                        setEditedStep(prev => ({ ...prev, prompt: newText }))
                        setTimeout(() => {
                          const newPos = start + `{{ ${varName} }}`.length
                          textarea.focus()
                          textarea.setSelectionRange(newPos, newPos)
                        }, 0)
                      }
                    }}
                    title="Click para insertar"
                  >
                    {`{{ ${varName} }}`}
                  </code>
                ))}
              </div>
              <p className="text-xs text-indigo-600 mt-3">
                Haz clic en una variable para insertarla en el prompt
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-gray-100 bg-gray-50">
          <div className="flex gap-3 mb-3">
            <button
              onClick={() => onSave(editedStep)}
              className="flex-1 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 font-medium shadow-md hover:shadow-lg transition-all"
            >
              Guardar Paso
            </button>
            <button
              onClick={onCancel}
              className="px-5 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-white font-medium transition-colors"
            >
              Cancelar
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Atajos: <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-200 text-gray-600">Ctrl+S</kbd> guardar · <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-200 text-gray-600">Esc</kbd> cancelar
          </p>
        </div>
      </div>
    </div>
  )
}
