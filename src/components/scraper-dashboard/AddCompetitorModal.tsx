'use client'

/**
 * AddCompetitorModal Component
 *
 * Modal to add a new competitor with name and website.
 * Creates a campaign and optionally triggers auto-discovery of social profiles.
 */

import { useState } from 'react'
import {
  X,
  Plus,
  Loader2,
  Globe,
  Building2,
  Search,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { useToast } from '@/components/ui'
import ProfileDiscoveryModal from './ProfileDiscoveryModal'
import type { Platform, DiscoveredProfile } from '@/lib/discovery/types'

// ============================================
// TYPES
// ============================================

interface AddCompetitorModalProps {
  projectId: string
  onClose: () => void
  onAdded: (name: string, website: string) => void
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AddCompetitorModal({
  projectId,
  onClose,
  onAdded,
}: AddCompetitorModalProps) {
  const toast = useToast()

  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [discoverSocials, setDiscoverSocials] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Discovery state
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false)
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null)
  const [formattedWebsiteUrl, setFormattedWebsiteUrl] = useState('')

  // Validate URL - only allow http/https protocols
  const isValidUrl = (url: string): boolean => {
    if (!url || !url.trim()) return false
    try {
      const normalized = url.startsWith('http') ? url : `https://${url}`
      const parsed = new URL(normalized)
      // Only allow http/https protocols to prevent javascript: or data: URLs
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.hostname
    } catch {
      return false
    }
  }

  // Format URL
  const formatUrl = (url: string): string => {
    if (!url) return ''
    if (!url.startsWith('http')) {
      return `https://${url}`
    }
    return url
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('El nombre del competidor es requerido')
      return
    }

    if (!website.trim()) {
      setError('El sitio web es requerido')
      return
    }

    if (!isValidUrl(website)) {
      setError('La URL del sitio web no es válida')
      return
    }

    setIsSubmitting(true)

    try {
      const formattedWebsite = formatUrl(website)

      // Create campaign with competitor info
      const response = await fetch('/api/campaign/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          ecp_name: name.trim(),
          playbook_type: 'competitor_analysis',
          custom_variables: {
            competitor_name: name.trim(),
            competitor_website: formattedWebsite,
          },
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        let errorMsg = `Error HTTP ${response.status}`
        try {
          const errorData = JSON.parse(text)
          errorMsg = errorData.error || errorMsg
        } catch {
          // Use default error message
        }
        throw new Error(errorMsg)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al crear el competidor')
      }

      // If discover socials is enabled, show discovery modal
      if (discoverSocials && data.campaign?.id) {
        setCreatedCampaignId(data.campaign.id)
        setFormattedWebsiteUrl(formattedWebsite)
        setShowDiscoveryModal(true)
      } else {
        // No discovery, just close and notify
        onAdded(name.trim(), formattedWebsite)
      }
    } catch (err) {
      console.error('Error adding competitor:', err)
      setError(err instanceof Error ? err.message : 'Error de red')
      setIsSubmitting(false)
    }
  }

  // Handle discovery complete
  const handleDiscoverySave = (profiles: Record<Platform, DiscoveredProfile>) => {
    const foundCount = Object.values(profiles).filter(p => p.url).length
    toast.success(
      'Perfiles descubiertos',
      `Se encontraron ${foundCount} perfiles de redes sociales.`
    )
    setShowDiscoveryModal(false)
    onAdded(name.trim(), formattedWebsiteUrl)
  }

  // Handle discovery close without save
  const handleDiscoveryClose = () => {
    setShowDiscoveryModal(false)
    // Still notify that competitor was added (campaign was already created)
    onAdded(name.trim(), formattedWebsiteUrl)
  }

  // Show discovery modal if active
  if (showDiscoveryModal && createdCampaignId) {
    return (
      <ProfileDiscoveryModal
        projectId={projectId}
        campaignId={createdCampaignId}
        competitorName={name.trim()}
        websiteUrl={formattedWebsiteUrl}
        onClose={handleDiscoveryClose}
        onSave={handleDiscoverySave}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Agregar Competidor</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Name field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nombre del competidor *
            </label>
            <div className="relative">
              <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Revolut"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 placeholder:text-gray-400"
                autoFocus
              />
            </div>
          </div>

          {/* Website field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Sitio web *
            </label>
            <div className="relative">
              <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Ej: revolut.com"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              URL principal del competidor
            </p>
          </div>

          {/* Discover socials option */}
          <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl">
            <input
              type="checkbox"
              id="discoverSocials"
              checked={discoverSocials}
              onChange={(e) => setDiscoverSocials(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="discoverSocials" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2 text-sm font-medium text-indigo-800">
                <Sparkles size={16} className="text-indigo-500" />
                Auto-descubrir perfiles
              </div>
              <p className="text-xs text-indigo-600 mt-1">
                Escanear el sitio web y buscar en Google para encontrar todos los perfiles de redes sociales automáticamente.
              </p>
            </label>
          </div>

          {/* Info */}
          <p className="text-xs text-gray-500">
            {discoverSocials
              ? 'Después de crear el competidor, se abrirá un modal para descubrir y verificar los perfiles de redes sociales.'
              : 'Los campos de redes sociales se configurarán manualmente después de agregar el competidor.'
            }
          </p>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || !website.trim()}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Agregando...
                </>
              ) : (
                <>
                  <Plus size={18} />
                  {discoverSocials ? 'Agregar y Descubrir' : 'Agregar'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
