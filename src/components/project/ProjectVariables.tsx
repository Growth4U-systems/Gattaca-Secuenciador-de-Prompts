'use client'

import { useState, useRef } from 'react'
import { Plus, X, Save, Settings, Download, Upload, Variable, Check, AlertCircle, Sparkles, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui'
import { extractVariablesFromFlowConfig } from '@/lib/utils/variableExtractor'

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
  /** Optional: flow_config from playbook to extract variables from */
  playbookFlowConfig?: { steps?: Array<{ prompt?: string }> }
}

export default function ProjectVariables({
  projectId,
  initialVariables,
  onUpdate,
  playbookFlowConfig,
}: ProjectVariablesProps) {
  const toast = useToast()

  const [variables, setVariables] = useState<VariableDefinition[]>(initialVariables || [])
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync variables from playbook prompts
  const handleSyncFromPrompts = async () => {
    if (!playbookFlowConfig) {
      toast.warning('Sin prompts', 'No hay configuración de playbook disponible')
      return
    }

    setSyncing(true)
    try {
      // Extract variables from prompts
      const extracted = extractVariablesFromFlowConfig(playbookFlowConfig)

      if (extracted.length === 0) {
        toast.info('Sin variables', 'No se encontraron variables en los prompts')
        setSyncing(false)
        return
      }

      // Merge with existing variables (keep existing values/descriptions)
      const existingMap = new Map(variables.map(v => [v.name, v]))
      const merged: VariableDefinition[] = []
      let added = 0

      for (const ext of extracted) {
        const existing = existingMap.get(ext.name)
        if (existing) {
          merged.push(existing)
          existingMap.delete(ext.name)
        } else {
          merged.push({
            name: ext.name,
            default_value: ext.default_value || '',
            required: ext.required ?? true,
            description: ext.description || '',
          })
          added++
        }
      }

      // Keep any variables that weren't in prompts (user-defined)
      existingMap.forEach(v => merged.push(v))

      if (added === 0) {
        toast.info('Variables sincronizadas', 'Todas las variables de los prompts ya están definidas')
      } else {
        setVariables(merged)
        setIsEditing(true)
        toast.success('Variables extraídas', `Se encontraron ${added} variable(s) nueva(s). Revisa y guarda los cambios.`)
      }
    } catch (error) {
      console.error('Error syncing variables:', error)
      toast.error('Error', 'No se pudieron extraer las variables')
    } finally {
      setSyncing(false)
    }
  }

  // Export variables to JSON
  const handleExport = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      projectId,
      variables,
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `variables-${projectId}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Import variables from JSON
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        if (data.variables && Array.isArray(data.variables)) {
          setVariables(data.variables)
          setIsEditing(true)
          toast.success('Importación exitosa', `Importadas ${data.variables.length} variables. Revisa y guarda los cambios.`)
        } else {
          throw new Error('Formato inválido')
        }
      } catch (error) {
        toast.error('Error de importación', 'Formato de archivo inválido')
      }
    }
    reader.readAsText(file)
    e.target.value = '' // Reset input
  }

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
      toast.warning('Validación', 'Todas las variables deben tener un nombre')
      return
    }

    // Validate: no duplicate names
    const names = variables.map((v) => v.name.trim())
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
    if (duplicates.length > 0) {
      toast.warning('Nombres duplicados', `Nombres de variables duplicados: ${duplicates.join(', ')}`)
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

      toast.success('Guardado', 'Variables guardadas exitosamente')
      setIsEditing(false)
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error saving variables:', error)
      toast.error('Error al guardar', error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setVariables(initialVariables || [])
    setIsEditing(false)
  }

  // Empty state - no variables defined
  if (!isEditing && variables.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Variable className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Variables del Proyecto</h3>
              <p className="text-xs text-gray-500 mt-0.5">Define variables reutilizables para tus prompts</p>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl mb-4">
            <Sparkles className="w-8 h-8 text-blue-600" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">
            No hay variables definidas
          </h4>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
            Las variables se usan en prompts con formato <code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-600 text-xs font-mono">{'{{ variable }}'}</code>.
            Cada campaña completará los valores de estas variables.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {playbookFlowConfig && (
              <button
                onClick={handleSyncFromPrompts}
                disabled={syncing}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg inline-flex items-center gap-2 font-medium disabled:opacity-50"
              >
                {syncing ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <RefreshCw size={18} />
                )}
                Extraer de Prompts
              </button>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="px-5 py-2.5 bg-white text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-all inline-flex items-center gap-2 font-medium"
            >
              <Plus size={18} />
              Definir Manualmente
            </button>
          </div>
        </div>
      </div>
    )
  }

  // View mode - showing existing variables
  if (!isEditing) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Variable className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Variables del Proyecto</h3>
                <p className="text-xs text-gray-500 mt-0.5">{variables.length} variable{variables.length !== 1 ? 's' : ''} definida{variables.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {variables.length > 0 && (
                <button
                  onClick={handleExport}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-white/80 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                  title="Exportar variables"
                >
                  <Download size={16} />
                  Exportar
                </button>
              )}
              <label className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-white/80 rounded-lg cursor-pointer inline-flex items-center gap-1.5 transition-colors">
                <Upload size={16} />
                Importar
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImport}
                  accept=".json"
                  className="hidden"
                />
              </label>
              {playbookFlowConfig && (
                <button
                  onClick={handleSyncFromPrompts}
                  disabled={syncing}
                  className="px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Sincronizar variables desde prompts"
                >
                  {syncing ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  Sincronizar
                </button>
              )}
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-sm bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 font-medium transition-colors"
              >
                Editar
              </button>
            </div>
          </div>
        </div>

        {/* Variables Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {variables.map((variable, index) => (
              <div
                key={index}
                className="group bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <code className="text-sm font-mono text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                    {'{{ '}{variable.name}{' }}'}
                  </code>
                  {variable.required && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      Requerida
                    </span>
                  )}
                </div>
                {variable.description && (
                  <p className="text-sm text-gray-600 mb-3">{variable.description}</p>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">Valor por defecto:</span>
                  <span className={`font-medium ${variable.default_value ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                    {variable.default_value || '(vacío)'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Edit mode
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Variable className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Variables del Proyecto</h3>
              <p className="text-xs text-gray-500 mt-0.5">Modo edición</p>
            </div>
          </div>
          <button
            onClick={addVariable}
            className="px-4 py-2 text-sm bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus size={16} />
            Agregar Variable
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mx-6 mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-blue-100 rounded-lg">
            <Sparkles size={16} className="text-blue-600" />
          </div>
          <p className="text-sm text-blue-800">
            Estas variables estarán disponibles en todas las campañas de este proyecto.
            Usa <code className="bg-white/60 px-1.5 py-0.5 rounded text-blue-700 font-mono text-xs">{'{{ nombre_variable }}'}</code> en tus prompts.
          </p>
        </div>
      </div>

      {/* Variables List */}
      <div className="p-6">
        {variables.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <Variable size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">
              No hay variables. Click en "Agregar Variable" para crear una.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {variables.map((variable, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Nombre de la Variable <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={variable.name}
                      onChange={(e) => updateVariable(index, 'name', e.target.value)}
                      placeholder="ej: target_audience"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono text-gray-900 placeholder:text-gray-400 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Valor por Defecto
                    </label>
                    <input
                      type="text"
                      value={variable.default_value}
                      onChange={(e) =>
                        updateVariable(index, 'default_value', e.target.value)
                      }
                      placeholder="ej: CTOs"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400 transition-all"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Descripción <span className="text-gray-400">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={variable.description || ''}
                    onChange={(e) =>
                      updateVariable(index, 'description', e.target.value)
                    }
                    placeholder="ej: Segmento de audiencia objetivo"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400 transition-all"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={variable.required}
                      onChange={(e) =>
                        updateVariable(index, 'required', e.target.checked)
                      }
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                      Campo requerido al crear campaña
                    </span>
                  </label>

                  <button
                    onClick={() => removeVariable(index)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar variable"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg transition-all"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={18} />
                Guardar Variables
              </>
            )}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
