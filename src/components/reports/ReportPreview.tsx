'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, MapPin, Building2, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { GeneratedReport, FlowStep } from '@/types/flow.types'
import MarkdownRenderer from '@/components/common/MarkdownRenderer'

interface ReportPreviewProps {
  report: GeneratedReport
  steps: FlowStep[]
}

export default function ReportPreview({ report, steps }: ReportPreviewProps) {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(
    new Set(report.campaigns.map(c => c.id))
  )
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())

  const toggleCampaign = (id: string) => {
    const newExpanded = new Set(expandedCampaigns)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedCampaigns(newExpanded)
  }

  const toggleStep = (key: string) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedSteps(newExpanded)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Get step order for display
  const getStepOrder = (stepId: string) => {
    const step = steps.find(s => s.id === stepId)
    return step?.order ?? 999
  }

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
        <h2 className="text-xl font-bold text-gray-900 mb-2">{report.projectName}</h2>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Generado: {formatDate(report.generatedAt)}</span>
          <span>·</span>
          <span>{report.campaigns.length} campanas</span>
          <span>·</span>
          <span>{report.selectedStepIds.length} pasos</span>
        </div>
      </div>

      {/* Executive Summary Placeholder */}
      {report.executiveSummary && (
        <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
          <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Resumen Ejecutivo
          </h3>
          <div className="prose prose-sm max-w-none text-gray-700">
            <MarkdownRenderer content={report.executiveSummary} />
          </div>
        </div>
      )}

      {/* Inconsistencies Warning */}
      {report.inconsistencies.length > 0 && (
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="font-medium text-red-900">
              {report.inconsistencies.length} inconsistencias sin resolver
            </span>
          </div>
          <p className="text-sm text-red-700 mt-1 ml-8">
            Revisa y resuelve las inconsistencias antes de exportar el reporte final.
          </p>
        </div>
      )}

      {/* Campaigns */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Campanas incluidas</h3>

        {report.campaigns.map((campaign) => {
          const isExpanded = expandedCampaigns.has(campaign.id)

          return (
            <div
              key={campaign.id}
              className="border border-gray-200 rounded-xl overflow-hidden bg-white"
            >
              {/* Campaign header */}
              <div
                onClick={() => toggleCampaign(campaign.id)}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{campaign.name}</div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {campaign.country}
                    </span>
                    {campaign.industry && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {campaign.industry}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-sm text-gray-400">
                  {campaign.stepOutputs.length} pasos
                </div>
              </div>

              {/* Campaign content */}
              {isExpanded && (
                <div className="border-t border-gray-200">
                  {/* Custom variables */}
                  {Object.keys(campaign.customVariables).length > 0 && (
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <div className="text-xs font-medium text-gray-500 uppercase mb-2">
                        Variables
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(campaign.customVariables).map(([key, value]) => (
                          <span
                            key={key}
                            className="px-2 py-1 bg-white rounded border border-gray-200 text-sm"
                          >
                            <span className="text-gray-500">{key}:</span>{' '}
                            <span className="text-gray-900">{value}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step outputs */}
                  <div className="divide-y divide-gray-100">
                    {campaign.stepOutputs
                      .sort((a, b) => getStepOrder(a.stepId) - getStepOrder(b.stepId))
                      .map((stepOutput) => {
                        const stepKey = `${campaign.id}-${stepOutput.stepId}`
                        const isStepExpanded = expandedSteps.has(stepKey)
                        const stepOrder = getStepOrder(stepOutput.stepId)

                        return (
                          <div key={stepKey}>
                            <div
                              onClick={() => toggleStep(stepKey)}
                              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                              {isStepExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}

                              <span className="text-sm font-medium text-gray-400 w-6">
                                {stepOrder}.
                              </span>
                              <span className="text-sm font-medium text-gray-700">
                                {stepOutput.stepName}
                              </span>
                            </div>

                            {isStepExpanded && stepOutput.output && (
                              <div className="px-12 pb-4">
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 prose prose-sm max-w-none">
                                  <MarkdownRenderer content={stepOutput.output} />
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Recommendations Placeholder */}
      {report.recommendations && report.recommendations.length > 0 && (
        <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200">
          <h3 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Recomendaciones
          </h3>
          <ul className="space-y-2">
            {report.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-emerald-800">
                <span className="text-emerald-600">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
