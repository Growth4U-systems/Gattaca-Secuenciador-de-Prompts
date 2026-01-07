'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase-browser'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef, Suspense } from 'react'
import { Dna, AlertCircle, Sparkles, Zap, Target, TrendingUp } from 'lucide-react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabaseRef = useRef(createClient())
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasCheckedRef = useRef(false)

  const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(errorParam === 'auth_failed' ? 'Error de autenticación. Por favor, intenta de nuevo.' : decodeURIComponent(errorParam))
    }
  }, [searchParams])

  useEffect(() => {
    const supabase = supabaseRef.current

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event, 'Session:', !!session)

      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        setIsLoading(true)
        await new Promise(resolve => setTimeout(resolve, 100))
        router.replace('/')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  if (isChecking || isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-cyan-500 rounded-2xl flex items-center justify-center">
            <Dna className="w-8 h-8 text-white animate-spin" />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 relative flex items-center justify-center p-8 overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-slate-950">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950/50 via-slate-950 to-cyan-950/50" />

          {/* Animated orbs */}
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl animate-pulse delay-500" />

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '50px 50px'
            }}
          />

          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white/20 rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${3 + Math.random() * 4}s`
                }}
              />
            ))}
          </div>
        </div>

        {/* Login Content */}
        <div className="w-full max-w-md relative z-10">
          {/* Logo & Branding */}
          <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 rounded-2xl mb-6 shadow-2xl shadow-violet-500/30 transform hover:scale-105 transition-all duration-300 hover:rotate-3">
              <Dna className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-3">
              Gattaca
            </h1>
            <p className="text-slate-400 font-medium text-lg">Secuenciador de Prompts</p>
          </div>

          {/* Auth Card */}
          <div className="bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-800/50 p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white mb-2">Bienvenido</h2>
              <p className="text-slate-400 text-sm">Inicia sesión para comenzar a crear magia</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <Auth
              supabaseClient={supabaseRef.current}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#7c3aed',
                      brandAccent: '#6d28d9',
                      brandButtonText: 'white',
                      defaultButtonBackground: 'rgba(30, 41, 59, 0.8)',
                      defaultButtonBackgroundHover: 'rgba(51, 65, 85, 0.8)',
                      defaultButtonBorder: 'rgba(71, 85, 105, 0.5)',
                      defaultButtonText: '#e2e8f0',
                      inputBackground: 'rgba(15, 23, 42, 0.8)',
                      inputBorder: 'rgba(71, 85, 105, 0.5)',
                      inputBorderHover: 'rgba(100, 116, 139, 0.5)',
                      inputBorderFocus: '#7c3aed',
                      inputText: '#f1f5f9',
                      inputPlaceholder: '#64748b',
                    },
                    borderWidths: {
                      buttonBorderWidth: '1px',
                      inputBorderWidth: '1px',
                    },
                    radii: {
                      borderRadiusButton: '0.875rem',
                      buttonBorderRadius: '0.875rem',
                      inputBorderRadius: '0.875rem',
                    },
                    fontSizes: {
                      baseButtonSize: '15px',
                      baseInputSize: '15px',
                    },
                    space: {
                      buttonPadding: '14px 18px',
                      inputPadding: '14px 18px',
                    },
                  },
                },
                className: {
                  button: 'font-medium transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/20',
                  input: 'transition-all duration-200',
                  label: 'text-slate-300',
                  anchor: 'text-violet-400 hover:text-violet-300',
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
          <p className="text-center text-sm text-slate-500 mt-8 animate-in fade-in duration-700 delay-300">
            Potencia tu marketing con inteligencia artificial
          </p>
        </div>
      </div>

      {/* Right Side - Creative Visual */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500">
        {/* Animated background pattern */}
        <div className="absolute inset-0">
          {/* DNA Helix Animation */}
          <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="dna-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#dna-pattern)" />
          </svg>

          {/* Glowing orbs */}
          <div className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 left-20 w-80 h-80 bg-cyan-300/20 rounded-full blur-3xl animate-pulse delay-700" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-300/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
          {/* Main Illustration - Prompt Sequencing Visualization */}
          <div className="relative mb-12">
            {/* Central DNA/Sequence Icon */}
            <div className="relative">
              {/* Orbiting elements */}
              <div className="absolute inset-0 w-80 h-80 animate-spin-slow">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-xl">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-xl">
                    <Target className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-xl">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-xl">
                    <TrendingUp className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>

              {/* Center piece */}
              <div className="w-80 h-80 flex items-center justify-center">
                <div className="w-40 h-40 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center border border-white/40 shadow-2xl transform hover:scale-105 transition-transform duration-500">
                  <Dna className="w-20 h-20 text-white" />
                </div>
              </div>

              {/* Connection lines */}
              <svg className="absolute inset-0 w-80 h-80" viewBox="0 0 320 320">
                <circle cx="160" cy="160" r="100" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="5,5" className="animate-spin-slow" style={{ animationDirection: 'reverse' }} />
                <circle cx="160" cy="160" r="140" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="10,10" className="animate-spin-slow" />
              </svg>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="text-center max-w-md">
            <h2 className="text-3xl font-bold text-white mb-4">
              Secuencia. Optimiza. Conquista.
            </h2>
            <p className="text-white/80 text-lg mb-8">
              Transforma tus ideas en campañas de marketing poderosas con secuencias de prompts impulsadas por IA.
            </p>

            {/* Stats/Features */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="text-3xl font-bold text-white mb-1">10x</div>
                <div className="text-white/70 text-sm">Más rápido</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="text-3xl font-bold text-white mb-1">AI</div>
                <div className="text-white/70 text-sm">Potenciado</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                <div className="text-3xl font-bold text-white mb-1">∞</div>
                <div className="text-white/70 text-sm">Posibilidades</div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative floating elements */}
        <div className="absolute top-10 left-10 w-3 h-3 bg-white/40 rounded-full animate-float" />
        <div className="absolute top-1/4 right-16 w-2 h-2 bg-white/30 rounded-full animate-float delay-300" />
        <div className="absolute bottom-1/3 left-24 w-4 h-4 bg-white/20 rounded-full animate-float delay-500" />
        <div className="absolute bottom-16 right-1/4 w-2 h-2 bg-white/40 rounded-full animate-float delay-700" />
      </div>

      {/* Custom animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .delay-300 {
          animation-delay: 300ms;
        }
        .delay-500 {
          animation-delay: 500ms;
        }
        .delay-700 {
          animation-delay: 700ms;
        }
        .delay-1000 {
          animation-delay: 1000ms;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
      `}</style>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-cyan-500 rounded-2xl flex items-center justify-center">
            <Dna className="w-8 h-8 text-white" />
          </div>
        </div>
      </main>
    }>
      <LoginContent />
    </Suspense>
  )
}
