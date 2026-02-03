'use client'

import { useState } from 'react'
import {
  Play,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  FileText,
  MoreVertical,
  Building2,
  Globe,
  Trash2,
  Edit2,
  Eye,
  Sparkles,
} from 'lucide-react'

interface CampaignCardProps {
  campaign: {
    id: string
    ecp_name: string
    status: string
    current_step_id: string | null
    step_outputs: Record<string, any>
    created_at: string
    started_at: string | null
    completed_at: string | null
    custom_variables?: Record<string, string>
  }
  totalSteps: number
  onSelect: (campaignId: string) => void
  onRun?: (campaignId: string) => void
  onDelete?: (campaignId: string) => void
  onEdit?: (campaignId: string) => void
  isRunning?: boolean
  compact?: boolean
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    label: 'Pendiente',
  },
  running: {
    icon: Sparkles,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'En progreso',
  },
  completed: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Completado',
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Error',
  },
}

export default function CampaignCard({
  campaign,
  totalSteps,
  onSelect,
  onRun,
  onDelete,
  onEdit,
  isRunning = false,
  compact = false,
}: CampaignCardProps) {
  const [showMenu, setShowMenu] = useState(false)

  // Calculate progress
  const completedSteps = campaign.step_outputs
    ? Object.keys(campaign.step_outputs).length
    : 0
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  // Get status config
  const statusKey = (campaign.status as keyof typeof STATUS_CONFIG) || 'pending'
  const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending
  const StatusIcon = statusConfig.icon

  // Get country/industry from variables
  const country = campaign.custom_variables?.country || campaign.custom_variables?.pais || ''
  const industry = campaign.custom_variables?.industry || campaign.custom_variables?.industria || ''

  if (compact) {
    return (
      <div
        onClick={() => onSelect(campaign.id)}
        className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
      >
        {/* Status indicator */}
        <div className={`p-1.5 rounded-lg ${statusConfig.bgColor}`}>
          <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
        </div>

        {/* Name and progress */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{campaign.ecp_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">
              {completedSteps}/{totalSteps}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow group">
      {/* Progress bar at top */}
      <div className="h-1.5 bg-gray-100">
        <div
          className={`h-full transition-all duration-500 ${
            progress === 100
              ? 'bg-gradient-to-r from-green-400 to-green-500'
              : progress > 0
                ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                : 'bg-gray-200'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card content */}
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${statusConfig.bgColor}`}>
              <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 line-clamp-1">
                {campaign.ecp_name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
                <span className="text-xs text-gray-400">
                  {completedSteps}/{totalSteps} pasos
                </span>
              </div>
            </div>
          </div>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreVertical size={18} />
            </button>
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-8 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect(campaign.id)
                      setShowMenu(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Eye size={14} />
                    Ver detalles
                  </button>
                  {onEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(campaign.id)
                        setShowMenu(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Edit2 size={14} />
                      Editar
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(campaign.id)
                        setShowMenu(false)
                      }}
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

        {/* Metadata row */}
        {(country || industry) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {country && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-lg">
                <Globe size={12} />
                <span>{country}</span>
              </div>
            )}
            {industry && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-lg">
                <Building2 size={12} />
                <span className="truncate max-w-32">{industry}</span>
              </div>
            )}
          </div>
        )}

        {/* Documents count */}
        {campaign.step_outputs && Object.keys(campaign.step_outputs).length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
            <FileText size={12} />
            <span>{Object.keys(campaign.step_outputs).length} outputs generados</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelect(campaign.id)}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Ver detalles
          </button>
          {onRun && campaign.status !== 'completed' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRun(campaign.id)
              }}
              disabled={isRunning}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isRunning
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Play size={14} />
              {isRunning ? 'Ejecutando...' : 'Ejecutar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
