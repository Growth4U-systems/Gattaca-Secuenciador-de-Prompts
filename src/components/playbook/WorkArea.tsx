'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { WorkAreaProps, StepDefinition, StepState } from './types'
import DeepResearchManualStep from './steps/DeepResearchManualStep'
import { getDefaultPrompt } from './utils/getDefaultPrompts'
import { B2C_CONTEXTS, B2B_CONTEXTS } from './configs/niche-finder.config'

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

  // Load fixed options based on context_type
  useEffect(() => {
    const loadFixedOptions = () => {
      if (config?.generateFrom !== 'fixed') return
      if (suggestions.length > 0) return // Already loaded

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
    }

    loadFixedOptions()
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
}

function AutoExecutingStep({ step, stepState }: AutoExecutingStepProps) {
  const progress = stepState.progress

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

      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
        <p className="text-sm text-blue-700">
          El sistema continuará automáticamente cuando termine este paso.
        </p>
      </div>
    </div>
  )
}

interface DecisionStepProps {
  step: StepDefinition
  stepState: StepState
  onUpdateState: (update: Partial<StepState>) => void
  onContinue: () => void
}

function DecisionStep({ step, stepState, onUpdateState, onContinue }: DecisionStepProps) {
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
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full mt-4 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        Confirmar selección
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

interface PendingStepProps {
  step: StepDefinition
  onExecute: () => void
}

function PendingStep({ step, onExecute }: PendingStepProps) {
  const isAutoStep = ['auto', 'auto_with_preview', 'auto_with_review'].includes(step.type)

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
}

function CompletedStep({ step, stepState, onContinue, onRerun }: CompletedStepProps) {
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
      <div className="flex items-center gap-2 text-green-700">
        <Check className="w-5 h-5" />
        <span className="font-medium">Completado</span>
      </div>

      {output && (
        <div className="relative">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded z-10"
          >
            {copied ? <CheckCheck size={16} className="text-green-600" /> : <Copy size={16} />}
          </button>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 overflow-auto max-h-64">
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

      <div className="flex gap-2">
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
      return <AutoExecutingStep step={step} stepState={stepState} />
    }

    // Completed state
    if (stepState.status === 'completed') {
      return (
        <CompletedStep
          step={step}
          stepState={stepState}
          onContinue={onContinue}
          onRerun={['auto', 'auto_with_preview', 'auto_with_review'].includes(step.type) ? () => onExecute() : undefined}
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
