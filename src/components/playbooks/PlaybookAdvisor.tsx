'use client'

import { useState, useEffect, useMemo } from 'react'
import { Sparkles, Play, ArrowRight, CheckCircle, AlertCircle, Loader2, Target, Layers, Zap, ChevronRight, MessageSquare, Brain } from 'lucide-react'
import type { Playbook, Document, PlaybookConfig } from '@/types/v2.types'
import { TIER_CONFIG } from '@/types/v2.types'
import { PLAYBOOK_TEMPLATES, PlaybookMetadata } from '@/data/example-playbooks'

interface PlaybookAdvisorProps {
  clientId: string
  documents: Document[]
  playbooks: Playbook[]
  onRunPlaybook: (playbook: Playbook, autoInputs: Record<string, any>) => void
  onCreatePlaybook: (template: any) => Promise<Playbook | undefined>
}

interface Recommendation {
  id: string
  templateKey: string
  name: string
  description: string
  reason: string
  priority: 'high' | 'medium' | 'low'
  readiness: number // 0-100 - how ready is the client to run this
  missingContext: string[]
  autoInputs: Record<string, any>
  metadata?: PlaybookMetadata
}

// Analyze client context and generate recommendations
function analyzeContextAndRecommend(
  documents: Document[],
  playbooks: Playbook[]
): Recommendation[] {
  const recommendations: Recommendation[] = []

  // Count documents by type and tier
  const docsByType: Record<string, Document[]> = {}
  const docsByTier: Record<number, Document[]> = { 1: [], 2: [], 3: [] }

  documents.forEach(doc => {
    if (!docsByType[doc.document_type]) {
      docsByType[doc.document_type] = []
    }
    docsByType[doc.document_type].push(doc)
    docsByTier[doc.tier]?.push(doc)
  })

  const hasBrandDNA = docsByType['brand_dna']?.length > 0
  const hasICP = docsByType['icp']?.length > 0
  const hasToneOfVoice = docsByType['tone_of_voice']?.length > 0
  const hasCompetitorAnalysis = docsByType['competitor_analysis']?.length > 0
  const hasCampaignBrief = docsByType['campaign_brief']?.length > 0

  // Check if playbook already exists
  const hasPlaybook = (name: string) =>
    playbooks.some(p => p.name.toLowerCase().includes(name.toLowerCase()))

  // 1. If they have Brand DNA + ICP, recommend video content
  if (hasBrandDNA && hasICP && !hasPlaybook('video')) {
    const template = PLAYBOOK_TEMPLATES['ai-viral-video']
    recommendations.push({
      id: 'rec-viral-video',
      templateKey: 'ai-viral-video',
      name: template.name,
      description: template.description,
      reason: 'Tienes Brand DNA e ICP definidos. Es el momento perfecto para crear contenido de video viral que conecte con tu audiencia.',
      priority: 'high',
      readiness: hasToneOfVoice ? 100 : 80,
      missingContext: hasToneOfVoice ? [] : ['Tone of Voice (opcional pero recomendado)'],
      autoInputs: {
        // Pre-fill based on context
        plataforma: 'TikTok', // Default recommendation
        duracion: '30',
        estilo: 'Cinematográfico',
      },
      metadata: template.metadata as PlaybookMetadata,
    })
  }

  // 2. If they don't have competitor analysis, recommend it
  if (hasBrandDNA && !hasCompetitorAnalysis && !hasPlaybook('competidor')) {
    const template = PLAYBOOK_TEMPLATES['competitor-analysis']
    recommendations.push({
      id: 'rec-competitor',
      templateKey: 'competitor-analysis',
      name: template.name,
      description: template.description,
      reason: 'Aún no tienes análisis de competidores. Esto te ayudará a diferenciarte y encontrar oportunidades de mercado.',
      priority: 'high',
      readiness: hasICP ? 90 : 70,
      missingContext: hasICP ? [] : ['ICP / Buyer Persona (recomendado)'],
      autoInputs: {},
      metadata: template.metadata as PlaybookMetadata,
    })
  }

  // 3. If they have ICP but no content calendar
  if (hasICP && !hasCampaignBrief && !hasPlaybook('calendario')) {
    const template = PLAYBOOK_TEMPLATES['content-research']
    recommendations.push({
      id: 'rec-content-calendar',
      templateKey: 'content-research',
      name: template.name,
      description: template.description,
      reason: 'Con tu ICP definido, puedes crear un calendario de contenido estratégico que resuene con tu audiencia.',
      priority: hasCompetitorAnalysis ? 'high' : 'medium',
      readiness: hasCompetitorAnalysis ? 95 : 75,
      missingContext: hasCompetitorAnalysis ? [] : ['Análisis de competidores (opcional)'],
      autoInputs: {
        mercado: 'LATAM',
        semanas: '4',
      },
      metadata: template.metadata as PlaybookMetadata,
    })
  }

  // Sort by priority and readiness
  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    return b.readiness - a.readiness
  })
}

// Component for asking guided questions
function GuidedQuestion({
  question,
  options,
  onAnswer,
}: {
  question: string
  options: { label: string; value: string; recommended?: boolean }[]
  onAnswer: (value: string) => void
}) {
  return (
    <div className="bg-white border border-indigo-100 rounded-xl p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <MessageSquare className="w-4 h-4 text-indigo-600" />
        </div>
        <p className="text-sm font-medium text-gray-900">{question}</p>
      </div>
      <div className="flex flex-wrap gap-2 ml-11">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onAnswer(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              opt.recommended
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {opt.label}
            {opt.recommended && <span className="ml-1 text-indigo-200">(Recomendado)</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function PlaybookAdvisor({
  clientId,
  documents,
  playbooks,
  onRunPlaybook,
  onCreatePlaybook,
}: PlaybookAdvisorProps) {
  const [selectedRec, setSelectedRec] = useState<string | null>(null)
  const [customInputs, setCustomInputs] = useState<Record<string, any>>({})
  const [isCreating, setIsCreating] = useState(false)
  const [showAllRecs, setShowAllRecs] = useState(false)

  // Generate recommendations
  const recommendations = useMemo(
    () => analyzeContextAndRecommend(documents, playbooks),
    [documents, playbooks]
  )

  // Context summary
  const contextSummary = useMemo(() => {
    const tier1Count = documents.filter(d => d.tier === 1).length
    const tier2Count = documents.filter(d => d.tier === 2).length
    const tier3Count = documents.filter(d => d.tier === 3).length
    return { tier1: tier1Count, tier2: tier2Count, tier3: tier3Count, total: documents.length }
  }, [documents])

  // Handle running a recommendation
  const handleRunRecommendation = async (rec: Recommendation) => {
    setIsCreating(true)
    try {
      const template = PLAYBOOK_TEMPLATES[rec.templateKey as keyof typeof PLAYBOOK_TEMPLATES]
      if (!template) return

      // Create the playbook from template
      const createdPlaybook = await onCreatePlaybook({
        name: template.name,
        description: template.description,
        config: template.config,
        tags: template.tags,
      })

      // If playbook was created successfully, run it with auto-inputs
      if (createdPlaybook) {
        // Small delay to ensure playbook is saved
        setTimeout(() => {
          onRunPlaybook(createdPlaybook as Playbook, rec.autoInputs)
        }, 500)
      }
    } catch (err) {
      console.error('Error creating playbook:', err)
    } finally {
      setIsCreating(false)
    }
  }

  // No recommendations available
  if (recommendations.length === 0 && documents.length === 0) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 rounded-xl">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">Primero, sube tu contexto</h3>
            <p className="text-sm text-amber-700 mb-4">
              Para que Gattaca pueda recomendarte playbooks y ejecutarlos automáticamente,
              necesita conocer tu marca. Sube al menos tu <strong>Brand DNA</strong> o <strong>ICP</strong>.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4 text-amber-600" />
              <span className="text-amber-700">Ve a la pestaña "Context Lake" para empezar</span>
              <ArrowRight className="w-4 h-4 text-amber-600" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-green-100 rounded-xl">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900 mb-1">¡Todo listo!</h3>
            <p className="text-sm text-green-700">
              Ya tienes los playbooks principales configurados. Puedes ejecutarlos
              desde la lista de abajo o crear nuevos personalizados.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const displayedRecs = showAllRecs ? recommendations : recommendations.slice(0, 2)
  const topRecommendation = recommendations[0]

  return (
    <div className="space-y-6">
      {/* AI Advisor Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Gattaca Advisor</h3>
              <p className="text-white/80 text-sm max-w-lg">
                Basándome en tu contexto ({contextSummary.tier1} docs Tier 1, {contextSummary.tier2} Tier 2),
                te recomiendo lo siguiente:
              </p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-white/60">Contexto analizado</p>
            <p className="font-semibold">{contextSummary.total} documentos</p>
          </div>
        </div>
      </div>

      {/* Top Recommendation - Featured */}
      {topRecommendation && (
        <div className="bg-white border-2 border-indigo-200 rounded-2xl overflow-hidden shadow-lg shadow-indigo-100">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-indigo-100">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-600" />
              <span className="font-semibold text-indigo-900">Recomendación Principal</span>
              <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
                topRecommendation.priority === 'high'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {topRecommendation.readiness}% listo
              </span>
            </div>
          </div>

          <div className="p-6">
            <h4 className="text-xl font-semibold text-gray-900 mb-2">
              {topRecommendation.name}
            </h4>
            <p className="text-gray-600 mb-4">{topRecommendation.description}</p>

            {/* Reason */}
            <div className="bg-indigo-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-indigo-800">
                <strong>¿Por qué esto?</strong> {topRecommendation.reason}
              </p>
            </div>

            {/* Missing context warning */}
            {topRecommendation.missingContext.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-amber-800">
                  <strong>Opcional:</strong> Para mejores resultados, considera agregar: {topRecommendation.missingContext.join(', ')}
                </p>
              </div>
            )}

            {/* Auto-configured inputs preview */}
            {Object.keys(topRecommendation.autoInputs).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-2">CONFIGURACIÓN SUGERIDA:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(topRecommendation.autoInputs).map(([key, value]) => (
                    <span key={key} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                      {key}: <strong>{value}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action button */}
            <button
              onClick={() => handleRunRecommendation(topRecommendation)}
              disabled={isCreating}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Configurando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Crear y Ejecutar Automáticamente
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Other recommendations */}
      {recommendations.length > 1 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-700">Otras recomendaciones</h4>
            {recommendations.length > 2 && (
              <button
                onClick={() => setShowAllRecs(!showAllRecs)}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                {showAllRecs ? 'Ver menos' : `Ver todas (${recommendations.length})`}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {displayedRecs.slice(1).map((rec) => (
              <div
                key={rec.id}
                className="bg-white border border-gray-100 rounded-xl p-4 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => setSelectedRec(selectedRec === rec.id ? null : rec.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-indigo-100 transition-colors">
                      <Target className="w-4 h-4 text-gray-600 group-hover:text-indigo-600" />
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-900">{rec.name}</h5>
                      <p className="text-xs text-gray-500">{rec.reason.substring(0, 60)}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      rec.readiness >= 80 ? 'bg-green-100 text-green-700' :
                      rec.readiness >= 50 ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {rec.readiness}%
                    </span>
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${
                      selectedRec === rec.id ? 'rotate-90' : ''
                    }`} />
                  </div>
                </div>

                {/* Expanded details */}
                {selectedRec === rec.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600 mb-3">{rec.reason}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRunRecommendation(rec)
                      }}
                      disabled={isCreating}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-2"
                    >
                      <Play size={14} />
                      Crear y Ejecutar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
