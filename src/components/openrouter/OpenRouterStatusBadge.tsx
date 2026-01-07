'use client'

import { useOpenRouter } from '@/lib/openrouter-context'
import { Link2, Link2Off, Loader2 } from 'lucide-react'

interface OpenRouterStatusBadgeProps {
  onClick?: () => void
}

export default function OpenRouterStatusBadge({ onClick }: OpenRouterStatusBadgeProps) {
  const { isConnected, isLoading, tokenInfo } = useOpenRouter()

  if (isLoading) {
    return (
      <div className="p-2 rounded-lg bg-gray-50 border border-gray-200">
        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
      </div>
    )
  }

  if (isConnected) {
    return (
      <button
        onClick={onClick}
        className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
        title={`OpenRouter conectado: ${tokenInfo?.keyPrefix || 'API Key activa'}`}
      >
        <div className="relative">
          <Link2 className="w-4 h-4 text-emerald-600" />
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white" />
        </div>
        <span className="hidden sm:inline text-xs font-medium text-emerald-700">
          OpenRouter
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
      title="OpenRouter no conectado - Haz clic para conectar"
    >
      <div className="relative">
        <Link2Off className="w-4 h-4 text-amber-600" />
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full border border-white animate-pulse" />
      </div>
      <span className="hidden sm:inline text-xs font-medium text-amber-700">
        Conectar
      </span>
    </button>
  )
}
