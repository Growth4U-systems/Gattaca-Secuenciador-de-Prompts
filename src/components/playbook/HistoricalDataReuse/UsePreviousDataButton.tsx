'use client'

import { useState, useCallback } from 'react'
import { History, ChevronRight, Sparkles } from 'lucide-react'
import HistoricalDataPanel from './HistoricalDataPanel'
import { HistoricalArtifact, ImportedDataReference } from './types'

interface UsePreviousDataButtonProps {
  projectId: string
  playbookType: string
  currentSessionId?: string
  stepId: string
  stepName: string
  onImport: (artifact: HistoricalArtifact, reference: ImportedDataReference) => void
  className?: string
  variant?: 'button' | 'link' | 'banner'
  disabled?: boolean
}

export default function UsePreviousDataButton({
  projectId,
  playbookType,
  currentSessionId,
  stepId,
  stepName,
  onImport,
  className = '',
  variant = 'button',
  disabled = false,
}: UsePreviousDataButtonProps) {
  const [showPanel, setShowPanel] = useState(false)

  const handleOpen = useCallback(() => {
    if (!disabled) {
      setShowPanel(true)
    }
  }, [disabled])

  const handleClose = useCallback(() => {
    setShowPanel(false)
  }, [])

  const handleImport = useCallback((artifact: HistoricalArtifact, reference: ImportedDataReference) => {
    onImport(artifact, reference)
    setShowPanel(false)
  }, [onImport])

  if (variant === 'link') {
    return (
      <>
        <button
          onClick={handleOpen}
          disabled={disabled}
          className={`inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors ${className}`}
        >
          <History size={14} />
          Use previous data
          <ChevronRight size={14} />
        </button>

        <HistoricalDataPanel
          projectId={projectId}
          playbookType={playbookType}
          currentSessionId={currentSessionId}
          stepId={stepId}
          stepName={stepName}
          onImport={handleImport}
          onClose={handleClose}
          isOpen={showPanel}
        />
      </>
    )
  }

  if (variant === 'banner') {
    return (
      <>
        <div
          className={`flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl ${className}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <History size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">
                Skip this step with historical data
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Reuse data from previous sessions to save time
              </p>
            </div>
          </div>
          <button
            onClick={handleOpen}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Sparkles size={14} />
            Browse Data
            <ChevronRight size={14} />
          </button>
        </div>

        <HistoricalDataPanel
          projectId={projectId}
          playbookType={playbookType}
          currentSessionId={currentSessionId}
          stepId={stepId}
          stepName={stepName}
          onImport={handleImport}
          onClose={handleClose}
          isOpen={showPanel}
        />
      </>
    )
  }

  // Default button variant
  return (
    <>
      <button
        onClick={handleOpen}
        disabled={disabled}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl hover:from-amber-100 hover:to-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm ${className}`}
      >
        <History size={16} />
        Use Previous Data
        <ChevronRight size={14} />
      </button>

      <HistoricalDataPanel
        projectId={projectId}
        playbookType={playbookType}
        currentSessionId={currentSessionId}
        stepId={stepId}
        stepName={stepName}
        onImport={handleImport}
        onClose={handleClose}
        isOpen={showPanel}
      />
    </>
  )
}
