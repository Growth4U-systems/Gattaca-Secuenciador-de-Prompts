'use client'

import { useState } from 'react'
import { Sparkles, Play, Clock, Target, Layers, CheckCircle, ArrowRight, Video, Search, Users } from 'lucide-react'
import { PLAYBOOK_TEMPLATES, PlaybookMetadata } from '@/data/example-playbooks'
import type { PlaybookConfig } from '@/types/v2.types'
import { TIER_CONFIG } from '@/types/v2.types'

interface PlaybookTemplatesProps {
  onUseTemplate: (template: {
    name: string
    description: string
    config: PlaybookConfig
    tags: readonly string[]
  }) => void
  compact?: boolean
}

const categoryIcons: Record<string, any> = {
  video: Video,
  strategy: Target,
  research: Search,
}

const categoryColors: Record<string, string> = {
  video: 'from-pink-500 to-rose-600',
  strategy: 'from-blue-500 to-indigo-600',
  research: 'from-emerald-500 to-teal-600',
}

export default function PlaybookTemplates({
  onUseTemplate,
  compact = false,
}: PlaybookTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const templates = Object.entries(PLAYBOOK_TEMPLATES)

  if (compact) {
    // Compact view for sidebar or inline usage
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-medium mb-3">TEMPLATES DISPONIBLES</p>
        {templates.map(([key, template]) => (
          <button
            key={key}
            onClick={() => onUseTemplate({
              name: template.name,
              description: template.description,
              config: template.config,
              tags: template.tags,
            })}
            className="w-full text-left p-3 bg-white border border-gray-100 rounded-lg hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="font-medium text-gray-900 text-sm">{template.name}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{template.description}</p>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl mb-4">
          <Sparkles className="w-8 h-8 text-indigo-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900">Templates listos para usar</h3>
        <p className="text-gray-600 mt-1 max-w-md mx-auto">
          Selecciona un template y empieza a generar contenido inmediatamente.
          Solo completa los campos requeridos y el playbook hará el resto.
        </p>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map(([key, template]) => {
          const metadata = template.metadata as PlaybookMetadata | undefined
          const Icon = categoryIcons[template.category] || Sparkles
          const gradientColor = categoryColors[template.category] || 'from-indigo-500 to-purple-600'
          const isSelected = selectedTemplate === key

          return (
            <div
              key={key}
              className={`relative bg-white rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${
                isSelected
                  ? 'border-indigo-500 shadow-lg shadow-indigo-100'
                  : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
              }`}
              onClick={() => setSelectedTemplate(isSelected ? null : key)}
            >
              {/* Gradient header */}
              <div className={`bg-gradient-to-r ${gradientColor} p-4`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 backdrop-blur rounded-lg">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{template.name}</h4>
                    <p className="text-white/80 text-xs">{template.category}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Metadata if available */}
                {metadata && (
                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    {/* Objective */}
                    <div className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Objetivo</p>
                        <p className="text-sm text-gray-900">{metadata.objective}</p>
                      </div>
                    </div>

                    {/* Time estimate */}
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-xs text-gray-600">
                        Tiempo estimado: <strong>{metadata.estimatedTime}</strong>
                      </span>
                    </div>

                    {/* Context requirements */}
                    {metadata.requiredContext.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Layers className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">Usa documentos de</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {metadata.requiredContext.map((req, i) => {
                              const tierConfig = TIER_CONFIG[req.tier]
                              return (
                                <span
                                  key={i}
                                  className={`px-2 py-0.5 rounded text-xs ${tierConfig.bgClass} ${tierConfig.textClass}`}
                                >
                                  Tier {req.tier}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Best for */}
                    {isSelected && metadata.bestFor.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">Ideal para:</p>
                        <ul className="space-y-1">
                          {metadata.bestFor.map((use, i) => (
                            <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                              <CheckCircle className="w-3 h-3 text-green-500" />
                              {use}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Use button */}
                {isSelected && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onUseTemplate({
                        name: template.name,
                        description: template.description,
                        config: template.config,
                        tags: template.tags,
                      })
                    }}
                    className={`w-full mt-4 py-2.5 bg-gradient-to-r ${gradientColor} text-white font-medium rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2`}
                  >
                    <Play size={16} />
                    Usar este template
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Info note */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
        <p className="text-sm text-blue-700">
          <strong>Tip:</strong> Los templates usan automáticamente los documentos de tu Context Lake.
          Asegúrate de tener subidos tu Brand DNA, ICP y otros documentos relevantes.
        </p>
      </div>
    </div>
  )
}
