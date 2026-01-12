'use client'

import { useState, useEffect } from 'react'
import {
  Key,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Database,
  Cloud,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react'
import { AI_PROVIDERS, AI_MODELS, type AIProvider } from '@/types/v2.types'
import OpenRouterConnect from './OpenRouterConnect'

interface APIStatus {
  openrouter: boolean
  supabase: boolean
  blob: boolean
  anthropic_direct: boolean
  openai_direct: boolean
  google_direct: boolean
}

interface ConfigStatus {
  success: boolean
  status: APIStatus
  availableProviders: string[]
  primaryLLMProvider: string | null
  message: string
}

interface APIConfigPanelProps {
  userId?: string // If provided, shows user-specific OAuth connection options
}

export default function APIConfigPanel({ userId }: APIConfigPanelProps) {
  const [config, setConfig] = useState<ConfigStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModels, setShowModels] = useState(false)

  const checkConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v2/config/status')
      if (!res.ok) throw new Error('Error al verificar configuración')
      const data = await res.json()
      setConfig(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkConfig()
  }, [])

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white border border-red-100 rounded-2xl p-6">
        <div className="flex items-center gap-3 text-red-600">
          <XCircle className="w-5 h-5" />
          <span>{error}</span>
          <button
            onClick={checkConfig}
            className="ml-auto px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 rounded-lg"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!config) return null

  const { status } = config

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <Key className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Configuración de APIs</h3>
              <p className="text-xs text-gray-500">Estado de servicios conectados</p>
            </div>
          </div>
          <button
            onClick={checkConfig}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Main Status */}
      <div className="p-6 space-y-4">
        {/* OpenRouter - Primary LLM Provider */}
        <div className={`p-4 rounded-xl border ${
          status.openrouter
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className={`w-5 h-5 ${status.openrouter ? 'text-green-600' : 'text-red-600'}`} />
              <div>
                <div className="font-medium text-gray-900 flex items-center gap-2">
                  OpenRouter
                  <span className="text-xs px-1.5 py-0.5 bg-white/50 rounded text-gray-600">
                    LLM Principal
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Acceso unificado a Claude, GPT, Gemini, Llama y más
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status.openrouter ? (
                <span className="flex items-center gap-1 text-green-700 text-sm">
                  <CheckCircle2 size={16} />
                  Activo
                </span>
              ) : (
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 transition-colors"
                >
                  Configurar
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>

          {/* Available Providers when OpenRouter is active */}
          {status.openrouter && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <p className="text-xs text-gray-600 mb-2">Proveedores disponibles:</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
                  <span
                    key={key}
                    className={`px-2 py-0.5 rounded text-xs ${provider.color}`}
                  >
                    {provider.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User's OpenRouter Connection (OAuth) */}
        {userId && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Info size={14} />
              <span>Conecta tu propia cuenta de OpenRouter para usar tus créditos</span>
            </div>
            <OpenRouterConnect userId={userId} />
          </div>
        )}

        {/* Supabase */}
        <div className={`p-4 rounded-xl border ${
          status.supabase
            ? 'bg-green-50 border-green-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className={`w-5 h-5 ${status.supabase ? 'text-green-600' : 'text-amber-600'}`} />
              <div>
                <div className="font-medium text-gray-900">Supabase</div>
                <p className="text-xs text-gray-600">Base de datos y autenticación</p>
              </div>
            </div>
            {status.supabase ? (
              <span className="flex items-center gap-1 text-green-700 text-sm">
                <CheckCircle2 size={16} />
                Activo
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-700 text-sm">
                <XCircle size={16} />
                No configurado
              </span>
            )}
          </div>
        </div>

        {/* Blob Storage */}
        <div className={`p-4 rounded-xl border ${
          status.blob
            ? 'bg-green-50 border-green-200'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className={`w-5 h-5 ${status.blob ? 'text-green-600' : 'text-slate-400'}`} />
              <div>
                <div className="font-medium text-gray-900 flex items-center gap-2">
                  Vercel Blob
                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
                    Opcional
                  </span>
                </div>
                <p className="text-xs text-gray-600">Almacenamiento de archivos grandes</p>
              </div>
            </div>
            {status.blob ? (
              <span className="flex items-center gap-1 text-green-700 text-sm">
                <CheckCircle2 size={16} />
                Activo
              </span>
            ) : (
              <span className="text-xs text-slate-500">No requerido</span>
            )}
          </div>
        </div>

        {/* Available Models Toggle */}
        {status.openrouter && (
          <button
            onClick={() => setShowModels(!showModels)}
            className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Info size={16} />
              Ver modelos disponibles ({AI_MODELS.length})
            </span>
            {showModels ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        )}

        {/* Models List */}
        {showModels && (
          <div className="grid gap-2 max-h-64 overflow-y-auto">
            {AI_MODELS.map((model) => (
              <div
                key={model.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${AI_PROVIDERS[model.provider].color}`}>
                    {AI_PROVIDERS[model.provider].name}
                  </span>
                  <div>
                    <span className="font-medium text-gray-900">{model.name}</span>
                    {model.recommended && (
                      <span className="ml-2 text-xs text-green-600">★ Recomendado</span>
                    )}
                    <p className="text-xs text-gray-500">{model.description}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>${model.costPer1M.input}/${model.costPer1M.output}</div>
                  <div className="text-gray-400">per 1M tokens</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Configuration Instructions */}
        {!status.openrouter && (
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-1">Cómo configurar OpenRouter:</p>
                <ol className="text-blue-800 space-y-1 list-decimal list-inside">
                  <li>
                    Visita{' '}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline">
                      openrouter.ai/keys
                    </a>
                  </li>
                  <li>Crea una API key</li>
                  <li>Agrega <code className="bg-blue-100 px-1 rounded">OPENROUTER_API_KEY=sk-or-...</code> a tu .env.local</li>
                  <li>Reinicia el servidor de desarrollo</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
