export type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a search param as a string ('' when missing). */
export function param(params: SearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export function pageParam(params: SearchParams): number {
  const n = Number.parseInt(param(params, 'page'), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Turns free text into a quoted PostgREST ilike pattern. Characters that have a
 * meaning in filters or LIKE patterns are removed (admins search names/IDs).
 */
export function ilikePattern(query: string): string | null {
  const cleaned = query.replace(/[\\"%*_,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return cleaned ? `"%${cleaned}%"` : null;
}
