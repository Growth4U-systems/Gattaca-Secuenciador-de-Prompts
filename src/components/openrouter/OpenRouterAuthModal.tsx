'use client'

import { useState, useEffect } from 'react'
import { useOpenRouter } from '@/lib/openrouter-context'
import { X, Zap, Shield, CreditCard, ExternalLink, Loader2, Link2Off, CheckCircle2, Clock, AlertCircle, DollarSign } from 'lucide-react'

interface OpenRouterAuthModalProps {
  isOpen: boolean
  onClose: () => void
  trigger?: 'login' | 'action'
}

export default function OpenRouterAuthModal({ isOpen, onClose, trigger = 'action' }: OpenRouterAuthModalProps) {
  const { initiateOAuth, isConnected, disconnect, tokenInfo, isLoading, refreshStatus } = useOpenRouter()
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshingBalance, setRefreshingBalance] = useState(false)

  // Refresh balance from OpenRouter when modal opens and user is connected
  useEffect(() => {
    if (isOpen && isConnected && !refreshingBalance) {
      setRefreshingBalance(true)
      refreshStatus(true).finally(() => {
        setRefreshingBalance(false)
      })
    }
  }, [isOpen, isConnected])

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleConnect = async () => {
    try {
      setConnecting(true)
      setError(null)
      await initiateOAuth()
    } catch (err) {
      setError('Error al iniciar la conexión. Intenta de nuevo.')
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true)
      setError(null)
      await disconnect()
      onClose()
    } catch (err) {
      setError('Error al desconectar. Intenta de nuevo.')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 px-6 py-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {isConnected ? 'OpenRouter Conectado' : 'Conectar OpenRouter'}
              </h2>
              <p className="text-indigo-200 text-sm mt-1">
                {isConnected
                  ? 'Gestiona tu conexión con OpenRouter'
                  : 'Accede a más de 100 modelos de IA'
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {isConnected ? (
            // Connected state
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                <div className="flex-1">
                  <p className="font-semibold text-emerald-900">Conectado</p>
                  <p className="text-sm text-emerald-700">
                    {tokenInfo?.keyPrefix || 'API Key activa'}
                  </p>
                </div>
              </div>

              {/* Token Information */}
              <div className="space-y-2">
                {tokenInfo?.createdAt && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-gray-400" />
                    <span>Conectado el {new Date(tokenInfo.createdAt).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}</span>
                  </div>
                )}

                {(() => {
                  // If there's no expiration date, show "Sin fecha de expiración"
                  if (!tokenInfo?.expiresAt) {
                    return (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>Sin fecha de expiración</span>
                      </div>
                    )
                  }

                  const expirationDate = new Date(tokenInfo.expiresAt)
                  const now = new Date()

                  // Use exact time difference in milliseconds
                  const msUntilExpiration = expirationDate.getTime() - now.getTime()
                  const isExpired = msUntilExpiration <= 0

                  // Calculate time remaining
                  const totalMinutes = Math.floor(msUntilExpiration / (1000 * 60))
                  const totalHours = Math.floor(totalMinutes / 60)
                  const days = Math.floor(totalHours / 24)
                  const hours = totalHours % 24
                  const minutes = totalMinutes % 60

                  // Consider "expiring soon" if less than 7 days
                  const isExpiringSoon = msUntilExpiration > 0 && msUntilExpiration <= (7 * 24 * 60 * 60 * 1000)

                  return (
                    <div className={`flex items-center gap-2 text-sm ${
                      isExpired ? 'text-red-600' :
                      isExpiringSoon ? 'text-amber-600' :
                      'text-gray-600'
                    }`}>
                      {isExpired ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                      <span>
                        {isExpired ? (
                          `Expiró el ${expirationDate.toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}`
                        ) : isExpiringSoon ? (
                          // Show detailed time for tokens expiring soon
                          days > 0 ? (
                            `Expira en ${days} día${days !== 1 ? 's' : ''} y ${hours}h`
                          ) : (
                            // Format as HH:MM when less than 24 hours
                            `Expira en ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
                          )
                        ) : (
                          `Expira el ${expirationDate.toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}`
                        )}
                      </span>
                    </div>
                  )
                })()}

                {/* Credit Information */}
                {tokenInfo?.creditLimit !== null && tokenInfo?.creditLimit !== undefined && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    {refreshingBalance ? (
                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    ) : (
                      <DollarSign className="w-4 h-4 text-gray-400" />
                    )}
                    <span>
                      {tokenInfo.limitRemaining !== null && tokenInfo.limitRemaining !== undefined ? (
                        <>
                          ${tokenInfo.limitRemaining.toFixed(4)} de ${tokenInfo.creditLimit.toFixed(2)} disponibles
                        </>
                      ) : (
                        <>Límite: ${tokenInfo.creditLimit.toFixed(2)}</>
                      )}
                    </span>
                  </div>
                )}

                {/* Usage Information */}
                {tokenInfo?.usage !== null && tokenInfo?.usage !== undefined && tokenInfo.usage > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CreditCard className="w-4 h-4 text-gray-400" />
                    <span>Usado: ${tokenInfo.usage.toFixed(4)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {disconnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2Off className="w-4 h-4" />
                  )}
                  <span>Desconectar</span>
                </button>
              </div>
            </div>
          ) : (
            // Not connected state
            <div className="space-y-5">
              {/* Benefits */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Zap className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">+100 modelos de IA</p>
                    <p className="text-sm text-gray-500">GPT-4, Claude, Gemini, Llama y más</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Control de costos</p>
                    <p className="text-sm text-gray-500">Paga solo lo que usas, sin sorpresas</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Shield className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Tu API key, tu control</p>
                    <p className="text-sm text-gray-500">Conexión segura con OAuth</p>
                  </div>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleConnect}
                  disabled={connecting || isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
                >
                  {connecting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>Conectar con OpenRouter</span>
                      <ExternalLink className="w-4 h-4" />
                    </>
                  )}
                </button>

                <a
                  href="https://openrouter.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  ¿No tienes cuenta? Crear una gratis
                </a>

                <button
                  onClick={onClose}
                  className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Configurar más tarde
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
