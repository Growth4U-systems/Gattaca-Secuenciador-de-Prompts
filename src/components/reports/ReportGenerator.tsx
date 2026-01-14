'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, FileText, Download, Eye, AlertTriangle, Loader2, FileJson, FileType, Presentation, Sparkles } from 'lucide-react'
import { FlowStep, GeneratedReport, InconsistencyResult, ReportExportConfig } from '@/types/flow.types'
import { CustomStatus } from '@/components/campaign/StatusManager'
import CampaignSelector from './CampaignSelector'
import InconsistencyAnalyzer from './InconsistencyAnalyzer'
import ReportPreview from './ReportPreview'
import { useToast } from '@/components/ui'

interface Campaign {
  id: string
  ecp_name: string
  country: string
  industry: string
  status: string
  step_outputs: Record<string, any>
  custom_variables?: Record<string, string>
}

interface ReportGeneratorProps {
  projectId: string
  projectName: string
  campaigns: Campaign[]
  steps: FlowStep[]
  customStatuses?: CustomStatus[]
  onClose: () => void
}

export default function ReportGenerator({
  projectId,
  projectName,
  campaigns,
  steps,
  customStatuses,
  onClose,
}: ReportGeneratorProps) {
  const toast = useToast()

  // Selection state
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([])
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>(() => steps.map(s => s.id))
  const [statusFilter, setStatusFilter] = useState<string>('ready_to_present')

  // UI state
  const [activeTab, setActiveTab] = useState<'select' | 'inconsistencies' | 'preview'>('select')
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'markdown' | 'json' | 'pptx' | 'pdf'>('markdown')

  // Report data
  const [inconsistencies, setInconsistencies] = useState<InconsistencyResult[]>([])
  const [analyzingInconsistencies, setAnalyzingInconsistencies] = useState(false)
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null)

  // Auto-select campaigns with "ready_to_present" status on mount
  useEffect(() => {
    const readyToPresent = campaigns.filter(c => c.status === 'ready_to_present')
    if (readyToPresent.length > 0) {
      setSelectedCampaignIds(readyToPresent.map(c => c.id))
    }
  }, [campaigns])

  // Get selected campaigns data
  const selectedCampaigns = useMemo(() => {
    return campaigns.filter(c => selectedCampaignIds.includes(c.id))
  }, [campaigns, selectedCampaignIds])

  // Get selected steps data
  const selectedSteps = useMemo(() => {
    return steps.filter(s => selectedStepIds.includes(s.id))
  }, [steps, selectedStepIds])

  // Check if ready to generate
  const canGenerate = selectedCampaignIds.length > 0 && selectedStepIds.length > 0

  // Analyze inconsistencies using LLM
  const handleAnalyzeInconsistencies = async () => {
    if (!canGenerate) return

    setAnalyzingInconsistencies(true)
    setActiveTab('inconsistencies')

    try {
      // Build data for analysis
      const campaignData = selectedCampaigns.map(campaign => ({
        id: campaign.id,
        name: campaign.ecp_name,
        country: campaign.country,
        industry: campaign.industry,
        customVariables: campaign.custom_variables || {},
        stepOutputs: selectedSteps.map(step => ({
          stepId: step.id,
          stepName: step.name,
          output: campaign.step_outputs?.[step.id]?.output || '',
        })).filter(so => so.output),
      }))

      const response = await fetch('/api/reports/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          campaigns: campaignData,
          stepIds: selectedStepIds,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze inconsistencies')
      }

      const result = await response.json()
      setInconsistencies(result.inconsistencies || [])

      if (result.inconsistencies?.length === 0) {
        toast.success('Sin inconsistencias', 'No se encontraron datos contradictorios')
      } else {
        toast.info('Analisis completo', `Se encontraron ${result.inconsistencies.length} inconsistencias`)
      }
    } catch (error) {
      console.error('Error analyzing inconsistencies:', error)
      toast.error('Error', 'No se pudieron analizar las inconsistencias')
      // Continue without inconsistencies
      setInconsistencies([])
    } finally {
      setAnalyzingInconsistencies(false)
    }
  }

  // Generate the report
  const handleGenerateReport = async () => {
    if (!canGenerate) return

    // Build report data
    const report: GeneratedReport = {
      id: crypto.randomUUID(),
      projectId,
      projectName,
      generatedAt: new Date().toISOString(),
      campaigns: selectedCampaigns.map(campaign => ({
        id: campaign.id,
        name: campaign.ecp_name,
        country: campaign.country,
        industry: campaign.industry,
        customVariables: campaign.custom_variables || {},
        stepOutputs: selectedSteps.map(step => ({
          stepId: step.id,
          stepName: step.name,
          output: campaign.step_outputs?.[step.id]?.output || '',
        })).filter(so => so.output),
      })),
      selectedStepIds,
      inconsistencies: inconsistencies.filter(i => !i.resolved),
    }

    setGeneratedReport(report)
    setActiveTab('preview')
  }

  // Export report
  const handleExport = async (format: 'markdown' | 'json' | 'pptx' | 'pdf') => {
    if (!generatedReport) return

    setExporting(true)
    setExportFormat(format)

    try {
      const config: ReportExportConfig = {
        format,
        includeExecutiveSummary: true,
        includeCampaignDetails: true,
        includeInconsistencyReport: inconsistencies.length > 0,
        includeRecommendations: true,
        customTitle: `Reporte: ${projectName}`,
      }

      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report: generatedReport,
          config,
        }),
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Handle download based on format
      if (format === 'json') {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        downloadBlob(blob, `${projectName}-report.json`)
      } else if (format === 'markdown') {
        const text = await response.text()
        const blob = new Blob([text], { type: 'text/markdown' })
        downloadBlob(blob, `${projectName}-report.md`)
      } else {
        // Binary formats (pptx, pdf)
        const blob = await response.blob()
        const ext = format === 'pptx' ? 'pptx' : 'pdf'
        downloadBlob(blob, `${projectName}-report.${ext}`)
      }

      toast.success('Exportado', `Reporte exportado como ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Error', 'No se pudo exportar el reporte')
    } finally {
      setExporting(false)
    }
  }

  // Helper to download blob
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Handle inconsistency resolution
  const handleResolveInconsistency = (id: string, resolvedValue: string) => {
    setInconsistencies(prev =>
      prev.map(i =>
        i.id === id ? { ...i, resolved: true, resolvedValue } : i
      )
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/20 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Generar Reporte</h2>
              <p className="text-sm text-white/80">{projectName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('select')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'select'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            1. Seleccionar
          </button>
          <button
            onClick={() => setActiveTab('inconsistencies')}
            disabled={!canGenerate}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'inconsistencies'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-gray-500 hover:text-gray-700 disabled:opacity-50'
            }`}
          >
            2. Inconsistencias
            {inconsistencies.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                {inconsistencies.filter(i => !i.resolved).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            disabled={!generatedReport}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'preview'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-gray-500 hover:text-gray-700 disabled:opacity-50'
            }`}
          >
            3. Vista Previa
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'select' && (
            <CampaignSelector
              campaigns={campaigns}
              steps={steps}
              customStatuses={customStatuses}
              selectedCampaignIds={selectedCampaignIds}
              selectedStepIds={selectedStepIds}
              statusFilter={statusFilter}
              onCampaignSelectionChange={setSelectedCampaignIds}
              onStepSelectionChange={setSelectedStepIds}
              onStatusFilterChange={setStatusFilter}
            />
          )}

          {activeTab === 'inconsistencies' && (
            <InconsistencyAnalyzer
              inconsistencies={inconsistencies}
              analyzing={analyzingInconsistencies}
              onResolve={handleResolveInconsistency}
              onReanalyze={handleAnalyzeInconsistencies}
            />
          )}

          {activeTab === 'preview' && generatedReport && (
            <ReportPreview
              report={generatedReport}
              steps={steps}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {selectedCampaignIds.length} campanas · {selectedStepIds.length} pasos
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'select' && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAnalyzeInconsistencies}
                  disabled={!canGenerate || analyzingInconsistencies}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
                >
                  {analyzingInconsistencies ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  Verificar Inconsistencias
                </button>
                <button
                  onClick={handleGenerateReport}
                  disabled={!canGenerate}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Vista Previa
                </button>
              </>
            )}

            {activeTab === 'inconsistencies' && (
              <>
                <button
                  onClick={() => setActiveTab('select')}
                  className="px-4 py-2.5 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Atras
                </button>
                <button
                  onClick={handleGenerateReport}
                  disabled={!canGenerate}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Generar Reporte
                </button>
              </>
            )}

            {activeTab === 'preview' && (
              <>
                <button
                  onClick={() => setActiveTab('inconsistencies')}
                  className="px-4 py-2.5 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Atras
                </button>

                {/* Export buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExport('markdown')}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    MD
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                  >
                    <FileJson className="w-4 h-4" />
                    JSON
                  </button>
                  <button
                    onClick={() => handleExport('pptx')}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2.5 bg-orange-100 hover:bg-orange-200 text-orange-700 font-medium rounded-lg transition-colors"
                  >
                    {exporting && exportFormat === 'pptx' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Presentation className="w-4 h-4" />
                    )}
                    PPTX
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded-lg transition-colors"
                  >
                    {exporting && exportFormat === 'pdf' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileType className="w-4 h-4" />
                    )}
                    PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
