'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Clock,
  Users,
  Target,
  CheckCircle,
  ChevronRight,
  Lightbulb,
  HelpCircle,
  BookOpen,
  Zap,
} from 'lucide-react'
import {
  playbookMetadata,
  getPlaybookName,
  formatStepName,
} from '@/lib/playbook-metadata'

export default function PlaybookDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const meta = playbookMetadata[slug]

  if (!meta) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Playbook no encontrado
          </h1>
          <p className="text-gray-600 mb-4">
            El playbook &quot;{slug}&quot; no existe.
          </p>
          <Link
            href="/playbooks"
            className="text-blue-600 hover:underline"
          >
            Ver todos los playbooks
          </Link>
        </div>
      </div>
    )
  }

  const playbooks = Object.keys(playbookMetadata)
  const relatedPlaybooks = meta.relatedPlaybooks.filter(p =>
    playbooks.includes(p)
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{meta.icon}</span>
                <h1 className="text-3xl font-bold text-gray-900">
                  {getPlaybookName(slug)}
                </h1>
              </div>
              <p className="text-lg text-gray-600 max-w-2xl">
                {meta.purpose}
              </p>
            </div>

            <Link
              href={`/projects/new?playbookType=${slug}`}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Zap className="h-5 w-5" />
              Usar este playbook
            </Link>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-6 mt-6 text-sm text-gray-600">
            {meta.duration && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{meta.duration}</span>
              </div>
            )}
            {meta.targetAudience && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{meta.targetAudience}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span>{Object.keys(meta.steps).length} pasos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Description */}
        {meta.description && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Descripción
            </h2>
            <div className="prose prose-gray max-w-none">
              {meta.description.split('\n\n').map((paragraph, i) => (
                <p key={i} className="text-gray-700 whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* Objectives */}
        {meta.objectives && meta.objectives.length > 0 && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Objetivos
            </h2>
            <ul className="space-y-3">
              {meta.objectives.map((objective, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{objective}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* When to use */}
        <section className="bg-white rounded-xl border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            ¿Cuándo usar este playbook?
          </h2>
          <ul className="space-y-2">
            {meta.whenToUse.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <ChevronRight className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Requirements */}
        {meta.requirements && meta.requirements.length > 0 && (
          <section className="bg-amber-50 rounded-xl border border-amber-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Requisitos previos
            </h2>
            <ul className="space-y-2">
              {meta.requirements.map((req, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-amber-600 font-bold">•</span>
                  <span className="text-gray-700">{req}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Detailed Steps */}
        {meta.detailedSteps && Object.keys(meta.detailedSteps).length > 0 && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Flujo de trabajo detallado
            </h2>
            <div className="space-y-6">
              {Object.entries(meta.detailedSteps).map(([stepKey, step], i) => (
              <div
                key={stepKey}
                className="relative pl-8 pb-6 border-l-2 border-gray-200 last:border-l-0 last:pb-0"
              >
                {/* Step number */}
                <div className="absolute -left-4 top-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </div>

                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {formatStepName(stepKey)}
                  </h3>
                  <p className="text-gray-700 mb-3">{step.detailed}</p>

                  {step.tips && step.tips.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
                        <Lightbulb className="h-4 w-4" />
                        Tips
                      </div>
                      <ul className="space-y-1">
                        {step.tips.map((tip, j) => (
                          <li
                            key={j}
                            className="text-sm text-blue-700 flex items-start gap-2"
                          >
                            <span>•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
            </div>
          </section>
        )}

        {/* Examples */}
        {meta.examples && meta.examples.length > 0 && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Ejemplos de uso
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {meta.examples.map((example, i) => (
                <div
                  key={i}
                  className="bg-gray-50 rounded-lg p-4 border"
                >
                  <h3 className="font-medium text-gray-900 mb-2">
                    {example.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {example.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* FAQs */}
        {meta.faqs && meta.faqs.length > 0 && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-purple-600" />
              Preguntas frecuentes
            </h2>
            <div className="space-y-4">
              {meta.faqs.map((faq, i) => (
                <div key={i} className="border-b last:border-b-0 pb-4 last:pb-0">
                  <h3 className="font-medium text-gray-900 mb-2">
                    {faq.question}
                  </h3>
                  <p className="text-gray-600">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Related Playbooks */}
        {relatedPlaybooks.length > 0 && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Playbooks relacionados
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {relatedPlaybooks.map(relatedSlug => {
                const relatedMeta = playbookMetadata[relatedSlug]
                return (
                  <Link
                    key={relatedSlug}
                    href={`/playbooks/${relatedSlug}`}
                    className="flex items-start gap-4 p-4 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-2xl">{relatedMeta.icon}</span>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {getPlaybookName(relatedSlug)}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {relatedMeta.purpose}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-2">
            ¿Listo para empezar?
          </h2>
          <p className="text-blue-100 mb-6">
            {meta.outcome}
          </p>
          <Link
            href={`/projects/new?playbookType=${slug}`}
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
          >
            <Zap className="h-5 w-5" />
            Usar {getPlaybookName(slug)}
          </Link>
        </section>
      </div>
    </div>
  )
}
