import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Pagination } from '@/components/Pagination';
import { Card, EmptyState, Flash, PageHeader, StatusBadge, TableWrap, btnPrimary, inputClass, td, th } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { extractTagId } from '@/lib/ids';
import { isUuid, pageParam, param, type SearchParams } from '@/lib/params';
import { db } from '@/lib/supabase';
import { TAG_STATUSES, isTagStatus, type TagStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tags' };

const PAGE_SIZE = 50;
const SORTS = {
  recent: 'Newest first',
  scans: 'Most scans',
  lastscan: 'Last scanned',
  id: 'Tag ID',
} as const;
type Sort = keyof typeof SORTS;

type Row = {
  id: string;
  batch_id: string;
  batch_seq: number;
  status: TagStatus;
  scan_count: number;
  last_scanned_at: string | null;
  person: { id: string; full_name: string } | null;
  batch: { label: string } | null;
};

export default async function TagsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = param(sp, 'q').trim();
  const status = param(sp, 'status');
  const batch = param(sp, 'batch');
  const sort: Sort = param(sp, 'sort') in SORTS ? (param(sp, 'sort') as Sort) : 'recent';
  const page = pageParam(sp);

  // A complete ID (or pasted URL) jumps straight to that tag.
  const exact = q ? extractTagId(q) : null;
  if (exact) {
    const { data } = await db().from('tags').select('id').eq('id', exact).maybeSingle();
    if (data) redirect(`/admin/tags/${exact}`);
  }

  let query = db()
    .from('tags')
    .select('id,batch_id,batch_seq,status,scan_count,last_scanned_at,person:people(id,full_name),batch:batches(label)', {
      count: 'exact',
    });
  const idFragment = q.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (idFragment) query = query.ilike('id', `%${idFragment}%`);
  if (isTagStatus(status)) query = query.eq('status', status);
  if (isUuid(batch)) query = query.eq('batch_id', batch);

  if (sort === 'scans') query = query.order('scan_count', { ascending: false }).order('id');
  else if (sort === 'lastscan') query = query.order('last_scanned_at', { ascending: false, nullsFirst: false }).order('id');
  else if (sort === 'id') query = query.order('id');
  else query = query.order('created_at', { ascending: false }).order('batch_seq');

  const from = (page - 1) * PAGE_SIZE;
  const [{ data, count, error }, batchesRes] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    db().from('batches').select('id,label').order('created_at', { ascending: false }),
  ]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];
  const batches = (batchesRes.data ?? []) as { id: string; label: string }[];

  return (
    <>
      <PageHeader title="Tags" subtitle="Every engraved tag, its status and scan count." />
      <Flash ok={param(sp, 'ok')} error={param(sp, 'error')} />

      <Card className="mb-6">
        <form method="get" className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <input
            name="q"
            defaultValue={q}
            placeholder="Tag ID (or part of it)"
            autoCapitalize="characters"
            autoComplete="off"
            className={`${inputClass} font-mono`}
          />
          <select name="status" defaultValue={isTagStatus(status) ? status : ''} className={inputClass}>
            <option value="">All statuses</option>
            {TAG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select name="batch" defaultValue={isUuid(batch) ? batch : ''} className={inputClass}>
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          <select name="sort" defaultValue={sort} className={inputClass}>
            {Object.entries(SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className={btnPrimary}>
            Filter
          </button>
        </form>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <EmptyState>No tags match. Generate a batch first under Batches.</EmptyState>
        ) : (
          <TableWrap>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className={th}>Tag</th>
                  <th className={th}>Status</th>
                  <th className={th}>Person</th>
                  <th className={th}>Batch · #</th>
                  <th className={`${th} text-right`}>Scans</th>
                  <th className={th}>Last scan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((tag) => (
                  <tr key={tag.id}>
                    <td className={`${td} font-mono`}>
                      <Link href={`/admin/tags/${tag.id}`} className="font-semibold underline underline-offset-2">
                        {tag.id}
                      </Link>
                    </td>
                    <td className={td}>
                      <StatusBadge status={tag.status} />
                    </td>
                    <td className={td}>
                      {tag.person ? <Link href={`/admin/people/${tag.person.id}`}>{tag.person.full_name}</Link> : '—'}
                    </td>
                    <td className={td}>
                      <Link href={`/admin/batches/${tag.batch_id}`}>{tag.batch?.label ?? '—'}</Link>{' '}
                      <span className="text-slate-400">#{tag.batch_seq}</span>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{tag.scan_count}</td>
                    <td className={td}>{formatDateTime(tag.last_scanned_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <Pagination
          basePath="/admin/tags"
          params={{ q, status: isTagStatus(status) ? status : '', batch: isUuid(batch) ? batch : '', sort }}
          page={page}
          pageSize={PAGE_SIZE}
          total={count ?? 0}
        />
      </Card>
    </>
  );
}
