'use client'

/**
 * ScraperRow Component
 *
 * Single row showing a scraper with:
 * - Checkbox for selection
 * - Scraper name and icon
 * - Input field (editable)
 * - Status indicator
 * - Action buttons
 */

import { useState, useEffect } from 'react'
import {
  Play,
  Loader2,
  CheckCircle,
  Circle,
  XCircle,
  AlertCircle,
  Eye,
  RotateCcw,
  Globe,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Music2,
  Search,
  Star,
  Sparkles,
  MessageSquare,
  Newspaper,
} from 'lucide-react'
import type { DocumentRequirement } from '@/lib/playbooks/competitor-analysis/types'
import { SCRAPER_INPUT_MAPPINGS } from '@/lib/playbooks/competitor-analysis/constants'

// ============================================
// TYPES
// ============================================

interface ScraperRowProps {
  scraper: DocumentRequirement
  isCompleted: boolean
  isSelected: boolean
  isRunning: boolean
  inputValue: string
  onToggleSelect: () => void
  onInputChange: (value: string) => void
  onRun: () => void
  projectId: string
  campaignId: string
  competitorName: string
}

// Icon mapping for scraper types
const SCRAPER_ICONS: Record<string, React.ReactNode> = {
  'deep-research': <Sparkles size={16} className="text-purple-500" />,
  'web-scraping': <Globe size={16} className="text-blue-500" />,
  'seo-serp': <Search size={16} className="text-green-500" />,
  'news-corpus': <Newspaper size={16} className="text-orange-500" />,
  'ig-posts': <Instagram size={16} className="text-pink-500" />,
  'ig-comments': <Instagram size={16} className="text-pink-500" />,
  'fb-posts': <Facebook size={16} className="text-blue-600" />,
  'fb-comments': <Facebook size={16} className="text-blue-600" />,
  'li-posts': <Linkedin size={16} className="text-blue-700" />,
  'li-insights': <Linkedin size={16} className="text-blue-700" />,
  'li-comments': <Linkedin size={16} className="text-blue-700" />,
  'yt-videos': <Youtube size={16} className="text-red-500" />,
  'yt-comments': <Youtube size={16} className="text-red-500" />,
  'tiktok-posts': <Music2 size={16} className="text-gray-800" />,
  'tiktok-comments': <Music2 size={16} className="text-gray-800" />,
  'trustpilot-reviews': <Star size={16} className="text-green-600" />,
  'g2-reviews': <Star size={16} className="text-orange-600" />,
  'capterra-reviews': <Star size={16} className="text-blue-500" />,
  'play-store-reviews': <Star size={16} className="text-green-500" />,
  'app-store-reviews': <Star size={16} className="text-gray-500" />,
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ScraperRow({
  scraper,
  isCompleted,
  isSelected,
  isRunning,
  inputValue,
  onToggleSelect,
  onInputChange,
  onRun,
  projectId,
  campaignId,
  competitorName,
}: ScraperRowProps) {
  const [localValue, setLocalValue] = useState(inputValue)
  const [isEditing, setIsEditing] = useState(false)

  // Sync localValue with inputValue when it changes externally
  useEffect(() => {
    setLocalValue(inputValue)
  }, [inputValue])

  const mapping = SCRAPER_INPUT_MAPPINGS[scraper.id]
  const icon = SCRAPER_ICONS[scraper.id] || <Circle size={16} className="text-gray-400" />

  const handleBlur = () => {
    setIsEditing(false)
    if (localValue !== inputValue) {
      onInputChange(localValue)
    }
  }

  const hasInput = !!localValue.trim()
  const canRun = hasInput && !isCompleted && !isRunning

  return (
    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${isCompleted ? 'bg-green-50/50' : ''}`}>
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        disabled={isCompleted || isRunning}
        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
      />

      {/* Status icon */}
      <div className="flex-shrink-0">
        {isRunning ? (
          <Loader2 size={18} className="text-indigo-500 animate-spin" />
        ) : isCompleted ? (
          <CheckCircle size={18} className="text-green-500" />
        ) : hasInput ? (
          <Circle size={18} className="text-gray-300" />
        ) : (
          <AlertCircle size={18} className="text-yellow-500" />
        )}
      </div>

      {/* Scraper info */}
      <div className="flex items-center gap-2 min-w-[180px]">
        {icon}
        <span className={`text-sm font-medium ${isCompleted ? 'text-green-700' : 'text-gray-700'}`}>
          {scraper.name}
        </span>
      </div>

      {/* Input field */}
      <div className="flex-1 min-w-0">
        {mapping ? (
          <input
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onFocus={() => setIsEditing(true)}
            onBlur={handleBlur}
            placeholder={mapping.placeholder}
            disabled={isCompleted || isRunning}
            className={`w-full px-3 py-1.5 text-sm border rounded-lg transition-colors
              ${isCompleted
                ? 'bg-green-50 border-green-200 text-green-700'
                : isEditing
                  ? 'border-indigo-300 ring-2 ring-indigo-100'
                  : hasInput
                    ? 'border-gray-200 bg-white'
                    : 'border-yellow-200 bg-yellow-50'
              }
              disabled:opacity-60 disabled:cursor-not-allowed
            `}
          />
        ) : (
          <span className="text-sm text-gray-400 italic">Sin configuración</span>
        )}
      </div>

      {/* Status text */}
      <div className="flex-shrink-0 min-w-[100px] text-right">
        {isRunning ? (
          <span className="text-xs text-indigo-600 font-medium">Ejecutando...</span>
        ) : isCompleted ? (
          <span className="text-xs text-green-600 font-medium">Completado</span>
        ) : !hasInput ? (
          <span className="text-xs text-yellow-600 font-medium">Sin input</span>
        ) : (
          <span className="text-xs text-gray-500">Pendiente</span>
        )}
      </div>

      {/* Action button */}
      <div className="flex-shrink-0">
        {isCompleted ? (
          <button
            onClick={() => {
              // TODO: View document
            }}
            className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
            title="Ver documento"
          >
            <Eye size={16} />
          </button>
        ) : isRunning ? (
          <button
            disabled
            className="p-1.5 text-gray-300 cursor-not-allowed"
          >
            <Loader2 size={16} className="animate-spin" />
          </button>
        ) : (
          <button
            onClick={onRun}
            disabled={!canRun}
            className={`p-1.5 rounded-lg transition-colors ${
              canRun
                ? 'text-indigo-600 hover:bg-indigo-100'
                : 'text-gray-300 cursor-not-allowed'
            }`}
            title={canRun ? 'Ejecutar scraper' : 'Configura el input primero'}
          >
            <Play size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
