'use client'

/**
 * ProfileDiscoveryModal Component
 *
 * Modal that shows the progress and results of auto-discovery.
 * Displays found profiles with confidence badges and allows editing.
 * Uses synchronous API - waits for results directly.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Loader2,
  Check,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  RefreshCw,
  Save,
  Globe,
  Search,
  Sparkles,
} from 'lucide-react'
import type { Platform, DiscoveredProfile, ConfidenceLevel, DiscoveryResults } from '@/lib/discovery/types'

// ============================================
// TYPES
// ============================================

interface ProfileDiscoveryModalProps {
  projectId: string
  campaignId: string
  competitorName: string
  websiteUrl: string
  onClose: () => void
  onSave: (profiles: Record<Platform, DiscoveredProfile>) => void
}

// Platform display info
const PLATFORM_INFO: Record<Platform, { name: string; icon: string; color: string }> = {
  instagram: { name: 'Instagram', icon: '📸', color: 'text-pink-600 bg-pink-50' },
  facebook: { name: 'Facebook', icon: '📘', color: 'text-blue-600 bg-blue-50' },
  linkedin: { name: 'LinkedIn', icon: '💼', color: 'text-blue-700 bg-blue-50' },
  youtube: { name: 'YouTube', icon: '🎬', color: 'text-red-600 bg-red-50' },
  tiktok: { name: 'TikTok', icon: '🎵', color: 'text-gray-800 bg-gray-100' },
  twitter: { name: 'Twitter/X', icon: '🐦', color: 'text-sky-500 bg-sky-50' },
  trustpilot: { name: 'Trustpilot', icon: '⭐', color: 'text-green-600 bg-green-50' },
  g2: { name: 'G2', icon: '🏆', color: 'text-orange-600 bg-orange-50' },
  capterra: { name: 'Capterra', icon: '📊', color: 'text-teal-600 bg-teal-50' },
  playstore: { name: 'Google Play', icon: '▶️', color: 'text-green-500 bg-green-50' },
  appstore: { name: 'App Store', icon: '🍎', color: 'text-blue-500 bg-blue-50' },
}

// Confidence badge styles
const CONFIDENCE_STYLES: Record<ConfidenceLevel, { label: string; icon: React.ReactNode; className: string }> = {
  verified: {
    label: 'Verificado',
    icon: <Check size={14} />,
    className: 'text-green-700 bg-green-100 border-green-200',
  },
  likely: {
    label: 'Probable',
    icon: <Sparkles size={14} />,
    className: 'text-blue-700 bg-blue-100 border-blue-200',
  },
  uncertain: {
    label: 'Incierto',
    icon: <HelpCircle size={14} />,
    className: 'text-amber-700 bg-amber-100 border-amber-200',
  },
  not_found: {
    label: 'No encontrado',
    icon: <AlertTriangle size={14} />,
    className: 'text-gray-500 bg-gray-100 border-gray-200',
  },
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ProfileDiscoveryModal({
  projectId,
  campaignId,
  competitorName,
  websiteUrl,
  onClose,
  onSave,
}: ProfileDiscoveryModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isCompleted, setIsCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<Platform | null>(null)
  const [editedProfiles, setEditedProfiles] = useState<Record<Platform, DiscoveredProfile>>({} as Record<Platform, DiscoveredProfile>)
  const [isSaving, setIsSaving] = useState(false)

  // Run discovery (synchronous - waits for results)
  const runDiscovery = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setIsCompleted(false)

    try {
      const response = await fetch('/api/discovery/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitor_name: competitorName,
          website_url: websiteUrl,
          project_id: projectId,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error HTTP ${response.status}`)
      }

      // API now returns results directly
      if (data.status === 'completed' && data.results?.profiles) {
        setEditedProfiles(data.results.profiles)
        setIsCompleted(true)
      } else {
        throw new Error('No se recibieron resultados')
      }
    } catch (err) {
      console.error('Error in discovery:', err)
      setError(err instanceof Error ? err.message : 'Error en la búsqueda')
    } finally {
      setIsLoading(false)
    }
  }, [competitorName, websiteUrl, projectId])

  // Auto-start discovery on mount
  useEffect(() => {
    runDiscovery()
  }, [runDiscovery])

  // Handle URL edit
  const handleUrlEdit = (platform: Platform, url: string) => {
    setEditedProfiles((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        url: url || null,
        confidence: url ? 'likely' : 'not_found',
      },
    }))
  }

  // Handle save
  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Update campaign with discovered profiles
      const customVariables: Record<string, string> = {}

      for (const [platform, profile] of Object.entries(editedProfiles)) {
        if (profile.url) {
          const platformKey = platform as Platform
          const inputKey = getInputKey(platformKey)
          if (inputKey) {
            customVariables[inputKey] = profile.handle || profile.url
          }
        }
      }

      // Call API to update campaign
      const response = await fetch(`/api/campaign/${campaignId}/update-variables`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_variables: {
            ...customVariables,
            discovery_completed: 'true',
            discovery_date: new Date().toISOString(),
          },
        }),
      })

      if (!response.ok) {
        console.warn('Could not update campaign variables:', response.status)
      }

      onSave(editedProfiles)
    } catch (err) {
      console.error('Error saving profiles:', err)
      onSave(editedProfiles)
    } finally {
      setIsSaving(false)
    }
  }

  // Get input key for platform
  const getInputKey = (platform: Platform): string | null => {
    const mapping: Record<Platform, string> = {
      instagram: 'instagram_username',
      facebook: 'facebook_url',
      linkedin: 'linkedin_url',
      youtube: 'youtube_url',
      tiktok: 'tiktok_username',
      twitter: 'twitter_username',
      trustpilot: 'trustpilot_url',
      g2: 'g2_url',
      capterra: 'capterra_url',
      playstore: 'play_store_app_id',
      appstore: 'app_store_app_id',
    }
    return mapping[platform] || null
  }

  // Calculate stats
  const getStats = () => {
    if (!editedProfiles || Object.keys(editedProfiles).length === 0) {
      return { found: 0, verified: 0, total: 0 }
    }

    let found = 0
    let verified = 0
    const total = Object.keys(editedProfiles).length

    for (const profile of Object.values(editedProfiles)) {
      if (profile.url) {
        found++
        if (profile.confidence === 'verified') verified++
      }
    }

    return { found, verified, total }
  }

  const stats = getStats()

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Search className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Descubriendo perfiles</h2>
              <p className="text-sm text-gray-500">{competitorName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Loading state */}
          {isLoading && (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  <span className="text-sm text-gray-600">Buscando perfiles de redes sociales...</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-indigo-600 h-2 rounded-full animate-pulse w-1/3" />
                </div>
              </div>
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-3 rounded-xl border border-gray-100 bg-gray-50 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-200" />
                      <div className="flex-1">
                        <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
                        <div className="h-3 w-48 bg-gray-200 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Error */}
          {error && !isLoading && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={runDiscovery}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium inline-flex items-center gap-1"
                >
                  <RefreshCw size={14} />
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* Results */}
          {isCompleted && Object.keys(editedProfiles).length > 0 && (
            <>
              {/* Stats */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
                <div className="text-center px-4">
                  <div className="text-2xl font-bold text-indigo-600">{stats.found}</div>
                  <div className="text-xs text-gray-500">Encontrados</div>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="text-center px-4">
                  <div className="text-2xl font-bold text-green-600">{stats.verified}</div>
                  <div className="text-xs text-gray-500">Verificados</div>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="text-center px-4">
                  <div className="text-2xl font-bold text-gray-400">{stats.total - stats.found}</div>
                  <div className="text-xs text-gray-500">No encontrados</div>
                </div>
              </div>

              {/* Profile list */}
              <div className="space-y-2">
                {(Object.entries(editedProfiles) as [Platform, DiscoveredProfile][])
                  .sort((a, b) => {
                    if (a[1].url && !b[1].url) return -1
                    if (!a[1].url && b[1].url) return 1
                    const confOrder = { verified: 0, likely: 1, uncertain: 2, not_found: 3 }
                    return confOrder[a[1].confidence] - confOrder[b[1].confidence]
                  })
                  .map(([platform, profile]) => {
                    const platformInfo = PLATFORM_INFO[platform]
                    if (!platformInfo) return null
                    const confidenceStyle = CONFIDENCE_STYLES[profile.confidence]
                    const isEditing = editingProfile === platform

                    return (
                      <div
                        key={platform}
                        className={`p-3 rounded-xl border transition-colors ${
                          profile.url
                            ? 'bg-white border-gray-200'
                            : 'bg-gray-50 border-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${platformInfo.color}`}>
                            {platformInfo.icon}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{platformInfo.name}</span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${confidenceStyle.className}`}>
                                {confidenceStyle.icon}
                                {confidenceStyle.label}
                              </span>
                            </div>

                            {isEditing ? (
                              <input
                                type="text"
                                value={profile.url || ''}
                                onChange={(e) => handleUrlEdit(platform, e.target.value)}
                                onBlur={() => setEditingProfile(null)}
                                onKeyDown={(e) => e.key === 'Enter' && setEditingProfile(null)}
                                placeholder="Ingresa la URL..."
                                className="mt-1 w-full text-sm px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900"
                                autoFocus
                              />
                            ) : (
                              <button
                                onClick={() => setEditingProfile(platform)}
                                className="mt-0.5 text-sm text-gray-500 hover:text-indigo-600 truncate max-w-full text-left"
                              >
                                {profile.url || 'Click para agregar URL...'}
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {profile.url && (
                              <a
                                href={profile.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              >
                                <ExternalLink size={16} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Globe size={16} />
            <span className="truncate max-w-xs">{websiteUrl}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isCompleted ? 'Cancelar' : 'Cerrar'}
            </button>

            {isCompleted && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar y continuar
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
