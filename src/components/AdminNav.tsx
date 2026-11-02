'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/tags', label: 'Tags' },
  { href: '/admin/people', label: 'People' },
  { href: '/admin/batches', label: 'Batches' },
  { href: '/admin/import', label: 'Import' },
  { href: '/admin/qr', label: 'QR test' },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
      aria-label="Admin"
    >
      {LINKS.map((link) => {
        const active = link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
              active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
