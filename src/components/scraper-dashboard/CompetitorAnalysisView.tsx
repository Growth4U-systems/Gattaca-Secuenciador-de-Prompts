'use client'

/**
 * CompetitorAnalysisView Component
 *
 * Main view for Competitor Analysis playbook.
 * Replaces the tab-based navigation with a competitor-centric guided UX.
 *
 * Shows all competitors with their:
 * - Scraper progress
 * - Analysis steps
 * - Pending actions
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
import CompetitorCard from './CompetitorCard'
import AddCompetitorModal from './AddCompetitorModal'
import ScraperConfigModal from './ScraperConfigModal'

// ============================================
// TYPES
// ============================================

interface CompetitorCampaign {
  id: string
  ecp_name: string
  custom_variables: Record<string, string>
  created_at: string
  status: string
  step_outputs?: Record<string, any>
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
  const [configModalCampaign, setConfigModalCampaign] = useState<CompetitorCampaign | null>(null)
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

  // Handle competitor added
  const handleCompetitorAdded = async (name: string, website: string) => {
    setShowAddModal(false)
    await loadCampaigns()
    toast.success('Competidor agregado', `${name} agregado exitosamente. Configura los scrapers para comenzar.`)
  }

  // Handle configure inputs
  const handleConfigureInputs = (campaign: CompetitorCampaign) => {
    setConfigModalCampaign(campaign)
  }

  // Handle discover socials (scrape website for social links)
  const handleDiscoverSocials = async (campaign: CompetitorCampaign) => {
    const website = campaign.custom_variables?.competitor_website
    if (!website) {
      toast.error('Error', 'No hay sitio web configurado')
      return
    }

    toast.info('Descubriendo...', 'Escaneando sitio web para encontrar redes sociales')

    // TODO: Implement website scraping for social links
    // This should:
    // 1. Scrape the website (footer, header, contact page)
    // 2. Find social media links
    // 3. Update campaign.custom_variables with found links
    console.log('TODO: Discover socials from', website)

    toast.warning('En desarrollo', 'Esta función está en desarrollo')
  }

  // Handle run scrapers for a step
  const handleRunScrapers = async (campaign: CompetitorCampaign, stepId: string) => {
    // TODO: Implement batch scraper execution
    console.log('Run scrapers for', campaign.ecp_name, 'step:', stepId)
    toast.info('Ejecutando...', `Iniciando scrapers para ${stepId}`)
  }

  // Handle run analysis step
  const handleRunAnalysis = async (campaign: CompetitorCampaign, stepId: string) => {
    // TODO: Navigate to campaign runner or execute step
    console.log('Run analysis step', stepId, 'for', campaign.ecp_name)
    toast.info('Ejecutando...', `Iniciando análisis: ${stepId}`)
  }

  // Handle view results
  const handleViewResults = (campaign: CompetitorCampaign, stepId: string) => {
    // TODO: Navigate to results or show modal
    console.log('View results for', stepId)
  }

  // Handle inputs saved
  const handleInputsSaved = async () => {
    setConfigModalCampaign(null)
    await loadCampaigns()
    toast.success('Guardado', 'Configuración actualizada')
  }

  // Filter campaigns by search query
  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.ecp_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Calculate overall stats
  const stats = {
    total: campaigns.length,
    withScrapers: campaigns.filter(c => {
      const name = c.ecp_name
      return documents.some(d => d.source_metadata?.competitor?.toLowerCase() === name?.toLowerCase())
    }).length,
  }

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Competitor Analysis</h2>
          <p className="text-sm text-gray-500 mt-1">
            {stats.total} competidor{stats.total !== 1 ? 'es' : ''} · Analiza y compara
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadCampaigns()
              loadDocuments()
            }}
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
        <div className="space-y-4">
          {filteredCampaigns.map(campaign => (
            <CompetitorCard
              key={campaign.id}
              campaign={campaign}
              documents={documents}
              projectId={projectId}
              onConfigureInputs={() => handleConfigureInputs(campaign)}
              onDiscoverSocials={() => handleDiscoverSocials(campaign)}
              onRunScrapers={(stepId) => handleRunScrapers(campaign, stepId)}
              onRunAnalysis={(stepId) => handleRunAnalysis(campaign, stepId)}
              onViewResults={(stepId) => handleViewResults(campaign, stepId)}
            />
          ))}
        </div>
      )}

      {/* No results from search */}
      {campaigns.length > 0 && filteredCampaigns.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No se encontraron competidores con "{searchQuery}"</p>
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

      {/* Configure Inputs Modal */}
      {configModalCampaign && (
        <ScraperConfigModal
          campaign={configModalCampaign}
          projectId={projectId}
          onClose={() => setConfigModalCampaign(null)}
          onSaved={handleInputsSaved}
        />
      )}
    </div>
  )
}
