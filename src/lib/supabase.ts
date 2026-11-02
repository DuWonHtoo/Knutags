import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the secret (service_role) key.
 * Never import this from a 'use client' file.
 */
export function db(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('The Supabase admin client must only be used on the server.');
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

/** Throws a readable error for a failed Supabase call. */
export function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}
