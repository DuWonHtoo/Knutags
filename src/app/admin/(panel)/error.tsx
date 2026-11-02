'use client';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-red-200">
      <h1 className="text-lg font-semibold text-red-800">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-600">
        {process.env.NODE_ENV === 'development' ? error.message : 'Check the Vercel function logs for details.'}
        {error.digest ? <span className="block text-xs text-slate-400">Reference: {error.digest}</span> : null}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-knu-blue px-4 py-2.5 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </div>
  );
}
