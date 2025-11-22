'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { FlowStep } from '@/types/flow.types'
import { formatTokenCount } from '@/lib/supabase'

interface StepEditorProps {
  step: FlowStep
  documents: any[]
  allSteps: FlowStep[]
  projectVariables: Array<{ name: string; default_value?: string; description?: string }>
  onSave: (step: FlowStep) => void
  onCancel: () => void
}

export default function StepEditor({
  step,
  documents,
  allSteps,
  projectVariables,
  onSave,
  onCancel,
}: StepEditorProps) {
  const [editedStep, setEditedStep] = useState<FlowStep>({ ...step })
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

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
            <h2 className="text-xl font-semibold">Edit Step: "{step.name}"</h2>
            <p className="text-sm text-gray-600 mt-1">
              Configure documents and dependencies for this step
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

          {/* Prompt */}
          <div>
            <label className="block font-medium text-gray-900 mb-2">
              📝 Prompt
            </label>
            <textarea
              value={editedStep.prompt}
              onChange={(e) =>
                setEditedStep((prev) => ({ ...prev, prompt: e.target.value }))
              }
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-2">
              <span className="font-medium">Available variables:</span>{' '}
              {[
                'ecp_name',
                'problem_core',
                'country',
                'industry',
                'client_name',
                ...projectVariables.map((v) => v.name),
              ].map((varName, index, arr) => (
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
