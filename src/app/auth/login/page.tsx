'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase-browser'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef, Suspense } from 'react'
import { Sparkles, Loader2, Dna, AlertCircle } from 'lucide-react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabaseRef = useRef(createClient())
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasCheckedRef = useRef(false)

  // Get redirect URL - must be absolute URL for Supabase
  // Uses environment variable to support any port configuration
  const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`


  useEffect(() => {
    // Check for error in URL params
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(errorParam === 'auth_failed' ? 'Error de autenticación. Por favor, intenta de nuevo.' : decodeURIComponent(errorParam))
    }
  }, [searchParams])

  useEffect(() => {
    const supabase = supabaseRef.current

    // Optimized session check - only run once
    const checkUser = async () => {
      if (hasCheckedRef.current) return
      hasCheckedRef.current = true

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setIsLoading(true)
          router.replace('/')
          return
        }
      } catch (error) {
        console.error('Session check error:', error)
      } finally {
        setIsChecking(false)
      }
    }

    checkUser()

    // Optimized auth state listener - listen to all auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event, 'Session:', !!session)

      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        setIsLoading(true)
        // Small delay to ensure cookies are set
        await new Promise(resolve => setTimeout(resolve, 100))
        router.replace('/')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  // Show minimal loading state while checking session or redirecting
  if (isChecking || isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-xl flex items-center justify-center">
            <Dna className="w-6 h-6 text-white" />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-indigo-200/30 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-cyan-200/30 to-transparent rounded-full blur-3xl" />
      </div>


      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-2xl mb-6 shadow-lg shadow-indigo-500/30 transform hover:scale-105 transition-transform">
            <Dna className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent mb-2">
            Gattaca
          </h1>
          <p className="text-gray-600 font-medium">Secuenciador de Prompts</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-gray-200/50 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Bienvenido</h2>
            <p className="text-gray-600 text-sm">Inicia sesión para continuar</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          <Auth
            supabaseClient={supabaseRef.current}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#4f46e5',
                    brandAccent: '#4338ca',
                    brandButtonText: 'white',
                    defaultButtonBackground: 'white',
                    defaultButtonBackgroundHover: '#f9fafb',
                    defaultButtonBorder: '#e5e7eb',
                    defaultButtonText: '#374151',
                    inputBackground: 'white',
                    inputBorder: '#e5e7eb',
                    inputBorderHover: '#d1d5db',
                    inputBorderFocus: '#4f46e5',
                  },
                  borderWidths: {
                    buttonBorderWidth: '1px',
                    inputBorderWidth: '1px',
                  },
                  radii: {
                    borderRadiusButton: '0.75rem',
                    buttonBorderRadius: '0.75rem',
                    inputBorderRadius: '0.75rem',
                  },
                  fontSizes: {
                    baseButtonSize: '15px',
                    baseInputSize: '15px',
                  },
                  space: {
                    buttonPadding: '12px 16px',
                    inputPadding: '12px 16px',
                  },
                },
              },
              className: {
                button: 'font-medium transition-all duration-200 hover:shadow-md',
                input: 'transition-all duration-200',
              },
            }}
            providers={['google']}
            redirectTo={redirectUrl}
            localization={{
              variables: {
                sign_in: {
                  social_provider_text: 'Continuar con {{provider}}',
                },
              },
            }}
          />
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-8 animate-in fade-in duration-500 delay-200">
          Sistema automatizado para generar estrategias de marketing con IA
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-xl flex items-center justify-center">
            <Dna className="w-6 h-6 text-white" />
          </div>
        </div>
      </main>
    }>
      <LoginContent />
    </Suspense>
  )
}
