'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react'

export default function JoinProjectPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      joinProject()
    }
  }, [token])

  const joinProject = async () => {
    try {
      console.log('Attempting to join with token:', token)

      const res = await fetch('/api/share-links/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      console.log('Response status:', res.status)
      const data = await res.json()
      console.log('Response data:', data)

      if (data.success) {
        setStatus('success')
        setMessage(data.message)
        setProjectId(data.projectId)
        setProjectName(data.projectName)

        // Redirect to project after 2 seconds
        setTimeout(() => {
          router.push(`/projects/${data.projectId}`)
        }, 2000)
      } else {
        setStatus('error')
        setMessage(data.error || 'No se pudo unir al proyecto')
      }
    } catch (error) {
      setStatus('error')
      setMessage('Error al procesar la solicitud')
      console.error('Join error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        {status === 'loading' && (
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Uniéndote al proyecto...
            </h1>
            <p className="text-gray-600">
              Por favor espera mientras procesamos tu solicitud
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              ¡Listo!
            </h1>
            <p className="text-gray-600 mb-6">
              {message}
            </p>
            {projectName && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700 mb-1">Te uniste al proyecto:</p>
                <p className="font-semibold text-gray-900">{projectName}</p>
              </div>
            )}
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              Ir al proyecto
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              No se pudo unir
            </h1>
            <p className="text-gray-600 mb-6">
              {message}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/')}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ir al inicio
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Intentar de nuevo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
