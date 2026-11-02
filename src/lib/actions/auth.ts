'use server';

import { redirect } from 'next/navigation';
import { checkPassword, clientKey, endSession, startSession } from '../auth';
import { hitRateLimit } from '../rate-limit';
import type { ActionState } from '../types';

const SAFE_NEXT = /^\/admin(\/[A-Za-z0-9/_-]*)?$/;

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // 10 attempts per 15 minutes per IP. Fails closed: no database, no login.
  const allowed = await hitRateLimit(`login:${await clientKey()}`, 10, 15 * 60);
  if (allowed === null) {
    return { error: 'Login is unavailable: the database cannot be reached. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' };
  }
  if (!allowed) return { error: 'Too many attempts. Wait 15 minutes and try again.' };

  const password = String(formData.get('password') ?? '');
  if (!checkPassword(password)) return { error: 'Wrong password.' };

  await startSession();
  const next = String(formData.get('next') ?? '');
  redirect(SAFE_NEXT.test(next) && !next.startsWith('/admin/login') ? next : '/admin');
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect('/admin/login');
}
