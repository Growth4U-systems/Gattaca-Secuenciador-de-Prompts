'use client'

/**
 * ScraperChecklist Component
 *
 * Main dashboard for managing scrapers across multiple competitors.
 * Shows a collapsible list of competitors with their scrapers grouped by playbook step.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Play,
  Loader2,
  CheckCircle,
  Circle,
  XCircle,
  AlertCircle,
  Filter,
} from 'lucide-react'
import { useToast } from '@/components/ui'
import {
  ALL_DOCUMENT_REQUIREMENTS,
  STEP_DOCUMENT_REQUIREMENTS,
  SCRAPER_INPUT_MAPPINGS,
} from '@/lib/playbooks/competitor-analysis/constants'
import type { DocumentRequirement, SourceType } from '@/lib/playbooks/competitor-analysis/types'
import CompetitorSection from './CompetitorSection'
import AddCompetitorModal from './AddCompetitorModal'

// ============================================
// TYPES
// ============================================

export interface CompetitorCampaign {
  id: string
  ecp_name: string // competitor name
  custom_variables: Record<string, string>
  created_at: string
  status: string
}

export interface ScraperChecklistProps {
  projectId: string
  playbookId?: string
}

type FilterType = 'all' | 'pending' | 'completed' | 'failed'

// ============================================
// MAIN COMPONENT
// ============================================

export default function ScraperChecklist({
  projectId,
  playbookId,
}: ScraperChecklistProps) {
  const toast = useToast()

  // State
  const [campaigns, setCampaigns] = useState<CompetitorCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCompetitors, setExpandedCompetitors] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [documents, setDocuments] = useState<Array<{ id: string; source_metadata?: { source_type?: string; competitor?: string } }>>([])

  // Load competitor campaigns
  const loadCampaigns = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaign/list?projectId=${projectId}&playbookType=competitor_analysis`)
      const data = await response.json()
      if (data.success) {
        setCampaigns(data.campaigns || [])
        // Auto-expand first competitor if only one
        if (data.campaigns?.length === 1) {
          setExpandedCompetitors(new Set([data.campaigns[0].id]))
        }
      }
    } catch (error) {
      console.error('Error loading campaigns:', error)
      toast.error('Error', 'No se pudieron cargar los competidores')
    } finally {
      setLoading(false)
    }
  }, [projectId, toast])

  // Load documents to check which scrapers have completed
  const loadDocuments = useCallback(async () => {
    try {
      const response = await fetch(`/api/documents?projectId=${projectId}`)
      const data = await response.json()
      if (data.success) {
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Error loading documents:', error)
    }
  }, [projectId])

  useEffect(() => {
    loadCampaigns()
    loadDocuments()
  }, [loadCampaigns, loadDocuments])

  // Toggle competitor expansion
  const toggleCompetitor = (campaignId: string) => {
    setExpandedCompetitors(prev => {
      const next = new Set(prev)
      if (next.has(campaignId)) {
        next.delete(campaignId)
      } else {
        next.add(campaignId)
      }
      return next
    })
  }

  // Calculate stats
  const stats = useMemo(() => {
    let total = 0
    let completed = 0
    let pending = 0
    let failed = 0

    campaigns.forEach(campaign => {
      const competitorName = campaign.ecp_name
      ALL_DOCUMENT_REQUIREMENTS.forEach(req => {
        total++
        const hasDoc = documents.some(doc =>
          doc.source_metadata?.source_type === req.source_type &&
          doc.source_metadata?.competitor?.toLowerCase() === competitorName?.toLowerCase()
        )
        if (hasDoc) {
          completed++
        } else {
          pending++
        }
      })
    })

    return { total, completed, pending, failed }
  }, [campaigns, documents])

  // Handle competitor added
  const handleCompetitorAdded = async (name: string, website: string) => {
    // Reload campaigns to show the new one
    await loadCampaigns()
    setShowAddModal(false)
    toast.success('Competidor agregado', `${name} agregado exitosamente`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Scrapers</h2>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona los scrapers de todos los competidores
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          Agregar Competidor
        </button>
      </div>

      {/* Stats & Filters */}
      <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
        <div className="flex items-center gap-6">
          <div className="text-sm">
            <span className="text-gray-500">Progreso:</span>
            <span className="ml-2 font-semibold text-gray-900">
              {stats.completed}/{stats.total}
            </span>
          </div>
          <div className="h-4 w-px bg-gray-300" />
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-green-500" />
              <span className="text-gray-600">{stats.completed}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Circle size={14} className="text-gray-400" />
              <span className="text-gray-600">{stats.pending}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <XCircle size={14} className="text-red-500" />
              <span className="text-gray-600">{stats.failed}</span>
            </span>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="completed">Completados</option>
            <option value="failed">Fallidos</option>
          </select>
        </div>
      </div>

      {/* Competitor List */}
      {campaigns.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sin competidores</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Agrega un competidor para comenzar a configurar los scrapers
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <Plus size={18} />
            Agregar Primer Competidor
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map(campaign => (
            <CompetitorSection
              key={campaign.id}
              campaign={campaign}
              isExpanded={expandedCompetitors.has(campaign.id)}
              onToggle={() => toggleCompetitor(campaign.id)}
              documents={documents}
              projectId={projectId}
              filter={filter}
              onDocumentGenerated={loadDocuments}
            />
          ))}
        </div>
      )}

      {/* Add Competitor Modal */}
      {showAddModal && (
        <AddCompetitorModal
          projectId={projectId}
          onClose={() => setShowAddModal(false)}
          onAdded={handleCompetitorAdded}
        />
      )}
    </div>
  )
}
