import { db } from './supabase';

/**
 * Counts one hit for `key`. Returns true while within `limit` hits per window,
 * false when over the limit, and null when the database could not be reached.
 */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean | null> {
  try {
    const { data, error } = await db().rpc('rate_limit_hit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error('rate_limit_hit failed', error.message);
      return null;
    }
    return data === true;
  } catch (err) {
    console.error('rate_limit_hit failed', err);
    return null;
  }
}
