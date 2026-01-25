'use client'

import { X } from 'lucide-react'
import { StepDefinition, StepState } from './types'
import { InputContextSection } from './inspection/InputContextSection'
import { ExecutionSection } from './inspection/ExecutionSection'
import { OutputSection } from './inspection/OutputSection'

export interface StepInfo {
  definition: StepDefinition
  state: StepState
}

interface StepInspectionPanelProps {
  step: StepDefinition
  stepState: StepState
  playbookContext: Record<string, unknown>
  allSteps: StepInfo[]
  onClose?: () => void
  onRetry?: () => void
}

export function StepInspectionPanel({
  step,
  stepState,
  playbookContext,
  allSteps,
  onClose,
  onRetry,
}: StepInspectionPanelProps) {
  const hasError = stepState.status === 'error'

  return (
    <div className="border-t border-gray-200 bg-gray-50/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-medium text-gray-700">
          Inspector: {step.name}
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="Cerrar inspector"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Input Context - collapsed by default unless empty */}
        <InputContextSection
          step={step}
          stepState={stepState}
          allSteps={allSteps}
          playbookContext={playbookContext}
          defaultExpanded={false}
        />

        {/* Execution - expanded if in progress */}
        <ExecutionSection
          step={step}
          stepState={stepState}
          playbookContext={playbookContext}
          defaultExpanded={stepState.status === 'in_progress'}
        />

        {/* Output/Error - expanded if error */}
        <OutputSection
          step={step}
          stepState={stepState}
          onRetry={onRetry}
          defaultExpanded={hasError || stepState.status === 'completed'}
        />
      </div>
    </div>
  )
}
