'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from './auth-context'
import { useToast } from '@/components/ui/Toast/ToastContext'

interface TokenInfo {
  keyPrefix: string
  lastUsedAt: string | null
  createdAt: string
  expiresAt: string | null
  creditLimit: number | null
  limitRemaining: number | null
  usage: number | null
}

interface OpenRouterContextType {
  isConnected: boolean
  isLoading: boolean
  tokenInfo: TokenInfo | null
  hasCompletedInitialCheck: boolean
  initiateOAuth: () => Promise<void>
  disconnect: () => Promise<void>
  refreshStatus: (fetchLatest?: boolean) => Promise<void>
}

const OpenRouterContext = createContext<OpenRouterContextType | undefined>(undefined)

export function OpenRouterProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const toast = useToast()
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const hasCheckedInitialStatus = useRef(false)
  const [hasCompletedInitialCheck, setHasCompletedInitialCheck] = useState(false)

  const refreshStatus = useCallback(async (fetchLatest: boolean = false) => {
    if (!user) {
      setIsConnected(false)
      setTokenInfo(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      // If fetchLatest is true, first refresh info from OpenRouter
      if (fetchLatest) {
        console.log('[OpenRouter] Fetching latest info from OpenRouter API')
        try {
          const refreshResponse = await fetch('/api/openrouter/refresh-info', {
            method: 'POST',
          })
          if (refreshResponse.ok) {
            console.log('[OpenRouter] Successfully refreshed token info from OpenRouter')
          } else {
            console.warn('[OpenRouter] Failed to refresh from OpenRouter, using cached data')
          }
        } catch (refreshError) {
          console.warn('[OpenRouter] Error refreshing from OpenRouter:', refreshError)
        }
      }

      // Now fetch the status (which may have been updated by refresh-info)
      const response = await fetch('/api/openrouter/status', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      })

      if (response.ok) {
        const data = await response.json()
        setIsConnected(data.connected)
        setTokenInfo(data.tokenInfo)
      } else {
        const errorData = await response.text()
        console.error('[OpenRouter] Status error:', errorData)
        setIsConnected(false)
        setTokenInfo(null)
      }
    } catch (error) {
      console.error('[OpenRouter] Error fetching status:', error)
      setIsConnected(false)
      setTokenInfo(null)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Check for OAuth callback results in URL (runs once on mount)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const success = params.get('openrouter_success')
    const error = params.get('openrouter_error')

    if (success === 'true') {
      console.log('[OpenRouter] OAuth success detected, setting connected state optimistically')
      hasCheckedInitialStatus.current = true // Mark as checked to prevent double-check

      // Remove query params from URL
      window.history.replaceState({}, '', window.location.pathname)

      // Set optimistic state immediately - assume connection is successful
      setIsConnected(true)
      setIsLoading(false)

      // Then fetch the actual token info in the background
      const fetchTokenInfo = async () => {
        console.log('[OpenRouter] Fetching token info after OAuth success')
        try {
          const response = await fetch('/api/openrouter/status', {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            }
          })

          if (response.ok) {
            const data = await response.json()
            console.log('[OpenRouter] Token info fetched:', data)
            if (data.connected) {
              setIsConnected(true)
              setTokenInfo(data.tokenInfo)
            }
          }
        } catch (error) {
          console.error('[OpenRouter] Error fetching token info after OAuth:', error)
        }
      }

      // Fetch with a small delay to ensure DB commit
      setTimeout(fetchTokenInfo, 1000)
    } else if (error) {
      console.error('[OpenRouter] OAuth error:', error)
      // Remove query params from URL
      window.history.replaceState({}, '', window.location.pathname)
      // Show error toast
      toast.error('Error de autorización', 'No se autorizó la conexión con OpenRouter')
    }
  }, []) // Empty deps - only run once

  // Check status when user changes (but only if not returning from OAuth)
  useEffect(() => {
    if (!user) {
      hasCheckedInitialStatus.current = false
      setIsLoading(false)
      setHasCompletedInitialCheck(false)
      return
    }

    // Only check once per user session
    if (hasCheckedInitialStatus.current) {
      return
    }

    hasCheckedInitialStatus.current = true
    refreshStatus().then(() => {
      setHasCompletedInitialCheck(true)
    })
  }, [user, refreshStatus])

  const initiateOAuth = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/openrouter/initiate', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to initiate OAuth')
      }

      const data = await response.json()

      // Redirect to OpenRouter auth page
      window.location.href = data.authUrl
    } catch (error) {
      console.error('Error initiating OpenRouter OAuth:', error)
      setIsLoading(false)
      throw error
    }
  }

  const disconnect = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/openrouter/disconnect', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect')
      }

      setIsConnected(false)
      setTokenInfo(null)
    } catch (error) {
      console.error('Error disconnecting OpenRouter:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <OpenRouterContext.Provider
      value={{
        isConnected,
        isLoading,
        tokenInfo,
        hasCompletedInitialCheck,
        initiateOAuth,
        disconnect,
        refreshStatus,
      }}
    >
      {children}
    </OpenRouterContext.Provider>
  )
}

export function useOpenRouter() {
  const context = useContext(OpenRouterContext)
  if (context === undefined) {
    throw new Error('useOpenRouter must be used within an OpenRouterProvider')
  }
  return context
}
