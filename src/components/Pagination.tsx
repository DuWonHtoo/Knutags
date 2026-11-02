import Link from 'next/link';
import { btnSmall } from './ui';

/** Previous/next links that keep the current filters in the URL. */
export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    if (p > 1) qs.set('page', String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
      {page > 1 ? (
        <Link className={btnSmall} href={href(page - 1)}>
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-slate-500">
        Page {page} of {pages} · {total} total
      </span>
      {page < pages ? (
        <Link className={btnSmall} href={href(page + 1)}>
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
