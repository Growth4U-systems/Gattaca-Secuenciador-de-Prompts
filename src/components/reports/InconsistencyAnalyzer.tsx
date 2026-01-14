'use client'

import { useState } from 'react'
import { AlertTriangle, Check, RefreshCw, Loader2, ChevronDown, ChevronRight, Edit2, X, CheckCircle2 } from 'lucide-react'
import { InconsistencyResult } from '@/types/flow.types'

interface InconsistencyAnalyzerProps {
  inconsistencies: InconsistencyResult[]
  analyzing: boolean
  onResolve: (id: string, resolvedValue: string) => void
  onReanalyze: () => void
}

export default function InconsistencyAnalyzer({
  inconsistencies,
  analyzing,
  onResolve,
  onReanalyze,
}: InconsistencyAnalyzerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  const startEditing = (id: string, currentValue: string) => {
    setEditingId(id)
    setEditValue(currentValue)
  }

  const saveEdit = (id: string) => {
    if (editValue.trim()) {
      onResolve(id, editValue.trim())
    }
    setEditingId(null)
    setEditValue('')
  }

  const selectValue = (id: string, value: string) => {
    onResolve(id, value)
  }

  // Group by severity
  const highSeverity = inconsistencies.filter(i => i.severity === 'high' && !i.resolved)
  const mediumSeverity = inconsistencies.filter(i => i.severity === 'medium' && !i.resolved)
  const lowSeverity = inconsistencies.filter(i => i.severity === 'low' && !i.resolved)
  const resolved = inconsistencies.filter(i => i.resolved)

  const getSeverityColors = (severity: string) => {
    switch (severity) {
      case 'high':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' }
      case 'medium':
        return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' }
      case 'low':
        return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' }
      default:
        return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-700' }
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'numeric':
        return 'Dato numerico'
      case 'factual':
        return 'Afirmacion'
      case 'missing':
        return 'Dato faltante'
      default:
        return type
    }
  }

  if (analyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Analizando inconsistencias...</h3>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Estamos comparando los datos de todas las campanas seleccionadas
          para detectar posibles contradicciones o datos faltantes.
        </p>
      </div>
    )
  }

  if (inconsistencies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="p-4 bg-emerald-100 rounded-full mb-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin inconsistencias detectadas</h3>
        <p className="text-sm text-gray-500 text-center max-w-md mb-6">
          Los datos de las campanas seleccionadas son consistentes entre si.
          Puedes proceder a generar el reporte.
        </p>
        <button
          onClick={onReanalyze}
          className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Volver a analizar
        </button>
      </div>
    )
  }

  const renderInconsistencyCard = (inconsistency: InconsistencyResult) => {
    const colors = getSeverityColors(inconsistency.severity)
    const isExpanded = expandedIds.has(inconsistency.id)
    const isEditing = editingId === inconsistency.id

    return (
      <div
        key={inconsistency.id}
        className={`rounded-xl border-2 ${colors.border} ${colors.bg} overflow-hidden`}
      >
        {/* Header */}
        <div
          onClick={() => toggleExpanded(inconsistency.id)}
          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/50 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className={`w-5 h-5 ${colors.text}`} />
          ) : (
            <ChevronRight className={`w-5 h-5 ${colors.text}`} />
          )}

          <AlertTriangle className={`w-5 h-5 ${colors.text}`} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold ${colors.text}`}>{inconsistency.field}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
                {getTypeLabel(inconsistency.type)}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-0.5 truncate">
              {inconsistency.description}
            </p>
          </div>

          <div className="text-sm text-gray-500">
            {inconsistency.campaigns.length} campanas
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-gray-200 bg-white p-4">
            {/* Campaign values */}
            <div className="space-y-3 mb-4">
              {inconsistency.campaigns.map((campaign, idx) => (
                <div
                  key={`${campaign.campaignId}-${idx}`}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{campaign.campaignName}</div>
                    <div className="text-sm text-gray-500">Paso: {campaign.stepName}</div>
                    <div className="mt-1 text-gray-700 bg-white p-2 rounded border border-gray-200">
                      "{campaign.value}"
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      selectValue(inconsistency.id, campaign.value)
                    }}
                    className="px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                  >
                    Usar este
                  </button>
                </div>
              ))}
            </div>

            {/* Suggested resolution */}
            {inconsistency.suggestedResolution && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
                <div className="text-sm font-medium text-emerald-700 mb-1">Sugerencia:</div>
                <div className="text-sm text-emerald-800">{inconsistency.suggestedResolution}</div>
              </div>
            )}

            {/* Custom value input */}
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Ingresa el valor correcto..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(inconsistency.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    saveEdit(inconsistency.id)
                  }}
                  className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingId(null)
                  }}
                  className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    startEditing(inconsistency.id, '')
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Ingresar valor personalizado
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-gray-900">
              {inconsistencies.length - resolved.length} inconsistencias pendientes
            </span>
          </div>
          {resolved.length > 0 && (
            <span className="text-sm text-emerald-600">
              ({resolved.length} resueltas)
            </span>
          )}
        </div>
        <button
          onClick={onReanalyze}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Re-analizar
        </button>
      </div>

      {/* High severity */}
      {highSeverity.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            Alta severidad ({highSeverity.length})
          </h4>
          <div className="space-y-3">
            {highSeverity.map(renderInconsistencyCard)}
          </div>
        </div>
      )}

      {/* Medium severity */}
      {mediumSeverity.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full" />
            Media severidad ({mediumSeverity.length})
          </h4>
          <div className="space-y-3">
            {mediumSeverity.map(renderInconsistencyCard)}
          </div>
        </div>
      )}

      {/* Low severity */}
      {lowSeverity.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
            Baja severidad ({lowSeverity.length})
          </h4>
          <div className="space-y-3">
            {lowSeverity.map(renderInconsistencyCard)}
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Resueltas ({resolved.length})
          </h4>
          <div className="space-y-2">
            {resolved.map(inconsistency => (
              <div
                key={inconsistency.id}
                className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg"
              >
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-gray-700">{inconsistency.field}</span>
                <span className="text-sm text-gray-500">→</span>
                <span className="text-sm text-emerald-700">"{inconsistency.resolvedValue}"</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
