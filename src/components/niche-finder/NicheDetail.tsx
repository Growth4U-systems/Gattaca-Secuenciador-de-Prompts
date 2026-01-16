'use client'

import React from 'react'
import {
  X,
  User,
  AlertTriangle,
  Brain,
  Heart,
  Quote,
  Lightbulb,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react'
import type { ExtractedNiche } from '@/types/scraper.types'

interface NicheDetailProps {
  niche: ExtractedNiche
  onClose: () => void
}

export default function NicheDetail({ niche, onClose }: NicheDetailProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    const text = `
Problema: ${niche.problem}
Persona: ${niche.persona}
Causa Funcional: ${niche.functional_cause}
Carga Emocional: ${niche.emotional_load}
Evidencia: ${niche.evidence}
Alternativas: ${niche.alternatives}
URL: ${niche.source_url}
    `.trim()

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Split evidence by | separator
  const evidenceQuotes = niche.evidence
    ?.split('|')
    .map((q) => q.trim())
    .filter(Boolean)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Detalle del Nicho</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-white/50 rounded transition-colors"
            title="Copiar"
          >
            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-white/50 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
        {/* Problem */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
            <AlertTriangle size={14} className="text-amber-500" />
            Problema
          </div>
          <p className="text-gray-900 text-sm leading-relaxed">{niche.problem}</p>
        </div>

        {/* Persona */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
            <User size={14} className="text-blue-500" />
            Persona
          </div>
          <p className="text-gray-900 text-sm">{niche.persona}</p>
        </div>

        {/* Functional Cause */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
            <Brain size={14} className="text-purple-500" />
            Causa Funcional
          </div>
          <p className="text-gray-700 text-sm">{niche.functional_cause}</p>
        </div>

        {/* Emotional Load */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
            <Heart size={14} className="text-red-500" />
            Carga Emocional
          </div>
          <p className="text-gray-700 text-sm">{niche.emotional_load}</p>
        </div>

        {/* Evidence */}
        {evidenceQuotes && evidenceQuotes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
              <Quote size={14} className="text-green-500" />
              Evidencia ({evidenceQuotes.length} citas)
            </div>
            <div className="space-y-2">
              {evidenceQuotes.map((quote, index) => (
                <div
                  key={index}
                  className="pl-3 border-l-2 border-green-200 text-sm text-gray-600 italic"
                >
                  &quot;{quote}&quot;
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alternatives */}
        {niche.alternatives && (
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
              <Lightbulb size={14} className="text-yellow-500" />
              Alternativas Actuales
            </div>
            <p className="text-gray-700 text-sm">{niche.alternatives}</p>
          </div>
        )}

        {/* Source URL */}
        {niche.source_url && (
          <div className="pt-2 border-t border-gray-100">
            <a
              href={niche.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700"
            >
              <ExternalLink size={14} />
              Ver fuente original
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
