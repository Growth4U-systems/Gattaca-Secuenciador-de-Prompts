'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { X, Eye, Code, Copy, Check, FileText, ArrowRight, Hash, MessageSquare, Sparkles, Info, Cpu, Search, Plus, AlertTriangle, Loader2, Trash2, Database, Zap, DollarSign, FlaskConical, Clock } from 'lucide-react'
import { FlowStep, OutputFormat, LLMModel, RequiredDocument, RetrievalMode, MODEL_PRICING } from '@/types/flow.types'
import { formatTokenCount } from '@/lib/supabase'
import { usePromptValidator } from '@/hooks/usePromptValidator'
import { findMatchingDocument, getConfidenceLabel } from '@/lib/documentMatcher'
import PromptValidationPanel, { ValidationBadge } from './PromptValidationPanel'
import { OpenRouterModelSelector } from '@/components/openrouter'

interface StepEditorProps {
  step: FlowStep
  documents: any[]
  allSteps: FlowStep[]
  projectVariables: Array<{ name: string; default_value?: string; description?: string }>
  campaignVariables?: Record<string, string> // Variables reales de la campaña
  onSave: (step: FlowStep) => void
  onCancel: () => void
  onAddProjectVariable?: (variable: { name: string; default_value: string; description?: string }) => Promise<void>
}

const OUTPUT_FORMATS: { value: OutputFormat; label: string; description: string }[] = [
  { value: 'text', label: 'Plain Text', description: 'Simple text output' },
  { value: 'markdown', label: 'Markdown', description: 'Formatted markdown with headings, lists, etc.' },
  { value: 'json', label: 'JSON', description: 'Structured data in JSON format' },
  { value: 'csv', label: 'CSV', description: 'Comma-separated values for spreadsheets' },
  { value: 'html', label: 'HTML (Google Docs)', description: 'HTML format - import to Google Docs via File > Open' },
  { value: 'xml', label: 'XML', description: 'XML structured data' },
]

// Modelos LLM disponibles organizados por proveedor (actualizados Dic 2025)
const LLM_MODELS: { value: string; label: string; provider: string; context: string; desc: string }[] = [
  // Gemini (Google)
  { value: 'gemini-3.0-pro-preview', label: 'Gemini 3.0 Pro', provider: 'Google', context: '2M tokens', desc: 'Último modelo, máxima capacidad' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'Google', context: '1M tokens', desc: 'Excelente calidad, estable' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google', context: '1M tokens', desc: 'Rápido y económico' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', provider: 'Google', context: '1M tokens', desc: 'Ultra ligero' },
  // Deep Research (Google) - Agente de investigación autónomo
  { value: 'deep-research-pro-preview-12-2025', label: 'Deep Research Pro', provider: 'Deep Research', context: 'Sin límite', desc: 'Agente autónomo de investigación profunda (5-10 min)' },
  // OpenAI - GPT-5 Series
  { value: 'gpt-5.2', label: 'GPT-5.2', provider: 'OpenAI', context: '256K tokens', desc: 'Última iteración, más avanzado' },
  { value: 'gpt-5', label: 'GPT-5', provider: 'OpenAI', context: '256K tokens', desc: 'Modelo principal, alta calidad' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini', provider: 'OpenAI', context: '128K tokens', desc: 'Equilibrio calidad/costo' },
  // OpenAI - GPT-4 Series
  { value: 'gpt-4.1', label: 'GPT-4.1', provider: 'OpenAI', context: '128K tokens', desc: 'Estable, muy confiable' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'OpenAI', context: '128K tokens', desc: 'Económico y rápido' },
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI', context: '128K tokens', desc: 'Multimodal, versátil' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI', context: '128K tokens', desc: 'Multimodal económico' },
  // OpenAI - o-series (Razonamiento)
  { value: 'o4-mini', label: 'o4 Mini', provider: 'OpenAI', context: '200K tokens', desc: 'Razonamiento avanzado' },
  { value: 'o3-pro', label: 'o3 Pro', provider: 'OpenAI', context: '200K tokens', desc: 'Razonamiento profundo' },
  { value: 'o3', label: 'o3', provider: 'OpenAI', context: '200K tokens', desc: 'Razonamiento estándar' },
  { value: 'o3-mini', label: 'o3 Mini', provider: 'OpenAI', context: '128K tokens', desc: 'Razonamiento rápido' },
  { value: 'o1', label: 'o1', provider: 'OpenAI', context: '200K tokens', desc: 'Razonamiento original' },
  { value: 'o1-mini', label: 'o1 Mini', provider: 'OpenAI', context: '128K tokens', desc: 'Razonamiento ligero' },
  // Anthropic (Claude 4.5)
  { value: 'claude-4.5-opus', label: 'Claude 4.5 Opus', provider: 'Anthropic', context: '200K tokens', desc: 'Máxima calidad, tareas complejas' },
  { value: 'claude-4.5-sonnet', label: 'Claude 4.5 Sonnet', provider: 'Anthropic', context: '200K tokens', desc: 'Equilibrio rendimiento/costo' },
  { value: 'claude-4.5-haiku', label: 'Claude 4.5 Haiku', provider: 'Anthropic', context: '200K tokens', desc: 'Ultra rápido y económico' },
]

export default function StepEditor({
  step,
  documents,
  allSteps,
  projectVariables,
  campaignVariables = {},
  onSave,
  onCancel,
  onAddProjectVariable,
}: StepEditorProps) {
  const [editedStep, setEditedStep] = useState<FlowStep>({ ...step })
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')
  const [docSearchQuery, setDocSearchQuery] = useState('')
  const [showRealValues, setShowRealValues] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hoveredDoc, setHoveredDoc] = useState<any | null>(null)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteFilter, setAutocompleteFilter] = useState('')
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [addingVariable, setAddingVariable] = useState<string | null>(null)
  const [addingAllVariables, setAddingAllVariables] = useState(false)

  // Required documents state
  const [requiredDocsInput, setRequiredDocsInput] = useState('')
  const [showRequiredDocsInput, setShowRequiredDocsInput] = useState(false)

  // Get declared variables (for validation) - only from project and campaign config
  const declaredVariables = useMemo(() => {
    const varsSet = new Set<string>()

    // Project-defined variables
    if (Array.isArray(projectVariables)) {
      projectVariables.forEach(v => {
        if (v && v.name && typeof v.name === 'string' && v.name.trim()) {
          varsSet.add(v.name.trim())
        }
      })
    }

    // Campaign-specific variables (includes overrides and custom vars)
    if (campaignVariables && typeof campaignVariables === 'object') {
      Object.keys(campaignVariables).forEach(k => {
        if (k && k.trim()) {
          varsSet.add(k.trim())
        }
      })
    }

    return Array.from(varsSet).sort()
  }, [projectVariables, campaignVariables])

  // Get all variables for autocomplete (declared + those used in prompt)
  const allVariables = useMemo(() => {
    const allVarsSet = new Set<string>(declaredVariables)

    // Also extract variables from the current prompt to help with autocomplete
    const promptVarRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g
    let match
    while ((match = promptVarRegex.exec(editedStep.prompt)) !== null) {
      allVarsSet.add(match[1])
    }

    return Array.from(allVarsSet).sort()
  }, [declaredVariables, editedStep.prompt])

  // Prompt validation - uses only declared variables, not prompt-extracted ones
  const validation = usePromptValidator({
    prompt: editedStep.prompt,
    declaredVariables: declaredVariables,
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

  // Get undeclared variables from validation
  const undeclaredVariables = useMemo(() => {
    return validation.issues
      .filter(issue => issue.type === 'undeclared_variable' && issue.variable)
      .map(issue => issue.variable as string)
  }, [validation.issues])

  // Handle adding a single variable to the project
  const handleAddVariable = async (varName: string) => {
    if (!onAddProjectVariable) return
    setAddingVariable(varName)
    try {
      await onAddProjectVariable({
        name: varName,
        default_value: '',
        description: '',
      })
    } catch (error) {
      console.error('Error adding variable:', error)
    } finally {
      setAddingVariable(null)
    }
  }

  // Handle adding all undeclared variables to the project
  const handleAddAllVariables = async () => {
    if (!onAddProjectVariable || undeclaredVariables.length === 0) return
    setAddingAllVariables(true)
    try {
      for (const varName of undeclaredVariables) {
        await onAddProjectVariable({
          name: varName,
          default_value: '',
          description: '',
        })
      }
    } catch (error) {
      console.error('Error adding variables:', error)
    } finally {
      setAddingAllVariables(false)
    }
  }

  // Add a required document
  const handleAddRequiredDoc = (name: string) => {
    const newDoc: RequiredDocument = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      required: true,
    }

    // Try to find a match
    const match = findMatchingDocument(name, documents.map(d => ({
      id: d.id,
      filename: d.filename,
      description: d.description || '',
    })))

    if (match) {
      newDoc.matchedDocId = match.doc.id
      newDoc.matchConfidence = match.confidence
      // Also add to base_doc_ids if not already there
      if (!editedStep.base_doc_ids.includes(match.doc.id)) {
        setEditedStep(prev => ({
          ...prev,
          base_doc_ids: [...prev.base_doc_ids, match.doc.id],
        }))
      }
    }

    setEditedStep(prev => ({
      ...prev,
      required_documents: [...(prev.required_documents || []), newDoc],
    }))
  }

  // Process bulk required documents input
  const handleProcessRequiredDocsInput = () => {
    const lines = requiredDocsInput.split('\n').filter(line => line.trim())
    lines.forEach(line => handleAddRequiredDoc(line))
    setRequiredDocsInput('')
    setShowRequiredDocsInput(false)
  }

  // Remove a required document
  const handleRemoveRequiredDoc = (docId: string) => {
    const doc = editedStep.required_documents?.find(d => d.id === docId)
    setEditedStep(prev => ({
      ...prev,
      required_documents: (prev.required_documents || []).filter(d => d.id !== docId),
      // Also remove from base_doc_ids if it was matched
      base_doc_ids: doc?.matchedDocId
        ? prev.base_doc_ids.filter(id => id !== doc.matchedDocId)
        : prev.base_doc_ids,
    }))
  }

  // Toggle required flag
  const handleToggleRequired = (docId: string) => {
    setEditedStep(prev => ({
      ...prev,
      required_documents: (prev.required_documents || []).map(d =>
        d.id === docId ? { ...d, required: !d.required } : d
      ),
    }))
  }

  // Accept a suggested match
  const handleAcceptMatch = (reqDocId: string, matchedDocId: string) => {
    setEditedStep(prev => ({
      ...prev,
      required_documents: (prev.required_documents || []).map(d =>
        d.id === reqDocId ? { ...d, matchedDocId } : d
      ),
      base_doc_ids: prev.base_doc_ids.includes(matchedDocId)
        ? prev.base_doc_ids
        : [...prev.base_doc_ids, matchedDocId],
    }))
  }

  // Reject a suggested match
  const handleRejectMatch = (reqDocId: string) => {
    const doc = editedStep.required_documents?.find(d => d.id === reqDocId)
    setEditedStep(prev => ({
      ...prev,
      required_documents: (prev.required_documents || []).map(d =>
        d.id === reqDocId ? { ...d, matchedDocId: undefined, matchConfidence: undefined } : d
      ),
      // Remove from base_doc_ids if it was there
      base_doc_ids: doc?.matchedDocId
        ? prev.base_doc_ids.filter(id => id !== doc.matchedDocId)
        : prev.base_doc_ids,
    }))
  }

  // State for match feedback
  const [matchFeedback, setMatchFeedback] = useState<{ id: string; message: string; type: 'success' | 'error' } | null>(null)

  // Re-run matching for a required document
  const handleRetryMatch = (reqDocId: string) => {
    const reqDoc = editedStep.required_documents?.find(d => d.id === reqDocId)
    if (!reqDoc) return

    // Clear previous feedback
    setMatchFeedback(null)

    const match = findMatchingDocument(reqDoc.name, documents.map(d => ({
      id: d.id,
      filename: d.filename,
      description: d.description || '',
      tags: d.tags || [],
    })))

    if (match) {
      setEditedStep(prev => ({
        ...prev,
        required_documents: (prev.required_documents || []).map(d =>
          d.id === reqDocId ? {
            ...d,
            matchedDocId: match.doc.id,
            matchConfidence: match.confidence,
          } : d
        ),
      }))
      setMatchFeedback({
        id: reqDocId,
        message: `Encontrado: "${match.doc.filename}" (${Math.round(match.confidence * 100)}% coincidencia)`,
        type: 'success'
      })
    } else {
      setMatchFeedback({
        id: reqDocId,
        message: `No se encontró coincidencia para "${reqDoc.name}". Asigna manualmente desde "Documentos Base".`,
        type: 'error'
      })
    }

    // Clear feedback after 5 seconds
    setTimeout(() => setMatchFeedback(null), 5000)
  }

  // Filter variables for autocomplete
  const filteredVariables = allVariables.filter((v: string) =>
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

  // Filter documents by search query, category and assignment status
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      // Search filter
      if (docSearchQuery) {
        const query = docSearchQuery.toLowerCase()
        const matchesFilename = doc.filename.toLowerCase().includes(query)
        const matchesContent = doc.extracted_content?.toLowerCase().includes(query)
        if (!matchesFilename && !matchesContent) {
          return false
        }
      }
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
  }, [documents, docSearchQuery, categoryFilter, assignmentFilter, editedStep.base_doc_ids])

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

  // Check if Deep Research is selected
  const isDeepResearch = editedStep.model?.startsWith('deep-research')

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

          {/* Required Documents Section */}
          <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText size={18} className="text-amber-500" />
                Documentos Requeridos
                {editedStep.required_documents && editedStep.required_documents.length > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {editedStep.required_documents.length}
                  </span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setShowRequiredDocsInput(!showRequiredDocsInput)}
                className="px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 inline-flex items-center gap-1.5 font-medium transition-colors"
              >
                <Plus size={14} />
                {showRequiredDocsInput ? 'Cancelar' : 'Cargar lista'}
              </button>
            </div>

            {/* Bulk input textarea */}
            {showRequiredDocsInput && (
              <div className="mb-4 p-4 bg-white rounded-xl border border-amber-200">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Pega una lista de documentos requeridos (uno por linea)
                </label>
                <textarea
                  value={requiredDocsInput}
                  onChange={(e) => setRequiredDocsInput(e.target.value)}
                  placeholder="Manual de producto&#10;Guia de marca&#10;Analisis de competencia&#10;..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 resize-none font-mono"
                />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-gray-500">
                    El sistema buscara coincidencias automaticamente
                  </p>
                  <button
                    type="button"
                    onClick={handleProcessRequiredDocsInput}
                    disabled={!requiredDocsInput.trim()}
                    className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 font-medium transition-colors"
                  >
                    <Check size={16} />
                    Procesar lista
                  </button>
                </div>
              </div>
            )}

            {/* Required documents list */}
            {editedStep.required_documents && editedStep.required_documents.length > 0 ? (
              <div className="space-y-3">
                {editedStep.required_documents.map((reqDoc) => {
                  const matchedDoc = reqDoc.matchedDocId
                    ? documents.find(d => d.id === reqDoc.matchedDocId)
                    : null
                  const confidenceInfo = reqDoc.matchConfidence
                    ? getConfidenceLabel(reqDoc.matchConfidence)
                    : null

                  return (
                    <div
                      key={reqDoc.id}
                      className="p-3 bg-white rounded-xl border border-amber-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900">{reqDoc.name}</span>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={reqDoc.required}
                                onChange={() => handleToggleRequired(reqDoc.id)}
                                className="w-3.5 h-3.5 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                              />
                              <span className={`text-xs ${reqDoc.required ? 'text-amber-700 font-medium' : 'text-gray-500'}`}>
                                Obligatorio
                              </span>
                            </label>
                          </div>

                          {matchedDoc ? (
                            <div className="flex items-center gap-2 text-sm">
                              <Check size={14} className="text-green-500" />
                              <span className="text-green-700">
                                Asignado: <span className="font-medium">{matchedDoc.filename}</span>
                              </span>
                              {confidenceInfo && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${confidenceInfo.color}`}>
                                  {Math.round(reqDoc.matchConfidence! * 100)}% match
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <AlertTriangle size={14} className="text-amber-500" />
                                <span>Sin asignar</span>
                                <button
                                  type="button"
                                  onClick={() => handleRetryMatch(reqDoc.id)}
                                  className="text-xs text-amber-600 hover:text-amber-700 hover:underline"
                                >
                                  Buscar coincidencias
                                </button>
                              </div>
                              {matchFeedback?.id === reqDoc.id && (
                                <div className={`text-xs px-2 py-1 rounded ${
                                  matchFeedback.type === 'success'
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                  {matchFeedback.message}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {matchedDoc && (
                            <button
                              type="button"
                              onClick={() => handleRejectMatch(reqDoc.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Desasignar documento"
                            >
                              <X size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveRequiredDoc(reqDoc.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar requerimiento"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6 bg-white rounded-xl border-2 border-dashed border-amber-200">
                <FileText size={24} className="mx-auto mb-2 text-amber-300" />
                <p className="text-sm text-gray-500">
                  No hay documentos requeridos definidos
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Usa "Cargar lista" para agregar documentos que este paso necesita
                </p>
              </div>
            )}

            <p className="text-xs text-amber-600 mt-3">
              Define que documentos necesita este paso. El sistema buscara coincidencias en los documentos del proyecto.
            </p>
          </div>

          {/* Base Documents Section */}
          <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText size={18} className="text-blue-500" />
              Documentos Base
            </h3>

            {/* Search Input */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                placeholder="Buscar documentos por nombre o contenido..."
                className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
              />
              {docSearchQuery && (
                <button
                  type="button"
                  onClick={() => setDocSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

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

              {/* Search results counter */}
              {docSearchQuery && (
                <span className="text-xs text-blue-600 ml-auto">
                  {filteredDocs.length} resultado{filteredDocs.length !== 1 ? 's' : ''}
                </span>
              )}
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
                <Search size={24} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500 italic">
                  No hay documentos que coincidan
                  {docSearchQuery && ` con "${docSearchQuery}"`}
                </p>
                {(docSearchQuery || categoryFilter !== 'all' || assignmentFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setDocSearchQuery('')
                      setCategoryFilter('all')
                      setAssignmentFilter('all')
                    }}
                    className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Limpiar filtros
                  </button>
                )}
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

          {/* LLM Model Configuration */}
          <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Cpu size={18} className="text-emerald-500" />
              Modelo de IA
            </h3>

            <div className="space-y-4">
              {/* Model Selector - Dynamic from OpenRouter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Modelo LLM
                </label>
                <OpenRouterModelSelector
                  value={editedStep.model || 'google/gemini-2.5-flash-preview'}
                  onChange={(modelId) =>
                    setEditedStep((prev) => ({ ...prev, model: modelId as LLMModel }))
                  }
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Modelos cargados desde tu cuenta de OpenRouter. Si el modelo falla, podrás elegir otro.
                </p>
              </div>

              {/* Deep Research Warning */}
              {isDeepResearch && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FlaskConical className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-purple-900 flex items-center gap-2">
                        Deep Research - Modo Especial
                        <span className="flex items-center gap-1 text-xs font-normal bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          5-20 min
                        </span>
                      </h4>
                      <p className="text-sm text-purple-800 mt-1">
                        Este modelo realiza investigacion autonoma con busqueda web.
                      </p>
                      <ul className="text-xs text-purple-700 mt-2 space-y-1">
                        <li>• No soporta control de temperatura</li>
                        <li>• No soporta limite de tokens</li>
                        <li>• El modo RAG no aplica (hace su propia busqueda)</li>
                        <li>• Requiere GEMINI_API_KEY en el servidor</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Temperature and Max Tokens - Hidden for Deep Research */}
              {!isDeepResearch && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Temperature: {editedStep.temperature ?? 0.7}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={editedStep.temperature ?? 0.7}
                      onChange={(e) =>
                        setEditedStep((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Preciso</span>
                      <span>Creativo</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      min="1000"
                      max="32000"
                      step="1000"
                      value={editedStep.max_tokens ?? 8192}
                      onChange={(e) =>
                        setEditedStep((prev) => ({ ...prev, max_tokens: parseInt(e.target.value) || 8192 }))
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Document Retrieval Mode - RAG vs Full - Hidden for Deep Research */}
          {!isDeepResearch && (
          <div className="bg-gradient-to-br from-cyan-50 to-white border border-cyan-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Database size={18} className="text-cyan-500" />
              Modo de Documentos
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Document Mode */}
              <label
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  (editedStep.retrieval_mode || 'full') === 'full'
                    ? 'border-cyan-500 bg-cyan-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="retrieval_mode"
                  value="full"
                  checked={(editedStep.retrieval_mode || 'full') === 'full'}
                  onChange={() => setEditedStep(prev => ({ ...prev, retrieval_mode: 'full' as RetrievalMode }))}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    (editedStep.retrieval_mode || 'full') === 'full' ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <FileText size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">Documento Completo</span>
                      {(editedStep.retrieval_mode || 'full') === 'full' && (
                        <Check size={16} className="text-cyan-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Envia el documento entero al modelo.
                    </p>
                    <ul className="text-xs text-gray-600 mt-2 space-y-1">
                      <li className="flex items-center gap-1">
                        <Check size={12} className="text-green-500" />
                        Analisis holistico y contextual
                      </li>
                      <li className="flex items-center gap-1">
                        <Check size={12} className="text-green-500" />
                        Comparaciones y sintesis completas
                      </li>
                      <li className="flex items-center gap-1">
                        <Check size={12} className="text-green-500" />
                        Mejor para estrategia y vision general
                      </li>
                    </ul>
                    {/* Cost estimate for full mode */}
                    <div className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-100">
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <DollarSign size={14} />
                        <span className="text-xs font-medium">
                          Costo estimado: ${(() => {
                            const model = editedStep.model || 'gemini-2.5-flash'
                            const pricing = MODEL_PRICING[model] || MODEL_PRICING['default']
                            const costPerMillion = pricing.input
                            const estimatedCost = (selectedDocsTokens / 1_000_000) * costPerMillion
                            return estimatedCost.toFixed(3)
                          })()}
                        </span>
                        <span className="text-xs text-amber-600">
                          ({formatTokenCount(selectedDocsTokens)} tokens)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </label>

              {/* RAG Mode */}
              <label
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  editedStep.retrieval_mode === 'rag'
                    ? 'border-cyan-500 bg-cyan-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="retrieval_mode"
                  value="rag"
                  checked={editedStep.retrieval_mode === 'rag'}
                  onChange={() => setEditedStep(prev => ({
                    ...prev,
                    retrieval_mode: 'rag' as RetrievalMode,
                    rag_config: prev.rag_config || { top_k: 10, min_score: 0.7 }
                  }))}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    editedStep.retrieval_mode === 'rag' ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Zap size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">Chunks Relevantes (RAG)</span>
                      {editedStep.retrieval_mode === 'rag' && (
                        <Check size={16} className="text-cyan-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Envia solo las secciones mas relevantes al prompt.
                    </p>
                    <ul className="text-xs text-gray-600 mt-2 space-y-1">
                      <li className="flex items-center gap-1">
                        <Check size={12} className="text-green-500" />
                        Busquedas especificas y puntuales
                      </li>
                      <li className="flex items-center gap-1">
                        <Check size={12} className="text-green-500" />
                        Extraccion de datos concretos
                      </li>
                      <li className="flex items-center gap-1">
                        <Check size={12} className="text-green-500" />
                        90-95% ahorro en costos
                      </li>
                    </ul>
                    {/* Cost estimate for RAG mode */}
                    <div className="mt-3 p-2 bg-green-50 rounded-lg border border-green-100">
                      <div className="flex items-center gap-1.5 text-green-700">
                        <DollarSign size={14} />
                        <span className="text-xs font-medium">
                          Costo estimado: ${(() => {
                            const model = editedStep.model || 'gemini-2.5-flash'
                            const pricing = MODEL_PRICING[model] || MODEL_PRICING['default']
                            const costPerMillion = pricing.input
                            // RAG typically uses ~5-10K tokens
                            const ragTokens = (editedStep.rag_config?.top_k || 10) * 500 // ~500 tokens per chunk
                            const estimatedCost = (ragTokens / 1_000_000) * costPerMillion
                            return estimatedCost.toFixed(4)
                          })()}
                        </span>
                        <span className="text-xs text-green-600">
                          (~{formatTokenCount((editedStep.rag_config?.top_k || 10) * 500)} tokens)
                        </span>
                      </div>
                      {selectedDocsTokens > 0 && (
                        <div className="text-xs text-green-600 mt-1">
                          Ahorro estimado: {Math.round((1 - ((editedStep.rag_config?.top_k || 10) * 500) / selectedDocsTokens) * 100)}% vs documento completo
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </label>
            </div>

            {/* RAG Configuration (only show if RAG is selected) */}
            {editedStep.retrieval_mode === 'rag' && (
              <div className="mt-4 p-4 bg-white rounded-xl border border-cyan-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Configuracion RAG</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Chunks a recuperar (top_k): {editedStep.rag_config?.top_k || 10}
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="30"
                      step="1"
                      value={editedStep.rag_config?.top_k || 10}
                      onChange={(e) =>
                        setEditedStep(prev => ({
                          ...prev,
                          rag_config: {
                            ...(prev.rag_config || { top_k: 10, min_score: 0.7 }),
                            top_k: parseInt(e.target.value)
                          }
                        }))
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>3 (mas rapido)</span>
                      <span>30 (mas contexto)</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Score minimo: {(editedStep.rag_config?.min_score || 0.7).toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="0.95"
                      step="0.05"
                      value={editedStep.rag_config?.min_score || 0.7}
                      onChange={(e) =>
                        setEditedStep(prev => ({
                          ...prev,
                          rag_config: {
                            ...(prev.rag_config || { top_k: 10, min_score: 0.7 }),
                            min_score: parseFloat(e.target.value)
                          }
                        }))
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0.5 (mas resultados)</span>
                      <span>0.95 (solo exactos)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Guidance note */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600">
                <strong>Recomendacion:</strong> Usa <span className="text-cyan-600 font-medium">Documento Completo</span> para analisis estrategicos, comparaciones de mercado, y sintesis de insights. Usa <span className="text-cyan-600 font-medium">RAG</span> para preguntas especificas, extraccion de datos puntuales, o cuando necesites buscar informacion concreta en documentos largos.
              </p>
            </div>
          </div>
          )}

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
                    {filteredVariables.map((varName: string, index: number) => (
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

            {/* Undeclared Variables - Add to Project */}
            {onAddProjectVariable && undeclaredVariables.length > 0 && (
              <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                    <AlertTriangle size={16} />
                    Variables detectadas no declaradas ({undeclaredVariables.length})
                  </p>
                  {undeclaredVariables.length > 1 && (
                    <button
                      onClick={handleAddAllVariables}
                      disabled={addingAllVariables}
                      className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 font-medium transition-colors"
                    >
                      {addingAllVariables ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Agregando...
                        </>
                      ) : (
                        <>
                          <Plus size={12} />
                          Agregar todas al proyecto
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {undeclaredVariables.map((varName) => (
                    <div
                      key={varName}
                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-100"
                    >
                      <code className="text-sm font-mono text-amber-700">
                        {'{{ '}{varName}{' }}'}
                      </code>
                      <button
                        onClick={() => handleAddVariable(varName)}
                        disabled={addingVariable === varName || addingAllVariables}
                        className="px-3 py-1 text-xs bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1 font-medium transition-colors"
                      >
                        {addingVariable === varName ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            Agregando...
                          </>
                        ) : (
                          <>
                            <Plus size={12} />
                            Agregar al proyecto
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mt-3">
                  Agrega estas variables al proyecto para que esten disponibles en todas las campanas.
                </p>
              </div>
            )}

            {/* Available Variables Section - Only show if there are declared variables */}
            {declaredVariables.length > 0 && (
              <div className="mt-4 p-4 bg-white/70 rounded-xl border border-indigo-100">
                <p className="text-sm font-medium text-indigo-800 mb-3 flex items-center gap-2">
                  <Sparkles size={16} />
                  Variables del proyecto ({declaredVariables.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {declaredVariables.map((varName: string) => (
                    <code
                      key={varName}
                      className="text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
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
                      title="Click para insertar en el prompt"
                    >
                      {`{{ ${varName} }}`}
                    </code>
                  ))}
                </div>
                <p className="text-xs text-indigo-600 mt-3">
                  Haz clic en una variable para insertarla en el prompt
                </p>
              </div>
            )}
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
