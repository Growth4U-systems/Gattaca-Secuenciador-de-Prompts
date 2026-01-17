'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Search, Loader2, Check, AlertCircle, Globe, MessageSquare, Star, Briefcase, Play, Tag, ArrowLeft, HelpCircle, Info, Youtube, Facebook, MapPin, Smartphone, Clock, Eye, ChevronDown, ChevronRight, CheckSquare, Square, Newspaper } from 'lucide-react'
import { ScraperType, ScraperTemplate, ScraperOutputFormat, ScraperOutputConfig } from '@/types/scraper.types'
import { SCRAPER_TEMPLATES } from '@/lib/scraperTemplates'
import { DocCategory } from '@/types/database.types'
import { SCRAPER_FIELD_SCHEMAS, FieldSchema, validateField, validateAllFields } from '@/lib/scraperFieldSchemas'

// Scraper status: 'enabled' = working, 'pending' = not tested yet
type ScraperStatus = 'enabled' | 'pending'

interface ScraperConfig {
  type: ScraperType
  status: ScraperStatus
  category: 'social' | 'reviews' | 'web' | 'seo' | 'other'
}

// All scrapers with their status
const ALL_SCRAPERS: ScraperConfig[] = [
  // Social Media
  { type: 'instagram_posts_comments', status: 'enabled', category: 'social' },
  { type: 'tiktok_posts', status: 'enabled', category: 'social' },
  { type: 'tiktok_comments', status: 'enabled', category: 'social' },
  { type: 'linkedin_company_posts', status: 'enabled', category: 'social' },
  { type: 'linkedin_comments', status: 'enabled', category: 'social' },
  { type: 'linkedin_company_profile', status: 'enabled', category: 'social' },
  { type: 'reddit_posts', status: 'enabled', category: 'social' },
  // linkedin_company_insights: disabled - requires paid Apify subscription
  { type: 'facebook_posts', status: 'enabled', category: 'social' },
  { type: 'facebook_comments', status: 'enabled', category: 'social' },
  { type: 'youtube_channel_videos', status: 'enabled', category: 'social' },
  { type: 'youtube_comments', status: 'enabled', category: 'social' },
  { type: 'youtube_transcripts', status: 'enabled', category: 'social' },

  // Reviews
  { type: 'trustpilot_reviews', status: 'enabled', category: 'reviews' },
  { type: 'g2_reviews', status: 'enabled', category: 'reviews' },
  { type: 'capterra_reviews', status: 'enabled', category: 'reviews' },
  { type: 'appstore_reviews', status: 'enabled', category: 'reviews' },
  { type: 'playstore_reviews', status: 'enabled', category: 'reviews' },
  { type: 'google_maps_reviews', status: 'enabled', category: 'reviews' },

  // Web & News
  { type: 'website', status: 'enabled', category: 'web' },
  { type: 'google_news', status: 'enabled', category: 'web' },
  { type: 'news_bing', status: 'enabled', category: 'web' },

  // SEO & Keywords (Mangools)
  { type: 'seo_keywords', status: 'enabled', category: 'seo' },
  { type: 'seo_serp_checker', status: 'enabled', category: 'seo' },
  { type: 'seo_site_profiler', status: 'enabled', category: 'seo' },
  { type: 'seo_link_miner', status: 'enabled', category: 'seo' },
  { type: 'seo_competitor_keywords', status: 'enabled', category: 'seo' },
]

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  social: 'Redes Sociales',
  reviews: 'Reviews',
  web: 'Web & Noticias',
  seo: 'SEO & Keywords',
  other: 'Otros',
}

interface ScraperLauncherProps {
  projectId: string
  onComplete: () => void
  onClose: () => void
}

type StepType = 'select' | 'configure' | 'running' | 'completed' | 'error'

const SCRAPER_ICONS: Record<string, React.ReactNode> = {
  website: <Globe size={20} />,
  trustpilot_reviews: <Star size={20} />,
  instagram_posts_comments: <MessageSquare size={20} />,
  tiktok_posts: <Play size={20} />,
  tiktok_comments: <MessageSquare size={20} />,
  linkedin_company_posts: <Briefcase size={20} />,
  linkedin_comments: <MessageSquare size={20} />,
  linkedin_company_insights: <Briefcase size={20} />,
  linkedin_company_profile: <Briefcase size={20} />,
  facebook_posts: <Facebook size={20} />,
  facebook_comments: <MessageSquare size={20} />,
  reddit_posts: <MessageSquare size={20} />,
  youtube_channel_videos: <Youtube size={20} />,
  youtube_comments: <MessageSquare size={20} />,
  youtube_transcripts: <Youtube size={20} />,
  g2_reviews: <Star size={20} />,
  capterra_reviews: <Star size={20} />,
  appstore_reviews: <Smartphone size={20} />,
  playstore_reviews: <Smartphone size={20} />,
  google_maps_reviews: <MapPin size={20} />,
  google_news: <Newspaper size={20} />,
  news_bing: <Newspaper size={20} />,
  seo_keywords: <Search size={20} />,
  seo_serp_checker: <Search size={20} />,
  seo_site_profiler: <Globe size={20} />,
  seo_link_miner: <Globe size={20} />,
  seo_competitor_keywords: <Search size={20} />,
}

// Detailed descriptions for each scraper (shown on hover and in configure step)
const SCRAPER_DESCRIPTIONS: Record<string, string> = {
  // Social Media
  instagram_posts_comments: 'Extrae posts y comentarios de perfiles de Instagram. Obtiene imágenes, likes, texto y engagement.',
  tiktok_posts: 'Obtiene videos de perfiles de TikTok con métricas de views, likes, shares y descripción.',
  tiktok_comments: 'Extrae comentarios de videos específicos de TikTok con autor, likes y respuestas.',
  linkedin_company_posts: 'Scrape publicaciones de páginas de empresa en LinkedIn con contenido, reacciones y comentarios.',
  linkedin_comments: 'Extrae comentarios de posts específicos de LinkedIn con autor y engagement.',
  linkedin_company_insights: 'Obtiene insights y métricas de páginas de empresa en LinkedIn.',
  linkedin_company_profile: 'Perfil completo de empresa: empleados, followers, headquarters, especialidades. $8/1000 resultados.',
  facebook_posts: 'Extrae publicaciones de páginas de Facebook con texto, imágenes y reacciones.',
  facebook_comments: 'Obtiene comentarios de posts de Facebook con autor y respuestas.',
  reddit_posts: 'Busca posts y comentarios en subreddits o búsquedas. Pay-per-use: $0.002/item (1000 gratis/mes).',

  // YouTube
  youtube_channel_videos: 'Lista de videos de canales de YouTube con título, descripción, views y likes.',
  youtube_comments: 'Extrae comentarios de videos de YouTube ordenados por relevancia o fecha.',
  youtube_transcripts: 'Obtiene transcripciones/subtítulos de videos de YouTube con timestamps.',

  // Reviews
  trustpilot_reviews: 'Reviews de empresas en Trustpilot con rating, título, texto completo y fecha.',
  g2_reviews: 'Reviews de software B2B en G2 con pros, contras y ratings detallados. Mínimo 200 reviews.',
  capterra_reviews: 'Reviews de software en Capterra con calificaciones por categoría y recomendaciones.',
  appstore_reviews: 'Reviews de apps en Apple App Store con rating, versión de la app y país.',
  playstore_reviews: 'Reviews de apps en Google Play Store con rating, versión y tipo de dispositivo.',
  google_maps_reviews: 'Reviews de negocios locales en Google Maps con rating, texto y fotos del reviewer.',

  // Web & News
  website: 'Extrae contenido de páginas web. Modo scrape (1 página) o crawl (múltiples páginas del sitio).',
  google_news: 'Busca noticias recientes en Google News por keywords, empresa o tema específico.',
  news_bing: 'Busca noticias en Bing News con filtros avanzados de fecha, idioma y relevancia.',
  seo_keywords: 'An\u00e1lisis de keywords SEO con volumen de b\u00fasqueda, dificultad y competencia (KWFinder).',
  seo_serp_checker: 'An\u00e1lisis de SERPs con m\u00e9tricas SEO: DA, PA, CF, TF, backlinks y posiciones.',
  seo_site_profiler: 'Perfil completo de dominio: autoridad, backlinks, tr\u00e1fico estimado y competidores.',
  seo_link_miner: 'An\u00e1lisis de backlinks: encuentra enlaces entrantes con m\u00e9tricas de calidad.',
  seo_competitor_keywords: 'Descubre keywords org\u00e1nicas de competidores con vol\u00famenes y posiciones.',
}

const SCRAPER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Social
  instagram_posts_comments: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
  tiktok_posts: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  tiktok_comments: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  linkedin_company_posts: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' },
  linkedin_comments: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' },
  linkedin_company_insights: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' },
  linkedin_company_profile: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' },
  facebook_posts: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  facebook_comments: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  reddit_posts: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  youtube_channel_videos: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  youtube_comments: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  youtube_transcripts: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  // Reviews
  trustpilot_reviews: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
  g2_reviews: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  capterra_reviews: { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200' },
  appstore_reviews: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  playstore_reviews: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  google_maps_reviews: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  // Web & News
  website: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
  google_news: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  news_bing: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200' },
  // SEO & Keywords
  seo_keywords: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200' },
  seo_serp_checker: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200' },
  seo_site_profiler: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  seo_link_miner: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', border: 'border-fuchsia-200' },
  seo_competitor_keywords: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200' },
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

  // Output format configuration
  const [outputFormat, setOutputFormat] = useState<ScraperOutputFormat>('json')
  const [selectedFields, setSelectedFields] = useState<string[]>([])  // Empty = all fields
  const [availableFields, setAvailableFields] = useState<string[]>([])

  // URL Preview state (for crawl mode)
  const [showPreview, setShowPreview] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState<{
    total: number
    filtered: number
    included: string[]
    excluded: string[]
    sections: Record<string, string[]>
  } | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  // Get selected template
  const template = selectedScraper ? SCRAPER_TEMPLATES[selectedScraper] : null

  // Load URL preview for crawl mode
  const loadPreview = useCallback(async () => {
    if (!inputConfig.url) {
      setPreviewError('Ingresa una URL primero')
      return
    }

    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewData(null)

    try {
      const response = await fetch('/api/scraper/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: inputConfig.url,
          includePaths: inputConfig.includePaths,
          excludePaths: inputConfig.excludePaths,
          limit: inputConfig.limit || 200,
        }),
      })

      const data = await response.json()

      if (data.success && data.urls) {
        setPreviewData(data.urls)
        // Select all filtered URLs by default
        setSelectedUrls(new Set(data.urls.included))
        // Expand first 3 sections by default
        const sectionsToExpand = Object.keys(data.urls.sections).slice(0, 3)
        setExpandedSections(new Set(sectionsToExpand))
        setShowPreview(true)
      } else {
        setPreviewError(data.error || 'Error al obtener el preview')
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Error de conexión')
    } finally {
      setPreviewLoading(false)
    }
  }, [inputConfig.url, inputConfig.includePaths, inputConfig.excludePaths, inputConfig.limit])

  // Toggle URL selection
  const toggleUrlSelection = (url: string) => {
    setSelectedUrls(prev => {
      const newSet = new Set(prev)
      if (newSet.has(url)) {
        newSet.delete(url)
      } else {
        newSet.add(url)
      }
      return newSet
    })
  }

  // Toggle section selection (all URLs in section)
  const toggleSectionSelection = (sectionUrls: string[]) => {
    setSelectedUrls(prev => {
      const newSet = new Set(prev)
      const allSelected = sectionUrls.every(url => newSet.has(url))
      if (allSelected) {
        sectionUrls.forEach(url => newSet.delete(url))
      } else {
        sectionUrls.forEach(url => newSet.add(url))
      }
      return newSet
    })
  }

  // Toggle section expansion
  const toggleSectionExpansion = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

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
        tiktok_comments: 'TikTok',
        linkedin_company_posts: 'LinkedIn',
        linkedin_comments: 'LinkedIn',
        linkedin_company_insights: 'LinkedIn',
        linkedin_company_profile: 'LinkedIn',
        facebook_posts: 'Facebook',
        facebook_comments: 'Facebook',
        youtube_channel_videos: 'YouTube',
        youtube_comments: 'YouTube',
        youtube_transcripts: 'YouTube',
        g2_reviews: 'G2',
        capterra_reviews: 'Capterra',
        appstore_reviews: 'AppStore',
        playstore_reviews: 'PlayStore',
        google_maps_reviews: 'GoogleMaps',
        news_bing: 'News',
        seo_keywords: 'SEO',
        seo_serp_checker: 'SEO',
        seo_site_profiler: 'SEO',
        seo_link_miner: 'SEO',
        seo_competitor_keywords: 'SEO',
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
    let errorCount = 0
    const maxErrors = 3

    const interval = setInterval(async () => {
      try {
        // Use /poll endpoint which actively checks Apify status and updates the DB
        const response = await fetch(`/api/scraper/poll?jobId=${jobId}`)
        const data = await response.json()

        // Handle HTTP errors
        if (!response.ok) {
          console.error('[polling] HTTP error:', response.status, data.error)
          errorCount++
          if (errorCount >= maxErrors) {
            clearInterval(interval)
            setError(data.error || `Error del servidor: ${response.status}`)
            setCurrentStep('error')
          }
          return
        }

        // Reset error count on successful response
        errorCount = 0

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
        console.error('[polling] Error:', err)
        errorCount++
        if (errorCount >= maxErrors) {
          clearInterval(interval)
          setError('Error de conexión al verificar el estado')
          setCurrentStep('error')
        }
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
      // Build output config
      const outputConfig: ScraperOutputConfig = {
        format: outputFormat,
        fields: selectedFields.length > 0 ? selectedFields : undefined,
        flatten: outputFormat === 'csv',
      }

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
          output_config: outputConfig,
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
            <div className="space-y-6">
              <p className="text-sm text-gray-600">
                Extrae información de redes sociales, reviews y páginas web para usarla en tus análisis.
              </p>

              {/* Group scrapers by category */}
              {(['social', 'reviews', 'web', 'seo', 'other'] as const).map(category => {
                const categoryScrapers = ALL_SCRAPERS.filter(s => s.category === category)
                if (categoryScrapers.length === 0) return null

                return (
                  <div key={category}>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      {CATEGORY_LABELS[category]}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {categoryScrapers.map(({ type, status }) => {
                        const scraper = SCRAPER_TEMPLATES[type]
                        const colors = SCRAPER_COLORS[type] || { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' }
                        const isEnabled = status === 'enabled'

                        return (
                          <button
                            key={type}
                            onClick={() => isEnabled && handleSelectScraper(type)}
                            disabled={!isEnabled}
                            className={`relative flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                              isEnabled
                                ? `${colors.border} ${colors.bg} hover:shadow-md cursor-pointer group`
                                : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                            }`}
                          >
                            {/* Pending overlay */}
                            {!isEnabled && (
                              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-10">
                                <span className="flex items-center gap-1 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded-full border border-gray-200">
                                  <Clock size={12} />
                                  Pendiente
                                </span>
                              </div>
                            )}

                            <div className={`p-2 rounded-lg ${isEnabled ? colors.bg : 'bg-gray-100'} ${isEnabled ? colors.text : 'text-gray-400'} ${isEnabled ? 'group-hover:scale-110' : ''} transition-transform`}>
                              {SCRAPER_ICONS[type] || <Globe size={20} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className={`font-medium text-sm truncate ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                                  {scraper?.name || type}
                                </h4>
                                {isEnabled && (
                                  <span className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full" title="Activo" />
                                )}
                              </div>
                              <p
                                className={`text-xs line-clamp-2 ${isEnabled ? 'text-gray-500' : 'text-gray-400'}`}
                                title={SCRAPER_DESCRIPTIONS[type] || scraper?.description || ''}
                              >
                                {SCRAPER_DESCRIPTIONS[type] || scraper?.description || ''}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
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
                {selectedScraper && SCRAPER_DESCRIPTIONS[selectedScraper] && (
                  <p className="text-xs text-gray-500 -mt-2 pb-2 border-b border-gray-100">
                    {SCRAPER_DESCRIPTIONS[selectedScraper]}
                  </p>
                )}

                {/* Required fields */}
                {template.inputSchema.required.map((key) => renderInputField(key, true))}

                {/* For website scraper, show mode selector and conditional fields */}
                {selectedScraper === 'website' && (
                  <>
                    {/* Mode selector */}
                    {renderInputField('mode', false)}

                    {/* Crawl-specific fields - only show when mode is 'crawl' */}
                    {inputConfig.mode === 'crawl' && (
                      <div className="space-y-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                          <Globe size={16} />
                          Configuración del Crawl
                        </div>
                        <p className="text-xs text-blue-600">
                          El crawler navegará el sitio y extraerá múltiples páginas. Usa los filtros para enfocarte en secciones específicas.
                        </p>
                        {renderInputField('limit', false)}
                        {renderInputField('maxDepth', false)}
                        {renderInputField('includePaths', false)}
                        {renderInputField('excludePaths', false)}

                        {/* Preview Button */}
                        <div className="pt-2 border-t border-blue-100">
                          <button
                            type="button"
                            onClick={loadPreview}
                            disabled={!inputConfig.url || previewLoading}
                            className="w-full px-4 py-2.5 bg-white border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors"
                          >
                            {previewLoading ? (
                              <>
                                <Loader2 size={16} className="animate-spin" />
                                Cargando preview...
                              </>
                            ) : (
                              <>
                                <Eye size={16} />
                                Ver URLs que se van a extraer
                              </>
                            )}
                          </button>
                          {previewError && (
                            <p className="text-xs text-red-600 mt-2">{previewError}</p>
                          )}
                        </div>

                        {/* URL Preview Panel */}
                        {showPreview && previewData && (
                          <div className="mt-4 bg-white rounded-lg border border-blue-200 overflow-hidden">
                            {/* Preview Header */}
                            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Eye size={16} className="text-blue-600" />
                                  <span className="text-sm font-medium text-blue-800">
                                    Preview de URLs
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowPreview(false)}
                                  className="p-1 hover:bg-blue-100 rounded text-blue-600"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-xs">
                                <span className="text-blue-600">
                                  Total descubiertas: <strong>{previewData.total}</strong>
                                </span>
                                <span className="text-green-600">
                                  Incluidas: <strong>{previewData.filtered}</strong>
                                </span>
                                <span className="text-gray-500">
                                  Excluidas: <strong>{previewData.excluded.length}</strong>
                                </span>
                                <span className="text-indigo-600">
                                  Seleccionadas: <strong>{selectedUrls.size}</strong>
                                </span>
                              </div>
                            </div>

                            {/* Sections list */}
                            <div className="max-h-64 overflow-y-auto">
                              {Object.entries(previewData.sections).map(([section, urls]) => {
                                const sectionSelected = urls.filter(url => selectedUrls.has(url)).length
                                const isExpanded = expandedSections.has(section)
                                const allSelected = urls.every(url => selectedUrls.has(url))

                                return (
                                  <div key={section} className="border-b border-gray-100 last:border-b-0">
                                    {/* Section Header */}
                                    <div
                                      className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                                      onClick={() => toggleSectionExpansion(section)}
                                    >
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleSectionSelection(urls)
                                        }}
                                        className="text-blue-600 hover:text-blue-800"
                                      >
                                        {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                      </button>
                                      {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                                      <span className="text-sm font-medium text-gray-700">/{section}</span>
                                      <span className="text-xs text-gray-400">
                                        ({sectionSelected}/{urls.length})
                                      </span>
                                    </div>

                                    {/* Section URLs */}
                                    {isExpanded && (
                                      <div className="px-4 py-2 space-y-1">
                                        {urls.map((url) => {
                                          const isSelected = selectedUrls.has(url)
                                          const displayUrl = url.replace(/^https?:\/\/[^/]+/, '')
                                          return (
                                            <label
                                              key={url}
                                              className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${
                                                isSelected
                                                  ? 'bg-green-50 text-green-700'
                                                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                              }`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleUrlSelection(url)}
                                                className="w-3.5 h-3.5 text-green-600 rounded border-gray-300"
                                              />
                                              <span className="truncate font-mono" title={url}>
                                                {displayUrl || '/'}
                                              </span>
                                            </label>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>

                            {/* Preview Footer */}
                            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedUrls(new Set(previewData.included))}
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                  Seleccionar todas
                                </button>
                                <span className="text-gray-300">|</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedUrls(new Set())}
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                  Deseleccionar todas
                                </button>
                              </div>
                              <span className="text-xs text-gray-500">
                                Se extraerán {selectedUrls.size} páginas
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Map mode info */}
                    {inputConfig.mode === 'map' && (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                        <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-2">
                          <Search size={16} />
                          Modo Mapa de URLs
                        </div>
                        <p className="text-xs text-amber-700">
                          Descubre todas las URLs del sitio sin extraer contenido. Útil para planificar qué páginas scrapear después.
                        </p>
                        {renderInputField('limit', false)}
                      </div>
                    )}
                  </>
                )}

                {/* Optional fields (collapsed by default) - exclude website-specific fields already shown */}
                {template.inputSchema.optional.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 font-medium">
                      Opciones avanzadas ({selectedScraper === 'website'
                        ? template.inputSchema.optional.filter(k => !['mode', 'limit', 'maxDepth', 'includePaths', 'excludePaths'].includes(k)).length
                        : template.inputSchema.optional.length})
                    </summary>
                    <div className="mt-3 space-y-4 pl-4 border-l-2 border-gray-100">
                      {template.inputSchema.optional
                        .filter(key => selectedScraper !== 'website' || !['mode', 'limit', 'maxDepth', 'includePaths', 'excludePaths'].includes(key))
                        .map((key) => renderInputField(key, false))}
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

              {/* Output Format - Apify style */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Formato de salida
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { value: 'json', label: 'JSON', desc: 'Datos estructurados' },
                    { value: 'jsonl', label: 'JSONL', desc: 'Una línea por item' },
                    { value: 'csv', label: 'CSV', desc: 'Tabla para Excel' },
                    { value: 'markdown', label: 'Markdown', desc: 'Texto legible' },
                    { value: 'xml', label: 'XML', desc: 'Formato XML' },
                  ].map((format) => (
                    <button
                      key={format.value}
                      type="button"
                      onClick={() => setOutputFormat(format.value as ScraperOutputFormat)}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        outputFormat === format.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-sm">{format.label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{format.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Field selector for CSV/JSON */}
                {(outputFormat === 'csv' || outputFormat === 'json') && template?.outputFields && template.outputFields.length > 0 && (
                  <div className="mt-3">
                    <label className="block text-xs text-gray-500 mb-2">
                      Campos a incluir (dejar vacío = todos)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {template.outputFields.map((field) => (
                        <button
                          key={field}
                          type="button"
                          onClick={() => {
                            if (selectedFields.includes(field)) {
                              setSelectedFields(selectedFields.filter(f => f !== field))
                            } else {
                              setSelectedFields([...selectedFields, field])
                            }
                          }}
                          className={`px-2 py-1 rounded text-xs transition-all ${
                            selectedFields.includes(field)
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                          }`}
                        >
                          {field}
                        </button>
                      ))}
                    </div>
                    {selectedFields.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedFields([])}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                      >
                        Limpiar selección (usar todos)
                      </button>
                    )}
                  </div>
                )}
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
