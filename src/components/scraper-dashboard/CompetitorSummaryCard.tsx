'use client'

/**
 * CompetitorSummaryCard Component
 *
 * Compact card showing competitor overview with progress bars.
 * Used in the summary view - click to open detail view.
 */

import { useMemo } from 'react'
import {
  Globe,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  Clock,
  Search,
  Sparkles,
} from 'lucide-react'
import { STEP_DOCUMENT_REQUIREMENTS } from '@/lib/playbooks/competitor-analysis/constants'

// ============================================
// TYPES
// ============================================

interface CompetitorCampaign {
  id: string
  ecp_name: string
  custom_variables: Record<string, string>
  created_at: string
  status: string
  step_outputs?: Record<string, unknown>
}

interface Document {
  id: string
  name?: string
  source_metadata?: {
    source_type?: string
    competitor?: string
  }
}

interface CompetitorSummaryCardProps {
  campaign: CompetitorCampaign
  documents: Document[]
  onClick: () => void
}

// Total analysis steps
const TOTAL_ANALYSIS_STEPS = 5

// ============================================
// MAIN COMPONENT
// ============================================

export default function CompetitorSummaryCard({
  campaign,
  documents,
  onClick,
}: CompetitorSummaryCardProps) {
  const competitorName = campaign.ecp_name || ''
  const normalizedName = competitorName.toLowerCase()
  const website = campaign.custom_variables?.competitor_website || ''

  // Calculate scraper progress
  const scraperProgress = useMemo(() => {
    let completed = 0
    let total = 0

    STEP_DOCUMENT_REQUIREMENTS.forEach(step => {
      step.source_types.forEach(sourceType => {
        total++
        const hasDoc = documents.some(doc =>
          doc.source_metadata?.source_type === sourceType &&
          doc.source_metadata?.competitor?.toLowerCase() === normalizedName
        )
        if (hasDoc) completed++
      })
    })

    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [documents, normalizedName])

  // Calculate analysis/flow progress
  const flowProgress = useMemo(() => {
    const outputs = campaign.step_outputs || {}
    const completed = Object.keys(outputs).length
    const total = TOTAL_ANALYSIS_STEPS
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [campaign.step_outputs])

  // Overall status
  const status = useMemo(() => {
    if (flowProgress.completed === flowProgress.total) {
      return { label: 'Completado', color: 'green', icon: CheckCircle }
    }
    if (scraperProgress.completed < scraperProgress.total) {
      return { label: 'Scrapers pendientes', color: 'amber', icon: AlertTriangle }
    }
    if (flowProgress.completed > 0) {
      return { label: 'En progreso', color: 'blue', icon: Clock }
    }
    return { label: 'Sin iniciar', color: 'gray', icon: Clock }
  }, [scraperProgress, flowProgress])

  const StatusIcon = status.icon

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{competitorName}</h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full
              ${status.color === 'green' ? 'bg-green-100 text-green-700' : ''}
              ${status.color === 'amber' ? 'bg-amber-100 text-amber-700' : ''}
              ${status.color === 'blue' ? 'bg-blue-100 text-blue-700' : ''}
              ${status.color === 'gray' ? 'bg-gray-100 text-gray-600' : ''}
            `}>
              <StatusIcon size={12} />
              {status.label}
            </span>
          </div>

          {website && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
              <Globe size={14} />
              <span className="truncate">{website.replace(/^https?:\/\//, '')}</span>
            </div>
          )}

          {/* Progress bars */}
          <div className="space-y-2">
            {/* Scrapers progress */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 w-24 text-xs text-gray-500">
                <Search size={12} />
                <span>Scrapers</span>
              </div>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    scraperProgress.percentage === 100 ? 'bg-green-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${scraperProgress.percentage}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-12 text-right">
                {scraperProgress.completed}/{scraperProgress.total}
              </span>
            </div>

            {/* Flow progress */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 w-24 text-xs text-gray-500">
                <Sparkles size={12} />
                <span>Análisis</span>
              </div>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    flowProgress.percentage === 100 ? 'bg-green-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${flowProgress.percentage}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-12 text-right">
                {flowProgress.completed}/{flowProgress.total}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Arrow */}
        <div className="flex-shrink-0 self-center">
          <ChevronRight
            size={20}
            className="text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all"
          />
        </div>
      </div>
    </button>
  )
}
