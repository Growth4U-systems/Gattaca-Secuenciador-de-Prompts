'use client'

import { useState, useMemo } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  Upload,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Dna,
  Users,
  MessageSquare,
  Package,
  Target,
  ExternalLink,
  Play,
  Info,
  Crown,
  Zap,
  ArrowRight,
  HardDrive,
  Link as LinkIcon
} from 'lucide-react'
import type { Document, DocumentTier, FoundationalPlaceholder, Playbook } from '@/types/v2.types'
import { FOUNDATIONAL_PLACEHOLDERS, getFoundationalStatus, TIER_CONFIG } from '@/types/v2.types'

interface FoundationalDocumentsProps {
  documents: Document[]
  onUploadDocument?: (docType: string, tier: DocumentTier) => void
  onConnectDrive?: (docType: string, tier: DocumentTier) => void
  onPasteUrl?: (docType: string, tier: DocumentTier) => void
  onGenerateDocument?: (placeholder: FoundationalPlaceholder) => void
  generatorPlaybooks?: Playbook[]  // Playbooks that can generate foundational docs
}

// Map icon names to components
const iconMap: Record<string, typeof FileText> = {
  Dna,
  Users,
  MessageSquare,
  Package,
  Target,
  FileText,
}

function PlaceholderIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = iconMap[icon] || FileText
  return <Icon className={className} />
}

export default function FoundationalDocuments({
  documents,
  onUploadDocument,
  onConnectDrive,
  onPasteUrl,
  onGenerateDocument,
  generatorPlaybooks = [],
}: FoundationalDocumentsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const status = useMemo(() => getFoundationalStatus(documents), [documents])

  // Group placeholders by status
  const completedDocs = useMemo(() => {
    return FOUNDATIONAL_PLACEHOLDERS.filter(p => status.completed.includes(p.id))
  }, [status.completed])

  const pendingDocs = useMemo(() => {
    return status.pending.sort((a, b) => {
      const priorityOrder = { critical: 0, important: 1, recommended: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }, [status.pending])

  // Find matching playbook for a placeholder
  const getGeneratorPlaybook = (placeholder: FoundationalPlaceholder) => {
    return generatorPlaybooks.find(p => {
      const config = p.config as any
      return config?.output_config?.document_type === placeholder.docType
    })
  }

  const renderPlaceholder = (placeholder: FoundationalPlaceholder, isCompleted: boolean) => {
    const isExpanded = expandedId === placeholder.id
    const generatorPlaybook = getGeneratorPlaybook(placeholder)

    const priorityConfig = {
      critical: {
        bgClass: 'bg-gradient-to-br from-red-50 to-orange-50',
        borderClass: 'border-red-200',
        badgeClass: 'bg-red-100 text-red-700',
        label: 'Crítico',
      },
      important: {
        bgClass: 'bg-gradient-to-br from-amber-50 to-yellow-50',
        borderClass: 'border-amber-200',
        badgeClass: 'bg-amber-100 text-amber-700',
        label: 'Importante',
      },
      recommended: {
        bgClass: 'bg-gradient-to-br from-blue-50 to-indigo-50',
        borderClass: 'border-blue-200',
        badgeClass: 'bg-blue-100 text-blue-700',
        label: 'Recomendado',
      },
    }

    const config = isCompleted
      ? { bgClass: 'bg-gradient-to-br from-green-50 to-emerald-50', borderClass: 'border-green-200' }
      : priorityConfig[placeholder.priority]

    return (
      <div
        key={placeholder.id}
        className={`rounded-xl border overflow-hidden transition-all ${config.borderClass} ${config.bgClass}`}
      >
        {/* Header */}
        <button
          onClick={() => setExpandedId(isExpanded ? null : placeholder.id)}
          className="w-full p-4 flex items-start justify-between text-left hover:bg-white/30 transition-colors"
        >
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${
              isCompleted
                ? 'bg-green-100'
                : placeholder.priority === 'critical'
                ? 'bg-red-100'
                : placeholder.priority === 'important'
                ? 'bg-amber-100'
                : 'bg-blue-100'
            }`}>
              {isCompleted ? (
                <CheckCircle2 size={24} className="text-green-600" />
              ) : (
                <PlaceholderIcon
                  icon={placeholder.icon}
                  className={`w-6 h-6 ${
                    placeholder.priority === 'critical'
                      ? 'text-red-600'
                      : placeholder.priority === 'important'
                      ? 'text-amber-600'
                      : 'text-blue-600'
                  }`}
                />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900">{placeholder.label}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${TIER_CONFIG[placeholder.tier].badgeClass}`}>
                  Tier {placeholder.tier}
                </span>
                {!isCompleted && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${priorityConfig[placeholder.priority].badgeClass}`}>
                    {priorityConfig[placeholder.priority].label}
                  </span>
                )}
                {isCompleted && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    ✓ Completado
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">{placeholder.description}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {placeholder.estimatedTime}
                </span>
                {placeholder.canGenerateWith && !isCompleted && (
                  <span className="flex items-center gap-1 text-purple-600">
                    <Sparkles size={12} />
                    Generable con IA
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className={`p-1 rounded-lg transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown size={20} className="text-gray-400" />
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-gray-200/50">
            {/* What it is */}
            <div className="pt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Info size={12} />
                ¿Qué es este documento?
              </h4>
              <p className="text-sm text-gray-700">{placeholder.whatItIs}</p>
            </div>

            {/* Why you need it */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Zap size={12} />
                ¿Por qué lo necesitas?
              </h4>
              <p className="text-sm text-gray-700">{placeholder.whyYouNeedIt}</p>
            </div>

            {/* Actions */}
            {!isCompleted && (
              <div className="pt-3 border-t border-gray-200/50">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  ¿Cómo quieres agregar este documento?
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {/* Upload file */}
                  <button
                    onClick={() => onUploadDocument?.(placeholder.docType, placeholder.tier)}
                    className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all text-left group"
                  >
                    <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                      <Upload size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Subir archivo</p>
                      <p className="text-xs text-gray-500">PDF, Word, TXT</p>
                    </div>
                  </button>

                  {/* Connect Drive */}
                  <button
                    onClick={() => onConnectDrive?.(placeholder.docType, placeholder.tier)}
                    className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all text-left group"
                  >
                    <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                      <HardDrive size={18} className="text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Google Drive</p>
                      <p className="text-xs text-gray-500">Conectar y buscar</p>
                    </div>
                  </button>

                  {/* Paste URL */}
                  <button
                    onClick={() => onPasteUrl?.(placeholder.docType, placeholder.tier)}
                    className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all text-left group"
                  >
                    <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                      <LinkIcon size={18} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Pegar URL</p>
                      <p className="text-xs text-gray-500">Notion, Docs, web</p>
                    </div>
                  </button>

                  {/* Generate with AI */}
                  {placeholder.canGenerateWith && (
                    <button
                      onClick={() => onGenerateDocument?.(placeholder)}
                      className="flex items-center gap-2 p-3 bg-gradient-to-r from-indigo-500 to-purple-500 border border-transparent rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all text-left group"
                    >
                      <div className="p-2 bg-white/20 rounded-lg">
                        <Sparkles size={18} className="text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">Generar con IA</p>
                        <p className="text-xs text-white/80">
                          {generatorPlaybook ? generatorPlaybook.name : 'Crear automático'}
                        </p>
                      </div>
                    </button>
                  )}
                </div>

                {/* Inputs needed */}
                {placeholder.canGenerateWith && placeholder.inputsNeeded.length > 0 && (
                  <div className="mt-3 p-3 bg-purple-50/50 rounded-lg">
                    <p className="text-xs font-medium text-purple-700 mb-2">
                      Para generar con IA necesitarás:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {placeholder.inputsNeeded.map((input, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-white text-purple-700 rounded-lg border border-purple-200">
                          {input}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Completed - show document info */}
            {isCompleted && (
              <div className="pt-3 border-t border-gray-200/50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-green-700">
                    ✓ Ya tienes este documento en tu Context Lake
                  </p>
                  <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    Ver documento
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Documentos Fundacionales</h2>
              <p className="text-indigo-200 text-sm">La base de conocimiento de tu marca</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{status.completionPercent}%</div>
            <div className="text-indigo-200 text-sm">completado</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${status.completionPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-indigo-200">
            {status.completed.length} de {FOUNDATIONAL_PLACEHOLDERS.length} documentos
          </span>
          {status.criticalMissing.length > 0 && (
            <span className="flex items-center gap-1 text-amber-300">
              <AlertTriangle size={14} />
              {status.criticalMissing.length} críticos pendientes
            </span>
          )}
        </div>
      </div>

      {/* Critical Missing Alert */}
      {status.criticalMissing.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800">Documentos críticos pendientes</h3>
              <p className="text-sm text-red-700 mt-1">
                Sin estos documentos, los playbooks de contenido no podrán generar resultados óptimos.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {status.criticalMissing.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setExpandedId(p.id)}
                    className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Documents */}
      {pendingDocs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FileText size={16} />
            Pendientes ({pendingDocs.length})
          </h3>
          <div className="space-y-3">
            {pendingDocs.map(p => renderPlaceholder(p, false))}
          </div>
        </div>
      )}

      {/* Completed Documents */}
      {completedDocs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-500" />
            Completados ({completedDocs.length})
          </h3>
          <div className="space-y-3">
            {completedDocs.map(p => renderPlaceholder(p, true))}
          </div>
        </div>
      )}

      {/* All complete message */}
      {pendingDocs.length === 0 && (
        <div className="text-center py-8 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-green-800">
            ¡Todos los documentos fundacionales están completos!
          </h3>
          <p className="text-sm text-green-700 mt-1">
            Tu Context Lake está listo para alimentar playbooks de contenido.
          </p>
        </div>
      )}
    </div>
  )
}
