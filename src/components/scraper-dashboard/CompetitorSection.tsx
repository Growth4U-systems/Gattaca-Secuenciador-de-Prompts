'use client'

/**
 * CompetitorSection Component
 *
 * Collapsible section showing all scrapers for a single competitor,
 * grouped by playbook step.
 */

import { useState, useMemo } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Play,
  Loader2,
  CheckCircle,
  Circle,
  XCircle,
  Globe,
  Search,
  MessageSquare,
  Star,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import {
  ALL_DOCUMENT_REQUIREMENTS,
  STEP_DOCUMENT_REQUIREMENTS,
  SCRAPER_INPUT_MAPPINGS,
} from '@/lib/playbooks/competitor-analysis/constants'
import type { DocumentRequirement } from '@/lib/playbooks/competitor-analysis/types'
import ScraperRow from './ScraperRow'

// ============================================
// TYPES
// ============================================

interface CompetitorCampaign {
  id: string
  ecp_name: string
  custom_variables: Record<string, string>
  created_at: string
  status: string
}

interface Document {
  id: string
  source_metadata?: {
    source_type?: string
    competitor?: string
  }
}

interface CompetitorSectionProps {
  campaign: CompetitorCampaign
  isExpanded: boolean
  onToggle: () => void
  documents: Document[]
  projectId: string
  filter: 'all' | 'pending' | 'completed' | 'failed'
  onDocumentGenerated: () => void
}

// Step info for grouping
const STEP_INFO: Record<string, { name: string; icon: React.ReactNode }> = {
  'autopercepcion': { name: 'Autopercepción', icon: <Sparkles size={16} /> },
  'percepcion-terceros': { name: 'Percepción Terceros', icon: <Search size={16} /> },
  'percepcion-rrss': { name: 'Percepción RRSS', icon: <MessageSquare size={16} /> },
  'percepcion-reviews': { name: 'Percepción Reviews', icon: <Star size={16} /> },
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CompetitorSection({
  campaign,
  isExpanded,
  onToggle,
  documents,
  projectId,
  filter,
  onDocumentGenerated,
}: CompetitorSectionProps) {
  const [selectedScrapers, setSelectedScrapers] = useState<Set<string>>(new Set())
  const [runningScrapers, setRunningScrapers] = useState<Set<string>>(new Set())

  const competitorName = campaign.ecp_name
  const website = campaign.custom_variables?.competitor_website || ''

  // Group scrapers by step
  const scrapersByStep = useMemo(() => {
    const grouped: Record<string, DocumentRequirement[]> = {}

    STEP_DOCUMENT_REQUIREMENTS.forEach(step => {
      const scrapers = ALL_DOCUMENT_REQUIREMENTS.filter(req =>
        step.source_types.includes(req.source_type)
      )
      if (scrapers.length > 0) {
        grouped[step.stepId] = scrapers
      }
    })

    return grouped
  }, [])

  // Check if a scraper has completed (document exists)
  const hasDocument = (sourceType: string): boolean => {
    return documents.some(doc =>
      doc.source_metadata?.source_type === sourceType &&
      doc.source_metadata?.competitor?.toLowerCase() === competitorName?.toLowerCase()
    )
  }

  // Get input value for a scraper from campaign variables
  const getInputValue = (docId: string): string => {
    const mapping = SCRAPER_INPUT_MAPPINGS[docId]
    if (!mapping) return ''

    // Map input keys to campaign variable names
    const variableMap: Record<string, string> = {
      url: 'competitor_website',
      domain: 'competitor_website',
      query: 'competitor_name',
      username: docId.includes('ig') ? 'instagram_username' :
                docId.includes('tiktok') ? 'tiktok_username' : '',
      companyUrl: 'linkedin_url',
      channelUrl: 'youtube_url',
      postUrls: 'linkedin_post_urls',
      videoUrls: 'youtube_video_urls',
      appId: docId.includes('play-store') ? 'play_store_app_id' :
             docId.includes('app-store') ? 'app_store_app_id' : '',
    }

    const variableName = variableMap[mapping.inputKey]
    if (variableName) {
      return campaign.custom_variables?.[variableName] || ''
    }

    return ''
  }

  // Calculate stats for this competitor
  const stats = useMemo(() => {
    let completed = 0
    let pending = 0
    let total = ALL_DOCUMENT_REQUIREMENTS.length

    ALL_DOCUMENT_REQUIREMENTS.forEach(req => {
      if (hasDocument(req.source_type)) {
        completed++
      } else {
        pending++
      }
    })

    return { completed, pending, total }
  }, [documents, competitorName])

  // Toggle scraper selection
  const toggleScraperSelection = (docId: string) => {
    setSelectedScrapers(prev => {
      const next = new Set(prev)
      if (next.has(docId)) {
        next.delete(docId)
      } else {
        next.add(docId)
      }
      return next
    })
  }

  // Handle running selected scrapers
  const handleRunSelected = async () => {
    // TODO: Implement batch execution
    console.log('Running selected scrapers:', Array.from(selectedScrapers))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown size={20} className="text-gray-400" />
          ) : (
            <ChevronRight size={20} className="text-gray-400" />
          )}
          <div className="text-left">
            <div className="font-semibold text-gray-900">{competitorName}</div>
            {website && (
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <Globe size={12} />
                {website.replace(/^https?:\/\//, '')}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${stats.completed === stats.total ? 'text-green-600' : 'text-gray-600'}`}>
              {stats.completed}/{stats.total}
            </span>
            {stats.completed === stats.total ? (
              <CheckCircle size={18} className="text-green-500" />
            ) : (
              <Circle size={18} className="text-gray-300" />
            )}
          </div>

          {/* Create campaign button */}
          {!campaign.status || campaign.status === 'draft' ? (
            <span className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
              Sin campaña
            </span>
          ) : (
            <a
              href={`/projects/${projectId}/campaigns/${campaign.id}`}
              onClick={(e) => e.stopPropagation()}
              className="px-3 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition-colors flex items-center gap-1"
            >
              Ver campaña
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Scrapers grouped by step */}
          {Object.entries(scrapersByStep).map(([stepId, scrapers]) => {
            const stepInfo = STEP_INFO[stepId] || { name: stepId, icon: <Circle size={16} /> }

            return (
              <div key={stepId} className="border-b border-gray-100 last:border-b-0">
                {/* Step header */}
                <div className="px-4 py-3 bg-gray-50 flex items-center gap-2">
                  <span className="text-gray-400">{stepInfo.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{stepInfo.name}</span>
                  <span className="text-xs text-gray-400">
                    ({scrapers.filter(s => hasDocument(s.source_type)).length}/{scrapers.length})
                  </span>
                </div>

                {/* Scrapers */}
                <div className="divide-y divide-gray-100">
                  {scrapers.map(scraper => {
                    const isCompleted = hasDocument(scraper.source_type)
                    const inputValue = getInputValue(scraper.id)
                    const isSelected = selectedScrapers.has(scraper.id)
                    const isRunning = runningScrapers.has(scraper.id)

                    // Apply filter
                    if (filter === 'completed' && !isCompleted) return null
                    if (filter === 'pending' && isCompleted) return null

                    return (
                      <ScraperRow
                        key={scraper.id}
                        scraper={scraper}
                        isCompleted={isCompleted}
                        isSelected={isSelected}
                        isRunning={isRunning}
                        inputValue={inputValue}
                        onToggleSelect={() => toggleScraperSelection(scraper.id)}
                        onInputChange={(value) => {
                          // TODO: Save to campaign custom_variables
                          console.log('Input changed:', scraper.id, value)
                        }}
                        onRun={() => {
                          // TODO: Run single scraper
                          console.log('Run scraper:', scraper.id)
                        }}
                        projectId={projectId}
                        campaignId={campaign.id}
                        competitorName={competitorName}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Actions bar */}
          {selectedScrapers.size > 0 && (
            <div className="p-4 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between">
              <span className="text-sm text-indigo-700">
                {selectedScrapers.size} scraper(s) seleccionados
              </span>
              <button
                onClick={handleRunSelected}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                <Play size={16} />
                Lanzar Seleccionados
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
