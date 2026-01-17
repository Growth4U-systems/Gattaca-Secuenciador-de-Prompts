'use client'

import { useState } from 'react'
import { Database, Upload, FileText, Sparkles, Filter } from 'lucide-react'

interface ContextLakeDashboardProps {
  clientId: string
  projectId?: string
  agencyId: string
}

const TIER_INFO = [
  {
    tier: 'T1',
    label: 'Core',
    description: 'Siempre incluido en cada prompt',
    color: 'indigo',
    examples: 'Guia de marca, tono de voz, buyer persona',
  },
  {
    tier: 'T2',
    label: 'Relevante',
    description: 'Incluido cuando es relevante al contexto',
    color: 'blue',
    examples: 'Analisis de competencia, investigacion de mercado',
  },
  {
    tier: 'T3',
    label: 'Archivo',
    description: 'Disponible para busqueda manual',
    color: 'gray',
    examples: 'Versiones anteriores, referencias historicas',
  },
]

export default function ContextLakeDashboard({
  clientId,
  projectId,
  agencyId,
}: ContextLakeDashboardProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Context Lake</h2>
          <p className="text-sm text-gray-500 mt-1">
            {projectId
              ? 'Documentos disponibles para este proyecto'
              : 'Documentos compartidos entre todos los proyectos del cliente'}
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Upload size={16} />
          Subir Documento
        </button>
      </div>

      {/* Tier Explanation */}
      <div className="grid gap-4 md:grid-cols-3">
        {TIER_INFO.map((info) => (
          <div
            key={info.tier}
            className={`p-4 rounded-xl border ${
              activeFilter === info.tier
                ? 'border-indigo-300 bg-indigo-50'
                : 'border-gray-100 bg-white'
            } cursor-pointer hover:border-indigo-200 transition-colors`}
            onClick={() =>
              setActiveFilter(activeFilter === info.tier ? null : info.tier)
            }
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${
                  info.color === 'indigo'
                    ? 'bg-indigo-100 text-indigo-700'
                    : info.color === 'blue'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {info.tier}
              </span>
              <span className="font-medium text-gray-900">{info.label}</span>
            </div>
            <p className="text-sm text-gray-600 mb-2">{info.description}</p>
            <p className="text-xs text-gray-400">Ej: {info.examples}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter size={16} />
          Filtrar por:
        </div>
        <div className="flex gap-2">
          {['manual', 'playbook', 'scraper'].map((source) => (
            <button
              key={source}
              className="px-3 py-1 text-sm rounded-full border border-gray-200 hover:border-gray-300 transition-colors"
            >
              {source === 'manual'
                ? 'Subidos'
                : source === 'playbook'
                ? 'De Playbooks'
                : 'De Scrapers'}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
        <Database className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          El Context Lake esta vacio
        </h3>
        <p className="text-gray-500 max-w-md mx-auto mb-6">
          Sube documentos para enriquecer el contexto de tus prompts. Los
          documentos T1 se incluiran automaticamente en cada ejecucion.
        </p>
        <div className="flex justify-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <Upload size={16} />
            Subir Documento
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Sparkles size={16} />
            Generar con IA
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> Los documentos del cliente estan disponibles para
              todos los proyectos. Sube guias de marca y buyer personas a nivel cliente
              para reutilizarlos en multiples campanas.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
