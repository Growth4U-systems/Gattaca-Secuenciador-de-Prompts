import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';

/**
 * Test endpoint para simular webhooks de Polar
 * SOLO para desarrollo/testing - NO usar en producción
 *
 * Uso:
 * POST /api/webhooks/polar/test
 * Body: { credits: 100 } (opcional, default 100)
 */
export async function POST(req: NextRequest) {
  // Solo permitir en desarrollo
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test endpoint disabled in production' },
      { status: 403 }
    );
  }

  try {
    const supabase = await createServerClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener créditos del body o usar default
    const body = await req.json().catch(() => ({}));
    const credits = body.credits || 100;

    // Simular payload de webhook de Polar
    const simulatedPayload = {
      type: 'order.created',
      data: {
        id: `test_order_${Date.now()}`,
        customer_email: user.email,
        metadata: {
          user_id: user.id,
        },
        product: {
          name: 'Test Credit Pack',
          metadata: {
            credits: credits.toString(),
          },
        },
      },
    };

    // Llamar al webhook real internamente
    const webhookUrl = new URL('/api/webhooks/polar', req.url);
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(simulatedPayload),
    });

    const result = await webhookResponse.json();

    return NextResponse.json({
      test: true,
      simulatedPayload,
      webhookResponse: result,
      message: `Simulated adding ${credits} credits to ${user.email}`,
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    return NextResponse.json(
      { error: 'Test failed', details: String(error) },
      { status: 500 }
    );
  }
}

// GET para ver instrucciones
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  return NextResponse.json({
    endpoint: '/api/webhooks/polar/test',
    method: 'POST',
    description:
      'Simulates a Polar webhook to add credits to the logged-in user',
    body: {
      credits: 'number (optional, default: 100)',
    },
    example: {
      credits: 500,
    },
  });
}
