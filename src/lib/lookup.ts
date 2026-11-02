import { cache } from 'react';
import { clientKey, isAdmin } from './auth';
import { env } from './env';
import { db } from './supabase';
import type { LookupResult } from './types';

/**
 * Public tag lookup used by /p/[id]. Wrapped in React cache() so the page and
 * its metadata share one database call (one scan counted, one rate-limit hit).
 * Admins are not rate limited and their scans are not counted.
 */
export const lookupTag = cache(async (id: string): Promise<{ lookup: LookupResult; admin: boolean }> => {
  const admin = await isAdmin();
  const { data, error } = await db().rpc('lookup_tag', {
    p_id: id,
    p_client: admin ? null : await clientKey(),
    p_count: !admin,
    p_limit: env.lookupsPerMinute,
  });
  if (error) throw new Error(`Lookup failed: ${error.message}`);
  return { lookup: data as LookupResult, admin };
});
