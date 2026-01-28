'use client'

import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { AssistantProvider } from './AssistantContext'
import FloatingAssistant from './FloatingAssistant'

/**
 * AssistantWrapper - Renders the floating assistant with automatic projectId detection
 */
export default function AssistantWrapper() {
  const pathname = usePathname()

  // Extract projectId from pathname (supports both /projects/ and /clients/ routes)
  const projectId = useMemo(() => {
    // Match /projects/[uuid]/... pattern
    const projectMatch = pathname?.match(/\/projects\/([a-f0-9-]{36})/i)
    if (projectMatch) return projectMatch[1]

    // Also try /clients/[uuid] pattern
    const clientMatch = pathname?.match(/\/clients\/([a-f0-9-]{36})/i)
    if (clientMatch) return clientMatch[1]

    return null
  }, [pathname])

  // Don't render on auth pages
  if (pathname?.startsWith('/auth')) return null

  return (
    <AssistantProvider projectId={projectId || undefined}>
      <FloatingAssistant />
    </AssistantProvider>
  )
}
