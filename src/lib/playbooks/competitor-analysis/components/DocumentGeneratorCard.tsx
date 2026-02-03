'use client'

/**
 * DocumentGeneratorCard Component
 *
 * Card individual para cada documento requerido.
 * Muestra estado, permite input inline y lanzar generación.
 */

import { useState } from 'react'
import {
  Globe,
  MessageSquare,
  Star,
  Search,
  Newspaper,
  FileText,
  Sparkles,
  Check,
  Clock,
  AlertCircle,
  ChevronDown,
  ExternalLink,
  RefreshCw,
  X,
} from 'lucide-react'
import type {
  DocumentRequirement,
  ExistingDocumentOption,
  SourceType,
  ScraperInputMapping,
} from '../types'
import { formatCreatedAt } from '../documentMatcher'
import { SCRAPER_INPUT_MAPPINGS } from '../constants'

// ============================================
// ICON MAP
// ============================================

const iconMap = {
  globe: Globe,
  social: MessageSquare,
  review: Star,
  search: Search,
  news: Newspaper,
  file: FileText,
  research: Sparkles,
}

// ============================================
// PROPS
// ============================================

export interface DocumentGeneratorCardProps {
  requirement: DocumentRequirement
  competitorName: string
  projectId: string
  campaignId?: string
  scraperInput?: string
  existingDocuments?: ExistingDocumentOption[]
  status: 'available' | 'missing' | 'in_progress'
  isGenerating?: boolean
  onGenerate: (sourceType: SourceType, input: Record<string, any>) => Promise<void>
  onUseExisting: (documentId: string, sourceType: SourceType) => void
  onSkip?: (sourceType: SourceType) => void
  onViewDocument?: (documentId: string) => void
  className?: string
}

// ============================================
// COMPONENT
// ============================================

export default function DocumentGeneratorCard({
  requirement,
  competitorName,
  projectId,
  campaignId,
  scraperInput: initialInput,
  existingDocuments = [],
  status,
  isGenerating = false,
  onGenerate,
  onUseExisting,
  onSkip,
  onViewDocument,
  className = '',
}: DocumentGeneratorCardProps) {
  const [inputValue, setInputValue] = useState(initialInput || '')
  const [showExisting, setShowExisting] = useState(false)
  const [isExpanded, setIsExpanded] = useState(status === 'missing')

  const Icon = iconMap[requirement.icon] || FileText
  const scraperMapping = SCRAPER_INPUT_MAPPINGS[requirement.id] as ScraperInputMapping | undefined

  // Handle generate
  const handleGenerate = async () => {
    if (requirement.source === 'deep_research') {
      // Deep Research no necesita input adicional
      await onGenerate(requirement.source_type, { competitorName })
    } else if (scraperMapping) {
      // Scraper necesita input
      if (!inputValue.trim() && scraperMapping.required !== false) {
        return // No generar si falta input requerido
      }
      await onGenerate(requirement.source_type, {
        [scraperMapping.inputKey]: inputValue.trim(),
      })
    } else {
      await onGenerate(requirement.source_type, {})
    }
  }

  // Handle use existing
  const handleUseExisting = (docId: string) => {
    onUseExisting(docId, requirement.source_type)
    setShowExisting(false)
  }

  // Status badge
  const StatusBadge = () => {
    if (status === 'available') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <Check size={12} />
          Disponible
        </span>
      )
    }
    if (status === 'in_progress') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <Clock size={12} className="animate-spin" />
          Generando...
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        <AlertCircle size={12} />
        Faltante
      </span>
    )
  }

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all ${
        status === 'available'
          ? 'border-green-200 bg-green-50/30'
          : status === 'in_progress'
            ? 'border-blue-200 bg-blue-50/30'
            : 'border-gray-200 bg-white'
      } ${className}`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              status === 'available'
                ? 'bg-green-100 text-green-600'
                : status === 'in_progress'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-500'
            }`}
          >
            <Icon size={18} />
          </div>
          <div className="text-left">
            <h4 className="font-medium text-gray-900">{requirement.name}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{requirement.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge />
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {/* Existing documents selector */}
          {existingDocuments.length > 0 && status !== 'in_progress' && (
            <div className="space-y-2">
              <button
                onClick={() => setShowExisting(!showExisting)}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <FileText size={14} />
                {existingDocuments.length} documento(s) existente(s)
                <ChevronDown
                  size={14}
                  className={`transition-transform ${showExisting ? 'rotate-180' : ''}`}
                />
              </button>

              {showExisting && (
                <div className="space-y-1 pl-4">
                  {existingDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm"
                    >
                      <div>
                        <span className="text-gray-700">{doc.name}</span>
                        <span className="text-gray-400 ml-2">
                          ({formatCreatedAt(doc.createdAt)})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {onViewDocument && (
                          <button
                            onClick={() => onViewDocument(doc.id)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title="Ver documento"
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleUseExisting(doc.id)}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Usar este
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Input field for scrapers */}
          {requirement.source === 'scraping' && scraperMapping && status !== 'in_progress' && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {scraperMapping.label}
                {scraperMapping.required !== false && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>
              {scraperMapping.type === 'textarea' ? (
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={scraperMapping.placeholder}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                />
              ) : (
                <input
                  type={scraperMapping.type === 'url' ? 'url' : 'text'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={scraperMapping.placeholder}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
              {/* Show scraper/actor info */}
              {requirement.apifyActor && (
                <p className="text-xs text-gray-400 mt-1">
                  Scraper: {requirement.apifyActor}
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          {status !== 'in_progress' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerate}
                disabled={
                  isGenerating ||
                  (requirement.source === 'scraping' &&
                    scraperMapping?.required !== false &&
                    !inputValue.trim())
                }
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  status === 'available'
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Generando...
                  </>
                ) : status === 'available' ? (
                  <>
                    <RefreshCw size={16} />
                    Regenerar
                  </>
                ) : requirement.source === 'deep_research' ? (
                  <>
                    <Sparkles size={16} />
                    Generar Deep Research
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    Lanzar Scraper
                  </>
                )}
              </button>

              {onSkip && status === 'missing' && (
                <button
                  onClick={() => onSkip(requirement.source_type)}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="No tiene este recurso"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          {/* In progress state */}
          {status === 'in_progress' && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <RefreshCw size={16} className="animate-spin" />
              <span>Generando documento... Esto puede tomar unos minutos.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
