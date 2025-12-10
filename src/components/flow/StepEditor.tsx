'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Eye, Code, Copy, Check } from 'lucide-react'
import { FlowStep, OutputFormat } from '@/types/flow.types'
import { formatTokenCount } from '@/lib/supabase'

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Step</h2>
            <p className="text-sm text-gray-600 mt-1">
              Configure name, description, documents, prompt, and dependencies
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step Order */}
          <div>
            <label className="block font-medium text-gray-900 mb-2">
              🔢 Position (Order)
            </label>
            <input
              type="number"
              min="1"
              value={editedStep.order}
              onChange={(e) =>
                setEditedStep((prev) => ({ ...prev, order: parseInt(e.target.value) || 1 }))
              }
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">
              Los pasos se ejecutan en orden ascendente. Al guardar, los pasos se reordenarán automáticamente.
            </p>
          </div>

          {/* Step Name */}
          <div>
            <label className="block font-medium text-gray-900 mb-2">
              📌 Step Name
            </label>
            <input
              type="text"
              value={editedStep.name}
              onChange={(e) =>
                setEditedStep((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g., Market Research, Competitor Analysis"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Step Description */}
          <div>
            <label className="block font-medium text-gray-900 mb-2">
              📝 Description <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={editedStep.description}
              onChange={(e) =>
                setEditedStep((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Brief description of what this step does"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Base Documents */}
          <div>
            <label className="block font-medium text-gray-900 mb-3">
              📄 Base Documents
            </label>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Categoría:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-sm px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
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
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setAssignmentFilter('all')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    assignmentFilter === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Todos ({documents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentFilter('assigned')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    assignmentFilter === 'assigned'
                      ? 'bg-green-100 text-green-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Asignados ({assignedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentFilter('unassigned')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    assignmentFilter === 'unassigned'
                      ? 'bg-yellow-100 text-yellow-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sin asignar ({unassignedCount})
                </button>
              </div>
            </div>

            {documents.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No documents available. Upload documents first.
              </p>
            ) : filteredDocs.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4 text-center border border-gray-200 rounded-lg">
                No hay documentos con estos filtros
              </p>
            ) : (
              <>
                <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                  {filteredDocs.map((doc) => (
                    <label
                      key={doc.id}
                      className={`flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer relative ${
                        editedStep.base_doc_ids.includes(doc.id) ? 'bg-green-50' : ''
                      }`}
                      onMouseEnter={() => setHoveredDoc(doc)}
                      onMouseLeave={() => setHoveredDoc(null)}
                    >
                      <input
                        type="checkbox"
                        checked={editedStep.base_doc_ids.includes(doc.id)}
                        onChange={() => handleToggleDoc(doc.id)}
                        className="rounded"
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
                        <div className="absolute left-full ml-2 top-0 z-50 w-80 bg-white border border-gray-300 rounded-lg shadow-xl p-3 pointer-events-none">
                          <p className="text-xs font-medium text-gray-700 mb-1">{doc.filename}</p>
                          <div className="text-xs text-gray-600 max-h-48 overflow-hidden whitespace-pre-wrap">
                            {doc.extracted_content.substring(0, 500)}
                            {doc.extracted_content.length > 500 && '...'}
                          </div>
                        </div>
                      )}
                    </label>
                  ))}
                </div>

                <p className="text-sm text-gray-600 mt-2">
                  Selected: {editedStep.base_doc_ids.length} document{editedStep.base_doc_ids.length !== 1 ? 's' : ''},{' '}
                  {formatTokenCount(selectedDocsTokens)} tokens
                </p>
              </>
            )}
          </div>

          {/* Auto-receive from previous steps */}
          <div>
            <label className="block font-medium text-gray-900 mb-3">
              📥 Auto-receive output from previous steps
            </label>

            {availablePrevSteps.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No previous steps available (this is one of the first steps)
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg">
                {availablePrevSteps.map((prevStep) => (
                  <label
                    key={prevStep.id}
                    className="flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={editedStep.auto_receive_from.includes(prevStep.id)}
                      onChange={() => handleToggleDependency(prevStep.id)}
                      className="rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Step {prevStep.order}: {prevStep.name}
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
          <div>
            <label className="block font-medium text-gray-900 mb-2">
              📄 Output Format
            </label>
            <select
              value={editedStep.output_format || 'text'}
              onChange={(e) =>
                setEditedStep((prev) => ({ ...prev, output_format: e.target.value as OutputFormat }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              {OUTPUT_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label} - {format.description}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              The AI will be instructed to format the output in the selected format.
            </p>
          </div>

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium text-gray-900">
                📝 Prompt
              </label>
              <div className="flex items-center gap-2">
                {/* Copy buttons */}
                <button
                  type="button"
                  onClick={() => handleCopyPrompt(false)}
                  className="px-2 py-1.5 text-xs rounded-lg inline-flex items-center gap-1 bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  title="Copiar prompt con variables"
                >
                  {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  Copiar
                </button>
                {hasVariables && (
                  <button
                    type="button"
                    onClick={() => handleCopyPrompt(true)}
                    className="px-2 py-1.5 text-xs rounded-lg inline-flex items-center gap-1 bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                    title="Copiar con valores reales"
                  >
                    <Copy size={14} />
                    Con valores
                  </button>
                )}
                {hasVariables && (
                  <button
                    type="button"
                    onClick={() => setShowRealValues(!showRealValues)}
                    className={`px-3 py-1.5 text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                      showRealValues
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                        Variables genéricas
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {showRealValues ? (
              // Vista de solo lectura con valores reales
              <div className="w-full px-3 py-2 border border-green-300 bg-green-50 rounded-lg font-mono text-sm text-gray-900 whitespace-pre-wrap max-h-96 overflow-y-auto">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="Escribe {{ para ver las variables disponibles..."
                />
                {/* Autocomplete dropdown */}
                {showAutocomplete && filteredVariables.length > 0 && (
                  <div className="absolute left-4 bottom-4 z-50 w-64 bg-white border border-gray-300 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    <div className="p-2 border-b border-gray-200 bg-gray-50">
                      <p className="text-xs text-gray-500">Variables disponibles (↑↓ navegar, Enter seleccionar)</p>
                    </div>
                    {filteredVariables.map((varName, index) => (
                      <button
                        key={varName}
                        type="button"
                        onClick={() => insertVariable(varName)}
                        className={`w-full text-left px-3 py-2 text-sm font-mono hover:bg-blue-50 ${
                          index === autocompleteIndex ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
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

            {/* Available Variables Section */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800 mb-2">Variables disponibles ({
                (() => {
                  const allVarsSet = new Set<string>()
                  // Base variables
                  ;['ecp_name', 'problem_core', 'country', 'industry', 'client_name'].forEach(v => allVarsSet.add(v))
                  // Project variables
                  if (projectVariables) projectVariables.forEach(v => v?.name && allVarsSet.add(v.name))
                  // Campaign variables
                  if (campaignVariables) Object.keys(campaignVariables).forEach(k => allVarsSet.add(k))
                  return allVarsSet.size
                })()
              }):</p>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const allVarsSet = new Set<string>()

                  // 1. Base/legacy variables
                  ;['ecp_name', 'problem_core', 'country', 'industry', 'client_name'].forEach(v => allVarsSet.add(v))

                  // 2. Project-defined variables
                  if (projectVariables && Array.isArray(projectVariables)) {
                    projectVariables.forEach(v => {
                      if (v && v.name) allVarsSet.add(v.name)
                    })
                  }

                  // 3. Campaign variables (includes all merged variables)
                  if (campaignVariables && typeof campaignVariables === 'object') {
                    Object.keys(campaignVariables).forEach(k => allVarsSet.add(k))
                  }

                  // 4. Variables from prompts
                  allSteps.forEach(s => {
                    if (s.prompt) {
                      const matches = s.prompt.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)
                      if (matches) {
                        matches.forEach(match => {
                          const varName = match.replace(/\{\{\s*|\s*\}\}/g, '')
                          allVarsSet.add(varName)
                        })
                      }
                    }
                  })

                  return Array.from(allVarsSet).sort().map(varName => (
                    <code
                      key={varName}
                      className="text-xs bg-white text-blue-700 px-2 py-1 rounded border border-blue-300 cursor-pointer hover:bg-blue-100"
                      onClick={() => {
                        const textarea = document.querySelector('textarea')
                        if (textarea && !showRealValues) {
                          const start = textarea.selectionStart
                          const end = textarea.selectionEnd
                          const text = editedStep.prompt
                          const newText = text.substring(0, start) + `{{ ${varName} }}` + text.substring(end)
                          setEditedStep(prev => ({ ...prev, prompt: newText }))
                        }
                      }}
                      title="Click para insertar"
                    >
                      {`{{ ${varName} }}`}
                    </code>
                  ))
                })()}
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Haz clic en una variable para insertarla en el prompt
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex gap-3 mb-2">
            <button
              onClick={() => onSave(editedStep)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Step
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Atajos: <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300">Ctrl+S</kbd> guardar · <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300">Esc</kbd> cancelar
          </p>
        </div>
      </div>
    </div>
  )
}
