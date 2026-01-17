'use client'

import { useEffect, useState } from 'react'
import ClientSidebar from '@/components/layout/ClientSidebar'
import { supabase } from '@/lib/supabase'

interface ClientLayoutProps {
  children: React.ReactNode
  params: { clientId: string }
}

export default function ClientLayout({ children, params }: ClientLayoutProps) {
  const [clientName, setClientName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadClient = async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('name')
          .eq('id', params.clientId)
          .single()

        if (error) throw error
        setClientName(data?.name || 'Cliente')
      } catch (err) {
        console.error('Error loading client:', err)
        setClientName('Cliente')
      } finally {
        setLoading(false)
      }
    }

    loadClient()
  }, [params.clientId])

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <ClientSidebar
        clientId={params.clientId}
        clientName={loading ? 'Cargando...' : clientName}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
