'use client'

import Link from 'next/link'
import { Building2, Layers, FolderKanban, Calendar, Globe, ArrowRight, MoreVertical, Trash2, Settings } from 'lucide-react'
import type { Client } from '@/types/v2.types'

interface ClientCardProps {
  client: Client
  projectCount?: number
  documentCount?: number
  onDelete?: (client: Client) => void
  viewMode?: 'grid' | 'list'
}

export default function ClientCard({
  client,
  projectCount = 0,
  documentCount = 0,
  onDelete,
  viewMode = 'grid',
}: ClientCardProps) {
  const statusConfig = {
    active: { label: 'Activo', bgClass: 'bg-green-100', textClass: 'text-green-700' },
    paused: { label: 'Pausado', bgClass: 'bg-amber-100', textClass: 'text-amber-700' },
    archived: { label: 'Archivado', bgClass: 'bg-gray-100', textClass: 'text-gray-600' },
  }

  const status = statusConfig[client.status] || statusConfig.active

  if (viewMode === 'list') {
    return (
      <Link
        href={`/clients/${client.id}`}
        className="group flex items-center gap-6 p-5 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-300"
      >
        <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-100 rounded-xl group-hover:from-indigo-100 group-hover:to-purple-200 transition-colors">
          <Building2 className="w-6 h-6 text-indigo-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
              {client.name}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${status.bgClass} ${status.textClass}`}>
              {status.label}
            </span>
          </div>
          {client.description && (
            <p className="text-sm text-gray-500 mt-1 truncate">
              {client.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-1.5">
            <FolderKanban className="w-4 h-4" />
            <span>{projectCount} proyectos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4" />
            <span>{documentCount} docs</span>
          </div>
        </div>

        <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
      </Link>
    )
  }

  return (
    <div className="group relative">
      <Link
        href={`/clients/${client.id}`}
        className="block p-6 bg-white rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 transition-all duration-300"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-100 rounded-xl group-hover:from-indigo-100 group-hover:to-purple-200 transition-colors">
            <Building2 className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                {client.name}
              </h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${status.bgClass} ${status.textClass}`}>
                {status.label}
              </span>
            </div>
            {client.industry && (
              <p className="text-sm text-gray-500 mt-1">{client.industry}</p>
            )}
            {client.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {client.description}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <FolderKanban className="w-4 h-4" />
              <span>{projectCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>{documentCount}</span>
            </div>
            {client.website_url && (
              <div className="flex items-center gap-1.5">
                <Globe className="w-4 h-4" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Calendar size={12} />
            <span>
              {new Date(client.created_at).toLocaleDateString('es-ES', {
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </Link>

      {/* Actions */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete(client)
          }}
          className="absolute top-3 right-3 p-2 bg-white/80 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-gray-100"
          title="Eliminar cliente"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  )
}
