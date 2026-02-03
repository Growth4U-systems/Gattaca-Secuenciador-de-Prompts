'use client'

/**
 * CompetitorAnalysisView Component
 *
 * Main view for Competitor Analysis playbook with two levels:
 * 1. Summary view - List of competitors with progress overview
 * 2. Detail view - Full scraper + flow management for one competitor
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus,
  Loader2,
  Search,
  Users,
  RefreshCw,
} from 'lucide-react'
import { useToast } from '@/components/ui'
import CompetitorSummaryCard from './CompetitorSummaryCard'
import CompetitorDetailView from './CompetitorDetailView'
import AddCompetitorModal from './AddCompetitorModal'

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

export interface CompetitorAnalysisViewProps {
  projectId: string
  playbookId?: string
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CompetitorAnalysisView({
  projectId,
  playbookId,
}: CompetitorAnalysisViewProps) {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast

  // State
  const [campaigns, setCampaigns] = useState<CompetitorCampaign[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Load competitor campaigns
  const loadCampaigns = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaign/list?projectId=${projectId}&playbookType=competitor_analysis`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      if (data.success) {
        setCampaigns(data.campaigns || [])
      }
    } catch (error) {
      console.error('Error loading campaigns:', error)
      toastRef.current.error('Error', 'No se pudieron cargar los competidores')
    }
  }, [projectId])

  // Load documents (Context Lake)
  const loadDocuments = useCallback(async () => {
    try {
      const response = await fetch(`/api/documents?projectId=${projectId}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      if (data.success) {
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Error loading documents:', error)
    }
  }, [projectId])

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([loadCampaigns(), loadDocuments()])
      setLoading(false)
    }
    load()
  }, [loadCampaigns, loadDocuments])

  // Refresh data
  const handleRefresh = useCallback(async () => {
    await Promise.all([loadCampaigns(), loadDocuments()])
  }, [loadCampaigns, loadDocuments])

  // Handle competitor added
  const handleCompetitorAdded = async (name: string, website: string) => {
    setShowAddModal(false)
    await loadCampaigns()
    toast.success('Competidor agregado', `${name} agregado exitosamente.`)
  }

  // Handle competitor deleted
  const handleDeleteCompetitor = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaign/${campaignId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al eliminar')
      }

      // Remove from local state
      setCampaigns(prev => prev.filter(c => c.id !== campaignId))
      toast.success('Eliminado', 'Competidor eliminado correctamente')
    } catch (error) {
      console.error('Error deleting competitor:', error)
      toast.error('Error', error instanceof Error ? error.message : 'No se pudo eliminar el competidor')
    }
  }

  // Get selected campaign
  const selectedCampaign = selectedCampaignId
    ? campaigns.find(c => c.id === selectedCampaignId)
    : null

  // Filter campaigns by search query
  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.ecp_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Cargando competidores...</p>
        </div>
      </div>
    )
  }

  // Detail view
  if (selectedCampaign) {
    return (
      <CompetitorDetailView
        campaign={selectedCampaign}
        documents={documents}
        projectId={projectId}
        onBack={() => setSelectedCampaignId(null)}
        onRefresh={handleRefresh}
      />
    )
  }

  // Summary view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Competitor Analysis</h2>
          <p className="text-sm text-gray-500 mt-1">
            {campaigns.length} competidor{campaigns.length !== 1 ? 'es' : ''} · Selecciona uno para ver detalles
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
          >
            <Plus size={18} />
            Agregar Competidor
          </button>
        </div>
      </div>

      {/* Search - only show if there are competitors */}
      {campaigns.length > 0 && (
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar competidor..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Empty state */}
      {campaigns.length === 0 && (
        <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-indigo-50 rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-indigo-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Comienza agregando un competidor
          </h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Agrega los competidores que quieres analizar. El sistema te guiará a través de los pasos
            para recopilar información y generar un análisis completo.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-lg"
          >
            <Plus size={20} />
            Agregar Primer Competidor
          </button>
        </div>
      )}

      {/* Competitor list */}
      {filteredCampaigns.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCampaigns.map(campaign => (
            <CompetitorSummaryCard
              key={campaign.id}
              campaign={campaign}
              documents={documents}
              onClick={() => setSelectedCampaignId(campaign.id)}
              onDelete={handleDeleteCompetitor}
            />
          ))}
        </div>
      )}

      {/* No results from search */}
      {campaigns.length > 0 && filteredCampaigns.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No se encontraron competidores con &quot;{searchQuery}&quot;</p>
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
