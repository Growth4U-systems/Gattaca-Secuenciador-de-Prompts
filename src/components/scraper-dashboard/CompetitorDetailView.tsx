'use client'

/**
 * CompetitorDetailView Component
 *
 * Detailed view for a single competitor showing:
 * - Scraper configuration and execution
 * - Analysis flow steps with execution
 *
 * Both sections are integrated in one view.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Globe,
  Building2,
  Settings,
  Play,
  Loader2,
  CheckCircle,
  Circle,
  Lock,
  AlertTriangle,
  Search,
  Sparkles,
  MessageSquare,
  Star,
  FileText,
  ExternalLink,
  RefreshCw,
  X,
  AlertCircle,
  Trash2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Code,
  Variable,
  Database,
  Save,
  Edit3,
  Eye,
  Copy,
} from 'lucide-react'
import {
  FaInstagram,
  FaFacebook,
  FaLinkedin,
  FaYoutube,
  FaTiktok,
  FaXTwitter,
  FaAppStoreIos,
  FaGooglePlay,
} from 'react-icons/fa6'
import { SiTrustpilot, SiG2 } from 'react-icons/si'
import { useToast } from '@/components/ui'
import {
  STEP_DOCUMENT_REQUIREMENTS,
  ALL_DOCUMENT_REQUIREMENTS,
  SCRAPER_INPUT_MAPPINGS,
  getScraperTypeForSource,
  COMPETITOR_VARIABLE_DEFINITIONS,
} from '@/lib/playbooks/competitor-analysis/constants'
import { ALL_PROMPTS } from '@/lib/playbooks/competitor-analysis/prompts'
import {
  SCRAPER_FIELD_SCHEMAS,
  getAllFieldsForScraper,
  validateAllFields,
  FieldSchema,
} from '@/lib/scraperFieldSchemas'
import type { ScraperType, ScraperOutputFormat, ScraperOutputConfig } from '@/types/scraper.types'
import { createDocumentMetadata } from '@/lib/playbooks/competitor-analysis/documentMatcher'
import { useScraperJobPersistence, PersistedJob } from '@/hooks/useScraperJobPersistence'
import type { SourceType } from '@/lib/playbooks/competitor-analysis/types'
import type { FlowStep } from '@/types/flow.types'
import { COMPETITOR_FLOW_STEPS } from '@/lib/playbooks/competitor-analysis/config'
import {
  organizeBatchesWithDependencies,
  getScraperDependency,
} from '@/lib/playbooks/competitor-analysis/scraperDependencies'
import ScraperConfigModal from './ScraperConfigModal'
import StepOutputEditor from '@/components/campaign/StepOutputEditor'
import StepEditor from '@/components/flow/StepEditor'

// ============================================
// TYPES
// ============================================

interface CompetitorCampaign {
  id: string
  ecp_name: string
  custom_variables: Record<string, string>
  created_at: string
  status: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  step_outputs?: Record<string, any>
  // flow_config contains the snapshot of playbook configuration at campaign creation
  flow_config?: {
    steps?: Array<{
      id: string
      prompt?: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any
    }>
  }
}

interface Document {
  id: string
  name?: string
  filename?: string
  extracted_content?: string
  created_at?: string
  tags?: string[]
  source_metadata?: {
    source_type?: string
    competitor?: string
  }
}

// Custom dropdown using fixed positioning to escape overflow-hidden ancestors
function DocumentSelect({
  docs,
  selectedDocId,
  onSelect,
}: {
  docs: Document[]
  selectedDocId: string | undefined
  onSelect: (docId: string) => void
}) {
  return (
    <select
      value={selectedDocId || ''}
      onChange={(e) => { e.stopPropagation(); onSelect(e.target.value) }}
      onClick={(e) => e.stopPropagation()}
      className="text-xs px-2 py-1 border border-gray-200 rounded bg-white text-gray-700 max-w-[200px] hover:border-indigo-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
    >
      <option value="">Sin documento</option>
      {docs.map(doc => (
        <option key={doc.id} value={doc.id}>
          {doc.name || doc.filename || `Doc ${doc.id.slice(0, 8)}`}
        </option>
      ))}
    </select>
  )
}

interface CompetitorDetailViewProps {
  campaign: CompetitorCampaign
  campaigns: CompetitorCampaign[]
  documents: Document[]
  projectId: string
  clientId?: string
  clientName?: string
  onBack: () => void
  onRefresh: () => void
}

// ============================================
// SCRAPER DEFAULTS
// ============================================

/**
 * Default configuration values for all scrapers.
 * These ensure every scraper has sensible defaults even if user hasn't configured them.
 */
const SCRAPER_DEFAULTS: Record<string, Record<string, string>> = {
  // Posts & Comments - 90 days, max 50 items
  'instagram_posts_comments': {
    max_posts: '50',
    max_comments_per_post: '50',
    date_from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    output_format: 'text_structured',
  },
  'tiktok_posts': {
    max_posts: '50',
    date_from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    output_format: 'text_structured',
  },
  'tiktok_comments': {
    max_comments_per_post: '50',
    output_format: 'text_structured',
  },
  'linkedin_company_posts': {
    max_posts: '50',
    date_from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    output_format: 'text_structured',
  },
  'linkedin_comments': {
    max_comments_per_post: '50',
    output_format: 'text_structured',
  },
  'youtube_channel_videos': {
    max_videos: '50',
    date_from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    output_format: 'text_structured',
  },
  'youtube_comments': {
    max_comments_per_video: '50',
    output_format: 'text_structured',
  },
  'facebook_posts': {
    max_posts: '50',
    date_from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    output_format: 'text_structured',
  },
  'facebook_comments': {
    max_comments_per_post: '50',
    output_format: 'text_structured',
  },

  // Reviews - 180 days, max 1000 items
  'trustpilot_reviews': {
    max_reviews: '1000',
    date_from: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    output_format: 'text_structured',
  },
  'g2_reviews': {
    max_reviews: '1000',
    date_from: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    output_format: 'text_structured',
  },
  'capterra_reviews': {
    max_reviews: '1000',
    date_from: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    output_format: 'text_structured',
  },
  'appstore_reviews': {
    max_reviews: '1000',
    date_from: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    output_format: 'text_structured',
  },
  'playstore_reviews': {
    max_reviews: '1000',
    date_from: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    output_format: 'text_structured',
  },
  'google_maps_reviews': {
    max_reviews: '1000',
    date_from: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    output_format: 'text_structured',
  },
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Helper function for time ago
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'hace un momento'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `hace ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours}h`
  return `hace ${Math.floor(hours / 24)}d`
}

// Analysis steps configuration with prompt keys
const ANALYSIS_STEPS: Array<{
  id: string
  name: string
  description: string
  icon: typeof Sparkles
  promptKey: keyof typeof ALL_PROMPTS
  requiredSources: string[]
  dependsOn?: string[]
}> = [
  {
    id: 'autopercepcion',
    name: 'Autopercepción',
    description: 'Cómo se presenta la marca a sí misma',
    icon: Sparkles,
    promptKey: 'autopercepcion' as const,
    requiredSources: ['deep_research', 'website', 'instagram_posts', 'facebook_posts', 'youtube_videos', 'tiktok_posts', 'linkedin_posts', 'linkedin_insights'],
  },
  {
    id: 'percepcion-terceros',
    name: 'Percepción Terceros',
    description: 'Qué dicen los medios y buscadores',
    icon: Search,
    promptKey: 'percepcionTerceros' as const,
    requiredSources: ['seo_serp', 'news_corpus'],
  },
  {
    id: 'percepcion-rrss',
    name: 'Percepción RRSS',
    description: 'Comentarios y engagement en redes sociales',
    icon: MessageSquare,
    promptKey: 'percepcionRRSS' as const,
    requiredSources: ['instagram_comments', 'facebook_comments', 'youtube_comments', 'tiktok_comments', 'linkedin_comments'],
  },
  {
    id: 'percepcion-reviews',
    name: 'Percepción Reviews',
    description: 'Opiniones en plataformas de reviews',
    icon: Star,
    promptKey: 'percepcionReviews' as const,
    requiredSources: ['trustpilot_reviews', 'g2_reviews', 'capterra_reviews', 'playstore_reviews', 'appstore_reviews'],
  },
  {
    id: 'resumen',
    name: 'Síntesis Final',
    description: 'Battle card y resumen ejecutivo',
    icon: FileText,
    promptKey: 'sintesis' as const,
    requiredSources: [],
    dependsOn: ['autopercepcion', 'percepcion-terceros', 'percepcion-rrss', 'percepcion-reviews'],
  },
]

// Helper to extract variables from prompt text
function extractPromptVariables(promptText: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g
  const matches = promptText.matchAll(regex)
  const variables = new Set<string>()
  for (const match of matches) {
    const varName = match[1].trim()
    // Skip conditional syntax and step references
    if (!varName.startsWith('#') && !varName.startsWith('/') && !varName.startsWith('step:')) {
      variables.add(varName)
    }
  }
  return Array.from(variables)
}

// Mapping from ANALYSIS_STEPS id to COMPETITOR_FLOW_STEPS id
const STEP_ID_MAPPING: Record<string, string> = {
  'autopercepcion': 'comp-step-1-autopercepcion',
  'percepcion-terceros': 'comp-step-2-percepcion-terceros',
  'percepcion-rrss': 'comp-step-3-percepcion-rrss',
  'percepcion-reviews': 'comp-step-4-percepcion-reviews',
  'resumen': 'comp-step-5-sintesis',
}

// Get FlowStep from COMPETITOR_FLOW_STEPS based on analysis step id
// Note: COMPETITOR_FLOW_STEPS uses a slightly different type definition, so we cast it
function getFlowStepForAnalysis(analysisStepId: string): FlowStep | null {
  const flowStepId = STEP_ID_MAPPING[analysisStepId]
  if (!flowStepId) return null
  const step = COMPETITOR_FLOW_STEPS.find(s => s.id === flowStepId)
  if (!step) return null
  // Cast to FlowStep from flow.types (compatible since all our steps are type: 'llm')
  return step as unknown as FlowStep
}

// Source type labels for display
const SOURCE_TYPE_LABELS: Record<string, string> = {
  deep_research: 'Deep Research',
  website: 'Website Content',
  instagram_posts: 'Instagram Posts',
  facebook_posts: 'Facebook Posts',
  youtube_videos: 'YouTube Videos',
  tiktok_posts: 'TikTok Posts',
  linkedin_posts: 'LinkedIn Posts',
  linkedin_insights: 'LinkedIn Insights',
  seo_serp: 'SEO/SERP Data',
  news_corpus: 'News Corpus',
  instagram_comments: 'Instagram Comments',
  facebook_comments: 'Facebook Comments',
  youtube_comments: 'YouTube Comments',
  tiktok_comments: 'TikTok Comments',
  linkedin_comments: 'LinkedIn Comments',
  trustpilot_reviews: 'Trustpilot Reviews',
  g2_reviews: 'G2 Reviews',
  capterra_reviews: 'Capterra Reviews',
  playstore_reviews: 'Play Store Reviews',
  appstore_reviews: 'App Store Reviews',
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CompetitorDetailView({
  campaign,
  campaigns,
  documents,
  projectId,
  clientId = '',
  clientName,
  onBack,
  onRefresh,
}: CompetitorDetailViewProps) {
  const toast = useToast()
  const router = useRouter()

  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showScraperHistory, setShowScraperHistory] = useState(false)
  const [runningSteps, setRunningSteps] = useState<Set<string>>(new Set())
  // State to force re-render for elapsed time display
  const [, setTick] = useState(0)
  // State for expanded analysis steps
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  // State for step configuration editing (inline - deprecated)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [stepVariables, setStepVariables] = useState<Record<string, string>>({})
  const [selectedDocs, setSelectedDocs] = useState<Record<string, Record<string, string>>>({})
  const [stepPrompts, setStepPrompts] = useState<Record<string, string>>({})
  const [isSavingStep, setIsSavingStep] = useState(false)
  // State for full StepEditor modal
  const [editingFlowStep, setEditingFlowStep] = useState<FlowStep | null>(null)
  // State for applying config to all competitors
  const [applyingToAll, setApplyingToAll] = useState<string | null>(null)
  // Document viewer modal state
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null)
  // Step output viewer modal state
  const [viewingStepOutput, setViewingStepOutput] = useState<{
    stepId: string
    stepName: string
    stepOrder: number
  } | null>(null)

  // Confirmation modal state - full configuration like ScraperLauncher
  const [confirmModal, setConfirmModal] = useState<{
    sourceType: string
    scraperType: ScraperType
    scraperName: string
    inputConfig: Record<string, unknown>
    fieldErrors: Record<string, string>
    outputFormat: ScraperOutputFormat
    isSuggestingAI?: boolean
  } | null>(null)

  const competitorName = campaign.ecp_name || ''
  const normalizedName = competitorName.toLowerCase()
  const website = campaign.custom_variables?.competitor_website || ''

  // Handle job completion
  const handleJobCompleted = useCallback((job: PersistedJob) => {
    toast.success('Scraper completado', `${job.scraperName} finalizado`)
    onRefresh()
  }, [toast, onRefresh])

  // Handle job failure
  const handleJobFailed = useCallback((job: PersistedJob) => {
    toast.error('Scraper falló', job.error || 'Error desconocido')
  }, [toast])

  // Use scraper job persistence for tracking running jobs
  const {
    activeJobs,
    jobHistory,
    trackJob,
  } = useScraperJobPersistence({
    projectId,
    campaignId: campaign.id,
    onJobCompleted: handleJobCompleted,
    onJobFailed: handleJobFailed,
  })

  // Update timer display every second when there are active jobs
  useEffect(() => {
    if (activeJobs.size === 0) return

    const intervalId = setInterval(() => {
      setTick(t => t + 1)
    }, 1000)

    return () => clearInterval(intervalId)
  }, [activeJobs.size])

  // Get running scrapers from active jobs
  const runningScrapers = useMemo(() => {
    const running = new Set<string>()
    for (const job of activeJobs.values()) {
      running.add(job.sourceType)
    }
    return running
  }, [activeJobs])

  // Calculate which inputs are configured
  const inputStatus = useMemo(() => {
    const vars = campaign.custom_variables || {}
    const allInputs = [
      'competitor_website',
      'instagram_username',
      'facebook_url',
      'linkedin_url',
      'youtube_url',
      'tiktok_username',
      'trustpilot_url',
      'g2_url',
      'capterra_url',
      'play_store_app_id',
      'app_store_app_id',
    ]
    const configured = allInputs.filter(key => !!vars[key]?.trim()).length
    return { configured, total: allInputs.length }
  }, [campaign.custom_variables])

  // Calculate scraper progress by step
  const scrapersByStep = useMemo(() => {
    const result: Record<string, {
      stepName: string
      scrapers: Array<{
        sourceType: string
        name: string
        isCompleted: boolean
        inputKey?: string
        inputValue?: string
      }>
      completed: number
      total: number
    }> = {}

    // Sources that use ecp_name instead of custom_variables for their input
    const ecpNameSources = new Set(['news_corpus', 'deep_research'])

    STEP_DOCUMENT_REQUIREMENTS.forEach(step => {
      const stepInfo = ANALYSIS_STEPS.find(s => s.id === step.stepId)
      const scrapers = step.source_types.map(sourceType => {
        const req = ALL_DOCUMENT_REQUIREMENTS.find(r => r.source_type === sourceType)
        const inputMapping = req ? SCRAPER_INPUT_MAPPINGS[req.id] : undefined
        const isCompleted = documents.some(doc =>
          doc.source_metadata?.source_type === sourceType &&
          doc.source_metadata?.competitor?.toLowerCase() === normalizedName
        )

        // Resolve inputValue: some sources use ecp_name, others use custom_variables
        let inputValue: string | undefined
        if (ecpNameSources.has(sourceType)) {
          inputValue = competitorName || undefined
        } else if (inputMapping?.inputKey) {
          inputValue = campaign.custom_variables?.[inputMapping.inputKey]
        }

        return {
          sourceType,
          name: req?.name || sourceType,
          isCompleted,
          inputKey: inputMapping?.inputKey,
          inputValue,
        }
      })

      result[step.stepId] = {
        stepName: stepInfo?.name || step.stepId,
        scrapers,
        completed: scrapers.filter(s => s.isCompleted).length,
        total: scrapers.length,
      }
    })

    return result
  }, [documents, normalizedName, campaign.custom_variables, competitorName])

  // Total scraper progress
  const totalScraperProgress = useMemo(() => {
    let completed = 0
    let total = 0
    Object.values(scrapersByStep).forEach(step => {
      completed += step.completed
      total += step.total
    })
    return { completed, total }
  }, [scrapersByStep])

  // Analysis step status
  const analysisStepStatus = useMemo(() => {
    const status: Record<string, {
      canRun: boolean
      isCompleted: boolean
      isRunning: boolean
      blockedReason?: string
      missingScrapers: number
      scraperWarning?: string
    }> = {}

    ANALYSIS_STEPS.forEach(step => {
      const stepScrapers = scrapersByStep[step.id]
      const scrapersReady = !stepScrapers || stepScrapers.completed === stepScrapers.total
      const missingScrapers = stepScrapers ? stepScrapers.total - stepScrapers.completed : 0

      // Use flow step IDs to check step_outputs (edge function saves with flow IDs like "comp-step-1-autopercepcion")
      const flowStepId = STEP_ID_MAPPING[step.id] || step.id
      const dependenciesReady = !step.dependsOn || step.dependsOn.every(depId => {
        const depFlowId = STEP_ID_MAPPING[depId] || depId
        return campaign.step_outputs?.[depFlowId]
      })

      const isCompleted = !!campaign.step_outputs?.[flowStepId]
      const isRunning = runningSteps.has(step.id)

      // Only block if dependencies (previous steps) aren't complete
      // Missing scrapers is a warning, not a blocker - user decides when to run
      let blockedReason: string | undefined
      if (!dependenciesReady && step.dependsOn) {
        const missingDeps = step.dependsOn.filter(depId => {
          const depFlowId = STEP_ID_MAPPING[depId] || depId
          return !campaign.step_outputs?.[depFlowId]
        })
        blockedReason = `Requiere: ${missingDeps.map(d => ANALYSIS_STEPS.find(s => s.id === d)?.name || d).join(', ')}`
      }

      // Warning text for missing scrapers (shown but doesn't block)
      const scraperWarning = !scrapersReady ? `${missingScrapers} scraper(s) pendiente(s)` : undefined

      status[step.id] = {
        // Can run if dependencies are ready (scrapers don't block anymore)
        canRun: dependenciesReady && !isCompleted && !isRunning,
        isCompleted,
        isRunning,
        blockedReason,
        missingScrapers,
        scraperWarning,
      }
    })

    return status
  }, [scrapersByStep, campaign.step_outputs, runningSteps])

  // Track running deep research (separate from scraper jobs since it's synchronous)
  const [runningDeepResearch, setRunningDeepResearch] = useState(false)
  // Track when running all scrapers at once
  const [runningAllScrapers, setRunningAllScrapers] = useState(false)

  // Show confirmation modal before running scraper - with full configuration
  const handleRunScraper = useCallback((sourceType: string) => {
    if (runningScrapers.has(sourceType)) return
    if (sourceType === 'deep_research' && runningDeepResearch) return

    const req = ALL_DOCUMENT_REQUIREMENTS.find(r => r.source_type === sourceType)
    if (!req) return

    // Get the scraper type for this source
    const scraperType = getScraperTypeForSource(sourceType as SourceType)
    if (!scraperType) {
      toast.error('Error', `No hay scraper configurado para: ${sourceType}`)
      return
    }

    // Get field schema for this scraper type
    const fieldSchema = SCRAPER_FIELD_SCHEMAS[scraperType as ScraperType]
    const inputMapping = SCRAPER_INPUT_MAPPINGS[req.id]

    // Build initial input config with defaults from schema
    const initialConfig: Record<string, unknown> = {}

    if (fieldSchema) {
      // Pre-fill with defaults from field schema
      for (const [key, field] of Object.entries(fieldSchema.fields)) {
        if (field.defaultValue !== undefined) {
          initialConfig[key] = field.defaultValue
        }
      }
    }

    // Pre-fill the main input from custom_variables using explicit mapping
    const vars = campaign.custom_variables || {}

    // Maps source_type -> { varKey, schemaKey, isArray, transform? }
    // schemaKey must match the field key in SCRAPER_FIELD_SCHEMAS (what the modal displays)
    // and SCRAPER_TEMPLATES inputSchema (what Apify expects).
    // Comment scrapers are NOT mapped here - they get input from parent scraper documents.
    const sourceToSchemaMapping: Record<string, {
      varKey: string; schemaKey: string; isArray: boolean;
      transform?: (v: string) => string
    }> = {
      // Social posts
      instagram_posts: { varKey: 'instagram_username', schemaKey: 'username', isArray: false },
      instagram_comments: { varKey: 'instagram_username', schemaKey: 'username', isArray: false },
      facebook_posts: { varKey: 'facebook_url', schemaKey: 'startUrls', isArray: true },
      linkedin_posts: { varKey: 'linkedin_url', schemaKey: 'company_name', isArray: false },
      linkedin_insights: { varKey: 'linkedin_url', schemaKey: 'urls', isArray: true },
      youtube_videos: { varKey: 'youtube_url', schemaKey: 'startUrls', isArray: true },
      tiktok_posts: { varKey: 'tiktok_username', schemaKey: 'profiles', isArray: true },
      // Reviews
      trustpilot_reviews: {
        varKey: 'trustpilot_url', schemaKey: 'companyDomain', isArray: false,
        transform: (url) => {
          const match = url.match(/trustpilot\.com\/review\/([^/?]+)/)
          return match ? match[1] : url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
        },
      },
      g2_reviews: {
        varKey: 'g2_url', schemaKey: 'product', isArray: false,
        transform: (url) => {
          const match = url.match(/g2\.com\/products\/([^/?]+)/)
          return match ? match[1] : url
        },
      },
      capterra_reviews: { varKey: 'capterra_url', schemaKey: 'startUrls', isArray: true },
      playstore_reviews: {
        varKey: 'play_store_app_id', schemaKey: 'startUrls', isArray: true,
        transform: (appId) => appId.startsWith('http')
          ? appId
          : `https://play.google.com/store/apps/details?id=${appId}`,
      },
      appstore_reviews: {
        varKey: 'app_store_app_id', schemaKey: 'startUrls', isArray: true,
        transform: (appId) => appId.startsWith('http')
          ? appId
          : `https://apps.apple.com/us/app/app/id${appId}`,
      },
      // Website & SEO
      website: { varKey: 'competitor_website', schemaKey: 'url', isArray: false },
      seo_serp: { varKey: 'competitor_website', schemaKey: 'url', isArray: false },
      // News & Research - use competitor name (from ecp_name, not custom_variables)
      news_corpus: { varKey: '_ecp_name', schemaKey: 'queries', isArray: true },
      deep_research: { varKey: '_ecp_name', schemaKey: 'query', isArray: false },
    }

    const mapping = sourceToSchemaMapping[sourceType]
    if (mapping) {
      // Special handling: _ecp_name reads from campaign.ecp_name instead of custom_variables
      const storedValue = mapping.varKey === '_ecp_name'
        ? competitorName
        : vars[mapping.varKey]

      if (storedValue) {
        // Clean up the value (remove @ for usernames)
        let cleanValue = mapping.varKey.includes('username')
          ? storedValue.replace('@', '')
          : storedValue

        // Apply transform if defined (e.g., URL → domain, app ID → URL)
        if (mapping.transform) {
          cleanValue = mapping.transform(cleanValue)
        }

        // Set as array or single value based on mapping
        if (mapping.isArray) {
          initialConfig[mapping.schemaKey] = [cleanValue]
        } else {
          initialConfig[mapping.schemaKey] = cleanValue
        }
      }
    }

    // Fallback: also try the generic inputMapping if no explicit mapping found
    if (!mapping && inputMapping?.inputKey) {
      const storedValue = vars[inputMapping.inputKey]
      if (storedValue) {
        initialConfig[inputMapping.inputKey] = storedValue
      }
    }

    // Auto-inject post URLs for comment scrapers from parent scraper documents
    const dependency = getScraperDependency(sourceType)
    if (dependency && dependency.targetInputField !== 'username') {
      // Find ALL parent posts documents for this competitor (there may be multiple runs)
      const parentDocs = documents.filter(d =>
        d.source_metadata?.source_type === dependency.dependsOn &&
        d.source_metadata?.competitor?.toLowerCase() === normalizedName
      )

      console.log(`[handleRunScraper] Dependency lookup for ${sourceType}: dependsOn=${dependency.dependsOn}, competitor=${normalizedName}, matching docs=${parentDocs.length}, total docs=${documents.length}`)

      if (parentDocs.length === 0) {
        // Debug: show what source_types and competitors exist in documents
        const availableTypes = [...new Set(documents.map(d => d.source_metadata?.source_type).filter(Boolean))]
        const availableCompetitors = [...new Set(documents.map(d => d.source_metadata?.competitor?.toLowerCase()).filter(Boolean))]
        console.log(`[handleRunScraper] Available source_types: ${availableTypes.join(', ')}`)
        console.log(`[handleRunScraper] Available competitors: ${availableCompetitors.join(', ')}`)
      }

      if (parentDocs.length > 0) {
        // Extract URLs from all documents and deduplicate
        const allUrls = parentDocs.flatMap(doc => dependency.urlExtractor(doc))
        const extractedUrls = Array.from(new Set(allUrls))

        if (extractedUrls.length > 0) {
          // Inject URLs in the format expected by the Apify actor
          if (dependency.urlAsObject) {
            initialConfig[dependency.targetInputField] = extractedUrls.map(url => ({ url }))
          } else {
            initialConfig[dependency.targetInputField] = extractedUrls
          }
          console.log(`[handleRunScraper] Auto-injected ${extractedUrls.length} URLs from ${parentDocs.length} ${dependency.dependsOn} doc(s) into ${dependency.targetInputField}`)
        } else {
          console.log(`[handleRunScraper] Found ${parentDocs.length} parent docs but urlExtractor returned 0 URLs. Content preview: ${parentDocs[0]?.extracted_content?.slice(0, 200)}`)
          toast.warning(
            'Sin URLs de posts',
            `Los documentos de ${dependency.dependsOn} existen pero no se pudieron extraer URLs. Revisa el contenido.`
          )
        }
      } else {
        toast.warning(
          'Dependencia pendiente',
          `Ejecuta primero el scraper de ${dependency.dependsOn} para obtener las URLs de posts/videos.`
        )
      }
    }

    // Show configuration modal
    setConfirmModal({
      sourceType,
      scraperType: scraperType as ScraperType,
      scraperName: req.name,
      inputConfig: initialConfig,
      fieldErrors: {},
      outputFormat: 'json',
    })
  }, [runningScrapers, runningDeepResearch, campaign.custom_variables, toast, documents, normalizedName])

  // Update field in confirmation modal
  const handleModalFieldChange = useCallback((key: string, value: unknown) => {
    if (!confirmModal) return
    setConfirmModal(prev => prev ? {
      ...prev,
      inputConfig: { ...prev.inputConfig, [key]: value },
      fieldErrors: { ...prev.fieldErrors, [key]: '' }, // Clear error on change
    } : null)
  }, [confirmModal])

  // Update output format in confirmation modal
  const handleOutputFormatChange = useCallback((format: ScraperOutputFormat) => {
    if (!confirmModal) return
    setConfirmModal(prev => prev ? { ...prev, outputFormat: format } : null)
  }, [confirmModal])

  // AI suggestion for scraper fields - uses Deep Research/Perplexity discovery
  const handleSuggestAI = useCallback(async () => {
    if (!confirmModal) return

    setConfirmModal(prev => prev ? { ...prev, isSuggestingAI: true } : null)

    try {
      const { sourceType } = confirmModal
      const vars = campaign.custom_variables || {}
      const suggestedInput: Record<string, unknown> = { ...confirmModal.inputConfig }

      // For website and deep_research, use existing values (no discovery needed)
      if (sourceType === 'website') {
        if (vars.competitor_website) {
          suggestedInput.url = vars.competitor_website
        }
        setConfirmModal(prev => prev ? { ...prev, inputConfig: suggestedInput, isSuggestingAI: false } : null)
        toast.success('Sugerencia aplicada', 'URL del sitio web configurada')
        return
      }

      if (sourceType === 'deep_research') {
        suggestedInput.query = competitorName
        setConfirmModal(prev => prev ? { ...prev, inputConfig: suggestedInput, isSuggestingAI: false } : null)
        toast.success('Sugerencia aplicada', 'Query configurado')
        return
      }

      // Map source types to discovery platforms
      const sourceToplatform: Record<string, string> = {
        instagram_posts: 'instagram',
        instagram_comments: 'instagram',
        facebook_posts: 'facebook',
        facebook_comments: 'facebook',
        linkedin_posts: 'linkedin',
        linkedin_comments: 'linkedin',
        linkedin_insights: 'linkedin',
        youtube_videos: 'youtube',
        youtube_comments: 'youtube',
        tiktok_posts: 'tiktok',
        tiktok_comments: 'tiktok',
        trustpilot_reviews: 'trustpilot',
        g2_reviews: 'g2',
        capterra_reviews: 'capterra',
        playstore_reviews: 'playstore',
        appstore_reviews: 'appstore',
      }

      const targetPlatform = sourceToplatform[sourceType]
      if (!targetPlatform) {
        toast.error('Error', 'Plataforma no soportada para auto-descubrimiento')
        setConfirmModal(prev => prev ? { ...prev, isSuggestingAI: false } : null)
        return
      }

      // Check if we have a website URL (required for discovery)
      const websiteUrl = vars.competitor_website
      if (!websiteUrl) {
        toast.error('Falta URL', 'Configura primero el sitio web del competidor para usar auto-descubrimiento')
        setConfirmModal(prev => prev ? { ...prev, isSuggestingAI: false } : null)
        return
      }

      toast.info('Buscando...', `Descubriendo perfil de ${targetPlatform} con IA`)

      // All platforms except the target one (to only search for what we need)
      const allPlatforms = ['instagram', 'facebook', 'linkedin', 'youtube', 'tiktok', 'twitter', 'trustpilot', 'g2', 'capterra', 'playstore', 'appstore']
      const skipPlatforms = allPlatforms.filter(p => p !== targetPlatform)

      // Call the discovery API
      const response = await fetch('/api/discovery/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitor_name: competitorName,
          website_url: websiteUrl,
          project_id: projectId,
          skip_platforms: skipPlatforms,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error en la búsqueda')
      }

      const result = await response.json()

      if (!result.success || !result.results?.profiles) {
        throw new Error('No se encontraron resultados')
      }

      // Get the discovered profile for our target platform
      const discoveredProfile = result.results.profiles[targetPlatform]

      if (!discoveredProfile || discoveredProfile.confidence === 'not_found') {
        toast.warning('No encontrado', `No se encontró perfil de ${targetPlatform} para ${competitorName}`)
        setConfirmModal(prev => prev ? { ...prev, isSuggestingAI: false } : null)
        return
      }

      // Map discovered profile to scraper input based on source type
      const applyDiscoveredProfile = () => {
        switch (sourceType) {
          case 'instagram_posts':
          case 'instagram_comments':
            if (discoveredProfile.handle) {
              suggestedInput.username = discoveredProfile.handle.replace('@', '')
            }
            break
          case 'facebook_posts':
          case 'facebook_comments':
            if (discoveredProfile.url) {
              suggestedInput.startUrls = [discoveredProfile.url]
            }
            break
          case 'linkedin_posts':
          case 'linkedin_comments':
          case 'linkedin_insights':
            if (discoveredProfile.url) {
              suggestedInput.companyUrls = [discoveredProfile.url]
            }
            break
          case 'youtube_videos':
          case 'youtube_comments':
            if (discoveredProfile.url) {
              suggestedInput.startUrls = [discoveredProfile.url]
            }
            break
          case 'tiktok_posts':
          case 'tiktok_comments':
            if (discoveredProfile.handle) {
              suggestedInput.profiles = [discoveredProfile.handle.replace('@', '')]
            }
            break
          case 'trustpilot_reviews':
          case 'g2_reviews':
          case 'capterra_reviews':
            if (discoveredProfile.url) {
              suggestedInput.startUrls = [discoveredProfile.url]
            }
            break
          case 'playstore_reviews':
            if (discoveredProfile.handle) {
              suggestedInput.appId = discoveredProfile.handle
            }
            break
          case 'appstore_reviews':
            if (discoveredProfile.handle) {
              suggestedInput.appId = discoveredProfile.handle
            }
            break
        }
      }

      applyDiscoveredProfile()

      // Update modal with discovered values
      setConfirmModal(prev => prev ? {
        ...prev,
        inputConfig: suggestedInput,
        isSuggestingAI: false,
      } : null)

      const confidenceText = discoveredProfile.confidence === 'verified' ? 'verificado' :
        discoveredProfile.confidence === 'likely' ? 'probable' : 'posible'
      toast.success('Perfil descubierto', `${targetPlatform} (${confidenceText}): ${discoveredProfile.handle || discoveredProfile.url}`)

    } catch (error) {
      console.error('Error suggesting AI:', error)
      toast.error('Error', error instanceof Error ? error.message : 'No se pudo generar la sugerencia')
      setConfirmModal(prev => prev ? { ...prev, isSuggestingAI: false } : null)
    }
  }, [confirmModal, campaign.custom_variables, competitorName, projectId, toast])

  // Execute scraper after confirmation - with validation
  const executeScraperConfirmed = useCallback(async () => {
    if (!confirmModal) return

    const { sourceType, scraperType, scraperName, inputConfig, outputFormat } = confirmModal

    // Build output configuration
    const outputConfig: ScraperOutputConfig = {
      format: outputFormat,
      flatten: outputFormat === 'csv',
    }

    // Validate all fields before execution
    const validation = validateAllFields(scraperType, inputConfig)
    if (!validation.valid) {
      setConfirmModal(prev => prev ? { ...prev, fieldErrors: validation.errors } : null)
      toast.error('Campos inválidos', 'Corrige los errores antes de ejecutar')
      return
    }

    setConfirmModal(null)

    const req = ALL_DOCUMENT_REQUIREMENTS.find(r => r.source_type === sourceType)
    if (!req) return

    toast.info('Iniciando...', `Ejecutando ${scraperName}`)

    try {
      // Handle Deep Research separately - it's synchronous, not a scraper job
      if (sourceType === 'deep_research') {
        setRunningDeepResearch(true)
        try {
          const response = await fetch('/api/deep-research/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project_id: projectId,
              campaign_id: campaign.id,
              competitor_name: competitorName,
              industry: campaign.custom_variables?.industry || 'tecnología',
              country: campaign.custom_variables?.country || 'España',
              metadata: createDocumentMetadata(competitorName, sourceType, campaign.id),
            }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to generate deep research')
          }

          const result = await response.json()
          if (result.success) {
            toast.success('Deep Research completado', `Documento creado: ${result.document_name}`)
            onRefresh()
          }
        } finally {
          setRunningDeepResearch(false)
        }
        return
      }

      console.log('[CompetitorDetailView] Executing scraper:', {
        sourceType,
        scraperType,
        inputConfig,
        outputFormat,
      })

      const response = await fetch('/api/scraper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          scraper_type: scraperType,
          input_config: inputConfig,
          output_config: outputConfig,
          target_name: competitorName,
          target_category: 'competitor',
          metadata: {
            campaign_id: campaign.id,
            source_type: sourceType,
            competitor: competitorName,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start scraper')
      }

      const result = await response.json()

      // Track job for polling (API returns job_id with underscore)
      if (result.job_id) {
        trackJob({
          jobId: result.job_id,
          scraperId: scraperType,
          scraperName: req.name,
          sourceType,
          projectId,
        })
        toast.success('Scraper iniciado', `${scraperName} se está ejecutando`)
      }
    } catch (error) {
      console.error('Error running scraper:', error)
      toast.error('Error', error instanceof Error ? error.message : 'No se pudo ejecutar el scraper')
    }
  }, [confirmModal, campaign.custom_variables, campaign.id, competitorName, projectId, toast, trackJob, onRefresh])

  // Handle run all scrapers for a step
  const handleRunStepScrapers = useCallback(async (stepId: string) => {
    const stepData = scrapersByStep[stepId]
    if (!stepData) return

    const pendingScrapers = stepData.scrapers.filter(s => !s.isCompleted)
    if (pendingScrapers.length === 0) return

    toast.info('Ejecutando...', `Iniciando ${pendingScrapers.length} scrapers`)

    for (const scraper of pendingScrapers) {
      await handleRunScraper(scraper.sourceType)
    }
  }, [scrapersByStep, handleRunScraper, toast])

  // Handle run ALL scrapers across all steps
  const handleRunAllScrapers = useCallback(async () => {
    if (runningAllScrapers) return

    // Count total pending scrapers
    const allPendingScrapers = Object.values(scrapersByStep).flatMap(stepData =>
      stepData.scrapers.filter(s => !s.isCompleted)
    )

    if (allPendingScrapers.length === 0) {
      toast.success('Completado', 'Todos los scrapers ya están completados')
      return
    }

    // Check which scrapers don't have inputs (and don't have defaults either)
    const scrapersWithoutInputs = allPendingScrapers.filter(s => {
      const hasInput = !!s.inputValue
      const hasDefaults = !!SCRAPER_DEFAULTS[s.sourceType]
      return s.inputKey && !hasInput && !hasDefaults
    })

    // If there are scrapers without configuration, open modal
    if (scrapersWithoutInputs.length > 0) {
      toast.info(
        'Configuración necesaria',
        `${scrapersWithoutInputs.length} scraper(s) necesitan configuración`
      )
      setShowConfigModal(true)
      return
    }

    // All configured → execute in batches with dependency handling
    await executeScrapersInBatches(allPendingScrapers)
  }, [runningAllScrapers, scrapersByStep, toast])

  // Wait for scrapers in a batch to complete (polling)
  const waitForScrapersToComplete = useCallback(async (batch: Array<{ sourceType: string }>) => {
    const MAX_WAIT_TIME = 10 * 60 * 1000 // 10 minutes maximum
    const POLL_INTERVAL = 6000 // 6 seconds (greater than hook's 5s to ensure sync)
    const startTime = Date.now()

    // Get source types from batch
    const sourceTypes = new Set(batch.map(s => s.sourceType))

    while (true) {
      // Check if timeout exceeded
      if (Date.now() - startTime > MAX_WAIT_TIME) {
        console.warn('[waitForScrapers] Max wait time exceeded')
        return
      }

      // Check how many scrapers are still running
      const stillRunning = Array.from(sourceTypes).filter(sourceType =>
        runningScrapers.has(sourceType)
      )

      // If none running, all completed
      if (stillRunning.length === 0) {
        return
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
    }
  }, [runningScrapers])

  // Execute scrapers in batches with dependency handling
  const executeScrapersInBatches = useCallback(async (scrapers: Array<{ sourceType: string; name: string; isCompleted: boolean; inputValue?: string }>) => {
    setRunningAllScrapers(true)

    try {
      // Organize scrapers into batches considering dependencies
      // Batch 1: Independent (posts, videos, reviews)
      // Batch 2: Dependent (comments that need post URLs)
      const dependencyBatches = organizeBatchesWithDependencies(scrapers)

      toast.info(
        'Iniciando...',
        `Ejecutando ${scrapers.length} scrapers en ${dependencyBatches.length} fases`
      )

      for (let phaseIdx = 0; phaseIdx < dependencyBatches.length; phaseIdx++) {
        const phase = dependencyBatches[phaseIdx]
        const phaseName = phaseIdx === 0 ? 'Posts/Videos/Reviews' : 'Comentarios'

        // Within each phase, divide into sub-batches of 3
        const BATCH_SIZE = 3
        const subBatches: typeof phase[] = []
        for (let i = 0; i < phase.length; i += BATCH_SIZE) {
          subBatches.push(phase.slice(i, i + BATCH_SIZE))
        }

        toast.info(
          `Fase ${phaseIdx + 1}: ${phaseName}`,
          `${phase.length} scrapers en ${subBatches.length} batches`
        )

        for (let i = 0; i < subBatches.length; i++) {
          const batch = subBatches[i]
          const batchNum = i + 1

          toast.info(
            `Batch ${batchNum}/${subBatches.length}`,
            `Ejecutando ${batch.length} scrapers...`
          )

          // For dependent scrapers (comments), verify parent docs exist.
          // URL injection into inputConfig happens inside handleRunScraper via getScraperDependency.
          for (const scraper of batch) {
            const dependency = getScraperDependency(scraper.sourceType)
            if (dependency && dependency.targetInputField !== 'username') {
              const parentDoc = documents.find(d =>
                d.source_metadata?.source_type === dependency.dependsOn &&
                d.source_metadata?.competitor?.toLowerCase() === normalizedName
              )
              if (!parentDoc) {
                toast.warning(
                  'Dependencia pendiente',
                  `${scraper.name} necesita que se ejecute primero el scraper de ${dependency.dependsOn}`
                )
              }
            }
          }

          // Launch all scrapers in the batch
          const launchPromises = batch.map(scraper =>
            handleRunScraper(scraper.sourceType)
          )
          await Promise.all(launchPromises)

          // Wait for all to complete before continuing
          await waitForScrapersToComplete(batch)

          // Small delay between batches
          if (i < subBatches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      }

      toast.success('Completado', `${scrapers.length} scrapers ejecutados exitosamente`)
    } catch (error) {
      console.error('Error executing scrapers in batches:', error)
      toast.error('Error', 'Hubo un problema ejecutando los scrapers')
    } finally {
      setRunningAllScrapers(false)
    }
  }, [handleRunScraper, documents, onRefresh, toast, runningScrapers, waitForScrapersToComplete])

  // Get scraper status for visual indicators
  const getScraperStatus = useCallback((scraper: { sourceType: string; inputKey?: string; inputValue?: string; isCompleted: boolean }) => {
    // A scraper "has input" if it doesn't require one (no inputKey) or the value is non-empty
    const hasInput = !scraper.inputKey || !!scraper.inputValue?.trim()

    // Check if this specific platform was auto-discovered
    let discoveredPlatforms: string[] = []
    try {
      const raw = campaign.custom_variables?.discovered_platforms
      if (raw) discoveredPlatforms = JSON.parse(raw)
    } catch { /* ignore */ }
    const platformFromSource = scraper.sourceType.replace(/_posts|_comments|_videos|_reviews|_insights/, '')
    const wasDiscovered = discoveredPlatforms.includes(platformFromSource) && hasInput

    if (scraper.isCompleted) {
      return {
        status: 'verified' as const,
        badge: {
          text: 'Completado',
          color: 'green',
          icon: <CheckCircle size={12} />
        }
      }
    }

    if (wasDiscovered && hasInput) {
      return {
        status: 'auto-completed' as const,
        badge: {
          text: 'Auto-detectado',
          color: 'emerald',
          icon: <Sparkles size={12} />
        }
      }
    }

    if (hasInput) {
      return {
        status: 'configured' as const,
        badge: {
          text: 'Configurado',
          color: 'blue',
          icon: <CheckCircle size={12} />
        }
      }
    }

    return {
      status: 'pending' as const,
      badge: {
        text: 'Pendiente',
        color: 'amber',
        icon: <AlertCircle size={12} />
      }
    }
  }, [campaign.custom_variables])

  // Handle run analysis step - calls actual API
  const handleRunAnalysisStep = useCallback(async (stepId: string) => {
    if (runningSteps.has(stepId)) return

    const stepInfo = ANALYSIS_STEPS.find(s => s.id === stepId)
    if (!stepInfo) return

    // Map to the correct flow step ID used in flow_config
    const flowStepId = STEP_ID_MAPPING[stepId]
    if (!flowStepId) {
      toast.error('Error', `No se encontró el paso ${stepId}`)
      return
    }

    setRunningSteps(prev => new Set(prev).add(stepId))
    toast.info('Ejecutando...', `Iniciando ${stepInfo.name}`)

    try {
      // Collect effective document IDs for this step (explicit selections + auto-matched defaults)
      const competitorDocs = documents.filter(d =>
        d.source_metadata?.competitor?.toLowerCase() === normalizedName
      )

      const platformKeywords: Record<string, string[]> = {
        'instagram_posts': ['instagram', 'ig'],
        'instagram_comments': ['instagram', 'ig', 'comment'],
        'facebook_posts': ['facebook', 'fb'],
        'facebook_comments': ['facebook', 'fb', 'comment'],
        'linkedin_posts': ['linkedin'],
        'linkedin_comments': ['linkedin', 'comment'],
        'linkedin_insights': ['linkedin', 'insight'],
        'youtube_videos': ['youtube', 'yt'],
        'youtube_comments': ['youtube', 'yt', 'comment'],
        'tiktok_posts': ['tiktok'],
        'tiktok_comments': ['tiktok', 'comment'],
        'trustpilot_reviews': ['trustpilot', 'review'],
        'g2_reviews': ['g2', 'review'],
        'capterra_reviews': ['capterra', 'review'],
        'playstore_reviews': ['play store', 'playstore', 'android', 'review'],
        'appstore_reviews': ['app store', 'appstore', 'ios', 'review'],
        'website': ['website', 'web', 'crawl', 'sitio'],
        'deep_research': ['deep research', 'research'],
        'seo_serp': ['seo', 'serp', 'search'],
        'news_corpus': ['news', 'noticias', 'prensa'],
      }

      const effectiveDocIds: string[] = []
      const requiredSources = stepInfo.requiredSources || []

      for (const source of requiredSources) {
        // Check explicit user selection first
        const hasExplicit = selectedDocs[stepId]?.[source] !== undefined
        if (hasExplicit) {
          const docId = selectedDocs[stepId][source]
          if (docId) effectiveDocIds.push(docId) // Skip empty = "Sin documento"
          continue
        }
        // Auto-match: find first doc matching this source
        const keywords = platformKeywords[source] || [source.replace(/_/g, ' ')]
        const autoMatch = competitorDocs.find(d => {
          const docName = (d.name || d.filename || '').toLowerCase()
          const docTags = (d.tags || []).map((t: string) => t.toLowerCase())
          return d.source_metadata?.source_type === source ||
            keywords.some(kw => docName.includes(kw) || docTags.some(tag => tag.includes(kw)))
        })
        if (autoMatch) effectiveDocIds.push(autoMatch.id)
      }

      // Deduplicate
      const uniqueDocIds = [...new Set(effectiveDocIds)]

      const response = await fetch('/api/campaign/run-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          stepId: flowStepId,
          documentIds: uniqueDocIds.length > 0 ? uniqueDocIds : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Error al ejecutar ${stepInfo.name}`)
      }

      const result = await response.json()

      // Check if async polling is required (for Deep Research steps)
      if (result.async_polling_required) {
        toast.info('Procesando...', `${stepInfo.name} está procesando en segundo plano`)
        // Don't remove from running steps - it's still processing
        // The user can refresh to check status
        return
      }

      toast.success('Completado', `${stepInfo.name} ejecutado`)
      onRefresh()
    } catch (error) {
      console.error('Error running analysis:', error)
      toast.error('Error', error instanceof Error ? error.message : 'No se pudo ejecutar el análisis')
    } finally {
      setRunningSteps(prev => {
        const next = new Set(prev)
        next.delete(stepId)
        return next
      })
    }
  }, [runningSteps, toast, onRefresh, campaign.id, documents, normalizedName, selectedDocs])

  // Handle config saved - auto-execute scrapers after saving
  const handleConfigSaved = useCallback(() => {
    setShowConfigModal(false)

    toast.success(
      'Configuración guardada',
      'Variables actualizadas correctamente'
    )

    // Refresh data to reflect saved values
    onRefresh()
  }, [onRefresh, toast])

  // ============================================
  // PROFILE MANAGEMENT
  // ============================================

  // Social platforms for discovery
  const SOCIAL_PLATFORMS: { key: string; name: string; icon: React.ReactNode; needsUsername: boolean }[] = [
    { key: 'instagram', name: 'Instagram', icon: <FaInstagram className="text-[#E4405F]" />, needsUsername: true },
    { key: 'facebook', name: 'Facebook', icon: <FaFacebook className="text-[#1877F2]" />, needsUsername: false },
    { key: 'linkedin', name: 'LinkedIn', icon: <FaLinkedin className="text-[#0A66C2]" />, needsUsername: false },
    { key: 'youtube', name: 'YouTube', icon: <FaYoutube className="text-[#FF0000]" />, needsUsername: false },
    { key: 'tiktok', name: 'TikTok', icon: <FaTiktok className="text-black" />, needsUsername: true },
    { key: 'twitter', name: 'Twitter/X', icon: <FaXTwitter className="text-black" />, needsUsername: false },
    { key: 'appstore', name: 'App Store', icon: <FaAppStoreIos className="text-[#0D96F6]" />, needsUsername: false },
    { key: 'playstore', name: 'Play Store', icon: <FaGooglePlay className="text-[#414141]" />, needsUsername: false },
    { key: 'trustpilot', name: 'Trustpilot', icon: <SiTrustpilot className="text-[#00B67A]" />, needsUsername: false },
    { key: 'g2', name: 'G2', icon: <SiG2 className="text-[#FF492C]" />, needsUsername: false },
    { key: 'capterra', name: 'Capterra', icon: <svg viewBox="0 0 24 24" fill="#FF9D28" className="w-[1em] h-[1em]"><path d="M12 2L2 19.5h20L12 2zm0 4.5l6.5 11.5h-13L12 6.5z"/></svg>, needsUsername: false },
  ]

  // State for editing profiles
  const [editingProfiles, setEditingProfiles] = useState<Record<string, string>>({})
  const [savingProfiles, setSavingProfiles] = useState(false)
  const [isProfilesSectionCollapsed, setIsProfilesSectionCollapsed] = useState(false)
  const [reRunningDiscovery, setReRunningDiscovery] = useState(false)
  const [extractingMetadata, setExtractingMetadata] = useState(false)

  // Auto-poll for discovery completion
  useEffect(() => {
    const discoveryCompleted = campaign.custom_variables?.discovery_completed
    const isDiscoveryRunning = discoveryCompleted === 'false' || (reRunningDiscovery && !discoveryCompleted)

    if (!isDiscoveryRunning) {
      setReRunningDiscovery(false)
      return
    }

    console.log('[Discovery Polling] Discovery is running, starting auto-refresh...')

    // Poll every 5 seconds while discovery is running
    const pollInterval = setInterval(() => {
      console.log('[Discovery Polling] Refreshing campaign data...')
      onRefresh()
    }, 5000)

    return () => {
      console.log('[Discovery Polling] Stopping poll interval')
      clearInterval(pollInterval)
    }
  }, [campaign.custom_variables?.discovery_completed, reRunningDiscovery, onRefresh])

  // Auto-initialize selectedDocs when steps are expanded or documents change
  useEffect(() => {
    if (expandedSteps.size === 0) return
    const competitorDocs = documents.filter(d =>
      d.source_metadata?.competitor?.toLowerCase() === normalizedName
    )
    setSelectedDocs(prev => {
      const next = { ...prev }
      expandedSteps.forEach(stepId => {
        // Skip if already initialized for this step
        if (next[stepId] && Object.keys(next[stepId]).length > 0) return
        const step = ANALYSIS_STEPS.find(s => s.id === stepId)
        if (!step) return
        const docsForStep: Record<string, string> = {}

        // Seed from persisted base_doc_ids first (saved via StepEditor)
        const savedBaseDocIds: string[] = (campaign.custom_variables?.[`${stepId}_config`] as { base_doc_ids?: string[] } | undefined)?.base_doc_ids || []
        savedBaseDocIds.forEach(docId => {
          const doc = competitorDocs.find(d => d.id === docId)
          if (doc) {
            const sourceType = doc.source_metadata?.source_type || ''
            if (step.requiredSources.includes(sourceType) && !docsForStep[sourceType]) {
              docsForStep[sourceType] = docId
            }
          }
        })

        // Fill remaining required sources via auto-match
        competitorDocs.forEach(doc => {
          const sourceType = doc.source_metadata?.source_type || ''
          if (step.requiredSources.includes(sourceType) && !docsForStep[sourceType]) {
            docsForStep[sourceType] = doc.id
          }
        })
        next[stepId] = docsForStep
      })
      return next
    })
  }, [expandedSteps, documents, normalizedName, campaign.custom_variables])

  // Initialize editing state from custom_variables
  useEffect(() => {
    const profiles: Record<string, string> = {}

    // Load social platform profiles
    SOCIAL_PLATFORMS.forEach(platform => {
      const urlKey = `${platform.key}_url`
      profiles[urlKey] = campaign.custom_variables?.[urlKey] as string || ''

      // Also load username for platforms that need it
      if (platform.needsUsername) {
        const usernameKey = `${platform.key}_username`
        profiles[usernameKey] = campaign.custom_variables?.[usernameKey] as string || ''
      }
    })
    setEditingProfiles(profiles)
  }, [campaign.custom_variables])

  // Handle profile URL change
  const handleProfileChange = useCallback((key: string, value: string) => {
    setEditingProfiles(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  // Save all profiles to campaign.custom_variables
  const handleSaveProfiles = useCallback(async () => {
    setSavingProfiles(true)
    try {
      const response = await fetch(`/api/campaign/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_variables: {
            ...campaign.custom_variables,
            ...editingProfiles,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Error al guardar perfiles')
      }

      toast.success('Perfiles actualizados', 'Los cambios se guardaron correctamente')
      onRefresh() // Reload campaign data
    } catch (error) {
      console.error('Error saving profiles:', error)
      toast.error('Error', 'No se pudieron guardar los perfiles')
    } finally {
      setSavingProfiles(false)
    }
  }, [campaign.id, campaign.custom_variables, editingProfiles, toast, onRefresh])

  // Re-run profile discovery
  const handleReRunDiscovery = useCallback(async () => {
    console.log('[DEBUG] Campaign ID:', campaign.id)
    console.log('[DEBUG] Competitor Name:', competitorName)
    console.log('[DEBUG] Campaign object:', campaign)

    const websiteUrl = campaign.custom_variables?.competitor_website
    if (!websiteUrl) {
      toast.error('Falta URL', 'Configura primero el sitio web del competidor')
      return
    }

    setReRunningDiscovery(true)
    try {
      // Reset discovery status first
      await fetch(`/api/campaign/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_variables: {
            ...campaign.custom_variables,
            discovery_completed: 'false',
            discovery_error: null,
            discovery_found_count: null,
          },
        }),
      })

      // Launch discovery
      const response = await fetch('/api/profile-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store', // Prevent browser caching
        body: JSON.stringify({
          campaignId: campaign.id,
          competitorName: competitorName,
          websiteUrl,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[Re-run Discovery] Error response:', errorData)
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      console.log('[Re-run Discovery] Success:', result)
      toast.success('Discovery iniciado', 'Buscando perfiles en segundo plano...')
      onRefresh() // Reload to show "Buscando..." status
    } catch (error) {
      console.error('Error re-running discovery:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      toast.error('Error', errorMessage)
    } finally {
      setReRunningDiscovery(false)
    }
  }, [campaign.id, campaign.custom_variables, competitorName, toast, onRefresh])

  // ============================================
  // STEP EDITING
  // ============================================

  // Start editing a step's configuration
  const startEditingStep = useCallback((stepId: string) => {
    setEditingStepId(stepId)
    // Initialize variables from campaign
    setStepVariables(campaign.custom_variables || {})
    // Initialize prompt from campaign or default
    const step = ANALYSIS_STEPS.find(s => s.id === stepId)
    if (step) {
      const savedPrompt = campaign.custom_variables?.[`prompt_${stepId}`]
      const defaultPrompt = ALL_PROMPTS[step.promptKey]
      setStepPrompts(prev => ({ ...prev, [stepId]: savedPrompt || defaultPrompt }))

      // Initialize selected documents for this step (filtered by competitor)
      const docsForStep: Record<string, string> = {}
      documents.forEach(doc => {
        const sourceType = doc.source_metadata?.source_type || ''
        if (
          doc.source_metadata?.competitor?.toLowerCase() === normalizedName &&
          step.requiredSources.includes(sourceType) &&
          !docsForStep[sourceType]
        ) {
          docsForStep[sourceType] = doc.id
        }
      })
      setSelectedDocs(prev => ({ ...prev, [stepId]: docsForStep }))
    }
  }, [campaign.custom_variables, documents, normalizedName])

  // Save step configuration
  const saveStepConfig = useCallback(async () => {
    if (!editingStepId) return

    setIsSavingStep(true)
    try {
      // Merge variables with custom prompt (if edited)
      const updatedVariables = { ...stepVariables }
      if (stepPrompts[editingStepId]) {
        updatedVariables[`prompt_${editingStepId}`] = stepPrompts[editingStepId]
      }

      // Update campaign custom_variables
      const response = await fetch(`/api/campaign/${campaign.id}/update-variables`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_variables: updatedVariables,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save configuration')
      }

      toast.success('Guardado', 'Configuración actualizada')
      setEditingStepId(null)
      onRefresh()
    } catch (error) {
      console.error('Error saving step config:', error)
      toast.error('Error', 'No se pudo guardar la configuración')
    } finally {
      setIsSavingStep(false)
    }
  }, [editingStepId, stepVariables, stepPrompts, campaign.id, toast, onRefresh])

  // Cancel editing
  const cancelEditingStep = useCallback(() => {
    setEditingStepId(null)
    setStepVariables({})
    setStepPrompts({})
  }, [])

  // Save FlowStep configuration from StepEditor
  const handleSaveFlowStep = useCallback(async (updatedStep: FlowStep) => {
    try {
      // Find the analysis step id from the flow step id
      const analysisStepId = Object.entries(STEP_ID_MAPPING).find(
        ([, flowId]) => flowId === updatedStep.id
      )?.[0]

      if (!analysisStepId) {
        throw new Error('No se pudo identificar el paso')
      }

      // Save the step configuration to campaign custom_variables
      const configToSave = {
        prompt: updatedStep.prompt,
        model: updatedStep.model,
        temperature: updatedStep.temperature,
        max_tokens: updatedStep.max_tokens,
        output_format: updatedStep.output_format,
        retrieval_mode: updatedStep.retrieval_mode,
        base_doc_ids: updatedStep.base_doc_ids,
      }

      console.log('[handleSaveFlowStep] Saving config for step:', analysisStepId)
      console.log('[handleSaveFlowStep] Config:', JSON.stringify(configToSave, null, 2))

      const response = await fetch(`/api/campaign/${campaign.id}/update-variables`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_variables: {
            [`${analysisStepId}_config`]: configToSave,
          },
        }),
      })

      const responseData = await response.json()
      console.log('[handleSaveFlowStep] Response status:', response.status, response.ok)
      console.log('[handleSaveFlowStep] Response data:', responseData)

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to save configuration')
      }

      toast.success('Guardado', 'Configuración del paso actualizada')
      setEditingFlowStep(null)

      // Force refresh to get updated data
      console.log('[handleSaveFlowStep] Calling onRefresh...')
      await onRefresh()
      console.log('[handleSaveFlowStep] Refresh completed')
    } catch (error) {
      console.error('[handleSaveFlowStep] Error:', error)
      toast.error('Error', error instanceof Error ? error.message : 'No se pudo guardar la configuración')
    }
  }, [campaign.id, toast, onRefresh])

  // Apply step config from this competitor to all other competitors
  const handleApplyConfigToAll = useCallback(async (analysisStepId: string) => {
    const siblingCampaigns = campaigns.filter(c => c.id !== campaign.id)
    if (siblingCampaigns.length === 0) {
      toast.error('Sin competidores', 'No hay otros competidores a los que aplicar la configuración')
      return
    }

    const savedConfig = campaign.custom_variables?.[`${analysisStepId}_config`]
    if (!savedConfig) {
      toast.error('Sin configuración', 'Primero edita y guarda la configuración de este paso')
      return
    }

    setApplyingToAll(analysisStepId)
    try {
      const results = await Promise.allSettled(
        siblingCampaigns.map(sibling =>
          fetch(`/api/campaign/${sibling.id}/update-variables`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              custom_variables: {
                [`${analysisStepId}_config`]: savedConfig,
              },
            }),
          })
        )
      )

      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok))
      if (failed.length === 0) {
        toast.success(
          'Aplicado a todos',
          `Configuración copiada a ${siblingCampaigns.length} competidor${siblingCampaigns.length > 1 ? 'es' : ''}`
        )
      } else {
        toast.error(
          'Parcialmente aplicado',
          `${siblingCampaigns.length - failed.length} de ${siblingCampaigns.length} actualizados`
        )
      }

      await onRefresh()
    } catch (error) {
      console.error('Error applying config to all:', error)
      toast.error('Error', 'No se pudo aplicar la configuración')
    } finally {
      setApplyingToAll(null)
    }
  }, [campaign.id, campaign.custom_variables, campaigns, toast, onRefresh])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{competitorName}</h2>
            {website && (
              <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                <Globe size={14} />
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 hover:underline"
                >
                  {website.replace(/^https?:\/\//, '')}
                </a>
                <ExternalLink size={12} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
          >
            <Variable size={18} />
            Editar Variables
          </button>
        </div>
      </div>

      {/* Configuration status - compact info, no blocking banner */}

      {/* Perfiles Descubiertos Section */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <button
            onClick={() => setIsProfilesSectionCollapsed(!isProfilesSectionCollapsed)}
            className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-2 py-1 -ml-2 transition-colors"
          >
            <Sparkles size={20} className="text-purple-600" />
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">Perfiles Descubiertos</h3>
              <p className="text-sm text-gray-500">
                {campaign.custom_variables?.discovery_error ? (
                  <span className="flex items-center gap-1.5 text-red-600">
                    <XCircle size={14} />
                    <span>Error: {campaign.custom_variables.discovery_error}</span>
                    <span className="text-xs text-gray-400">(presiona Re-ejecutar)</span>
                  </span>
                ) : campaign.custom_variables?.discovery_completed === 'false'
                  ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 size={14} className="animate-spin text-purple-600" />
                      <span>Buscando perfiles...</span>
                      <span className="text-xs text-gray-400">(se actualiza automáticamente)</span>
                    </span>
                  )
                  : (() => {
                    const filledCount = SOCIAL_PLATFORMS.filter(p => {
                      const url = editingProfiles[`${p.key}_url`]
                      const username = editingProfiles[`${p.key}_username`]
                      return (url && url.trim()) || (username && username.trim())
                    }).length
                    return filledCount > 0
                      ? `${filledCount} de ${SOCIAL_PLATFORMS.length} perfiles configurados`
                      : 'Sin perfiles configurados'
                  })()}
              </p>
            </div>
            <ChevronDown
              size={20}
              className={`text-gray-400 transition-transform ${isProfilesSectionCollapsed ? '-rotate-90' : ''}`}
            />
          </button>

          {!isProfilesSectionCollapsed && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleReRunDiscovery}
                disabled={reRunningDiscovery}
                className="flex items-center gap-2 px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50 text-sm font-medium"
                title="Re-ejecutar el descubrimiento automático de perfiles"
              >
                {reRunningDiscovery ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Re-ejecutando...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Re-ejecutar Discovery
                  </>
                )}
              </button>

              <button
                onClick={handleSaveProfiles}
                disabled={savingProfiles}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {savingProfiles ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar cambios
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {!isProfilesSectionCollapsed && (
          <div className="px-5 py-3">
            <div className="divide-y divide-gray-100">
              {SOCIAL_PLATFORMS.map(platform => {
              const urlKey = `${platform.key}_url`
              const usernameKey = `${platform.key}_username`
              const currentUrl = editingProfiles[urlKey] || ''
              const currentUsername = editingProfiles[usernameKey] || ''
              const hasSomeValue = !!(currentUrl.trim() || currentUsername.trim())
              let discoveredPlatformsForProfile: string[] = []
              try {
                const raw = campaign.custom_variables?.discovered_platforms
                if (raw) discoveredPlatformsForProfile = JSON.parse(raw as string)
              } catch { /* ignore */ }
              const wasDiscovered = discoveredPlatformsForProfile.includes(platform.key) && hasSomeValue

              return (
                <div key={platform.key} className="flex items-center gap-3 py-2.5 group">
                  <span className="text-lg shrink-0 w-6 flex justify-center">{platform.icon}</span>
                  <span className={`text-sm font-medium w-24 shrink-0 ${hasSomeValue ? 'text-gray-900' : 'text-gray-400'}`}>
                    {platform.name}
                    {wasDiscovered && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-px bg-emerald-100 text-emerald-700 rounded-full align-middle">
                        auto
                      </span>
                    )}
                  </span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    {platform.needsUsername && (
                      <input
                        type="text"
                        value={currentUsername}
                        onChange={(e) => handleProfileChange(usernameKey, e.target.value)}
                        placeholder="@username"
                        className={`w-36 shrink-0 px-2.5 py-1 border rounded-md text-sm transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${hasSomeValue ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200 bg-gray-50 group-hover:border-gray-300'}`}
                      />
                    )}
                    <input
                      type="text"
                      value={currentUrl}
                      onChange={(e) => handleProfileChange(urlKey, e.target.value)}
                      placeholder={platform.needsUsername ? 'URL (opcional)' : 'URL o identificador'}
                      className={`flex-1 min-w-0 px-2.5 py-1 border rounded-md text-sm transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${hasSomeValue ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200 bg-gray-50 group-hover:border-gray-300'}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {campaign.custom_variables?.discovery_completed !== 'true' && (
            <div className="mx-5 mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
              <Loader2 size={14} className="text-blue-600 animate-spin shrink-0" />
              <p className="text-xs text-blue-700">
                Buscando perfiles de redes sociales... Los resultados aparecerán automáticamente.
              </p>
            </div>
          )}
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Scrapers */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Search size={20} className="text-indigo-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Scrapers</h3>
                <p className="text-sm text-gray-500">
                  {totalScraperProgress.completed}/{totalScraperProgress.total} completados
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {jobHistory.length > 0 && (
                <button
                  onClick={() => setShowScraperHistory(!showScraperHistory)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors text-sm font-medium border ${
                    showScraperHistory
                      ? 'bg-gray-100 border-gray-300 text-gray-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Clock size={14} />
                  Historial
                  <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                    {jobHistory.length}
                  </span>
                </button>
              )}
              {totalScraperProgress.completed < totalScraperProgress.total && (
                <button
                  onClick={handleRunAllScrapers}
                  disabled={runningAllScrapers}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                    runningAllScrapers
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {runningAllScrapers ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Ejecutando...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Ejecutar todos
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
            {Object.entries(scrapersByStep).map(([stepId, stepData]) => {
              const stepInfo = ANALYSIS_STEPS.find(s => s.id === stepId)
              const StepIcon = stepInfo?.icon || Circle
              const isComplete = stepData.completed === stepData.total
              const hasPending = stepData.completed < stepData.total

              return (
                <div key={stepId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StepIcon size={16} className={isComplete ? 'text-green-600' : 'text-gray-400'} />
                      <span className="text-sm font-medium text-gray-700">
                        {stepData.stepName}
                      </span>
                      <span className={`text-xs ${isComplete ? 'text-green-600' : 'text-gray-500'}`}>
                        ({stepData.completed}/{stepData.total})
                      </span>
                    </div>
                    {hasPending && (
                      <button
                        onClick={() => handleRunStepScrapers(stepId)}
                        className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                      >
                        Ejecutar todos
                      </button>
                    )}
                  </div>

                  <div className="space-y-1 pl-6">
                    {stepData.scrapers.map(scraper => {
                      // Check if this scraper is running (either via job persistence or deep research state)
                      const isRunning = scraper.sourceType === 'deep_research'
                        ? runningDeepResearch
                        : runningScrapers.has(scraper.sourceType)
                      const hasInput = !scraper.inputKey || !!scraper.inputValue

                      return (
                        <div
                          key={scraper.sourceType}
                          className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${
                            scraper.isCompleted ? 'bg-green-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isRunning ? (
                              <Loader2 size={14} className="text-indigo-500 animate-spin" />
                            ) : scraper.isCompleted ? (
                              <CheckCircle size={14} className="text-green-500" />
                            ) : hasInput ? (
                              <Circle size={14} className="text-indigo-400" />
                            ) : (
                              <Circle size={14} className="text-gray-300" />
                            )}
                            <span className={`text-sm ${
                              scraper.isCompleted ? 'text-green-700' : 'text-gray-600'
                            }`}>
                              {scraper.name}
                            </span>

                            {/* Status Badge */}
                            {(() => {
                              const status = getScraperStatus(scraper)
                              return (
                                <span className={`
                                  flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                                  ${status.badge.color === 'green' ? 'bg-green-100 text-green-700' : ''}
                                  ${status.badge.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : ''}
                                  ${status.badge.color === 'blue' ? 'bg-blue-100 text-blue-700' : ''}
                                  ${status.badge.color === 'amber' ? 'bg-amber-100 text-amber-700' : ''}
                                `}>
                                  {status.badge.icon}
                                  <span>{status.badge.text}</span>
                                </span>
                              )
                            })()}
                          </div>

                          <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => handleRunScraper(scraper.sourceType)}
                                disabled={isRunning}
                                className={`p-1.5 rounded transition-colors ${
                                  isRunning
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                }`}
                                title="Configurar scraper"
                              >
                                <Settings size={14} />
                              </button>
                              <button
                                onClick={() => handleRunScraper(scraper.sourceType)}
                                disabled={isRunning}
                                className={`p-1.5 rounded transition-colors ${
                                  isRunning
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-indigo-600 hover:bg-indigo-100'
                                }`}
                                title={scraper.isCompleted ? 'Re-ejecutar scraper' : 'Ejecutar scraper'}
                              >
                                <Play size={14} />
                              </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Scraper History - collapsible */}
          {showScraperHistory && jobHistory.length > 0 && (
            <div className="border-t border-gray-100 p-4 space-y-2 bg-gray-50">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Ejecuciones recientes
              </h4>
              {jobHistory.map((job) => {
                const isSuccess = job.status === 'completed'
                const timeAgo = job.completedAt
                  ? formatTimeAgo(new Date(job.completedAt))
                  : formatTimeAgo(new Date(job.startedAt))

                return (
                  <div
                    key={job.jobId}
                    className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${
                      isSuccess ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSuccess ? (
                        <CheckCircle size={14} className="text-green-500" />
                      ) : (
                        <XCircle size={14} className="text-red-500" />
                      )}
                      <span className={isSuccess ? 'text-green-800' : 'text-red-800'}>
                        {job.scraperName}
                      </span>
                      <span className={`text-xs ${isSuccess ? 'text-green-500' : 'text-red-500'}`}>
                        {timeAgo}
                      </span>
                    </div>
                    {isSuccess && job.documentId && (
                      <button
                        onClick={() => {
                          const doc = documents.find(d => d.id === job.documentId)
                          if (doc) {
                            setViewingDoc(doc)
                          } else {
                            onRefresh()
                          }
                        }}
                        className="text-xs px-2 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                      >
                        <FileText size={12} />
                        Ver
                      </button>
                    )}
                    {!isSuccess && job.error && (
                      <span className="text-xs text-red-500 max-w-[180px] truncate" title={job.error}>
                        {job.error}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Analysis Flow */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <Sparkles size={20} className="text-purple-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Flujo de Análisis</h3>
              <p className="text-sm text-gray-500">
                {Object.values(analysisStepStatus).filter(s => s.isCompleted).length}/{ANALYSIS_STEPS.length} pasos completados
              </p>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* Variable status warning */}
            {COMPETITOR_VARIABLE_DEFINITIONS.some(v => v.required && !campaign.custom_variables?.[v.name]) && (
              <button
                onClick={() => setShowConfigModal(true)}
                className="w-full p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 hover:bg-amber-100 transition-colors text-left"
              >
                <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
                <span className="text-xs text-amber-800">
                  <span className="font-medium">Variables incompletas</span> &mdash;{' '}
                  {COMPETITOR_VARIABLE_DEFINITIONS.filter(v => v.required && campaign.custom_variables?.[v.name]).length}/
                  {COMPETITOR_VARIABLE_DEFINITIONS.filter(v => v.required).length} requeridas.
                  Click para editar.
                </span>
              </button>
            )}

            {ANALYSIS_STEPS.map((step, index) => {
              const status = analysisStepStatus[step.id]
              const StepIcon = step.icon
              const isExpanded = expandedSteps.has(step.id)
              // Get saved config for this step from custom_variables (campaign-specific edits)
              const configKey = `${step.id}_config`
              const savedStepConfig = campaign.custom_variables?.[configKey] as { prompt?: string } | undefined

              // Get prompt from flow_config if available (from customized playbook snapshot)
              const flowStepId = STEP_ID_MAPPING[step.id]
              const flowStep = campaign.flow_config?.steps?.find(
                (s: { id: string; prompt?: string }) => s.id === flowStepId
              )

              // DEBUG: Log prompt resolution
              console.log(`[PREVIEW DEBUG] Step ${step.id}:`, {
                configKey,
                flowStepId,
                hasSavedConfig: !!savedStepConfig,
                hasFlowConfig: !!campaign.flow_config,
                flowConfigStepsCount: campaign.flow_config?.steps?.length || 0,
                flowConfigStepIds: campaign.flow_config?.steps?.map((s: {id: string}) => s.id) || [],
                flowStepFound: !!flowStep,
                flowStepPromptLength: flowStep?.prompt?.length,
                usingSource: savedStepConfig?.prompt ? 'campaign_edit' : flowStep?.prompt ? 'playbook_custom' : 'base_template'
              })

              // Priority: campaign edit > playbook customization > base template
              const promptText = savedStepConfig?.prompt
                || flowStep?.prompt
                || ALL_PROMPTS[step.promptKey]
              const promptVariables = extractPromptVariables(promptText)

              // Get matching documents for this step's required sources (filtered by current competitor)
              const matchingDocs = documents.filter(doc =>
                step.requiredSources.includes(doc.source_metadata?.source_type || '') &&
                doc.source_metadata?.competitor?.toLowerCase() === normalizedName
              )

              return (
                <div
                  key={step.id}
                  className={`rounded-xl border transition-colors ${
                    status?.isCompleted
                      ? 'bg-green-50 border-green-200'
                      : status?.canRun
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {/* Header - clickable to expand */}
                  <div
                    className="p-4 cursor-pointer hover:bg-black/5 transition-colors"
                    onClick={() => {
                      setExpandedSteps(prev => {
                        const newSet = new Set(prev)
                        if (newSet.has(step.id)) {
                          newSet.delete(step.id)
                        } else {
                          newSet.add(step.id)
                        }
                        return newSet
                      })
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-xl text-xl font-bold shadow-sm ${
                          status?.isCompleted
                            ? 'bg-green-600 text-white'
                            : status?.canRun
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-300 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <StepIcon size={16} className={
                              status?.isCompleted
                                ? 'text-green-600'
                                : status?.canRun
                                  ? 'text-indigo-600'
                                  : 'text-gray-400'
                            } />
                            <span className={`font-medium ${
                              status?.isCompleted
                                ? 'text-green-700'
                                : status?.canRun
                                  ? 'text-indigo-700'
                                  : 'text-gray-700'
                            }`}>
                              {step.name}
                            </span>
                            {isExpanded ? (
                              <ChevronDown size={16} className="text-gray-400" />
                            ) : (
                              <ChevronRight size={16} className="text-gray-400" />
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {step.description}
                          </p>
                          {status?.blockedReason && (
                            <p className="text-xs text-red-600 mt-1">
                              {status.blockedReason}
                            </p>
                          )}
                          {!status?.blockedReason && status?.scraperWarning && (
                            <p className="text-xs text-amber-600 mt-1">
                              {status.scraperWarning}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {status?.isRunning ? (
                          <Loader2 size={20} className="text-indigo-500 animate-spin" />
                        ) : status?.isCompleted ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRunAnalysisStep(step.id)}
                              className="inline-flex items-center gap-1.5 text-sm px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                              title="Re-ejecutar paso"
                            >
                              <RefreshCw size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setViewingStepOutput({
                                  stepId: STEP_ID_MAPPING[step.id] || step.id,
                                  stepName: step.name,
                                  stepOrder: index + 1,
                                })
                              }}
                              className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                            >
                              <Eye size={14} />
                              Ver Resultado
                            </button>
                          </div>
                        ) : status?.canRun ? (
                          <button
                            onClick={() => handleRunAnalysisStep(step.id)}
                            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                          >
                            <Play size={14} />
                            Ejecutar
                          </button>
                        ) : (
                          <Lock size={18} className="text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-white/50">
                      {/* Edit Mode Header */}
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        {editingStepId === step.id ? (
                          <>
                            <span className="text-sm font-medium text-indigo-600">Modo Edición</span>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); cancelEditingStep() }}
                                className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); saveStepConfig() }}
                                disabled={isSavingStep}
                                className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors flex items-center gap-1"
                              >
                                {isSavingStep ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                Guardar
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="text-sm text-gray-500">Configuración del paso</span>
                            <div className="flex items-center gap-2">
                              {campaign.custom_variables?.[`${step.id}_config`] && campaigns.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleApplyConfigToAll(step.id)
                                  }}
                                  disabled={applyingToAll === step.id}
                                  className="px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={`Copiar esta configuración a los otros ${campaigns.length - 1} competidor${campaigns.length - 1 > 1 ? 'es' : ''}`}
                                >
                                  {applyingToAll === step.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                  Aplicar a todos
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const baseFlowStep = getFlowStepForAnalysis(step.id)
                                if (baseFlowStep) {
                                  // Load saved config from custom_variables (campaign-specific edits)
                                  const savedConfig = campaign.custom_variables?.[`${step.id}_config`] as {
                                    prompt?: string
                                    model?: string
                                    temperature?: number
                                    max_tokens?: number
                                    output_format?: string
                                    retrieval_mode?: string
                                    base_doc_ids?: string[]
                                  } | undefined

                                  // Get playbook-customized step from flow_config (if exists)
                                  const flowStepId = STEP_ID_MAPPING[step.id]
                                  const playbookStep = campaign.flow_config?.steps?.find(
                                    (s: { id: string; prompt?: string }) => s.id === flowStepId
                                  )

                                  // Merge dropdown selections with any extra docs from saved config
                                  // (docs added via StepEditor that don't map to any dropdown source)
                                  const dropdownDocIds = Object.values(selectedDocs[step.id] || {}).filter(Boolean)
                                  const savedDocIds: string[] = savedConfig?.base_doc_ids || (playbookStep as { base_doc_ids?: string[] })?.base_doc_ids || baseFlowStep.base_doc_ids || []
                                  const extraSavedDocs = savedDocIds.filter((id: string) => !dropdownDocIds.includes(id))
                                  const mergedDocIds = [...new Set([...dropdownDocIds, ...extraSavedDocs])]

                                  // Priority: campaign edit > playbook customization > base template
                                  setEditingFlowStep({
                                    ...baseFlowStep,
                                    prompt: savedConfig?.prompt || playbookStep?.prompt || baseFlowStep.prompt,
                                    model: savedConfig?.model || playbookStep?.model || baseFlowStep.model,
                                    temperature: savedConfig?.temperature ?? playbookStep?.temperature ?? baseFlowStep.temperature,
                                    max_tokens: savedConfig?.max_tokens ?? playbookStep?.max_tokens ?? baseFlowStep.max_tokens,
                                    output_format: savedConfig?.output_format || playbookStep?.output_format || baseFlowStep.output_format,
                                    retrieval_mode: savedConfig?.retrieval_mode || playbookStep?.retrieval_mode || baseFlowStep.retrieval_mode,
                                    base_doc_ids: mergedDocIds,
                                  } as FlowStep)
                                } else {
                                  toast.error('Error', 'No se encontró la configuración del paso')
                                }
                              }}
                              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5 text-sm font-medium shadow-sm"
                            >
                              <Edit3 size={14} />
                              Editar Configuración
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Variables Section */}
                      <div className="p-4 border-b border-gray-100">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                          <Variable size={14} />
                          Variables del Prompt
                        </div>
                        {editingStepId === step.id ? (
                          <div className="space-y-3">
                            {promptVariables.map(varName => {
                              const varDef = COMPETITOR_VARIABLE_DEFINITIONS.find(v => v.name === varName)
                              return (
                                <div key={varName}>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    {varName}
                                    {varDef?.required && <span className="text-red-500 ml-1">*</span>}
                                  </label>
                                  {varDef?.type === 'textarea' ? (
                                    <textarea
                                      value={stepVariables[varName] || ''}
                                      onChange={(e) => setStepVariables(prev => ({ ...prev, [varName]: e.target.value }))}
                                      placeholder={varDef?.placeholder || ''}
                                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                      rows={2}
                                      onClick={e => e.stopPropagation()}
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={stepVariables[varName] || ''}
                                      onChange={(e) => setStepVariables(prev => ({ ...prev, [varName]: e.target.value }))}
                                      placeholder={varDef?.placeholder || ''}
                                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                      onClick={e => e.stopPropagation()}
                                    />
                                  )}
                                  {varDef?.description && (
                                    <p className="text-xs text-gray-400 mt-0.5">{varDef.description}</p>
                                  )}
                                </div>
                              )
                            })}
                            {promptVariables.length === 0 && (
                              <span className="text-xs text-gray-500">No hay variables específicas</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {promptVariables.map(varName => {
                              const varDef = COMPETITOR_VARIABLE_DEFINITIONS.find(v => v.name === varName)
                              const value = campaign.custom_variables?.[varName]
                              return (
                                <div
                                  key={varName}
                                  className={`px-2 py-1 rounded text-xs ${
                                    value
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                  title={varDef?.description || varName}
                                >
                                  {varName}: {value || '(sin valor)'}
                                </div>
                              )
                            })}
                            {promptVariables.length === 0 && (
                              <span className="text-xs text-gray-500">No hay variables específicas</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Documents Section - With dropdown selector */}
                      <div className="p-4 border-b border-gray-100">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                          <Database size={14} />
                          Documentos Requeridos ({matchingDocs.length}/{step.requiredSources.length})
                        </div>
                        <div className="space-y-2">
                          {step.requiredSources.map(source => {
                            // Platform keywords for fuzzy matching by name/tags
                            const platformKeywords: Record<string, string[]> = {
                              'instagram_posts': ['instagram', 'ig', 'insta'],
                              'instagram_comments': ['instagram', 'ig', 'insta', 'comment'],
                              'facebook_posts': ['facebook', 'fb', 'meta'],
                              'facebook_comments': ['facebook', 'fb', 'meta', 'comment'],
                              'linkedin_posts': ['linkedin', 'li'],
                              'linkedin_comments': ['linkedin', 'li', 'comment'],
                              'linkedin_insights': ['linkedin', 'li', 'insight', 'analytics'],
                              'youtube_videos': ['youtube', 'yt', 'video'],
                              'youtube_comments': ['youtube', 'yt', 'comment'],
                              'tiktok_posts': ['tiktok', 'tt'],
                              'tiktok_comments': ['tiktok', 'tt', 'comment'],
                              'twitter_posts': ['twitter', 'x', 'tweet'],
                              'trustpilot_reviews': ['trustpilot', 'review'],
                              'g2_reviews': ['g2', 'review'],
                              'capterra_reviews': ['capterra', 'review'],
                              'playstore_reviews': ['play store', 'playstore', 'google play', 'android', 'review'],
                              'appstore_reviews': ['app store', 'appstore', 'ios', 'apple', 'review'],
                              'website': ['website', 'web', 'crawl', 'sitio'],
                              'deep_research': ['deep research', 'research', 'investigación'],
                              'seo_serp': ['seo', 'serp', 'search'],
                              'news_corpus': ['news', 'noticias', 'prensa', 'media'],
                            }

                            const keywords = platformKeywords[source] || [source.replace(/_/g, ' ')]

                            // Helper to check if doc matches platform by name/tags
                            const matchesPlatformByName = (doc: Document) => {
                              const docName = (doc.name || doc.filename || '').toLowerCase()
                              const docTags = (doc.tags || []).map((t: string) => t.toLowerCase())
                              return keywords.some(kw =>
                                docName.includes(kw) || docTags.some(tag => tag.includes(kw))
                              )
                            }

                            // Filter documents for current competitor only
                            const competitorDocs = documents.filter(d =>
                              d.source_metadata?.competitor?.toLowerCase() === normalizedName
                            )

                            // Match by source_type OR by platform keywords in name/tags
                            const matchingDocsForSource = competitorDocs.filter(d =>
                              d.source_metadata?.source_type === source || matchesPlatformByName(d)
                            )

                            const hasExplicitSelection = selectedDocs[step.id]?.[source] !== undefined
                            const explicitlyUnassigned = hasExplicitSelection && selectedDocs[step.id][source] === ''
                            const selectedDocId = hasExplicitSelection
                              ? selectedDocs[step.id][source]
                              : (matchingDocsForSource[0]?.id || '')
                            const selectedDoc = explicitlyUnassigned
                              ? undefined
                              : (competitorDocs.find(d => d.id === selectedDocId) || matchingDocsForSource[0])
                            const hasDoc = !explicitlyUnassigned && matchingDocsForSource.length > 0

                            return (
                              <div
                                key={source}
                                className={`p-2 rounded-lg border ${
                                  hasDoc ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {hasDoc ? (
                                      <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                                    ) : (
                                      <Circle size={14} className="text-gray-300 flex-shrink-0" />
                                    )}
                                    <span className={`text-xs font-medium ${hasDoc ? 'text-green-700' : 'text-gray-500'}`}>
                                      {SOURCE_TYPE_LABELS[source] || source}
                                    </span>
                                    {matchingDocsForSource.length > 1 && (
                                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                        {matchingDocsForSource.length} docs
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <DocumentSelect
                                      docs={competitorDocs}
                                      selectedDocId={selectedDocId}
                                      onSelect={(newDocId) => {
                                        setSelectedDocs(prev => ({
                                          ...prev,
                                          [step.id]: { ...prev[step.id], [source]: newDocId }
                                        }))
                                      }}
                                    />

                                    {/* View button */}
                                    {selectedDoc && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setViewingDoc(selectedDoc)
                                        }}
                                        className="p-1 text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                                        title="Ver documento"
                                      >
                                        <Eye size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Show selected document name if different from source label */}
                                {selectedDoc && (selectedDoc.name || selectedDoc.filename) && (
                                  <div className="mt-1 pl-6 text-xs text-gray-500 truncate">
                                    📄 {selectedDoc.name || selectedDoc.filename}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                          {step.requiredSources.length === 0 && (
                            <span className="text-xs text-gray-500">
                              Este paso usa outputs de pasos anteriores
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Prompt Preview/Edit Section */}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <Code size={14} />
                            {editingStepId === step.id ? 'Editar Prompt' : 'Preview del Prompt'}
                          </div>
                          <span className="text-xs text-gray-400">
                            {(editingStepId === step.id ? stepPrompts[step.id]?.length : promptText.length) || 0} caracteres
                          </span>
                        </div>
                        {editingStepId === step.id ? (
                          <textarea
                            value={stepPrompts[step.id] || promptText}
                            onChange={(e) => setStepPrompts(prev => ({ ...prev, [step.id]: e.target.value }))}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full min-h-[400px] px-4 py-3 bg-slate-800 text-white rounded-xl text-sm font-mono resize-y focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
                            placeholder="Escribe el prompt para este paso..."
                          />
                        ) : (
                          <div className="bg-slate-800 text-white p-4 rounded-xl text-sm font-mono max-h-[400px] overflow-y-auto whitespace-pre-wrap">
                            {promptText.slice(0, 2000)}
                            {promptText.length > 2000 && '...'}
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {editingStepId === step.id
                            ? 'Puedes personalizar el prompt. Usa {{variable}} para variables.'
                            : `${promptText.length} caracteres total`
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Configuration Modal - Full fields like ScraperLauncher */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-semibold text-gray-900">{confirmModal.scraperName}</h3>
                <p className="text-sm text-gray-500">Configura los parámetros antes de ejecutar</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSuggestAI}
                  disabled={confirmModal.isSuggestingAI}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {confirmModal.isSuggestingAI ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  Sugerir por IA
                </button>
                <button
                  onClick={() => setConfirmModal(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Render all fields from schema */}
              {(() => {
                const fields = getAllFieldsForScraper(confirmModal.scraperType)
                if (fields.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      <p>No hay campos configurables para este scraper</p>
                    </div>
                  )
                }

                return fields.map((field: FieldSchema) => {
                  const value = confirmModal.inputConfig[field.key]
                  const error = confirmModal.fieldErrors[field.key]
                  const baseInputClasses = `w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 ${
                    error ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`

                  // Render based on field type
                  switch (field.type) {
                    case 'boolean':
                      return (
                        <label key={field.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                          <input
                            type="checkbox"
                            checked={(value as boolean) ?? field.defaultValue ?? false}
                            onChange={(e) => handleModalFieldChange(field.key, e.target.checked)}
                            className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                          />
                          <div>
                            <span className="text-sm text-gray-700 font-medium">{field.label}</span>
                            {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
                          </div>
                        </label>
                      )

                    case 'select':
                      return (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
                          <select
                            value={(value as string) ?? field.defaultValue ?? ''}
                            onChange={(e) => handleModalFieldChange(field.key, e.target.value)}
                            className={`${baseInputClasses} bg-white`}
                          >
                            <option value="">Seleccionar...</option>
                            {field.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}{opt.description ? ` - ${opt.description}` : ''}
                              </option>
                            ))}
                          </select>
                          {field.helpText && <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>}
                          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
                        </div>
                      )

                    case 'number':
                      return (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
                          <input
                            type="number"
                            value={(value as number) ?? field.defaultValue ?? ''}
                            onChange={(e) => handleModalFieldChange(field.key, parseInt(e.target.value) || 0)}
                            min={field.validation?.min}
                            max={field.validation?.max}
                            className={baseInputClasses}
                          />
                          {field.helpText && <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>}
                          {field.validation && (field.validation.min !== undefined || field.validation.max !== undefined) && (
                            <p className="text-xs text-gray-400 mt-1">
                              Rango: {field.validation.min ?? 0} - {field.validation.max ?? '∞'}
                            </p>
                          )}
                          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
                        </div>
                      )

                    case 'url-array':
                    case 'text-array':
                      const arrayValue = Array.isArray(value)
                        ? value.map(item => typeof item === 'object' && item !== null && 'url' in item ? (item as {url: string}).url : String(item)).join('\n')
                        : (typeof value === 'string' ? value : '')
                      return (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
                          <textarea
                            value={arrayValue}
                            onChange={(e) => {
                              // Store raw text while typing - only split into array on lines that are complete
                              // This preserves spaces within lines (e.g. "Getnet España")
                              const raw = e.target.value
                              const lines = raw.split('\n')
                              // Keep as raw string to preserve spaces; convert to array on submit
                              handleModalFieldChange(field.key, lines.length > 1 ? lines.filter(s => s.trim()) : raw)
                            }}
                            rows={3}
                            placeholder={field.placeholder}
                            className={baseInputClasses}
                          />
                          {field.helpText && <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>}
                          {field.examples && field.examples.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              Ejemplos: {field.examples.slice(0, 3).join(', ')}
                            </p>
                          )}
                          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
                        </div>
                      )

                    case 'url':
                    case 'text':
                    default:
                      return (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
                          <input
                            type={field.type === 'url' ? 'url' : 'text'}
                            value={(value as string) || ''}
                            onChange={(e) => handleModalFieldChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className={baseInputClasses}
                          />
                          {field.helpText && <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>}
                          {field.examples && field.examples.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              Ej: {field.examples[0]}
                            </p>
                          )}
                          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
                        </div>
                      )
                  }
                })
              })()}

              {/* Output Format Selection */}
              <div className="pt-4 mt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Formato de salida
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { value: 'json', label: 'JSON', desc: 'Estructurado' },
                    { value: 'jsonl', label: 'JSONL', desc: 'Una línea/item' },
                    { value: 'csv', label: 'CSV', desc: 'Para Excel' },
                    { value: 'markdown', label: 'Markdown', desc: 'Texto legible' },
                    { value: 'xml', label: 'XML', desc: 'Formato XML' },
                  ].map((format) => (
                    <button
                      key={format.value}
                      type="button"
                      onClick={() => handleOutputFormatChange(format.value as ScraperOutputFormat)}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        confirmModal.outputFormat === format.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-xs">{format.label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{format.desc}</div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  El formato determina cómo se guardan los datos en el documento.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={executeScraperConfirmed}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <Play size={16} />
                Ejecutar Scraper
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && (
        <ScraperConfigModal
          campaign={campaign}
          projectId={projectId}
          onClose={() => setShowConfigModal(false)}
          onSaved={handleConfigSaved}
        />
      )}

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900 truncate">
                  {viewingDoc.name || viewingDoc.filename || 'Documento'}
                </h3>
                <p className="text-sm text-gray-500">
                  {viewingDoc.source_metadata?.source_type && (
                    <span className="inline-flex items-center gap-1">
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                        {SOURCE_TYPE_LABELS[viewingDoc.source_metadata.source_type] || viewingDoc.source_metadata.source_type}
                      </span>
                    </span>
                  )}
                  {viewingDoc.created_at && (
                    <span className="ml-2 text-xs text-gray-400">
                      {new Date(viewingDoc.created_at).toLocaleDateString('es-ES')}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {viewingDoc.extracted_content ? (
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg max-h-full overflow-auto">
                  {viewingDoc.extracted_content}
                </pre>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No hay contenido disponible para este documento</p>
                  <p className="text-sm mt-2">El contenido se extrae después de ejecutar el scraper</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setViewingDoc(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step Output Editor Modal */}
      {viewingStepOutput && campaign.step_outputs?.[viewingStepOutput.stepId] && (
        <StepOutputEditor
          campaignId={campaign.id}
          campaignName={competitorName}
          stepId={viewingStepOutput.stepId}
          stepName={viewingStepOutput.stepName}
          stepOrder={viewingStepOutput.stepOrder}
          currentOutput={campaign.step_outputs[viewingStepOutput.stepId] as {
            step_name: string
            output: string
            tokens?: number
            status: string
            completed_at?: string
            edited_at?: string
            original_output?: string
            model_used?: string
            model_provider?: string
            input_tokens?: number
            output_tokens?: number
            input_documents?: Array<{ id: string; filename: string; category: string; token_count: number }>
            previous_steps?: Array<{ id: string; name: string }>
          }}
          allStepOutputs={campaign.step_outputs as Record<string, any>}
          onSave={async (updatedStepOutputs) => {
            try {
              const response = await fetch('/api/campaigns/update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: campaign.id,
                  step_outputs: updatedStepOutputs,
                }),
              })
              if (!response.ok) throw new Error('Failed to save')
              toast.success('Guardado', 'Resultado actualizado')
              onRefresh()
            } catch (error) {
              console.error('Error saving step output:', error)
              toast.error('Error', 'No se pudo guardar el resultado')
            }
          }}
          onClose={() => setViewingStepOutput(null)}
          projectId={projectId}
          campaignVariables={campaign.custom_variables}
        />
      )}

      {/* StepEditor Modal - Full configuration editor */}
      {editingFlowStep && (
        <StepEditor
          step={editingFlowStep}
          projectId={projectId}
          clientId={clientId}
          documents={documents}
          allSteps={COMPETITOR_FLOW_STEPS as unknown as FlowStep[]}
          projectVariables={COMPETITOR_VARIABLE_DEFINITIONS.map(v => ({
            name: v.name,
            default_value: v.default_value || v.placeholder || '',
            description: v.description,
          }))}
          campaignVariables={campaign.custom_variables || {}}
          onSave={handleSaveFlowStep}
          onCancel={() => setEditingFlowStep(null)}
        />
      )}
    </div>
  )
}
