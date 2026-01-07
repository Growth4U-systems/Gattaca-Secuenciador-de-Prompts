import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { OpenRouterProvider } from '@/lib/openrouter-context'
import { UIProviders } from '@/components/ui'
import Header from '@/components/Header'

export const metadata: Metadata = {
  title: 'Gattaca | Secuenciador de prompts de marketing con IA',
  description: 'Sistema automatizado para generar estrategias de marketing con IA',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#4f46e5' },
    { media: '(prefers-color-scheme: dark)', color: '#4f46e5' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <UIProviders>
            <OpenRouterProvider>
              <div className="min-h-screen flex flex-col">
                <Header />
                <div className="flex-1">
                  {children}
                </div>
              </div>
            </OpenRouterProvider>
          </UIProviders>
        </AuthProvider>
      </body>
    </html>
  )
}
