'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Search,
  Filter,
  Grid,
  List,
  Loader2,
  Rocket,
  CheckCircle,
  Clock,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Calendar,
} from 'lucide-react'
import CampaignCard from './CampaignCard'
import CampaignFullScreenView from './CampaignFullScreenView'
import { useToast, useModal } from '@/components/ui'

interface Campaign {
  id: string
  ecp_name: string
  status: string
  current_step_id: string | null
  step_outputs: Record<string, any>
  created_at: string
  started_at: string | null
  completed_at: string | null
  custom_variables?: Record<string, string>
  flow_config?: any
}

interface Project {
  id: string
  name: string
  playbook_type: string
  variable_definitions?: any[]
  flow_config?: any
}

interface CampaignsDashboardProps {
  projectId: string
  project: Project
  onCampaignSelect?: (campaignId: string) => void
  onCreateCampaign?: () => void
}

export default function CampaignsDashboard({
  projectId,
  project,
  onCampaignSelect,
  onCreateCampaign,
}: CampaignsDashboardProps) {
  const toast = useToast()
  const modal = useModal()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

  // Load campaigns
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/campaign/create?projectId=${projectId}`)
        const data = await response.json()
        if (data.success) {
          setCampaigns(data.campaigns || [])
        }
      } catch (error) {
        console.error('Error loading campaigns:', error)
        toast.error('Error', 'No se pudieron cargar las campanas')
      } finally {
        setLoading(false)
      }
    }

    loadCampaigns()
  }, [projectId, toast])

  // Calculate statistics
  const stats = useMemo(() => {
    const total = campaigns.length
    const completed = campaigns.filter((c) => c.status === 'completed').length
    const inProgress = campaigns.filter((c) => c.status === 'running').length
    const pending = campaigns.filter((c) => c.status === 'pending' || !c.status).length
    const withErrors = campaigns.filter((c) => c.status === 'error').length

    return { total, completed, inProgress, pending, withErrors }
  }, [campaigns])

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = campaign.ecp_name?.toLowerCase().includes(query)
        const matchesVars = Object.values(campaign.custom_variables || {}).some(
          (v) => typeof v === 'string' && v.toLowerCase().includes(query)
        )
        if (!matchesName && !matchesVars) return false
      }

      // Status filter
      if (statusFilter !== 'all') {
        const campaignStatus = campaign.status || 'pending'
        if (statusFilter === 'pending' && campaignStatus !== 'pending') return false
        if (statusFilter === 'running' && campaignStatus !== 'running') return false
        if (statusFilter === 'completed' && campaignStatus !== 'completed') return false
        if (statusFilter === 'error' && campaignStatus !== 'error') return false
      }

      return true
    })
  }, [campaigns, searchQuery, statusFilter])

  // Get total steps from project flow config
  const totalSteps = project?.flow_config?.steps?.length || 0

  // Reload campaigns function
  const reloadCampaigns = async () => {
    try {
      const response = await fetch(`/api/campaign/create?projectId=${projectId}`)
      const data = await response.json()
      if (data.success) {
        setCampaigns(data.campaigns || [])
      }
    } catch (error) {
      console.error('Error reloading campaigns:', error)
    }
  }

  // Handle campaign deletion
  const handleDeleteCampaign = async (campaignId: string) => {
    const campaign = campaigns.find((c) => c.id === campaignId)
    if (!campaign) return

    const confirmed = await modal.confirm({
      title: 'Eliminar campana',
      message: `¿Estas seguro de que quieres eliminar "${campaign.ecp_name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    })

    if (!confirmed) return

    try {
      const response = await fetch(`/api/campaign/${campaignId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Eliminado', 'Campana eliminada exitosamente')
        setCampaigns((prev) => prev.filter((c) => c.id !== campaignId))
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast.error('Error', error instanceof Error ? error.message : 'Error desconocido')
    }
  }

  const handleCampaignSelect = (campaignId: string) => {
    // Open full-screen view instead of using the original callback
    setSelectedCampaignId(campaignId)
  }

  // Close full-screen view
  const handleCloseFullScreen = () => {
    setSelectedCampaignId(null)
    // Reload campaigns after closing to get fresh data
    reloadCampaigns()
  }

  // Get selected campaign
  const selectedCampaign = selectedCampaignId
    ? campaigns.find((c) => c.id === selectedCampaignId)
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  // Render full-screen view when a campaign is selected
  if (selectedCampaign) {
    return (
      <CampaignFullScreenView
        campaignId={selectedCampaign.id}
        projectId={projectId}
        campaign={selectedCampaign}
        project={project}
        onClose={handleCloseFullScreen}
        onCampaignUpdated={reloadCampaigns}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total"
          value={stats.total}
          icon={Rocket}
          color="blue"
        />
        <StatCard
          label="Completadas"
          value={stats.completed}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          label="En progreso"
          value={stats.inProgress}
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          label="Pendientes"
          value={stats.pending}
          icon={Clock}
          color="gray"
        />
        <StatCard
          label="Con errores"
          value={stats.withErrors}
          icon={AlertCircle}
          color="red"
        />
      </div>

      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Campanas</h2>
          <p className="text-sm text-gray-500 mt-1">
            {filteredCampaigns.length} de {campaigns.length} campanas
          </p>
        </div>

        {onCreateCampaign && (
          <button
            onClick={onCreateCampaign}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            Nueva Campana
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar campanas..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="running">En progreso</option>
            <option value="completed">Completadas</option>
            <option value="error">Con errores</option>
          </select>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Vista grid"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Vista lista"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Campaigns */}
      {filteredCampaigns.length === 0 ? (
        <EmptyState
          hasSearch={!!searchQuery || statusFilter !== 'all'}
          onClearFilters={() => {
            setSearchQuery('')
            setStatusFilter('all')
          }}
          onCreateNew={onCreateCampaign}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              totalSteps={totalSteps}
              onSelect={handleCampaignSelect}
              onDelete={handleDeleteCampaign}
              compact={false}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              totalSteps={totalSteps}
              onSelect={handleCampaignSelect}
              onDelete={handleDeleteCampaign}
              compact={true}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: any
  color: 'blue' | 'green' | 'gray' | 'red'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    gray: 'bg-gray-50 text-gray-600',
    red: 'bg-red-50 text-red-600',
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon size={18} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  )
}

// Empty State Component
function EmptyState({
  hasSearch,
  onClearFilters,
  onCreateNew,
}: {
  hasSearch: boolean
  onClearFilters: () => void
  onCreateNew?: () => void
}) {
  if (hasSearch) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron resultados</h3>
        <p className="text-gray-500 mb-4">Intenta con otros terminos de busqueda o filtros</p>
        <button
          onClick={onClearFilters}
          className="text-blue-600 font-medium hover:text-blue-700"
        >
          Limpiar filtros
        </button>
      </div>
    )
  }

  return (
    <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
      <Rocket className="w-12 h-12 text-blue-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No hay campanas todavia</h3>
      <p className="text-gray-500 mb-6">Crea tu primera campana para comenzar a generar contenido</p>
      {onCreateNew && (
        <button
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Crear primera campana
        </button>
      )}
    </div>
  )
}
