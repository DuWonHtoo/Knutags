'use client';

import { TagMessage } from '@/components/TagMessage';

export default function ProfileError({ reset }: { error: Error; reset: () => void }) {
  return (
    <TagMessage kind="error">
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </TagMessage>
  );
}
