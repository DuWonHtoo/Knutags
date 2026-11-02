import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { isAdmin } from '@/lib/auth';
import { param, type SearchParams } from '@/lib/params';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin login' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (await isAdmin()) redirect('/admin');
  const next = param(await searchParams, 'next');
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-bold">QR Profile admin</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">You stay logged in on this device for 30 days.</p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
