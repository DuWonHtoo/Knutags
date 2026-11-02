'use client';

import { useActionState } from 'react';
import { loginAction } from '@/lib/actions/auth';
import { btnPrimary, inputClass, labelClass } from './ui';

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, null);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="password" className={labelClass}>
          Admin password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          autoFocus
          className={inputClass}
        />
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        {pending ? 'Checking…' : 'Log in'}
      </button>
    </form>
  );
}
