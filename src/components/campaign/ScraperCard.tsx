'use client'

import { useState } from 'react'
import {
  Loader2,
  Check,
  AlertCircle,
  Globe,
  MessageSquare,
  Star,
  Briefcase,
  Play,
  Youtube,
  Facebook,
  MapPin,
  Smartphone,
  Newspaper,
  Search,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { ScraperType } from '@/types/scraper.types'
import { SCRAPER_TEMPLATES } from '@/lib/scraperTemplates'
import {
  SCRAPER_DESCRIPTIONS,
  SCRAPER_COLORS,
  getScraperColors,
  SCRAPER_ICON_TYPES,
  ScraperIconType,
} from '@/lib/scraperConstants'
import {
  SCRAPER_FIELD_SCHEMAS,
  FieldSchema,
  validateField,
} from '@/lib/scraperFieldSchemas'

// ============================================
// TYPES
// ============================================

export type ScraperCardStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface ScraperCardProps {
  scraperType: ScraperType
  status: ScraperCardStatus
  inputConfig: Record<string, unknown>
  existingDocument?: {
    id: string
    name: string
    created_at: string
  }
  error?: string
  jobStatus?: string // For showing intermediate states like "processing"
  onInputChange: (key: string, value: unknown) => void
  onExecute: () => void
  onReExecute?: () => void
  onViewDocument?: (documentId: string) => void
  disabled?: boolean
  compact?: boolean // Compact mode for grid view
}

// ============================================
// ICON COMPONENT
// ============================================

interface ScraperIconProps {
  type: ScraperIconType
  size?: number
  className?: string
}

function ScraperIcon({ type, size = 20, className }: ScraperIconProps) {
  const props = { size, className }

  switch (type) {
    case 'globe':
      return <Globe {...props} />
    case 'star':
      return <Star {...props} />
    case 'message':
      return <MessageSquare {...props} />
    case 'play':
      return <Play {...props} />
    case 'briefcase':
      return <Briefcase {...props} />
    case 'facebook':
      return <Facebook {...props} />
    case 'youtube':
      return <Youtube {...props} />
    case 'smartphone':
      return <Smartphone {...props} />
    case 'map-pin':
      return <MapPin {...props} />
    case 'newspaper':
      return <Newspaper {...props} />
    case 'search':
      return <Search {...props} />
    default:
      return <Globe {...props} />
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ScraperCard({
  scraperType,
  status,
  inputConfig,
  existingDocument,
  error,
  jobStatus,
  onInputChange,
  onExecute,
  onReExecute,
  onViewDocument,
  disabled = false,
  compact = false,
}: ScraperCardProps) {
  const [isExpanded, setIsExpanded] = useState(!compact)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const template = SCRAPER_TEMPLATES[scraperType]
  const colors = getScraperColors(scraperType)
  const iconType = SCRAPER_ICON_TYPES[scraperType] || 'globe'
  const description = SCRAPER_DESCRIPTIONS[scraperType] || template?.description || ''
  const fieldSchemas = SCRAPER_FIELD_SCHEMAS[scraperType]?.fields

  // Handle field change with validation
  const handleFieldChange = (key: string, value: unknown) => {
    onInputChange(key, value)

    // Validate field
    if (fieldSchemas?.[key]) {
      const validationResult = validateField(scraperType, key, value)
      setFieldErrors((prev) => ({
        ...prev,
        [key]: validationResult.error || '',
      }))
    }
  }

  // Render input field based on schema
  const renderInputField = (key: string, fieldSchema: FieldSchema) => {
    const error = fieldErrors[key]
    const baseInputClasses =
      'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400'

    switch (fieldSchema.type) {
      case 'select':
        return (
          <div key={key} className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              {fieldSchema.label}
              {fieldSchema.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <select
              value={(inputConfig[key] as string) || (fieldSchema.defaultValue as string) || ''}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              className={baseInputClasses}
              disabled={disabled || status === 'running'}
            >
              {fieldSchema.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )

      case 'number':
        return (
          <div key={key} className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              {fieldSchema.label}
              {fieldSchema.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input
              type="number"
              value={(inputConfig[key] as number) ?? fieldSchema.defaultValue ?? ''}
              onChange={(e) => handleFieldChange(key, parseInt(e.target.value) || 0)}
              min={fieldSchema.validation?.min}
              max={fieldSchema.validation?.max}
              className={baseInputClasses}
              disabled={disabled || status === 'running'}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )

      case 'url':
      case 'text':
        return (
          <div key={key} className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              {fieldSchema.label}
              {fieldSchema.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input
              type={fieldSchema.type === 'url' ? 'url' : 'text'}
              value={(inputConfig[key] as string) || ''}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              placeholder={fieldSchema.placeholder}
              className={baseInputClasses}
              disabled={disabled || status === 'running'}
            />
            {fieldSchema.helpText && (
              <p className="text-xs text-gray-500">{fieldSchema.helpText}</p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )

      case 'url-array':
      case 'text-array':
        const arrayValue = inputConfig[key]
        const displayValue = Array.isArray(arrayValue)
          ? arrayValue.join('\n')
          : typeof arrayValue === 'string'
            ? arrayValue
            : ''
        return (
          <div key={key} className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              {fieldSchema.label}
              {fieldSchema.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <textarea
              value={displayValue}
              onChange={(e) => {
                const values = e.target.value
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean)
                handleFieldChange(key, values.length > 0 ? values : e.target.value)
              }}
              rows={2}
              placeholder={fieldSchema.placeholder}
              className={baseInputClasses}
              disabled={disabled || status === 'running'}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )

      default:
        return (
          <div key={key} className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              {fieldSchema.label}
              {fieldSchema.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input
              type="text"
              value={(inputConfig[key] as string) || ''}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              placeholder={fieldSchema.placeholder}
              className={baseInputClasses}
              disabled={disabled || status === 'running'}
            />
          </div>
        )
    }
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  // ============================================
  // RENDER STATES
  // ============================================

  // Running state
  if (status === 'running') {
    return (
      <div
        className={`border-2 border-blue-400 bg-blue-50 rounded-xl p-4 transition-all animate-pulse`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-blue-100`}>
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-gray-900 truncate">
              {template?.name || scraperType}
            </h4>
            <p className="text-xs text-blue-700">Extrayendo datos...</p>
          </div>
        </div>
        {jobStatus && jobStatus !== 'pending' && (
          <div className="mt-3 flex items-center gap-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
              Estado: {jobStatus}
            </span>
          </div>
        )}
      </div>
    )
  }

  // Completed state
  if (status === 'completed' && existingDocument) {
    return (
      <div className={`border-2 border-green-200 bg-green-50 rounded-xl p-4 transition-all`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-green-100`}>
            <Check className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-gray-900 truncate">
              {template?.name || scraperType}
            </h4>
            <p className="text-xs text-green-700">
              Generado {formatDate(existingDocument.created_at)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {onViewDocument && (
            <button
              onClick={() => onViewDocument(existingDocument.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-green-200 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
            >
              <ExternalLink size={14} />
              Ver documento
            </button>
          )}
          {onReExecute && (
            <button
              onClick={onReExecute}
              disabled={disabled}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} />
              Re-ejecutar
            </button>
          )}
        </div>
      </div>
    )
  }

  // Error state
  if (status === 'failed') {
    return (
      <div className={`border-2 border-red-200 bg-red-50 rounded-xl p-4 transition-all`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-red-100`}>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-gray-900 truncate">
              {template?.name || scraperType}
            </h4>
            <p className="text-xs text-red-600 line-clamp-2">{error || 'Error en la extraccion'}</p>
          </div>
        </div>
        <div className="mt-3">
          <button
            onClick={onExecute}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} />
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // Pending state (default)
  return (
    <div
      className={`border-2 ${colors.border} ${colors.bg} rounded-xl p-4 transition-all hover:shadow-md`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => compact && setIsExpanded(!isExpanded)}
      >
        <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>
          <ScraperIcon type={iconType} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-gray-900 truncate">
            {template?.name || scraperType}
          </h4>
          {!isExpanded && (
            <p className="text-xs text-gray-500 truncate">{description}</p>
          )}
        </div>
        {compact && (
          <button className="p-1 text-gray-400 hover:text-gray-600">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Description */}
          <p className="text-xs text-gray-600">{description}</p>

          {/* Input fields */}
          {fieldSchemas && (
            <div className="space-y-2">
              {template?.inputSchema.required.map((key) => {
                const schema = fieldSchemas[key]
                if (schema) return renderInputField(key, schema)
                return null
              })}
            </div>
          )}

          {/* Execute button */}
          <button
            onClick={onExecute}
            disabled={disabled}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Play size={16} />
            Ejecutar
          </button>
        </div>
      )}
    </div>
  )
}
