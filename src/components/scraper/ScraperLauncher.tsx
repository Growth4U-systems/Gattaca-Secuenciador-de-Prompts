'use client'

import { useState, useEffect } from 'react'
import { X, Search, Loader2, Check, AlertCircle, Globe, MessageSquare, Star, Briefcase, Play, Tag, ArrowLeft, HelpCircle, Info } from 'lucide-react'
import { ScraperType, ScraperTemplate } from '@/types/scraper.types'
import { SCRAPER_TEMPLATES } from '@/lib/scraperTemplates'
import { DocCategory } from '@/types/database.types'
import { SCRAPER_FIELD_SCHEMAS, FieldSchema, validateField, validateAllFields } from '@/lib/scraperFieldSchemas'

// Top 5 scrapers for Phase 1
const ENABLED_SCRAPERS: ScraperType[] = [
  'website',
  'trustpilot_reviews',
  'instagram_posts_comments',
  'tiktok_posts',
  'linkedin_company_posts',
]

interface ScraperLauncherProps {
  projectId: string
  onComplete: () => void
  onClose: () => void
}

type StepType = 'select' | 'configure' | 'running' | 'completed' | 'error'

const SCRAPER_ICONS: Record<string, React.ReactNode> = {
  website: <Globe size={24} />,
  trustpilot_reviews: <Star size={24} />,
  instagram_posts_comments: <MessageSquare size={24} />,
  tiktok_posts: <Play size={24} />,
  linkedin_company_posts: <Briefcase size={24} />,
}

const SCRAPER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  website: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  trustpilot_reviews: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
  instagram_posts_comments: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
  tiktok_posts: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  linkedin_company_posts: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' },
}

export default function ScraperLauncher({ projectId, onComplete, onClose }: ScraperLauncherProps) {
  const [currentStep, setCurrentStep] = useState<StepType>('select')
  const [selectedScraper, setSelectedScraper] = useState<ScraperType | null>(null)
  const [targetName, setTargetName] = useState('')
  const [inputConfig, setInputConfig] = useState<Record<string, unknown>>({})
  const [category, setCategory] = useState<DocCategory>('research')
  const [tags, setTags] = useState<string[]>([])
  const [customTag, setCustomTag] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string>('pending')
  const [error, setError] = useState<string | null>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [showExamples, setShowExamples] = useState<string | null>(null)

  // Get selected template
  const template = selectedScraper ? SCRAPER_TEMPLATES[selectedScraper] : null

  // Generate auto tags when scraper and target name change
  useEffect(() => {
    if (selectedScraper && targetName) {
      const today = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '-')

      const sourceNames: Record<string, string> = {
        website: 'Website',
        trustpilot_reviews: 'Trustpilot',
        instagram_posts_comments: 'Instagram',
        tiktok_posts: 'TikTok',
        linkedin_company_posts: 'LinkedIn',
      }

      const sourceName = sourceNames[selectedScraper] || selectedScraper
      const autoTags = [
        targetName,
        sourceName,
        today,
      ]
      setTags(autoTags)
    }
  }, [selectedScraper, targetName])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  // Poll for job status - uses /api/scraper/poll which checks Apify status and updates DB
  const startPolling = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        // Use /poll endpoint which actively checks Apify status and updates the DB
        const response = await fetch(`/api/scraper/poll?jobId=${jobId}`)
        const data = await response.json()

        if (data.status) {
          setJobStatus(data.status)

          if (data.completed) {
            clearInterval(interval)
            if (data.status === 'completed') {
              setCurrentStep('completed')
            } else if (data.status === 'failed') {
              setError(data.error || 'El scraper falló')
              setCurrentStep('error')
            }
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err)
      }
    }, 5000) // Poll every 5 seconds (Apify runs take time)

    setPollingInterval(interval)
  }

  // Handle scraper selection
  const handleSelectScraper = (type: ScraperType) => {
    setSelectedScraper(type)
    setCurrentStep('configure')

    // Set default category based on scraper
    const template = SCRAPER_TEMPLATES[type]
    if (template.category === 'reviews' || template.category === 'social') {
      setCategory('competitor')
    } else {
      setCategory('research')
    }
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedScraper || !targetName) return

    // Validate all fields before submission
    const validation = validateAllFields(selectedScraper, inputConfig)
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      // Show first error
      const firstError = Object.values(validation.errors)[0]
      setError(`Por favor corrige los errores: ${firstError}`)
      return
    }

    setCurrentStep('running')
    setError(null)
    setFieldErrors({})

    try {
      const response = await fetch('/api/scraper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          scraper_type: selectedScraper,
          input_config: inputConfig,
          target_name: targetName,
          target_category: category,
          tags,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setJobId(data.job_id)

        // For sync scrapers (firecrawl), it completes immediately
        if (data.completed) {
          setCurrentStep('completed')
        } else {
          // For async scrapers (apify), start polling
          startPolling(data.job_id)
        }
      } else {
        throw new Error(data.error || 'Error al iniciar el scraper')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setCurrentStep('error')
    }
  }

  // Add custom tag
  const handleAddTag = () => {
    if (customTag.trim() && !tags.includes(customTag.trim())) {
      setTags([...tags, customTag.trim()])
      setCustomTag('')
    }
  }

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove))
  }

  // Get field schema for current scraper
  const getFieldSchema = (key: string): FieldSchema | undefined => {
    if (!selectedScraper) return undefined
    return SCRAPER_FIELD_SCHEMAS[selectedScraper]?.fields[key]
  }

  // Validate a single field and update errors
  const handleFieldChange = (key: string, value: unknown) => {
    setInputConfig({ ...inputConfig, [key]: value })

    // Validate field
    if (selectedScraper) {
      const result = validateField(selectedScraper, key, value)
      if (!result.valid && result.error) {
        setFieldErrors(prev => ({ ...prev, [key]: result.error! }))
      } else {
        setFieldErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors[key]
          return newErrors
        })
      }
    }
  }

  // Render examples tooltip
  const renderExamples = (fieldSchema: FieldSchema) => {
    if (!fieldSchema.examples || fieldSchema.examples.length === 0) return null

    return (
      <div className="relative inline-block ml-2">
        <button
          type="button"
          onClick={() => setShowExamples(showExamples === fieldSchema.key ? null : fieldSchema.key)}
          className="text-gray-400 hover:text-blue-500 transition-colors"
          title="Ver ejemplos"
        >
          <HelpCircle size={16} />
        </button>
        {showExamples === fieldSchema.key && (
          <div className="absolute left-0 top-6 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[280px]">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700">
              <Info size={14} className="text-blue-500" />
              Ejemplos v\u00e1lidos:
            </div>
            <ul className="space-y-1">
              {fieldSchema.examples.map((example, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => {
                      handleFieldChange(fieldSchema.key, example)
                      setShowExamples(null)
                    }}
                    className="text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded w-full text-left font-mono truncate"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // Render input field based on schema type
  const renderInputField = (key: string, isRequired: boolean) => {
    const fieldSchema = getFieldSchema(key)
    const defaultValue = template?.inputSchema.defaults[key]
    const error = fieldErrors[key]

    // If no schema, fall back to basic rendering based on default value type
    if (!fieldSchema) {
      // Boolean
      if (typeof defaultValue === 'boolean' || key.toLowerCase().includes('include')) {
        return (
          <label key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
            <input
              type="checkbox"
              checked={inputConfig[key] as boolean ?? defaultValue ?? false}
              onChange={(e) => handleFieldChange(key, e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{key}</span>
          </label>
        )
      }

      // Number
      if (typeof defaultValue === 'number') {
        return (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{key}</label>
            <input
              type="number"
              value={inputConfig[key] as number ?? defaultValue}
              onChange={(e) => handleFieldChange(key, parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
        )
      }

      // Default text
      return (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {key} {isRequired && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            value={inputConfig[key] as string || ''}
            onChange={(e) => handleFieldChange(key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>
      )
    }

    // Render based on field schema type
    const baseInputClasses = `w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 ${
      error ? 'border-red-300 bg-red-50' : 'border-gray-200'
    }`

    switch (fieldSchema.type) {
      case 'boolean':
        return (
          <label key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
            <input
              type="checkbox"
              checked={inputConfig[key] as boolean ?? fieldSchema.defaultValue ?? false}
              onChange={(e) => handleFieldChange(key, e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm text-gray-700 font-medium">{fieldSchema.label}</span>
              {fieldSchema.description && (
                <p className="text-xs text-gray-500">{fieldSchema.description}</p>
              )}
            </div>
          </label>
        )

      case 'select':
        return (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {fieldSchema.label}
              {fieldSchema.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {fieldSchema.description && (
              <p className="text-xs text-gray-500 mb-2">{fieldSchema.description}</p>
            )}
            <select
              value={inputConfig[key] as string ?? fieldSchema.defaultValue ?? ''}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              className={`${baseInputClasses} bg-white`}
            >
              <option value="">Seleccionar...</option>
              {fieldSchema.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}{opt.description ? ` - ${opt.description}` : ''}
                </option>
              ))}
            </select>
            {fieldSchema.helpText && (
              <p className="text-xs text-gray-500 mt-1">{fieldSchema.helpText}</p>
            )}
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        )

      case 'multi-select':
        const selectedValues = (inputConfig[key] as string[]) ?? (fieldSchema.defaultValue as string[]) ?? []
        return (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {fieldSchema.label}
              {fieldSchema.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {fieldSchema.description && (
              <p className="text-xs text-gray-500 mb-2">{fieldSchema.description}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {fieldSchema.options?.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${
                    selectedValues.includes(opt.value)
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(opt.value)}
                    onChange={(e) => {
                      const newValues = e.target.checked
                        ? [...selectedValues, opt.value]
                        : selectedValues.filter(v => v !== opt.value)
                      handleFieldChange(key, newValues)
                    }}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700">{opt.label}</span>
                    {opt.description && (
                      <p className="text-xs text-gray-400 truncate">{opt.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            {fieldSchema.helpText && (
              <p className="text-xs text-gray-500 mt-1">{fieldSchema.helpText}</p>
            )}
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        )

      case 'number':
        return (
          <div key={key}>
            <div className="flex items-center mb-1.5">
              <label className="text-sm font-medium text-gray-700">
                {fieldSchema.label}
                {fieldSchema.required && <span className="text-red-500 ml-1">*</span>}
              </label>
            </div>
            {fieldSchema.description && (
              <p className="text-xs text-gray-500 mb-2">{fieldSchema.description}</p>
            )}
            <input
              type="number"
              value={inputConfig[key] as number ?? fieldSchema.defaultValue ?? ''}
              onChange={(e) => handleFieldChange(key, parseInt(e.target.value) || 0)}
              min={fieldSchema.validation?.min}
              max={fieldSchema.validation?.max}
              className={baseInputClasses}
            />
            {fieldSchema.helpText && (
              <p className="text-xs text-gray-500 mt-1">{fieldSchema.helpText}</p>
            )}
            {fieldSchema.validation && (fieldSchema.validation.min !== undefined || fieldSchema.validation.max !== undefined) && (
              <p className="text-xs text-gray-400 mt-1">
                Rango: {fieldSchema.validation.min ?? 0} - {fieldSchema.validation.max ?? '\u221e'}
              </p>
            )}
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        )

      case 'url':
      case 'text':
        return (
          <div key={key}>
            <div className="flex items-center mb-1.5">
              <label className="text-sm font-medium text-gray-700">
                {fieldSchema.label}
                {fieldSchema.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {renderExamples(fieldSchema)}
            </div>
            {fieldSchema.description && (
              <p className="text-xs text-gray-500 mb-2">{fieldSchema.description}</p>
            )}
            <input
              type={fieldSchema.type === 'url' ? 'url' : 'text'}
              value={inputConfig[key] as string || ''}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              placeholder={fieldSchema.placeholder}
              className={baseInputClasses}
            />
            {fieldSchema.helpText && (
              <p className="text-xs text-gray-500 mt-1">{fieldSchema.helpText}</p>
            )}
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        )

      case 'url-array':
      case 'text-array':
        const arrayValue = inputConfig[key]
        const displayValue = Array.isArray(arrayValue)
          ? arrayValue.join('\n')
          : (typeof arrayValue === 'string' ? arrayValue : '')
        return (
          <div key={key}>
            <div className="flex items-center mb-1.5">
              <label className="text-sm font-medium text-gray-700">
                {fieldSchema.label}
                {fieldSchema.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {renderExamples(fieldSchema)}
            </div>
            {fieldSchema.description && (
              <p className="text-xs text-gray-500 mb-2">{fieldSchema.description}</p>
            )}
            <textarea
              value={displayValue}
              onChange={(e) => {
                const values = e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
                handleFieldChange(key, values.length > 0 ? values : e.target.value)
              }}
              rows={3}
              placeholder={fieldSchema.placeholder}
              className={baseInputClasses}
            />
            {fieldSchema.helpText && (
              <p className="text-xs text-gray-500 mt-1">{fieldSchema.helpText}</p>
            )}
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        )

      case 'date':
        return (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {fieldSchema.label}
              {fieldSchema.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {fieldSchema.description && (
              <p className="text-xs text-gray-500 mb-2">{fieldSchema.description}</p>
            )}
            <input
              type="date"
              value={inputConfig[key] as string || ''}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              className={baseInputClasses}
            />
            {fieldSchema.helpText && (
              <p className="text-xs text-gray-500 mt-1">{fieldSchema.helpText}</p>
            )}
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        )

      default:
        return (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {fieldSchema.label}
              {fieldSchema.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={inputConfig[key] as string || ''}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              placeholder={fieldSchema.placeholder}
              className={baseInputClasses}
            />
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 px-6 py-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentStep !== 'select' && currentStep !== 'completed' && (
                <button
                  onClick={() => {
                    if (currentStep === 'configure') {
                      setSelectedScraper(null)
                      setCurrentStep('select')
                    }
                  }}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div className="p-2.5 bg-white/10 backdrop-blur rounded-xl">
                <Search className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Importar datos externos</h2>
                <p className="text-blue-100 text-sm">
                  {currentStep === 'select' && 'Selecciona una fuente de datos'}
                  {currentStep === 'configure' && template?.name}
                  {currentStep === 'running' && 'Extrayendo datos...'}
                  {currentStep === 'completed' && 'Extracción completada'}
                  {currentStep === 'error' && 'Error en la extracción'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Select Scraper */}
          {currentStep === 'select' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Extrae información de redes sociales, reviews y páginas web para usarla en tus análisis.
              </p>
              <div className="grid grid-cols-1 gap-3">
                {ENABLED_SCRAPERS.map((type) => {
                  const scraper = SCRAPER_TEMPLATES[type]
                  const colors = SCRAPER_COLORS[type]
                  return (
                    <button
                      key={type}
                      onClick={() => handleSelectScraper(type)}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 ${colors.border} ${colors.bg} hover:shadow-md transition-all text-left group`}
                    >
                      <div className={`p-3 rounded-lg ${colors.bg} ${colors.text} group-hover:scale-110 transition-transform`}>
                        {SCRAPER_ICONS[type]}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{scraper.name}</h3>
                        <p className="text-sm text-gray-500">{scraper.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {currentStep === 'configure' && template && (
            <div className="space-y-5">
              {/* Target Name (always required) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Empresa / Marca <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="Ej: Revolut, Sumup, N26..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                />
                <p className="text-xs text-gray-500 mt-1">Se usará para nombrar y etiquetar el documento</p>
              </div>

              {/* Scraper-specific inputs */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900">Configuración de {template.name}</h4>

                {/* Required fields */}
                {template.inputSchema.required.map((key) => renderInputField(key, true))}

                {/* Optional fields (collapsed by default) */}
                {template.inputSchema.optional.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 font-medium">
                      Opciones avanzadas ({template.inputSchema.optional.length})
                    </summary>
                    <div className="mt-3 space-y-4 pl-4 border-l-2 border-gray-100">
                      {template.inputSchema.optional.map((key) => renderInputField(key, false))}
                    </div>
                  </details>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Categoría
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DocCategory)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="research">Research</option>
                  <option value="competitor">Competitor</option>
                  <option value="product">Product</option>
                  <option value="output">Output</option>
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tags automáticos
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                    >
                      <Tag size={14} />
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 p-0.5 hover:bg-blue-100 rounded-full"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Añadir tag personalizado"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!customTag.trim()}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50"
                  >
                    Añadir
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Running */}
          {currentStep === 'running' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Extrayendo datos...</h3>
              <p className="text-sm text-gray-500 text-center">
                {template?.provider === 'firecrawl'
                  ? 'Esto tomará unos segundos'
                  : 'Esto puede tomar varios minutos. Puedes cerrar esta ventana y el documento aparecerá cuando esté listo.'}
              </p>
              {jobStatus && jobStatus !== 'pending' && (
                <span className="mt-4 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                  Estado: {jobStatus}
                </span>
              )}
            </div>
          )}

          {/* Step 4: Completed */}
          {currentStep === 'completed' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Extracción completada</h3>
              <p className="text-sm text-gray-500 text-center mb-4">
                El documento ha sido guardado en tu Context Lake con el nombre y tags configurados.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 w-full max-w-sm">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Documento:</span> {template?.name} - {targetName}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Error */}
          {currentStep === 'error' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error en la extracción</h3>
              <p className="text-sm text-red-600 text-center mb-4">{error}</p>
              <button
                onClick={() => setCurrentStep('configure')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Volver a intentar
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
          {currentStep === 'select' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancelar
            </button>
          )}

          {currentStep === 'configure' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!targetName || template?.inputSchema.required.some(
                  (key) => !inputConfig[key] && key !== 'url' // url can come from target
                )}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                <Search size={18} />
                Extraer datos
              </button>
            </>
          )}

          {currentStep === 'running' && (
            <button
              onClick={() => {
                if (pollingInterval) clearInterval(pollingInterval)
                onClose()
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Ejecutar en segundo plano
            </button>
          )}

          {(currentStep === 'completed' || currentStep === 'error') && (
            <button
              onClick={() => {
                onComplete()
                onClose()
              }}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
