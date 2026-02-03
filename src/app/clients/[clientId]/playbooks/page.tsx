'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Book,
  ChevronLeft,
  Loader2,
  X,
  Plus,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import { useClient } from '@/hooks/useClients'
import { useClientPlaybooks } from '@/hooks/useClientPlaybooks'
import PlaybookLibraryCard from '@/components/playbook/PlaybookLibraryCard'
import { useToast } from '@/components/ui'

export default function ClientPlaybooksPage({
  params,
}: {
  params: { clientId: string }
}) {
  const router = useRouter()
  const toast = useToast()
  const { client, loading: clientLoading, error: clientError } = useClient(params.clientId)
  const {
    customPlaybooks,
    basePlaybooks,
    loading: playbooksLoading,
    error: playbooksError,
    forkFromTemplate,
    deletePlaybook,
    reload,
  } = useClientPlaybooks(params.clientId)

  const [customizingType, setCustomizingType] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newPlaybookName, setNewPlaybookName] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)

  const handleCustomize = (playbookType: string) => {
    // Find the base template to get its name as default
    const template = basePlaybooks.find(t => t.type === playbookType)
    setSelectedType(playbookType)
    setNewPlaybookName(template?.name || playbookType)
    setShowNameModal(true)
  }

  const handleConfirmCustomize = async () => {
    if (!selectedType || !newPlaybookName.trim()) return

    setCustomizingType(selectedType)
    setShowNameModal(false)

    try {
      const playbook = await forkFromTemplate(selectedType, newPlaybookName.trim())
      if (playbook) {
        toast.success('Playbook personalizado', `Se creó "${newPlaybookName}" para este cliente`)
        // Navigate to edit page
        router.push(`/clients/${params.clientId}/playbooks/${playbook.id}/edit`)
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'No se pudo crear el playbook personalizado')
    } finally {
      setCustomizingType(null)
      setSelectedType(null)
      setNewPlaybookName('')
    }
  }

  const handleResetToDefault = async (playbookId: string) => {
    if (!confirm('¿Eliminar esta versión personalizada y volver a usar el template base?')) {
      return
    }

    setResettingId(playbookId)
    try {
      await deletePlaybook(playbookId)
      toast.success('Restaurado', 'Se eliminó la versión personalizada')
    } catch (err: any) {
      toast.error('Error', err.message || 'No se pudo restaurar')
    } finally {
      setResettingId(null)
    }
  }

  const loading = clientLoading || playbooksLoading
  const error = clientError || playbooksError

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-gray-500">Cargando playbooks...</p>
        </div>
      </main>
    )
  }

  if (error || !client) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
            <X className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-900 mb-2">Error</h2>
            <p className="text-red-700 mb-6">{error || 'No se pudo cargar'}</p>
            <Link
              href={`/clients/${params.clientId}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <ChevronLeft size={18} />
              Volver
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/clients/${params.clientId}?tab=playbooks`}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 mb-4"
          >
            <ChevronLeft size={16} />
            Volver a {client.name}
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Biblioteca de Playbooks</h1>
              <p className="text-gray-500 mt-1">
                Personaliza los playbooks para {client.name}
              </p>
            </div>

            <Link
              href={`/projects/new?clientId=${params.clientId}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm font-medium"
            >
              <Sparkles size={18} />
              Nuevo Proyecto
            </Link>
          </div>
        </div>

        {/* Custom Playbooks Section */}
        {customPlaybooks.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Book size={20} className="text-indigo-600" />
              Playbooks Personalizados ({customPlaybooks.length})
            </h2>
            <div className="space-y-4">
              {customPlaybooks.map((playbook) => (
                <PlaybookLibraryCard
                  key={playbook.id}
                  customPlaybook={playbook}
                  clientId={params.clientId}
                  onResetToDefault={handleResetToDefault}
                  isResetting={resettingId === playbook.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Base Templates Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Book size={20} className="text-gray-400" />
            Templates Base ({basePlaybooks.length})
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Haz clic en "Personalizar" para crear una versión personalizada de cualquier playbook para este cliente.
          </p>

          {basePlaybooks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="font-medium text-gray-900 mb-2">No hay templates disponibles</h3>
              <p className="text-gray-500 text-sm">
                No se encontraron playbooks base configurados
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {basePlaybooks.map((template) => (
                <PlaybookLibraryCard
                  key={template.type}
                  template={template}
                  clientId={params.clientId}
                  onCustomize={handleCustomize}
                  isCustomizing={customizingType === template.type}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Name Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Nombre del Playbook Personalizado
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Este nombre ayudará a identificar tu versión personalizada del playbook.
            </p>
            <input
              type="text"
              value={newPlaybookName}
              onChange={(e) => setNewPlaybookName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCustomize()
                if (e.key === 'Escape') setShowNameModal(false)
              }}
              placeholder="Nombre del playbook..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNameModal(false)
                  setSelectedType(null)
                  setNewPlaybookName('')
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCustomize}
                disabled={!newPlaybookName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Crear Playbook
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
