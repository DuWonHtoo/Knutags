import { env, isTemporaryBaseUrl } from '@/lib/env';

/** Loud warning while PUBLIC_BASE_URL is not a permanent domain (never engrave those). */
export function BaseUrlWarning() {
  const url = env.publicBaseUrl;
  if (!isTemporaryBaseUrl(url)) return null;
  return (
    <div role="alert" className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
      <strong>Do not engrave yet.</strong> PUBLIC_BASE_URL is <code className="font-mono">{url}</code>, which looks temporary.
      Every engraved tag contains this address forever. Set your own permanent domain first (see docs/DEPLOYMENT.md).
    </div>
  );
}
