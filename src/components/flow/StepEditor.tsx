'use client'

import { useState } from 'react'
import { X, Eye, Code } from 'lucide-react'
import { FlowStep, OutputFormat } from '@/types/flow.types'
import { formatTokenCount } from '@/lib/supabase'

interface StepEditorProps {
  step: FlowStep
  documents: any[]
  allSteps: FlowStep[]
  projectVariables: Array<{ name: string; default_value?: string; description?: string }>
  campaignVariables?: Record<string, string> // Variables reales de la campaña
  onSave: (step: FlowStep) => void
  onCancel: () => void
}

const OUTPUT_FORMATS: { value: OutputFormat; label: string; description: string }[] = [
  { value: 'text', label: 'Plain Text', description: 'Simple text output' },
  { value: 'markdown', label: 'Markdown', description: 'Formatted markdown with headings, lists, etc.' },
  { value: 'json', label: 'JSON', description: 'Structured data in JSON format' },
  { value: 'csv', label: 'CSV', description: 'Comma-separated values for spreadsheets' },
  { value: 'html', label: 'HTML (Google Docs)', description: 'HTML format - import to Google Docs via File > Open' },
  { value: 'xml', label: 'XML', description: 'XML structured data' },
]

export default function StepEditor({
  step,
  documents,
  allSteps,
  projectVariables,
  campaignVariables = {},
  onSave,
  onCancel,
}: StepEditorProps) {
  const [editedStep, setEditedStep] = useState<FlowStep>({ ...step })
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showRealValues, setShowRealValues] = useState(false)

  // Reemplazar variables en el prompt con valores reales
  const getPromptWithRealValues = (prompt: string): string => {
    let result = prompt

    // Variables de campaña (custom_variables)
    Object.entries(campaignVariables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
      result = result.replace(regex, value || `[${key}: sin valor]`)
    })

    return result
  }

  const displayPrompt = showRealValues ? getPromptWithRealValues(editedStep.prompt) : editedStep.prompt
  const hasVariables = Object.keys(campaignVariables).length > 0

  // Previous steps (lower order) that can be dependencies
  const availablePrevSteps = allSteps.filter((s) => s.order < step.order)

  // Filter documents by category
  const filteredDocs = categoryFilter === 'all'
    ? documents
    : documents.filter((doc) => doc.category === categoryFilter)

  // Get unique categories
  const categories = Array.from(new Set(documents.map((doc) => doc.category)))

  const handleToggleDoc = (docId: string) => {
    setEditedStep((prev) => ({
      ...prev,
      base_doc_ids: prev.base_doc_ids.includes(docId)
        ? prev.base_doc_ids.filter((id) => id !== docId)
        : [...prev.base_doc_ids, docId],
    }))
  }

  const handleToggleDependency = (stepId: string) => {
    setEditedStep((prev) => ({
      ...prev,
      auto_receive_from: prev.auto_receive_from.includes(stepId)
        ? prev.auto_receive_from.filter((id) => id !== stepId)
        : [...prev.auto_receive_from, stepId],
    }))
  }

  const selectedDocsTokens = documents
    .filter((doc) => editedStep.base_doc_ids.includes(doc.id))
    .reduce((sum, doc) => sum + (doc.token_count || 0), 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Step</h2>
            <p className="text-sm text-gray-600 mt-1">
              Configure name, description, documents, prompt, and dependencies
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step Order */}
          <div>
            <label className="block font-medium text-gray-900 mb-2">
              🔢 Position (Order)
            </label>
            <input
              type="number"
              min="1"
              value={editedStep.order}
              onChange={(e) =>
                setEditedStep((prev) => ({ ...prev, order: parseInt(e.target.value) || 1 }))
              }
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">
              Los pasos se ejecutan en orden ascendente. Al guardar, los pasos se reordenarán automáticamente.
            </p>
          </div>

          {/* Step Name */}
          <div>
            <label className="block font-medium text-gray-900 mb-2">
              📌 Step Name
            </label>
            <input
              type="text"
              value={editedStep.name}
              onChange={(e) =>
                setEditedStep((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g., Market Research, Competitor Analysis"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Step Description */}
          <div>
            <label className="block font-medium text-gray-900 mb-2">
              📝 Description <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={editedStep.description}
              onChange={(e) =>
                setEditedStep((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Brief description of what this step does"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Base Documents */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block font-medium text-gray-900">
                📄 Base Documents
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-sm px-3 py-1 border border-gray-300 rounded text-gray-900"
              >
                <option value="all">All categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {documents.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No documents available. Upload documents first.
              </p>
            ) : (
              <>
                <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                  {filteredDocs.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={editedStep.base_doc_ids.includes(doc.id)}
                        onChange={() => handleToggleDoc(doc.id)}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {doc.category} • {formatTokenCount(doc.token_count || 0)} tokens
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                <p className="text-sm text-gray-600 mt-2">
                  Selected: {editedStep.base_doc_ids.length} document{editedStep.base_doc_ids.length !== 1 ? 's' : ''},{' '}
                  {formatTokenCount(selectedDocsTokens)} tokens
                </p>
              </>
            )}
          </div>

          {/* Auto-receive from previous steps */}
          <div>
            <label className="block font-medium text-gray-900 mb-3">
              📥 Auto-receive output from previous steps
            </label>

            {availablePrevSteps.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No previous steps available (this is one of the first steps)
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg">
                {availablePrevSteps.map((prevStep) => (
                  <label
                    key={prevStep.id}
                    className="flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={editedStep.auto_receive_from.includes(prevStep.id)}
                      onChange={() => handleToggleDependency(prevStep.id)}
                      className="rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Step {prevStep.order}: {prevStep.name}
                      </p>
                      {prevStep.description && (
                        <p className="text-xs text-gray-500">{prevStep.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Output Format */}
          <div>
            <label className="block font-medium text-gray-900 mb-2">
              📄 Output Format
            </label>
            <select
              value={editedStep.output_format || 'text'}
              onChange={(e) =>
                setEditedStep((prev) => ({ ...prev, output_format: e.target.value as OutputFormat }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              {OUTPUT_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label} - {format.description}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              The AI will be instructed to format the output in the selected format.
            </p>
          </div>

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium text-gray-900">
                📝 Prompt
              </label>
              {hasVariables && (
                <button
                  type="button"
                  onClick={() => setShowRealValues(!showRealValues)}
                  className={`px-3 py-1.5 text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                    showRealValues
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {showRealValues ? (
                    <>
                      <Eye size={14} />
                      Valores reales
                    </>
                  ) : (
                    <>
                      <Code size={14} />
                      Variables genéricas
                    </>
                  )}
                </button>
              )}
            </div>

            {showRealValues ? (
              // Vista de solo lectura con valores reales
              <div className="w-full px-3 py-2 border border-green-300 bg-green-50 rounded-lg font-mono text-sm text-gray-900 whitespace-pre-wrap max-h-96 overflow-y-auto">
                {displayPrompt}
              </div>
            ) : (
              // Vista editable con variables
              <textarea
                value={editedStep.prompt}
                onChange={(e) =>
                  setEditedStep((prev) => ({ ...prev, prompt: e.target.value }))
                }
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            )}

            {showRealValues && (
              <p className="text-xs text-green-600 mt-2">
                Vista previa con los valores de las variables de esta campaña (solo lectura)
              </p>
            )}

            <p className="text-xs text-gray-500 mt-2">
              <span className="font-medium">Available variables:</span>{' '}
              {Array.from(new Set([
                // Base variables
                'ecp_name',
                'problem_core',
                'country',
                'industry',
                'client_name',
                // Project-defined variables
                ...projectVariables.map((v) => v.name),
                // Campaign variables (may include additional custom vars)
                ...Object.keys(campaignVariables),
              ])).map((varName, index, arr) => (
                <span key={varName}>
                  <code className="text-gray-700 bg-gray-100 px-1 rounded">
                    {'{'}{'{'} {varName} {'}'}{'}'}
                  </code>
                  {index < arr.length - 1 ? ', ' : ''}
                </span>
              ))}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={() => onSave(editedStep)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Step
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
