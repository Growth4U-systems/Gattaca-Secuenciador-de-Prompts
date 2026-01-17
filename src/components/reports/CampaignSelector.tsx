'use client'

import { useState, useMemo } from 'react'
import { Check, Filter, Star, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { FlowStep } from '@/types/flow.types'
import { getStatusColors, getStatusIcon, DEFAULT_STATUSES, CustomStatus } from '@/components/campaign/StatusManager'

interface Campaign {
  id: string
  ecp_name: string
  country: string
  industry: string
  status: string
  step_outputs: Record<string, any>
  custom_variables?: Record<string, string>
}

interface CampaignSelectorProps {
  campaigns: Campaign[]
  steps: FlowStep[]
  customStatuses?: CustomStatus[]
  selectedCampaignIds: string[]
  selectedStepIds: string[]
  statusFilter: string
  onCampaignSelectionChange: (ids: string[]) => void
  onStepSelectionChange: (ids: string[]) => void
  onStatusFilterChange: (status: string) => void
}

export default function CampaignSelector({
  campaigns,
  steps,
  customStatuses,
  selectedCampaignIds,
  selectedStepIds,
  statusFilter,
  onCampaignSelectionChange,
  onStepSelectionChange,
  onStatusFilterChange,
}: CampaignSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showSteps, setShowSteps] = useState(true)

  const statuses = customStatuses?.length ? customStatuses : DEFAULT_STATUSES

  // Filter campaigns based on status and search
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(campaign => {
      // Status filter
      if (statusFilter !== 'all' && campaign.status !== statusFilter) {
        return false
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          campaign.ecp_name.toLowerCase().includes(query) ||
          campaign.country?.toLowerCase().includes(query) ||
          campaign.industry?.toLowerCase().includes(query)
        )
      }

      return true
    })
  }, [campaigns, statusFilter, searchQuery])

  // Count campaigns by status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: campaigns.length }
    for (const campaign of campaigns) {
      counts[campaign.status] = (counts[campaign.status] || 0) + 1
    }
    return counts
  }, [campaigns])

  const toggleCampaign = (campaignId: string) => {
    if (selectedCampaignIds.includes(campaignId)) {
      onCampaignSelectionChange(selectedCampaignIds.filter(id => id !== campaignId))
    } else {
      onCampaignSelectionChange([...selectedCampaignIds, campaignId])
    }
  }

  const toggleStep = (stepId: string) => {
    if (selectedStepIds.includes(stepId)) {
      onStepSelectionChange(selectedStepIds.filter(id => id !== stepId))
    } else {
      onStepSelectionChange([...selectedStepIds, stepId])
    }
  }

  const selectAllCampaigns = () => {
    onCampaignSelectionChange(filteredCampaigns.map(c => c.id))
  }

  const deselectAllCampaigns = () => {
    onCampaignSelectionChange([])
  }

  const selectAllSteps = () => {
    onStepSelectionChange(steps.map(s => s.id))
  }

  const deselectAllSteps = () => {
    onStepSelectionChange([])
  }

  return (
    <div className="space-y-6">
      {/* Status Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Filter size={14} className="inline mr-1" />
          Filtrar por estado
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onStatusFilterChange('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos ({statusCounts.all || 0})
          </button>

          {/* Para presentar - highlighted */}
          <button
            onClick={() => onStatusFilterChange('ready_to_present')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
              statusFilter === 'ready_to_present'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-300'
            }`}
          >
            <Star size={14} />
            Para presentar ({statusCounts.ready_to_present || 0})
          </button>

          {statuses
            .filter(s => s.id !== 'ready_to_present')
            .map(status => {
              const colors = getStatusColors(status.color)
              const count = statusCounts[status.id] || 0
              const isSelected = statusFilter === status.id

              return (
                <button
                  key={status.id}
                  onClick={() => onStatusFilterChange(status.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isSelected
                      ? 'ring-2 ring-offset-1'
                      : 'hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: isSelected ? colors.text : colors.bg,
                    color: isSelected ? 'white' : colors.text,
                    borderColor: colors.border,
                  }}
                >
                  {status.name} ({count})
                </button>
              )
            })}
        </div>
      </div>

      {/* Campaign Selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Campanas seleccionadas ({selectedCampaignIds.length} de {filteredCampaigns.length})
          </label>
          <div className="flex gap-2">
            <button
              onClick={selectAllCampaigns}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >
              Seleccionar todas
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={deselectAllCampaigns}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Ninguna
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar campanas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Campaign List */}
        <div className="border border-gray-200 rounded-xl max-h-64 overflow-y-auto">
          {filteredCampaigns.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No hay campanas que coincidan con el filtro
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredCampaigns.map(campaign => {
                const isSelected = selectedCampaignIds.includes(campaign.id)
                const status = statuses.find(s => s.id === campaign.status)
                const statusColors = status ? getStatusColors(status.color) : null
                const completedSteps = Object.keys(campaign.step_outputs || {}).length

                return (
                  <div
                    key={campaign.id}
                    onClick={() => toggleCampaign(campaign.id)}
                    className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <Check size={14} className="text-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {campaign.ecp_name}
                        </span>
                        {statusColors && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: statusColors.bg,
                              color: statusColors.text,
                            }}
                          >
                            {status?.name}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span>{campaign.country}</span>
                        {campaign.industry && (
                          <>
                            <span>•</span>
                            <span>{campaign.industry}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{completedSteps}/{steps.length} pasos</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Step Selection */}
      <div>
        <button
          onClick={() => setShowSteps(!showSteps)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2 hover:text-gray-900"
        >
          {showSteps ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Pasos a incluir ({selectedStepIds.length} de {steps.length})
        </button>

        {showSteps && (
          <>
            <div className="flex gap-2 mb-2">
              <button
                onClick={selectAllSteps}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Todos
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={deselectAllSteps}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Ninguno
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
              {steps.map((step, index) => {
                const isSelected = selectedStepIds.includes(step.id)

                return (
                  <div
                    key={step.id}
                    onClick={() => toggleStep(step.id)}
                    className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <Check size={14} className="text-white" />}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400 w-6">
                        {index + 1}.
                      </span>
                      <span className="font-medium text-gray-900">
                        {step.name}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
