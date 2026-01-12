'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Play, Loader2, CheckCircle, XCircle, Clock, Pause, ArrowRight, RefreshCw, AlertTriangle, Sparkles, Zap, Settings, Eye, ChevronDown, ChevronUp } from 'lucide-react'
import type { Playbook, PlaybookExecution, PlaybookBlock, PlaybookConfig } from '@/types/v2.types'

interface PlaybookRunnerProps {
  playbook: Playbook
  clientId: string
  isOpen: boolean
  initialInputs?: Record<string, any>  // Pre-filled inputs from advisor
  onClose: () => void
  onComplete?: (execution: PlaybookExecution) => void
}

type InputFormData = Record<string, string | number | boolean>

export default function PlaybookRunner({
  playbook,
  clientId,
  isOpen,
  initialInputs = {},
  onClose,
  onComplete,
}: PlaybookRunnerProps) {
  const [step, setStep] = useState<'input' | 'running' | 'complete' | 'error'>('input')
  const [inputData, setInputData] = useState<InputFormData>({})
  const [execution, setExecution] = useState<PlaybookExecution | null>(null)
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const config = playbook.config as PlaybookConfig
  const blocks = config.blocks || []
  const inputSchema = config.input_schema || {}

  // Separate required from optional inputs
  const { requiredInputs, optionalInputs } = useMemo(() => {
    const required: [string, typeof inputSchema[string]][] = []
    const optional: [string, typeof inputSchema[string]][] = []

    Object.entries(inputSchema).forEach(([key, field]) => {
      if (field.required) {
        required.push([key, field])
      } else {
        optional.push([key, field])
      }
    })

    return { requiredInputs: required, optionalInputs: optional }
  }, [inputSchema])

  // Check which inputs are auto-filled
  const autoFilledKeys = useMemo(() => new Set(Object.keys(initialInputs)), [initialInputs])

  // Count auto-filled required inputs
  const autoFilledCount = useMemo(() => {
    return requiredInputs.filter(([key]) => autoFilledKeys.has(key) && initialInputs[key]).length
  }, [requiredInputs, autoFilledKeys, initialInputs])

  // Reset when opening and apply initial inputs
  useEffect(() => {
    if (isOpen) {
      setStep('input')
      // Pre-fill with initialInputs from advisor (auto-configured)
      setInputData(initialInputs as InputFormData)
      setExecution(null)
      setCurrentBlockIndex(0)
      setError(null)
      setIsRunning(false)
      setShowAdvanced(false)
    }
  }, [isOpen, initialInputs])

  // Start execution
  const handleStart = async () => {
    try {
      setError(null)
      setIsRunning(true)

      // Create execution
      const response = await fetch('/api/v2/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playbookId: playbook.id,
          clientId,
          inputData,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start execution')
      }

      setExecution(data.execution)
      setStep('running')

      // Start running blocks
      await runNextBlock(data.execution.id)
    } catch (err: any) {
      setError(err.message)
      setStep('error')
    } finally {
      setIsRunning(false)
    }
  }

  // Run the next block
  const runNextBlock = async (executionId: string) => {
    try {
      setIsRunning(true)

      const response = await fetch(`/api/v2/executions/${executionId}/run-block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Block execution failed')
      }

      // Refresh execution data
      const execResponse = await fetch(`/api/v2/executions/${executionId}`)
      const execData = await execResponse.json()
      setExecution(execData.execution)

      if (data.status === 'completed') {
        setStep('complete')
        onComplete?.(execData.execution)
      } else if (data.status === 'waiting_human') {
        setStep('running') // Show HITL interface
      } else if (data.status === 'running' && data.nextBlock) {
        // Continue to next block
        setCurrentBlockIndex((prev) => prev + 1)
        await runNextBlock(executionId)
      }
    } catch (err: any) {
      setError(err.message)
      setStep('error')
    } finally {
      setIsRunning(false)
    }
  }

  // Retry after error
  const handleRetry = () => {
    if (execution) {
      runNextBlock(execution.id)
    } else {
      handleStart()
    }
  }

  // Get block status
  const getBlockStatus = (block: PlaybookBlock) => {
    if (!execution?.block_outputs) return 'pending'
    const output = execution.block_outputs[block.id]
    return output?.status || 'pending'
  }

  // Check if we have auto-configured inputs
  const hasAutoInputs = Object.keys(initialInputs).length > 0

  // Helper to render a single input field
  const renderInputField = (key: string, field: typeof inputSchema[string], isAutoFilled: boolean) => {
    const baseInputClass = "w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 placeholder-gray-400 transition-all"
    const autoFilledClass = isAutoFilled ? "border-green-300 bg-green-50/50" : "border-gray-200"

    return (
      <div key={key} className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          {field.label || key}
          {field.required && <span className="text-red-500">*</span>}
          {isAutoFilled && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-normal">
              <Zap size={10} />
              Auto
            </span>
          )}
        </label>
        {field.description && (
          <p className="text-xs text-gray-500">{field.description}</p>
        )}

        {field.type === 'textarea' ? (
          <textarea
            value={(inputData[key] as string) || ''}
            onChange={(e) => setInputData({ ...inputData, [key]: e.target.value })}
            placeholder={`Ingresa ${field.label || key}...`}
            rows={3}
            className={`${baseInputClass} ${autoFilledClass}`}
          />
        ) : field.type === 'select' && field.options ? (
          <select
            value={(inputData[key] as string) || ''}
            onChange={(e) => setInputData({ ...inputData, [key]: e.target.value })}
            className={`${baseInputClass} ${autoFilledClass}`}
          >
            <option value="">Selecciona...</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : field.type === 'boolean' ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(inputData[key] as boolean) || false}
              onChange={(e) => setInputData({ ...inputData, [key]: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Activar</span>
          </label>
        ) : field.type === 'number' ? (
          <input
            type="number"
            value={(inputData[key] as number) || ''}
            onChange={(e) => setInputData({ ...inputData, [key]: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            className={`${baseInputClass} ${autoFilledClass}`}
          />
        ) : (
          <input
            type="text"
            value={(inputData[key] as string) || ''}
            onChange={(e) => setInputData({ ...inputData, [key]: e.target.value })}
            placeholder={`Ingresa ${field.label || key}...`}
            className={`${baseInputClass} ${autoFilledClass}`}
          />
        )}
      </div>
    )
  }

  // Render input form - simplified and guided
  const renderInputForm = () => {
    const totalInputs = Object.keys(inputSchema).length
    const allAutoFilled = autoFilledCount === requiredInputs.length && requiredInputs.length > 0

    return (
      <div className="space-y-5">
        {/* Playbook info - compact */}
        <div className="flex items-start gap-4 pb-4 border-b border-gray-100">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-lg">{playbook.name}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">{playbook.description}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Zap size={12} />
                {blocks.length} pasos
              </span>
              {blocks.filter(b => b.hitl_config?.enabled).length > 0 && (
                <span className="flex items-center gap-1 text-purple-500">
                  <Eye size={12} />
                  {blocks.filter(b => b.hitl_config?.enabled).length} revisiones
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Auto-configuration status */}
        {hasAutoInputs && allAutoFilled ? (
          // All auto-configured - show summary and quick run
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-green-800">¡Listo para ejecutar!</p>
                <p className="text-sm text-green-700 mt-0.5">
                  Gattaca configuró {autoFilledCount} campos automáticamente basándose en tu contexto.
                </p>
              </div>
            </div>

            {/* Show configured values */}
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(initialInputs).map(([key, value]) => (
                <span key={key} className="inline-flex items-center gap-1 px-2 py-1 bg-white/80 text-green-800 text-xs rounded-lg border border-green-200">
                  <span className="text-green-500">{inputSchema[key]?.label || key}:</span>
                  <strong>{String(value)}</strong>
                </span>
              ))}
            </div>

            {/* Toggle to edit */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="mt-3 text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
            >
              <Settings size={14} />
              {showAdvanced ? 'Ocultar configuración' : 'Modificar configuración'}
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        ) : hasAutoInputs ? (
          // Partially auto-configured
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <Zap className="w-5 h-5 text-blue-600" />
              <span className="font-medium">
                {autoFilledCount} de {requiredInputs.length} campos pre-configurados
              </span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              Completa los campos restantes para continuar.
            </p>
          </div>
        ) : null}

        {/* Input fields - Only show if not all auto-filled OR user wants to edit */}
        {(totalInputs === 0) ? (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-3">
              <Zap className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">No requiere configuración</p>
            <p className="text-sm text-gray-500 mt-1">Este playbook está listo para ejecutar.</p>
          </div>
        ) : (!allAutoFilled || showAdvanced) && (
          <div className="space-y-4">
            {/* Required inputs */}
            {requiredInputs.length > 0 && (
              <div className="space-y-3">
                {!allAutoFilled && (
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Campos requeridos
                  </h4>
                )}
                {requiredInputs.map(([key, field]) =>
                  renderInputField(key, field, autoFilledKeys.has(key) && !!initialInputs[key])
                )}
              </div>
            )}

            {/* Optional inputs - collapsible */}
            {optionalInputs.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-3"
                >
                  <Settings size={14} />
                  Opciones avanzadas ({optionalInputs.length})
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showAdvanced && (
                  <div className="space-y-3 pl-4 border-l-2 border-gray-100">
                    {optionalInputs.map(([key, field]) =>
                      renderInputField(key, field, autoFilledKeys.has(key) && !!initialInputs[key])
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Execute button */}
        <button
          onClick={handleStart}
          disabled={isRunning}
          className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Iniciando...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              {allAutoFilled ? 'Ejecutar Ahora' : 'Ejecutar Playbook'}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    )
  }

  // Render execution progress
  const renderProgress = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900 flex items-center gap-2">
        {isRunning && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
        Progreso de ejecución
      </h4>

      <div className="space-y-2">
        {blocks.map((block, index) => {
          const status = getBlockStatus(block)
          const isCurrent = index === currentBlockIndex && isRunning
          const output = execution?.block_outputs?.[block.id]

          return (
            <div
              key={block.id}
              className={`p-3 rounded-xl border transition-all ${
                isCurrent
                  ? 'border-indigo-300 bg-indigo-50'
                  : status === 'completed'
                  ? 'border-green-200 bg-green-50'
                  : status === 'error'
                  ? 'border-red-200 bg-red-50'
                  : status === 'waiting'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${
                  status === 'completed' ? 'bg-green-100' :
                  status === 'error' ? 'bg-red-100' :
                  status === 'running' ? 'bg-indigo-100' :
                  status === 'waiting' ? 'bg-amber-100' :
                  'bg-gray-100'
                }`}>
                  {status === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : status === 'error' ? (
                    <XCircle className="w-4 h-4 text-red-600" />
                  ) : status === 'running' ? (
                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                  ) : status === 'waiting' ? (
                    <Pause className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Clock className="w-4 h-4 text-gray-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900">{block.name}</p>
                  <p className="text-xs text-gray-500">
                    {block.type === 'prompt' ? 'Prompt IA' :
                     block.type === 'human_review' ? 'Revisión humana' :
                     block.type === 'conditional' ? 'Condicional' : 'Loop'}
                  </p>
                </div>

                {output?.tokens && (
                  <span className="text-xs text-gray-400">
                    {output.tokens.input + output.tokens.output} tokens
                  </span>
                )}
              </div>

              {/* Show output preview */}
              {status === 'completed' && output?.output && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-600 line-clamp-3">{output.output}</p>
                </div>
              )}

              {/* Show error */}
              {status === 'error' && output?.error_message && (
                <div className="mt-2 pt-2 border-t border-red-200">
                  <p className="text-xs text-red-600">{output.error_message}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // Render completion
  const renderComplete = () => (
    <div className="text-center py-8">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        ¡Playbook completado!
      </h3>
      <p className="text-gray-600 mb-6">
        Todos los bloques se ejecutaron correctamente.
      </p>

      {/* Show outputs */}
      {execution?.block_outputs && (
        <div className="text-left mt-6 space-y-4">
          <h4 className="font-medium text-gray-900">Resultados:</h4>
          {blocks.map((block) => {
            const output = execution.block_outputs[block.id]
            if (!output?.output) return null
            return (
              <div key={block.id} className="bg-gray-50 rounded-xl p-4">
                <p className="font-medium text-sm text-gray-700 mb-2">{block.name}</p>
                <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap">
                  {output.output}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button
        onClick={onClose}
        className="mt-6 px-6 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors"
      >
        Cerrar
      </button>
    </div>
  )

  // Render error
  const renderError = () => (
    <div className="text-center py-8">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
        <AlertTriangle className="w-8 h-8 text-red-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        Error en la ejecución
      </h3>
      <p className="text-red-600 mb-6">{error}</p>

      <div className="flex gap-3 justify-center">
        <button
          onClick={onClose}
          className="px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleRetry}
          disabled={isRunning}
          className="px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isRunning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Reintentar
        </button>
      </div>
    </div>
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Play className="w-6 h-6 text-white" />
            <h2 className="text-lg font-semibold text-white">
              Ejecutar Playbook
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'input' && renderInputForm()}
          {step === 'running' && renderProgress()}
          {step === 'complete' && renderComplete()}
          {step === 'error' && renderError()}
        </div>
      </div>
    </div>
  )
}
