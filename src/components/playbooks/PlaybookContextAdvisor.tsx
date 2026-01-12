'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Layers,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Plus,
  ArrowRight,
  Loader2,
  Search,
  Info,
  Zap,
  Crown,
  Target,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Upload,
  BookOpen,
  ExternalLink,
  HardDrive,
  Link as LinkIcon,
  Copy
} from 'lucide-react'
import type { Playbook, PlaybookConfig, Document, DocumentTier, Playbook as PlaybookType } from '@/types/v2.types'
import { TIER_CONFIG, DOCUMENT_TYPES } from '@/types/v2.types'

interface PlaybookContextAdvisorProps {
  playbook: Playbook
  clientId: string
  documents: Document[]
  enrichers?: Playbook[]  // Available enricher playbooks
  onReady: (context: ContextAnalysis) => void
  onUploadDocument?: (docType: string, tier: DocumentTier) => void
  onConnectDrive?: (docType: string, tier: DocumentTier) => void
  onPasteUrl?: (docType: string, tier: DocumentTier) => void
  onRunEnricher?: (enricher: Playbook) => void
  onClose: () => void
}

export interface ContextAnalysis {
  isReady: boolean
  requiredTiers: DocumentTier[]
  requiredDocTypes: string[]
  availableDocuments: Document[]
  missingDocTypes: MissingDocument[]
  suggestions: ContextSuggestion[]
  totalTokens: number
}

interface MissingDocument {
  docType: string
  tier: DocumentTier
  label: string
  description: string
  criticality: 'required' | 'recommended' | 'optional'
  canCreateWith?: Playbook  // Enricher that can create this
}

interface ContextSuggestion {
  type: 'use_enricher' | 'upload_manual' | 'use_existing' | 'skip_optional'
  title: string
  description: string
  action?: () => void
  enricher?: Playbook
  document?: Document
  docType?: string
}

// Helper: Get tier icon
function TierIcon({ tier }: { tier: DocumentTier }) {
  const icons = {
    1: Crown,
    2: Target,
    3: Clock,
  }
  const Icon = icons[tier]
  return <Icon size={14} />
}

export default function PlaybookContextAdvisor({
  playbook,
  clientId,
  documents,
  enrichers = [],
  onReady,
  onUploadDocument,
  onConnectDrive,
  onPasteUrl,
  onRunEnricher,
  onClose,
}: PlaybookContextAdvisorProps) {
  const [loading, setLoading] = useState(true)
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [analysis, setAnalysis] = useState<ContextAnalysis | null>(null)

  const config = playbook.config as PlaybookConfig

  // Analyze context requirements
  const contextAnalysis = useMemo((): ContextAnalysis => {
    // 1. Collect all required tiers and doc types from blocks
    const requiredTiers = new Set<DocumentTier>()
    const requiredDocTypes = new Set<string>()

    config.blocks.forEach((block) => {
      block.context_tiers?.forEach((tier) => requiredTiers.add(tier))
      block.context_docs?.forEach((docId) => {
        // If it's a doc type (not UUID), add it
        if (!docId.includes('-')) {
          requiredDocTypes.add(docId)
        }
      })
    })

    // Also check context_requirements
    config.context_requirements?.required_tiers?.forEach((tier) => requiredTiers.add(tier))
    config.context_requirements?.required_documents?.forEach((doc) => {
      if (!doc.includes('-')) {
        requiredDocTypes.add(doc)
      }
    })

    // 2. Find matching documents in Context Lake
    const availableDocuments = documents.filter((doc) => {
      // Match by tier
      if (requiredTiers.has(doc.tier)) return true
      // Match by doc type
      if (requiredDocTypes.has(doc.document_type)) return true
      return false
    }).filter(doc => doc.approval_status === 'approved')

    // 3. Identify missing document types
    const availableTypes = new Set(availableDocuments.map((d) => d.document_type))
    const missingDocTypes: MissingDocument[] = []

    // Check required doc types
    requiredDocTypes.forEach((docType) => {
      if (!availableTypes.has(docType)) {
        const docTypeInfo = DOCUMENT_TYPES.find((dt) => dt.value === docType)
        const tier = docTypeInfo?.tier || 2

        // Find enricher that can create this
        const enricher = enrichers.find((e) => {
          const eConfig = e.config as PlaybookConfig
          return eConfig.output_config?.document_type === docType
        })

        missingDocTypes.push({
          docType,
          tier: tier as DocumentTier,
          label: docTypeInfo?.label || docType,
          description: `Este playbook requiere un documento de tipo "${docTypeInfo?.label || docType}"`,
          criticality: tier === 1 ? 'required' : 'recommended',
          canCreateWith: enricher,
        })
      }
    })

    // Check required tiers have at least one document
    requiredTiers.forEach((tier) => {
      const tierDocs = availableDocuments.filter((d) => d.tier === tier)
      if (tierDocs.length === 0) {
        const tierInfo = TIER_CONFIG[tier]
        missingDocTypes.push({
          docType: `tier_${tier}`,
          tier,
          label: `Documentos Tier ${tier}`,
          description: `Este playbook requiere al menos un documento en ${tierInfo.name}`,
          criticality: tier === 1 ? 'required' : 'recommended',
        })
      }
    })

    // 4. Generate suggestions
    const suggestions: ContextSuggestion[] = []

    missingDocTypes.forEach((missing) => {
      if (missing.canCreateWith) {
        suggestions.push({
          type: 'use_enricher',
          title: `Crear ${missing.label} con IA`,
          description: `Usa el enricher "${missing.canCreateWith.name}" para generar este documento automáticamente`,
          enricher: missing.canCreateWith,
          docType: missing.docType,
        })
      }

      suggestions.push({
        type: 'upload_manual',
        title: `Subir ${missing.label} manualmente`,
        description: `Sube un archivo existente al Context Lake`,
        docType: missing.docType,
      })

      if (missing.criticality !== 'required') {
        suggestions.push({
          type: 'skip_optional',
          title: `Continuar sin ${missing.label}`,
          description: `Este documento es recomendado pero no obligatorio`,
          docType: missing.docType,
        })
      }
    })

    // 5. Check if ready
    const hasRequiredDocs = missingDocTypes.filter((m) => m.criticality === 'required').length === 0
    const totalTokens = availableDocuments.reduce((sum, d) => sum + (d.token_count || 0), 0)

    return {
      isReady: hasRequiredDocs,
      requiredTiers: Array.from(requiredTiers),
      requiredDocTypes: Array.from(requiredDocTypes),
      availableDocuments,
      missingDocTypes,
      suggestions,
      totalTokens,
    }
  }, [config, documents, enrichers])

  useEffect(() => {
    setAnalysis(contextAnalysis)
    setLoading(false)

    // Pre-select all available approved documents
    const initialSelected = new Set(
      contextAnalysis.availableDocuments
        .filter((d) => d.approval_status === 'approved')
        .map((d) => d.id)
    )
    setSelectedDocs(initialSelected)
  }, [contextAnalysis])

  const handleContinue = () => {
    if (analysis) {
      // Filter to only selected documents
      const selectedDocuments = analysis.availableDocuments.filter((d) =>
        selectedDocs.has(d.id)
      )
      onReady({
        ...analysis,
        availableDocuments: selectedDocuments,
      })
    }
  }

  const toggleDocument = (docId: string) => {
    const newSelected = new Set(selectedDocs)
    if (newSelected.has(docId)) {
      newSelected.delete(docId)
    } else {
      newSelected.add(docId)
    }
    setSelectedDocs(newSelected)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Analizando requisitos de contexto...</p>
        </div>
      </div>
    )
  }

  if (!analysis) return null

  const requiredMissing = analysis.missingDocTypes.filter((m) => m.criticality === 'required')
  const recommendedMissing = analysis.missingDocTypes.filter((m) => m.criticality === 'recommended')

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-lg font-semibold text-white">Preparar Contexto</h2>
              <p className="text-blue-200 text-sm">{playbook.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Summary */}
          <div className={`p-4 rounded-xl border ${
            analysis.isReady
              ? 'bg-green-50 border-green-200'
              : requiredMissing.length > 0
              ? 'bg-red-50 border-red-200'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-start gap-3">
              {analysis.isReady ? (
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3 className={`font-semibold ${
                  analysis.isReady ? 'text-green-800' : 'text-amber-800'
                }`}>
                  {analysis.isReady
                    ? '¡Contexto listo!'
                    : requiredMissing.length > 0
                    ? `Faltan ${requiredMissing.length} documentos requeridos`
                    : `${recommendedMissing.length} documentos recomendados no disponibles`
                  }
                </h3>
                <p className={`text-sm mt-1 ${
                  analysis.isReady ? 'text-green-700' : 'text-amber-700'
                }`}>
                  {analysis.isReady
                    ? `${analysis.availableDocuments.length} documentos disponibles (${analysis.totalTokens.toLocaleString()} tokens)`
                    : 'Revisa las sugerencias abajo para completar el contexto necesario'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Required Tiers */}
          {analysis.requiredTiers.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Layers size={16} />
                Tiers de contexto requeridos
              </h4>
              <div className="flex flex-wrap gap-2">
                {analysis.requiredTiers.map((tier) => {
                  const tierConfig = TIER_CONFIG[tier]
                  const tierDocs = analysis.availableDocuments.filter((d) => d.tier === tier)
                  const hasDocs = tierDocs.length > 0

                  return (
                    <div
                      key={tier}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                        hasDocs ? tierConfig.bgClass : 'bg-gray-100 border-gray-200'
                      }`}
                    >
                      <TierIcon tier={tier} />
                      <span className={`text-sm font-medium ${
                        hasDocs ? tierConfig.textClass : 'text-gray-500'
                      }`}>
                        Tier {tier}: {tierConfig.name}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        hasDocs
                          ? 'bg-white/50 text-gray-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {tierDocs.length} docs
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Missing Documents - Interactive Cards */}
          {analysis.missingDocTypes.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Documentos faltantes ({analysis.missingDocTypes.length})
              </h4>
              <div className="space-y-3">
                {analysis.missingDocTypes.map((missing, idx) => {
                  const docTypeInfo = DOCUMENT_TYPES.find(dt => dt.value === missing.docType)
                  const isExpanded = expandedDoc === missing.docType
                  const isRequired = missing.criticality === 'required'

                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border overflow-hidden transition-all ${
                        isRequired
                          ? 'border-red-200 bg-gradient-to-br from-red-50 to-orange-50'
                          : 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50'
                      }`}
                    >
                      {/* Header - clickable to expand */}
                      <button
                        onClick={() => setExpandedDoc(isExpanded ? null : missing.docType)}
                        className="w-full p-4 flex items-start justify-between text-left hover:bg-white/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-xl ${
                            isRequired ? 'bg-red-100' : 'bg-amber-100'
                          }`}>
                            <FileText size={20} className={
                              isRequired ? 'text-red-600' : 'text-amber-600'
                            } />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{missing.label}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                isRequired
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {isRequired ? 'Requerido' : 'Recomendado'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {docTypeInfo?.description || missing.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-xs px-2 py-0.5 rounded ${TIER_CONFIG[missing.tier].badgeClass}`}>
                                Tier {missing.tier}: {TIER_CONFIG[missing.tier].name}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className={`p-1 rounded-lg transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          <ChevronDown size={20} className="text-gray-400" />
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-4 border-t border-gray-200/50">
                          {/* Document type info */}
                          {docTypeInfo && (
                            <div className="pt-4 space-y-3">
                              {/* Examples */}
                              {'examples' in docTypeInfo && docTypeInfo.examples && (
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-1.5">EJEMPLOS DE ESTE DOCUMENTO:</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {(docTypeInfo.examples as readonly string[]).map((example, i) => (
                                      <span key={i} className="text-xs px-2 py-1 bg-white/80 text-gray-700 rounded-lg border border-gray-200">
                                        {example}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Required for */}
                              {'requiredFor' in docTypeInfo && docTypeInfo.requiredFor && (
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-1.5">SE USA PARA:</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {(docTypeInfo.requiredFor as readonly string[]).map((use, i) => (
                                      <span key={i} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg">
                                        {use}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="pt-3 border-t border-gray-200/50">
                            <p className="text-xs font-medium text-gray-500 mb-3">¿CÓMO QUIERES AGREGAR ESTE DOCUMENTO?</p>
                            <div className="grid grid-cols-2 gap-2">
                              {/* Upload file */}
                              <button
                                onClick={() => onUploadDocument?.(missing.docType, missing.tier)}
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
                                onClick={() => onConnectDrive?.(missing.docType, missing.tier)}
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
                                onClick={() => onPasteUrl?.(missing.docType, missing.tier)}
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

                              {/* Create with AI */}
                              {missing.canCreateWith && onRunEnricher ? (
                                <button
                                  onClick={() => onRunEnricher(missing.canCreateWith!)}
                                  className="flex items-center gap-2 p-3 bg-gradient-to-r from-indigo-500 to-purple-500 border border-transparent rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all text-left group"
                                >
                                  <div className="p-2 bg-white/20 rounded-lg">
                                    <Sparkles size={18} className="text-white" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-white text-sm">Crear con IA</p>
                                    <p className="text-xs text-white/80">Generar automático</p>
                                  </div>
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="flex items-center gap-2 p-3 bg-gray-100 border border-gray-200 rounded-xl text-left opacity-50 cursor-not-allowed"
                                >
                                  <div className="p-2 bg-gray-200 rounded-lg">
                                    <Sparkles size={18} className="text-gray-400" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-500 text-sm">Crear con IA</p>
                                    <p className="text-xs text-gray-400">No disponible</p>
                                  </div>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Available Documents */}
          {analysis.availableDocuments.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-500" />
                  Documentos disponibles ({analysis.availableDocuments.length})
                </h4>
                <button
                  onClick={() => {
                    if (selectedDocs.size === analysis.availableDocuments.length) {
                      setSelectedDocs(new Set())
                    } else {
                      setSelectedDocs(new Set(analysis.availableDocuments.map((d) => d.id)))
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {selectedDocs.size === analysis.availableDocuments.length
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos'}
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {analysis.availableDocuments.map((doc) => {
                  const tierConfig = TIER_CONFIG[doc.tier]
                  const isSelected = selectedDocs.has(doc.id)

                  return (
                    <label
                      key={doc.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDocument(doc.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{doc.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${tierConfig.badgeClass}`}>
                            Tier {doc.tier}
                          </span>
                          <span className="text-xs text-gray-500">
                            {DOCUMENT_TYPES.find((dt) => dt.value === doc.document_type)?.label || doc.document_type}
                          </span>
                          <span className="text-xs text-gray-400">
                            {doc.token_count?.toLocaleString()} tokens
                          </span>
                        </div>
                      </div>

                      <div className={`w-2 h-2 rounded-full ${
                        doc.authority_score >= 0.8 ? 'bg-green-500' :
                        doc.authority_score >= 0.5 ? 'bg-amber-500' : 'bg-gray-400'
                      }`} title={`Authority: ${(doc.authority_score * 100).toFixed(0)}%`} />
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* AI Suggestions */}
          {analysis.suggestions.length > 0 && !analysis.isReady && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Zap size={16} className="text-purple-500" />
                Sugerencias de Gattaca
              </h4>
              <div className="space-y-2">
                {analysis.suggestions
                  .filter((s) => s.type === 'use_enricher')
                  .slice(0, 3)
                  .map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-purple-50 border border-purple-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Sparkles size={16} className="text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-purple-900">{suggestion.title}</p>
                          <p className="text-xs text-purple-700 mt-0.5">{suggestion.description}</p>
                        </div>
                      </div>
                      {suggestion.enricher && onRunEnricher && (
                        <button
                          onClick={() => onRunEnricher(suggestion.enricher!)}
                          className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 flex items-center gap-1"
                        >
                          <Sparkles size={14} />
                          Ejecutar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedDocs.size} documentos seleccionados ·{' '}
            {analysis.availableDocuments
              .filter((d) => selectedDocs.has(d.id))
              .reduce((sum, d) => sum + (d.token_count || 0), 0)
              .toLocaleString()}{' '}
            tokens
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleContinue}
              disabled={!analysis.isReady && requiredMissing.length > 0}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {analysis.isReady ? 'Continuar' : 'Continuar de todos modos'}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
