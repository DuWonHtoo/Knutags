import type { ReactNode } from 'react';
import type { TagStatus } from '@/lib/types';

// Shared class names. Inputs use text-base (16px) so iOS Safari doesn't zoom in.
const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
export const btnPrimary = `${btnBase} bg-knu-blue text-white hover:bg-knu-blue-dark`;
export const btnSecondary = `${btnBase} bg-white text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50`;
export const btnDanger = `${btnBase} bg-red-600 text-white hover:bg-red-500`;
export const btnSmall =
  'inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset ring-slate-300 bg-white hover:bg-slate-50';
export const inputClass =
  'block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-base text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-knu-blue';
export const labelClass = 'mb-1 block text-sm font-medium text-slate-700';
export const linkClass = 'font-medium text-knu-blue underline decoration-knu-blue/30 underline-offset-2 hover:decoration-knu-blue';

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  title,
  description,
  children,
  className = '',
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 ${className}`}>
      {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      <div className={title || description ? 'mt-4' : ''}>{children}</div>
    </section>
  );
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`mb-6 rounded-xl px-4 py-3 text-sm ring-1 ${
        error ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      }`}
    >
      {error || ok}
    </div>
  );
}

const STATUS_STYLES: Record<TagStatus, string> = {
  unassigned: 'bg-slate-100 text-slate-700 ring-slate-300',
  assigned: 'bg-emerald-50 text-emerald-700 ring-emerald-300',
  inactive: 'bg-amber-50 text-amber-800 ring-amber-300',
  void: 'bg-red-50 text-red-700 ring-red-300',
};

export function StatusBadge({ status }: { status: TagStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

export function Stat({ label, value, href }: { label: string; value: ReactNode; href?: string }) {
  const body = (
    <>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </>
  );
  const cls = 'block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200';
  return href ? (
    <a href={href} className={`${cls} hover:ring-slate-400`}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{children}</p>;
}

/** Horizontal scroll container for tables so the page itself never scrolls sideways. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-4 overflow-x-auto sm:mx-0">{children}</div>;
}

export const th = 'whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500';
export const td = 'whitespace-nowrap px-3 py-2 text-sm';
