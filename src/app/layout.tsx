import type { Metadata, Viewport } from 'next';
import { Lexend, Source_Sans_3 } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

// Self-hosted at build time: no requests to Google from visitors' phones.
const display = Lexend({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' });
const body = Source_Sans_3({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'QR Profile', template: '%s · QR Profile' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1a3b85',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh bg-knu-bg font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
