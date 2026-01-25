import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { getCreditsBalance } from '@/lib/polar-usage';

export async function GET() {
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

    // Debug: ver qué devuelve Supabase
    console.log('[Credits API] User from Supabase:', { id: user.id, email: user.email });

    // Obtener balance de créditos en Polar (buscar por userId y email)
    const result = await getCreditsBalance(user.id, user.email);

    if (!result.success) {
      // Si Polar no está configurado, devolver datos vacíos
      if (result.error?.includes('not configured')) {
        return NextResponse.json({
          configured: false,
          balance: 0,
          consumed: 0,
          message: 'Polar not configured',
        });
      }

      return NextResponse.json(
        { error: result.error || 'Failed to fetch credits' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      configured: true,
      balance: result.balance ?? 0,
      consumed: result.consumed ?? 0,
    });
  } catch (error) {
    console.error('Polar credits API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
