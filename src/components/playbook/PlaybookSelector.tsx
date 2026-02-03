'use client'

import { useState, useEffect } from 'react'
import { Check, Loader2, Sparkles, Pencil } from 'lucide-react'

interface Playbook {
  id: string
  name: string
  slug?: string
  description: string
  type?: string
  playbook_type: string
  isCustom?: boolean
}

interface PlaybookSelectorProps {
  value: string
  onChange: (value: string) => void
  clientId?: string
  disabled?: boolean
  showDescription?: boolean
}

// Icons for playbook types
const PLAYBOOK_ICONS: Record<string, string> = {
  niche_finder: '🔍',
  'niche-finder': '🔍',
  competitor_analysis: '📊',
  'competitor-analysis': '📊',
  ecp: '🎯',
  'ecp-positioning': '🎯',
  signal_based_outreach: '📡',
  'signal-outreach': '📡',
  'seo-seed-keywords': '🔑',
  'linkedin-post-generator': '💼',
  'github-fork-to-crm': '🐙',
  video_viral_ia: '🎬',
  'video-viral-ia': '🎬',
}

const getPlaybookIcon = (type: string): string => {
  return PLAYBOOK_ICONS[type] || PLAYBOOK_ICONS[type.replace('_', '-')] || PLAYBOOK_ICONS[type.replace('-', '_')] || '📖'
}

export default function PlaybookSelector({
  value,
  onChange,
  clientId,
  disabled = false,
  showDescription = false,
}: PlaybookSelectorProps) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [customPlaybooks, setCustomPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch base playbooks
  useEffect(() => {
    async function fetchPlaybooks() {
      try {
        const response = await fetch('/api/v2/playbooks')
        const result = await response.json()
        if (result.success) {
          setPlaybooks(result.playbooks || [])
        }
      } catch (err) {
        console.error('Error fetching playbooks:', err)
      }
    }
    fetchPlaybooks()
  }, [])

  // Fetch client custom playbooks if clientId provided
  useEffect(() => {
    async function fetchCustomPlaybooks() {
      if (!clientId) {
        setCustomPlaybooks([])
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/v2/clients/${clientId}/playbooks?include_base=false`)
        const data = await response.json()
        if (data.customPlaybooks) {
          // Map custom playbooks to our format
          setCustomPlaybooks(
            data.customPlaybooks.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description || '',
              playbook_type: p.playbook_type,
              isCustom: true,
            }))
          )
        }
      } catch (err) {
        console.error('Error fetching custom playbooks:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchCustomPlaybooks()
  }, [clientId])

  // Wait for both to load
  useEffect(() => {
    if (playbooks.length > 0 && !clientId) {
      setLoading(false)
    }
  }, [playbooks, clientId])

  // Combine all playbooks - custom first, then base
  const allPlaybooks = [...customPlaybooks, ...playbooks]

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-3">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Cargando playbooks...</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Horizontal scrollable playbook cards */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {/* "Sin playbook" option */}
        <button
          type="button"
          onClick={() => onChange('')}
          disabled={disabled}
          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
            value === ''
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className="text-lg">➕</span>
          <span className="text-sm font-medium whitespace-nowrap">Sin playbook</span>
          {value === '' && <Check size={16} className="text-blue-600" />}
        </button>

        {/* Custom playbooks first */}
        {customPlaybooks.length > 0 && (
          <>
            {customPlaybooks.map((playbook) => {
              const playbookType = playbook.playbook_type
              const isSelected = value === playbookType
              return (
                <button
                  key={playbook.id}
                  type="button"
                  onClick={() => onChange(playbookType)}
                  disabled={disabled}
                  className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-purple-200 bg-purple-50/50 text-gray-700 hover:border-purple-300 hover:bg-purple-50'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="text-lg">{getPlaybookIcon(playbookType)}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium whitespace-nowrap">{playbook.name}</span>
                    <Pencil size={12} className="text-purple-500" />
                  </div>
                  {isSelected && <Check size={16} className="text-indigo-600" />}
                </button>
              )
            })}
            {/* Divider */}
            <div className="flex-shrink-0 w-px bg-gray-200 mx-1" />
          </>
        )}

        {/* Base playbooks */}
        {playbooks.map((playbook) => {
          const playbookType = playbook.playbook_type || playbook.type || ''
          const isSelected = value === playbookType
          // Skip if there's a custom version of this playbook
          const hasCustomVersion = customPlaybooks.some(
            (cp) => cp.playbook_type === playbookType
          )
          if (hasCustomVersion) return null

          return (
            <button
              key={playbook.id}
              type="button"
              onClick={() => onChange(playbookType)}
              disabled={disabled}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="text-lg">{getPlaybookIcon(playbookType)}</span>
              <span className="text-sm font-medium whitespace-nowrap">{playbook.name}</span>
              {isSelected && <Check size={16} className="text-blue-600" />}
            </button>
          )
        })}
      </div>

      {/* Selected playbook description */}
      {showDescription && value && (
        <div className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          {allPlaybooks.find((p) => (p.playbook_type || p.type) === value)?.description || ''}
        </div>
      )}
    </div>
  )
}
