'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Play,
  Loader2,
  Check,
  CheckCircle,
  AlertCircle,
  Plus,
  RefreshCw,
  Copy,
  CheckCheck,
  Edit3,
  Square,
  Eye,
  EyeOff,
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
import { ScrapeResultsPanel } from './ScrapeResultsPanel'
import { UnifiedSearchExtractPanel } from './UnifiedSearchExtractPanel'
import KeywordConfigPanel from './KeywordConfigPanel'
import ApiKeySetupModal from '../settings/ApiKeySetupModal'
import CSVTableViewer from '../documents/CSVTableViewer'
import { StepInspectionPanel, StepInfo } from './StepInspectionPanel'
import SavedIndicator from './SavedIndicator'

// Helper to detect if a string is CSV content (comma or semicolon separated)
function isCSVContent(content: string | null | undefined): boolean {
  if (!content || typeof content !== 'string') return false
  const lines = content.trim().split('\n')
  if (lines.length < 1) return false
  // Check if first line looks like CSV headers (has commas or semicolons)
  const firstLine = lines[0]
  const hasDelimiter = firstLine.includes(',') || firstLine.includes(';')
  // NOT a Markdown table (those start with |)
  const isMarkdownTable = firstLine.trim().startsWith('|')
  return hasDelimiter && !firstLine.startsWith('{') && !firstLine.startsWith('[') && !isMarkdownTable
}

// Helper to detect if content is a Markdown table
function isMarkdownTable(content: string | null | undefined): boolean {
  if (!content || typeof content !== 'string') return false
  const lines = content.trim().split('\n')
  if (lines.length < 2) return false
  // Markdown tables have | characters and a separator line with dashes
  const firstLine = lines[0].trim()
  const secondLine = lines[1]?.trim() || ''
  return firstLine.startsWith('|') && secondLine.includes('|') && secondLine.includes('-')
}

// Helper to count rows in a Markdown table
function countMarkdownTableRows(content: string): number {
  const lines = content.trim().split('\n').filter(l => l.trim().startsWith('|'))
  // Subtract 2 for header and separator
  return Math.max(0, lines.length - 2)
}

// Sources display component for the "Fuentes de Datos" step
interface SourcesData {
  reddit?: {
    enabled: boolean
    subreddits?: string[]
  }
  thematic_forums?: {
    enabled: boolean
    forums?: string[]
  }
  general_forums?: {
    enabled: boolean
    forums?: string[]
  }
}

function SourcesDisplay({ data }: { data: SourcesData }) {
  const parseData = (raw: unknown): SourcesData => {
    if (typeof raw === 'string') {
      try {
        // Remove markdown code block if present
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        return JSON.parse(cleaned)
      } catch {
        return {}
      }
    }
    return (raw as SourcesData) || {}
  }

  const sources = parseData(data)

  return (
    <div className="space-y-4">
      {/* Reddit */}
      {sources.reddit?.enabled && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔶</span>
            <h4 className="font-medium text-orange-800">Reddit</h4>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              {sources.reddit.subreddits?.length || 0} subreddits
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sources.reddit.subreddits?.map((sub, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-white border border-orange-200 rounded-full text-sm text-orange-700"
              >
                r/{sub}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Thematic Forums */}
      {sources.thematic_forums?.enabled && sources.thematic_forums.forums && sources.thematic_forums.forums.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💬</span>
            <h4 className="font-medium text-purple-800">Foros Temáticos</h4>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              {sources.thematic_forums.forums.length} foros
            </span>
          </div>
          <div className="space-y-2">
            {sources.thematic_forums.forums.map((forum, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm"
              >
                <span className="text-purple-400">🔗</span>
                <a
                  href={forum}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-700 hover:text-purple-900 hover:underline truncate"
                >
                  {forum.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* General Forums */}
      {sources.general_forums?.enabled && sources.general_forums.forums && sources.general_forums.forums.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🌐</span>
            <h4 className="font-medium text-blue-800">Foros Generales</h4>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {sources.general_forums.forums.length} foros
            </span>
          </div>
          <div className="space-y-2">
            {sources.general_forums.forums.map((forum, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm"
              >
                <span className="text-blue-400">🔗</span>
                <a
                  href={forum}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:text-blue-900 hover:underline truncate"
                >
                  {forum.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-gray-500 pt-2 border-t border-gray-200">
        Total: {' '}
        {(sources.reddit?.subreddits?.length || 0) +
         (sources.thematic_forums?.forums?.length || 0) +
         (sources.general_forums?.forums?.length || 0)} fuentes configuradas
      </div>
    </div>
  )
}

// Helper to check if output looks like sources config
function isSourcesOutput(output: unknown): boolean {
  if (!output) return false
  const str = typeof output === 'string' ? output : ''
  // Check for JSON with reddit/forums keys
  return str.includes('"reddit"') || str.includes('"thematic_forums"') ||
         (typeof output === 'object' && ('reddit' in (output as Record<string, unknown>) || 'thematic_forums' in (output as Record<string, unknown>)))
}

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

  // Check if this is a review-only step (executor: none with previousOutput)
  const isReviewOnlyStep = step.executor === 'none' && previousOutput && !stepState.output

  // Get the output to display - prefer stepState.output, fall back to previousOutput for review steps
  const dataToDisplay = stepState.output || (isReviewOnlyStep ? previousOutput : null)
  const outputToDisplay = editedOutput !== null ? editedOutput : dataToDisplay

  // If not yet executed and not a review-only step
  if (!stepState.output && stepState.status !== 'completed' && !isReviewOnlyStep) {
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
        <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden" style={{ maxHeight: '500px' }}>
          {/* Metadata header with timestamp and row count */}
          {outputToDisplay && typeof outputToDisplay === 'string' && isMarkdownTable(outputToDisplay) && (
            <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between text-xs text-gray-500">
              <span>
                {countMarkdownTableRows(outputToDisplay)} filas en la tabla
              </span>
              {stepState.completedAt && (
                <span>
                  Generado: {new Date(stepState.completedAt).toLocaleString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              )}
            </div>
          )}
          <div className="p-4 overflow-auto" style={{ maxHeight: '450px' }}>
            {/* Empty or null state */}
            {(!outputToDisplay || outputToDisplay === 'null' || (typeof outputToDisplay === 'string' && outputToDisplay.trim() === '')) ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No hay datos para mostrar.</p>
                <p className="text-sm mt-1">Ejecuta el paso anterior para generar resultados.</p>
              </div>
            ) : isEditing ? (
              <textarea
                value={editedOutput || ''}
                onChange={(e) => setEditedOutput(e.target.value)}
                className="w-full h-64 font-mono text-sm bg-white border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            ) : typeof outputToDisplay === 'string' && isMarkdownTable(outputToDisplay) ? (
              /* Render Markdown table */
              <div className="prose prose-sm max-w-none overflow-x-auto">
                <ReactMarkdown
                  components={{
                    table: ({ children }) => (
                      <table className="min-w-full border-collapse text-sm">{children}</table>
                    ),
                    th: ({ children }) => (
                      <th className="border border-gray-300 bg-gray-100 px-3 py-2 text-left font-medium text-gray-700">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-gray-300 px-3 py-2 text-gray-600">{children}</td>
                    ),
                  }}
                >
                  {outputToDisplay}
                </ReactMarkdown>
              </div>
            ) : typeof outputToDisplay === 'string' && isCSVContent(outputToDisplay) ? (
              /* Render CSV as interactive table */
              <div className="h-[400px]">
                <CSVTableViewer
                  content={outputToDisplay}
                  filename={`${step.name || 'output'}.csv`}
                />
              </div>
            ) : isSourcesOutput(outputToDisplay) ? (
              /* Render sources config as visual cards */
              <SourcesDisplay data={outputToDisplay as SourcesData} />
            ) : (
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono overflow-auto max-h-[400px]">
                {typeof outputToDisplay === 'string'
                  ? outputToDisplay
                  : JSON.stringify(outputToDisplay, null, 2)}
              </pre>
            )}
          </div>
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

  // If completed, show success message with useful context
  if (stepState.status === 'completed') {
    // Check if output is a CSV/table (common for extraction steps)
    const output = stepState.output
    const isTableOutput = typeof output === 'string' && (
      output.includes('|') || // Markdown table
      output.includes(',') && output.includes('\n') // CSV
    )

    // Count rows if it's table data
    let rowCount = 0
    if (isTableOutput && typeof output === 'string') {
      const lines = output.split('\n').filter(line => line.trim())
      // Subtract header row(s)
      rowCount = Math.max(0, lines.length - 2) // Header + separator
    }

    return (
      <div className="space-y-4">
        {/* Success message */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-green-800 font-medium">Paso completado</p>
              {isTableOutput && rowCount > 0 && (
                <p className="text-sm text-green-600 mt-1">
                  Se extrajeron {rowCount} registros
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Show preview of output if it's substantial */}
        {output && typeof output === 'string' && output.length > 50 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Vista previa del resultado</span>
              <span className="text-xs text-gray-500">
                {output.length.toLocaleString()} caracteres
              </span>
            </div>
            <div className="p-4 max-h-48 overflow-auto bg-white">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                {output.slice(0, 1000)}{output.length > 1000 ? '\n...(truncado)' : ''}
              </pre>
            </div>
          </div>
        )}

        {/* Next step hint */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Siguiente:</strong> Haz clic en "Siguiente" para continuar al próximo paso del análisis.
          </p>
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

// SERP Results Summary - Simple view after search completes
// Shows count and allows continuing to next step (where actual scraping happens)
interface SerpResultsSummaryProps {
  jobId: string
  onContinue: () => void
  onBack: () => void
}

function SerpResultsSummary({ jobId, onContinue, onBack }: SerpResultsSummaryProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ totalUrls: number; sourceCount: number } | null>(null)

  useEffect(() => {
    async function loadSummary() {
      try {
        setLoading(true)
        const response = await fetch(`/api/niche-finder/jobs/${jobId}/urls/summary`)
        if (!response.ok) {
          throw new Error('Error cargando resumen')
        }
        const data = await response.json()
        const totalUrls = (data.sources || []).reduce(
          (sum: number, s: { count: number }) => sum + s.count,
          0
        )
        setSummary({
          totalUrls,
          sourceCount: data.sources?.length || 0,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }
    loadSummary()
  }, [jobId])

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-8">
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
        <span className="text-gray-600">Cargando resultados...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={onBack}
          className="mt-3 px-4 py-2 border border-red-300 rounded-lg text-red-700 hover:bg-red-100"
        >
          ← Volver
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Success message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-800">Conversaciones encontradas</h3>
            <p className="text-sm text-green-600">
              Listas para descargar contenido
            </p>
          </div>
        </div>

        {/* Stats */}
        {summary && (
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-green-200">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-700">
                {summary.totalUrls.toLocaleString()}
              </p>
              <p className="text-sm text-green-600">Conversaciones</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-700">
                {summary.sourceCount}
              </p>
              <p className="text-sm text-green-600">Fuentes</p>
            </div>
          </div>
        )}
      </div>

      {/* Info about next step */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Siguiente:</strong> Descargar el contenido de las conversaciones para analizar problemas reales.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ← Volver
        </button>
        <button
          onClick={onContinue}
          className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          Descargar Contenido
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

// Search with Preview Panel component
interface SearchWithPreviewStepProps {
  step: StepDefinition
  stepState: StepState
  onUpdateState: (update: Partial<StepState>) => void
  onExecute: (input?: unknown) => Promise<void>
  onContinue: () => void
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
  onContinue,
  onBack,
  onCancel,
  playbookContext,
  isExecuting: externalIsExecuting,
}: SearchWithPreviewStepProps) {
  const isExecuting = externalIsExecuting || stepState.status === 'in_progress'
  const hasAutoExecuted = useRef(false)

  // Build config from playbook context
  const config = useMemo(() => {
    // Debug: Log what we're receiving from playbookContext
    console.log('[SearchWithPreviewStep] Building config from playbookContext:', {
      life_contexts: playbookContext?.life_contexts,
      need_words: playbookContext?.need_words,
      indicators: playbookContext?.indicators,
      sources: playbookContext?.sources,
      all_keys: playbookContext ? Object.keys(playbookContext) : [],
    })

    // Ensure arrays and default sources structure
    const result = {
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

    console.log('[SearchWithPreviewStep] Built config:', result)
    return result
  }, [playbookContext])

  const handleExecute = useCallback(async () => {
    onUpdateState({
      status: 'in_progress',
      startedAt: new Date(),
    })
    await onExecute(config)
  }, [config, onExecute, onUpdateState])

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
  }

  // Auto-execute when step is pending and we have valid config
  const hasValidConfig = config.life_contexts.length > 0 && config.product_words.length > 0
  useEffect(() => {
    if (stepState.status === 'pending' && hasValidConfig && !hasAutoExecuted.current) {
      hasAutoExecuted.current = true
      console.log('[SearchWithPreviewStep] Auto-executing with config:', config)
      handleExecute()
    }
  }, [stepState.status, hasValidConfig, handleExecute, config])

  // Get serpJobId from step output or context for results display
  const serpJobId = (stepState.output as { jobId?: string })?.jobId ||
    (playbookContext?.serpJobId as string)

  // Handle retry - reset step and re-execute (must be defined before any early returns)
  const handleRetry = useCallback(() => {
    console.log('[SearchWithPreviewStep] Retry requested, resetting step and re-executing...')
    // Reset the autoExecuted flag so useEffect can trigger again
    hasAutoExecuted.current = false
    // Reset step state to pending (this clears the old jobId)
    onUpdateState({
      status: 'pending',
      output: undefined,
      error: undefined,
      progress: undefined,
    })
    // The useEffect will pick this up and auto-execute with the new config
  }, [onUpdateState])

  // Show progress during execution with real-time URL count
  if (isExecuting) {
    const progress = stepState.progress
    const urlsFound = progress?.current || 0
    const totalSearches = progress?.total || 0
    const percentComplete = totalSearches > 0 ? Math.round((urlsFound / totalSearches) * 100) : 0

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <div>
              <h3 className="font-semibold text-blue-800">Buscando conversaciones...</h3>
              <p className="text-sm text-blue-600">{progress?.label || 'Ejecutando búsquedas en SERP'}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-blue-700 mb-1">
              <span>{urlsFound} URLs encontradas</span>
              <span>{percentComplete}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-blue-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-700">{urlsFound}</p>
              <p className="text-xs text-blue-600">URLs encontradas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-700">{totalSearches}</p>
              <p className="text-xs text-blue-600">Búsquedas totales</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-700">{config.life_contexts.length}</p>
              <p className="text-xs text-blue-600">Contextos</p>
            </div>
          </div>
        </div>

        {/* Cancel button */}
        <div className="flex justify-center">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar búsqueda
          </button>
        </div>
      </div>
    )
  }

  // If we have a serpJobId and step is completed, show completion summary
  // Don't show ReviewAndScrapePanel here - that's for the next step (review_and_scrape)
  if (serpJobId && stepState.status === 'completed') {
    const output = stepState.output as { jobId?: string; urlsFound?: number; costs?: { serp?: number } }
    const urlsFound = output?.urlsFound || 0
    const serpCost = output?.costs?.serp || 0

    return (
      <div className="space-y-6">
        {/* Success header */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-800">Búsqueda Completada</h3>
              <p className="text-sm text-green-600">Se encontraron {urlsFound} URLs para analizar</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-green-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700">{urlsFound}</p>
              <p className="text-xs text-green-600">URLs encontradas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700">${serpCost.toFixed(2)}</p>
              <p className="text-xs text-green-600">Costo SERP</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700">{config.life_contexts.length}</p>
              <p className="text-xs text-green-600">Contextos</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onBack || (() => {})}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            ← Volver
          </button>
          <button
            onClick={handleRetry}
            className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Re-buscar
          </button>
          <button
            onClick={onContinue}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            Continuar a Descargar Contenido →
          </button>
        </div>
      </div>
    )
  }

  // If we have a serpJobId but step is not completed (in progress or pending), show polling state
  // This happens when returning to the step while job is running
  if (serpJobId && stepState.status !== 'error' && stepState.status !== 'completed') {
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <div>
              <h3 className="font-semibold text-blue-800">Búsqueda en progreso...</h3>
              <p className="text-sm text-blue-600">{stepState.progress?.label || 'Ejecutando búsquedas SERP'}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // If config is empty (missing from previous step), show error message instead of empty form
  if (!hasValidConfig) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-800 mb-2">
            <AlertCircle size={20} />
            <span className="font-medium">Configuración no encontrada</span>
          </div>
          <p className="text-sm text-amber-700 mb-3">
            No se encontraron los contextos y palabras de necesidad del paso anterior.
            Por favor vuelve al paso de configuración para definirlos.
          </p>
          <div className="text-xs text-amber-600 bg-amber-100 rounded p-2 font-mono">
            Debug: life_contexts={config.life_contexts.length}, product_words={config.product_words.length}
          </div>
        </div>
        <button
          onClick={onBack || (() => {})}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
        >
          ← Volver a Configuración
        </button>
      </div>
    )
  }

  // Show preview panel only if we don't have valid config to auto-execute
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
  onRetry,
  isFirst,
  isLast,
  previousStepOutput,
  playbookContext,
  projectId,
  allSteps,
  saveState,
}: WorkAreaProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showInspection, setShowInspection] = useState(false)
  const prevStepIdRef = useRef<string | null>(null)

  // API key verification state
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [missingApiKeys, setMissingApiKeys] = useState<string[]>([])
  const [apiKeysChecked, setApiKeysChecked] = useState(false)

  // Generation loading states
  const [isGeneratingNeedWords, setIsGeneratingNeedWords] = useState(false)
  const [isGeneratingSubreddits, setIsGeneratingSubreddits] = useState(false)
  const [isGeneratingForums, setIsGeneratingForums] = useState(false)

  // Check required API keys when step changes
  useEffect(() => {
    const checkApiKeys = async () => {
      if (!step.requiredApiKeys || step.requiredApiKeys.length === 0) {
        setApiKeysChecked(true)
        setMissingApiKeys([])
        return
      }

      try {
        const services = step.requiredApiKeys.join(',')
        const response = await fetch(`/api/user/api-keys/check?services=${services}`)
        const data = await response.json()

        if (data.missing && data.missing.length > 0) {
          setMissingApiKeys(data.missing)
          setShowApiKeyModal(true)
        } else {
          setMissingApiKeys([])
        }
        setApiKeysChecked(true)
      } catch (error) {
        console.error('Error checking API keys:', error)
        setApiKeysChecked(true)
      }
    }

    // Reset state when step changes
    if (prevStepIdRef.current !== step.id) {
      setApiKeysChecked(false)
      setMissingApiKeys([])
      setShowApiKeyModal(false)
      checkApiKeys()
    }
  }, [step.id, step.requiredApiKeys])

  // Auto-expand when step changes
  useEffect(() => {
    if (prevStepIdRef.current !== step.id) {
      setIsExpanded(true)
      prevStepIdRef.current = step.id
    }
  }, [step.id])

  // Auto-show inspection panel when there's an error
  useEffect(() => {
    if (stepState.status === 'error') {
      setShowInspection(true)
    }
  }, [stepState.status])

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
          onContinue={onContinue}
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
              lastUrl: stepState.partialResults?.lastUrl,
              lastSnippet: stepState.partialResults?.lastSnippet,
            } : undefined}
          />
        )
      }
    }

    // review_with_action: Show completed state when scraping is done
    if (step.type === 'review_with_action' && stepState.status === 'completed') {
      const output = stepState.output as { jobId?: string; scrapedCount?: number; failedCount?: number } | undefined
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-800">
            <Check size={20} />
            <span className="font-medium">Scraping completado</span>
          </div>
          {output && (
            <div className="text-sm text-green-700">
              <p>{output.scrapedCount ?? 0} URLs scrapeadas exitosamente</p>
              {(output.failedCount ?? 0) > 0 && (
                <p className="text-amber-700">{output.failedCount} URLs fallidas</p>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onContinue}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Continuar →
            </button>
          </div>
        </div>
      )
    }

    // display_scrape_results: Shows scraped content for review before extraction
    if (step.type === 'display_scrape_results') {
      // Debug log for troubleshooting jobId resolution
      console.log('[SCRAPE_RESULTS] playbookContext:', {
        serpJobId: playbookContext?.serpJobId,
        review_and_scrape_output: playbookContext?.review_and_scrape_output,
        search_and_preview_output: playbookContext?.search_and_preview_output,
        allKeys: playbookContext ? Object.keys(playbookContext) : [],
      })

      // Get jobId from context - check multiple sources for robustness
      const jobId = playbookContext?.serpJobId as string ||
                    (playbookContext?.review_and_scrape_output as { jobId?: string })?.jobId ||
                    (playbookContext?.search_and_preview_output as { jobId?: string })?.jobId

      if (!jobId) {
        console.error('[SCRAPE_RESULTS] No jobId found. Full context:', playbookContext)
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-800 font-medium">
              No se encontró el ID del job de scraping.
            </p>
            <p className="text-amber-700 text-sm mt-2">
              Por favor verifica que el paso anterior (Revisar y Scrapear) se completó correctamente.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-3 text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700">Debug info</summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto text-xs">
                  {JSON.stringify({
                    serpJobId: playbookContext?.serpJobId,
                    contextKeys: playbookContext ? Object.keys(playbookContext) : [],
                  }, null, 2)}
                </pre>
              </details>
            )}
            {onBack && (
              <button
                onClick={onBack}
                className="mt-3 px-4 py-2 bg-amber-100 text-amber-800 rounded hover:bg-amber-200"
              >
                Volver al paso anterior
              </button>
            )}
          </div>
        )
      }

      // Check if step is marked as in_progress but job is not actually extracting
      // This can happen if the extraction failed or was interrupted
      const isExtracting = stepState.status === 'in_progress'

      // If step says in_progress but there's no progress data, it's likely stale
      const isStaleProgress = isExtracting && !stepState.progress

      // Convert stepState.progress to extraction progress format
      const extractionProgress = stepState.progress ? {
        current: stepState.progress.current || 0,
        total: stepState.progress.total || 0,
        extracted: (stepState.partialResults as { extracted?: number })?.extracted || 0,
        filtered: (stepState.partialResults as { filtered?: number })?.filtered || 0,
        label: stepState.progress.label,
      } : undefined

      return (
        <ScrapeResultsPanel
          jobId={jobId}
          onContinue={() => {
            onUpdateState({
              status: 'completed',
              completedAt: new Date(),
              output: { jobId, reviewed: true },
            })
            onContinue()
          }}
          onBack={onBack || (() => {})}
          onExecuteExtraction={async () => {
            // Start extraction
            onUpdateState({
              status: 'in_progress',
              startedAt: new Date(),
              input: { jobId },
            })
            // Call the parent's execute handler with jobId
            await onExecute({ jobId, action: 'extract' })
          }}
          isExtracting={isExtracting && !isStaleProgress}
          extractionProgress={extractionProgress}
          onResetExtractionState={isStaleProgress ? () => {
            // Reset the stale in_progress state back to pending
            console.log('[WorkArea] Resetting stale extraction state to pending')
            onUpdateState({
              status: 'pending',
              progress: undefined,
              partialResults: undefined,
            })
          } : undefined}
        />
      )
    }

    // extract_with_preview: Shows scraped URLs + extraction button + results table
    // This combines the old display_scrape_results functionality in a clearer way
    if (step.type === 'extract_with_preview') {
      console.log('[EXTRACT_WITH_PREVIEW] playbookContext:', {
        serpJobId: playbookContext?.serpJobId,
        review_and_scrape_output: playbookContext?.review_and_scrape_output,
        scrape_results_output: playbookContext?.scrape_results_output, // Old saved states
        search_and_preview_output: playbookContext?.search_and_preview_output,
        allKeys: playbookContext ? Object.keys(playbookContext) : [],
      })

      // Get jobId from context - check multiple sources for backwards compatibility
      const jobId = playbookContext?.serpJobId as string ||
                    (playbookContext?.review_and_scrape_output as { jobId?: string })?.jobId ||
                    (playbookContext?.scrape_results_output as { jobId?: string })?.jobId || // Old saved states
                    (playbookContext?.search_and_preview_output as { jobId?: string })?.jobId

      if (!jobId) {
        console.error('[EXTRACT_WITH_PREVIEW] No jobId found')
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-800 font-medium">
              No se encontró el ID del job de scraping.
            </p>
            <p className="text-amber-700 text-sm mt-2">
              Verifica que el paso &quot;Revisar y Scrapear&quot; se completó correctamente.
            </p>
            {onBack && (
              <button
                onClick={onBack}
                className="mt-3 px-4 py-2 bg-amber-100 text-amber-800 rounded hover:bg-amber-200"
              >
                Volver al paso anterior
              </button>
            )}
          </div>
        )
      }

      const isExtracting = stepState.status === 'in_progress'
      const isStaleProgress = isExtracting && !stepState.progress

      const extractionProgress = stepState.progress ? {
        current: stepState.progress.current || 0,
        total: stepState.progress.total || 0,
        extracted: (stepState.partialResults as { extracted?: number })?.extracted || 0,
        filtered: (stepState.partialResults as { filtered?: number })?.filtered || 0,
        label: stepState.progress.label,
      } : undefined

      return (
        <ScrapeResultsPanel
          jobId={jobId}
          onContinue={() => {
            onUpdateState({
              status: 'completed',
              completedAt: new Date(),
              output: { jobId, extracted: true },
            })
            onContinue()
          }}
          onBack={onBack || (() => {})}
          onExecuteExtraction={async () => {
            onUpdateState({
              status: 'in_progress',
              startedAt: new Date(),
              input: { jobId },
            })
            await onExecute({ jobId, action: 'extract' })
          }}
          isExtracting={isExtracting && !isStaleProgress}
          extractionProgress={extractionProgress}
          onResetExtractionState={isStaleProgress ? () => {
            console.log('[WorkArea] Resetting stale extraction state')
            onUpdateState({
              status: 'pending',
              progress: undefined,
              partialResults: undefined,
            })
          } : undefined}
        />
      )
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
              output: { jobId: serpJobId }, // Use 'jobId' key for consistency
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
            lastUrl: stepState.partialResults?.lastUrl,
            lastSnippet: stepState.partialResults?.lastSnippet,
          } : undefined}
        />
      )
    }

    // Render based on step type
    switch (step.type) {
      case 'unified_keyword_config':
        // Unified keyword configuration panel for Niche Finder
        const keywordOutput = (stepState.output || {}) as {
          lifeContexts?: Array<{ id: string; label: string; selected: boolean; category?: string }>
          needWords?: Array<{ id: string; label: string; selected: boolean }>
          indicators?: Array<{ id: string; label: string; selected: boolean }>
          sources?: {
            reddit_general: { enabled: boolean }
            reddit: { enabled: boolean; subreddits: string[] }
            thematic_forums: { enabled: boolean; forums: string[] }
            general_forums: { enabled: boolean; forums: string[] }
          }
        }

        const defaultSources = {
          reddit_general: { enabled: false },
          reddit: { enabled: true, subreddits: [] as string[] },
          thematic_forums: { enabled: true, forums: [] as string[] },
          general_forums: { enabled: false, forums: [] as string[] },
        }

        return (
          <KeywordConfigPanel
            contextType={(playbookContext?.context_type as 'personal' | 'business' | 'both') || 'both'}
            product={playbookContext?.product as string | undefined}
            target={playbookContext?.target as string | undefined}
            lifeContexts={keywordOutput.lifeContexts || []}
            needWords={keywordOutput.needWords || []}
            indicators={keywordOutput.indicators || []}
            sources={keywordOutput.sources || defaultSources}
            onLifeContextsChange={(items) => {
              onUpdateState({
                output: { ...keywordOutput, lifeContexts: items },
              })
            }}
            onNeedWordsChange={(items) => {
              onUpdateState({
                output: { ...keywordOutput, needWords: items },
              })
            }}
            onIndicatorsChange={(items) => {
              onUpdateState({
                output: { ...keywordOutput, indicators: items },
              })
            }}
            onSourcesChange={(sources) => {
              onUpdateState({
                output: { ...keywordOutput, sources },
              })
            }}
            onGenerateNeedWords={async () => {
              // Generate need words using LLM
              setIsGeneratingNeedWords(true)
              try {
                const response = await fetch('/api/playbook/generate-suggestions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    promptKey: 'suggest_need_words',
                    context: playbookContext,
                  }),
                })
                const data = await response.json()
                if (data.suggestions) {
                  // Preserve selected items, only replace unselected ones
                  const selectedItems = (keywordOutput.needWords || []).filter(w => w.selected)
                  const newSuggestions = data.suggestions.map((s: string, i: number) => ({
                    id: `gen_${Date.now()}_${i}`,
                    label: s,
                    selected: false,
                  }))
                  onUpdateState({
                    output: {
                      ...keywordOutput,
                      needWords: [...selectedItems, ...newSuggestions],
                    },
                  })
                }
              } catch (error) {
                console.error('Error generating need words:', error)
              } finally {
                setIsGeneratingNeedWords(false)
              }
            }}
            onGenerateSubreddits={async () => {
              // Generate subreddit suggestions using LLM
              setIsGeneratingSubreddits(true)
              try {
                const response = await fetch('/api/playbook/generate-suggestions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    promptKey: 'suggest_subreddits',
                    context: {
                      ...playbookContext,
                      life_contexts: keywordOutput.lifeContexts?.filter(c => c.selected).map(c => c.label) || [],
                      need_words: keywordOutput.needWords?.filter(w => w.selected).map(w => w.label) || [],
                    },
                  }),
                })
                const data = await response.json()
                if (data.subreddits) {
                  onUpdateState({
                    output: {
                      ...keywordOutput,
                      sources: {
                        ...(keywordOutput.sources || defaultSources),
                        reddit: {
                          enabled: true,
                          subreddits: data.subreddits,
                        },
                      },
                    },
                  })
                }
              } catch (error) {
                console.error('Error generating subreddits:', error)
              } finally {
                setIsGeneratingSubreddits(false)
              }
            }}
            onGenerateForums={async () => {
              // Generate forum suggestions using LLM
              setIsGeneratingForums(true)
              try {
                const response = await fetch('/api/playbook/generate-suggestions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    promptKey: 'suggest_forums',
                    context: {
                      ...playbookContext,
                      life_contexts: keywordOutput.lifeContexts?.filter(c => c.selected).map(c => c.label) || [],
                      need_words: keywordOutput.needWords?.filter(w => w.selected).map(w => w.label) || [],
                    },
                  }),
                })
                const data = await response.json()
                if (data.forums) {
                  onUpdateState({
                    output: {
                      ...keywordOutput,
                      sources: {
                        ...(keywordOutput.sources || defaultSources),
                        thematic_forums: {
                          enabled: true,
                          forums: data.forums,
                        },
                      },
                    },
                  })
                }
              } catch (error) {
                console.error('Error generating forums:', error)
              } finally {
                setIsGeneratingForums(false)
              }
            }}
            isGeneratingNeedWords={isGeneratingNeedWords}
            isGeneratingSubreddits={isGeneratingSubreddits}
            isGeneratingForums={isGeneratingForums}
            onContinue={async () => {
              // Save selected items to context and continue
              const selectedContexts = keywordOutput.lifeContexts?.filter(c => c.selected).map(c => c.label) || []
              const selectedNeeds = keywordOutput.needWords?.filter(w => w.selected).map(w => w.label) || []
              const selectedIndicators = keywordOutput.indicators?.filter(i => i.selected).map(i => i.label) || []

              // Get subreddits and forums from sources
              const subreddits = keywordOutput.sources?.reddit?.subreddits || []
              const forums = keywordOutput.sources?.thematic_forums?.forums || []

              // Validate required selections
              if (selectedContexts.length === 0) {
                alert('Por favor selecciona al menos un contexto de vida antes de continuar.')
                return
              }
              if (selectedNeeds.length === 0) {
                alert('Por favor selecciona o añade al menos una palabra de necesidad antes de continuar.')
                return
              }

              // Log what we're saving for debugging
              console.log('[KeywordConfig] Saving config:', {
                selectedContexts,
                selectedNeeds,
                selectedIndicators,
                subreddits,
                forums,
              })

              onUpdateState({
                status: 'completed',
                completedAt: new Date(),
                output: {
                  ...keywordOutput,
                  // Also save as arrays for easy access
                  life_contexts: selectedContexts,
                  product_words: selectedNeeds,
                  indicators: selectedIndicators,
                  sources: keywordOutput.sources,
                },
              })

              // Save keywords config to Context Lake asynchronously
              try {
                const projectResponse = await fetch(`/api/projects/${projectId}`)
                const projectData = await projectResponse.json()

                if (projectData.client_id) {
                  const dateStr = new Date().toISOString().split('T')[0]
                  const campaignName = (playbookContext?.campaign_name as string) || 'Sin nombre'
                  const campaignSlug = campaignName.toLowerCase().replace(/\s+/g, '-')
                  const campaignId = (playbookContext?.campaign_id as string) || ''

                  // Build markdown content for keywords
                  const lines: string[] = [
                    '# Configuracion de Busqueda - Niche Finder',
                    '',
                    `**Campana:** ${campaignName}`,
                    `**Fecha:** ${dateStr}`,
                    '',
                  ]

                  if (selectedContexts.length > 0) {
                    lines.push('## Contextos de Vida')
                    selectedContexts.forEach(c => lines.push(`- ${c}`))
                    lines.push('')
                  }

                  if (selectedNeeds.length > 0) {
                    lines.push('## Palabras de Necesidad')
                    selectedNeeds.forEach(w => lines.push(`- ${w}`))
                    lines.push('')
                  }

                  if (selectedIndicators.length > 0) {
                    lines.push('## Indicadores de Urgencia')
                    selectedIndicators.forEach(i => lines.push(`- ${i}`))
                    lines.push('')
                  }

                  if (subreddits.length > 0) {
                    lines.push('## Subreddits')
                    subreddits.forEach(s => lines.push(`- r/${s}`))
                    lines.push('')
                  }

                  if (forums.length > 0) {
                    lines.push('## Foros')
                    forums.forEach(f => lines.push(`- ${f}`))
                    lines.push('')
                  }

                  const content = lines.join('\n')

                  await fetch('/api/documents/from-step-output', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      projectId,
                      clientId: projectData.client_id,
                      filename: `Niche Finder - Keywords - ${dateStr}`,
                      category: 'research',
                      content,
                      description: `Configuracion: ${selectedContexts.length} contextos, ${selectedNeeds.length} palabras de necesidad, ${subreddits.length} subreddits`,
                      tags: [`fecha:${dateStr}`, `campaign:${campaignId}`, 'niche-finder', 'keywords', 'configuracion'],
                      folder: `niche-finder/${campaignSlug}`,
                      userId: 'system',
                      sourceMetadata: {
                        origin_type: 'flow_step_output',
                        playbook_id: 'niche-finder',
                        playbook_name: 'Niche Finder',
                        campaign_id: campaignId,
                        campaign_name: campaignName,
                        campaign_variables: {},
                        step_id: 'keyword_config',
                        step_name: 'Configuracion de Keywords',
                        step_order: 1,
                        executed_at: new Date().toISOString(),
                        model_used: 'system',
                        model_provider: 'system',
                        input_tokens: 0,
                        output_tokens: 0,
                        input_document_ids: [],
                        input_previous_step_ids: [],
                        converted_at: new Date().toISOString(),
                        converted_by: 'system',
                        was_edited_before_conversion: false,
                      },
                      sourceCampaignId: campaignId,
                      sourceStepId: 'keyword_config',
                      sourceStepName: 'Configuracion de Keywords',
                      sourcePlaybookId: 'niche-finder',
                    }),
                  })
                  console.log('[KEYWORDS] Config saved to Context Lake')
                }
              } catch (err) {
                console.error('[KEYWORDS] Error saving to Context Lake:', err)
                // Don't fail the step if Context Lake save fails
              }

              onContinue()
            }}
          />
        )

      case 'unified_search_extract':
        // Unified panel for SERP → URLs → Scrape → Extract
        // Get config from playbookContext which has ALREADY extracted labels as strings
        // (buildPlaybookContext extracts from keyword_config output)

        // Get sources config - handle both old format and new format
        const sourcesFromContext = playbookContext?.sources as {
          reddit?: { enabled?: boolean; subreddits?: string[] }
          thematic_forums?: { enabled?: boolean; forums?: string[] }
          general_forums?: { enabled?: boolean; forums?: string[] }
        } | undefined

        const searchConfig = {
          life_contexts: (playbookContext?.life_contexts as string[]) || [],
          product_words: (playbookContext?.need_words as string[]) || [],
          indicators: (playbookContext?.indicators as string[]) || [],
          sources: {
            reddit: sourcesFromContext?.reddit?.enabled ?? true,
            thematic_forums: sourcesFromContext?.thematic_forums?.enabled ?? false,
            general_forums: sourcesFromContext?.general_forums?.forums || [],
          },
          serp_pages: 5,
        }

        // Determine phase from step state
        // Note: 'error' status is handled by early return at top of renderStepContent
        let currentPhase: 'preview' | 'serp_executing' | 'serp_complete' | 'scraping' | 'scrape_done' | 'extracting' | 'completed' | 'error' = 'preview'
        if (stepState.status === 'completed') {
          currentPhase = 'completed'
        } else if (stepState.status === 'in_progress') {
          // Check what phase we're in based on output
          const output = stepState.output as { phase?: string } | undefined
          if (output?.phase === 'extracting') {
            currentPhase = 'extracting'
          } else if (output?.phase === 'scrape_done') {
            currentPhase = 'scrape_done'
          } else if (output?.phase === 'scraping') {
            currentPhase = 'scraping'
          } else if (output?.phase === 'serp_complete') {
            currentPhase = 'serp_complete'
          } else {
            currentPhase = 'serp_executing'
          }
        }

        return (
          <UnifiedSearchExtractPanel
            config={searchConfig}
            projectId={projectId}
            jobId={(stepState.output as { jobId?: string })?.jobId}
            currentPhase={currentPhase}
            serpProgress={currentPhase === 'serp_executing' ? stepState.progress : undefined}
            analysisProgress={currentPhase === 'extracting' ? {
              current: stepState.progress?.current || 0,
              total: stepState.progress?.total || 0,
              label: stepState.progress?.label,
              scrapedCount: stepState.partialResults?.successCount,
              extractedCount: stepState.partialResults?.extracted,
              filteredCount: stepState.partialResults?.filtered,
            } : undefined}
            onExecuteSerp={async (finalConfig) => {
              // Update state to show we're executing SERP
              onUpdateState({
                status: 'in_progress',
                startedAt: new Date(),
                output: { phase: 'serp_executing' },
              })
              // Call parent execute handler
              await onExecute({ action: 'serp', config: finalConfig })
            }}
            onExecuteAnalysis={async (jobId, selectedSources, extractionPrompt) => {
              // Update state to show we're scraping (then extracting)
              onUpdateState({
                status: 'in_progress',
                output: { phase: 'scraping', jobId },
              })
              // Call parent execute handler with extraction prompt if provided
              await onExecute({ action: 'analyze', jobId, selectedSources, extractionPrompt })
            }}
            onComplete={(output) => {
              onUpdateState({
                status: 'completed',
                completedAt: new Date(),
                output,
              })
              onContinue()
            }}
            onBack={onBack}
            onCancel={onCancel}
            onResetPhase={() => {
              // Reset step state to allow restarting the search
              onUpdateState({
                status: 'pending',
                output: undefined,
                startedAt: undefined,
                completedAt: undefined,
                progress: undefined,
                partialResults: undefined,
              })
            }}
          />
        )

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

          {/* Status indicator, save indicator, and inspection toggle */}
          <div className="flex items-center gap-2">
            {/* Saved indicator */}
            {saveState && (
              <SavedIndicator
                isSaving={saveState.isSaving}
                lastSavedAt={saveState.lastSavedAt}
                saveError={saveState.saveError}
                isDirty={saveState.isDirty}
                compact={false}
              />
            )}
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
            {/* Inspection toggle button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowInspection(!showInspection)
              }}
              className={`p-1.5 rounded transition-colors ${
                showInspection
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title={showInspection ? 'Ocultar inspector' : 'Mostrar inspector'}
            >
              {showInspection ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Step content */}
      {isExpanded && (
        <div className="px-6 py-5">
          {renderStepContent()}
        </div>
      )}

      {/* Step Inspection Panel */}
      {showInspection && (
        <StepInspectionPanel
          step={step}
          stepState={stepState}
          playbookContext={playbookContext || {}}
          allSteps={allSteps || []}
          onClose={() => setShowInspection(false)}
          onRetry={onRetry || (() => onUpdateState({ status: 'pending', error: undefined }))}
        />
      )}

      {/* Navigation footer for completed steps - hide for steps with their own navigation */}
      {isExpanded && stepState.status === 'completed' &&
       !['unified_keyword_config', 'search_with_preview', 'review_with_action', 'unified_search_extract'].includes(step.type) && (
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

      {/* API Key Setup Modal */}
      {showApiKeyModal && missingApiKeys.length > 0 && (
        <ApiKeySetupModal
          missingServices={missingApiKeys}
          onComplete={() => {
            setShowApiKeyModal(false)
            setMissingApiKeys([])
          }}
          onCancel={() => {
            setShowApiKeyModal(false)
          }}
          title="Configurar API Keys"
          description={`Este paso requiere las siguientes API keys para funcionar:`}
        />
      )}
    </div>
  )
}
