'use client'

import { useState } from 'react'
import { Workflow, Calendar, MoreVertical, Play, Edit2, Copy, Trash2, Archive, Tag, Clock, Target, Layers, ChevronDown, ChevronUp, Sparkles, Key, CheckCircle2, AlertCircle, FileText } from 'lucide-react'
import type { Playbook, PlaybookStatus, PlaybookConfig, AIProvider } from '@/types/v2.types'
import { TIER_CONFIG, AI_PROVIDERS, DOCUMENT_TYPES, getPlaybookRequiredProviders, getPlaybookContextRequirements } from '@/types/v2.types'

interface PlaybookCardProps {
  playbook: Playbook
  onRun?: (playbook: Playbook) => void
  onEdit?: (playbook: Playbook) => void
  onDuplicate?: (playbook: Playbook) => void
  onArchive?: (playbook: Playbook) => void
  onDelete?: (playbook: Playbook) => void
  showDetails?: boolean
  apiStatus?: Record<string, boolean>  // Which APIs are configured
}

const statusConfig: Record<PlaybookStatus, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-amber-100 text-amber-800' },
  active: { label: 'Activo', color: 'bg-green-100 text-green-800' },
  archived: { label: 'Archivado', color: 'bg-slate-100 text-slate-600' },
}

export default function PlaybookCard({
  playbook,
  onRun,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
  showDetails = false,
  apiStatus = { openrouter: true },  // Default: OpenRouter is configured
}: PlaybookCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [expanded, setExpanded] = useState(showDetails)

  const status = statusConfig[playbook.status]
  const config = playbook.config as PlaybookConfig
  const blocks = config?.blocks || []
  const blockCount = blocks.length
  const isRunnable = playbook.status === 'active' || playbook.status === 'draft'

  // Get unique context tiers used
  const usedTiers = new Set<number>()
  blocks.forEach((block) => {
    block.context_tiers?.forEach((tier) => usedTiers.add(tier))
  })

  // Count prompt blocks vs review blocks
  const promptBlocks = blocks.filter((b) => b.type === 'prompt').length
  const reviewBlocks = blocks.filter((b) => b.type === 'human_review').length

  // Get required AI providers
  const requiredProviders = getPlaybookRequiredProviders(config)
  const allProvidersReady = apiStatus.openrouter === true  // All use OpenRouter

  // Get required context
  const contextReqs = getPlaybookContextRequirements(config)
  const hasContextReqs = contextReqs.totalRequired > 0

  return (
    <div className="group bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-blue-200 hover:shadow-md transition-all relative">
      {/* Main content */}
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
              <Workflow className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{playbook.name}</h3>
              <p className="text-xs text-gray-500">
                {playbook.type === 'enricher' ? 'Enricher' : 'Playbook'} · v{playbook.version}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>

            {/* Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical size={16} />
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
                    {onEdit && (
                      <button
                        onClick={() => { onEdit(playbook); setShowMenu(false) }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Edit2 size={14} />
                        Editar
                      </button>
                    )}
                    {onDuplicate && (
                      <button
                        onClick={() => { onDuplicate(playbook); setShowMenu(false) }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Copy size={14} />
                        Duplicar
                      </button>
                    )}
                    {onArchive && playbook.status !== 'archived' && (
                      <button
                        onClick={() => { onArchive(playbook); setShowMenu(false) }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Archive size={14} />
                        Archivar
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => { onDelete(playbook); setShowMenu(false) }}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        Eliminar
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {playbook.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{playbook.description}</p>
        )}

        {/* Quick info badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Blocks info */}
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs">
            <Sparkles size={12} />
            {promptBlocks} pasos IA
          </span>

          {reviewBlocks > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs">
              <Target size={12} />
              {reviewBlocks} revisión
            </span>
          )}

          {/* Context tiers used */}
          {usedTiers.size > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs">
              <Layers size={12} />
              Usa Tier {Array.from(usedTiers).sort().join(', ')}
            </span>
          )}

          {/* Required AI Providers */}
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
            allProvidersReady
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}>
            {allProvidersReady ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            {Array.from(requiredProviders).map(p => AI_PROVIDERS[p]?.name || p).join(', ')}
          </span>

          {/* Required Documents */}
          {hasContextReqs && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs">
              <FileText size={12} />
              {contextReqs.totalRequired} docs
            </span>
          )}
        </div>

        {/* Tags */}
        {playbook.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {playbook.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
              >
                <Tag size={10} />
                {tag}
              </span>
            ))}
            {playbook.tags.length > 3 && (
              <span className="text-xs text-gray-400">+{playbook.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Expandable details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            {/* Flow visualization */}
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Flujo de ejecución:</p>
              <div className="flex flex-wrap items-center gap-1 text-xs">
                {blocks.map((block, i) => (
                  <div key={block.id} className="flex items-center gap-1">
                    <span className={`px-2 py-1 rounded ${
                      block.type === 'prompt' ? 'bg-indigo-100 text-indigo-700' :
                      block.type === 'human_review' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {block.name}
                    </span>
                    {i < blocks.length - 1 && (
                      <span className="text-gray-300">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Context requirements */}
            {(usedTiers.size > 0 || contextReqs.docTypes.length > 0) && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Contexto requerido:</p>
                <div className="space-y-2">
                  {/* Tiers */}
                  {usedTiers.size > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Array.from(usedTiers).sort().map((tier) => {
                        const tierConfig = TIER_CONFIG[tier as 1 | 2 | 3]
                        return (
                          <div key={tier} className={`px-2 py-1 rounded text-xs ${tierConfig.bgClass} ${tierConfig.textClass}`}>
                            Tier {tier}: {tierConfig.name}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {/* Document types */}
                  {contextReqs.docTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {contextReqs.docTypes.map((docType) => {
                        const docConfig = DOCUMENT_TYPES.find(d => d.value === docType)
                        return (
                          <span key={docType} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                            <FileText size={10} />
                            {docConfig?.label || docType}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Input fields preview */}
            {config.input_schema && Object.keys(config.input_schema).length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Campos a completar:</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(config.input_schema).map(([key, field]) => (
                    <span key={key} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                      {field.label || key}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? 'Menos' : 'Más info'}
            </button>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar size={12} />
              {new Date(playbook.updated_at).toLocaleDateString()}
            </span>
          </div>

          {onRun && isRunnable && (
            <button
              onClick={() => onRun(playbook)}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all flex items-center gap-2 shadow-sm"
            >
              <Play size={14} />
              Ejecutar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
