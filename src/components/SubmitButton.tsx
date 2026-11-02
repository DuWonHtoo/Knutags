'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { btnPrimary } from './ui';

/**
 * Submit button that disables itself while its form is being processed.
 * With `confirmText`, the browser asks for confirmation first (for destructive actions).
 */
export function SubmitButton({
  children,
  pendingText = 'Working…',
  className = btnPrimary,
  confirmText,
  name,
  value,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  confirmText?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={className}
      onClick={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
