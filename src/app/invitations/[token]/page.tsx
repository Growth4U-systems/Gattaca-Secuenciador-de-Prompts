'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, ArrowRight, Mail } from 'lucide-react'

export default function AcceptInvitationPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      acceptInvitation()
    }
  }, [token])

  const acceptInvitation = async () => {
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await res.json()

      if (data.success) {
        setStatus('success')
        setMessage(data.message)
        setProjectId(data.projectId)
        setProjectName(data.projectName)
        setRole(data.role)

        // Redirect to project after 2 seconds
        setTimeout(() => {
          router.push(`/projects/${data.projectId}`)
        }, 2000)
      } else {
        setStatus('error')
        setMessage(data.error || 'No se pudo aceptar la invitación')
      }
    } catch (error) {
      setStatus('error')
      setMessage('Error al procesar la invitación')
      console.error('Accept invitation error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        {status === 'loading' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-10 h-10 text-purple-600 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Procesando invitación...
            </h1>
            <p className="text-gray-600">
              Por favor espera mientras verificamos tu invitación
            </p>
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mt-4" />
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              ¡Invitación aceptada!
            </h1>
            <p className="text-gray-600 mb-6">
              {message}
            </p>
            {projectName && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 space-y-2">
                <div>
                  <p className="text-sm text-gray-700 mb-1">Proyecto:</p>
                  <p className="font-semibold text-gray-900">{projectName}</p>
                </div>
                {role && (
                  <div>
                    <p className="text-sm text-gray-700 mb-1">Tu rol:</p>
                    <p className="font-semibold text-purple-700 capitalize">{role}</p>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
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
              No se pudo aceptar
            </h1>
            <p className="text-gray-600 mb-6">
              {message}
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                Posibles razones:
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside mt-2 text-left space-y-1">
                <li>La invitación ha expirado</li>
                <li>El email no coincide con tu cuenta</li>
                <li>Ya eres miembro del proyecto</li>
                <li>La invitación fue cancelada</li>
              </ul>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/')}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors"
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
