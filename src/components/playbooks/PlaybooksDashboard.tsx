'use client'

import { useState } from 'react'
import { BookOpen, Play, Search, FileText, Target, TrendingUp, Sparkles, Users } from 'lucide-react'

interface PlaybooksDashboardProps {
  agencyId: string
  clientId: string
  projectId?: string
  onNavigateToContextLake?: () => void
}

const PLAYBOOK_TEMPLATES = [
  {
    id: 'ecp',
    name: 'ECP Generator',
    description: 'Genera Email Copy de alta conversion basado en el framework ECP',
    icon: FileText,
    color: 'blue',
    status: 'available',
  },
  {
    id: 'competitor_analysis',
    name: 'Analisis de Competencia',
    description: 'Analiza competidores y extrae insights estrategicos',
    icon: Target,
    color: 'purple',
    status: 'available',
  },
  {
    id: 'niche_finder',
    name: 'Niche Finder',
    description: 'Descubre nichos de mercado con alta demanda y baja competencia',
    icon: TrendingUp,
    color: 'green',
    status: 'available',
  },
  {
    id: 'signal_based_outreach',
    name: 'Signal-Based Outreach',
    description: 'LinkedIn outreach usando señales de intencion + lead magnet',
    icon: Users,
    color: 'orange',
    status: 'available',
    badge: 'Beta',
  },
]

export default function PlaybooksDashboard({
  agencyId,
  clientId,
  projectId,
  onNavigateToContextLake,
}: PlaybooksDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredPlaybooks = PLAYBOOK_TEMPLATES.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Playbooks</h2>
          <p className="text-sm text-gray-500 mt-1">
            Procesos de IA predefinidos para generar contenido y analisis
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar playbooks..."
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
        />
      </div>

      {/* Context Lake Reminder */}
      {onNavigateToContextLake && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-amber-800">
              <strong>Tip:</strong> Los playbooks funcionan mejor cuando tienes documentos en tu Context Lake.
              Sube guias de marca, descripciones de producto o analisis previos para mejores resultados.
            </p>
            <button
              onClick={onNavigateToContextLake}
              className="mt-2 text-sm text-amber-700 font-medium hover:text-amber-800"
            >
              Ir al Context Lake →
            </button>
          </div>
        </div>
      )}

      {/* Playbook Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPlaybooks.map((playbook) => {
          const Icon = playbook.icon
          return (
            <div
              key={playbook.id}
              className="group p-5 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${
                  playbook.color === 'blue' ? 'bg-blue-100' :
                  playbook.color === 'purple' ? 'bg-purple-100' :
                  playbook.color === 'orange' ? 'bg-orange-100' :
                  'bg-green-100'
                }`}>
                  <Icon className={`w-5 h-5 ${
                    playbook.color === 'blue' ? 'text-blue-600' :
                    playbook.color === 'purple' ? 'text-purple-600' :
                    playbook.color === 'orange' ? 'text-orange-600' :
                    'text-green-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {playbook.name}
                    </h3>
                    {playbook.badge && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                        {playbook.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{playbook.description}</p>
                </div>
              </div>
              <button className="mt-4 w-full px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                <Play size={16} />
                Ejecutar
              </button>
            </div>
          )
        })}
      </div>

      {/* Empty State */}
      {filteredPlaybooks.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-medium text-gray-900">No se encontraron playbooks</h3>
          <p className="text-sm text-gray-500 mt-1">
            Intenta con otros terminos de busqueda
          </p>
        </div>
      )}
    </div>
  )
}
