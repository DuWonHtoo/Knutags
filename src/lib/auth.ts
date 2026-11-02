import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from './env';

// Admin session: a signed, http-only cookie "admin.<expiry>.<hmac>".
// No session table is needed; changing SESSION_SECRET logs everyone out.

const COOKIE_NAME = 'qrp_admin';
const SESSION_DAYS = 30;

function sign(payload: string): string {
  return createHmac('sha256', env.sessionSecret).update(payload).digest('base64url');
}

/** Constant-time string comparison (hashing first makes lengths equal). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(input: string): boolean {
  return safeEqual(input, env.adminPassword);
}

export async function startSession(): Promise<void> {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `admin.${expires}`;
  const store = await cookies();
  store.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // "lax" so the cookie is sent when a phone camera opens a scanned tag URL.
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return false;
  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  if (!safeEqual(signature, sign(payload))) return false;
  const [role, expires] = payload.split('.');
  return role === 'admin' && Number(expires) > Date.now();
}

/** Use at the top of every admin page, server action and admin route. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/login');
}

/**
 * Anonymised identifier of the visitor for rate limiting: an HMAC of the IP
 * address, so raw IPs are never stored. Vercel sets these headers itself.
 */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip =
    h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip')?.trim() ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  return createHmac('sha256', env.sessionSecret).update(`ip:${ip}`).digest('base64url').slice(0, 32);
}
