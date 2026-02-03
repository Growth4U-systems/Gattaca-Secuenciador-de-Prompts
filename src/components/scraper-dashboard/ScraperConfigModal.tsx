'use client'

/**
 * ScraperConfigModal Component
 *
 * Modal to configure all scraper inputs for a competitor.
 * Groups inputs by category for better organization.
 */

import { useState, useEffect } from 'react'
import {
  X,
  Save,
  Loader2,
  Globe,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Music2,
  Star,
  Search,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { useToast } from '@/components/ui'
import { SCRAPER_INPUT_MAPPINGS } from '@/lib/playbooks/competitor-analysis/constants'

// ============================================
// TYPES
// ============================================

interface CompetitorCampaign {
  id: string
  ecp_name: string
  custom_variables: Record<string, string>
}

interface ScraperConfigModalProps {
  campaign: CompetitorCampaign
  projectId: string
  onClose: () => void
  onSaved: () => void
}

// Input field type
interface InputField {
  key: string
  label: string
  placeholder: string
  type: 'url' | 'text'
  icon?: typeof Globe
}

interface InputCategory {
  category: string
  icon: typeof Globe
  fields: InputField[]
}

// Input field configurations
const INPUT_FIELDS: InputCategory[] = [
  {
    category: 'Web & SEO',
    icon: Globe,
    fields: [
      { key: 'competitor_website', label: 'Sitio Web', placeholder: 'https://competitor.com', type: 'url', icon: Globe },
    ],
  },
  {
    category: 'Redes Sociales',
    icon: Instagram,
    fields: [
      { key: 'instagram_username', label: 'Instagram', placeholder: 'username (sin @)', type: 'text', icon: Instagram },
      { key: 'facebook_url', label: 'Facebook', placeholder: 'https://facebook.com/page', type: 'url', icon: Facebook },
      { key: 'linkedin_url', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/...', type: 'url', icon: Linkedin },
      { key: 'youtube_url', label: 'YouTube', placeholder: 'https://youtube.com/@channel', type: 'url', icon: Youtube },
      { key: 'tiktok_username', label: 'TikTok', placeholder: '@username', type: 'text', icon: Music2 },
    ],
  },
  {
    category: 'Plataformas de Reviews',
    icon: Star,
    fields: [
      { key: 'trustpilot_url', label: 'Trustpilot', placeholder: 'https://trustpilot.com/review/...', type: 'url', icon: Star },
      { key: 'g2_url', label: 'G2', placeholder: 'https://g2.com/products/...', type: 'url', icon: Star },
      { key: 'capterra_url', label: 'Capterra', placeholder: 'https://capterra.com/p/...', type: 'url', icon: Star },
      { key: 'play_store_app_id', label: 'Play Store App ID', placeholder: 'com.company.app', type: 'text', icon: Star },
      { key: 'app_store_app_id', label: 'App Store App ID', placeholder: '123456789', type: 'text', icon: Star },
    ],
  },
]

// ============================================
// MAIN COMPONENT
// ============================================

export default function ScraperConfigModal({
  campaign,
  projectId,
  onClose,
  onSaved,
}: ScraperConfigModalProps) {
  const toast = useToast()

  const [values, setValues] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Initialize values from campaign
  useEffect(() => {
    setValues(campaign.custom_variables || {})
  }, [campaign])

  // Handle input change
  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }))
    // Clear error when user starts typing
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  // Validate URL
  const validateUrl = (url: string): boolean => {
    if (!url) return true // Empty is valid (optional)
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`)
      return true
    } catch {
      return false
    }
  }

  // Handle save
  const handleSave = async () => {
    // Validate URLs
    const newErrors: Record<string, string> = {}
    INPUT_FIELDS.forEach(category => {
      category.fields.forEach(field => {
        if (field.type === 'url' && values[field.key] && !validateUrl(values[field.key])) {
          newErrors[field.key] = 'URL inválida'
        }
      })
    })

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error('Error', 'Hay campos con errores')
      return
    }

    setIsSaving(true)

    try {
      // Update campaign custom_variables
      const response = await fetch(`/api/campaign/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_variables: {
            ...campaign.custom_variables,
            ...values,
          },
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        let errorMsg = `Error HTTP ${response.status}`
        try {
          const errorData = JSON.parse(text)
          errorMsg = errorData.error || errorMsg
        } catch {
          // Use default error message
        }
        throw new Error(errorMsg)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al guardar')
      }

      onSaved()
    } catch (error) {
      console.error('Error saving config:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error de red')
    } finally {
      setIsSaving(false)
    }
  }

  // Count configured vs total fields
  const configuredCount = INPUT_FIELDS.flatMap(c => c.fields)
    .filter(f => !!values[f.key]?.trim()).length
  const totalCount = INPUT_FIELDS.flatMap(c => c.fields).length

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Configurar Scrapers
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {campaign.ecp_name} · {configuredCount}/{totalCount} configurados
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Configura los datos de cada plataforma</p>
              <p className="text-blue-600">
                Los campos vacíos serán ignorados. Solo ejecutarás scrapers para las plataformas configuradas.
              </p>
            </div>
          </div>

          {/* Input categories */}
          {INPUT_FIELDS.map(category => {
            const CategoryIcon = category.icon
            const categoryConfigured = category.fields.filter(f => !!values[f.key]?.trim()).length

            return (
              <div key={category.category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <CategoryIcon size={18} className="text-gray-400" />
                  <h3 className="font-medium text-gray-700">{category.category}</h3>
                  <span className="text-xs text-gray-400">
                    ({categoryConfigured}/{category.fields.length})
                  </span>
                </div>

                <div className="grid gap-3">
                  {category.fields.map(field => {
                    const FieldIcon = field.icon || CategoryIcon
                    const hasValue = !!values[field.key]?.trim()
                    const hasError = !!errors[field.key]

                    return (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">
                          {field.label}
                        </label>
                        <div className="relative">
                          <FieldIcon
                            size={16}
                            className={`absolute left-3 top-1/2 -translate-y-1/2 ${
                              hasError ? 'text-red-400' : hasValue ? 'text-green-500' : 'text-gray-400'
                            }`}
                          />
                          <input
                            type={field.type}
                            value={values[field.key] || ''}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className={`w-full pl-10 pr-10 py-2.5 border rounded-lg text-sm transition-colors
                              ${hasError
                                ? 'border-red-300 bg-red-50 focus:ring-red-500'
                                : hasValue
                                  ? 'border-green-200 bg-green-50 focus:ring-green-500'
                                  : 'border-gray-200 focus:ring-indigo-500'
                              }
                              focus:ring-2 focus:border-transparent
                            `}
                          />
                          {hasValue && !hasError && (
                            <CheckCircle
                              size={16}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
                            />
                          )}
                        </div>
                        {hasError && (
                          <p className="text-xs text-red-600 mt-1">{errors[field.key]}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50">
          <div className="text-sm text-gray-500">
            {configuredCount === 0 ? (
              <span className="text-amber-600">Ningún campo configurado</span>
            ) : (
              <span className="text-green-600">{configuredCount} campo(s) configurados</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Guardar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
