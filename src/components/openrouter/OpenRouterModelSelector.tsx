'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useOpenRouter } from '@/lib/openrouter-context'
import { ChevronDown, Loader2, Search, Zap, DollarSign, AlertCircle } from 'lucide-react'

interface Model {
  id: string
  name: string
  provider: string
  contextLength: number
  maxOutputTokens: number
  pricing: {
    input: number
    output: number
  }
  description?: string
}

interface OpenRouterModelSelectorProps {
  value: string
  onChange: (modelId: string) => void
  disabled?: boolean
  className?: string
}

export default function OpenRouterModelSelector({
  value,
  onChange,
  disabled = false,
  className = '',
}: OpenRouterModelSelectorProps) {
  const { isConnected, isLoading: contextLoading } = useOpenRouter()
  const [models, setModels] = useState<Model[]>([])
  const [groupedModels, setGroupedModels] = useState<Record<string, Model[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Fetch models when connected
  useEffect(() => {
    if (!isConnected) {
      setModels([])
      setGroupedModels({})
      return
    }

    const fetchModels = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/openrouter/models')
        if (!response.ok) throw new Error('Failed to fetch models')

        const data = await response.json()
        setModels(data.models || [])
        setGroupedModels(data.grouped || {})
      } catch (err) {
        setError('Error al cargar modelos')
        console.error('Error fetching models:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchModels()
  }, [isConnected])

  // Filter models by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedModels

    const query = searchQuery.toLowerCase()
    const filtered: Record<string, Model[]> = {}

    for (const [provider, providerModels] of Object.entries(groupedModels)) {
      const matches = providerModels.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query) ||
          provider.toLowerCase().includes(query)
      )
      if (matches.length > 0) {
        filtered[provider] = matches
      }
    }

    return filtered
  }, [groupedModels, searchQuery])

  // Get selected model info
  const selectedModel = models.find((m) => m.id === value)

  // Calculate dropdown position when opening
  const openDropdown = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 320),
      })
    }
    setIsOpen(true)
  }

  // Format price for display
  const formatPrice = (price: number) => {
    if (price === 0) return 'Gratis'
    if (price < 0.01) return `$${price.toFixed(4)}`
    if (price < 1) return `$${price.toFixed(2)}`
    return `$${price.toFixed(0)}`
  }

  if (contextLoading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Cargando...</span>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg ${className}`}>
        <AlertCircle className="w-4 h-4 text-amber-600" />
        <span className="text-sm text-amber-700">Conecta OpenRouter para ver modelos</span>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && (isOpen ? setIsOpen(false) : openDropdown())}
        disabled={disabled || loading}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-500">Cargando modelos...</span>
            </>
          ) : selectedModel ? (
            <>
              <span className="text-xs font-medium px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded flex-shrink-0">
                {selectedModel.provider}
              </span>
              <span className="text-sm font-medium text-gray-900 truncate">
                {selectedModel.name}
              </span>
            </>
          ) : value ? (
            <span className="text-sm text-gray-700 truncate">{value}</span>
          ) : (
            <span className="text-sm text-gray-500">Seleccionar modelo...</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[99]"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content - Fixed position to escape modal overflow */}
          <div
            className="fixed z-[100] max-h-[400px] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
          >
            {/* Search */}
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar modelo..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400"
                  autoFocus
                />
              </div>
            </div>

            {/* Models List */}
            <div className="overflow-y-auto max-h-[340px]">
              {error ? (
                <div className="px-3 py-4 text-center text-sm text-red-600">
                  {error}
                </div>
              ) : Object.keys(filteredGroups).length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-gray-500">
                  {searchQuery ? 'No se encontraron modelos' : 'No hay modelos disponibles'}
                </div>
              ) : (
                Object.entries(filteredGroups).map(([provider, providerModels]) => (
                  <div key={provider}>
                    {/* Provider Header */}
                    <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {provider}
                      </span>
                    </div>

                    {/* Provider Models */}
                    {providerModels.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          onChange(model.id)
                          setIsOpen(false)
                          setSearchQuery('')
                        }}
                        className={`w-full px-3 py-2 text-left hover:bg-indigo-50 transition-colors ${
                          value === model.id ? 'bg-indigo-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-medium ${value === model.id ? 'text-indigo-700' : 'text-gray-900'}`}>
                            {model.name}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Context Length */}
                            <span className="flex items-center gap-0.5 text-xs text-gray-500" title="Contexto">
                              <Zap className="w-3 h-3" />
                              {model.contextLength >= 1000000
                                ? `${(model.contextLength / 1000000).toFixed(1)}M`
                                : `${Math.round(model.contextLength / 1000)}K`}
                            </span>
                            {/* Pricing */}
                            <span className="flex items-center gap-0.5 text-xs text-gray-500" title="Precio por 1M tokens">
                              <DollarSign className="w-3 h-3" />
                              {formatPrice(model.pricing.input)}
                            </span>
                          </div>
                        </div>
                        {model.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                            {model.description}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
