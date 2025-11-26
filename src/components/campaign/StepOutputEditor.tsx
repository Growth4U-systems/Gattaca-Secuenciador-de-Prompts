'use client'

import { useState } from 'react'
import { X, Save, RotateCcw, Eye, Edit2, CheckCircle, AlertTriangle } from 'lucide-react'

interface StepOutputEditorProps {
  campaignId: string
  campaignName: string
  stepId: string
  stepName: string
  stepOrder: number
  currentOutput: {
    step_name: string
    output: string
    tokens?: number
    status: string
    completed_at?: string
    edited_at?: string
    original_output?: string
  }
  allStepOutputs: Record<string, any>
  onSave: (updatedStepOutputs: Record<string, any>) => void
  onClose: () => void
}

export default function StepOutputEditor({
  campaignId,
  campaignName,
  stepId,
  stepName,
  stepOrder,
  currentOutput,
  allStepOutputs,
  onSave,
  onClose,
}: StepOutputEditorProps) {
  const [editedOutput, setEditedOutput] = useState(currentOutput.output || '')
  const [saving, setSaving] = useState(false)
  const [isPreview, setIsPreview] = useState(true)
  const [hasChanges, setHasChanges] = useState(false)

  // Store original output for revert functionality
  const originalOutput = currentOutput.original_output || currentOutput.output

  const handleTextChange = (value: string) => {
    setEditedOutput(value)
    setHasChanges(value !== currentOutput.output)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Create updated step outputs with the edited content
      const updatedStepOutputs = {
        ...allStepOutputs,
        [stepId]: {
          ...currentOutput,
          output: editedOutput,
          edited_at: new Date().toISOString(),
          original_output: currentOutput.original_output || currentOutput.output, // Preserve original
        },
      }

      // Call API to save
      const response = await fetch(`/api/campaign/${campaignId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ step_outputs: updatedStepOutputs }),
      })

      const data = await response.json()

      if (data.success) {
        onSave(updatedStepOutputs)
        setHasChanges(false)
        alert('Output guardado correctamente. Los pasos siguientes usarán este output editado.')
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Error saving output:', error)
      alert(`Error al guardar: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleRevert = () => {
    if (confirm('¿Restaurar el output original generado por la IA? Los cambios actuales se perderán.')) {
      setEditedOutput(originalOutput)
      setHasChanges(originalOutput !== currentOutput.output)
    }
  }

  const isEdited = !!currentOutput.edited_at || !!currentOutput.original_output

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                Step {stepOrder}
              </span>
              <h2 className="text-lg font-semibold text-gray-900">{stepName}</h2>
              {isEdited && (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded inline-flex items-center gap-1">
                  <Edit2 size={10} />
                  Editado
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{campaignName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800">
              <strong>Revisa y edita</strong> el output de este paso antes de continuar.
              Los pasos siguientes que dependan de este usarán el contenido que guardes aquí.
            </p>
          </div>
        </div>

        {/* Toggle View/Edit */}
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex gap-1">
            <button
              onClick={() => setIsPreview(true)}
              className={`px-3 py-1.5 text-sm rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                isPreview
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Eye size={14} />
              Vista Previa
            </button>
            <button
              onClick={() => setIsPreview(false)}
              className={`px-3 py-1.5 text-sm rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                !isPreview
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Edit2 size={14} />
              Editar
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            {currentOutput.tokens && (
              <span>
                <strong>Tokens:</strong> {currentOutput.tokens}
              </span>
            )}
            {currentOutput.completed_at && (
              <span>
                <strong>Generado:</strong> {new Date(currentOutput.completed_at).toLocaleString()}
              </span>
            )}
            {currentOutput.edited_at && (
              <span className="text-amber-600">
                <strong>Editado:</strong> {new Date(currentOutput.edited_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-4">
          {isPreview ? (
            <div className="h-full overflow-auto bg-gray-50 rounded-lg border border-gray-200 p-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                {editedOutput}
              </pre>
            </div>
          ) : (
            <textarea
              value={editedOutput}
              onChange={(e) => handleTextChange(e.target.value)}
              className="w-full h-full resize-none bg-white rounded-lg border border-gray-300 p-4 text-sm text-gray-900 font-mono leading-relaxed focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Output del paso..."
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            {isEdited && (
              <button
                onClick={handleRevert}
                disabled={saving}
                className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                Restaurar Original
              </button>
            )}
            {hasChanges && (
              <span className="text-sm text-amber-600 inline-flex items-center gap-1">
                <AlertTriangle size={14} />
                Cambios sin guardar
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={14} />
                  Guardar y Continuar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
