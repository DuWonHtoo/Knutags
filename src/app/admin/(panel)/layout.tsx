import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminNav } from '@/components/AdminNav';
import { logoutAction } from '@/lib/actions/auth';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin' } };

export default async function PanelLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pt-3 sm:flex-row sm:items-center sm:gap-6 sm:py-3">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="font-bold tracking-tight">
              QR Profile
            </Link>
            <form action={logoutAction} className="sm:hidden">
              <button type="submit" className="text-sm text-slate-500">
                Log out
              </button>
            </form>
          </div>
          <AdminNav />
          <form action={logoutAction} className="ml-auto hidden sm:block">
            <button type="submit" className="text-sm text-slate-500 hover:text-slate-900">
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
