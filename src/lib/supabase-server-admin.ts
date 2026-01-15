import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Creates an admin Supabase client using the service role key.
 * Use this for server-side operations that don't have a user session,
 * such as webhook handlers, cron jobs, or background tasks.
 *
 * WARNING: This client bypasses RLS. Only use when necessary.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
