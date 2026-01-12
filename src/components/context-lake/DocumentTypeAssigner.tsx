'use client'

import { useState } from 'react'
import { X, FileText, Crown, Target, Clock, Check, Loader2, Tag } from 'lucide-react'
import type { Document, DocumentTier } from '@/types/v2.types'
import { TIER_CONFIG, DOCUMENT_TYPES } from '@/types/v2.types'
import { updateDocument } from '@/hooks/useContextLake'

interface DocumentTypeAssignerProps {
  document: Document
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
}

export default function DocumentTypeAssigner({
  document,
  isOpen,
  onClose,
  onUpdated,
}: DocumentTypeAssignerProps) {
  const [selectedType, setSelectedType] = useState(document.document_type)
  const [selectedTier, setSelectedTier] = useState<DocumentTier>(document.tier)
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  const handleSave = async () => {
    if (selectedType === document.document_type && selectedTier === document.tier) {
      onClose()
      return
    }

    try {
      setSaving(true)
      await updateDocument(document.id, {
        document_type: selectedType,
        tier: selectedTier,
      })
      onUpdated()
      onClose()
    } catch (err) {
      console.error('Error updating document type:', err)
      alert('Error al actualizar el tipo de documento')
    } finally {
      setSaving(false)
    }
  }

  // Group document types by tier
  const docTypesByTier = {
    1: DOCUMENT_TYPES.filter(dt => dt.tier === 1),
    2: DOCUMENT_TYPES.filter(dt => dt.tier === 2),
    3: DOCUMENT_TYPES.filter(dt => dt.tier === 3),
  }

  const tierIcons = {
    1: Crown,
    2: Target,
    3: Clock,
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Tag className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-lg font-semibold text-white">Asignar Tipo de Documento</h2>
              <p className="text-indigo-200 text-sm truncate max-w-[300px]">{document.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Current document info */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">Documento actual:</p>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-600" />
              <span className="font-medium text-gray-900">{document.title}</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
              <span className={`px-2 py-0.5 rounded text-xs ${TIER_CONFIG[document.tier].badgeClass}`}>
                Tier {document.tier}
              </span>
              <span className="text-gray-400">·</span>
              <span>{DOCUMENT_TYPES.find(dt => dt.value === document.document_type)?.label || document.document_type}</span>
            </div>
          </div>

          {/* Tier Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Selecciona el Tier
            </label>
            <div className="grid grid-cols-3 gap-3">
              {([1, 2, 3] as DocumentTier[]).map((tier) => {
                const config = TIER_CONFIG[tier]
                const Icon = tierIcons[tier]
                const isSelected = selectedTier === tier

                return (
                  <button
                    key={tier}
                    onClick={() => {
                      setSelectedTier(tier)
                      // Reset doc type if current type doesn't match new tier
                      const currentTypeInfo = DOCUMENT_TYPES.find(dt => dt.value === selectedType)
                      if (currentTypeInfo && currentTypeInfo.tier !== tier) {
                        const firstTypeInTier = docTypesByTier[tier][0]
                        if (firstTypeInTier) {
                          setSelectedType(firstTypeInTier.value)
                        }
                      }
                    }}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? `${config.borderClass} ${config.bgClass}`
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${isSelected ? config.textClass : 'text-gray-400'}`} />
                      <span className={`font-medium text-sm ${isSelected ? config.textClass : 'text-gray-700'}`}>
                        Tier {tier}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{config.name}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Document Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tipo de Documento
            </label>
            <div className="space-y-2">
              {docTypesByTier[selectedTier].map((docType) => {
                const isSelected = selectedType === docType.value

                return (
                  <button
                    key={docType.value}
                    onClick={() => setSelectedType(docType.value)}
                    className={`w-full p-3 rounded-xl border-2 transition-all text-left flex items-start gap-3 ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                    }`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                    <div>
                      <p className={`font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                        {docType.label}
                      </p>
                      {docType.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{docType.description}</p>
                      )}
                    </div>
                  </button>
                )
              })}

              {/* Custom type option */}
              <button
                onClick={() => {
                  const customType = prompt('Ingresa el nombre del tipo de documento:')
                  if (customType && customType.trim()) {
                    setSelectedType(customType.trim().toLowerCase().replace(/\s+/g, '_'))
                  }
                }}
                className={`w-full p-3 rounded-xl border-2 border-dashed transition-all text-left flex items-start gap-3 ${
                  !DOCUMENT_TYPES.find(dt => dt.value === selectedType)
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  !DOCUMENT_TYPES.find(dt => dt.value === selectedType) ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                }`}>
                  {!DOCUMENT_TYPES.find(dt => dt.value === selectedType) && <Check size={12} className="text-white" />}
                </div>
                <div>
                  <p className={`font-medium ${
                    !DOCUMENT_TYPES.find(dt => dt.value === selectedType) ? 'text-indigo-900' : 'text-gray-700'
                  }`}>
                    {!DOCUMENT_TYPES.find(dt => dt.value === selectedType)
                      ? `Tipo personalizado: ${selectedType}`
                      : 'Otro tipo personalizado...'
                    }
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Define un tipo de documento personalizado</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {selectedType !== document.document_type || selectedTier !== document.tier ? (
              <span className="text-indigo-600">Cambios sin guardar</span>
            ) : (
              <span>Sin cambios</span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (selectedType === document.document_type && selectedTier === document.tier)}
              className="px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Guardar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
