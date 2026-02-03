'use client'

/**
 * ScraperInputsForm Component
 *
 * Simple form to collect main scraper inputs during campaign creation (Step 3).
 * Does NOT execute any scrapers - only collects URLs/usernames for later use.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Globe,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Music2,
  Info,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

export interface ScraperInputsFormProps {
  competitorName: string
  initialValues: Record<string, string>
  onChange: (values: Record<string, string>) => void
}

interface InputFieldConfig {
  key: string
  label: string
  placeholder: string
  icon: React.ReactNode
  type: 'url' | 'text'
  helpText?: string
}

// ============================================
// INPUT FIELD CONFIGURATIONS
// ============================================

const MAIN_INPUTS: InputFieldConfig[] = [
  {
    key: 'website_url',
    label: 'URL del sitio web',
    placeholder: 'https://competitor.com',
    icon: <Globe size={18} />,
    type: 'url',
    helpText: 'Pagina principal del competidor',
  },
  {
    key: 'instagram_username',
    label: 'Usuario de Instagram',
    placeholder: 'competitor',
    icon: <Instagram size={18} />,
    type: 'text',
    helpText: 'Sin el @ (ej: "revolut" no "@revolut")',
  },
  {
    key: 'facebook_url',
    label: 'URL de Facebook',
    placeholder: 'https://facebook.com/competitor',
    icon: <Facebook size={18} />,
    type: 'url',
    helpText: 'Pagina de Facebook del competidor',
  },
  {
    key: 'linkedin_url',
    label: 'URL de LinkedIn',
    placeholder: 'https://linkedin.com/company/competitor',
    icon: <Linkedin size={18} />,
    type: 'url',
    helpText: 'Pagina de empresa en LinkedIn',
  },
  {
    key: 'youtube_url',
    label: 'URL de YouTube',
    placeholder: 'https://youtube.com/@competitor',
    icon: <Youtube size={18} />,
    type: 'url',
    helpText: 'Canal de YouTube del competidor',
  },
  {
    key: 'tiktok_username',
    label: 'Usuario de TikTok',
    placeholder: '@competitor',
    icon: <Music2 size={18} />,
    type: 'text',
    helpText: 'Con o sin @ (ej: "@revolut")',
  },
]

// ============================================
// MAIN COMPONENT
// ============================================

export default function ScraperInputsForm({
  competitorName,
  initialValues,
  onChange,
}: ScraperInputsFormProps) {
  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Use ref to avoid infinite loop with onChange
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Sync with parent when values change
  useEffect(() => {
    onChangeRef.current(values)
  }, [values])

  // Handle input change
  const handleInputChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))

    // Clear error when user starts typing
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: '' }))
    }
  }

  // Simple URL validation
  const validateUrl = (value: string): boolean => {
    if (!value) return true // Empty is valid (optional)
    try {
      new URL(value)
      return true
    } catch {
      return false
    }
  }

  // Handle blur for URL validation
  const handleBlur = (field: InputFieldConfig) => {
    if (field.type === 'url' && values[field.key]) {
      if (!validateUrl(values[field.key])) {
        setErrors((prev) => ({
          ...prev,
          [field.key]: 'URL invalida. Debe comenzar con https://',
        }))
      }
    }
  }

  // Replace placeholder with competitor name
  const getPlaceholder = (placeholder: string): string => {
    return placeholder.replace(/competitor/g, competitorName.toLowerCase().replace(/\s+/g, ''))
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Configura las fuentes principales</p>
          <p className="text-blue-600">
            Estos datos se usaran para extraer informacion del competidor.
            Podras agregar mas fuentes (reviews, SEO, etc.) despues de crear la campana.
            Todos los campos son opcionales.
          </p>
        </div>
      </div>

      {/* Input fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MAIN_INPUTS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <span className="text-gray-400">{field.icon}</span>
              {field.label}
            </label>
            <input
              type={field.type === 'url' ? 'url' : 'text'}
              value={values[field.key] || ''}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              onBlur={() => handleBlur(field)}
              placeholder={getPlaceholder(field.placeholder)}
              className={`w-full px-3 py-2.5 border rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 ${
                errors[field.key]
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            />
            {errors[field.key] ? (
              <p className="text-xs text-red-600">{errors[field.key]}</p>
            ) : field.helpText ? (
              <p className="text-xs text-gray-500">{field.helpText}</p>
            ) : null}
          </div>
        ))}
      </div>

      {/* Summary of what will happen */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Despues de crear la campana podras:
        </h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
            Ejecutar scrapers para extraer datos de cada fuente
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
            Agregar fuentes adicionales (reviews, noticias, SEO)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
            Modificar cualquier URL antes de ejecutar
          </li>
        </ul>
      </div>
    </div>
  )
}
