import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gattaca (secuenciador de prompts)',
  description: 'Sistema automatizado para generar estrategias de marketing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
