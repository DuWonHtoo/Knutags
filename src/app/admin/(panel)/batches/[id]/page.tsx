import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BaseUrlWarning } from '@/components/BaseUrlWarning';
import { Pagination } from '@/components/Pagination';
import { SubmitButton } from '@/components/SubmitButton';
import {
  Card,
  Flash,
  PageHeader,
  Stat,
  StatusBadge,
  TableWrap,
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSmall,
  inputClass,
  labelClass,
  td,
  th,
} from '@/components/ui';
import { deleteBatchAction, setEngravedAction, voidInBatchAction } from '@/lib/actions/batches';
import { requireAdmin } from '@/lib/auth';
import { env } from '@/lib/env';
import { formatDateTime } from '@/lib/format';
import { tagUrl } from '@/lib/ids';
import { isUuid, pageParam, param, type SearchParams } from '@/lib/params';
import { EC_LEVELS } from '@/lib/qr-vector';
import { db } from '@/lib/supabase';
import type { BatchOverview, TagStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: 'Batch' };
  const { data } = await db().from('batches').select('label').eq('id', id).maybeSingle();
  return { title: (data as { label: string } | null)?.label ?? 'Batch' };
}

type Row = {
  id: string;
  batch_seq: number;
  status: TagStatus;
  scan_count: number;
  person: { id: string; full_name: string } | null;
};

export default async function BatchPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const page = pageParam(sp);
  const from = (page - 1) * PAGE_SIZE;

  const [batchRes, tagsRes] = await Promise.all([
    db().from('batch_overview').select('*').eq('id', id).maybeSingle(),
    db()
      .from('tags')
      .select('id,batch_seq,status,scan_count,person:people(id,full_name)', { count: 'exact' })
      .eq('batch_id', id)
      .order('batch_seq')
      .range(from, from + PAGE_SIZE - 1),
  ]);
  if (batchRes.error) throw new Error(batchRes.error.message);
  const batch = batchRes.data as BatchOverview | null;
  if (!batch) notFound();
  const rows = (tagsRes.data ?? []) as unknown as Row[];

  const base = env.publicBaseUrl;
  const upper = env.qrUppercase;
  const exportHref = (format: string) => `/api/admin/batches/${id}/export?format=${format}`;
  const canDelete = !batch.engraved_at && batch.unassigned_count === batch.total;

  return (
    <>
      <PageHeader
        title={batch.label}
        subtitle={`Created ${formatDateTime(batch.created_at)}${batch.notes ? ` · ${batch.notes}` : ''}`}
        actions={
          <Link href="/admin/batches" className={btnSmall}>
            ← All batches
          </Link>
        }
      />
      <Flash ok={param(sp, 'ok')} error={param(sp, 'error')} />
      <BaseUrlWarning />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Tags" value={batch.total} />
        <Stat label="Unassigned" value={batch.unassigned_count} href={`/admin/tags?batch=${id}&status=unassigned`} />
        <Stat label="Assigned" value={batch.assigned_count} href={`/admin/tags?batch=${id}&status=assigned`} />
        <Stat label="Inactive" value={batch.inactive_count} href={`/admin/tags?batch=${id}&status=inactive`} />
        <Stat label="Void" value={batch.void_count} href={`/admin/tags?batch=${id}&status=void`} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card
          title="1. Export for engraving"
          description={
            <>
              Rows are in position order (#1 first). URLs look like{' '}
              <code className="break-all font-mono text-xs">{tagUrl(base, rows[0]?.id ?? 'ABC2345', upper)}</code>
            </>
          }
        >
          <div className="flex flex-wrap gap-2">
            <a className={btnPrimary} href={exportHref('csv')}>
              CSV (id,url)
            </a>
            <a className={btnSecondary} href={exportHref('csv-noheader')}>
              CSV without header
            </a>
            <a className={btnSecondary} href={exportHref('txt-urls')}>
              TXT: one URL per line
            </a>
            <a className={btnSecondary} href={exportHref('txt-ids')}>
              TXT: one ID per line
            </a>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            For BslCAD variable text, the TXT files are the most compatible. See docs/BSLCAD.md for step-by-step instructions.
          </p>

          <details className="mt-4 border-t border-slate-100 pt-4">
            <summary className="cursor-pointer text-sm font-semibold">Fallback: DXF sheet (vector import, no variable text)</summary>
            <form method="get" action={`/api/admin/batches/${id}/export`} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <input type="hidden" name="format" value="dxf" />
              <div>
                <label className={labelClass} htmlFor="size">
                  Code size (mm)
                </label>
                <input id="size" name="size" type="number" step="0.5" min={3} max={50} defaultValue={10} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="ec">
                  Error correction
                </label>
                <select id="ec" name="ec" defaultValue="M" className={inputClass}>
                  {EC_LEVELS.map((ec) => (
                    <option key={ec} value={ec}>
                      {ec}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="cols">
                  Columns
                </label>
                <input id="cols" name="cols" type="number" min={1} max={50} defaultValue={5} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="pitchx">
                  Pitch X (mm)
                </label>
                <input id="pitchx" name="pitchx" type="number" step="0.1" min={1} defaultValue={20} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="pitchy">
                  Pitch Y (mm)
                </label>
                <input id="pitchy" name="pitchy" type="number" step="0.1" min={1} defaultValue={20} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="start">
                  From position #
                </label>
                <input id="start" name="start" type="number" min={1} max={batch.total} defaultValue={1} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="count">
                  How many (max 60)
                </label>
                <input id="count" name="count" type="number" min={1} max={60} defaultValue={25} className={inputClass} />
              </div>
              <div className="flex items-end">
                <button type="submit" className={`${btnSecondary} w-full`}>
                  Download DXF
                </button>
              </div>
            </form>
            <p className="mt-2 text-xs text-slate-500">
              Pitch = distance between the centres of neighbouring pieces on your fixture. Position #1 is top-left, filling
              left to right. Each code is drawn without its quiet zone; keep 4 modules of clear metal around it.
            </p>
          </details>
        </Card>

        <div className="space-y-6">
          <Card title="2. Mark as engraved">
            {batch.engraved_at ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">
                  Engraved on <strong>{formatDateTime(batch.engraved_at)}</strong>.
                </p>
                <form action={setEngravedAction.bind(null, id, false)}>
                  <SubmitButton className={btnSmall} pendingText="Saving…">
                    Undo
                  </SubmitButton>
                </form>
              </div>
            ) : (
              <form action={setEngravedAction.bind(null, id, true)}>
                <SubmitButton pendingText="Saving…">Mark batch as engraved</SubmitButton>
              </form>
            )}
          </Card>

          <Card
            title="3. Void damaged pieces"
            description="Enter tag IDs and/or position numbers (#), separated by spaces, commas or new lines. Only unassigned tags are voided."
          >
            <form action={voidInBatchAction.bind(null, id)} className="space-y-3">
              <textarea
                name="items"
                rows={3}
                required
                placeholder="e.g. 17 42 K7M3QX9"
                autoCapitalize="characters"
                className={`${inputClass} font-mono`}
              />
              <SubmitButton className={btnDanger} pendingText="Voiding…" confirmText="Mark these tags as void?">
                Void these tags
              </SubmitButton>
            </form>
          </Card>
        </div>
      </div>

      <Card title="Tags in this batch">
        <TableWrap>
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr>
                <th className={`${th} text-right`}>#</th>
                <th className={th}>Tag</th>
                <th className={th}>Status</th>
                <th className={th}>Person</th>
                <th className={`${th} text-right`}>Scans</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((tag) => (
                <tr key={tag.id}>
                  <td className={`${td} text-right tabular-nums text-slate-400`}>{tag.batch_seq}</td>
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
                  <td className={`${td} text-right tabular-nums`}>{tag.scan_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <Pagination basePath={`/admin/batches/${id}`} params={{}} page={page} pageSize={PAGE_SIZE} total={tagsRes.count ?? 0} />
      </Card>

      {canDelete ? (
        <Card title="Delete batch" className="mt-6" description="Possible only before engraving, while every tag is unassigned.">
          <form action={deleteBatchAction.bind(null, id)}>
            <SubmitButton
              className={btnDanger}
              pendingText="Deleting…"
              confirmText="Delete this batch and all its tag IDs? Only do this if nothing was engraved."
            >
              Delete batch
            </SubmitButton>
          </form>
        </Card>
      ) : null}
    </>
  );
}
