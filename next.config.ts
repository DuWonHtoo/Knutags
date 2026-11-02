import type { NextConfig } from 'next';

// Applied to every response. The whole site is private: nothing should be indexed.
const securityHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Photos are shrunk in the browser before upload; this leaves headroom
      // while staying under Vercel's 4.5 MB request limit.
      bodySizeLimit: '4mb',
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    // Supports engraving fully uppercase URLs (HTTPS://DOMAIN/P/ID), which lets the
    // QR code use the compact alphanumeric mode. See QR_URL_UPPERCASE in .env.example.
    return [{ source: '/P/:id', destination: '/p/:id' }];
  },
};

export default nextConfig;
