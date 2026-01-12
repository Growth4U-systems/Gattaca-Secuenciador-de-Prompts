'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Zap,
  Check,
  ExternalLink,
  Loader2,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

interface OpenRouterStatus {
  connected: boolean
  keyHint?: string
  keyPrefix?: string
  connectedAt?: string
  lastUsedAt?: string
}

interface OpenRouterConnectProps {
  userId: string
  onStatusChange?: (connected: boolean) => void
}

export default function OpenRouterConnect({
  userId,
  onStatusChange,
}: OpenRouterConnectProps) {
  const [status, setStatus] = useState<'loading' | 'disconnected' | 'connected'>('loading')
  const [keyInfo, setKeyInfo] = useState<OpenRouterStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  // Check URL params for OAuth result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('openrouter_success')
    const oauthError = params.get('openrouter_error')

    if (success === 'true') {
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname)
      // Refresh status
      fetchStatus()
    } else if (oauthError) {
      setError(getErrorMessage(oauthError))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const getErrorMessage = (code: string): string => {
    const messages: Record<string, string> = {
      no_code: 'No se recibió código de autorización',
      fetch_failed: 'Error al procesar la solicitud',
      no_pending_request: 'No hay solicitud de OAuth pendiente',
      expired: 'La solicitud de OAuth ha expirado. Intenta de nuevo.',
      exchange_failed: 'Error al intercambiar el código por la API key',
      no_key_received: 'No se recibió la API key',
      storage_failed: 'Error al guardar la API key',
      internal_error: 'Error interno del servidor',
    }
    return messages[code] || 'Error desconocido'
  }

  const fetchStatus = useCallback(async () => {
    if (!userId) return

    try {
      const response = await fetch(`/api/auth/openrouter?userId=${userId}`)
      const data = await response.json()

      if (data.connected) {
        setStatus('connected')
        setKeyInfo(data)
        onStatusChange?.(true)
      } else {
        setStatus('disconnected')
        setKeyInfo(null)
        onStatusChange?.(false)
      }
    } catch (err) {
      console.error('Error fetching OpenRouter status:', err)
      setStatus('disconnected')
      setError('Error al verificar el estado de conexión')
    }
  }, [userId, onStatusChange])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleConnect = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      const data = await response.json()

      if (data.authUrl) {
        // Redirect to OpenRouter OAuth
        window.location.href = data.authUrl
      } else {
        throw new Error(data.error || 'Failed to initiate OAuth')
      }
    } catch (err) {
      console.error('Error connecting OpenRouter:', err)
      setError('Error al iniciar la conexión')
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    setError(null)

    try {
      const response = await fetch(`/api/auth/openrouter?userId=${userId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setStatus('disconnected')
        setKeyInfo(null)
        onStatusChange?.(false)
      } else {
        throw new Error('Failed to disconnect')
      }
    } catch (err) {
      console.error('Error disconnecting OpenRouter:', err)
      setError('Error al desconectar')
    } finally {
      setIsDisconnecting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg animate-pulse">
            <Zap className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
            <div className="h-3 bg-gray-100 rounded w-48 mt-1 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${status === 'connected' ? 'bg-green-100' : 'bg-purple-100'}`}>
            <Zap className={`h-5 w-5 ${status === 'connected' ? 'text-green-600' : 'text-purple-600'}`} />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">OpenRouter</h3>
            {status === 'connected' ? (
              <div className="text-sm text-gray-500">
                <span className="text-green-600">Conectado</span>
                {keyInfo?.keyHint && (
                  <span className="ml-2">• Key: {keyInfo.keyHint}</span>
                )}
                {keyInfo?.connectedAt && (
                  <span className="ml-2">• {new Date(keyInfo.connectedAt).toLocaleDateString()}</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Conecta tu cuenta para usar tus propios créditos
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'connected' ? (
            <>
              <button
                onClick={fetchStatus}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                title="Actualizar estado"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                {isDisconnecting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <X size={14} />
                )}
                Desconectar
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {isConnecting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  Conectar
                  <ExternalLink size={16} />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 text-red-400 hover:text-red-600"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {status === 'connected' && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-700">
              Las llamadas a modelos de IA usarán tus créditos de OpenRouter
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
