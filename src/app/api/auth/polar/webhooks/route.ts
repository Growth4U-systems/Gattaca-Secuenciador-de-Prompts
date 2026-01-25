import { NextRequest, NextResponse } from 'next/server'

/**
 * Polar Webhook Handler
 *
 * Con el sistema de Usage-Based Billing de Polar, los créditos se manejan
 * automáticamente a través de Meters y Benefits. Este webhook:
 * 1. Recibe notificaciones de compras
 * 2. Logea los eventos para debugging
 * 3. Responde 200 para evitar que Polar lo deshabilite
 */

interface PolarWebhookPayload {
  type: string
  data: {
    id: string
    customer_id?: string
    customer_email?: string
    customer?: {
      id?: string
      email?: string
      external_id?: string
    }
    metadata?: Record<string, unknown>
    product?: {
      id?: string
      name?: string
    }
    amount?: number
    currency?: string
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload: PolarWebhookPayload = await req.json()
    const eventType = payload.type

    console.log('[Polar Webhook] Event received:', {
      type: eventType,
      dataId: payload.data?.id,
      customer: payload.data?.customer?.email || payload.data?.customer_email,
      product: payload.data?.product?.name,
    })

    // Log full payload for debugging (remove in production if sensitive)
    console.log('[Polar Webhook] Full payload:', JSON.stringify(payload, null, 2))

    // Con Polar Usage-Based Billing, los créditos se acreditan automáticamente
    // No necesitamos hacer nada aquí, solo confirmar recepción

    return NextResponse.json({
      received: true,
      type: eventType,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Polar Webhook] Error:', error)

    // Siempre responder 200 para evitar que Polar deshabilite el webhook
    // Los errores se logean pero no se propagan
    return NextResponse.json({
      received: true,
      error: 'Processing error logged',
      timestamp: new Date().toISOString(),
    })
  }
}

// GET para verificar que el endpoint está activo
export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'Polar webhooks',
    timestamp: new Date().toISOString(),
  })
}
