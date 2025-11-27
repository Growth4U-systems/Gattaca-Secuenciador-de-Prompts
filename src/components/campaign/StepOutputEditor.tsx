'use client'

import { useState, useMemo } from 'react'
import { X, Save, RotateCcw, Eye, Edit2, AlertTriangle, FileText, Table, Download } from 'lucide-react'
import MarkdownRenderer, { extractTables, tablesToCSV } from '../common/MarkdownRenderer'

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
  const [isEditing, setIsEditing] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Store original output for revert functionality
  const originalOutput = currentOutput.original_output || currentOutput.output

  // Extract tables from the content
  const tables = useMemo(() => extractTables(editedOutput), [editedOutput])

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
        setIsEditing(false)
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
      setIsEditing(true) // Auto-enable editing to show save button
    }
  }

  const handleExportTables = () => {
    if (tables.length === 0) {
      alert('No se encontraron tablas en el output.')
      return
    }

    const csv = tablesToCSV(tables)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${stepName.replace(/\s+/g, '_')}_tables.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isEdited = !!currentOutput.edited_at || !!currentOutput.original_output

  // Calculate character count
  const charCount = editedOutput.length
  const wordCount = editedOutput.trim() ? editedOutput.trim().split(/\s+/).length : 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                Step {stepOrder}
              </span>
              <h2 className="text-lg font-semibold text-gray-900">{stepName} - Output</h2>
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

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <FileText size={14} />
              <span>Output Generado</span>
            </div>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{charCount.toLocaleString()} caracteres</span>
              <span>•</span>
              <span>{wordCount.toLocaleString()} palabras</span>
              {currentOutput.tokens && (
                <>
                  <span>•</span>
                  <span>{currentOutput.tokens.toLocaleString()} tokens</span>
                </>
              )}
            </div>
            {tables.length > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <button
                  onClick={handleExportTables}
                  className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded transition-colors"
                  title={`Exportar ${tables.length} tabla(s) como CSV`}
                >
                  <Table size={12} />
                  <span>Exportar {tables.length} tabla{tables.length > 1 ? 's' : ''}</span>
                  <Download size={10} />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentOutput.completed_at && (
              <span className="text-xs text-gray-500">
                Generado: {new Date(currentOutput.completed_at).toLocaleString()}
              </span>
            )}
            {currentOutput.edited_at && (
              <span className="text-xs text-amber-600">
                • Editado: {new Date(currentOutput.edited_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-4 min-h-0">
          {isEditing ? (
            <textarea
              value={editedOutput}
              onChange={(e) => handleTextChange(e.target.value)}
              className="w-full h-full resize-none bg-white rounded-lg border border-blue-300 p-4 text-sm text-gray-900 font-mono leading-relaxed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              placeholder="Output del paso..."
              autoFocus
            />
          ) : (
            <div className="h-full overflow-auto bg-white rounded-lg border border-gray-200 p-6">
              {editedOutput ? (
                <MarkdownRenderer content={editedOutput} />
              ) : (
                <span className="text-gray-400 italic">No hay output generado todavía.</span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            {isEdited && !isEditing && (
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
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    if (hasChanges && !confirm('¿Descartar cambios?')) return
                    setEditedOutput(currentOutput.output || '')
                    setHasChanges(false)
                    setIsEditing(false)
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancelar Edición
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
                      Guardar Cambios
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-1.5"
                >
                  <Edit2 size={14} />
                  Editar Output
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
