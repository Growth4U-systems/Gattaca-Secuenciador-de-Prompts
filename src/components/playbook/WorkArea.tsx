'use client'

import { useState, useEffect, useRef } from 'react'
import {
  ChevronLeft,
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const suggestions = stepState.suggestions || []
  const config = step.suggestionConfig
  const selectedCount = suggestions.filter(s => s.selected).length
  const canContinue = !config?.minSelections || selectedCount >= config.minSelections

  // Ref to prevent infinite re-renders when loading fixed options
  const hasLoadedFixedRef = useRef(false)

  // Load fixed options based on context_type
  useEffect(() => {
    if (config?.generateFrom !== 'fixed') {
      hasLoadedFixedRef.current = false
      return
    }
    if (hasLoadedFixedRef.current) return
    if (suggestions.length > 0) return // Already loaded from state

    hasLoadedFixedRef.current = true

    const contextType = playbookContext?.context_type || 'both'
    let fixedOptions: Array<{ id: string; label: string; category?: string; contextType?: 'b2c' | 'b2b' }> = []

    // Load appropriate lists based on context_type
    if (contextType === 'personal' || contextType === 'both') {
      fixedOptions = [...fixedOptions, ...B2C_CONTEXTS]
    }
    if (contextType === 'business' || contextType === 'both') {
      fixedOptions = [...fixedOptions, ...B2B_CONTEXTS]
    }

    // Format for suggestions state (include contextType for visual grouping)
    const formattedSuggestions = fixedOptions.map(opt => ({
      id: opt.id,
      label: opt.label,
      category: opt.category,
      contextType: opt.contextType,
      selected: false,
    }))

    if (formattedSuggestions.length > 0) {
      onUpdateState({ suggestions: formattedSuggestions })
    }
  }, [config?.generateFrom, suggestions.length, playbookContext?.context_type, onUpdateState])

  // Load suggestions from API if configured
  useEffect(() => {
    const loadFromAPI = async () => {
      if (config?.generateFrom !== 'api' || !config.apiEndpoint) return
      if (suggestions.length > 0) return // Already loaded

      setLoading(true)
      setError(null)
      try {
        const response = await fetch(config.apiEndpoint)
        if (!response.ok) throw new Error('Error loading suggestions')
        const data = await response.json()

        // The API returns { options: [...] } with pre-formatted suggestions
        if (data.options && Array.isArray(data.options)) {
          onUpdateState({ suggestions: data.options })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading suggestions')
      } finally {
        setLoading(false)
      }
    }

    loadFromAPI()
  }, [config?.generateFrom, config?.apiEndpoint, suggestions.length, onUpdateState])

  // Generate suggestions via LLM if configured
  useEffect(() => {
    const generateFromLLM = async () => {
      if (config?.generateFrom !== 'llm' || !step.promptKey) return
      if (suggestions.length > 0) return // Already generated

      setLoading(true)
      setError(null)
      try {
        // Get the prompt template
        let prompt = getDefaultPrompt(step.promptKey)
        if (!prompt) {
          throw new Error(`No prompt found for key: ${step.promptKey}`)
        }

        // Replace template variables with context values
        if (playbookContext) {
          prompt = prompt.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            const value = playbookContext[key]
            if (Array.isArray(value)) {
              return value.join(', ')
            }
            return String(value || '')
          })

          // Handle conditional blocks (simplified)
          prompt = prompt.replace(/\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, condition, content) => {
            // Simple condition evaluation for context_type
            const contextType = playbookContext.context_type || 'both'
            if (condition.includes('personal') && (contextType === 'personal' || contextType === 'both')) {
              return content
            }
            if (condition.includes('business') && (contextType === 'business' || contextType === 'both')) {
              return content
            }
            return ''
          })
        }

        // Call the LLM API
        const response = await fetch('/api/llm/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            responseFormat: 'json',
            temperature: 0.7,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Error generating suggestions')
        }

        const data = await response.json()

        // Parse the LLM response - it should be a JSON array
        let parsedSuggestions: Array<{ id: string; label: string; description?: string; selected?: boolean }> = []

        if (typeof data.content === 'string') {
          // Try to extract JSON from the response
          const jsonMatch = data.content.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            parsedSuggestions = JSON.parse(jsonMatch[0])
          }
        } else if (Array.isArray(data.content)) {
          parsedSuggestions = data.content
        } else if (data.suggestions) {
          parsedSuggestions = data.suggestions
        }

        // Ensure all suggestions have selected: false by default
        const formattedSuggestions = parsedSuggestions.map((s, i) => ({
          id: s.id || `suggestion_${i}`,
          label: s.label,
          description: s.description,
          selected: false,
        }))

        if (formattedSuggestions.length > 0) {
          onUpdateState({ suggestions: formattedSuggestions })
        } else {
          throw new Error('No suggestions generated')
        }
      } catch (err) {
        console.error('Error generating LLM suggestions:', err)
        setError(err instanceof Error ? err.message : 'Error generating suggestions')
      } finally {
        setLoading(false)
      }
    }

    generateFromLLM()
  }, [config?.generateFrom, step.promptKey, suggestions.length, onUpdateState, playbookContext])

  const toggleSuggestion = (id: string) => {
    const updated = suggestions.map(s =>
      s.id === id ? { ...s, selected: !s.selected } : s
    )
    onUpdateState({ suggestions: updated })
  }

  const addCustomItem = () => {
    if (!newItem.trim()) return
    const updated = [
      ...suggestions,
      { id: `custom-${Date.now()}`, label: newItem.trim(), selected: true },
    ]
    onUpdateState({ suggestions: updated })
    setNewItem('')
  }

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-gray-600 text-sm">
          {step.description || 'Selecciona las opciones que aplican a tu caso.'}
        </p>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          <span className="ml-2 text-gray-600">Cargando sugerencias...</span>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 rounded-lg p-4 border border-red-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Error cargando sugerencias</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Group suggestions by contextType (B2C/B2B) first, then by category
  const hasContextTypes = suggestions.some(s => s.contextType)
  const hasCategories = suggestions.some(s => s.category)

  // Group by contextType then category for visual separation
  const groupedByContextType = hasContextTypes
    ? {
        b2c: suggestions.filter(s => s.contextType === 'b2c'),
        b2b: suggestions.filter(s => s.contextType === 'b2b'),
        other: suggestions.filter(s => !s.contextType), // Custom items
      }
    : null

  // Helper to group items by category
  const groupByCategory = (items: typeof suggestions) =>
    items.reduce((acc, suggestion) => {
      const category = suggestion.category || 'Otros'
      if (!acc[category]) acc[category] = []
      acc[category].push(suggestion)
      return acc
    }, {} as Record<string, typeof suggestions>)

  // Render chips/tags UI for fixed options with B2C/B2B sections
  if (config?.generateFrom === 'fixed' && (hasContextTypes || hasCategories)) {
    const showBothSections = groupedByContextType && groupedByContextType.b2c.length > 0 && groupedByContextType.b2b.length > 0

    return (
      <div className="space-y-4">
        <p className="text-gray-600 text-sm">
          {step.description || 'Selecciona las opciones que aplican a tu caso.'}
        </p>

        <div className="space-y-6">
          {/* B2C Section */}
          {groupedByContextType && groupedByContextType.b2c.length > 0 && (
            <div>
              {showBothSections && (
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 border-b border-gray-200 pb-2">
                  <span>👤</span> Personal (B2C)
                </h3>
              )}
              <div className="space-y-3">
                {Object.entries(groupByCategory(groupedByContextType.b2c)).map(([category, items]) => (
                  <div key={`b2c-${category}`}>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      {category}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {items.map(suggestion => (
                        <button
                          key={suggestion.id}
                          onClick={() => toggleSuggestion(suggestion.id)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            suggestion.selected
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* B2B Section */}
          {groupedByContextType && groupedByContextType.b2b.length > 0 && (
            <div>
              {showBothSections && (
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 border-b border-gray-200 pb-2">
                  <span>🏢</span> Empresas (B2B)
                </h3>
              )}
              <div className="space-y-3">
                {Object.entries(groupByCategory(groupedByContextType.b2b)).map(([category, items]) => (
                  <div key={`b2b-${category}`}>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      {category}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {items.map(suggestion => (
                        <button
                          key={suggestion.id}
                          onClick={() => toggleSuggestion(suggestion.id)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            suggestion.selected
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom items (no contextType) */}
          {groupedByContextType && groupedByContextType.other.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Personalizados
              </h4>
              <div className="flex flex-wrap gap-2">
                {groupedByContextType.other.map(suggestion => (
                  <button
                    key={suggestion.id}
                    onClick={() => toggleSuggestion(suggestion.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      suggestion.selected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {config?.allowAdd && (
          <div className="flex gap-2 pt-2">
            <input
              type="text"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomItem()}
              placeholder="Agregar contexto personalizado..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={addCustomItem}
              disabled={!newItem.trim()}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              <Plus size={16} />
            </button>
          </div>
        )}

        {config?.minSelections && (
          <p className="text-xs text-gray-500">
            Mínimo {config.minSelections} selección{config.minSelections > 1 ? 'es' : ''}
            {selectedCount < config.minSelections && (
              <span className="text-orange-600 ml-1">
                (faltan {config.minSelections - selectedCount})
              </span>
            )}
          </p>
        )}

        <button
          onClick={onContinue}
          disabled={!canContinue}
          className="w-full mt-4 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Continuar
          <ChevronRight size={16} />
        </button>
      </div>
    )
  }

  // Default list UI for API/LLM generated suggestions
  return (
    <div className="space-y-4">
      <p className="text-gray-600 text-sm">
        {step.description || 'Selecciona las opciones que aplican a tu caso.'}
      </p>

      <div className="space-y-2">
        {suggestions.map(suggestion => (
          <label
            key={suggestion.id}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              suggestion.selected
                ? 'border-blue-300 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={suggestion.selected}
              onChange={() => toggleSuggestion(suggestion.id)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <div className="flex-1">
              <span className={`text-sm ${suggestion.selected ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                {suggestion.label}
              </span>
              {suggestion.description && (
                <p className="text-xs text-gray-500 mt-0.5">{suggestion.description}</p>
              )}
            </div>
          </label>
        ))}
      </div>

      {config?.allowAdd && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomItem()}
            placeholder="Agregar otro..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={addCustomItem}
            disabled={!newItem.trim()}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <Plus size={16} />
          </button>
        </div>
      )}

      {config?.minSelections && (
        <p className="text-xs text-gray-500">
          Mínimo {config.minSelections} selección{config.minSelections > 1 ? 'es' : ''}
          {selectedCount < config.minSelections && (
            <span className="text-orange-600 ml-1">
              (faltan {config.minSelections - selectedCount})
            </span>
          )}
        </p>
      )}

      <button
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full mt-4 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        Continuar
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

interface AutoExecutingStepProps {
  step: StepDefinition
  stepState: StepState
  onCancel?: () => void
}

function AutoExecutingStep({ step, stepState, onCancel }: AutoExecutingStepProps) {
  const progress = stepState.progress
  const partialResults = stepState.partialResults

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
        <span className="text-gray-700 font-medium">{step.name}</span>
      </div>

      <p className="text-gray-600 text-sm">
        {step.description || 'El sistema está procesando...'}
      </p>

      {progress && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{progress.label || 'Progreso'}</span>
            <span className="text-gray-700 font-medium">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          {progress.estimatedTimeRemaining && (
            <p className="text-xs text-gray-500">
              Tiempo estimado: {progress.estimatedTimeRemaining}
            </p>
          )}
        </div>
      )}

      {/* Partial results - show success/failed counts if available */}
      {partialResults && (partialResults.successCount !== undefined || partialResults.failedCount !== undefined) && (
        <div className="flex gap-4 text-sm">
          {partialResults.successCount !== undefined && (
            <div className="flex items-center gap-1.5 text-green-700">
              <Check size={14} />
              <span>{partialResults.successCount} exitosos</span>
            </div>
          )}
          {partialResults.failedCount !== undefined && partialResults.failedCount > 0 && (
            <div className="flex items-center gap-1.5 text-red-600">
              <AlertCircle size={14} />
              <span>{partialResults.failedCount} fallidos</span>
            </div>
          )}
        </div>
      )}

      {/* Last items found - show last few results */}
      {partialResults?.lastItems && partialResults.lastItems.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <p className="text-xs font-medium text-gray-500 mb-2">Últimos encontrados:</p>
          <ul className="space-y-1">
            {partialResults.lastItems.slice(-3).map((item, i) => (
              <li key={i} className="text-sm text-gray-700 truncate flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span className="truncate">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Last snippet - show last content extracted */}
      {partialResults?.lastSnippet && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <p className="text-xs font-medium text-gray-500 mb-1">
            {partialResults.lastUrl && (
              <span className="text-blue-600">{new URL(partialResults.lastUrl).hostname}</span>
            )}
          </p>
          <p className="text-sm text-gray-700 italic line-clamp-2">
            &ldquo;{partialResults.lastSnippet}&rdquo;
          </p>
        </div>
      )}

      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
        <p className="text-sm text-blue-700">
          El sistema continuará automáticamente cuando termine este paso.
        </p>
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full px-4 py-2.5 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 border border-red-200 flex items-center justify-center gap-2 transition-colors"
        >
          <Square size={16} />
          Cancelar Ejecución
        </button>
      )}
    </div>
  )
}

interface DecisionStepProps {
  step: StepDefinition
  stepState: StepState
  onUpdateState: (update: Partial<StepState>) => void
  onContinue: () => void
  onBack?: () => void
  onRerunPrevious?: () => void
}

function DecisionStep({ step, stepState, onUpdateState, onContinue, onBack, onRerunPrevious }: DecisionStepProps) {
  const config = step.decisionConfig
  // Use fixedOptions from config if optionsFrom is 'fixed', otherwise fall back to stepState.suggestions
  const options = config?.optionsFrom === 'fixed' && config?.fixedOptions
    ? config.fixedOptions.map(opt => ({ ...opt, selected: false }))
    : (stepState.suggestions || [])
  const selected = stepState.decision || (config?.multiSelect ? [] : null)

  const handleSelect = (optionId: string) => {
    if (config?.multiSelect) {
      const current = Array.isArray(selected) ? selected : []
      const updated = current.includes(optionId)
        ? current.filter((id: string) => id !== optionId)
        : [...current, optionId]
      onUpdateState({ decision: updated })
    } else {
      onUpdateState({ decision: optionId })
    }
  }

  const isSelected = (optionId: string) => {
    if (config?.multiSelect) {
      return Array.isArray(selected) && selected.includes(optionId)
    }
    return selected === optionId
  }

  const canContinue = config?.multiSelect
    ? Array.isArray(selected) && selected.length >= (config?.minSelections || 1)
    : !!selected

  // Handle confirm based on selection
  const handleConfirm = () => {
    // Standard decision IDs for review steps
    if (selected === 'edit' && onBack) {
      // Go back to previous step to edit
      onBack()
      return
    }
    if (selected === 'regenerate' && onRerunPrevious) {
      // Re-execute the previous step
      onRerunPrevious()
      return
    }
    // Default: approve/continue to next step
    onContinue()
  }

  // Get button label based on selection
  const getButtonLabel = () => {
    if (selected === 'edit') return 'Volver a editar'
    if (selected === 'regenerate') return 'Regenerar'
    return 'Confirmar selección'
  }

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
        <p className="text-sm text-orange-800 font-medium">
          Decisión requerida
        </p>
      </div>

      <p className="text-gray-700">
        {config?.question || step.description || 'Selecciona una opción:'}
      </p>

      <div className="space-y-2">
        {options.map(option => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              isSelected(option.id)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                isSelected(option.id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
              }`}>
                {isSelected(option.id) && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="flex-1">
                <span className={`font-medium ${isSelected(option.id) ? 'text-blue-700' : 'text-gray-700'}`}>
                  {option.label}
                </span>
                {option.description && (
                  <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={handleConfirm}
        disabled={!canContinue}
        className="w-full mt-4 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {getButtonLabel()}
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

interface DisplayStepProps {
  step: StepDefinition
  stepState: StepState
  onContinue: () => void
}

function DisplayStep({ step, stepState, onContinue }: DisplayStepProps) {
  const [copied, setCopied] = useState(false)
  const output = stepState.output

  const handleCopy = async () => {
    if (!output) return
    const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      {step.description && (
        <p className="text-gray-600 text-sm">{step.description}</p>
      )}

      {output && (
        <div className="relative">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            {copied ? <CheckCheck size={16} className="text-green-600" /> : <Copy size={16} />}
          </button>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 overflow-auto max-h-96">
            {typeof output === 'string' ? (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{output}</ReactMarkdown>
              </div>
            ) : (
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                {JSON.stringify(output, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onContinue}
        className="w-full mt-4 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
      >
        Continuar
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

interface ErrorStateProps {
  step: StepDefinition
  stepState: StepState
  onRetry: () => void
}

function ErrorState({ step, stepState, onRetry }: ErrorStateProps) {
  return (
    <div className="space-y-4">
      <div className="bg-red-50 rounded-lg p-4 border border-red-100">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">
              Error en {step.name}
            </p>
            <p className="text-sm text-red-700 mt-1">
              {stepState.error || 'Ha ocurrido un error inesperado.'}
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onRetry}
        className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 flex items-center justify-center gap-2"
      >
        <RefreshCw size={16} />
        Reintentar
      </button>
    </div>
  )
}

interface InputStepProps {
  step: StepDefinition
  stepState: StepState
  onUpdateState: (update: Partial<StepState>) => void
  onContinue: () => void
}

function InputStep({ step, stepState, onUpdateState, onContinue }: InputStepProps) {
  const [value, setValue] = useState(stepState.input || '')

  const handleContinue = () => {
    onUpdateState({ input: value })
    onContinue()
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-600 text-sm">
        {step.description || 'Ingresa la información requerida.'}
      </p>

      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Escribe aquí..."
        rows={4}
        className="w-full px-3 py-2 text-sm !bg-white !text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
      />

      <button
        onClick={handleContinue}
        disabled={!value.trim()}
        className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        Continuar
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

// Map of step types/jobTypes to required API services
const STEP_API_REQUIREMENTS: Record<string, string[]> = {
  // Niche Finder jobs
  niche_finder_serp: ['serper'],
  niche_finder_scrape: ['firecrawl'],
  niche_finder_extract: ['openrouter'],
  // LLM steps (default to openrouter)
  llm: ['openrouter'],
}

interface PendingStepProps {
  step: StepDefinition
  onExecute: () => void
}

function PendingStep({ step, onExecute }: PendingStepProps) {
  const isAutoStep = ['auto', 'auto_with_preview', 'auto_with_review'].includes(step.type)
  const hasExplanation = !!step.executionExplanation
  const [apiKeyStatus, setApiKeyStatus] = useState<{
    loading: boolean
    missing: string[]
    checked: boolean
  }>({ loading: false, missing: [], checked: false })

  // Determine which APIs this step requires
  const requiredApis = step.jobType
    ? STEP_API_REQUIREMENTS[step.jobType] || []
    : step.executor === 'llm'
    ? STEP_API_REQUIREMENTS.llm
    : []

  // Check API keys when component mounts
  useEffect(() => {
    if (requiredApis.length === 0) {
      setApiKeyStatus({ loading: false, missing: [], checked: true })
      return
    }

    const checkApiKeys = async () => {
      setApiKeyStatus(prev => ({ ...prev, loading: true }))
      try {
        const response = await fetch(`/api/user/api-keys/check?services=${requiredApis.join(',')}`)
        const data = await response.json()
        setApiKeyStatus({
          loading: false,
          missing: data.missing || [],
          checked: true,
        })
      } catch {
        // If check fails, assume keys are configured to allow execution
        setApiKeyStatus({ loading: false, missing: [], checked: true })
      }
    }
    checkApiKeys()
  }, [requiredApis.join(',')])

  // Service name to display name
  const serviceDisplayName: Record<string, string> = {
    serper: 'Serper (búsqueda Google)',
    firecrawl: 'Firecrawl (scraping)',
    openrouter: 'OpenRouter (IA)',
    apify: 'Apify (scraping social)',
    perplexity: 'Perplexity (búsqueda IA)',
  }

  // Show loading while checking
  if (apiKeyStatus.loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Verificando configuración...</span>
        </div>
      </div>
    )
  }

  // Show warning if missing API keys
  if (apiKeyStatus.missing.length > 0) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                API Keys requeridas
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Para ejecutar este paso necesitas configurar:
              </p>
              <ul className="mt-2 space-y-1">
                {apiKeyStatus.missing.map(service => (
                  <li key={service} className="text-sm text-yellow-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                    {serviceDisplayName[service] || service}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <a
          href="/settings#apis"
          className="w-full px-4 py-2.5 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 flex items-center justify-center gap-2"
        >
          Ir a Configuración → APIs
        </a>
      </div>
    )
  }

  // Render explanation panel if available
  if (hasExplanation && step.executionExplanation) {
    const explanation = step.executionExplanation
    return (
      <div className="space-y-6">
        {/* Title with icon */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Play className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{explanation.title}</h3>
            <p className="text-sm text-gray-500">Este paso va a:</p>
          </div>
        </div>

        {/* Steps list */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <ol className="space-y-2">
            {explanation.steps.map((stepText, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 text-xs font-medium">
                  {i + 1}
                </span>
                <span className="text-gray-700">{stepText}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Cost and time estimates */}
        {(explanation.estimatedTime || explanation.estimatedCost) && (
          <div className="flex gap-4">
            {explanation.estimatedTime && (
              <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Tiempo estimado</p>
                <p className="text-sm font-medium text-gray-900">{explanation.estimatedTime}</p>
              </div>
            )}
            {explanation.estimatedCost && (
              <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Costo ({explanation.costService || 'API'})</p>
                <p className="text-sm font-medium text-gray-900">{explanation.estimatedCost}</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onExecute}
          className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <Play size={16} />
          Ejecutar
        </button>
      </div>
    )
  }

  // Default simple view
  return (
    <div className="space-y-4">
      <p className="text-gray-600 text-sm">
        {step.description || 'Este paso está listo para ejecutarse.'}
      </p>

      <button
        onClick={onExecute}
        className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
      >
        <Play size={16} />
        {isAutoStep ? 'Iniciar' : 'Continuar'}
      </button>
    </div>
  )
}

interface CompletedStepProps {
  step: StepDefinition
  stepState: StepState
  onContinue: () => void
  onRerun?: () => void
  onEdit?: () => void
}

function CompletedStep({ step, stepState, onContinue, onRerun, onEdit }: CompletedStepProps) {
  const [copied, setCopied] = useState(false)
  const output = stepState.output
  const suggestions = stepState.suggestions

  const handleCopy = async () => {
    if (!output) return
    const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Render summary for suggestion steps (show selected items as chips)
  // REGLA UX: Siempre mostrar algo útil al usuario, nunca dejar la UI vacía
  const renderSuggestionSummary = () => {
    if (step.type !== 'suggestion') return null

    // Si no hay suggestions en el state, mostrar mensaje informativo
    if (!suggestions || suggestions.length === 0) {
      return (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-500 italic">
            Este paso se completó sin opciones cargadas.
          </p>
        </div>
      )
    }

    const selected = suggestions.filter(s => s.selected)

    // Si hay opciones pero ninguna seleccionada
    if (selected.length === 0) {
      return (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-500 italic">
            No se seleccionó ninguna opción (opcional).
          </p>
        </div>
      )
    }

    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="text-sm font-medium text-gray-600 mb-2">
          {selected.length} seleccionado{selected.length !== 1 ? 's' : ''}:
        </div>
        <div className="flex flex-wrap gap-2">
          {selected.map(s => (
            <span key={s.id} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
              {s.label}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // Render user-friendly output for auto steps
  // REGLA UX: Nunca mostrar JSON raw al usuario - siempre presentar datos de forma legible
  const renderAutoOutput = () => {
    if (!output || step.type === 'suggestion') return null

    // Helper: render sources config (Fuentes de Datos step)
    // Supports both LLM format ({ enabled, subreddits/forums }) and array format
    const renderSourcesConfig = (data: Record<string, unknown>) => {
      const sections: React.ReactNode[] = []

      // Reddit - support both { enabled, subreddits } and boolean formats
      if (data.reddit) {
        let subreddits: string[] = []
        let isEnabled = false

        if (typeof data.reddit === 'object') {
          const reddit = data.reddit as { enabled?: boolean; subreddits?: string[] }
          isEnabled = reddit.enabled ?? false
          subreddits = reddit.subreddits || []
        } else if (typeof data.reddit === 'boolean') {
          isEnabled = data.reddit
        }

        if (isEnabled || subreddits.length > 0) {
          sections.push(
            <div key="reddit" className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-orange-500 font-medium">Reddit</span>
                {subreddits.length > 0 && (
                  <span className="text-xs text-gray-500">({subreddits.length} subreddits)</span>
                )}
                {isEnabled && subreddits.length === 0 && (
                  <span className="text-xs text-green-600">Habilitado</span>
                )}
              </div>
              {subreddits.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {subreddits.map((sub: string) => (
                    <span key={sub} className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-sm border border-orange-200">
                      r/{sub}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        }
      }

      // Thematic Forums - support both { enabled, forums/domains } and boolean formats
      if (data.thematic_forums) {
        let forums: string[] = []
        let isEnabled = false

        if (typeof data.thematic_forums === 'object') {
          const tf = data.thematic_forums as { enabled?: boolean; forums?: string[]; domains?: string[] }
          isEnabled = tf.enabled ?? false
          forums = tf.forums || tf.domains || []
        } else if (typeof data.thematic_forums === 'boolean') {
          isEnabled = data.thematic_forums
        }

        if (isEnabled || forums.length > 0) {
          sections.push(
            <div key="thematic" className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-purple-600 font-medium">Foros Temáticos</span>
                {forums.length > 0 && (
                  <span className="text-xs text-gray-500">({forums.length} sitios)</span>
                )}
                {isEnabled && forums.length === 0 && (
                  <span className="text-xs text-green-600">Habilitado (auto-detecta)</span>
                )}
              </div>
              {forums.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {forums.map((domain: string) => (
                    <span key={domain} className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-sm border border-purple-200">
                      {domain}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        }
      }

      // General Forums - support both { enabled, forums/domains } and string[] formats
      if (data.general_forums) {
        let forums: string[] = []
        let isEnabled = false

        if (Array.isArray(data.general_forums)) {
          forums = data.general_forums
          isEnabled = forums.length > 0
        } else if (typeof data.general_forums === 'object') {
          const gf = data.general_forums as { enabled?: boolean; forums?: string[]; domains?: string[] }
          isEnabled = gf.enabled ?? false
          forums = gf.forums || gf.domains || []
        }

        if (isEnabled || forums.length > 0) {
          sections.push(
            <div key="general" className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">Foros Generales</span>
                {forums.length > 0 && (
                  <span className="text-xs text-gray-500">({forums.length} sitios)</span>
                )}
              </div>
              {forums.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {forums.map((domain: string) => (
                    <span key={domain} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm border border-blue-200">
                      {domain}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        }
      }

      if (sections.length === 0) return null

      return (
        <div className="space-y-4">
          {sections}
        </div>
      )
    }

    // Helper: check if output looks like sources config
    const isSourcesConfig = (data: unknown): data is Record<string, unknown> => {
      if (typeof data !== 'object' || data === null) return false
      const obj = data as Record<string, unknown>
      return 'reddit' in obj || 'thematic_forums' in obj || 'general_forums' in obj
    }

    // Determine how to render based on output type
    let content: React.ReactNode

    // First, try to parse JSON if output is a string
    // LLM outputs often have JSON embedded in text or markdown code blocks
    let parsedOutput = output
    if (typeof output === 'string') {
      const trimmed = output.trim()

      // Try multiple patterns to extract JSON
      let jsonToParse: string | null = null

      // Pattern 1: Direct JSON object
      if (trimmed.startsWith('{')) {
        const match = trimmed.match(/^\{[\s\S]*\}/)
        if (match) jsonToParse = match[0]
      }

      // Pattern 2: JSON in markdown code block (```json ... ```)
      if (!jsonToParse) {
        const codeBlockMatch = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
        if (codeBlockMatch) jsonToParse = codeBlockMatch[1]
      }

      // Pattern 3: JSON object anywhere in the text
      if (!jsonToParse) {
        const anyJsonMatch = trimmed.match(/\{[\s\S]*\}/)
        if (anyJsonMatch) jsonToParse = anyJsonMatch[0]
      }

      // Try to parse if we found something
      if (jsonToParse) {
        try {
          parsedOutput = JSON.parse(jsonToParse)
        } catch {
          // Keep as string if parsing fails
          console.log('[WorkArea] Failed to parse JSON from output:', jsonToParse.substring(0, 100))
        }
      }
    }

    if (typeof parsedOutput === 'string') {
      // String output: render as markdown
      content = (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{parsedOutput}</ReactMarkdown>
        </div>
      )
    } else if (isSourcesConfig(parsedOutput)) {
      // Sources config: render user-friendly view
      content = renderSourcesConfig(parsedOutput as Record<string, unknown>)
    } else if (Array.isArray(parsedOutput)) {
      // Array: render as list
      content = (
        <ul className="space-y-1">
          {parsedOutput.map((item, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-blue-500 mt-1">•</span>
              <span>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
            </li>
          ))}
        </ul>
      )
    } else {
      // Fallback: show JSON but with better formatting
      content = (
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
          {JSON.stringify(parsedOutput, null, 2)}
        </pre>
      )
    }

    return (
      <div className="relative">
        <button
          onClick={handleCopy}
          title="Copiar al portapapeles"
          className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded z-10"
        >
          {copied ? <CheckCheck size={16} className="text-green-600" /> : <Copy size={16} />}
        </button>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 overflow-auto max-h-80">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-green-700">
        <Check className="w-5 h-5" />
        <span className="font-medium">Completado</span>
      </div>

      {/* Show selected items for suggestion steps */}
      {renderSuggestionSummary()}

      {/* Show output for auto steps */}
      {renderAutoOutput()}

      <div className="flex gap-2">
        {/* Botón Editar - solo para pasos editables (no auto ni display) */}
        {onEdit && !['auto', 'auto_with_preview', 'auto_with_review', 'display'].includes(step.type) && (
          <button
            onClick={onEdit}
            className="flex-1 px-4 py-2.5 bg-amber-50 text-amber-700 rounded-lg font-medium hover:bg-amber-100 border border-amber-200 flex items-center justify-center gap-2 transition-colors"
          >
            <Edit3 size={16} />
            Editar
          </button>
        )}
        {/* Botón Re-ejecutar - solo para pasos auto */}
        {onRerun && (
          <button
            onClick={onRerun}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} />
            Re-ejecutar
          </button>
        )}
        <button
          onClick={onContinue}
          className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          Continuar
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// Main WorkArea component

// Props extendidas para soportar manual_research y LLM suggestion generation
interface ExtendedWorkAreaProps extends WorkAreaProps {
  previousStepOutput?: string // Output del paso anterior para manual_research
  projectId?: string
  playbookContext?: {
    product?: string
    target?: string
    context_type?: string
    life_contexts?: string[]
    [key: string]: unknown
  }
}

export default function WorkArea({
  step,
  stepState,
  onContinue,
  onBack,
  onExecute,
  onUpdateState,
  onEdit,
  onCancel,
  onRerunPrevious,
  isFirst,
  isLast,
  previousStepOutput,
  projectId,
  playbookContext,
}: ExtendedWorkAreaProps) {
  // Render based on step status and type
  const renderContent = () => {
    // Error state takes precedence
    if (stepState.status === 'error') {
      return <ErrorState step={step} stepState={stepState} onRetry={() => onExecute()} />
    }

    // In progress for auto steps
    if (stepState.status === 'in_progress' && ['auto', 'auto_with_preview', 'auto_with_review'].includes(step.type)) {
      return <AutoExecutingStep step={step} stepState={stepState} onCancel={onCancel} />
    }

    // SPECIAL HANDLING: New unified step types for simplified flow

    // search_with_preview: Shows config preview with editing, then executes SERP
    if (step.type === 'search_with_preview' && stepState.status !== 'completed') {
      const isExecuting = stepState.status === 'in_progress'
      const config = {
        life_contexts: (playbookContext?.life_contexts as string[]) || [],
        product_words: (playbookContext?.need_words as string[]) || [],
        indicators: (playbookContext?.indicators as string[]) || [],
        sources: (playbookContext?.sources as { reddit: boolean; thematic_forums: boolean; general_forums: string[] }) || {
          reddit: true,
          thematic_forums: false,
          general_forums: [],
        },
        serp_pages: (playbookContext?.serp_pages as number) || 5,
      }

      return (
        <SearchWithPreviewPanel
          config={config}
          onExecute={async (finalConfig) => {
            // Save the edited config and start execution
            onUpdateState({
              status: 'in_progress',
              startedAt: new Date(),
              input: finalConfig,
            })
            await onExecute(finalConfig)
          }}
          onBack={onBack}
          onCancel={onCancel}
          isExecuting={isExecuting}
          progress={stepState.progress}
        />
      )
    }

    // review_with_action: Shows URLs for review, then executes scraping
    if (step.type === 'review_with_action' && stepState.status !== 'completed') {
      const isExecuting = stepState.status === 'in_progress'
      const jobId = playbookContext?.serpJobId as string

      if (jobId || isExecuting) {
        return (
          <ReviewAndScrapePanel
            jobId={jobId}
            onExecute={async (selectedUrls) => {
              onUpdateState({
                status: 'in_progress',
                startedAt: new Date(),
                input: { selectedUrls },
              })
              await onExecute({ selectedUrls })
            }}
            onBack={onBack}
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
          thematic_forums: false,
          general_forums: [],
        },
        serp_pages: (playbookContext?.serp_pages as number) || 5,
      }

      return (
        <QueryPreviewPanel
          config={config}
          onApprove={() => {
            onUpdateState({ status: 'completed', completedAt: new Date() })
            onContinue()
          }}
          onAdjust={onBack}
        />
      )
    }

    // SERP Results Panel - shows after SERP completes, before scraping (legacy)
    if (step.id === 'review_urls' && stepState.status !== 'completed') {
      const jobId = playbookContext?.serpJobId as string
      if (jobId) {
        return (
          <SerpResultsPanel
            jobId={jobId}
            onContinue={(selectedSources) => {
              onUpdateState({
                status: 'completed',
                completedAt: new Date(),
                output: { selectedSources }
              })
              onContinue()
            }}
            onBack={onBack}
          />
        )
      }
    }

    // Completed state
    if (stepState.status === 'completed') {
      return (
        <CompletedStep
          step={step}
          stepState={stepState}
          onContinue={onContinue}
          onRerun={['auto', 'auto_with_preview', 'auto_with_review'].includes(step.type) ? () => onExecute() : undefined}
          onEdit={onEdit}
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
            onBack={onBack}
            onRerunPrevious={onRerunPrevious}
          />
        )

      case 'display':
        return (
          <DisplayStep
            step={step}
            stepState={stepState}
            onContinue={onContinue}
          />
        )

      case 'input':
        return (
          <InputStep
            step={step}
            stepState={stepState}
            onUpdateState={onUpdateState}
            onContinue={onContinue}
          />
        )

      case 'manual_research':
        return (
          <DeepResearchManualStep
            step={step}
            stepState={stepState}
            onContinue={onContinue}
            onUpdateState={onUpdateState}
            previousStepOutput={previousStepOutput}
            projectId={projectId || ''}
          />
        )

      case 'manual_review':
        // For generic manual_review steps without custom panels
        return <PendingStep step={step} onExecute={() => onContinue()} />

      case 'search_with_preview':
      case 'review_with_action':
        // These are handled above with special components
        // If we get here, show a pending state
        return <PendingStep step={step} onExecute={() => onExecute()} />

      case 'auto':
      case 'auto_with_preview':
      case 'auto_with_review':
      default:
        return <PendingStep step={step} onExecute={() => onExecute()} />
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">{step.name}</h2>
        {step.description && stepState.status !== 'completed' && (
          <p className="text-sm text-gray-500 mt-1">{step.description}</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {renderContent()}
      </div>

      {/* Footer navigation */}
      <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
        <button
          onClick={onBack}
          disabled={isFirst}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <ChevronLeft size={16} />
          Atrás
        </button>

        {isLast && stepState.status === 'completed' && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1">
            <Check size={16} />
            Playbook completado
          </span>
        )}
      </div>
    </div>
  )
}
