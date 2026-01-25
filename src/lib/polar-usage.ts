import {
  polar,
  POLAR_EVENTS,
  calculateLLMCost,
  calculateScrapeCost,
  calculateSerpCost,
  calculateVideoCost,
} from './polar';

/**
 * Polar Usage Tracking Service
 *
 * Sistema simplificado: 1 crédito = $1
 * Todos los eventos se envían como "credit_usage" con el monto en dólares
 */

// ============================================
// Función principal de ingesta
// ============================================

/**
 * Ingesta un evento de uso de créditos a Polar
 * @param userId - ID del usuario (UUID de Supabase)
 * @param credits - Cantidad de créditos consumidos (en dólares)
 * @param metadata - Datos adicionales del evento
 */
export async function ingestCredits(
  userId: string,
  credits: number,
  metadata: Record<string, string | number>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validar que tenemos la API key configurada
    if (!process.env.POLAR_ACCESS_TOKEN) {
      console.warn('[Polar] POLAR_ACCESS_TOKEN not configured, skipping usage tracking');
      return { success: true }; // No fallar si no está configurado
    }

    // No enviar eventos de 0 créditos
    if (credits <= 0) {
      return { success: true };
    }

    await polar.events.ingest({
      events: [
        {
          name: POLAR_EVENTS.CREDIT_USAGE,
          externalCustomerId: userId,
          metadata: {
            ...metadata,
            credits, // Send as number for Polar Sum Aggregation
          },
        },
      ],
    });

    console.log(`[Polar] Credits used: $${credits.toFixed(4)}`, { userId, ...metadata });
    return { success: true };
  } catch (error) {
    console.error('[Polar] Failed to ingest credits:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Consulta de balance
// ============================================

/**
 * Obtiene el balance de créditos del usuario
 * @param userId - ID del usuario (Supabase UUID)
 * @param email - Email del usuario (para buscar en Polar)
 */
export async function getCreditsBalance(
  userId: string,
  email?: string
): Promise<{
  success: boolean;
  balance?: number;
  consumed?: number;
  error?: string;
}> {
  try {
    if (!process.env.POLAR_ACCESS_TOKEN) {
      return {
        success: false,
        error: 'POLAR_ACCESS_TOKEN not configured',
      };
    }

    // Buscar cliente - primero por external_id (userId), luego por email
    let customers = await polar.customers.list({
      query: userId,
    } as Parameters<typeof polar.customers.list>[0]);

    // Si no encontramos por userId, buscar por email
    if (!customers.result.items.length && email) {
      console.log(`[Polar] Customer not found by userId, trying email: ${email}`);
      customers = await polar.customers.list({
        query: email,
      } as Parameters<typeof polar.customers.list>[0]);
    }

    if (!customers.result.items.length) {
      console.log(`[Polar] No customer found for userId=${userId} or email=${email}`);
      return {
        success: true,
        balance: 0,
        consumed: 0,
      };
    }

    const customer = customers.result.items[0];
    console.log(`[Polar] Found customer: ${customer.id} (email: ${customer.email})`);

    // Obtener meters del cliente
    const metersResponse = await polar.customerMeters.list({
      customerId: customer.id,
    } as Parameters<typeof polar.customerMeters.list>[0]);

    console.log(`[Polar] Customer has ${metersResponse.result.items.length} meters`);

    // Buscar el meter de créditos (nombre debe coincidir con el meter en Polar)
    const creditMeter = metersResponse.result.items.find(
      (meter: { meter: { name: string } }) => meter.meter.name === 'credits'
    ) as { balance: number; consumed?: number } | undefined;

    if (creditMeter) {
      console.log(`[Polar] Credits meter found - balance: ${creditMeter.balance}`);
    } else {
      console.log(`[Polar] No 'credits' meter found for customer`);
    }

    return {
      success: true,
      balance: creditMeter?.balance ?? 0,
      consumed: creditMeter?.consumed ?? 0,
    };
  } catch (error) {
    console.error('[Polar] Failed to get credits balance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verifica si el usuario tiene créditos suficientes
 * @param userId - ID del usuario
 * @param required - Cantidad requerida en dólares (opcional)
 */
export async function hasCredits(
  userId: string,
  required?: number
): Promise<{ hasCredits: boolean; balance: number; error?: string }> {
  try {
    const result = await getCreditsBalance(userId);

    if (!result.success) {
      // Si no podemos verificar, permitir la operación (fail-open)
      console.warn('[Polar] Could not verify credits, allowing operation');
      return { hasCredits: true, balance: 0, error: result.error };
    }

    const balance = result.balance ?? 0;
    const hasEnough = required ? balance >= required : balance > 0;

    return {
      hasCredits: hasEnough,
      balance,
    };
  } catch (error) {
    console.error('[Polar] Failed to check credits:', error);
    // Fail-open: si hay error, permitir la operación
    return { hasCredits: true, balance: 0, error: String(error) };
  }
}

// ============================================
// Helpers para cada tipo de uso
// ============================================

/**
 * Registra uso de LLM y calcula el costo automáticamente
 * @param userId - ID del usuario
 * @param tokens - Número de tokens usados
 * @param model - Nombre del modelo
 */
export async function trackLLMUsage(userId: string, tokens: number, model: string) {
  const credits = calculateLLMCost(tokens, model);
  return ingestCredits(userId, credits, {
    type: 'llm',
    tokens,
    model,
  });
}

/**
 * Registra uso de scraping y calcula el costo automáticamente
 * @param userId - ID del usuario
 * @param pages - Número de páginas scrapeadas
 * @param provider - Proveedor usado (firecrawl, apify, jina)
 */
export async function trackScrapeUsage(
  userId: string,
  pages: number,
  provider: string = 'firecrawl'
) {
  const credits = calculateScrapeCost(pages, provider);
  return ingestCredits(userId, credits, {
    type: 'scrape',
    pages,
    provider,
  });
}

/**
 * Registra uso de SERP y calcula el costo automáticamente
 * @param userId - ID del usuario
 * @param searches - Número de búsquedas
 * @param provider - Proveedor usado (serper, google)
 */
export async function trackSerpUsage(
  userId: string,
  searches: number,
  provider: string = 'serper'
) {
  const credits = calculateSerpCost(searches, provider);
  return ingestCredits(userId, credits, {
    type: 'serp',
    searches,
    provider,
  });
}

/**
 * Registra uso de video y calcula el costo automáticamente
 * @param userId - ID del usuario
 * @param durationSec - Duración en segundos
 * @param provider - Proveedor usado (fal, wavespeed)
 */
export async function trackVideoUsage(
  userId: string,
  durationSec: number,
  provider: string = 'fal'
) {
  const credits = calculateVideoCost(durationSec, provider);
  return ingestCredits(userId, credits, {
    type: 'video',
    duration_sec: durationSec,
    provider,
  });
}
