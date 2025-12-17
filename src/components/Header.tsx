'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut, Sparkles, Loader2, ChevronDown, Dna } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import NotificationBell from '@/components/notifications/NotificationBell'

export default function Header() {
  const { user, signOut, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)

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
    </>
  )
}
