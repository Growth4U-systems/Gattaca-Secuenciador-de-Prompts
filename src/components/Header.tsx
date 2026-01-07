'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut, Sparkles, Loader2, ChevronDown, Dna } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import NotificationBell from '@/components/notifications/NotificationBell'
import { OpenRouterStatusBadge, OpenRouterAuthModal } from '@/components/openrouter'
import { useOpenRouter } from '@/lib/openrouter-context'
import { useToast } from '@/components/ui/Toast/ToastContext'

export default function Header() {
  const { user, signOut, loading } = useAuth()
  const { isConnected, isLoading: isLoadingOpenRouter, hasCompletedInitialCheck } = useOpenRouter()
  const { success } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)
  const [showOpenRouterModal, setShowOpenRouterModal] = useState(false)
  const [modalTrigger, setModalTrigger] = useState<'login' | 'action'>('action')
  const hasScheduledModal = useRef(false)
  const lastCheckedUserId = useRef<string | null>(null)
  const hasShownSuccessToast = useRef(false)

  // Show success toast when OAuth connection completes successfully
  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const success_param = params.get('openrouter_success')

    if (success_param === 'true' && !hasShownSuccessToast.current) {
      success('¡Conexión exitosa!', 'Tu cuenta de OpenRouter está conectada correctamente')
      hasShownSuccessToast.current = true

      // Clean up URL parameter
      params.delete('openrouter_success')
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [success])

  // Check OpenRouter connection after user logs in
  useEffect(() => {
    console.log('[Header] Effect check:', {
      user: !!user,
      loading,
      isLoadingOpenRouter,
      isConnected,
      hasCompletedInitialCheck,
      hasScheduledModal: hasScheduledModal.current,
      lastCheckedUserId: lastCheckedUserId.current
    })

    // Skip if no user or on auth pages
    if (!user || pathname?.startsWith('/auth')) {
      hasScheduledModal.current = false
      lastCheckedUserId.current = null
      return
    }

    // Skip if still loading auth or OpenRouter status
    if (loading || isLoadingOpenRouter) {
      console.log('[Header] Still loading, skipping')
      return
    }

    // CRITICAL: Wait until the initial check is completed before making any decision
    if (!hasCompletedInitialCheck) {
      console.log('[Header] Initial check not completed yet, waiting...')
      return
    }

    // Check if we've already checked for this specific login session
    // Reset if it's a different user or if user logged out and back in
    if (lastCheckedUserId.current !== user.id) {
      console.log('[Header] New user detected, resetting flags')
      hasScheduledModal.current = false
      lastCheckedUserId.current = user.id
    }

    // Check if we've already scheduled the modal for this login
    if (hasScheduledModal.current) {
      console.log('[Header] Already scheduled, skipping')
      return
    }

    console.log('[Header] Final check - isConnected:', isConnected)

    // If user is not connected, show the modal
    if (!isConnected) {
      console.log('[Header] NOT CONNECTED - Scheduling modal')
      // Mark as scheduled to prevent re-scheduling
      hasScheduledModal.current = true

      // Small delay to let the UI settle after login
      setTimeout(() => {
        console.log('[Header] Opening modal now')
        setModalTrigger('login')
        setShowOpenRouterModal(true)
      }, 1500)
    } else {
      console.log('[Header] User IS CONNECTED - Not showing modal')
    }
  }, [user, loading, isConnected, isLoadingOpenRouter, hasCompletedInitialCheck, pathname])

  const handleOpenRouterBadgeClick = () => {
    setModalTrigger('action')
    setShowOpenRouterModal(true)
  }

  const handleCloseModal = () => {
    setShowOpenRouterModal(false)
  }

  // Clear the scheduled flag when user connects to OpenRouter
  useEffect(() => {
    if (user && isConnected && !isLoadingOpenRouter) {
      hasScheduledModal.current = false
    }
  }, [user, isConnected, isLoadingOpenRouter])

  // Don't show header on auth pages
  if (pathname?.startsWith('/auth')) {
    return null
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      // Small delay to ensure cookies are cleared
      await new Promise(resolve => setTimeout(resolve, 100))
      router.replace('/auth/login')
    } catch (error) {
      console.error('Error signing out:', error)
      setSigningOut(false)
    }
  }

  if (loading) {
    return (
      <header className="bg-gradient-to-r from-slate-50/95 via-white/95 to-blue-50/95 backdrop-blur-md border-b border-blue-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">Gattaca</span>
            </div>
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        </div>
      </header>
    )
  }

  // Show minimal loading page when signing out
  if (signingOut) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center z-[100]">
        <div className="animate-pulse">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-xl flex items-center justify-center">
            <Dna className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <header className="bg-gradient-to-r from-slate-50/95 via-white/95 to-blue-50/95 backdrop-blur-md border-b border-blue-100/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="p-1.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg group-hover:shadow-lg group-hover:shadow-blue-500/25 transition-all">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                Gattaca
              </span>
            </Link>

            {/* User Menu */}
            {user && (
              <div className="flex items-center gap-3">
                {/* OpenRouter Status */}
                <OpenRouterStatusBadge onClick={handleOpenRouterBadgeClick} />

                {/* Notification Bell */}
                <NotificationBell />

                {/* User Menu Dropdown */}
                <div className="relative group">
                  {/* Profile Button */}
                  <button className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-100 rounded-xl transition-all group-hover:shadow-md">
                  <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-semibold text-white">
                      {user.email?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden sm:inline text-sm font-medium text-gray-700">
                    {user.email?.split('@')[0]}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-blue-600 transition-colors" />
                </button>

                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden">
                  {/* User Info */}
                  <div className="px-4 py-3 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-blue-100">
                    <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                      Sesión iniciada
                    </p>
                    <p className="text-sm font-semibold text-gray-900 truncate mt-1">
                      {user.email}
                    </p>
                  </div>

                  {/* Logout Button */}
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* OpenRouter Auth Modal */}
      <OpenRouterAuthModal
        isOpen={showOpenRouterModal}
        onClose={handleCloseModal}
        trigger={modalTrigger}
      />
    </>
  )
}
