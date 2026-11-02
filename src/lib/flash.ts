import { redirect } from 'next/navigation';

/**
 * Redirects back to a page with a one-off message in the URL (?ok=… or ?error=…),
 * shown by the <Flash> component. Never call inside try/catch: redirect() works
 * by throwing.
 */
export function redirectWith(path: string, kind: 'ok' | 'error', message: string): never {
  const [base] = path.split('?');
  redirect(`${base}?${kind}=${encodeURIComponent(message)}`);
}
