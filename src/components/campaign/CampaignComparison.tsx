'use client'

import { useState, useMemo } from 'react'
import { X, ChevronDown, ChevronRight, ArrowLeftRight, Copy, Check } from 'lucide-react'
import { FlowConfig, FlowStep } from '@/types/flow.types'
import MarkdownRenderer from '../common/MarkdownRenderer'

interface Campaign {
  id: string
  ecp_name: string
  problem_core: string
  country: string
  industry: string
  status: string
  step_outputs: Record<string, any>
  custom_variables?: Record<string, string>
  flow_config?: FlowConfig | null
}

interface CampaignComparisonProps {
  campaigns: Campaign[]
  projectFlowConfig?: FlowConfig | null
  onClose: () => void
}

export default function CampaignComparison({
  campaigns,
  projectFlowConfig,
  onClose,
}: CampaignComparisonProps) {
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>(
    campaigns.slice(0, 2).map(c => c.id)
  )
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'side-by-side' | 'stacked'>('side-by-side')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Get the campaigns to compare
  const campaignsToCompare = useMemo(() => {
    return campaigns.filter(c => selectedCampaigns.includes(c.id))
  }, [campaigns, selectedCampaigns])

  // Get all unique steps across all campaigns
  const allSteps = useMemo(() => {
    const stepsMap = new Map<string, FlowStep>()

    // Get steps from project flow config
    if (projectFlowConfig?.steps) {
      projectFlowConfig.steps.forEach(step => {
        stepsMap.set(step.id, step)
      })
    }

    // Get steps from campaign flow configs
    campaignsToCompare.forEach(campaign => {
      if (campaign.flow_config?.steps) {
        campaign.flow_config.steps.forEach(step => {
          if (!stepsMap.has(step.id)) {
            stepsMap.set(step.id, step)
          }
        })
      }
    })

    return Array.from(stepsMap.values()).sort((a, b) => a.order - b.order)
  }, [campaignsToCompare, projectFlowConfig])

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev)
      if (newSet.has(stepId)) {
        newSet.delete(stepId)
      } else {
        newSet.add(stepId)
      }
      return newSet
    })
  }

  const expandAll = () => {
    setExpandedSteps(new Set(allSteps.map(s => s.id)))
  }

  const collapseAll = () => {
    setExpandedSteps(new Set())
  }

  const toggleCampaign = (campaignId: string) => {
    setSelectedCampaigns(prev => {
      if (prev.includes(campaignId)) {
        // Don't allow deselecting if only 2 remain
        if (prev.length <= 2) return prev
        return prev.filter(id => id !== campaignId)
      } else {
        return [...prev, campaignId]
      }
    })
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const getStepOutput = (campaign: Campaign, stepId: string): string | null => {
    const outputs = campaign.step_outputs || {}
    const output = outputs[stepId]
    if (!output) return null
    return typeof output === 'string' ? output : output.output || JSON.stringify(output)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <ArrowLeftRight size={20} className="text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Comparar Campanas</h2>
              <p className="text-xs text-gray-500">
                Compara los outputs de {selectedCampaigns.length} campanas lado a lado
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  viewMode === 'side-by-side'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Lado a lado
              </button>
              <button
                onClick={() => setViewMode('stacked')}
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  viewMode === 'stacked'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Apilado
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Campaign selector */}
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700">Seleccionar campanas:</span>
            {campaigns.map(campaign => (
              <button
                key={campaign.id}
                onClick={() => toggleCampaign(campaign.id)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  selectedCampaigns.includes(campaign.id)
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                }`}
              >
                {campaign.ecp_name}
              </button>
            ))}
          </div>
        </div>

        {/* Expand/Collapse controls */}
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-xs text-blue-600 hover:underline"
            >
              Expandir todo
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-blue-600 hover:underline"
            >
              Colapsar todo
            </button>
          </div>
          <span className="text-xs text-gray-500">
            {allSteps.length} pasos para comparar
          </span>
        </div>

        {/* Comparison content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {allSteps.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No hay pasos definidos para comparar</p>
            </div>
          ) : (
            allSteps.map(step => {
              const isExpanded = expandedSteps.has(step.id)
              const hasAnyOutput = campaignsToCompare.some(c => getStepOutput(c, step.id))

              return (
                <div
                  key={step.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* Step header */}
                  <button
                    onClick={() => toggleStep(step.id)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown size={18} className="text-gray-400" />
                      ) : (
                        <ChevronRight size={18} className="text-gray-400" />
                      )}
                      <span className="text-blue-600 font-medium">{step.order}.</span>
                      <span className="font-medium text-gray-900">{step.name}</span>
                      {step.description && (
                        <span className="text-sm text-gray-500">- {step.description}</span>
                      )}
                    </div>
                    {!hasAnyOutput && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                        Sin outputs
                      </span>
                    )}
                  </button>

                  {/* Step outputs */}
                  {isExpanded && (
                    <div className={`${viewMode === 'side-by-side' ? 'flex divide-x divide-gray-200' : 'space-y-4'}`}>
                      {campaignsToCompare.map(campaign => {
                        const output = getStepOutput(campaign, step.id)
                        const copyId = `${campaign.id}-${step.id}`

                        return (
                          <div
                            key={campaign.id}
                            className={`${viewMode === 'side-by-side' ? 'flex-1' : ''} p-4`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-sm text-gray-700">
                                {campaign.ecp_name}
                              </h4>
                              {output && (
                                <button
                                  onClick={() => handleCopy(output, copyId)}
                                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                  title="Copiar"
                                >
                                  {copiedId === copyId ? (
                                    <Check size={14} className="text-green-600" />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                </button>
                              )}
                            </div>
                            {output ? (
                              <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-96 overflow-y-auto text-sm">
                                <MarkdownRenderer content={output} />
                              </div>
                            ) : (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-500 italic">
                                Sin output para este paso
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Comparando {campaignsToCompare.length} campanas
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
