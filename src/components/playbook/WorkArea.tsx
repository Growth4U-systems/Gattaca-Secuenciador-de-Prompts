'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Play,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  RefreshCw,
  Copy,
  CheckCheck,
  Edit3,
  Square,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { WorkAreaProps, StepDefinition, StepState } from './types'
import DeepResearchManualStep from './steps/DeepResearchManualStep'
import { getDefaultPrompt } from './utils/getDefaultPrompts'
import { B2C_CONTEXTS, B2B_CONTEXTS } from './configs/niche-finder.config'
import { QueryPreviewPanel } from './QueryPreviewPanel'
import { SerpResultsPanel } from './SerpResultsPanel'
import { SearchWithPreviewPanel } from './SearchWithPreviewPanel'
import { ReviewAndScrapePanel } from './ReviewAndScrapePanel'

// Sub-components for different step types

interface SuggestionStepProps {
  step: StepDefinition
  stepState: StepState
  onUpdateState: (update: Partial<StepState>) => void
  onContinue: () => void
  // Context for LLM generation
  playbookContext?: {
    product?: string
    target?: string
    context_type?: string
    life_contexts?: string[]
    [key: string]: unknown
  }
}

function SuggestionStep({ step, stepState, onUpdateState, onContinue, playbookContext }: SuggestionStepProps) {
  const [newItem, setNewItem] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Get suggestions either from output (after generation) or from fixed options
  const suggestions = useMemo(() => {
    // If we have output, use it
    if (stepState.output && Array.isArray(stepState.output)) {
      return stepState.output as Array<{
        id: string
        label: string
        selected: boolean
        category?: string
      }>
    }

    // For fixed options (like life_contexts), load predefined data
    if (step.suggestionConfig?.generateFrom === 'fixed') {
      if (step.suggestionConfig.fixedOptionsKey === 'life_contexts') {
        // Get context_type from campaign variables (custom_variables)
        const contextType = playbookContext?.context_type || 'both'

        let contexts: Array<{ id: string; label: string; category: string; contextType: string }> = []
        if (contextType === 'personal' || contextType === 'both') {
          contexts = [...contexts, ...B2C_CONTEXTS]
        }
        if (contextType === 'business' || contextType === 'both') {
          contexts = [...contexts, ...B2B_CONTEXTS]
        }

        return contexts.map((c) => ({
          id: c.id,
          label: c.label,
          category: c.category,
          selected: false,
        }))
      }
    }

    return []
  }, [stepState.output, step.suggestionConfig, playbookContext])

  // Handle LLM generation
  const generateSuggestions = async () => {
    if (!step.promptKey) return

    setIsGenerating(true)
    try {
      const response = await fetch('/api/playbook/generate-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptKey: step.promptKey,
          context: playbookContext,
        }),
      })

      const data = await response.json()
      if (data.suggestions) {
        onUpdateState({
          output: data.suggestions.map((s: string, i: number) => ({
            id: `gen_${i}`,
            label: s,
            selected: false,
          })),
        })
      }
    } catch (error) {
      console.error('Error generating suggestions:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  // Auto-generate on mount if LLM-based and no output yet
  useEffect(() => {
    if (
      step.suggestionConfig?.generateFrom === 'llm' &&
      !stepState.output &&
      step.executor === 'llm'
    ) {
      generateSuggestions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleItem = (id: string) => {
    const updated = suggestions.map((s) =>
      s.id === id ? { ...s, selected: !s.selected } : s
    )
    onUpdateState({ output: updated })
  }

  const addItem = () => {
    if (!newItem.trim()) return
    const updated = [
      ...suggestions,
      {
        id: `custom_${Date.now()}`,
        label: newItem.trim(),
        selected: true,
      },
    ]
    onUpdateState({ output: updated })
    setNewItem('')
  }

  const startEdit = (item: { id: string; label: string }) => {
    setEditingId(item.id)
    setEditValue(item.label)
  }

  const saveEdit = () => {
    if (!editingId) return
    const updated = suggestions.map((s) =>
      s.id === editingId ? { ...s, label: editValue } : s
    )
    onUpdateState({ output: updated })
    setEditingId(null)
    setEditValue('')
  }

  const selectedCount = suggestions.filter((s) => s.selected).length
  const minSelections = step.suggestionConfig?.minSelections || 1

  // Group by category if available
  const hasCategories = suggestions.some((s) => s.category)
  const groupedSuggestions = hasCategories
    ? suggestions.reduce(
        (acc, s) => {
          const cat = s.category || 'Otros'
          if (!acc[cat]) acc[cat] = []
          acc[cat].push(s)
          return acc
        },
        {} as Record<string, typeof suggestions>
      )
    : { '': suggestions }

  return (
    <div className="space-y-4">
      {/* Header with regenerate button */}
      {step.suggestionConfig?.generateFrom === 'llm' && (
        <div className="flex justify-end">
          <button
            onClick={generateSuggestions}
            disabled={isGenerating}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
            Regenerar sugerencias
          </button>
        </div>
      )}

      {/* Suggestions by category */}
      {isGenerating ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-blue-500" size={24} />
          <span className="ml-2 text-gray-600">Generando sugerencias...</span>
        </div>
      ) : (
        Object.entries(groupedSuggestions).map(([category, items]) => (
          <div key={category} className="space-y-2">
            {category && (
              <h4 className="text-sm font-medium text-gray-700">{category}</h4>
            )}
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <div key={item.id} className="relative group">
                  {editingId === item.id ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                      className="px-3 py-1.5 border border-blue-400 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => toggleItem(item.id)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                        item.selected
                          ? 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                          : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                      }`}
                    >
                      {item.label}
                      {step.suggestionConfig?.allowEdit && (
                        <Edit3
                          size={12}
                          className="inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            startEdit(item)
                          }}
                        />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Add new item */}
      {step.suggestionConfig?.allowAdd && (
        <div className="flex gap-2 mt-4">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Agregar item personalizado..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
          />
          <button
            onClick={addItem}
            disabled={!newItem.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
          </button>
        </div>
      )}

      {/* Continue button */}
      <div className="flex justify-between items-center pt-4 border-t">
        <span className="text-sm text-gray-500">
          {selectedCount} seleccionados {minSelections > 0 && `(mín: ${minSelections})`}
        </span>
        <button
          onClick={() => {
            // Store selected items and continue
            const selected = suggestions.filter((s) => s.selected)
            onUpdateState({
              status: 'completed',
              completedAt: new Date(),
              output: suggestions, // Keep full list with selection state
            })
            onContinue()
          }}
          disabled={selectedCount < minSelections}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Continuar
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// Decision step component
interface DecisionStepProps {
  step: StepDefinition
  stepState: StepState
  onUpdateState: (update: Partial<StepState>) => void
  onContinue: () => void
  previousOutput?: unknown
}

function DecisionStep({ step, stepState, onUpdateState, onContinue, previousOutput }: DecisionStepProps) {
  const [selected, setSelected] = useState<string[]>(
    (stepState.input as string[] | undefined) || []
  )

  // Get options from previous step if configured
  const options = useMemo(() => {
    if (step.decisionConfig?.optionsFrom === 'previous_step' && previousOutput) {
      // If previousOutput is CSV data, parse it
      if (typeof previousOutput === 'string') {
        // Try to extract options from CSV
        const lines = previousOutput.split('\n').filter(l => l.trim())
        if (lines.length > 1) {
          // Skip header, return data rows
          return lines.slice(1).map((line, i) => {
            const cols = line.split(',')
            return {
              id: `opt_${i}`,
              label: cols[0] || line,
              description: cols.slice(1).join(', ')
            }
          })
        }
      }
      // If it's already an array
      if (Array.isArray(previousOutput)) {
        return previousOutput.map((item, i) => ({
          id: `opt_${i}`,
          label: typeof item === 'string' ? item : item.label || item.name || JSON.stringify(item),
          description: typeof item === 'object' ? item.description : undefined
        }))
      }
    }
    return step.decisionConfig?.fixedOptions || []
  }, [step.decisionConfig, previousOutput])

  const toggleOption = (id: string) => {
    if (step.decisionConfig?.multiSelect) {
      setSelected(prev =>
        prev.includes(id)
          ? prev.filter(x => x !== id)
          : [...prev, id]
      )
    } else {
      setSelected([id])
    }
  }

  const minSelections = step.decisionConfig?.minSelections || 1

  return (
    <div className="space-y-4">
      <p className="text-gray-700 font-medium">{step.decisionConfig?.question}</p>

      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => toggleOption(opt.id)}
            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
              selected.includes(opt.id)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                selected.includes(opt.id)
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-300'
              }`}>
                {selected.includes(opt.id) && <Check size={12} className="text-white" />}
              </div>
              <div>
                <span className="font-medium">{opt.label}</span>
                {opt.description && (
                  <p className="text-sm text-gray-500 mt-1">{opt.description}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center pt-4 border-t">
        <span className="text-sm text-gray-500">
          {selected.length} seleccionados {minSelections > 0 && `(mín: ${minSelections})`}
        </span>
        <button
          onClick={() => {
            onUpdateState({
              status: 'completed',
              completedAt: new Date(),
              input: selected,
              output: selected,
            })
            onContinue()
          }}
          disabled={selected.length < minSelections}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Continuar
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// Auto step with review component
interface AutoWithReviewStepProps {
  step: StepDefinition
  stepState: StepState
  onUpdateState: (update: Partial<StepState>) => void
  onExecute: (input?: unknown) => Promise<void>
  onContinue: () => void
  onBack?: () => void
  previousOutput?: unknown
}

function AutoWithReviewStep({
  step,
  stepState,
  onUpdateState,
  onExecute,
  onContinue,
  onBack,
  previousOutput,
}: AutoWithReviewStepProps) {
  const [isExecuting, setIsExecuting] = useState(false)
  const [showOutput, setShowOutput] = useState(true)
  const [copied, setCopied] = useState(false)
  const [editedOutput, setEditedOutput] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const handleExecute = async () => {
    setIsExecuting(true)
    try {
      await onExecute(previousOutput)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleCopy = async () => {
    const textToCopy = typeof stepState.output === 'string'
      ? stepState.output
      : JSON.stringify(stepState.output, null, 2)
    await navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveEdit = () => {
    if (editedOutput !== null) {
      onUpdateState({ output: editedOutput })
    }
    setIsEditing(false)
  }

  // Get the output to display
  const outputToDisplay = editedOutput !== null ? editedOutput : stepState.output

  // If not yet executed
  if (!stepState.output && stepState.status !== 'completed') {
    return (
      <div className="space-y-4">
        {/* Execution explanation if available */}
        {step.executionExplanation && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-blue-800">
              {step.executionExplanation.title || 'Este paso va a:'}
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
              {step.executionExplanation.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            {(step.executionExplanation.estimatedCost || step.executionExplanation.costService) && (
              <p className="text-xs text-blue-600 pt-2 border-t border-blue-200">
                {step.executionExplanation.estimatedCost && (
                  <span>Costo estimado: {step.executionExplanation.estimatedCost}</span>
                )}
                {step.executionExplanation.estimatedCost && step.executionExplanation.costService && ' • '}
                {step.executionExplanation.costService && (
                  <span>Servicio: {step.executionExplanation.costService}</span>
                )}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ← Volver
            </button>
          )}
          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center gap-2"
          >
            {isExecuting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Ejecutando...
              </>
            ) : (
              <>
                <Play size={18} />
                Ejecutar {step.name}
              </>
            )}
          </button>
        </div>

        {/* Progress indicator */}
        {stepState.progress && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{stepState.progress.label || 'Progreso'}</span>
              <span>{stepState.progress.current}/{stepState.progress.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{
                  width: stepState.progress.total > 0
                    ? `${(stepState.progress.current / stepState.progress.total) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // Show output for review
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowOutput(!showOutput)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          {showOutput ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Ver resultado
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Copiar"
          >
            {copied ? <CheckCheck size={16} className="text-green-600" /> : <Copy size={16} />}
          </button>
          <button
            onClick={() => {
              if (isEditing) {
                handleSaveEdit()
              } else {
                setEditedOutput(typeof stepState.output === 'string'
                  ? stepState.output
                  : JSON.stringify(stepState.output, null, 2))
                setIsEditing(true)
              }
            }}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title={isEditing ? "Guardar" : "Editar"}
          >
            {isEditing ? <Check size={16} className="text-green-600" /> : <Edit3 size={16} />}
          </button>
        </div>
      </div>

      {showOutput && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-96 overflow-auto">
          {isEditing ? (
            <textarea
              value={editedOutput || ''}
              onChange={(e) => setEditedOutput(e.target.value)}
              className="w-full h-64 font-mono text-sm bg-white border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          ) : (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
              {typeof outputToDisplay === 'string'
                ? outputToDisplay
                : JSON.stringify(outputToDisplay, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="flex gap-4 pt-2">
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            ← Volver
          </button>
        )}
        <button
          onClick={handleExecute}
          disabled={isExecuting}
          className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
        >
          <RefreshCw size={16} className="inline mr-1" />
          Re-ejecutar
        </button>
        <button
          onClick={() => {
            onUpdateState({
              status: 'completed',
              completedAt: new Date(),
            })
            onContinue()
          }}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          Aprobar y continuar
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// Auto step component (no review needed)
interface AutoStepProps {
  step: StepDefinition
  stepState: StepState
  onUpdateState: (update: Partial<StepState>) => void
  onExecute: (input?: unknown) => Promise<void>
  onBack?: () => void
  previousOutput?: unknown
}

function AutoStep({
  step,
  stepState,
  onExecute,
  onBack,
  previousOutput,
}: AutoStepProps) {
  const [isExecuting, setIsExecuting] = useState(false)

  const handleExecute = async () => {
    setIsExecuting(true)
    try {
      await onExecute(previousOutput)
    } finally {
      setIsExecuting(false)
    }
  }

  // If completed, show success message
  if (stepState.status === 'completed') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
        <Check className="text-green-600" size={20} />
        <div>
          <p className="text-green-800 font-medium">Completado</p>
          {stepState.output && (
            <p className="text-sm text-green-600 mt-1">
              {typeof stepState.output === 'string'
                ? stepState.output.slice(0, 100) + (stepState.output.length > 100 ? '...' : '')
                : 'Resultado guardado'}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Execution explanation if available */}
      {step.executionExplanation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-blue-800">
            {step.executionExplanation.title || 'Este paso va a:'}
          </h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
            {step.executionExplanation.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {(step.executionExplanation.estimatedCost || step.executionExplanation.costService) && (
            <p className="text-xs text-blue-600 pt-2 border-t border-blue-200">
              {step.executionExplanation.estimatedCost && (
                <span>Costo estimado: {step.executionExplanation.estimatedCost}</span>
              )}
              {step.executionExplanation.estimatedCost && step.executionExplanation.costService && ' • '}
              {step.executionExplanation.costService && (
                <span>Servicio: {step.executionExplanation.costService}</span>
              )}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ← Volver
          </button>
        )}
        <button
          onClick={handleExecute}
          disabled={isExecuting || stepState.status === 'in_progress'}
          className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center gap-2"
        >
          {isExecuting || stepState.status === 'in_progress' ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Ejecutando...
            </>
          ) : (
            <>
              <Play size={18} />
              Ejecutar {step.name}
            </>
          )}
        </button>
      </div>

      {/* Progress indicator */}
      {stepState.progress && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{stepState.progress.label || 'Progreso'}</span>
            <span>{stepState.progress.current}/{stepState.progress.total}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{
                width: stepState.progress.total > 0
                  ? `${(stepState.progress.current / stepState.progress.total) * 100}%`
                  : '0%'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Search with Preview Panel component
interface SearchWithPreviewStepProps {
  step: StepDefinition
  stepState: StepState
  onUpdateState: (update: Partial<StepState>) => void
  onExecute: (input?: unknown) => Promise<void>
  onBack?: () => void
  onCancel?: () => void
  previousOutput?: unknown
  playbookContext?: Record<string, unknown>
  projectId?: string
  isExecuting?: boolean
}

function SearchWithPreviewStep({
  step,
  stepState,
  onUpdateState,
  onExecute,
  onBack,
  onCancel,
  playbookContext,
  projectId,
  isExecuting: externalIsExecuting,
}: SearchWithPreviewStepProps) {
  const isExecuting = externalIsExecuting || stepState.status === 'in_progress'

  // Build config from playbook context
  const config = useMemo(() => {
    // Ensure arrays and default sources structure
    return {
      life_contexts: (playbookContext?.life_contexts as string[]) || [],
      product_words: (playbookContext?.need_words as string[]) || [],
      indicators: (playbookContext?.indicators as string[]) || [],
      sources: (playbookContext?.sources as { reddit: boolean; thematic_forums: boolean; general_forums: string[] }) || {
        reddit: true,
        thematic_forums: true,
        general_forums: ['quora.com']
      },
      serp_pages: (playbookContext?.serp_pages as number) || 5,
    }
  }, [playbookContext])

  const handleExecute = async () => {
    onUpdateState({
      status: 'in_progress',
      startedAt: new Date(),
    })
    await onExecute(config)
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
  }

  // Get serpJobId from step output or context for results display
  const serpJobId = (stepState.output as { jobId?: string })?.jobId ||
    (playbookContext?.serpJobId as string)

  // Show completed state with results
  if (stepState.status === 'completed') {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-800">
            <Check size={20} />
            <span className="font-medium">Búsqueda completada</span>
          </div>
          {stepState.output && (
            <p className="text-sm text-green-600 mt-2">
              Se encontraron URLs para analizar
            </p>
          )}
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            ← Ver resultados
          </button>
        )}
      </div>
    )
  }

  // If we have a serpJobId and the step is not error, show SERP results
  // Note: 'completed' status is already handled above
  if (serpJobId && stepState.status !== 'error') {
    return (
      <SerpResultsPanel
        jobId={serpJobId}
        onContinue={() => {
          onUpdateState({
            status: 'completed',
            completedAt: new Date(),
          })
        }}
        onBack={onBack || (() => {})}
      />
    )
  }

  // Show preview panel
  return (
    <SearchWithPreviewPanel
      config={config}
      onExecute={handleExecute}
      onBack={onBack || (() => {})}
      onCancel={handleCancel}
      isExecuting={isExecuting}
      progress={stepState.progress}
    />
  )
}

// Manual review step - shows data for user to review without editing
interface ManualReviewStepProps {
  step: StepDefinition
  stepState: StepState
  onUpdateState: (update: Partial<StepState>) => void
  onContinue: () => void
  onBack?: () => void
  previousOutput?: unknown
}

function ManualReviewStep({
  step,
  stepState,
  onUpdateState,
  onContinue,
  onBack,
  previousOutput,
}: ManualReviewStepProps) {
  const [showOutput, setShowOutput] = useState(true)

  // Use stepState.output if available, otherwise previousOutput
  const dataToReview = stepState.output || previousOutput

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h4 className="font-medium text-amber-800 mb-2">Revisión manual requerida</h4>
        <p className="text-sm text-amber-700">
          {step.description || 'Revisa los datos a continuación antes de continuar.'}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowOutput(!showOutput)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          {showOutput ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Ver datos a revisar
        </button>
      </div>

      {showOutput && dataToReview && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-96 overflow-auto">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
            {typeof dataToReview === 'string'
              ? dataToReview
              : JSON.stringify(dataToReview, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex gap-4 pt-2">
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            ← Volver
          </button>
        )}
        <button
          onClick={() => {
            onUpdateState({
              status: 'completed',
              completedAt: new Date(),
              output: dataToReview, // Pass through the data
            })
            onContinue()
          }}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          Aprobar y continuar
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// Display step - just shows results
interface DisplayStepProps {
  step: StepDefinition
  stepState: StepState
  previousOutput?: unknown
}

function DisplayStep({ stepState, previousOutput }: DisplayStepProps) {
  const dataToDisplay = stepState.output || previousOutput

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        {dataToDisplay ? (
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
            {typeof dataToDisplay === 'string'
              ? dataToDisplay
              : JSON.stringify(dataToDisplay, null, 2)}
          </pre>
        ) : (
          <p className="text-gray-500 italic">No hay datos para mostrar</p>
        )}
      </div>
    </div>
  )
}

// Action step - button to trigger an action
interface ActionStepProps {
  step: StepDefinition
  stepState: StepState
  onUpdateState: (update: Partial<StepState>) => void
  previousOutput?: unknown
}

function ActionStep({ step, stepState, onUpdateState, previousOutput }: ActionStepProps) {
  const [isExecuting, setIsExecuting] = useState(false)

  const handleAction = async () => {
    setIsExecuting(true)
    try {
      // Handle different action types
      if (step.actionConfig?.actionType === 'export') {
        // Export functionality
        const dataToExport = previousOutput || stepState.output
        if (dataToExport) {
          const blob = new Blob(
            [typeof dataToExport === 'string' ? dataToExport : JSON.stringify(dataToExport, null, 2)],
            { type: 'text/plain' }
          )
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `export_${Date.now()}.txt`
          a.click()
          URL.revokeObjectURL(url)
        }
      }

      onUpdateState({
        status: 'completed',
        completedAt: new Date(),
      })
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleAction}
        disabled={isExecuting || stepState.status === 'completed'}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
      >
        {isExecuting ? (
          <>
            <Loader2 className="animate-spin" size={18} />
            Procesando...
          </>
        ) : stepState.status === 'completed' ? (
          <>
            <Check size={18} />
            Completado
          </>
        ) : (
          <>
            <Play size={18} />
            {step.actionConfig?.label || 'Ejecutar'}
          </>
        )}
      </button>
    </div>
  )
}

// Main WorkArea component
export function WorkArea({
  step,
  stepState,
  onUpdateState,
  onExecute,
  onContinue,
  onBack,
  onCancel,
  onRerunPrevious,
  isFirst,
  isLast,
  previousStepOutput,
  playbookContext,
  projectId,
}: WorkAreaProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const prevStepIdRef = useRef<string | null>(null)

  // Auto-expand when step changes
  useEffect(() => {
    if (prevStepIdRef.current !== step.id) {
      setIsExpanded(true)
      prevStepIdRef.current = step.id
    }
  }, [step.id])

  // Render different content based on step type and status
  const renderStepContent = () => {
    // Check for error state
    if (stepState.status === 'error') {
      // Check if error is about missing API key
      const isApiKeyError = stepState.error?.toLowerCase().includes('api key') ||
                           stepState.error?.toLowerCase().includes('no configurada')

      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle size={20} />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-sm text-red-700">{stepState.error || 'Ha ocurrido un error'}</p>
          <div className="flex gap-2 flex-wrap">
            {onBack && (
              <button
                onClick={onBack}
                className="px-3 py-1.5 border border-red-300 rounded text-red-700 text-sm hover:bg-red-100"
              >
                ← Volver
              </button>
            )}
            {isApiKeyError && (
              <button
                onClick={() => {
                  // Navigate to setup tab with API keys section
                  const currentUrl = new URL(window.location.href)
                  currentUrl.searchParams.set('tab', 'setup')
                  window.location.href = currentUrl.toString()
                }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
              >
                Configurar API Key
              </button>
            )}
            <button
              onClick={() => {
                onUpdateState({ status: 'pending', error: undefined })
              }}
              className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      )
    }

    // DeepResearchManualStep for manual_research type
    if (step.type === 'manual_research') {
      return (
        <DeepResearchManualStep
          step={step}
          stepState={stepState}
          onUpdateState={onUpdateState}
          onContinue={onContinue}
          previousStepOutput={typeof previousStepOutput === 'string' ? previousStepOutput : undefined}
          projectId={projectId || ''}
        />
      )
    }

    // search_with_preview: Preview queries, then execute SERP, then show results
    if (step.type === 'search_with_preview') {
      const isExecuting = stepState.status === 'in_progress'
      return (
        <SearchWithPreviewStep
          step={step}
          stepState={stepState}
          onUpdateState={onUpdateState}
          onExecute={onExecute}
          onBack={onBack}
          onCancel={onCancel}
          previousOutput={previousStepOutput}
          playbookContext={playbookContext}
          projectId={projectId}
          isExecuting={isExecuting}
        />
      )
    }

    // review_with_action: Shows URLs for review, then executes scraping
    if (step.type === 'review_with_action' && stepState.status !== 'completed') {
      const isExecuting = stepState.status === 'in_progress'
      // Try to get jobId from context, or from previous step output, or from project's latest job
      const jobId = playbookContext?.serpJobId as string ||
                    (playbookContext?.search_and_preview_output as { jobId?: string })?.jobId ||
                    playbookContext?.latestJobId as string

      // Show panel if we have jobId, projectId (to fetch job), or if executing
      if (jobId || projectId || isExecuting) {
        return (
          <ReviewAndScrapePanel
            jobId={jobId}
            projectId={projectId} // Pass projectId as fallback for fetching latest job
            onExecute={async (selectedSources) => {
              console.log('[WorkArea] ReviewAndScrapePanel onExecute called')
              console.log('[WorkArea] Selected sources:', selectedSources)
              console.log('[WorkArea] jobId:', jobId)
              console.log('[WorkArea] projectId:', projectId)

              // Update state to show progress
              onUpdateState({
                status: 'in_progress',
                startedAt: new Date(),
                input: { selectedSources, jobId },
              })

              console.log('[WorkArea] State updated, calling parent onExecute...')
              try {
                await onExecute({ selectedSources, jobId })
                console.log('[WorkArea] Parent onExecute completed successfully')
              } catch (error) {
                console.error('[WorkArea] Parent onExecute failed:', error)
                throw error
              }
            }}
            onBack={onBack || (() => {})}
            isExecuting={isExecuting}
            progress={stepState.progress ? {
              ...stepState.progress,
              successCount: stepState.partialResults?.successCount,
              failedCount: stepState.partialResults?.failedCount,
            } : undefined}
          />
        )
      }
    }

    // LEGACY: Keep old step IDs working for backwards compatibility
    // Preview Queries Panel - shows before SERP execution (legacy)
    if (step.id === 'preview_queries' && stepState.status !== 'completed') {
      // Build config from previous steps (available in playbookContext)
      // Ensure arrays and default sources structure
      const config = {
        life_contexts: (playbookContext?.life_contexts as string[]) || [],
        product_words: (playbookContext?.need_words as string[]) || [],
        indicators: (playbookContext?.indicators as string[]) || [],
        sources: (playbookContext?.sources as { reddit: boolean; thematic_forums: boolean; general_forums: string[] }) || {
          reddit: true,
          thematic_forums: true,
          general_forums: ['quora.com']
        },
        serp_pages: (playbookContext?.serp_pages as number) || 5,
      }

      return (
        <QueryPreviewPanel
          config={config}
          onApprove={async () => {
            onUpdateState({
              status: 'in_progress',
              startedAt: new Date(),
            })
            await onExecute(config)
          }}
          onAdjust={onBack || (() => {})}
        />
      )
    }

    // SERP Results Panel - shows after SERP execution (legacy)
    if (step.id === 'serp_results' && stepState.status !== 'completed') {
      // Get serpJobId from playbookContext (set by serp_search step)
      const serpJobId = playbookContext?.serpJobId as string

      if (!serpJobId) {
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-800">
              No se encontró el ID del job de búsqueda. Por favor ejecuta el paso de búsqueda primero.
            </p>
            {onBack && (
              <button
                onClick={onBack}
                className="mt-3 px-4 py-2 border border-amber-300 rounded-lg text-amber-700 hover:bg-amber-100"
              >
                ← Volver al paso anterior
              </button>
            )}
          </div>
        )
      }

      return (
        <SerpResultsPanel
          jobId={serpJobId}
          onContinue={() => {
            onUpdateState({
              status: 'completed',
              completedAt: new Date(),
              output: { serpJobId },
            })
            onContinue()
          }}
          onBack={onBack || (() => {})}
        />
      )
    }

    // Review URLs Panel (legacy - for old campaigns)
    if (step.id === 'review_urls' && stepState.status !== 'completed') {
      // Get serpJobId from playbookContext
      const serpJobId = playbookContext?.serpJobId as string

      if (!serpJobId) {
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-800">
              No se encontró el ID del job de búsqueda. Por favor ejecuta el paso de búsqueda primero.
            </p>
            {onBack && (
              <button
                onClick={onBack}
                className="mt-3 px-4 py-2 border border-amber-300 rounded-lg text-amber-700 hover:bg-amber-100"
              >
                ← Volver al paso anterior
              </button>
            )}
          </div>
        )
      }

      const isExecuting = stepState.status === 'in_progress'

      return (
        <ReviewAndScrapePanel
          jobId={serpJobId}
          projectId={projectId}
          onExecute={async (selectedUrls) => {
            onUpdateState({
              status: 'in_progress',
              startedAt: new Date(),
              input: { selectedUrls },
            })
            await onExecute({ selectedUrls })
          }}
          onBack={onBack || (() => {})}
          isExecuting={isExecuting}
          progress={stepState.progress ? {
            ...stepState.progress,
            successCount: stepState.partialResults?.successCount,
            failedCount: stepState.partialResults?.failedCount,
          } : undefined}
        />
      )
    }

    // Render based on step type
    switch (step.type) {
      case 'suggestion':
        return (
          <SuggestionStep
            step={step}
            stepState={stepState}
            onUpdateState={onUpdateState}
            onContinue={onContinue}
            playbookContext={playbookContext}
          />
        )

      case 'decision':
        return (
          <DecisionStep
            step={step}
            stepState={stepState}
            onUpdateState={onUpdateState}
            onContinue={onContinue}
            previousOutput={previousStepOutput}
          />
        )

      case 'auto_with_preview':
      case 'auto_with_review':
        return (
          <AutoWithReviewStep
            step={step}
            stepState={stepState}
            onUpdateState={onUpdateState}
            onExecute={onExecute}
            onContinue={onContinue}
            onBack={onBack}
            previousOutput={previousStepOutput}
          />
        )

      case 'auto':
        return (
          <AutoStep
            step={step}
            stepState={stepState}
            onUpdateState={onUpdateState}
            onExecute={onExecute}
            onBack={onBack}
            previousOutput={previousStepOutput}
          />
        )

      case 'manual_review':
        return (
          <ManualReviewStep
            step={step}
            stepState={stepState}
            onUpdateState={onUpdateState}
            onContinue={onContinue}
            onBack={onBack}
            previousOutput={previousStepOutput}
          />
        )

      case 'display':
        return (
          <DisplayStep
            step={step}
            stepState={stepState}
            previousOutput={previousStepOutput}
          />
        )

      case 'action':
        return (
          <ActionStep
            step={step}
            stepState={stepState}
            onUpdateState={onUpdateState}
            previousOutput={previousStepOutput}
          />
        )

      default:
        // Generic fallback for unknown types
        return (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-600">
              Tipo de paso no reconocido: {step.type}
            </p>
          </div>
        )
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Step header */}
      <div
        className="px-6 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="text-gray-400" size={20} />
            ) : (
              <ChevronRight className="text-gray-400" size={20} />
            )}
            <div>
              <h3 className="font-semibold text-gray-900">{step.name}</h3>
              {step.description && (
                <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>
              )}
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            {stepState.status === 'completed' && (
              <span className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <Check size={14} />
                Completado
              </span>
            )}
            {stepState.status === 'in_progress' && (
              <span className="flex items-center gap-1 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                <Loader2 size={14} className="animate-spin" />
                En progreso
              </span>
            )}
            {stepState.status === 'error' && (
              <span className="flex items-center gap-1 text-sm text-red-600 bg-red-50 px-2 py-1 rounded-full">
                <AlertCircle size={14} />
                Error
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Step content */}
      {isExpanded && (
        <div className="px-6 py-5">
          {renderStepContent()}
        </div>
      )}

      {/* Navigation footer for completed steps */}
      {isExpanded && stepState.status === 'completed' && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="flex gap-2">
            {!isFirst && onBack && (
              <button
                onClick={onBack}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
              >
                ← Anterior
              </button>
            )}
            {onRerunPrevious && !isFirst && (
              <button
                onClick={onRerunPrevious}
                className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <RefreshCw size={14} />
                Re-ejecutar anterior
              </button>
            )}
          </div>

          {!isLast ? (
            <button
              onClick={onContinue}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
            >
              Siguiente
              <ChevronRight size={16} />
            </button>
          ) : (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <Check size={16} />
              Playbook completado
            </span>
          )}
        </div>
      )}
    </div>
  )
}
