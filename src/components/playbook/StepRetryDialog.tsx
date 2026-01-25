'use client'

import { useState, useCallback } from 'react'
import {
  RotateCcw,
  X,
  Settings,
  Zap,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { StepAttemptConfig, StepRetryInfo } from './types'

export interface StepRetryDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Step name for display */
  stepName: string
  /** Current error message */
  errorMessage: string
  /** Retry information */
  retryInfo: StepRetryInfo
  /** Available models for retry */
  availableModels?: string[]
  /** Current model being used */
  currentModel?: string
  /** Callback when retry is confirmed */
  onRetry: (configOverrides?: StepAttemptConfig) => void
  /** Callback when dialog is closed/cancelled */
  onClose: () => void
  /** Whether retry is currently in progress */
  isRetrying?: boolean
}

const DEFAULT_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Best overall performance' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Faster and more cost-effective' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Excellent for complex tasks' },
  { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', description: 'Fast and efficient' },
]

/**
 * StepRetryDialog - Modal for retrying a failed step with optional config modification
 *
 * Features:
 * - Shows error context and attempt history
 * - Allows model selection for retry
 * - Optional advanced settings (temperature, timeout)
 * - Displays remaining attempts
 */
export default function StepRetryDialog({
  isOpen,
  stepName,
  errorMessage,
  retryInfo,
  availableModels,
  currentModel,
  onRetry,
  onClose,
  isRetrying = false,
}: StepRetryDialogProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | undefined>(currentModel)
  const [temperature, setTemperature] = useState<number | undefined>(undefined)
  const [timeout, setTimeout] = useState<number | undefined>(undefined)

  const models = availableModels?.length
    ? DEFAULT_MODELS.filter(m => availableModels.includes(m.id))
    : DEFAULT_MODELS

  const remainingAttempts = retryInfo.maxAttempts - retryInfo.attemptNumber
  const isLastAttempt = remainingAttempts === 1

  const handleRetry = useCallback(() => {
    const configOverrides: StepAttemptConfig = {}

    if (selectedModel && selectedModel !== currentModel) {
      configOverrides.model = selectedModel
    }
    if (temperature !== undefined) {
      configOverrides.temperature = temperature
    }
    if (timeout !== undefined) {
      configOverrides.timeout = timeout
    }

    onRetry(Object.keys(configOverrides).length > 0 ? configOverrides : undefined)
  }, [selectedModel, currentModel, temperature, timeout, onRetry])

  const handleQuickRetry = useCallback(() => {
    onRetry(undefined)
  }, [onRetry])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Step Failed</h3>
              <p className="text-sm text-gray-600">{stepName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Error message */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium">Error Message:</p>
            <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
          </div>

          {/* Attempt info */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <RotateCcw className="w-4 h-4" />
              <span>Attempt {retryInfo.attemptNumber} of {retryInfo.maxAttempts}</span>
            </div>
            <div className={`text-sm font-medium ${isLastAttempt ? 'text-orange-600' : 'text-gray-700'}`}>
              {remainingAttempts} {remainingAttempts === 1 ? 'retry' : 'retries'} remaining
            </div>
          </div>

          {isLastAttempt && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Last attempt:</strong> If this retry fails, you&apos;ll have the option to skip this step or contact support.
              </p>
            </div>
          )}

          {/* Model selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Model for Retry
            </label>
            <div className="grid grid-cols-2 gap-2">
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedModel === model.id
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Zap className={`w-4 h-4 ${
                      selectedModel === model.id ? 'text-indigo-600' : 'text-gray-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      selectedModel === model.id ? 'text-indigo-900' : 'text-gray-900'
                    }`}>
                      {model.name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{model.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Advanced settings toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Advanced Settings</span>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* Advanced settings */}
          {showAdvanced && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              {/* Temperature */}
              <div>
                <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
                  <span>Temperature</span>
                  <span className="text-gray-500 font-normal">
                    {temperature !== undefined ? temperature.toFixed(1) : 'Default'}
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature ?? 0.7}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Focused</span>
                  <span>Creative</span>
                </div>
              </div>

              {/* Timeout */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4" />
                  Timeout (seconds)
                </label>
                <input
                  type="number"
                  min="30"
                  max="600"
                  step="30"
                  placeholder="Default: 120"
                  value={timeout ? timeout / 1000 : ''}
                  onChange={(e) => setTimeout(e.target.value ? parseInt(e.target.value) * 1000 : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isRetrying}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleQuickRetry}
              disabled={isRetrying}
              className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50"
            >
              Quick Retry
            </button>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isRetrying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Retry with Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
