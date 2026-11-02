// Server-side configuration. Values are read lazily so that `next build` works
// without secrets; a clear error is thrown the first time a missing value is used.

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local (or set it in Vercel).`);
  }
  return value;
}

export const env = {
  get supabaseUrl(): string {
    return required('SUPABASE_URL').replace(/\/+$/, '');
  },
  get supabaseServiceKey(): string {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get adminPassword(): string {
    const password = required('ADMIN_PASSWORD');
    if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters long.');
    return password;
  },
  get sessionSecret(): string {
    const secret = required('SESSION_SECRET');
    if (secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters long.');
    return secret;
  },
  /** Permanent base URL engraved into the tags, without trailing slash. */
  get publicBaseUrl(): string {
    return required('PUBLIC_BASE_URL').replace(/\/+$/, '');
  },
  get photoBucket(): string {
    return process.env.PHOTO_BUCKET?.trim() || 'photos';
  },
  get lookupsPerMinute(): number {
    const n = Number(process.env.RATE_LIMIT_LOOKUPS_PER_MINUTE);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 60;
  },
  get qrUppercase(): boolean {
    return process.env.QR_URL_UPPERCASE?.trim().toLowerCase() === 'true';
  },
  get timeZone(): string {
    return process.env.DISPLAY_TIME_ZONE?.trim() || 'UTC';
  },
};

/** True when the base URL is clearly not a permanent production domain. */
export function isTemporaryBaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.vercel.app') ||
      host.endsWith('.local') ||
      host.includes('example')
    );
  } catch {
    return true;
  }
}
