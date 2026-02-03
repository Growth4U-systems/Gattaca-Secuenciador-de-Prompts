import type { Metadata, Viewport } from 'next'
import dynamic from 'next/dynamic'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { OpenRouterProvider } from '@/lib/openrouter-context'
import { UIProviders } from '@/components/ui'
import Header from '@/components/Header'
import { HelpSystemProvider } from '@/components/help'

// Dynamic import with ssr: false to ensure client-only rendering
const AssistantWrapper = dynamic(
  () => import('@/components/assistant/AssistantWrapper'),
  { ssr: false }
)

const HelpModalWrapper = dynamic(
  () => import('@/components/help/HelpModal'),
  { ssr: false }
)

const HelpButtonWrapper = dynamic(
  () => import('@/components/help/HelpButton'),
  { ssr: false }
)

export const metadata: Metadata = {
  title: 'Gattaca | Marketing con IA',
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
              <HelpSystemProvider>
                <div className="min-h-screen flex flex-col">
                  <Header />
                  <div className="flex-1">
                    {children}
                  </div>
                  <AssistantWrapper />
                  <HelpButtonWrapper />
                  <HelpModalWrapper />
                </div>
              </HelpSystemProvider>
            </OpenRouterProvider>
          </UIProviders>
        </AuthProvider>
      </body>
    </html>
  )
}
