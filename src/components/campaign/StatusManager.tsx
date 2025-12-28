'use client'

import { useState } from 'react'
import { X, Plus, Trash2, Edit2, Check, GripVertical, Clock, Play, Eye, CheckCircle, AlertCircle, Pause, Star, Settings } from 'lucide-react'
import { useToast } from '@/components/ui'

export interface CustomStatus {
  id: string
  name: string
  color: 'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'purple' | 'orange' | 'pink'
  icon: 'clock' | 'play' | 'eye' | 'check' | 'alert' | 'pause' | 'star'
  isDefault?: boolean
}

interface StatusManagerProps {
  statuses: CustomStatus[]
  onSave: (statuses: CustomStatus[]) => Promise<void>
  onClose: () => void
}

const COLOR_OPTIONS = [
  { value: 'gray', label: 'Gris', bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
  { value: 'blue', label: 'Azul', bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  { value: 'yellow', label: 'Amarillo', bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
  { value: 'green', label: 'Verde', bg: '#d1fae5', text: '#047857', border: '#6ee7b7' },
  { value: 'red', label: 'Rojo', bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  { value: 'purple', label: 'Morado', bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
  { value: 'orange', label: 'Naranja', bg: '#ffedd5', text: '#c2410c', border: '#fdba74' },
  { value: 'pink', label: 'Rosa', bg: '#fce7f3', text: '#be185d', border: '#f9a8d4' },
] as const

const ICON_OPTIONS = [
  { value: 'clock', label: 'Reloj', Icon: Clock },
  { value: 'play', label: 'Play', Icon: Play },
  { value: 'eye', label: 'Ojo', Icon: Eye },
  { value: 'check', label: 'Check', Icon: CheckCircle },
  { value: 'alert', label: 'Alerta', Icon: AlertCircle },
  { value: 'pause', label: 'Pausa', Icon: Pause },
  { value: 'star', label: 'Estrella', Icon: Star },
] as const

export function getStatusIcon(icon: string) {
  switch (icon) {
    case 'clock': return Clock
    case 'play': return Play
    case 'eye': return Eye
    case 'check': return CheckCircle
    case 'alert': return AlertCircle
    case 'pause': return Pause
    case 'star': return Star
    default: return Clock
  }
}

export function getStatusColors(color: string) {
  const colorConfig = COLOR_OPTIONS.find(c => c.value === color)
  return colorConfig || COLOR_OPTIONS[0]
}

export const DEFAULT_STATUSES: CustomStatus[] = [
  { id: 'draft', name: 'Borrador', color: 'gray', icon: 'clock', isDefault: true },
  { id: 'in_progress', name: 'En progreso', color: 'blue', icon: 'play' },
  { id: 'review', name: 'En revision', color: 'yellow', icon: 'eye' },
  { id: 'completed', name: 'Completado', color: 'green', icon: 'check' },
  { id: 'error', name: 'Error', color: 'red', icon: 'alert' },
]

export default function StatusManager({ statuses, onSave, onClose }: StatusManagerProps) {
  const toast = useToast()
  const [localStatuses, setLocalStatuses] = useState<CustomStatus[]>(statuses.length > 0 ? statuses : DEFAULT_STATUSES)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStatus, setNewStatus] = useState<Partial<CustomStatus>>({
    name: '',
    color: 'gray',
    icon: 'clock',
  })

  const handleAddStatus = () => {
    if (!newStatus.name?.trim()) {
      toast.error('Error', 'El nombre es requerido')
      return
    }

    const id = newStatus.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

    if (localStatuses.some(s => s.id === id)) {
      toast.error('Error', 'Ya existe un status con ese nombre')
      return
    }

    const status: CustomStatus = {
      id,
      name: newStatus.name.trim(),
      color: newStatus.color as CustomStatus['color'],
      icon: newStatus.icon as CustomStatus['icon'],
    }

    setLocalStatuses([...localStatuses, status])
    setNewStatus({ name: '', color: 'gray', icon: 'clock' })
    setShowAddForm(false)
  }

  const handleDeleteStatus = (id: string) => {
    const status = localStatuses.find(s => s.id === id)
    if (status?.isDefault) {
      toast.error('Error', 'No puedes eliminar el status por defecto')
      return
    }
    setLocalStatuses(localStatuses.filter(s => s.id !== id))
  }

  const handleEditStatus = (id: string, field: keyof CustomStatus, value: string) => {
    setLocalStatuses(localStatuses.map(s =>
      s.id === id ? { ...s, [field]: value } : s
    ))
  }

  const handleSetDefault = (id: string) => {
    setLocalStatuses(localStatuses.map(s => ({
      ...s,
      isDefault: s.id === id,
    })))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(localStatuses)
      toast.success('Guardado', 'Los status se han actualizado')
      onClose()
    } catch (error) {
      toast.error('Error', 'No se pudieron guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  const startEditing = (id: string, name: string) => {
    setEditingId(id)
    setEditingName(name)
  }

  const saveEditing = (id: string) => {
    if (editingName.trim()) {
      handleEditStatus(id, 'name', editingName.trim())
    }
    setEditingId(null)
    setEditingName('')
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Settings className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Gestionar Status</h2>
              <p className="text-sm text-gray-500">Crea y edita categorias de status</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Status List */}
        <div className="p-5 overflow-y-auto max-h-[calc(85vh-200px)]">
          <div className="space-y-3">
            {localStatuses.map((status) => {
              const colorConfig = getStatusColors(status.color)
              const IconComponent = getStatusIcon(status.icon)

              return (
                <div
                  key={status.id}
                  className="flex items-center gap-3 p-4 rounded-xl border-2 bg-white shadow-sm"
                  style={{ borderColor: colorConfig.border }}
                >
                  <GripVertical className="w-4 h-4 text-gray-400 cursor-grab flex-shrink-0" />

                  {/* Icon Preview */}
                  <div
                    className="p-2 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: colorConfig.bg }}
                  >
                    <IconComponent size={18} style={{ color: colorConfig.text }} />
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    {editingId === status.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-sm border-2 border-orange-400 rounded-lg focus:outline-none focus:border-orange-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditing(status.id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                        />
                        <button
                          onClick={() => saveEditing(status.id)}
                          className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: colorConfig.text }}
                        >
                          {status.name}
                        </span>
                        {status.isDefault && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                            Por defecto
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Icon Selector */}
                  <select
                    value={status.icon}
                    onChange={(e) => handleEditStatus(status.id, 'icon', e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {ICON_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  {/* Color Selector */}
                  <select
                    value={status.color}
                    onChange={(e) => handleEditStatus(status.id, 'color', e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {COLOR_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!status.isDefault && (
                      <button
                        onClick={() => handleSetDefault(status.id)}
                        className="p-2 hover:bg-yellow-100 rounded-lg text-gray-400 hover:text-yellow-600 transition-colors"
                        title="Establecer como por defecto"
                      >
                        <Star size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => startEditing(status.id, status.name)}
                      className="p-2 hover:bg-blue-100 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"
                      title="Editar nombre"
                    >
                      <Edit2 size={16} />
                    </button>
                    {!status.isDefault && (
                      <button
                        onClick={() => handleDeleteStatus(status.id)}
                        className="p-2 hover:bg-red-100 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add New Status Form */}
          {showAddForm ? (
            <div className="mt-4 p-4 border-2 border-dashed border-orange-300 rounded-xl bg-orange-50">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Nuevo status</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nombre del status"
                  value={newStatus.name || ''}
                  onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 bg-white"
                  autoFocus
                />
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                    <select
                      value={newStatus.color}
                      onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value as CustomStatus['color'] })}
                      className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 bg-white text-gray-700"
                    >
                      {COLOR_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Icono</label>
                    <select
                      value={newStatus.icon}
                      onChange={(e) => setNewStatus({ ...newStatus, icon: e.target.value as CustomStatus['icon'] })}
                      className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 bg-white text-gray-700"
                    >
                      {ICON_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleAddStatus}
                    className="flex-1 px-4 py-2.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    Agregar
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false)
                      setNewStatus({ name: '', color: 'gray', icon: 'clock' })
                    }}
                    className="px-4 py-2.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              <span className="text-sm font-medium">Agregar nuevo status</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar cambios'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
