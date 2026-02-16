'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { INPUT_VARIABLES, VARIABLE_GROUPS } from '@/lib/playbooks/niche-finder/variables'
import type { GeneratedStrategy } from '@/lib/playbooks/niche-finder/types'

interface SetupPhaseViewProps {
  projectId: string
  onStrategyGenerated: (strategy: GeneratedStrategy) => void
}

export default function SetupPhaseView({ projectId, onStrategyGenerated }: SetupPhaseViewProps) {
  const [values, setValues] = useState<Record<string, string>>({
    company_name: '',
    country: 'España',
    context_type: 'both',
    product_docs_summary: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!values.company_name?.trim()) {
      setError('El nombre de la empresa es obligatorio')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/niche-finder/generate-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: values.company_name,
          country: values.country,
          context_type: values.context_type,
          project_id: projectId,
          product_docs_summary: values.product_docs_summary || undefined,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error generando estrategia')
      }

      onStrategyGenerated(data as GeneratedStrategy)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const requiredVars = INPUT_VARIABLES.filter(v =>
    VARIABLE_GROUPS.required.variables.includes(v.name)
  )
  const optionalVars = INPUT_VARIABLES.filter(v =>
    VARIABLE_GROUPS.optional.variables.includes(v.name)
  )

  const renderField = (variable: typeof INPUT_VARIABLES[0]) => {
    if (variable.type === 'select' && variable.options) {
      return (
        <select
          value={values[variable.name] || variable.defaultValue || ''}
          onChange={e => setValues(prev => ({ ...prev, [variable.name]: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {variable.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )
    }

    if (variable.type === 'textarea') {
      return (
        <textarea
          value={values[variable.name] || ''}
          onChange={e => setValues(prev => ({ ...prev, [variable.name]: e.target.value }))}
          placeholder={variable.placeholder}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      )
    }

    return (
      <input
        type="text"
        value={values[variable.name] || ''}
        onChange={e => setValues(prev => ({ ...prev, [variable.name]: e.target.value }))}
        placeholder={variable.placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    )
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Configuración Inicial</h2>
        <p className="text-sm text-gray-500 mt-1">
          Introduce los datos básicos y generaremos automáticamente la estrategia de búsqueda.
        </p>
      </div>

      {/* Required fields */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">{VARIABLE_GROUPS.required.label}</h3>
        {requiredVars.map(variable => (
          <div key={variable.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {variable.label}
              {variable.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {renderField(variable)}
            {variable.description && (
              <p className="text-xs text-gray-400 mt-1">{variable.description}</p>
            )}
          </div>
        ))}
      </div>

      {/* Optional fields */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">{VARIABLE_GROUPS.optional.label}</h3>
        {optionalVars.map(variable => (
          <div key={variable.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {variable.label}
            </label>
            {renderField(variable)}
            {variable.description && (
              <p className="text-xs text-gray-400 mt-1">{variable.description}</p>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading || !values.company_name?.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generando estrategia...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generar Estrategia de Búsqueda
          </>
        )}
      </button>
    </div>
  )
}
