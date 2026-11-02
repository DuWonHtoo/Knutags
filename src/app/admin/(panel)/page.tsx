import Link from 'next/link';
import { BaseUrlWarning } from '@/components/BaseUrlWarning';
import { Card, EmptyState, Flash, PageHeader, Stat, StatusBadge, TableWrap, btnPrimary, inputClass, td, th } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { param, type SearchParams } from '@/lib/params';
import { db } from '@/lib/supabase';
import type { TagStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RecentScan = {
  id: string;
  status: TagStatus;
  scan_count: number;
  last_scanned_at: string;
  person: { id: string; full_name: string } | null;
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;

  const [countsRes, peopleRes, batchesRes, recentRes] = await Promise.all([
    db().from('tag_status_counts').select('status,n'),
    db().from('people').select('id', { count: 'exact', head: true }),
    db().from('batches').select('id', { count: 'exact', head: true }),
    db()
      .from('tags')
      .select('id,status,scan_count,last_scanned_at,person:people(id,full_name)')
      .not('last_scanned_at', 'is', null)
      .order('last_scanned_at', { ascending: false })
      .limit(10),
  ]);
  if (countsRes.error) throw new Error(countsRes.error.message);

  const counts: Record<TagStatus, number> = { unassigned: 0, assigned: 0, inactive: 0, void: 0 };
  for (const row of countsRes.data as { status: TagStatus; n: number }[]) counts[row.status] = row.n;
  const recent = (recentRes.data ?? []) as unknown as RecentScan[];

  return (
    <>
      <PageHeader title="Dashboard" />
      <Flash ok={param(sp, 'ok')} error={param(sp, 'error')} />
      <BaseUrlWarning />

      <Card className="mb-6">
        <form action="/admin/tags" method="get" className="flex flex-col gap-2 sm:flex-row">
          <input
            name="q"
            placeholder="Tag ID or scanned URL, e.g. K7M3QX9"
            autoCapitalize="characters"
            autoComplete="off"
            className={`${inputClass} font-mono`}
          />
          <button type="submit" className={btnPrimary}>
            Open tag
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Tip: while logged in on your phone, simply scan a blank tag with the camera; it opens the assignment screen.
        </p>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Unassigned" value={counts.unassigned} href="/admin/tags?status=unassigned" />
        <Stat label="Assigned" value={counts.assigned} href="/admin/tags?status=assigned" />
        <Stat label="Inactive" value={counts.inactive} href="/admin/tags?status=inactive" />
        <Stat label="Void" value={counts.void} href="/admin/tags?status=void" />
        <Stat label="People" value={peopleRes.count ?? 0} href="/admin/people" />
        <Stat label="Batches" value={batchesRes.count ?? 0} href="/admin/batches" />
      </div>

      <Card title="Recent scans">
        {recent.length === 0 ? (
          <EmptyState>No scans yet.</EmptyState>
        ) : (
          <TableWrap>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className={th}>Tag</th>
                  <th className={th}>Status</th>
                  <th className={th}>Person</th>
                  <th className={`${th} text-right`}>Scans</th>
                  <th className={th}>Last scan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((tag) => (
                  <tr key={tag.id}>
                    <td className={`${td} font-mono`}>
                      <Link href={`/admin/tags/${tag.id}`} className="underline underline-offset-2">
                        {tag.id}
                      </Link>
                    </td>
                    <td className={td}>
                      <StatusBadge status={tag.status} />
                    </td>
                    <td className={td}>
                      {tag.person ? <Link href={`/admin/people/${tag.person.id}`}>{tag.person.full_name}</Link> : '—'}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{tag.scan_count}</td>
                    <td className={td}>{formatDateTime(tag.last_scanned_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
