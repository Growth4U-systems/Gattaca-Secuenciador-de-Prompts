'use client'

import { useState } from 'react'
import { X, Building2, Globe, Briefcase, FileText, Loader2 } from 'lucide-react'
import { createClient } from '@/hooks/useClients'
import type { ClientInsert } from '@/types/v2.types'

interface CreateClientModalProps {
  agencyId: string
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

const INDUSTRIES = [
  'Tecnología',
  'E-commerce',
  'Fintech',
  'Salud',
  'Educación',
  'Retail',
  'Servicios profesionales',
  'Manufactura',
  'Medios y entretenimiento',
  'Inmobiliario',
  'Turismo',
  'Otro',
]

export default function CreateClientModal({
  agencyId,
  isOpen,
  onClose,
  onCreated,
}: CreateClientModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [industry, setIndustry] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('El nombre es requerido')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const clientData: ClientInsert = {
        agency_id: agencyId,
        name: name.trim(),
        description: description.trim() || null,
        industry: industry || null,
        website_url: websiteUrl.trim() || null,
        status: 'active',
        competitors: [],
        social_channels: {},
        settings: {},
      }

      await createClient(clientData)
      onCreated()
      handleClose()
    } catch (err) {
      console.error('Error creating client:', err)
      setError(err instanceof Error ? err.message : 'Error al crear cliente')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setIndustry('')
    setWebsiteUrl('')
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Nuevo Cliente</h2>
              <p className="text-sm text-gray-500">Agrega un cliente a tu agencia</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nombre del cliente *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Acme Corp"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              autoFocus
            />
          </div>

          {/* Industry */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Briefcase className="inline w-4 h-4 mr-1" />
              Industria
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="">Seleccionar industria...</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Globe className="inline w-4 h-4 mr-1" />
              Sitio web
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://ejemplo.com"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <FileText className="inline w-4 h-4 mr-1" />
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descripción del cliente..."
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Cliente'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
