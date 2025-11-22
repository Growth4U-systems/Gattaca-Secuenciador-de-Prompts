'use client'

import { useState } from 'react'
import { Plus, X, Save, Settings } from 'lucide-react'

interface VariableDefinition {
  name: string
  default_value: string
  required: boolean
  description?: string
}

interface ProjectVariablesProps {
  projectId: string
  initialVariables: VariableDefinition[]
  onUpdate?: () => void
}

export default function ProjectVariables({
  projectId,
  initialVariables,
  onUpdate,
}: ProjectVariablesProps) {
  const [variables, setVariables] = useState<VariableDefinition[]>(initialVariables || [])
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const addVariable = () => {
    setVariables([
      ...variables,
      { name: '', default_value: '', required: false, description: '' },
    ])
  }

  const updateVariable = (
    index: number,
    field: keyof VariableDefinition,
    value: string | boolean
  ) => {
    const updated = [...variables]
    updated[index] = { ...updated[index], [field]: value }
    setVariables(updated)
  }

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    // Validate: all variables must have a name
    const invalid = variables.find((v) => !v.name.trim())
    if (invalid) {
      alert('⚠️ Todas las variables deben tener un nombre')
      return
    }

    // Validate: no duplicate names
    const names = variables.map((v) => v.name.trim())
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
    if (duplicates.length > 0) {
      alert(`⚠️ Nombres de variables duplicados: ${duplicates.join(', ')}`)
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variable_definitions: variables,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update variables')
      }

      alert('✅ Variables guardadas exitosamente')
      setIsEditing(false)
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error saving variables:', error)
      alert(`❌ Error al guardar: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setVariables(initialVariables || [])
    setIsEditing(false)
  }

  if (!isEditing && variables.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Variables del Proyecto</h3>
          </div>
        </div>

        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <p className="text-gray-600 mb-4">
            No hay variables definidas para este proyecto
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Las variables se usan en prompts con formato {'{{'} {'variable'} {'}}'}
            <br />
            Cada campaña completará los valores de estas variables
          </p>
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
          >
            <Plus size={18} />
            Definir Variables
          </button>
        </div>
      </div>
    )
  }

  if (!isEditing) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Variables del Proyecto</h3>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
          >
            Editar
          </button>
        </div>

        <div className="space-y-3">
          {variables.map((variable, index) => (
            <div
              key={index}
              className="bg-gray-50 border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-gray-900 bg-white px-2 py-1 rounded border border-gray-300">
                    {'{{'}{variable.name}{'}}'}
                  </code>
                  {variable.required && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                      Requerida
                    </span>
                  )}
                </div>
              </div>
              {variable.description && (
                <p className="text-sm text-gray-600 mb-2">{variable.description}</p>
              )}
              <div className="text-sm text-gray-500">
                Valor por defecto:{' '}
                <span className="font-medium text-gray-700">
                  {variable.default_value || '(vacío)'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Variables del Proyecto</h3>
        </div>
        <button
          onClick={addVariable}
          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 inline-flex items-center gap-1"
        >
          <Plus size={16} />
          Agregar Variable
        </button>
      </div>

      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 Estas variables estarán disponibles en todas las campañas de este
          proyecto. Usa {'{{'} {'nombre_variable'} {'}}'} en tus prompts.
        </p>
      </div>

      {variables.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 mb-4">
          <p className="text-sm text-gray-500">
            No hay variables. Click en "Agregar Variable" para crear una.
          </p>
        </div>
      ) : (
        <div className="space-y-4 mb-4">
          {variables.map((variable, index) => (
            <div
              key={index}
              className="border border-gray-300 rounded-lg p-4 bg-gray-50"
            >
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nombre de la Variable *
                  </label>
                  <input
                    type="text"
                    value={variable.name}
                    onChange={(e) => updateVariable(index, 'name', e.target.value)}
                    placeholder="ej: target_audience"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-mono text-gray-900 placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Valor por Defecto
                  </label>
                  <input
                    type="text"
                    value={variable.default_value}
                    onChange={(e) =>
                      updateVariable(index, 'default_value', e.target.value)
                    }
                    placeholder="ej: CTOs"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  value={variable.description || ''}
                  onChange={(e) =>
                    updateVariable(index, 'description', e.target.value)
                  }
                  placeholder="ej: Segmento de audiencia objetivo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder:text-gray-400"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={variable.required}
                    onChange={(e) =>
                      updateVariable(index, 'required', e.target.checked)
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Campo requerido al crear campaña
                  </span>
                </label>

                <button
                  onClick={() => removeVariable(index)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          <Save size={18} />
          {saving ? 'Guardando...' : 'Guardar Variables'}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
