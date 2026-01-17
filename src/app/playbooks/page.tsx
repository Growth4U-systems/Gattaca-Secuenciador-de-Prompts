'use client'

import Link from 'next/link'
import { ArrowLeft, Clock, Users, ChevronRight, Zap } from 'lucide-react'
import { playbookMetadata, getPlaybookName } from '@/lib/playbook-metadata'

export default function PlaybooksLibraryPage() {
  const playbooks = Object.entries(playbookMetadata)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Inicio
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Librería de Playbooks
          </h1>
          <p className="text-lg text-gray-600">
            Explora nuestros playbooks de marketing y estrategia. Cada uno está
            diseñado para resolver un problema específico con IA.
          </p>
        </div>
      </div>

      {/* Playbooks Grid */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid gap-6">
          {playbooks.map(([slug, meta]) => (
            <Link
              key={slug}
              href={`/playbooks/${slug}`}
              className="bg-white rounded-xl border p-6 hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <span className="text-4xl">{meta.icon || '📋'}</span>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 mb-2">
                      {getPlaybookName(slug)}
                    </h2>
                    <p className="text-gray-600 mb-4">{meta.purpose}</p>

                    {/* Quick stats */}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {meta.duration && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{meta.duration}</span>
                        </div>
                      )}
                      {meta.targetAudience && (
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{meta.targetAudience}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>

              {/* Outcome */}
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>
                    <strong>Resultado:</strong> {meta.outcome}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
