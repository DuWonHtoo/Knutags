import Link from 'next/link';
import { BaseUrlWarning } from '@/components/BaseUrlWarning';
import { SubmitButton } from '@/components/SubmitButton';
import { Card, EmptyState, Flash, PageHeader, TableWrap, inputClass, labelClass, td, th } from '@/components/ui';
import { createBatchAction } from '@/lib/actions/batches';
import { requireAdmin } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { param, type SearchParams } from '@/lib/params';
import { db } from '@/lib/supabase';
import type { BatchOverview } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Batches' };

export default async function BatchesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { data, error } = await db().from('batch_overview').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const batches = (data ?? []) as BatchOverview[];

  return (
    <>
      <PageHeader title="Batches" subtitle="Generate blank tag IDs, export them for engraving, then track each batch." />
      <Flash ok={param(sp, 'ok')} error={param(sp, 'error')} />
      <BaseUrlWarning />

      <Card title="Generate a new batch" className="mb-6" description="IDs are random and never sequential. Up to 5000 per batch.">
        <form action={createBatchAction} className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div>
            <label htmlFor="label" className={labelClass}>
              Batch label
            </label>
            <input id="label" name="label" required maxLength={100} placeholder="e.g. 2026-11 steel 10mm" className={inputClass} />
          </div>
          <div>
            <label htmlFor="quantity" className={labelClass}>
              Quantity
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              inputMode="numeric"
              required
              min={1}
              max={5000}
              defaultValue={100}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notes" className={labelClass}>
              Notes <span className="font-normal text-slate-400">(optional: material, size, machine settings…)</span>
            </label>
            <textarea id="notes" name="notes" rows={2} maxLength={1000} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton pendingText="Generating…">Generate batch</SubmitButton>
          </div>
        </form>
      </Card>

      <Card title="All batches">
        {batches.length === 0 ? (
          <EmptyState>No batches yet.</EmptyState>
        ) : (
          <TableWrap>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className={th}>Label</th>
                  <th className={th}>Created</th>
                  <th className={th}>Engraved</th>
                  <th className={`${th} text-right`}>Tags</th>
                  <th className={`${th} text-right`}>Unassigned</th>
                  <th className={`${th} text-right`}>Assigned</th>
                  <th className={`${th} text-right`}>Inactive</th>
                  <th className={`${th} text-right`}>Void</th>
                  <th className={`${th} text-right`}>Scans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className={td}>
                      <Link href={`/admin/batches/${b.id}`} className="font-semibold underline underline-offset-2">
                        {b.label}
                      </Link>
                    </td>
                    <td className={td}>{formatDate(b.created_at)}</td>
                    <td className={td}>{b.engraved_at ? formatDate(b.engraved_at) : <span className="text-slate-400">no</span>}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.total}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.unassigned_count}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.assigned_count}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.inactive_count}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.void_count}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.scan_total}</td>
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
