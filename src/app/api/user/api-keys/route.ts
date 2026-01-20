import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

// Supported services (perplexity removed - now accessed via OpenRouter)
const SUPPORTED_SERVICES = ['apify', 'firecrawl', 'openrouter', 'serper', 'wavespeed', 'fal'] as const;
type ServiceName = (typeof SUPPORTED_SERVICES)[number];

// ============================================
// ENCRYPTION HELPERS
// ============================================

function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not configured');
  }

  // Create a 32-byte key from the encryption key
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedData: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not configured');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return '****';
  }
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

// ============================================
// GET - List user's API keys (masked)
// ============================================

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: keys, error } = await supabase
      .from('user_api_keys')
      .select('id, service_name, is_active, created_at, updated_at, api_key_encrypted')
      .eq('user_id', session.user.id)
      .order('service_name');

    if (error) {
      console.error('[api-keys] Error fetching keys:', error);
      return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
    }

    // Return masked keys
    const maskedKeys = (keys || []).map((key) => {
      let maskedKey = '****';
      try {
        const decrypted = decrypt(key.api_key_encrypted);
        maskedKey = maskApiKey(decrypted);
      } catch {
        // If decryption fails, show error
        maskedKey = '[Error de desencriptación]';
      }

      return {
        id: key.id,
        service_name: key.service_name,
        is_active: key.is_active,
        created_at: key.created_at,
        updated_at: key.updated_at,
        masked_key: maskedKey,
      };
    });

    // Add supported services that don't have a key yet
    const existingServices = maskedKeys.map((k) => k.service_name);
    const availableServices = SUPPORTED_SERVICES.filter((s) => !existingServices.includes(s));

    return NextResponse.json({
      keys: maskedKeys,
      available_services: availableServices,
      supported_services: SUPPORTED_SERVICES,
    });
  } catch (error) {
    console.error('[api-keys] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Save/Update an API key
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { service_name, api_key } = body as { service_name: ServiceName; api_key: string };

    // Validate input
    if (!service_name || !SUPPORTED_SERVICES.includes(service_name)) {
      return NextResponse.json(
        { error: `Invalid service. Supported: ${SUPPORTED_SERVICES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!api_key || typeof api_key !== 'string' || api_key.trim().length < 10) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 400 });
    }

    // Encrypt the API key
    const encryptedKey = encrypt(api_key.trim());

    // Upsert the key (insert or update)
    const { data, error } = await supabase
      .from('user_api_keys')
      .upsert(
        {
          user_id: session.user.id,
          service_name,
          api_key_encrypted: encryptedKey,
          is_active: true,
        },
        {
          onConflict: 'user_id,service_name',
        }
      )
      .select('id, service_name, is_active, created_at, updated_at')
      .single();

    if (error) {
      console.error('[api-keys] Error saving key:', error);
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      key: {
        ...data,
        masked_key: maskApiKey(api_key),
      },
    });
  } catch (error) {
    console.error('[api-keys] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove an API key
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const serviceName = searchParams.get('service_name');

    if (!serviceName) {
      return NextResponse.json({ error: 'Missing service_name parameter' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_api_keys')
      .delete()
      .eq('user_id', session.user.id)
      .eq('service_name', serviceName);

    if (error) {
      console.error('[api-keys] Error deleting key:', error);
      return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api-keys] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
