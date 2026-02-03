import { decryptAPIKey } from './encryption';

/**
 * Decrypt an encrypted API key using the centralized encryption module
 */
function decrypt(encryptedData: string): string {
  return decryptAPIKey(encryptedData);
}

type ServiceName = 'apify' | 'firecrawl' | 'openrouter' | 'perplexity' | 'phantombuster' | 'linkedin_cookie' | 'serper' | 'wavespeed' | 'fal' | 'blotato' | 'dumpling';

// Use a simple any type for the supabase client to avoid type recursion issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

interface GetApiKeyOptions {
  userId: string;
  serviceName: ServiceName;
  supabase: SupabaseClient;
}

/**
 * Get the API key for a service.
 * First tries to get user's personal key, then falls back to environment variable.
 *
 * @param options - userId, serviceName, and supabase client
 * @returns The API key or null if not found
 */
export async function getUserApiKey({
  userId,
  serviceName,
  supabase,
}: GetApiKeyOptions): Promise<string | null> {
  // First, try to get user's personal key
  try {
    console.log(`[getUserApiKey] Looking for ${serviceName} key for user ${userId}`);
    const { data: keyRecord, error } = await supabase
      .from('user_api_keys')
      .select('api_key_encrypted')
      .eq('user_id', userId)
      .eq('service_name', serviceName)
      .eq('is_active', true)
      .single();

    console.log(`[getUserApiKey] Query result - found: ${!!keyRecord}, error: ${error?.message || 'none'}`);

    if (!error && keyRecord?.api_key_encrypted) {
      const decrypted = decrypt(keyRecord.api_key_encrypted);
      console.log(`[getUserApiKey] Using user's personal ${serviceName} key`);
      return decrypted;
    }
  } catch (err) {
    console.warn(`[getUserApiKey] Error getting user key for ${serviceName}:`, err);
  }

  // Fall back to environment variable
  const envVarMap: Record<ServiceName, string> = {
    apify: 'APIFY_TOKEN',
    firecrawl: 'FIRECRAWL_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
    phantombuster: 'PHANTOMBUSTER_API_KEY',
    linkedin_cookie: 'PHANTOMBUSTER_LINKEDIN_COOKIE',
    serper: 'SERPER_API_KEY',
    wavespeed: 'WAVESPEED_API_KEY',
    fal: 'FAL_API_KEY',
    blotato: 'BLOTATO_API_KEY',
    dumpling: 'DUMPLING_API_KEY',
  };

  const envVar = envVarMap[serviceName];
  const envValue = process.env[envVar];

  if (envValue) {
    console.log(`[getUserApiKey] Using environment ${envVar} for ${serviceName}`);
    return envValue;
  }

  console.warn(`[getUserApiKey] No API key found for ${serviceName}`);
  return null;
}

/**
 * Get API key with a simpler interface (for server admin context)
 */
export async function getApiKeyForService(
  serviceName: ServiceName,
  userId?: string,
  supabaseClient?: SupabaseClient
): Promise<string | null> {
  // If we have user context, try their key first
  if (userId && supabaseClient) {
    return getUserApiKey({
      userId,
      serviceName,
      supabase: supabaseClient,
    });
  }

  // Fall back to environment variable
  const envVarMap: Record<ServiceName, string> = {
    apify: 'APIFY_TOKEN',
    firecrawl: 'FIRECRAWL_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
    phantombuster: 'PHANTOMBUSTER_API_KEY',
    linkedin_cookie: 'PHANTOMBUSTER_LINKEDIN_COOKIE',
    serper: 'SERPER_API_KEY',
    wavespeed: 'WAVESPEED_API_KEY',
    fal: 'FAL_API_KEY',
    blotato: 'BLOTATO_API_KEY',
    dumpling: 'DUMPLING_API_KEY',
  };

  return process.env[envVarMap[serviceName]] || null;
}
