import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Eventos de Polar que nos interesan
const CREDIT_EVENTS = ['order.created', 'checkout.created', 'subscription.created'];

interface PolarWebhookPayload {
  type: string;
  data: {
    id: string;
    customer_email?: string;
    customer?: {
      email?: string;
    };
    metadata?: {
      user_id?: string;
    };
    product?: {
      name?: string;
      metadata?: {
        credits?: string;
      };
    };
    amount?: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const payload: PolarWebhookPayload = await req.json();
    const eventType = payload.type;

    console.log('Polar webhook received:', {
      type: eventType,
      orderId: payload.data?.id,
    });

    // Solo procesar eventos relevantes
    if (!CREDIT_EVENTS.includes(eventType)) {
      console.log('Ignoring event type:', eventType);
      return NextResponse.json({ received: true, processed: false });
    }

    // Obtener user_id: primero de metadata, luego de customer_email
    const userId =
      payload.data.metadata?.user_id ||
      payload.data.customer_email ||
      payload.data.customer?.email;

    // Obtener cantidad de créditos del producto
    const credits = parseInt(payload.data.product?.metadata?.credits || '0');
    const productName = payload.data.product?.name || 'Unknown product';
    const orderId = payload.data.id;

    console.log('Processing credit purchase:', {
      userId,
      credits,
      productName,
      orderId,
    });

    if (!userId) {
      console.error('No user identifier found in webhook payload');
      return NextResponse.json(
        { error: 'No user identifier found' },
        { status: 400 }
      );
    }

    if (credits <= 0) {
      console.log('No credits to add (credits metadata missing or zero)');
      return NextResponse.json({
        received: true,
        processed: false,
        reason: 'No credits in product metadata',
      });
    }

    // Agregar créditos usando la función RPC
    const { data, error } = await supabase.rpc('add_credits', {
      p_user_id: userId,
      p_amount: credits,
      p_type: 'purchase',
      p_description: `Compra: ${productName}`,
      p_reference_id: orderId,
    });

    if (error) {
      console.error('Error adding credits:', error);
      return NextResponse.json(
        { error: 'Failed to add credits', details: error.message },
        { status: 500 }
      );
    }

    console.log('Credits added successfully:', data);

    return NextResponse.json({
      received: true,
      processed: true,
      result: data,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Endpoint de verificación (algunos servicios lo requieren)
export async function GET() {
  return NextResponse.json({ status: 'Polar webhook endpoint active' });
}
