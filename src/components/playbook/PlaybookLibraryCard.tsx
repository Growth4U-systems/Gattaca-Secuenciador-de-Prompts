'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Book,
  Pencil,
  Copy,
  RotateCcw,
  ChevronRight,
  Rocket,
  Check,
  Loader2,
} from 'lucide-react'

interface BasePlaybookTemplate {
  type: string
  name: string
  description: string
  isCustomized: boolean
}

interface ClientPlaybook {
  id: string
  client_id: string
  playbook_type: string
  name: string
  description: string | null
  config: any
  base_template_type: string
  is_enabled: boolean
}

interface PlaybookLibraryCardProps {
  /** For base templates */
  template?: BasePlaybookTemplate
  /** For custom playbooks */
  customPlaybook?: ClientPlaybook
  clientId: string
  onCustomize?: (playbookType: string) => void
  onResetToDefault?: (playbookId: string) => void
  isCustomizing?: boolean
  isResetting?: boolean
}

// Map playbook type to icon/emoji
function getPlaybookIcon(type: string): string {
  const icons: Record<string, string> = {
    niche_finder: '🔍',
    'niche-finder': '🔍',
    competitor_analysis: '📊',
    'competitor-analysis': '📊',
    ecp: '🎯',
    'signal-outreach': '📡',
    'seo-seed-keywords': '🔑',
    'linkedin-post-generator': '💼',
    'github-fork-to-crm': '🐙',
    'video-viral-ia': '🎬',
  }
  return icons[type] || '📖'
}

export default function PlaybookLibraryCard({
  template,
  customPlaybook,
  clientId,
  onCustomize,
  onResetToDefault,
  isCustomizing = false,
  isResetting = false,
}: PlaybookLibraryCardProps) {
  const isCustom = !!customPlaybook
  const playbookType = customPlaybook?.playbook_type || template?.type || ''
  const name = customPlaybook?.name || template?.name || playbookType
  const description = customPlaybook?.description || template?.description || ''
  const isCustomized = template?.isCustomized || false

  return (
    <div
      className={`bg-white rounded-xl border p-5 transition-all hover:shadow-md ${
        isCustom
          ? 'border-indigo-200 bg-gradient-to-br from-white to-indigo-50/30'
          : isCustomized
          ? 'border-green-200'
          : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl text-2xl">
            {getPlaybookIcon(playbookType)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900">{name}</h3>

              {/* Badges */}
              {isCustom && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                  <Pencil size={10} />
                  Personalizado
                </span>
              )}
              {!isCustom && isCustomized && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  <Check size={10} />
                  Tiene versión personalizada
                </span>
              )}
            </div>

            {description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{description}</p>
            )}

            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-gray-400">{playbookType}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {isCustom ? (
            <>
              {/* Edit custom playbook */}
              <Link
                href={`/clients/${clientId}/playbooks/${customPlaybook.id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Pencil size={16} />
                Editar
              </Link>

              {/* Reset to default */}
              {onResetToDefault && (
                <button
                  onClick={() => onResetToDefault(customPlaybook.id)}
                  disabled={isResetting}
                  className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  title="Restaurar a versión base"
                >
                  {isResetting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RotateCcw size={16} />
                  )}
                </button>
              )}
            </>
          ) : (
            <>
              {/* View documentation */}
              <Link
                href={`/playbooks/${playbookType}`}
                className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Book size={16} />
                Ver
              </Link>

              {/* Customize / Fork */}
              <button
                onClick={() => onCustomize?.(playbookType)}
                disabled={isCustomizing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isCustomizing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Copy size={16} />
                )}
                Personalizar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
