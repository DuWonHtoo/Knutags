import type { ReactNode } from 'react';

type Kind = 'unassigned' | 'inactive' | 'not_found' | 'rate_limited' | 'error';

const CONTENT: Record<Kind, { icon: string; title: string; text: string }> = {
  unassigned: {
    icon: '◌',
    title: 'Not set up yet',
    text: 'This tag hasn’t been assigned to anyone yet.',
  },
  inactive: {
    icon: '⊘',
    title: 'No longer active',
    text: 'The profile linked to this tag is no longer active.',
  },
  not_found: {
    icon: '?',
    title: 'Tag not found',
    text: 'We couldn’t find this tag. Please check the code and try scanning again.',
  },
  rate_limited: {
    icon: '⏳',
    title: 'Please wait a moment',
    text: 'Too many requests came from your network. Try again in a minute.',
  },
  error: {
    icon: '!',
    title: 'Temporarily unavailable',
    text: 'Something went wrong on our side. Please try again in a moment.',
  },
};

/** Neutral full-screen message for every non-profile state of a scanned tag. */
export function TagMessage({ kind, children }: { kind: Kind; children?: ReactNode }) {
  const c = CONTENT[kind];
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12 text-center">
      <div
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-2xl font-semibold text-slate-600"
      >
        {c.icon}
      </div>
      <h1 className="mt-5 text-xl font-semibold">{c.title}</h1>
      <p className="mt-2 max-w-xs text-sm text-slate-500">{c.text}</p>
      {children}
    </main>
  );
}
